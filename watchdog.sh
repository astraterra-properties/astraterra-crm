#!/bin/bash
# CRM Watchdog — monitors backend every 15s, restarts if down
# Run as: nohup bash watchdog.sh > /tmp/crm-watchdog.log 2>&1 &

CRM=/data/.openclaw/workspace/astraterra-crm
BACKEND_LOG=/tmp/crm-backend.log
WATCHDOG_LOG=/tmp/crm-watchdog.log
CRASH_COUNT=0

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Watchdog started (PID $$)" | tee -a "$WATCHDOG_LOG"

while true; do
  sleep 15

  # Check backend health
  if ! curl -s -o /dev/null --max-time 5 http://localhost:3001/health > /dev/null 2>&1; then
    CRASH_COUNT=$((CRASH_COUNT + 1))
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    echo "[$TIMESTAMP] ⚠️  Backend DOWN (crash #$CRASH_COUNT) — restarting..." | tee -a "$WATCHDOG_LOG"
    echo "[$TIMESTAMP] CRASH DETECTED by watchdog" >> "$BACKEND_LOG"

    # Kill any zombie backend processes
    pkill -f "PORT=3001 node server.js" 2>/dev/null
    pkill -f "node server.js" 2>/dev/null
    sleep 2

    # Restart backend
    cd $CRM/backend && PORT=3001 nohup node server.js >> "$BACKEND_LOG" 2>&1 &
    echo "[$TIMESTAMP] Backend restarted (PID $!)" | tee -a "$WATCHDOG_LOG"
    sleep 5

    # Verify recovery
    if curl -s -o /dev/null --max-time 5 http://localhost:3001/health > /dev/null 2>&1; then
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ✅ Backend recovered (crash #$CRASH_COUNT)" | tee -a "$WATCHDOG_LOG"
    else
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ❌ Backend failed to recover — will retry next cycle" | tee -a "$WATCHDOG_LOG"
    fi
  fi
done
