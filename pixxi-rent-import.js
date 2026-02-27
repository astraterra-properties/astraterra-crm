/**
 * Pixxi CRM → Astraterra CRM Full Import Script
 * Covers ALL segments including INACTIVE (the bulk of leads)
 * Run: node pixxi-rent-import.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Use raw sqlite3 for direct DB access (no backend needed)
const Database = require('/tmp/node_modules/better-sqlite3');
const DB_PATH = path.join(__dirname, '../data/astraterra-crm.db');

let db;
try {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
} catch (e) {
  console.error('Failed to open DB:', e.message);
  process.exit(1);
}

// ── helpers ────────────────────────────────────────────────────────────────

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

async function fetchPage(token, clientType, status, page) {
  const r = await post(
    'https://pixxicrm.ae/api/v1/client/list',
    { clientType, status, page, pageSize: 10 },
    { Authorization: `Bearer ${token}` }
  );
  if (r.status !== 200) throw new Error(`API error ${r.status}: ` + JSON.stringify(r.body));
  const d = r.body;
  const list = d?.data?.list ?? [];
  const total = d?.data?.totalSize ?? 0;
  return { list, total };
}

// ── fetch all for a segment ────────────────────────────────────────────────

const API_PAGE_SIZE = 10;

async function fetchAll(token, clientType, status, retryToken) {
  let tkn = token;
  let first;
  try {
    first = await fetchPage(tkn, clientType, status, 1);
  } catch (e) {
    console.error(`  ❌ Failed page 1 for ${clientType}/${status}: ${e.message}`);
    return [];
  }
  const total = first.total;
  const pages = Math.ceil(total / API_PAGE_SIZE);
  console.log(`  📋 ${clientType}/${status}: ${total} leads across ${pages} pages`);
  const all = [...first.list];

  for (let p = 2; p <= pages; p++) {
    let attempts = 0;
    while (attempts < 3) {
      try {
        const { list } = await fetchPage(tkn, clientType, status, p);
        all.push(...list);
        break;
      } catch (e) {
        attempts++;
        if (attempts >= 3) {
          console.error(`  ⚠️  Giving up on page ${p}/${pages} for ${clientType}/${status}: ${e.message}`);
        } else {
          console.log(`  ↩️  Retry ${attempts} for page ${p}…`);
          await sleep(2000);
          // Re-login if token might have expired
          if (e.message.includes('401') || e.message.includes('403')) {
            tkn = await login();
          }
        }
      }
    }
    if (p % 100 === 0) console.log(`    … fetched page ${p}/${pages} for ${clientType}/${status} (${all.length} leads so far)`);
    await sleep(120); // polite delay
  }
  return all;
}

// ── field mapping ──────────────────────────────────────────────────────────

function mapStatus(pixxiStatus) {
  const m = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    DEAL: 'closed',
    INVALID: 'inactive',
    UNDEAL: 'inactive',
  };
  return m[pixxiStatus] ?? 'active';
}

function isLeadPool(pixxiStatus) {
  return ['UNDEAL', 'DEAL', 'INACTIVE', 'INVALID'].includes(pixxiStatus);
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
  const lead_pool = isLeadPool(status) ? 1 : 0;
  const lead_source_status = status;
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
    lead_pool,
    lead_source_status,
    created_at,
  };
}

// ── upsert (direct SQLite, manual check approach) ─────────────────────────

const stmtSelect  = db.prepare('SELECT id FROM contacts WHERE phone = ?');
const stmtInsert  = db.prepare(`
  INSERT INTO contacts
    (name, phone, email, type, location_preference, budget_min, budget_max,
     property_type, bedrooms, source, notes, status, lead_pool, lead_source_status,
     created_at, updated_at)
  VALUES
    (@name, @phone, @email, @type, @location_preference, @budget_min, @budget_max,
     @property_type, @bedrooms, @source, @notes, @status, @lead_pool, @lead_source_status,
     @created_at, @updated_at)
`);
const stmtUpdate  = db.prepare(`
  UPDATE contacts SET
    name                = COALESCE(@name, name),
    email               = COALESCE(@email, email),
    type                = @type,
    location_preference = COALESCE(@location_preference, location_preference),
    budget_min          = COALESCE(@budget_min, budget_min),
    budget_max          = COALESCE(@budget_max, budget_max),
    property_type       = COALESCE(@property_type, property_type),
    bedrooms            = COALESCE(@bedrooms, bedrooms),
    source              = COALESCE(@source, source),
    notes               = COALESCE(@notes, notes),
    status              = @status,
    lead_pool           = @lead_pool,
    lead_source_status  = @lead_source_status,
    updated_at          = @updated_at
  WHERE id = @id
`);
const stmtInsertNullPhone = db.prepare(`
  INSERT INTO contacts
    (name, phone, email, type, location_preference, budget_min, budget_max,
     property_type, bedrooms, source, notes, status, lead_pool, lead_source_status,
     created_at, updated_at)
  VALUES
    (@name, NULL, @email, @type, @location_preference, @budget_min, @budget_max,
     @property_type, @bedrooms, @source, @notes, @status, @lead_pool, @lead_source_status,
     @created_at, @updated_at)
`);

function upsert(mapped) {
  const now = new Date().toISOString();
  const params = { ...mapped, updated_at: now };

  if (!mapped.phone) {
    // Null/empty phone — always insert (NULL != NULL in SQLite, can't dedup)
    stmtInsertNullPhone.run(params);
    return 'inserted';
  }

  const existing = stmtSelect.get(mapped.phone);
  if (existing) {
    stmtUpdate.run({ ...params, id: existing.id });
    return 'updated';
  } else {
    stmtInsert.run(params);
    return 'inserted';
  }
}

// ── mark old lead_pool entries ─────────────────────────────────────────────

function markLeadPool() {
  console.log('\n🏊 Marking Lead Pool entries…');

  // Already marked via lead_source_status, but also mark no-phone records
  const r1 = db.prepare(`
    UPDATE contacts SET lead_pool = 1
    WHERE phone IS NULL AND lead_pool = 0
  `).run();
  console.log(`  → ${r1.changes} no-phone contacts marked as lead_pool`);

  // Contacts older than 6 months with inactive status
  const r2 = db.prepare(`
    UPDATE contacts SET lead_pool = 1
    WHERE lead_pool = 0
      AND status = 'inactive'
      AND created_at < datetime('now', '-6 months')
  `).run();
  console.log(`  → ${r2.changes} old inactive contacts marked as lead_pool`);

  const totPool = db.prepare('SELECT COUNT(*) as cnt FROM contacts WHERE lead_pool = 1').get();
  console.log(`  ✅ Total lead_pool contacts: ${totPool.cnt}`);
  return totPool.cnt;
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const token = await login();

  const segments = [
    // Previously imported (will update with new fields)
    { clientType: 'BUY',  status: 'ACTIVE'   },
    { clientType: 'RENT', status: 'ACTIVE'   },
    { clientType: 'BUY',  status: 'DEAL'     },
    { clientType: 'RENT', status: 'DEAL'     },
    { clientType: 'BUY',  status: 'UNDEAL'   },
    { clientType: 'RENT', status: 'UNDEAL'   },
    // NEW: The massive INACTIVE segment
    { clientType: 'RENT', status: 'INACTIVE' },
    { clientType: 'BUY',  status: 'INACTIVE' },
  ];

  let inserted = 0, updated = 0, skipped = 0, errors = 0;
  let processed = 0;
  const startTime = Date.now();

  for (const seg of segments) {
    console.log(`\n🔄 Fetching ${seg.clientType} / ${seg.status}…`);
    let leads;
    try {
      leads = await fetchAll(token, seg.clientType, seg.status);
    } catch (e) {
      console.error(`  ❌ Failed to fetch segment: ${e.message}`);
      continue;
    }

    // Batch processing with transactions for performance
    const batchSize = 500;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const insertBatch = db.transaction((batchRecs) => {
        for (const rec of batchRecs) {
          try {
            const mapped = mapRecord(rec, seg.clientType, seg.status);
            if (!mapped) { skipped++; processed++; continue; }
            const result = upsert(mapped);
            if (result === 'inserted') inserted++;
            else updated++;
          } catch (e) {
            errors++;
            // Don't log individual errors to avoid noise; count them
          }
          processed++;
        }
      });
      insertBatch(batch);
      if (processed % 500 === 0 || i + batchSize >= leads.length) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  … ${processed} records processed [+${inserted} new, ~${updated} updated, ${errors} errors] ${elapsed}s elapsed`);
      }
    }

    console.log(`  ✅ Done ${seg.clientType}/${seg.status}: ${leads.length} leads`);
  }

  // Mark lead pool entries
  const poolCount = markLeadPool();

  // Final counts
  const totalInDb = db.prepare('SELECT COUNT(*) as cnt FROM contacts').get().cnt;
  const rentInDb  = db.prepare("SELECT COUNT(*) as cnt FROM contacts WHERE type = 'tenant'").get().cnt;
  const buyInDb   = db.prepare("SELECT COUNT(*) as cnt FROM contacts WHERE type = 'buyer'").get().cnt;
  const activeInDb= db.prepare("SELECT COUNT(*) as cnt FROM contacts WHERE status = 'active'").get().cnt;
  const elapsedTotal = ((Date.now() - startTime) / 1000).toFixed(0);

  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ Pixxi CRM Full Import Complete!');
  console.log(`   Inserted      : ${inserted}`);
  console.log(`   Updated       : ${updated}`);
  console.log(`   Skipped       : ${skipped}`);
  console.log(`   Errors        : ${errors}`);
  console.log(`   ─────────────────────────────────────`);
  console.log(`   Total in DB   : ${totalInDb}`);
  console.log(`   Rent leads    : ${rentInDb}`);
  console.log(`   Buy leads     : ${buyInDb}`);
  console.log(`   Active leads  : ${activeInDb}`);
  console.log(`   Lead Pool     : ${poolCount}`);
  console.log(`   Time elapsed  : ${elapsedTotal}s`);
  console.log('═══════════════════════════════════════════════');

  const summary = {
    inserted, updated, skipped, errors,
    totalInDb, rentInDb, buyInDb, activeInDb, poolCount,
    elapsedSeconds: parseInt(elapsedTotal),
  };
  fs.writeFileSync('/tmp/pixxi-import-summary.json', JSON.stringify(summary, null, 2));
  console.log('📄 Summary saved to /tmp/pixxi-import-summary.json');

  db.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  db?.close();
  process.exit(1);
});
