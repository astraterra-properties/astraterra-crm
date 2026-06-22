/**
 * In-house email marketing API.
 *
 *  Admin (auth + admin role): templates, segments, campaigns, automations, stats.
 *  Public (no auth): open/click tracking + unsubscribe — hit by email clients.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken: auth, requireMinRole } = require('../middleware/auth');
const { query } = require('../config/database');
const mailer = require('../services/mailer');
const queue = require('../services/email-queue');
const segments = require('../services/email-segments');

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// ─── Public: tracking ─────────────────────────────────────────────────────────
router.get('/t/o/:token', async (req, res) => {
  try {
    const { rows } = await query(`SELECT id, to_email FROM email_sends WHERE open_token = ?`, [req.params.token]);
    if (rows.length) {
      await query(`INSERT INTO email_events (send_id, to_email, type) VALUES (?,?, 'open')`,
        [rows[0].id, rows[0].to_email]);
    }
  } catch (e) { /* never break pixel delivery */ }
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.end(PIXEL);
});

router.get('/t/c/:token', async (req, res) => {
  const url = req.query.u;
  try {
    const { rows } = await query(`SELECT id, to_email FROM email_sends WHERE open_token = ?`, [req.params.token]);
    if (rows.length) {
      await query(`INSERT INTO email_events (send_id, to_email, type, meta) VALUES (?,?, 'click', ?)`,
        [rows[0].id, rows[0].to_email, url || '']);
    }
  } catch (e) { /* fall through to redirect */ }
  if (url && /^https?:\/\//i.test(url)) return res.redirect(url);
  res.status(204).end();
});

router.get('/u/:token', async (req, res) => {
  try {
    const { rows } = await query(`SELECT id, to_email FROM email_sends WHERE unsub_token = ?`, [req.params.token]);
    if (rows.length) {
      const email = rows[0].to_email;
      await query(`INSERT OR IGNORE INTO email_suppression (email, reason) VALUES (?, 'unsubscribe')`,
        [email.toLowerCase()]);
      await query(`INSERT INTO email_events (send_id, to_email, type) VALUES (?,?, 'unsubscribe')`,
        [rows[0].id, email]);
      await query(`UPDATE newsletter_subscribers SET status='unsubscribed', unsubscribed_at=datetime('now') WHERE email=?`,
        [email]);
    }
  } catch (e) { /* show confirmation regardless */ }
  res.set('Content-Type', 'text/html');
  res.end(`<!doctype html><html><body style="font-family:sans-serif;text-align:center;padding:60px;">
    <h2>You're unsubscribed</h2>
    <p>You will no longer receive marketing emails from Astraterra Properties.</p></body></html>`);
});

// ─── Admin from here down ───────────────────────────────────────────────────────
router.use(auth, requireMinRole('admin'));

// Templates
router.get('/templates', async (req, res) => {
  const { rows } = await query(`SELECT * FROM email_templates ORDER BY id DESC`);
  res.json(rows);
});
router.post('/templates', async (req, res) => {
  const { name, subject, html } = req.body;
  const { rows } = await query(
    `INSERT INTO email_templates (name, subject, html) VALUES (?,?,?) RETURNING *`,
    [name, subject, html]);
  res.status(201).json(rows[0]);
});
router.put('/templates/:id', async (req, res) => {
  const { name, subject, html } = req.body;
  await query(`UPDATE email_templates SET name=?, subject=?, html=?, updated_at=datetime('now') WHERE id=?`,
    [name, subject, html, req.params.id]);
  res.json({ ok: true });
});
router.delete('/templates/:id', async (req, res) => {
  await query(`DELETE FROM email_templates WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});

// Segments
router.get('/segments', async (req, res) => {
  const { rows } = await query(`SELECT * FROM email_segments ORDER BY id DESC`);
  res.json(rows);
});
router.post('/segments', async (req, res) => {
  const { name, description, rules } = req.body;
  const { rows } = await query(
    `INSERT INTO email_segments (name, description, rules) VALUES (?,?,?) RETURNING *`,
    [name, description || '', JSON.stringify(rules || {})]);
  res.status(201).json(rows[0]);
});
router.put('/segments/:id', async (req, res) => {
  const { name, description, rules } = req.body;
  await query(`UPDATE email_segments SET name=?, description=?, rules=? WHERE id=?`,
    [name, description || '', JSON.stringify(rules || {}), req.params.id]);
  res.json({ ok: true });
});
router.delete('/segments/:id', async (req, res) => {
  await query(`DELETE FROM email_segments WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});
// Preview a segment's audience (count + sample) from saved rules or ad-hoc rules
router.post('/segments/preview', async (req, res) => {
  try {
    const recipients = await segments.getRecipients(req.body.rules || req.body);
    res.json({ count: recipients.length, sample: recipients.slice(0, 20) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/segments/:id/preview', async (req, res) => {
  const { rows } = await query(`SELECT * FROM email_segments WHERE id=?`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Segment not found' });
  const recipients = await segments.getRecipients(rows[0].rules);
  res.json({ count: recipients.length, sample: recipients.slice(0, 20) });
});

// Campaigns
router.get('/campaigns', async (req, res) => {
  const { rows } = await query(`SELECT * FROM email_campaigns ORDER BY id DESC`);
  res.json(rows);
});
router.post('/campaigns', async (req, res) => {
  const { name, subject, html, segment_id, scheduled_at } = req.body;
  const status = scheduled_at ? 'scheduled' : 'draft';
  const { rows } = await query(
    `INSERT INTO email_campaigns (name, subject, html, segment_id, scheduled_at, status, created_by)
     VALUES (?,?,?,?,?,?,?) RETURNING *`,
    [name, subject, html, segment_id || null, scheduled_at || null, status, req.user?.email || '']);
  res.status(201).json(rows[0]);
});
// Send now
router.post('/campaigns/:id/send', async (req, res) => {
  const { rows } = await query(`SELECT * FROM email_campaigns WHERE id=?`, [req.params.id]);
  const c = rows[0];
  if (!c) return res.status(404).json({ error: 'Campaign not found' });
  if (!c.segment_id) return res.status(400).json({ error: 'Campaign has no segment' });
  const seg = (await query(`SELECT * FROM email_segments WHERE id=?`, [c.segment_id])).rows[0];
  if (!seg) return res.status(400).json({ error: 'Segment not found' });

  const recipients = await segments.getRecipients(seg.rules);
  const n = await queue.enqueueMany(recipients, { subject: c.subject, html: c.html, campaign_id: c.id });
  await query(`UPDATE email_campaigns SET status='sending', total=?, sent_at=datetime('now') WHERE id=?`, [n, c.id]);
  res.json({ ok: true, queued: n, live: mailer.isLive() });
});
router.delete('/campaigns/:id', async (req, res) => {
  await query(`DELETE FROM email_campaigns WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});

// Automations
router.get('/automations', async (req, res) => {
  const { rows } = await query(`SELECT * FROM email_automations ORDER BY id DESC`);
  res.json(rows);
});
router.post('/automations', async (req, res) => {
  const { name, trigger_type, conditions, subject, html, delay_minutes, active } = req.body;
  const { rows } = await query(
    `INSERT INTO email_automations (name, trigger_type, conditions, subject, html, delay_minutes, active)
     VALUES (?,?,?,?,?,?,?) RETURNING *`,
    [name, trigger_type, JSON.stringify(conditions || {}), subject, html,
     delay_minutes || 0, active === false ? 0 : 1]);
  res.status(201).json(rows[0]);
});
router.put('/automations/:id', async (req, res) => {
  const { name, trigger_type, conditions, subject, html, delay_minutes, active } = req.body;
  await query(
    `UPDATE email_automations SET name=?, trigger_type=?, conditions=?, subject=?, html=?, delay_minutes=?, active=? WHERE id=?`,
    [name, trigger_type, JSON.stringify(conditions || {}), subject, html,
     delay_minutes || 0, active === false ? 0 : 1, req.params.id]);
  res.json({ ok: true });
});
router.delete('/automations/:id', async (req, res) => {
  await query(`DELETE FROM email_automations WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});

// Sender pool capacity
router.get('/senders', async (req, res) => {
  res.json({
    live: mailer.isLive(),
    senders: mailer.senders(),
    remainingToday: await mailer.remainingCapacityToday(),
  });
});

// Send a single test email (respects dry-run)
router.post('/test-send', async (req, res) => {
  const { to, subject, html } = req.body;
  if (!to) return res.status(400).json({ error: 'to required' });
  const result = await mailer.sendOne({
    to_email: to, to_name: req.body.name || '', subject: subject || 'Astraterra test',
    html: html || '<p>Hello {{first_name}}, this is a test from your in-house email system.</p>',
  });
  res.json(result);
});

// Aggregate stats
router.get('/stats', async (req, res) => {
  const one = async (sql, p = []) => (await query(sql, p)).rows[0]?.n || 0;
  const sent = await one(`SELECT COUNT(*) n FROM email_sends WHERE status IN ('sent','dryrun')`);
  const failed = await one(`SELECT COUNT(*) n FROM email_sends WHERE status='failed'`);
  const opens = await one(`SELECT COUNT(*) n FROM email_events WHERE type='open'`);
  const clicks = await one(`SELECT COUNT(*) n FROM email_events WHERE type='click'`);
  const unsubs = await one(`SELECT COUNT(*) n FROM email_events WHERE type='unsubscribe'`);
  const pending = await one(`SELECT COUNT(*) n FROM email_queue WHERE status='pending'`);
  res.json({
    sent, failed, opens, clicks, unsubscribes: unsubs, pending,
    openRate: sent ? +(opens / sent * 100).toFixed(1) : 0,
    clickRate: sent ? +(clicks / sent * 100).toFixed(1) : 0,
    live: mailer.isLive(),
  });
});

module.exports = router;
