/**
 * PM2 Ecosystem Configuration — Astraterra CRM
 * Run: pm2 start ecosystem.config.js
 */

const path = require('path');
const ROOT = path.join(__dirname);

module.exports = {
  apps: [
    {
      name: 'astraterra-backend',
      cwd: path.join(ROOT, 'backend'),
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
    },
    {
      name: 'astraterra-frontend',
      cwd: path.join(ROOT, 'frontend'),
      script: path.join(ROOT, 'frontend', 'node_modules', '.bin', 'next'),
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
