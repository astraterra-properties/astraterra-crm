# WhatsApp Connection Watchdog

Monitors OpenClaw WhatsApp connection every 10 minutes.
If disconnected, sends SIGUSR1 to openclaw-gateway to restart it.
Sends WhatsApp alert to Joseph when self-healed.

## How it works

1. Every 10 minutes, checks OpenClaw logs for recent heartbeat
2. If no heartbeat detected + gateway process check fails → disconnected
3. Sends SIGUSR1 to `openclaw-gateway` PID (triggers internal restart)
4. Waits 30s, verifies reconnection
5. Sends WhatsApp alert: "✅ WhatsApp Self-Healed"

## PM2 Management

```bash
# Start
PM2=/skeleton/.npm-global/bin/pm2
$PM2 start ecosystem.config.js

# Status
$PM2 status wa-watchdog

# Logs
$PM2 logs wa-watchdog

# Restart
$PM2 restart wa-watchdog

# Stop
$PM2 stop wa-watchdog
```

## State

State saved to `.watchdog-state.json` — tracks restart count and last restart time.

## Why SIGUSR1 not docker restart?

The container runs OpenClaw internally. `server.cjs` (PID 20) spawns `openclaw-gateway` (PID 27).
Sending SIGUSR1 to the gateway process triggers an internal restart — same effect as docker restart
but works from inside the container without Docker socket access.
