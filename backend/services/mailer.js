/**
 * Mailer — pluggable transport for the in-house email system.
 *
 * Transport today: Gmail API (free). Designed as a SENDER POOL so you scale
 * past one account's ~2,000/day cap simply by adding more senders — no engine
 * changes. Swapping to SES later means replacing only deliverViaGmail().
 *
 * Safety: sends are DRY-RUN unless EMAIL_LIVE=true, so testing never emails
 * real leads.
 *
 * Sender config (env EMAIL_SENDERS, JSON):
 *   [{ "email":"x@astraterra.ae", "clientId":"..", "clientSecret":"..",
 *      "refreshToken":"..", "dailyLimit":2000 }, ...]
 * Falls back to a single sender from GMAIL_* env / legacy constants.
 */

const { google } = require('googleapis');
const crypto = require('crypto');
const { query } = require('../config/database');

const LIVE = process.env.EMAIL_LIVE === 'true';
const DEFAULT_DAILY_LIMIT = parseInt(process.env.EMAIL_DAILY_LIMIT || '2000', 10);
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://crm.astraterra.ae').replace(/\/$/, '');
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Astraterra Properties';

// ─── Sender pool ────────────────────────────────────────────────────────────
function loadSenders() {
  // 1. EMAIL_SENDERS JSON array (preferred — scale by adding entries)
  if (process.env.EMAIL_SENDERS) {
    try {
      const arr = JSON.parse(process.env.EMAIL_SENDERS);
      if (Array.isArray(arr) && arr.length) {
        return arr.map((s) => ({ ...s, dailyLimit: s.dailyLimit || DEFAULT_DAILY_LIMIT }));
      }
    } catch (e) { console.warn('[mailer] EMAIL_SENDERS parse error:', e.message); }
  }
  // 2. Single sender from env, else legacy constants (keeps it working today)
  return [{
    email: process.env.GMAIL_USER || 'admin@astraterra.ae',
    clientId: process.env.GMAIL_CLIENT_ID || '755978414447-dsptstqakm3jna7li6fm5hnlmr7ogv5m.apps.googleusercontent.com',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || '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',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '1//0gxC7sM6PDgb3CgYIARAAGBASNwF-L9IrUGzadEquKq6GV6dpyD5WnhLZ2ZvwWZrq2-6BFaZrAwxlRWhooC6XLvHXpgNIFTNK24A',
    dailyLimit: DEFAULT_DAILY_LIMIT,
  }];
}

const SENDERS = loadSenders();
const gmailClients = {};
let rrIndex = 0;

function gmailFor(sender) {
  if (!gmailClients[sender.email]) {
    const oauth = new google.auth.OAuth2(sender.clientId, sender.clientSecret, 'http://localhost');
    oauth.setCredentials({ refresh_token: sender.refreshToken });
    gmailClients[sender.email] = google.gmail({ version: 'v1', auth: oauth });
  }
  return gmailClients[sender.email];
}

function today() { return new Date().toISOString().slice(0, 10); }

async function usageFor(email) {
  const { rows } = await query(
    `SELECT sent_count FROM email_sender_usage WHERE sender = ? AND day = ?`,
    [email, today()]
  );
  return rows.length ? rows[0].sent_count : 0;
}

async function bumpUsage(email) {
  await query(
    `INSERT INTO email_sender_usage (sender, day, sent_count) VALUES (?, ?, 1)
     ON CONFLICT(sender, day) DO UPDATE SET sent_count = sent_count + 1`,
    [email, today()]
  );
}

/** Pick a sender still under its daily cap. Returns null if all are exhausted. */
async function pickSender() {
  for (let i = 0; i < SENDERS.length; i++) {
    const sender = SENDERS[(rrIndex + i) % SENDERS.length];
    if (sender.active === false) continue;
    const used = await usageFor(sender.email);
    if (used < sender.dailyLimit) {
      rrIndex = (rrIndex + i + 1) % SENDERS.length; // rotate for next call
      return { sender, remaining: sender.dailyLimit - used };
    }
  }
  return null;
}

/** Total emails still sendable today across the whole pool. */
async function remainingCapacityToday() {
  let total = 0;
  for (const s of SENDERS) {
    if (s.active === false) continue;
    total += Math.max(0, s.dailyLimit - (await usageFor(s.email)));
  }
  return total;
}

// ─── Rendering ──────────────────────────────────────────────────────────────
function renderMergeTags(html, data = {}) {
  if (!html) return '';
  const name = data.name || '';
  const firstName = name.split(' ')[0] || 'there';
  const map = {
    name: name || 'there',
    first_name: firstName,
    email: data.email || '',
  };
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : m
  );
}

/** Inject open pixel, rewrite links for click tracking, append unsubscribe footer. */
function injectTracking(html, { openToken, unsubToken }) {
  let out = html || '';

  // Click tracking — rewrite http(s) links through the redirect endpoint
  if (openToken) {
    out = out.replace(/href="(https?:\/\/[^"]+)"/gi, (m, url) => {
      if (/\/api\/email-marketing\/(t|u)\//.test(url)) return m; // don't rewrite our own
      return `href="${PUBLIC_BASE}/api/email-marketing/t/c/${openToken}?u=${encodeURIComponent(url)}"`;
    });
  }

  // Unsubscribe footer
  if (unsubToken) {
    const footer = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">
You received this email from Astraterra Properties.
<a href="${PUBLIC_BASE}/api/email-marketing/u/${unsubToken}" style="color:#999;">Unsubscribe</a>
</div>`;
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, footer + '</body>');
    else out += footer;
  }

  // Open pixel (last, so it survives the body replace above)
  if (openToken) {
    const pixel = `<img src="${PUBLIC_BASE}/api/email-marketing/t/o/${openToken}" width="1" height="1" style="display:none" alt="" />`;
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, pixel + '</body>');
    else out += pixel;
  }
  return out;
}

// ─── Delivery ────────────────────────────────────────────────────────────────
function buildRaw({ from, to, subject, html, unsubToken, replyTo }) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const boundary = `b_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: "${FROM_NAME}" <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : '',
    unsubToken
      ? `List-Unsubscribe: <${PUBLIC_BASE}/api/email-marketing/u/${unsubToken}>`
      : '',
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    '',
    `--${boundary}--`,
  ].filter((l) => l !== '');
  return Buffer.from(headers.join('\r\n'))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function deliverViaGmail(sender, { to, subject, html, unsubToken, replyTo }) {
  if (!LIVE) {
    return { messageId: `dryrun_${crypto.randomBytes(6).toString('hex')}`, dryRun: true };
  }
  const raw = buildRaw({ from: sender.email, to, subject, html, unsubToken, replyTo });
  const res = await gmailFor(sender).users.messages.send({ userId: 'me', requestBody: { raw } });
  return { messageId: res.data.id };
}

/**
 * Send one email now (cap-aware). Logs to email_sends. Returns
 * { ok, reason }. reason 'no_capacity' means all senders hit their cap today —
 * the caller should leave it queued so it rolls to tomorrow.
 */
async function sendOne({ to_email, to_name, subject, html, campaign_id, automation_id, queue_id, lead_id }) {
  const email = (to_email || '').trim();
  if (!email) return { ok: false, reason: 'no_email' };

  // Suppression check
  const { rows: supp } = await query(`SELECT 1 FROM email_suppression WHERE email = ?`, [email.toLowerCase()]);
  if (supp.length) return { ok: false, reason: 'suppressed' };

  const picked = await pickSender();
  if (!picked) return { ok: false, reason: 'no_capacity' };

  const openToken = crypto.randomBytes(16).toString('hex');
  const unsubToken = crypto.randomBytes(16).toString('hex');
  const rendered = injectTracking(renderMergeTags(html, { name: to_name, email }), { openToken, unsubToken });
  const subj = renderMergeTags(subject, { name: to_name, email });

  try {
    const { messageId, dryRun } = await deliverViaGmail(picked.sender, {
      to: email, subject: subj, html: rendered, unsubToken,
    });
    await bumpUsage(picked.sender.email);
    await query(
      `INSERT INTO email_sends (to_email,to_name,subject,sender,campaign_id,automation_id,queue_id,status,message_id,open_token,unsub_token)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [email, to_name || '', subj, picked.sender.email, campaign_id || null, automation_id || null,
       queue_id || null, dryRun ? 'dryrun' : 'sent', messageId, openToken, unsubToken]
    );
    return { ok: true, dryRun, sender: picked.sender.email };
  } catch (e) {
    await query(
      `INSERT INTO email_sends (to_email,to_name,subject,sender,campaign_id,automation_id,queue_id,status,error)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [email, to_name || '', subj, picked.sender.email, campaign_id || null, automation_id || null,
       queue_id || null, 'failed', String(e.message).slice(0, 300)]
    );
    return { ok: false, reason: 'send_error', error: e.message };
  }
}

module.exports = {
  sendOne,
  pickSender,
  remainingCapacityToday,
  renderMergeTags,
  injectTracking,
  isLive: () => LIVE,
  senders: () => SENDERS.map((s) => ({ email: s.email, dailyLimit: s.dailyLimit, active: s.active !== false })),
};
