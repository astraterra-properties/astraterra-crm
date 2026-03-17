/**
 * PM2 Ecosystem Configuration — Astraterra CRM
 * 
 * All CRM services with auto-restart, memory limits, and log management.
 * Run: pm2 start ecosystem.config.js
 * 
 * Services:
 *   - astraterra-backend  (Express API, port 3001)
 *   - astraterra-frontend (Next.js SSR, port 3000)
 *   - crm-health-monitor  (Health checker, auto-restart)
 */

const path = require('path');
const ROOT = path.join(__dirname);

module.exports = {
  apps: [
    {
      name: 'astraterra-backend',
      cwd: path.join(ROOT, 'backend'),
      script: 'server.js',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      kill_timeout: 30000,
      listen_timeout: 10000,
      error_file: '/data/.pm2/logs/astraterra-backend-error.log',
      out_file: '/data/.pm2/logs/astraterra-backend-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: 'astraterra-frontend',
      cwd: path.join(ROOT, 'frontend'),
      script: path.join(ROOT, 'frontend', 'node_modules', '.bin', 'next'),
      args: 'start -p 3000',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      kill_timeout: 30000,
      listen_timeout: 15000,
      error_file: '/data/.pm2/logs/astraterra-frontend-error.log',
      out_file: '/data/.pm2/logs/astraterra-frontend-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: 'crm-health-monitor',
      cwd: path.join(ROOT, 'backend'),
      script: 'health-monitor.js',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '100M',
      kill_timeout: 5000,
      error_file: '/data/.pm2/logs/crm-health-monitor-error.log',
      out_file: '/data/.pm2/logs/crm-health-monitor-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_restarts: 50,
      restart_delay: 10000,
    },
  ],
};
