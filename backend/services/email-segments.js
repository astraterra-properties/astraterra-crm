/**
 * Segment resolver — turns saved audience rules into a recipient list,
 * pulled live from the CRM's own leads / contacts / subscribers.
 *
 * rules = {
 *   base:    'leads' | 'contacts' | 'subscribers'  (default 'leads')
 *   status:  ['new','active', ...]      // optional status filter
 *   sources: ['website','referral', ...]// optional source filter
 *   scoreMin: 0, scoreMax: 100          // leads only
 *   inactiveDays: 30                    // leads only — no contact in N days
 *   limit:   null                       // optional cap
 * }
 */

const { query } = require('../config/database');

function parseRules(rules) {
  if (!rules) return {};
  if (typeof rules === 'string') {
    try { return JSON.parse(rules); } catch { return {}; }
  }
  return rules;
}

async function getRecipients(rules) {
  const r = parseRules(rules);
  const base = r.base || 'leads';
  const where = [];
  const params = [];

  let table, emailCol, nameCol, idCol;
  if (base === 'contacts') {
    table = 'contacts'; emailCol = 'email'; nameCol = 'name'; idCol = 'id';
  } else if (base === 'subscribers') {
    table = 'newsletter_subscribers'; emailCol = 'email'; nameCol = 'name'; idCol = 'id';
    where.push(`(status IS NULL OR status != 'unsubscribed')`);
  } else {
    table = 'leads'; emailCol = 'email'; nameCol = 'name'; idCol = 'id';
  }

  where.push(`${emailCol} IS NOT NULL`);
  where.push(`${emailCol} != ''`);

  if (Array.isArray(r.status) && r.status.length) {
    where.push(`status IN (${r.status.map(() => '?').join(',')})`);
    params.push(...r.status);
  }
  if (Array.isArray(r.sources) && r.sources.length) {
    where.push(`source IN (${r.sources.map(() => '?').join(',')})`);
    params.push(...r.sources);
  }
  if (base === 'leads') {
    if (typeof r.scoreMin === 'number') { where.push(`score >= ?`); params.push(r.scoreMin); }
    if (typeof r.scoreMax === 'number') { where.push(`score <= ?`); params.push(r.scoreMax); }
    if (typeof r.inactiveDays === 'number' && r.inactiveDays > 0) {
      // last_contacted older than N days (or never contacted)
      where.push(`(last_contacted IS NULL OR last_contacted <= datetime('now', ?))`);
      params.push(`-${r.inactiveDays} days`);
    }
  }

  let sql = `SELECT ${idCol} AS id, ${emailCol} AS email, ${nameCol} AS name FROM ${table}`;
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ` ORDER BY ${idCol} DESC`;
  if (r.limit && Number(r.limit) > 0) sql += ` LIMIT ${parseInt(r.limit, 10)}`;

  const { rows } = await query(sql, params);

  // Dedupe by email + drop anything on the suppression list
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const email = (row.email || '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ email: row.email.trim(), name: row.name || '', lead_id: base === 'leads' ? row.id : null });
  }

  if (out.length) {
    const { rows: supp } = await query(`SELECT email FROM email_suppression`);
    const blocked = new Set(supp.map((s) => (s.email || '').toLowerCase()));
    return out.filter((rcpt) => !blocked.has(rcpt.email.toLowerCase()));
  }
  return out;
}

module.exports = { getRecipients, parseRules };
