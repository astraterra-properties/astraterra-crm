#!/bin/bash
# Safe CRM Frontend Rebuild Script
# ALWAYS use this instead of manually running npm run build + pm2 restart
# This prevents PM2 from crashing during the build (when .next is deleted)

set -e

FRONTEND_DIR="/data/.openclaw/workspace/astraterra-crm/frontend"
PM2="/skeleton/.npm-global/bin/pm2"

echo "🛑 Stopping crm-frontend (prevents crash during build)..."
$PM2 stop crm-frontend 2>/dev/null || true

echo "🏗️ Building..."
cd "$FRONTEND_DIR"
npm run build

echo "✅ Starting crm-frontend..."
$PM2 start crm-frontend --update-env

sleep 4
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://crm.astraterra.ae 2>/dev/null || curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
echo "CRM Status: $STATUS"

if [ "$STATUS" = "200" ]; then
  echo "✅ CRM is live!"
else
  echo "❌ CRM may not be ready yet, check: pm2 logs crm-frontend"
fi
