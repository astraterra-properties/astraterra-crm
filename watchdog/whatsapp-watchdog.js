/**
 * WhatsApp Connection Watchdog
 * ============================
 * Monitors OpenClaw WhatsApp connection every 10 minutes.
 * If disconnected, sends SIGUSR1 to openclaw-gateway to trigger restart.
 * Sends WhatsApp alert when connection is restored.
 *
 * Run as PM2 process: pm2 start whatsapp-watchdog.js --name wa-watchdog
 */

const { exec } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const OPENCLAW_LOG_PATH = '/proc/1/fd/1'; // stdout of PID 1 (docker-init)
const OPENCLAW_PORT = 18789;
const WA_NUMBER = '+971585580053';
const STATE_FILE = path.join(__dirname, '.watchdog-state.json');

// OpenClaw gateway token (read from config)
function getGatewayToken() {
  try {
    const config = JSON.parse(fs.readFileSync('/data/.openclaw/openclaw.json', 'utf8'));
    return config?.gateway?.auth?.token || process.env.OPENCLAW_GATEWAY_TOKEN || '';
  } catch {
    return process.env.OPENCLAW_GATEWAY_TOKEN || '';
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  lastConnected: Date.now(),
  restartCount: 0,
  lastRestartAt: null,
  isRestarting: false,
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
    }
  } catch {}
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

// ── Detect WhatsApp connection ─────────────────────────────────────────────────
function checkWhatsAppConnected() {
  return new Promise((resolve) => {
    // Method 1: Check openclaw logs for recent heartbeat (web-heartbeat within last 3 min)
    exec('openclaw logs --lines 50 2>/dev/null | tail -50', (err, stdout) => {
      if (err || !stdout) {
        // Method 2: Check if openclaw-gateway process is running
        exec('pgrep -f openclaw-gateway', (err2, stdout2) => {
          if (err2 || !stdout2.trim()) {
            console.log('[watchdog] openclaw-gateway process NOT found');
            return resolve(false);
          }
          // Process running but can't read logs — assume connected
          console.log('[watchdog] openclaw-gateway running (PID:', stdout2.trim(), ')');
          resolve(true);
        });
        return;
      }

      const lines = stdout.trim().split('\n');
      const now = Date.now();
      const threeMinutesAgo = now - 3 * 60 * 1000;

      // Look for recent web-heartbeat or successful inbound message
      let lastHeartbeat = null;
      let hasDisconnect = false;

      for (const line of lines) {
        if (line.includes('web-heartbeat') || line.includes('web-inbound')) {
          // Extract timestamp from log line
          const tsMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/);
          if (tsMatch) {
            const ts = new Date(tsMatch[1]).getTime();
            if (!lastHeartbeat || ts > lastHeartbeat) lastHeartbeat = ts;
          }
        }
        if (line.includes('disconnected') || line.includes('Connection closed') ||
            line.includes('ECONNRESET') || line.includes('WhatsApp login failed')) {
          hasDisconnect = true;
        }
      }

      if (hasDisconnect && !lastHeartbeat) {
        console.log('[watchdog] Disconnect detected, no recent heartbeat');
        return resolve(false);
      }

      if (lastHeartbeat && lastHeartbeat > threeMinutesAgo) {
        console.log('[watchdog] Recent heartbeat found:', new Date(lastHeartbeat).toISOString());
        state.lastConnected = lastHeartbeat;
        saveState();
        return resolve(true);
      }

      // No recent heartbeat - check if gateway process is alive
      exec('pgrep -f openclaw-gateway', (err3, stdout3) => {
        if (!err3 && stdout3.trim()) {
          console.log('[watchdog] Gateway process alive, assuming connected (PID:', stdout3.trim(), ')');
          // Still alive - might just be quiet
          resolve(true);
        } else {
          console.log('[watchdog] No heartbeat + no gateway process = disconnected');
          resolve(false);
        }
      });
    });
  });
}

// ── Restart gateway ────────────────────────────────────────────────────────────
function restartGateway() {
  return new Promise((resolve) => {
    console.log('[watchdog] Sending SIGUSR1 to openclaw-gateway...');

    exec('pgrep -f openclaw-gateway', (err, stdout) => {
      if (err || !stdout.trim()) {
        console.log('[watchdog] Gateway not found, killing all openclaw processes to trigger restart...');
        exec('pkill -f "openclaw gateway run" || true', (e2) => {
          setTimeout(resolve, 5000);
        });
        return;
      }

      const pid = parseInt(stdout.trim());
      console.log('[watchdog] Sending SIGUSR1 to PID', pid);

      try {
        process.kill(pid, 'SIGUSR1');
        console.log('[watchdog] SIGUSR1 sent successfully');
      } catch (e) {
        console.log('[watchdog] SIGUSR1 failed:', e.message, '— trying SIGTERM...');
        try { process.kill(pid, 'SIGTERM'); } catch {}
      }

      // Wait for restart
      setTimeout(resolve, 15000);
    });
  });
}

// ── Send WhatsApp alert via OpenClaw API ───────────────────────────────────────
function sendWhatsAppAlert(message) {
  return new Promise((resolve) => {
    const token = getGatewayToken();
    if (!token) {
      console.log('[watchdog] No gateway token, skipping WhatsApp alert');
      return resolve();
    }

    const body = JSON.stringify({
      channel: 'whatsapp',
      to: WA_NUMBER,
      message: message,
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: OPENCLAW_PORT,
      path: '/api/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('[watchdog] WhatsApp alert sent, status:', res.statusCode, data.substring(0, 100));
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log('[watchdog] WhatsApp alert failed:', e.message);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

// ── Main check loop ────────────────────────────────────────────────────────────
async function runCheck() {
  if (state.isRestarting) {
    console.log('[watchdog] Still restarting, skipping check');
    return;
  }

  console.log('[watchdog] Checking WhatsApp connection...', new Date().toISOString());

  const connected = await checkWhatsAppConnected();

  if (connected) {
    console.log('[watchdog] ✅ WhatsApp connected. All good.');
    return;
  }

  // DISCONNECTED
  console.log('[watchdog] ⚠️ WhatsApp DISCONNECTED — triggering restart...');
  state.isRestarting = true;
  state.restartCount++;
  state.lastRestartAt = new Date().toISOString();
  saveState();

  await restartGateway();

  // Wait and verify reconnection
  console.log('[watchdog] Waiting 30s for reconnection...');
  await new Promise(r => setTimeout(r, 30000));

  const reconnected = await checkWhatsAppConnected();

  if (reconnected) {
    console.log('[watchdog] ✅ Self-healed! WhatsApp reconnected.');
    await sendWhatsAppAlert(
      `✅ *WhatsApp Self-Healed*\n\nOpenClaw gateway restarted and WhatsApp is back online.\n\n` +
      `🕐 Time: ${new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })} (Dubai)\n` +
      `🔄 Total restarts today: ${state.restartCount}`
    );
  } else {
    console.log('[watchdog] ❌ Still disconnected after restart attempt.');
    // Try once more - send SIGTERM to force full process restart
    await restartGateway();
  }

  state.isRestarting = false;
  saveState();
}

// ── Startup ────────────────────────────────────────────────────────────────────
loadState();
console.log('[watchdog] 🚀 WhatsApp Watchdog started');
console.log('[watchdog] Check interval: 10 minutes');
console.log('[watchdog] Previous restarts:', state.restartCount);

// Run immediately on start
setTimeout(runCheck, 30000); // wait 30s for gateway to fully start

// Then every 10 minutes
setInterval(runCheck, CHECK_INTERVAL_MS);

// Keep process alive
process.on('uncaughtException', (err) => {
  console.error('[watchdog] Uncaught exception:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('[watchdog] Unhandled rejection:', err);
});
