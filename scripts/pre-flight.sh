#!/bin/bash
# ============================================================
# Pre-Flight Startup Script — Astraterra CRM
# Ensures clean environment before starting all services
# Usage: bash scripts/pre-flight.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CRM_ROOT="/data/.openclaw/workspace/astraterra-crm"
PM2="node /data/.npm/_npx/9bf7a925f1f86236/node_modules/pm2/bin/pm2"
PORTS=(3000 3001 4506 4507)

echo "============================================"
echo "  Astraterra CRM — Pre-Flight Check"
echo "  $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
echo ""

# Step 1: Kill stale processes on required ports
echo "🔍 Step 1: Checking for port conflicts..."
CONFLICTS=0
for PORT in "${PORTS[@]}"; do
  PID=$(lsof -i ":$PORT" -t 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo -e "  ${YELLOW}⚠️  Port $PORT in use by PID $PID — killing...${NC}"
    kill -9 $PID 2>/dev/null || true
    sleep 1
    CONFLICTS=$((CONFLICTS + 1))
  else
    echo -e "  ${GREEN}✓${NC} Port $PORT is free"
  fi
done
if [ $CONFLICTS -gt 0 ]; then
  echo -e "  ${YELLOW}Killed $CONFLICTS stale processes${NC}"
  sleep 2
fi
echo ""

# Step 2: Verify database exists and is accessible
echo "🗄️  Step 2: Checking database..."
DB_PATH="/data/.openclaw/workspace/data/astraterra-crm.db"
if [ -f "$DB_PATH" ]; then
  TABLE_COUNT=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
  echo -e "  ${GREEN}✓${NC} Database exists — $TABLE_COUNT tables"
else
  echo -e "  ${YELLOW}⚠️  Database not found — will be created${NC}"
fi
echo ""

# Step 3: Initialize/verify database tables
echo "📊 Step 3: Initializing database tables..."
cd "$CRM_ROOT/backend"
node scripts/db-init.js 2>&1 | sed 's/^/  /'
echo ""

# Step 4: Start PM2 services
echo "🚀 Step 4: Starting PM2 services..."
$PM2 delete all 2>/dev/null || true
sleep 2

# Start CRM ecosystem
PORT=3001 $PM2 start "$CRM_ROOT/ecosystem.config.js" --env production 2>&1 | head -5 | sed 's/^/  /'

# Start bot ecosystems if they exist
if [ -f "/data/.openclaw/workspace/futures-pro/ecosystem.config.js" ]; then
  $PM2 start "/data/.openclaw/workspace/futures-pro/ecosystem.config.js" 2>&1 | head -3 | sed 's/^/  /'
fi
if [ -f "/data/.openclaw/workspace/binance-gold-scalper/ecosystem.config.js" ]; then
  $PM2 start "/data/.openclaw/workspace/binance-gold-scalper/ecosystem.config.js" 2>&1 | head -3 | sed 's/^/  /'
fi
echo ""

# Step 5: Wait and verify
echo "⏳ Step 5: Waiting 10s for services to start..."
sleep 10
echo ""

echo "🏥 Step 6: Health verification..."
ALL_OK=true

check_endpoint() {
  local NAME=$1
  local PORT=$2
  local PATH=$3
  local STATUS
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://localhost:${PORT}${PATH}" 2>/dev/null || echo "000")
  if [ "$STATUS" -ge 200 ] && [ "$STATUS" -lt 500 ]; then
    echo -e "  ${GREEN}✓${NC} $NAME (port $PORT) — HTTP $STATUS"
  else
    echo -e "  ${RED}✗${NC} $NAME (port $PORT) — HTTP $STATUS"
    ALL_OK=false
  fi
}

check_endpoint "CRM Frontend" 3000 "/"
check_endpoint "CRM Backend" 3001 "/api/health"
check_endpoint "Futures Dashboard" 4506 "/trend/health"
check_endpoint "Gold Dashboard" 4507 "/gold-binance/health"

echo ""
echo "============================================"
if [ "$ALL_OK" = true ]; then
  echo -e "  ${GREEN}✅ ALL SYSTEMS GO${NC}"
else
  echo -e "  ${YELLOW}⚠️  Some services may need attention${NC}"
  echo "  Check logs: $PM2 logs --lines 20 --nostream"
fi
echo "  $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
