/**
 * Outbound queue + worker.
 *
 * enqueue() drops a recipient into email_queue. The worker drains it in small
 * paced batches, each send routed through the cap-aware mailer. When the pool's
 * daily capacity is exhausted, remaining rows simply stay 'pending' and go out
 * the next day — overflow self-heals, nothing is lost.
 */

const { query } = require('../config/database');
const mailer = require('./mailer');

const BATCH_SIZE = parseInt(process.env.EMAIL_BATCH_SIZE || '50', 10);
const TICK_MS = parseInt(process.env.EMAIL_TICK_MS || '60000', 10);
const MAX_ATTEMPTS = parseInt(process.env.EMAIL_MAX_ATTEMPTS || '3', 10);

let running = false;

async function enqueue({ to_email, to_name, subject, html, campaign_id, automation_id, lead_id, send_after }) {
  if (!to_email) return false;
  await query(
    `INSERT INTO email_queue (to_email,to_name,subject,html,campaign_id,automation_id,lead_id,send_after,status)
     VALUES (?,?,?,?,?,?,?,COALESCE(?, datetime('now')),'pending')`,
    [to_email, to_name || '', subject || '', html || '', campaign_id || null,
     automation_id || null, lead_id || null, send_after || null]
  );
  return true;
}

/** Enqueue many recipients for a campaign in one pass. Returns count queued. */
async function enqueueMany(recipients, base) {
  let n = 0;
  for (const r of recipients) {
    const ok = await enqueue({ ...base, to_email: r.email, to_name: r.name, lead_id: r.lead_id });
    if (ok) n++;
  }
  return n;
}

async function processTick() {
  if (running) return;
  running = true;
  try {
    // Stop early if the whole pool is tapped out for today
    const capacity = await mailer.remainingCapacityToday();
    if (capacity <= 0) return;

    const limit = Math.min(BATCH_SIZE, capacity);
    const { rows } = await query(
      `SELECT * FROM email_queue
       WHERE status = 'pending' AND send_after <= datetime('now')
       ORDER BY id ASC LIMIT ?`,
      [limit]
    );
    if (!rows.length) return;

    for (const row of rows) {
      const result = await mailer.sendOne({
        to_email: row.to_email,
        to_name: row.to_name,
        subject: row.subject,
        html: row.html,
        campaign_id: row.campaign_id,
        automation_id: row.automation_id,
        queue_id: row.id,
        lead_id: row.lead_id,
      });

      if (result.ok) {
        await query(`UPDATE email_queue SET status='sent', updated_at=datetime('now') WHERE id=?`, [row.id]);
        if (row.campaign_id) {
          await query(`UPDATE email_campaigns SET sent_count = sent_count + 1 WHERE id=?`, [row.campaign_id]);
        }
      } else if (result.reason === 'no_capacity') {
        break; // pool exhausted mid-batch — leave the rest pending for tomorrow
      } else if (result.reason === 'suppressed' || result.reason === 'no_email') {
        await query(`UPDATE email_queue SET status='skipped', last_error=?, updated_at=datetime('now') WHERE id=?`,
          [result.reason, row.id]);
      } else {
        const attempts = (row.attempts || 0) + 1;
        const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
        await query(`UPDATE email_queue SET status=?, attempts=?, last_error=?, updated_at=datetime('now') WHERE id=?`,
          [status, attempts, String(result.error || result.reason).slice(0, 300), row.id]);
        if (status === 'failed' && row.campaign_id) {
          await query(`UPDATE email_campaigns SET fail_count = fail_count + 1 WHERE id=?`, [row.campaign_id]);
        }
      }
    }
  } catch (e) {
    console.error('[email-queue] tick error:', e.message);
  } finally {
    running = false;
  }
}

function startWorker() {
  console.log(`📧 Email queue worker started (batch=${BATCH_SIZE}/tick, every ${TICK_MS / 1000}s, live=${mailer.isLive()})`);
  setInterval(processTick, TICK_MS);
  setTimeout(processTick, 5000); // first pass shortly after boot
}

module.exports = { enqueue, enqueueMany, processTick, startWorker };
