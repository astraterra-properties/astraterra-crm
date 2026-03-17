module.exports = {
  apps: [{
    name: 'wa-watchdog',
    script: './whatsapp-watchdog.js',
    cwd: '/data/.openclaw/workspace/astraterra-crm/watchdog',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '100M',
    restart_delay: 5000,
    max_restarts: 50,
    env: {
      NODE_ENV: 'production',
    },
    log_file: '/data/.openclaw/workspace/astraterra-crm/watchdog/watchdog.log',
    out_file: '/data/.openclaw/workspace/astraterra-crm/watchdog/watchdog-out.log',
    error_file: '/data/.openclaw/workspace/astraterra-crm/watchdog/watchdog-err.log',
    time: true,
  }]
};
