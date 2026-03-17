#!/bin/bash
# Astraterra CRM Auto-Start Script (PM2 Edition)
# CRITICAL NOTES:
# 1. Backend MUST use PORT=3001 explicitly — shell env has PORT=59053 (OpenClaw internal)
# 2. PM2 home is at /data/.pm2
# 3. PM2 binary is at /skeleton/.npm-global/bin/pm2

PM2=$(which pm2 || find /data/.npm -name "pm2" -type f 2>/dev/null | head -1 || echo "/usr/local/bin/pm2")
CRM=/data/.openclaw/workspace/astraterra-crm

# ── Check if PM2 is managing the processes ────────────────────────────────────
BACKEND_STATUS=$($PM2 jlist 2>/dev/null | node -e "
  const l=require('fs').readFileSync('/dev/stdin','utf8');
  try {
    const list = JSON.parse(l);
    const b = list.find(p => p.name === 'crm-backend');
    console.log(b ? b.pm2_env.status : 'missing');
  } catch(e) { console.log('missing'); }
")

FRONTEND_STATUS=$($PM2 jlist 2>/dev/null | node -e "
  const l=require('fs').readFileSync('/dev/stdin','utf8');
  try {
    const list = JSON.parse(l);
    const f = list.find(p => p.name === 'crm-frontend');
    console.log(f ? f.pm2_env.status : 'missing');
  } catch(e) { console.log('missing'); }
")

# ── Clear any stale processes on port 3001 ────────────────────────────────────
STALE=$(fuser 3001/tcp 2>/dev/null)
PM2_PID=$($PM2 jlist 2>/dev/null | node -e "const l=require('fs').readFileSync('/dev/stdin','utf8');try{const b=JSON.parse(l).find(p=>p.name==='crm-backend');console.log(b?b.pid:'');}catch(e){console.log('')}")
if [ -n "$STALE" ] && [ "$STALE" != "$PM2_PID" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Killing stale PID $STALE on port 3001..."
  kill -9 $STALE 2>/dev/null
  sleep 2
fi

# ── Start Backend ──────────────────────────────────────────────────────────────
if [ "$BACKEND_STATUS" = "online" ]; then
  echo "Backend already running (PM2)."
elif [ "$BACKEND_STATUS" = "missing" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting CRM backend via PM2..."
  cd $CRM/backend && PORT=3001 $PM2 start server.js \
    --name "crm-backend" \
    --restart-delay 2000 \
    --max-restarts 100 \
    --log /tmp/crm-backend-pm2.log \
    --merge-logs
  sleep 3
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Restarting CRM backend via PM2..."
  PORT=3001 $PM2 restart crm-backend
  sleep 3
fi

# ── Start Frontend ─────────────────────────────────────────────────────────────
if [ "$FRONTEND_STATUS" = "online" ]; then
  echo "Frontend already running (PM2)."
elif [ "$FRONTEND_STATUS" = "missing" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting CRM frontend via PM2..."
  cd $CRM/frontend && PORT=3000 $PM2 start node_modules/.bin/next \
    --name "crm-frontend" \
    --restart-delay 2000 \
    --max-restarts 100 \
    --log /tmp/crm-frontend-pm2.log \
    --merge-logs \
    -- start -p 3000
  sleep 5
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Restarting CRM frontend via PM2..."
  $PM2 restart crm-frontend
  sleep 5
fi

# ── Save and status ───────────────────────────────────────────────────────────
$PM2 save --force > /dev/null 2>&1

echo "CRM status:"
echo "  Frontend : $(curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3000)"
echo "  Backend  : $(curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3001/health)"
