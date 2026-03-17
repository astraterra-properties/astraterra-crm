#!/usr/bin/env node
/**
 * Isabelle Self-Healing System
 *
 * Runs on the VPS as a PM2 process. Handles:
 * 1. Health check every 15 min — CRM backend, VPS disk/memory
 * 2. Dead man's switch — Telegram alert if Isabelle hasn't responded in 30 min
 * 3. Daily status report — 8 AM Dubai time via Telegram
 * 4. Auto-restart CRM if down
 * 5. WhatsApp watchdog — checks every 10 min, docker restarts if disconnected
 */

const https = require('https');
const http = require('http');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Config ────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const JOSEPH_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8117376630';
const JOSEPH_WA_NUMBER = '+971586131006';          // WhatsApp alert target
const DOCKER_CONTAINER = 'openclaw-rjgw-openclaw-1';
const OPENCLAW_HOST_PORT = 59053;                  // host-mapped container port
const CRM_URL = 'http://localhost:3001/api/health';
const CRM_FRONTEND_URL = 'http://localhost:3000';
const HEALTH_INTERVAL_MS = 15 * 60 * 1000;        // 15 minutes
const WA_CHECK_INTERVAL_MS = 10 * 60 * 1000;      // 10 minutes
const DEAD_MAN_THRESHOLD_MS = 30 * 60 * 1000;     // 30 minutes
const LOG_FILE = '/tmp/self-heal.log';
const HEARTBEAT_FILE = '/tmp/isabelle-heartbeat.json';
const WA_STATE_FILE = '/tmp/wa-watchdog-state.json';
const DAILY_REPORT_HOUR_DUBAI = 8;                // 8 AM Dubai

// ─── Logging ───────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (e) {}
}

// ─── Telegram ──────────────────────────────────────────────────────────────
function sendTelegram(text) {
  return new Promise((resolve) => {
    if (!BOT_TOKEN) return resolve(false);
    const body = JSON.stringify({ chat_id: JOSEPH_CHAT_ID, text, parse_mode: 'HTML' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', (e) => { log(`Telegram error: ${e.message}`); resolve(false); });
    req.write(body);
    req.end();
  });
}

// ─── WhatsApp via OpenClaw API ─────────────────────────────────────────────
function sendWhatsApp(message) {
  return new Promise((resolve) => {
    // Read token from openclaw config (mounted volume)
    let token = '';
    try {
      const cfg = JSON.parse(fs.readFileSync('/data/.openclaw/openclaw.json', 'utf8'));
      token = cfg?.gateway?.auth?.token || '';
    } catch {}
    if (!token) {
      log('[wa-watchdog] No OpenClaw token — cannot send WhatsApp alert');
      return resolve(false);
    }

    const body = JSON.stringify({
      channel: 'whatsapp',
      to: JOSEPH_WA_NUMBER,
      message,
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: OPENCLAW_HOST_PORT,
      path: '/api/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        log(`[wa-watchdog] WhatsApp API response: ${res.statusCode} ${data.substring(0, 100)}`);
        resolve(res.statusCode < 300);
      });
    });
    req.on('error', (e) => { log(`[wa-watchdog] WhatsApp send error: ${e.message}`); resolve(false); });
    req.write(body);
    req.end();
  });
}

// ─── HTTP check ────────────────────────────────────────────────────────────
function checkUrl(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode < 500, statusCode: res.statusCode });
    });
    req.on('error', () => resolve({ ok: false, statusCode: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, statusCode: 0 }); });
  });
}

// ─── System stats ──────────────────────────────────────────────────────────
function getSystemStats() {
  try {
    const disk = execSync("df -h / | tail -1 | awk '{print $5}'").toString().trim();
    const mem = execSync("free -m | awk 'NR==2{printf \"%s/%sMB (%.0f%%)\", $3,$2,$3*100/$2}'").toString().trim();
    const uptime = execSync("uptime -p").toString().trim();
    return { disk, mem, uptime, ok: true };
  } catch (e) {
    return { disk: '?', mem: '?', uptime: '?', ok: false };
  }
}

// ─── PM2 process status ────────────────────────────────────────────────────
function getPm2Status() {
  try {
    const output = execSync('pm2 jlist 2>/dev/null', { timeout: 10000 }).toString();
    const procs = JSON.parse(output);
    return procs.map(p => ({
      name: p.name,
      status: p.pm2_env?.status || 'unknown',
      restarts: p.pm2_env?.restart_time || 0,
    }));
  } catch (e) {
    return [];
  }
}

// ─── Restart CRM if down ───────────────────────────────────────────────────
function restartCrm(serviceName) {
  try {
    execSync(`pm2 restart ${serviceName} --update-env 2>&1`, { timeout: 15000 });
    log(`🔄 Restarted ${serviceName}`);
    return true;
  } catch (e) {
    log(`❌ Failed to restart ${serviceName}: ${e.message}`);
    return false;
  }
}

// ─── Heartbeat check (dead man's switch) ───────────────────────────────────
let deadManAlertSent = false;

function updateHeartbeat() {
  try {
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify({ lastSeen: Date.now(), ts: new Date().toISOString() }));
  } catch (e) {}
}

function readLastHeartbeat() {
  try {
    const d = JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf8'));
    return d.lastSeen || 0;
  } catch (e) {
    return 0;
  }
}

async function checkDeadManSwitch() {
  const lastSeen = readLastHeartbeat();
  const elapsed = Date.now() - lastSeen;
  if (elapsed > DEAD_MAN_THRESHOLD_MS) {
    if (!deadManAlertSent) {
      log(`⚠️ Dead man's switch triggered — Isabelle silent for ${Math.round(elapsed / 60000)}m`);
      await sendTelegram(
        `⚠️ <b>Isabelle is unresponsive</b> — checking systems\n\n` +
        `Last seen: ${lastSeen ? new Date(lastSeen).toISOString() : 'never'}\n` +
        `Silent for: ${Math.round(elapsed / 60000)} minutes\n\nRunning diagnostics...`
      );
      deadManAlertSent = true;
      await runHealthCheck(true);
    }
  } else {
    deadManAlertSent = false;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ─── WhatsApp Watchdog ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

let waState = { restartCount: 0, lastRestartAt: null, isRestarting: false };

function loadWaState() {
  try {
    if (fs.existsSync(WA_STATE_FILE)) {
      Object.assign(waState, JSON.parse(fs.readFileSync(WA_STATE_FILE, 'utf8')));
    }
  } catch {}
}

function saveWaState() {
  try { fs.writeFileSync(WA_STATE_FILE, JSON.stringify(waState, null, 2)); } catch {}
}

/**
 * Check WhatsApp connection by scanning docker logs for recent heartbeat.
 * A "web-heartbeat" log entry every ~60s means the gateway is alive.
 * No heartbeat for >3 min + disconnect patterns = disconnected.
 */
function checkWhatsAppConnected() {
  return new Promise((resolve) => {
    // Scan last 100 lines of container logs
    exec(`docker logs --tail 100 ${DOCKER_CONTAINER} 2>&1`, (err, stdout) => {
      if (err && !stdout) {
        log(`[wa-watchdog] Cannot read docker logs: ${err.message}`);
        // Can't determine status — assume connected to avoid false restarts
        return resolve(true);
      }

      const lines = (stdout || '').split('\n');
      const now = Date.now();
      const threeMinutesAgo = now - 3 * 60 * 1000;

      let lastHeartbeatTs = null;
      let hasDisconnect = false;
      let hasRecentInbound = false;

      for (const line of lines) {
        // Recent heartbeat signal
        if (line.includes('web-heartbeat') || line.includes('web-inbound')) {
          const m = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
          if (m) {
            const ts = new Date(m[1] + 'Z').getTime();
            if (!lastHeartbeatTs || ts > lastHeartbeatTs) lastHeartbeatTs = ts;
          }
        }
        // Disconnect indicators
        if (
          line.includes('WhatsApp gateway disconnected') ||
          line.includes('Connection Failure') ||
          line.includes('status=515') ||
          line.includes('ECONNRESET') ||
          line.includes('Socket closed') ||
          line.includes('Closing stale')
        ) {
          hasDisconnect = true;
        }
        // A recent inbound message is a strong connected signal
        if (line.includes('web-inbound')) hasRecentInbound = true;
      }

      if (lastHeartbeatTs && lastHeartbeatTs > threeMinutesAgo) {
        log(`[wa-watchdog] ✅ Recent heartbeat: ${new Date(lastHeartbeatTs).toISOString()}`);
        return resolve(true);
      }

      if (hasDisconnect && !hasRecentInbound) {
        log(`[wa-watchdog] ⚠️ Disconnect signal in logs, no recent inbound`);
        return resolve(false);
      }

      // Ambiguous — check if container is running at all
      exec(`docker inspect -f '{{.State.Running}}' ${DOCKER_CONTAINER} 2>&1`, (e2, out2) => {
        if (e2 || out2.trim() !== 'true') {
          log(`[wa-watchdog] Container not running!`);
          return resolve(false);
        }
        // Container running but logs are old — give benefit of doubt
        log(`[wa-watchdog] Container running, logs ambiguous — assuming connected`);
        resolve(true);
      });
    });
  });
}

async function runWhatsAppWatchdog() {
  if (waState.isRestarting) {
    log('[wa-watchdog] Restart in progress, skipping check');
    return;
  }

  log(`[wa-watchdog] Checking WhatsApp connection... ${new Date().toISOString()}`);

  const connected = await checkWhatsAppConnected();
  if (connected) {
    log('[wa-watchdog] ✅ WhatsApp connected');
    return;
  }

  // ── DISCONNECTED ──────────────────────────────────────────────────────
  log('[wa-watchdog] 🔴 WhatsApp DISCONNECTED — sending alert then restarting container');
  waState.isRestarting = true;
  waState.restartCount++;
  waState.lastRestartAt = new Date().toISOString();
  saveWaState();

  const dubaiTime = new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai', hour12: false });

  // 1. Telegram alert first (always works even when WA is down)
  await sendTelegram(
    `⚠️ <b>WhatsApp disconnected</b>\n\n` +
    `Running <code>docker restart ${DOCKER_CONTAINER}</code>\n` +
    `Time: ${dubaiTime} (Dubai)\n` +
    `Restart #${waState.restartCount}`
  );

  // 2. Docker restart
  try {
    log(`[wa-watchdog] Running: docker restart ${DOCKER_CONTAINER}`);
    execSync(`docker restart ${DOCKER_CONTAINER}`, { timeout: 60000 });
    log('[wa-watchdog] Docker restart completed');
  } catch (e) {
    log(`[wa-watchdog] Docker restart failed: ${e.message}`);
    await sendTelegram(`🚨 <b>docker restart FAILED</b>\n${e.message}\n\nManual intervention needed!`);
    waState.isRestarting = false;
    saveWaState();
    return;
  }

  // 3. Wait for container to come back up (~45s)
  log('[wa-watchdog] Waiting 45s for container to restart...');
  await new Promise(r => setTimeout(r, 45000));

  // 4. Verify reconnected
  const reconnected = await checkWhatsAppConnected();
  const healTime = new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai', hour12: false });

  if (reconnected) {
    log('[wa-watchdog] ✅ Self-healed! WhatsApp back online');

    // 5. WhatsApp message to +971586131006
    await sendWhatsApp(
      `⚠️ WhatsApp disconnected — auto-reconnecting now\n\n` +
      `✅ Self-healed at ${healTime} (Dubai)\n` +
      `Container restarted successfully.\n` +
      `Total auto-restarts: ${waState.restartCount}`
    );

    // 6. Telegram confirmation
    await sendTelegram(
      `✅ <b>WhatsApp self-healed</b>\n\n` +
      `Container restarted and WhatsApp is back online.\n` +
      `Time: ${healTime} (Dubai)\n` +
      `Total restarts: ${waState.restartCount}`
    );
  } else {
    log('[wa-watchdog] ❌ Still disconnected after restart');
    await sendTelegram(
      `🚨 <b>WhatsApp still DOWN after restart</b>\n\n` +
      `Container restarted but WhatsApp did not reconnect.\n` +
      `Time: ${healTime} (Dubai)\n\n` +
      `Manual check required: <code>docker logs ${DOCKER_CONTAINER}</code>`
    );
  }

  waState.isRestarting = false;
  saveWaState();
}

// ─── Health check ──────────────────────────────────────────────────────────
let consecutiveFailures = { crm: 0, frontend: 0 };

async function runHealthCheck(forceReport = false) {
  log('🔍 Running health check...');

  const crmResult = await checkUrl(CRM_URL);
  const frontendResult = await checkUrl(CRM_FRONTEND_URL);
  const stats = getSystemStats();
  const pm2 = getPm2Status();

  if (!crmResult.ok) {
    consecutiveFailures.crm++;
    log(`⚠️ CRM backend down (HTTP ${crmResult.statusCode}) — failure #${consecutiveFailures.crm}`);
    if (consecutiveFailures.crm >= 2) {
      const restarted = restartCrm('astraterra-backend');
      if (restarted) {
        await new Promise(r => setTimeout(r, 5000));
        const recheck = await checkUrl(CRM_URL);
        if (recheck.ok) {
          await sendTelegram(`✅ <b>CRM auto-recovered</b>\nBackend restarted. Status: HTTP ${recheck.statusCode}`);
          consecutiveFailures.crm = 0;
        } else {
          await sendTelegram(`🚨 <b>CRM BACKEND STILL DOWN</b>\nAuto-restart failed.\nURL: ${CRM_URL}\nHTTP: ${recheck.statusCode}`);
        }
      }
    }
  } else {
    consecutiveFailures.crm = 0;
  }

  if (!frontendResult.ok) {
    consecutiveFailures.frontend++;
    if (consecutiveFailures.frontend >= 2) {
      restartCrm('astraterra-frontend');
      consecutiveFailures.frontend = 0;
    }
  } else {
    consecutiveFailures.frontend = 0;
  }

  if (forceReport) {
    const pm2Summary = pm2.length > 0
      ? pm2.map(p => `  • ${p.name}: ${p.status} (${p.restarts} restarts)`).join('\n')
      : '  (unable to read PM2)';

    await sendTelegram(
      `🏥 <b>Isabelle Health Report</b>\n\n` +
      `🌐 CRM Backend: ${crmResult.ok ? '✅ Online' : '❌ DOWN'} (HTTP ${crmResult.statusCode})\n` +
      `🖥️ CRM Frontend: ${frontendResult.ok ? '✅ Online' : '❌ DOWN'} (HTTP ${frontendResult.statusCode})\n` +
      `📱 WhatsApp watchdog: ✅ Active (${waState.restartCount} restarts total)\n\n` +
      `📊 System:\n  • Disk: ${stats.disk}\n  • RAM: ${stats.mem}\n  • Uptime: ${stats.uptime}\n\n` +
      `⚙️ PM2:\n${pm2Summary}`
    );
  }

  return { crmResult, frontendResult, stats, pm2 };
}

// ─── Daily status report ───────────────────────────────────────────────────
let lastDailyReportDate = '';

async function maybeSendDailyReport() {
  const nowUtc = new Date();
  const dubaiHour = (nowUtc.getUTCHours() + 4) % 24;
  const todayDate = nowUtc.toISOString().slice(0, 10);

  if (dubaiHour === DAILY_REPORT_HOUR_DUBAI && lastDailyReportDate !== todayDate) {
    lastDailyReportDate = todayDate;
    log('📊 Sending daily status report...');

    const { crmResult, frontendResult, stats, pm2 } = await runHealthCheck(false);

    let recentErrors = 'None';
    try {
      const logContent = fs.readFileSync(LOG_FILE, 'utf8').split('\n');
      const errors = logContent.filter(l => l.includes('❌') || l.includes('⚠️') || l.includes('DOWN')).slice(-5);
      if (errors.length > 0) recentErrors = errors.join('\n').substring(0, 400);
    } catch (e) {}

    const pm2Summary = pm2.length > 0
      ? pm2.map(p => `  • ${p.name}: ${p.status} (↺${p.restarts})`).join('\n')
      : '  (unable to read PM2)';

    await sendTelegram(
      `🌅 <b>Good morning Joseph! Daily Status Report</b>\n` +
      `📅 ${nowUtc.toDateString()}\n\n` +
      `<b>CRM Status:</b>\n` +
      `  🌐 Backend: ${crmResult.ok ? '✅ Online' : '❌ DOWN'}\n` +
      `  🖥️ Frontend: ${frontendResult.ok ? '✅ Online' : '❌ DOWN'}\n\n` +
      `<b>WhatsApp Watchdog:</b>\n` +
      `  📱 Active — ${waState.restartCount} auto-restarts total\n` +
      `  🕐 Last restart: ${waState.lastRestartAt || 'never'}\n\n` +
      `<b>VPS Health:</b>\n` +
      `  💾 Disk: ${stats.disk}\n  🧠 RAM: ${stats.mem}\n  ⏱️ Uptime: ${stats.uptime}\n\n` +
      `<b>PM2 Services:</b>\n${pm2Summary}\n\n` +
      `<b>Recent Issues (last 24h):</b>\n${recentErrors}\n\n` +
      `<i>Have a great day! — Isabelle 🏢</i>`
    );
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  loadWaState();
  log('🚀 Isabelle self-healing system started');
  log(`📱 WhatsApp watchdog: checks every 10 min, alerts ${JOSEPH_WA_NUMBER}`);
  log(`🐳 Docker container: ${DOCKER_CONTAINER}`);

  await sendTelegram(
    '🤖 <b>Isabelle Self-Healing System</b> is now active.\n\n' +
    '✅ WhatsApp watchdog (every 10 min)\n' +
    '✅ CRM health checks (every 15 min)\n' +
    '✅ Dead man\'s switch (30 min)\n' +
    '✅ Daily report at 8 AM Dubai'
  );

  // Initial checks
  await runHealthCheck(true);
  await runWhatsAppWatchdog();

  // CRM health every 15 min
  setInterval(async () => {
    await runHealthCheck(false);
    await checkDeadManSwitch();
    await maybeSendDailyReport();
  }, HEALTH_INTERVAL_MS);

  // WhatsApp watchdog every 10 min
  setInterval(runWhatsAppWatchdog, WA_CHECK_INTERVAL_MS);

  // Dead man's switch every 5 min
  setInterval(checkDeadManSwitch, 5 * 60 * 1000);

  // Daily report check every hour
  setInterval(maybeSendDailyReport, 60 * 60 * 1000);
}

module.exports = { updateHeartbeat, sendTelegram, log };

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
