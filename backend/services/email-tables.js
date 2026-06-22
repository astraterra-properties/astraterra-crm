/**
 * In-house email marketing — table definitions.
 *
 * Idempotent: safe to run on every boot (CREATE TABLE IF NOT EXISTS).
 * Uses the shared query() wrapper so it works on both SQLite (dev) and PG.
 */

const { query } = require('../config/database');

const STATEMENTS = [
  // Reusable HTML templates with merge tags ({{name}}, {{email}} ...)
  `CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT,
    html TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Saved audiences — rules is JSON: { base, status[], sources[], scoreMin, scoreMax, limit }
  `CREATE TABLE IF NOT EXISTS email_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    rules TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // One-off / scheduled broadcasts
  `CREATE TABLE IF NOT EXISTS email_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT,
    html TEXT,
    segment_id INTEGER,
    status TEXT DEFAULT 'draft',
    scheduled_at TEXT,
    total INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    sent_at TEXT
  )`,

  // Lead-driven automation rules
  `CREATE TABLE IF NOT EXISTS email_automations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    conditions TEXT,
    subject TEXT,
    html TEXT,
    delay_minutes INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Throttled outbound queue — drained by the worker, respects daily caps
  `CREATE TABLE IF NOT EXISTS email_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    to_name TEXT,
    subject TEXT,
    html TEXT,
    campaign_id INTEGER,
    automation_id INTEGER,
    lead_id INTEGER,
    send_after TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Per-recipient send log
  `CREATE TABLE IF NOT EXISTS email_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    to_name TEXT,
    subject TEXT,
    sender TEXT,
    campaign_id INTEGER,
    automation_id INTEGER,
    queue_id INTEGER,
    status TEXT DEFAULT 'sent',
    message_id TEXT,
    open_token TEXT,
    unsub_token TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Opens / clicks / unsubscribes / bounces
  `CREATE TABLE IF NOT EXISTS email_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    send_id INTEGER,
    to_email TEXT,
    type TEXT NOT NULL,
    meta TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Dedupe: which leads already received which automation
  `CREATE TABLE IF NOT EXISTS email_automation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    automation_id INTEGER NOT NULL,
    lead_id INTEGER,
    to_email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Daily usage per sender (for cap enforcement + overflow roll-over)
  `CREATE TABLE IF NOT EXISTS email_sender_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    day TEXT NOT NULL,
    sent_count INTEGER DEFAULT 0,
    UNIQUE(sender, day)
  )`,

  // Global suppression list — never email these again
  `CREATE TABLE IF NOT EXISTS email_suppression (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];

// Add unsubscribe token to the existing newsletter_subscribers table (best-effort)
const MIGRATIONS = [
  `ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribe_token TEXT`,
];

let ensured = false;
async function ensureEmailTables() {
  if (ensured) return;
  for (const sql of STATEMENTS) {
    try { await query(sql); } catch (e) { console.warn('[email-tables]', e.message); }
  }
  for (const sql of MIGRATIONS) {
    try { await query(sql); } catch (e) { /* duplicate column — already applied */ }
  }
  ensured = true;
  console.log('✅ Email marketing tables ready');
}

module.exports = { ensureEmailTables };
