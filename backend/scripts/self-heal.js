#!/usr/bin/env node
/**
 * Isabelle Self-Healing System
 * 
 * Runs on the VPS as a PM2 process. Handles:
 * 1. Health check every 15 min — CRM backend, VPS disk/memory
 * 2. Dead man's switch — Telegram alert if Isabelle hasn't responded in 30 min
 * 3. Daily status report — 8 AM Dubai time via Telegram
 * 4. Auto-restart CRM if down
 * 
 * Companion: self-heal-whatsapp.js monitors the OpenClaw WhatsApp gateway
 */

const https = require('https');
const http = require('http');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Config ────────────────────────────────────────────────────────────────
const BOT_TOKEN = '8301233584:AAFlAVIrtEm6oAiSzsj93ADHlat-Z4JpW3U';
const JOSEPH_CHAT_ID = '8117376630';
const CRM_URL = 'http://localhost:3001/api/health';
const CRM_FRONTEND_URL = 'http://localhost:3000';
const HEALTH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const DEAD_MAN_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const LOG_FILE = '/tmp/self-heal.log';
const HEARTBEAT_FILE = '/tmp/isabelle-heartbeat.json';
const DAILY_REPORT_HOUR_DUBAI = 8; // 8 AM Dubai = 4 AM UTC

// ─── Telegram ──────────────────────────────────────────────────────────────
function sendTelegram(text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ chat_id: JOSEPH_CHAT_ID, text, parse_mode: 'HTML' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', (e) => { log(`Telegram error: ${e.message}`); resolve(false); });
    req.write(body);
    req.end();
  });
}

// ─── Logging ───────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (e) {}
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
        `Silent for: ${Math.round(elapsed / 60000)} minutes\n\n` +
        `Running diagnostics...`
      );
      deadManAlertSent = true;
      // Run a full health check and report
      await runHealthCheck(true);
    }
  } else {
    deadManAlertSent = false;
  }
}

// ─── Health check ──────────────────────────────────────────────────────────
let consecutiveFailures = { crm: 0, frontend: 0 };

async function runHealthCheck(forceReport = false) {
  log('🔍 Running health check...');

  const crmResult = await checkUrl(CRM_URL);
  const frontendResult = await checkUrl(CRM_FRONTEND_URL);
  const stats = getSystemStats();
  const pm2 = getPm2Status();

  // CRM backend check
  if (!crmResult.ok) {
    consecutiveFailures.crm++;
    log(`⚠️ CRM backend down (HTTP ${crmResult.statusCode}) — failure #${consecutiveFailures.crm}`);
    if (consecutiveFailures.crm >= 2) {
      const restarted = restartCrm('astraterra-backend');
      if (restarted) {
        await new Promise(r => setTimeout(r, 5000));
        const recheck = await checkUrl(CRM_URL);
        if (recheck.ok) {
          await sendTelegram(`✅ <b>CRM auto-recovered</b>\nBackend was down, restarted successfully.\nStatus: HTTP ${recheck.statusCode}`);
          consecutiveFailures.crm = 0;
        } else {
          await sendTelegram(`🚨 <b>CRM BACKEND STILL DOWN</b>\nAuto-restart attempted but failed.\nURL: ${CRM_URL}\nHTTP: ${recheck.statusCode}\n\nManual intervention may be needed.`);
        }
      }
    }
  } else {
    if (consecutiveFailures.crm > 0) {
      log(`✅ CRM backend recovered`);
    }
    consecutiveFailures.crm = 0;
  }

  // Frontend check
  if (!frontendResult.ok) {
    consecutiveFailures.frontend++;
    log(`⚠️ CRM frontend down (HTTP ${frontendResult.statusCode}) — failure #${consecutiveFailures.frontend}`);
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
      `🖥️ CRM Frontend: ${frontendResult.ok ? '✅ Online' : '❌ DOWN'} (HTTP ${frontendResult.statusCode})\n\n` +
      `📊 System:\n` +
      `  • Disk: ${stats.disk}\n` +
      `  • RAM: ${stats.mem}\n` +
      `  • Uptime: ${stats.uptime}\n\n` +
      `⚙️ PM2 Processes:\n${pm2Summary}`
    );
  }

  return { crmResult, frontendResult, stats, pm2 };
}

// ─── Daily status report ───────────────────────────────────────────────────
let lastDailyReportDate = '';

async function maybeSendDailyReport() {
  const nowUtc = new Date();
  const dubaiHour = (nowUtc.getUTCHours() + 4) % 24; // UTC+4
  const todayDate = nowUtc.toISOString().slice(0, 10);

  if (dubaiHour === DAILY_REPORT_HOUR_DUBAI && lastDailyReportDate !== todayDate) {
    lastDailyReportDate = todayDate;
    log('📊 Sending daily status report...');

    const { crmResult, frontendResult, stats, pm2 } = await runHealthCheck(false);

    // Read recent errors from log
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
      `<b>VPS Health:</b>\n` +
      `  💾 Disk: ${stats.disk}\n` +
      `  🧠 RAM: ${stats.mem}\n` +
      `  ⏱️ Uptime: ${stats.uptime}\n\n` +
      `<b>PM2 Services:</b>\n${pm2Summary}\n\n` +
      `<b>Recent Issues (last 24h):</b>\n${recentErrors}\n\n` +
      `<i>Have a great day! — Isabelle 🏢</i>`
    );
  }
}

// ─── Main loop ─────────────────────────────────────────────────────────────
async function main() {
  log('🚀 Isabelle self-healing system started');
  await sendTelegram('🤖 <b>Isabelle Self-Healing System</b> is now active.\n\n✅ WhatsApp monitoring\n✅ CRM health checks (every 15min)\n✅ Dead man\'s switch (30min)\n✅ Daily report at 8 AM Dubai');

  // Initial health check
  await runHealthCheck(true);

  // Health check loop
  setInterval(async () => {
    await runHealthCheck(false);
    await checkDeadManSwitch();
    await maybeSendDailyReport();
  }, HEALTH_INTERVAL_MS);

  // Dead man's switch runs more frequently (every 5 min)
  setInterval(checkDeadManSwitch, 5 * 60 * 1000);

  // Daily report check runs every hour
  setInterval(maybeSendDailyReport, 60 * 60 * 1000);
}

// Export heartbeat updater for use by other services
module.exports = { updateHeartbeat, sendTelegram, log };

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
