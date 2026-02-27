#!/bin/bash
# Astraterra CRM - Production Start Script
# Usage: ./start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Astraterra CRM..."
echo ""

# Create logs directory
mkdir -p logs

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
  echo "📦 Starting with PM2 (production mode)..."
  pm2 start ecosystem.config.js
  pm2 save
  echo ""
  echo "✅ CRM is running!"
  echo ""
  echo "📊 Dashboard: http://localhost:3000"
  echo "🔧 API: http://localhost:3001"
  echo ""
  echo "To check status: pm2 status"
  echo "To view logs: pm2 logs"
  echo "To stop: pm2 stop all"
else
  echo "📦 Starting without PM2 (dev mode)..."
  echo ""
  
  # Start backend
  echo "Starting backend on port 3001..."
  cd backend
  PORT=3001 node server.js > ../logs/backend.log 2>&1 &
  BACKEND_PID=$!
  echo "Backend PID: $BACKEND_PID"
  cd ..
  
  # Wait for backend to start
  sleep 3
  
  # Check backend health
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
  else
    echo "⚠️  Backend may have failed — check logs/backend.log"
  fi
  
  # Start frontend (production build)
  echo ""
  echo "Starting frontend on port 3000..."
  cd frontend
  
  # Build if .next doesn't exist
  if [ ! -d ".next" ]; then
    echo "Building frontend (first time)..."
    npm run build
  fi
  
  PORT=3000 NEXT_PUBLIC_API_URL=http://localhost:3001 node_modules/.bin/next start > ../logs/frontend.log 2>&1 &
  FRONTEND_PID=$!
  echo "Frontend PID: $FRONTEND_PID"
  cd ..
  
  # Wait for frontend
  sleep 5
  
  echo ""
  echo "✅ Astraterra CRM is running!"
  echo ""
  echo "📊 Open: http://localhost:3000"
  echo "🔑 Login: joseph@astraterra.ae / joseph123"
  echo ""
  echo "PIDs: Backend=$BACKEND_PID, Frontend=$FRONTEND_PID"
  echo "Logs: logs/backend.log, logs/frontend.log"
  echo ""
  echo "To stop: kill $BACKEND_PID $FRONTEND_PID"
fi
