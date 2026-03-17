#!/usr/bin/env node
/**
 * CRM Health Monitor — Auto-Recovery System
 *
 * Checks CRM endpoints every 60 seconds.
 * Auto-restarts services that fail 2+ consecutive checks.
 * Logs all health events to /tmp/crm-health.log.
 *
 * Usage:
 *   node health-monitor.js
 *   PM2 start health-monitor.js --name crm-health-monitor
 */

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');

const LOG_FILE = '/tmp/crm-health.log';
const CHECK_INTERVAL = 60_000; // 60 seconds
const PM2_BIN = 'pm2'; // Use system pm2 (VPS host)

// CRM services only — real estate empire, nothing else
const SERVICES = [
  {
    name: 'CRM Frontend',
    port: 3000,
    path: '/',
    pm2Name: 'astraterra-frontend',
    critical: true,
  },
  {
    name: 'CRM Backend',
    port: 3001,
    path: '/api/health',
    pm2Name: 'astraterra-backend',
    critical: true,
    env: { PORT: '3001' },
  },
];

// Track consecutive failures per service
const failCounts = {};
SERVICES.forEach(s => { failCounts[s.name] = 0; });

// Latest status for /api/health-status
const latestStatus = {};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    // ignore log write errors
  }
}

function checkEndpoint(service) {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: '127.0.0.1', port: service.port, path: service.path, timeout: 5000 },
      (res) => {
        res.resume();
        resolve({ ok: res.statusCode < 500, statusCode: res.statusCode });
      }
    );
    req.on('error', () => resolve({ ok: false, statusCode: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, statusCode: 0 }); });
  });
}

function restartService(service) {
  try {
    const envPrefix = service.env ? Object.entries(service.env).map(([k, v]) => `${k}=${v}`).join(' ') + ' ' : '';
    const cmd = `${envPrefix}${PM2_BIN} restart ${service.pm2Name} --update-env 2>&1`;
    log(`🔄 AUTO-RESTART: ${service.name} (${service.pm2Name})`);
    const output = execSync(cmd, { timeout: 15000 }).toString().trim();
    log(`   Result: ${output.split('\n')[0]}`);
    return true;
  } catch (e) {
    log(`❌ RESTART FAILED: ${service.name} — ${e.message}`);
    return false;
  }
}

async function runHealthCheck() {
  const results = [];

  for (const service of SERVICES) {
    const result = await checkEndpoint(service);

    latestStatus[service.name] = {
      ok: result.ok,
      statusCode: result.statusCode,
      port: service.port,
      pm2Name: service.pm2Name,
      lastCheck: new Date().toISOString(),
      consecutiveFailures: failCounts[service.name],
    };

    if (result.ok) {
      if (failCounts[service.name] > 0) {
        log(`✅ RECOVERED: ${service.name} (port ${service.port})`);
      }
      failCounts[service.name] = 0;
    } else {
      failCounts[service.name]++;
      log(`⚠️  DOWN: ${service.name} (port ${service.port}) — HTTP ${result.statusCode} — failure #${failCounts[service.name]}`);

      if (failCounts[service.name] >= 2) {
        restartService(service);
        failCounts[service.name] = 0;
      }
    }

    results.push({ service: service.name, ...result });
  }

  return results;
}

function getHealthStatus() {
  return {
    timestamp: new Date().toISOString(),
    services: { ...latestStatus },
    allHealthy: Object.values(latestStatus).every(s => s.ok),
  };
}

module.exports = { getHealthStatus, runHealthCheck };

if (require.main === module) {
  log('🏥 CRM Health Monitor started — checking every 60s');
  log(`   Monitoring: ${SERVICES.map(s => `${s.name}:${s.port}`).join(', ')}`);
  runHealthCheck();
  setInterval(runHealthCheck, CHECK_INTERVAL);
}
