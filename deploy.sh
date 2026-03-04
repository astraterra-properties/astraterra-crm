#!/bin/bash
# Safe CRM Deploy Script — always build first, restart only after success
set -e

FRONTEND=/data/.openclaw/workspace/astraterra-crm/frontend
PM2=/skeleton/.npm-global/bin/pm2

echo "🔨 Building frontend..."
cd "$FRONTEND"
npm run build

# Verify build output exists
if [ ! -f "$FRONTEND/.next/required-server-files.json" ]; then
  echo "❌ Build verification failed — .next/required-server-files.json missing"
  exit 1
fi

echo "✅ Build verified — restarting PM2..."
$PM2 restart crm-frontend
sleep 5

# Health check
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://crm.astraterra.ae)
if [ "$STATUS" = "200" ]; then
  echo "✅ CRM live — HTTP $STATUS"
else
  echo "⚠️  CRM returned HTTP $STATUS — check logs"
  $PM2 logs crm-frontend --lines 20 --nostream
fi
