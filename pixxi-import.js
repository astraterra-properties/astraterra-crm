/**
 * Pixxi CRM → Astraterra CRM Import Script
 */

const https = require('https');
const http = require('http');
const { query } = require('./backend/config/database');

// ── helpers ────────────────────────────────────────────────────────────────

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── auth ───────────────────────────────────────────────────────────────────

async function login() {
  console.log('🔐 Logging into Pixxi CRM…');
  const r = await post('https://pixxicrm.ae/api/login', {
    username: 'joseph@astraterra.ae',
    password: 'Joseph@1234!',
  });
  const token = r.body?.token || r.body?.data?.token;
  if (r.status !== 200 || !token) {
    throw new Error('Login failed: ' + JSON.stringify(r.body));
  }
  console.log('✅ Logged in. Token:', token.slice(0, 20) + '…');
  return token;
}

// ── fetch page ─────────────────────────────────────────────────────────────

async function fetchPage(token, clientType, status, page, pageSize = 200) {
  const r = await post(
    'https://pixxicrm.ae/api/v1/client/list',
    { clientType, status, page, pageSize },
    { Authorization: `Bearer ${token}` }
  );
  if (r.status !== 200) throw new Error(`API error ${r.status}: ` + JSON.stringify(r.body));
  const d = r.body;
  const list = d?.data?.list ?? [];
  const total = d?.data?.totalSize ?? 0;
  return { list, total };
}

// ── fetch all for a segment ────────────────────────────────────────────────

const API_PAGE_SIZE = 10; // API ignores pageSize param and always returns 10 per page

async function fetchAll(token, clientType, status) {
  const first = await fetchPage(token, clientType, status, 1);
  const total = first.total;
  const pages = Math.ceil(total / API_PAGE_SIZE);
  console.log(`  📋 ${clientType}/${status}: ${total} leads across ${pages} pages (10/page)`);
  const all = [...first.list];
  for (let p = 2; p <= pages; p++) {
    const { list } = await fetchPage(token, clientType, status, p);
    all.push(...list);
    if (p % 10 === 0) console.log(`    … fetched page ${p}/${pages} for ${clientType}/${status}`);
    await new Promise(res => setTimeout(res, 150)); // polite delay
  }
  return all;
}

// ── field mapping ──────────────────────────────────────────────────────────

function mapStatus(pixxiStatus) {
  const m = { ACTIVE: 'active', DEAL: 'closed', INVALID: 'inactive', UNDEAL: 'inactive' };
  return m[pixxiStatus] ?? 'active';
}

function mapType(clientType) {
  return clientType === 'BUY' ? 'buyer' : 'tenant';
}

function mapSource(src) {
  if (!src) return null;
  return src.toLowerCase().replace(/_/g, ' ');
}

function mapRecord(rec, clientType, status) {
  const name = (rec.name ?? '').trim();
  if (!name || name === 'N/A') return null;

  const phone = rec.phone || rec.secondryPhone || null;
  const email = rec.email || null;
  const type = mapType(clientType);
  const budget = rec.budget ? parseFloat(rec.budget) : null;
  const budget_min = budget;
  const budget_max = budget ? budget * 1.2 : null;
  const bedrooms = rec.rooms ?? null;
  const property_type = Array.isArray(rec.houseType) && rec.houseType.length > 0
    ? rec.houseType[0] : null;
  const source = mapSource(rec.clientSource);
  let notes = rec.notes || null;
  if (rec.formName) notes = (notes ? notes + ' | Form: ' : 'Form: ') + rec.formName;
  const location_preference = rec.region?.name || rec.community?.name || null;
  const recStatus = mapStatus(status);
  const created_at = rec.createTime
    ? new Date(rec.createTime).toISOString()
    : new Date().toISOString();

  return {
    name,
    phone,
    email,
    type,
    location_preference,
    budget_min,
    budget_max,
    property_type,
    bedrooms,
    source,
    notes,
    status: recStatus,
    created_at,
  };
}

// ── upsert ─────────────────────────────────────────────────────────────────

async function upsert(mapped) {
  // Check existence
  const existing = await query(
    'SELECT id FROM contacts WHERE name = ? AND phone = ?',
    [mapped.name, mapped.phone]
  );

  const now = new Date().toISOString();

  if (existing.rows.length > 0) {
    // UPDATE
    await query(
      `UPDATE contacts SET
        email = ?, type = ?, location_preference = ?,
        budget_min = ?, budget_max = ?, property_type = ?,
        bedrooms = ?, source = ?, notes = ?,
        status = ?, updated_at = ?
       WHERE name = ? AND phone = ?`,
      [
        mapped.email, mapped.type, mapped.location_preference,
        mapped.budget_min, mapped.budget_max, mapped.property_type,
        mapped.bedrooms, mapped.source, mapped.notes,
        mapped.status, now,
        mapped.name, mapped.phone,
      ]
    );
    return 'updated';
  } else {
    // INSERT
    await query(
      `INSERT INTO contacts
        (name, phone, email, type, location_preference, budget_min, budget_max,
         property_type, bedrooms, source, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mapped.name, mapped.phone, mapped.email, mapped.type,
        mapped.location_preference, mapped.budget_min, mapped.budget_max,
        mapped.property_type, mapped.bedrooms, mapped.source,
        mapped.notes, mapped.status, mapped.created_at, now,
      ]
    );
    return 'inserted';
  }
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const token = await login();

  const segments = [
    { clientType: 'BUY',  status: 'ACTIVE' },
    { clientType: 'RENT', status: 'ACTIVE' },
    { clientType: 'BUY',  status: 'DEAL'   },
    { clientType: 'RENT', status: 'DEAL'   },
    { clientType: 'BUY',  status: 'UNDEAL' },
    { clientType: 'RENT', status: 'UNDEAL' },
  ];

  let inserted = 0, updated = 0, skipped = 0, errors = 0;
  let processed = 0;

  for (const seg of segments) {
    console.log(`\n🔄 Fetching ${seg.clientType} / ${seg.status}…`);
    let leads;
    try {
      leads = await fetchAll(token, seg.clientType, seg.status);
    } catch (e) {
      console.error(`  ❌ Failed to fetch segment: ${e.message}`);
      continue;
    }

    for (const rec of leads) {
      try {
        const mapped = mapRecord(rec, seg.clientType, seg.status);
        if (!mapped) { skipped++; processed++; continue; }

        const result = await upsert(mapped);
        if (result === 'inserted') inserted++;
        else updated++;
      } catch (e) {
        errors++;
        console.error(`  ⚠️  Error on record "${rec.name}": ${e.message}`);
      }
      processed++;
      if (processed % 100 === 0) {
        console.log(`  … processed ${processed} records (inserted: ${inserted}, updated: ${updated}, skipped: ${skipped}, errors: ${errors})`);
      }
    }
  }

  // Final counts
  const totalRes = await query('SELECT COUNT(*) as cnt FROM contacts');
  const totalInDb = totalRes.rows[0]?.cnt ?? 0;

  console.log('\n═══════════════════════════════════════');
  console.log('✅ Pixxi CRM Import Complete!');
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Updated  : ${updated}`);
  console.log(`   Skipped  : ${skipped}`);
  console.log(`   Errors   : ${errors}`);
  console.log(`   Total in DB: ${totalInDb}`);
  console.log('═══════════════════════════════════════');

  // Write summary to file so we can read it after the script exits
  const summary = JSON.stringify({ inserted, updated, skipped, errors, totalInDb });
  require('fs').writeFileSync('/tmp/pixxi-import-summary.json', summary);

  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
