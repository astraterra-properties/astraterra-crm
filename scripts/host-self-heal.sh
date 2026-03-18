#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Isabelle Host Self-Heal Script
# Run this ON THE HOST (not inside the container) via cron:
#
#   crontab -e
#   */5 * * * * /path/to/host-self-heal.sh >> /var/log/isabelle-self-heal.log 2>&1
#
# What it does:
#   1. Every 5 min: checks if OpenClaw/WhatsApp is responding, docker restarts if not
#   2. Pre-emptive restart at 4am, 10am, 4pm, 10pm Dubai time (UTC: 0, 6, 12, 18)
#   3. 8am Dubai (4am UTC): sends "Isabelle online" WhatsApp via API
# ─────────────────────────────────────────────────────────────────────────────

CONTAINER="openclaw-rjgw-openclaw-1"
OPENCLAW_PORT=59053
OPENCLAW_TOKEN="K1hmmthQKBe4qhKAiapyOxP8LOSKTHL0"
JOSEPH_WA="+971585580053"
LOG="/var/log/isabelle-self-heal.log"
STATE_FILE="/tmp/isabelle-heal-state.json"

# Dubai is UTC+4
DUBAI_HOUR=$(TZ="Asia/Dubai" date +%H | sed 's/^0//')
DUBAI_MIN=$(TZ="Asia/Dubai" date +%M | sed 's/^0*//' | sed 's/^$/0/')
TODAY=$(date +%Y-%m-%d)

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"
}

# ─── Load state ───────────────────────────────────────────────────────────────
LAST_RESTART_DATE=""
RESTART_COUNT=0
MORNING_MSG_DATE=""
LAST_PREEMPTIVE_HOUR=""

if [ -f "$STATE_FILE" ]; then
  LAST_RESTART_DATE=$(python3 -c "import json,sys; d=json.load(open('$STATE_FILE')); print(d.get('lastRestartDate',''))" 2>/dev/null || echo "")
  RESTART_COUNT=$(python3 -c "import json,sys; d=json.load(open('$STATE_FILE')); print(d.get('restartCount',0))" 2>/dev/null || echo "0")
  MORNING_MSG_DATE=$(python3 -c "import json,sys; d=json.load(open('$STATE_FILE')); print(d.get('morningMsgDate',''))" 2>/dev/null || echo "")
  LAST_PREEMPTIVE_HOUR=$(python3 -c "import json,sys; d=json.load(open('$STATE_FILE')); print(d.get('lastPreemptiveHour',''))" 2>/dev/null || echo "")
fi

save_state() {
  python3 -c "
import json
d = {
  'lastRestartDate': '$LAST_RESTART_DATE',
  'restartCount': $RESTART_COUNT,
  'morningMsgDate': '$MORNING_MSG_DATE',
  'lastPreemptiveHour': '$LAST_PREEMPTIVE_HOUR'
}
json.dump(d, open('$STATE_FILE','w'), indent=2)
" 2>/dev/null
}

# ─── Send WhatsApp via OpenClaw API ──────────────────────────────────────────
send_whatsapp() {
  local MESSAGE="$1"
  curl -s -X POST "http://127.0.0.1:${OPENCLAW_PORT}/api/send" \
    -H "Authorization: Bearer ${OPENCLAW_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"channel\":\"whatsapp\",\"to\":\"${JOSEPH_WA}\",\"message\":$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$MESSAGE")}" \
    --max-time 10 2>/dev/null
}

# ─── Check if OpenClaw is responding ─────────────────────────────────────────
check_openclaw() {
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 8 \
    "http://127.0.0.1:${OPENCLAW_PORT}/status" \
    -H "Authorization: Bearer ${OPENCLAW_TOKEN}" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
    return 0  # Container is up and responding
  fi
  return 1  # Not responding
}

# ─── Restart container ────────────────────────────────────────────────────────
do_restart() {
  local REASON="$1"
  log "🔴 $REASON — restarting container: $CONTAINER"
  docker restart "$CONTAINER" >> "$LOG" 2>&1
  sleep 45
  RESTART_COUNT=$((RESTART_COUNT + 1))
  LAST_RESTART_DATE="$TODAY"
  save_state
  log "✅ Container restarted (total: $RESTART_COUNT)"
}

# ═════════════════════════════════════════════════════════════════════════════
# 1. PRE-EMPTIVE RESTART (4am, 10am, 4pm, 10pm Dubai = 0, 6, 12, 18 UTC)
# ═════════════════════════════════════════════════════════════════════════════
PREEMPTIVE_HOURS="4 10 16 22"
for H in $PREEMPTIVE_HOURS; do
  if [ "$DUBAI_HOUR" = "$H" ] && [ "$DUBAI_MIN" -lt 6 ] && [ "$LAST_PREEMPTIVE_HOUR" != "${TODAY}_${H}" ]; then
    log "🔄 Pre-emptive restart at ${H}:00 Dubai time"
    docker restart "$CONTAINER" >> "$LOG" 2>&1
    LAST_PREEMPTIVE_HOUR="${TODAY}_${H}"
    save_state
    log "✅ Pre-emptive restart done"
    sleep 50  # Let container come back before WA check
    break
  fi
done

# ═════════════════════════════════════════════════════════════════════════════
# 2. MORNING MESSAGE (8am Dubai)
# ═════════════════════════════════════════════════════════════════════════════
if [ "$DUBAI_HOUR" = "8" ] && [ "$DUBAI_MIN" -lt 6 ] && [ "$MORNING_MSG_DATE" != "$TODAY" ]; then
  log "📱 Sending 8am morning WhatsApp to Joseph..."
  DISK=$(df -h / | tail -1 | awk '{print $5}')
  MSG="🟢 Isabelle online — all systems good

📅 $(TZ='Asia/Dubai' date '+%A, %B %d %Y') | 8:00 AM Dubai
💾 Disk: ${DISK}
🔄 Total auto-restarts: ${RESTART_COUNT}

Have a productive day! 🏢"
  send_whatsapp "$MSG"
  MORNING_MSG_DATE="$TODAY"
  save_state
  log "✅ Morning message sent"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 3. WHATSAPP / OPENCLAW HEALTH CHECK (every 5 min via cron)
# ═════════════════════════════════════════════════════════════════════════════
if check_openclaw; then
  log "✅ OpenClaw responding (container healthy)"
else
  # Check if container is even running
  RUNNING=$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)
  if [ "$RUNNING" != "true" ]; then
    do_restart "Container not running"
  else
    # Container running but not responding — restart
    do_restart "OpenClaw not responding (container up but no API response)"
    # Send WhatsApp alert after restart
    HEAL_TIME=$(TZ="Asia/Dubai" date '+%H:%M Dubai')
    send_whatsapp "⚠️ WhatsApp auto-reconnected at ${HEAL_TIME}

Container was unresponsive — automatically restarted.
Total auto-restarts: ${RESTART_COUNT} 🔄"
  fi
fi
