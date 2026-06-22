/**
 * Smart automation engine.
 *
 * Two paths:
 *  1. Instant — onLeadEvent() is fired on every lead create/update/inbound
 *     (wired through services/paperclip-sync.js, which the lead routes already
 *     call). Matches active automations and enqueues the right email.
 *  2. Scheduled — scan() runs on an interval for time-based rules: inactivity
 *     re-engagement and scheduled campaigns coming due.
 *
 * Automation.trigger_type:
 *   lead_created | status_changed | score_threshold | source_match | inactivity
 * Automation.conditions (JSON): { status[], sources[], scoreMin, scoreMax, inactiveDays }
 */

const { query } = require('../config/database');
const queue = require('./email-queue');
const segments = require('./email-segments');

function parseJSON(s, fallback) {
  if (!s) return fallback;
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return fallback; }
}

function leadMatches(lead, cond) {
  if (!cond) return true;
  if (Array.isArray(cond.status) && cond.status.length && !cond.status.includes(lead.status)) return false;
  if (Array.isArray(cond.sources) && cond.sources.length && !cond.sources.includes(lead.source)) return false;
  if (typeof cond.scoreMin === 'number' && (lead.score || 0) < cond.scoreMin) return false;
  if (typeof cond.scoreMax === 'number' && (lead.score || 0) > cond.scoreMax) return false;
  return true;
}

async function alreadyRan(automationId, leadId) {
  if (!leadId) return false;
  const { rows } = await query(
    `SELECT 1 FROM email_automation_runs WHERE automation_id = ? AND lead_id = ?`,
    [automationId, leadId]
  );
  return rows.length > 0;
}

async function fireAutomation(auto, lead) {
  if (!lead || !lead.email) return false;
  if (await alreadyRan(auto.id, lead.id)) return false;

  const sendAfter = auto.delay_minutes
    ? new Date(Date.now() + auto.delay_minutes * 60000).toISOString().replace('T', ' ').slice(0, 19)
    : null;

  await queue.enqueue({
    to_email: lead.email,
    to_name: lead.name,
    subject: auto.subject,
    html: auto.html,
    automation_id: auto.id,
    lead_id: lead.id,
    send_after: sendAfter,
  });
  await query(
    `INSERT INTO email_automation_runs (automation_id, lead_id, to_email) VALUES (?,?,?)`,
    [auto.id, lead.id, lead.email]
  );
  return true;
}

// ─── Instant path ─────────────────────────────────────────────────────────────
// trigger values come from triggerLeadSync(): lead_created | lead_updated | inbound_lead
async function onLeadEvent({ leadId, trigger, changedFields = [] } = {}) {
  if (!leadId) return;
  const { rows } = await query(`SELECT * FROM leads WHERE id = ?`, [leadId]);
  const lead = rows[0];
  if (!lead || !lead.email) return;

  // Map the CRM event to the automation trigger types it should activate
  const triggerTypes = [];
  if (trigger === 'lead_created' || trigger === 'inbound_lead') {
    triggerTypes.push('lead_created', 'source_match');
  }
  if (trigger === 'lead_updated') {
    if (!changedFields.length || changedFields.includes('status')) triggerTypes.push('status_changed');
    if (!changedFields.length || changedFields.includes('score')) triggerTypes.push('score_threshold');
  }
  if (!triggerTypes.length) return;

  const { rows: autos } = await query(
    `SELECT * FROM email_automations WHERE active = 1 AND trigger_type IN (${triggerTypes.map(() => '?').join(',')})`,
    triggerTypes
  );
  for (const auto of autos) {
    const cond = parseJSON(auto.conditions, {});
    if (leadMatches(lead, cond)) {
      try { await fireAutomation(auto, lead); }
      catch (e) { console.error('[email-automation] fire error:', e.message); }
    }
  }
}

// ─── Scheduled path ───────────────────────────────────────────────────────────
async function runInactivityAutomations() {
  const { rows: autos } = await query(
    `SELECT * FROM email_automations WHERE active = 1 AND trigger_type = 'inactivity'`
  );
  for (const auto of autos) {
    const cond = parseJSON(auto.conditions, {});
    const recipients = await segments.getRecipients({
      base: 'leads',
      status: cond.status,
      sources: cond.sources,
      scoreMin: cond.scoreMin,
      scoreMax: cond.scoreMax,
      inactiveDays: cond.inactiveDays || 30,
      limit: cond.limit,
    });
    for (const r of recipients) {
      if (r.lead_id && (await alreadyRan(auto.id, r.lead_id))) continue;
      await queue.enqueue({
        to_email: r.email, to_name: r.name, subject: auto.subject, html: auto.html,
        automation_id: auto.id, lead_id: r.lead_id,
      });
      if (r.lead_id) {
        await query(`INSERT INTO email_automation_runs (automation_id, lead_id, to_email) VALUES (?,?,?)`,
          [auto.id, r.lead_id, r.email]);
      }
    }
  }
}

async function runScheduledCampaigns() {
  const { rows: due } = await query(
    `SELECT * FROM email_campaigns WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= datetime('now')`
  );
  for (const c of due) {
    try {
      const seg = c.segment_id ? (await query(`SELECT * FROM email_segments WHERE id = ?`, [c.segment_id])).rows[0] : null;
      const recipients = seg ? await segments.getRecipients(seg.rules) : [];
      const n = await queue.enqueueMany(recipients, { subject: c.subject, html: c.html, campaign_id: c.id });
      await query(`UPDATE email_campaigns SET status='sending', total=?, sent_at=datetime('now') WHERE id=?`, [n, c.id]);
      console.log(`[email-automation] scheduled campaign #${c.id} queued ${n} recipients`);
    } catch (e) {
      console.error(`[email-automation] scheduled campaign #${c.id} error:`, e.message);
    }
  }
}

let scanning = false;
async function scan() {
  if (scanning) return;
  scanning = true;
  try {
    await runScheduledCampaigns();
    await runInactivityAutomations();
  } catch (e) {
    console.error('[email-automation] scan error:', e.message);
  } finally {
    scanning = false;
  }
}

function startScheduler() {
  const everyMs = parseInt(process.env.EMAIL_SCAN_MS || '300000', 10); // 5 min
  console.log(`🤖 Email automation scheduler started (every ${everyMs / 1000}s)`);
  setInterval(scan, everyMs);
  setTimeout(scan, 15000);
}

module.exports = { onLeadEvent, scan, startScheduler };
