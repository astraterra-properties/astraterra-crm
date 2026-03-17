#!/bin/bash
# ============================================================
# Safe CRM Startup — One Command to Rule Them All
# Usage: cd astraterra-crm && bash .start-safe.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CRM_ROOT="/data/.openclaw/workspace/astraterra-crm"
PM2="node /data/.npm/_npx/9bf7a925f1f86236/node_modules/pm2/bin/pm2"
DB_PATH="/data/.openclaw/workspace/data/astraterra-crm.db"
PORTS=(3000 3001 4506 4507)

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Astraterra CRM — Safe Startup v1.0     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Kill stale processes ──
echo -e "${BLUE}[1/6]${NC} Killing stale processes..."
for PORT in "${PORTS[@]}"; do
  PID=$(lsof -i ":$PORT" -t 2>/dev/null || true)
  if [ -n "$PID" ]; then
    kill -9 $PID 2>/dev/null || true
    echo -e "  ${YELLOW}Killed PID $PID on port $PORT${NC}"
  fi
done
$PM2 delete all 2>/dev/null || true
sleep 2
echo -e "  ${GREEN}✓ Clean slate${NC}"
echo ""

# ── Step 2: Verify prerequisites ──
echo -e "${BLUE}[2/6]${NC} Checking prerequisites..."

# Check frontend build
if [ -f "$CRM_ROOT/frontend/.next/required-server-files.json" ]; then
  echo -e "  ${GREEN}✓${NC} Frontend build exists"
else
  echo -e "  ${YELLOW}⚠️  No frontend build — building now...${NC}"
  cd "$CRM_ROOT/frontend" && npm run build 2>&1 | tail -3 | sed 's/^/  /'
fi

# Check backend node_modules
if [ -d "$CRM_ROOT/backend/node_modules" ]; then
  echo -e "  ${GREEN}✓${NC} Backend dependencies installed"
else
  echo -e "  ${YELLOW}⚠️  Installing backend deps...${NC}"
  cd "$CRM_ROOT/backend" && npm install 2>&1 | tail -3 | sed 's/^/  /'
fi
echo ""

# ── Step 3: Initialize database ──
echo -e "${BLUE}[3/6]${NC} Initializing database..."
cd "$CRM_ROOT/backend"
node scripts/db-init.js 2>&1 | grep -E "Result|Tables in" | sed 's/^/  /'
echo ""

# ── Step 4: Start all services ──
echo -e "${BLUE}[4/6]${NC} Starting PM2 services..."
PORT=3001 $PM2 start "$CRM_ROOT/ecosystem.config.js" --env production 2>&1 | grep -E "online|errored" | sed 's/^/  /' || true

# Start bot ecosystems
for ECO in "/data/.openclaw/workspace/futures-pro/ecosystem.config.js" \
           "/data/.openclaw/workspace/binance-gold-scalper/ecosystem.config.js"; do
  if [ -f "$ECO" ]; then
    $PM2 start "$ECO" 2>&1 | grep -E "online|errored" | sed 's/^/  /' || true
  fi
done
echo ""

# ── Step 5: Wait for startup ──
echo -e "${BLUE}[5/6]${NC} Waiting 10s for services to initialize..."
sleep 10
echo ""

# ── Step 6: Health verification ──
echo -e "${BLUE}[6/6]${NC} Health check results:"
PASS=0
FAIL=0

check() {
  local NAME=$1 PORT=$2 PATH=$3
  local STATUS
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://localhost:${PORT}${PATH}" 2>/dev/null || echo "000")
  if [ "$STATUS" -ge 200 ] && [ "$STATUS" -lt 500 ]; then
    echo -e "  ${GREEN}✓${NC} $NAME — HTTP $STATUS"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $NAME — HTTP $STATUS"
    FAIL=$((FAIL + 1))
  fi
}

check "Frontend  :3000" 3000 "/"
check "Backend   :3001" 3001 "/api/health"
check "Futures   :4506" 4506 "/trend/health"
check "Gold      :4507" 4507 "/gold-binance/health"

echo ""
echo -e "${BLUE}══════════════════════════════════════════${NC}"
if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}🎉 ALL SYSTEMS GO — $PASS/$((PASS+FAIL)) services healthy${NC}"
else
  echo -e "  ${YELLOW}⚠️  $PASS passed, $FAIL failed — check: $PM2 logs --lines 20${NC}"
fi
echo -e "  CRM URL: https://crm.astraterra.ae"
echo -e "  Time: $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo -e "${BLUE}══════════════════════════════════════════${NC}"
echo ""
