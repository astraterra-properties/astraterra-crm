/**
 * Pixxi CRM Data API Integration
 * Syncs properties, leads, developers, agents from Pixxi CRM
 * Handles real-time webhook events
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const PIXXI_BASE_URL = 'https://dataapi.pixxicrm.ae';

// ─── Helper: fetch with Pixxi auth ────────────────────────────────────────────
async function pixxiFetch(path, options = {}) {
  const token = process.env.PIXXI_TOKEN;
  if (!token) throw new Error('PIXXI_TOKEN not configured');

  const headers = {
    'Content-Type': 'application/json',
    'X-PIXXI-TOKEN': token,
    ...options.headers,
  };

  const res = await fetch(`${PIXXI_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pixxi API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Initialize Pixxi DB tables ───────────────────────────────────────────────
async function initPixxiTables() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS pixxi_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT,
      last_properties_sync DATETIME,
      last_leads_sync DATETIME,
      last_developers_sync DATETIME,
      last_agents_sync DATETIME,
      webhook_subscribed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await query(`CREATE TABLE IF NOT EXISTS pixxi_properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pixxi_id INTEGER UNIQUE,
      pixxi_property_id TEXT,
      title TEXT,
      listing_type TEXT,
      property_type TEXT,
      price REAL,
      bedrooms INTEGER,
      size REAL,
      description TEXT,
      region TEXT,
      city TEXT,
      developer TEXT,
      developer_logo TEXT,
      developer_id TEXT,
      agent_name TEXT,
      agent_phone TEXT,
      agent_email TEXT,
      photos TEXT,
      amenities TEXT,
      floor_plans TEXT,
      payment_plan TEXT,
      status TEXT,
      handover_time TEXT,
      position TEXT,
      permit_number TEXT,
      pixxi_created_at TEXT,
      pixxi_updated_at TEXT,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await query(`CREATE TABLE IF NOT EXISTS pixxi_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pixxi_id INTEGER UNIQUE,
      name TEXT,
      phone TEXT,
      email TEXT,
      status TEXT,
      client_type TEXT,
      source TEXT,
      notes TEXT,
      agent_name TEXT,
      created_at_pixxi TEXT,
      updated_at_pixxi TEXT,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await query(`CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT,
      records_synced INTEGER DEFAULT 0,
      total_records INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add pixxi_id columns to existing tables (safe: ALTER TABLE is idempotent via try/catch)
    try { await query(`ALTER TABLE contacts ADD COLUMN pixxi_id INTEGER`); } catch (e) { /* already exists */ }
    try { await query(`ALTER TABLE properties ADD COLUMN pixxi_id INTEGER`); } catch (e) { /* already exists */ }

    // Insert default config row if none exists
    const existing = await query(`SELECT id FROM pixxi_config LIMIT 1`);
    if (!existing.rows.length) {
      await query(`INSERT INTO pixxi_config (token) VALUES ('')`);
    }

    console.log('✅ Pixxi tables initialized');
  } catch (err) {
    console.error('Pixxi table init error:', err.message);
  }
}

initPixxiTables();

// ─── Config routes ─────────────────────────────────────────────────────────────

// GET /api/pixxi/config
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const cfg = await query(`SELECT * FROM pixxi_config ORDER BY id ASC LIMIT 1`);
    const hasToken = !!(process.env.PIXXI_TOKEN && process.env.PIXXI_TOKEN.trim());

    // Counts
    const propCount  = await query(`SELECT COUNT(*) as c FROM pixxi_properties`);
    const leadCount  = await query(`SELECT COUNT(*) as c FROM pixxi_leads`);

    // Sync log last 10
    const log = await query(`SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 10`);

    res.json({
      config: cfg.rows[0] || {},
      hasToken,
      counts: {
        properties: parseInt(propCount.rows[0]?.c || 0),
        leads: parseInt(leadCount.rows[0]?.c || 0),
      },
      syncLog: log.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pixxi/config — save token
router.post('/config', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    // Update env variable in memory
    process.env.PIXXI_TOKEN = token;

    // Persist to config table
    const existing = await query(`SELECT id FROM pixxi_config LIMIT 1`);
    if (existing.rows.length) {
      await query(`UPDATE pixxi_config SET token = $1, updated_at = datetime('now') WHERE id = $2`, [token, existing.rows[0].id]);
    } else {
      await query(`INSERT INTO pixxi_config (token) VALUES ($1)`, [token]);
    }

    // Also write to .env file for persistence across restarts
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(__dirname, '../.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (/^PIXXI_TOKEN=.*$/m.test(envContent)) {
        envContent = envContent.replace(/^PIXXI_TOKEN=.*$/m, `PIXXI_TOKEN=${token}`);
      } else {
        envContent += `\nPIXXI_TOKEN=${token}`;
      }
      fs.writeFileSync(envPath, envContent);
    } catch (e) {
      console.warn('Could not write PIXXI_TOKEN to .env:', e.message);
    }

    res.json({ success: true, message: 'Token saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pixxi/test — test connection
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const data = await pixxiFetch('/pixxiapi/v1/agent/list');
    res.json({ success: true, message: 'Connection successful', agents: data?.length || 0 });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── Sync: Properties ─────────────────────────────────────────────────────────

router.post('/sync/properties', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  let totalSynced = 0;
  let totalErrors = 0;
  const listingTypes = ['NEW', 'SELL', 'RENT'];

  try {
    for (const listingType of listingTypes) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        let data;
        try {
          data = await pixxiFetch('/pixxiapi/v1/properties', {
            method: 'POST',
            body: JSON.stringify({ listingType, page, size: 50 }),
          });
        } catch (err) {
          console.error(`Pixxi properties fetch error (${listingType} p${page}):`, err.message);
          hasMore = false;
          totalErrors++;
          break;
        }

        const _d = data?.data; const items = Array.isArray(_d) ? _d : (_d?.list || _d?.content || (Array.isArray(data) ? data : []));
        if (!items.length) { hasMore = false; break; }

        for (const prop of items) {
          try {
            const photos = JSON.stringify(prop.photos || []);
            const amenities = JSON.stringify(prop.amenities || []);
            const floorPlans = JSON.stringify(prop.newParam?.floorPlan || []);
            const paymentPlan = JSON.stringify(prop.newParam?.paymentPlan || null);
            const propertyType = Array.isArray(prop.propertyType) ? prop.propertyType.join(',') : (prop.propertyType || '');
            const agentName = prop.agent?.name || prop.agent || '';
            const agentPhone = prop.agent?.phone || '';
            const agentEmail = prop.agent?.email || '';
            const developerId = prop.developerId || prop.developer_id || '';

            // Upsert into pixxi_properties
            await query(`
              INSERT INTO pixxi_properties (
                pixxi_id, pixxi_property_id, title, listing_type, property_type,
                price, bedrooms, size, description, region, city,
                developer, developer_logo, developer_id,
                agent_name, agent_phone, agent_email,
                photos, amenities, floor_plans, payment_plan,
                status, handover_time, position, permit_number,
                pixxi_created_at, pixxi_updated_at, synced_at
              ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,datetime('now')
              )
              ON CONFLICT(pixxi_id) DO UPDATE SET
                pixxi_property_id=excluded.pixxi_property_id, title=excluded.title,
                listing_type=excluded.listing_type, property_type=excluded.property_type,
                price=excluded.price, bedrooms=excluded.bedrooms, size=excluded.size,
                description=excluded.description, region=excluded.region, city=excluded.city,
                developer=excluded.developer, developer_logo=excluded.developer_logo,
                developer_id=excluded.developer_id, agent_name=excluded.agent_name,
                agent_phone=excluded.agent_phone, agent_email=excluded.agent_email,
                photos=excluded.photos, amenities=excluded.amenities,
                floor_plans=excluded.floor_plans, payment_plan=excluded.payment_plan,
                status=excluded.status, handover_time=excluded.handover_time,
                position=excluded.position, permit_number=excluded.permit_number,
                pixxi_created_at=excluded.pixxi_created_at, pixxi_updated_at=excluded.pixxi_updated_at,
                synced_at=CURRENT_TIMESTAMP
            `, [
              prop.id, prop.propertyId, prop.title, listingType, propertyType,
              prop.price, prop.bedRooms, prop.size, prop.description,
              prop.region, prop.cityName,
              prop.developer, prop.developerLogo, developerId,
              agentName, agentPhone, agentEmail,
              photos, amenities, floorPlans, paymentPlan,
              prop.status, prop.newParam?.handoverTime, prop.newParam?.position, prop.permitNumber,
              prop.createdAt, prop.updatedAt,
            ]);

            // Also upsert into main properties table
            try {
              const propId = `PIXXI-${prop.id}`;
              const purpose = listingType === 'RENT' ? 'rent' : 'sale';
              const ptype = propertyType.toLowerCase().includes('apartment') ? 'apartment' :
                            propertyType.toLowerCase().includes('villa') ? 'villa' :
                            propertyType.toLowerCase().includes('townhouse') ? 'townhouse' : 'apartment';

              const mainExists = await query(`SELECT id FROM properties WHERE pixxi_id = $1`, [prop.id]);
              if (mainExists.rows.length) {
                await query(`UPDATE properties SET
                  title=$1, type=$2, location=$3, price=$4, bedrooms=$5, purpose=$6,
                  description=$7, photos=$8, status=$9, pixxi_id=$10
                  WHERE pixxi_id=$10`,
                  [prop.title, ptype, prop.region || prop.cityName, prop.price, prop.bedRooms, purpose,
                   prop.description, photos, prop.status || 'available', prop.id]);
              } else {
                await query(`INSERT INTO properties
                  (property_id, title, type, location, price, bedrooms, purpose, description, photos, status, pixxi_id, listed_date)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,datetime('now'))`,
                  [propId, prop.title, ptype, prop.region || prop.cityName, prop.price, prop.bedRooms,
                   purpose, prop.description, photos, prop.status || 'available', prop.id]);
              }
            } catch (e) { /* non-critical */ }

            totalSynced++;
          } catch (e) {
            console.error('Error saving property:', e.message);
            totalErrors++;
          }
        }

        if (items.length < 50) hasMore = false;
        else page++;
      }
    }

    // Update last sync time
    await query(`UPDATE pixxi_config SET last_properties_sync = datetime('now'), updated_at = datetime('now') WHERE id = (SELECT id FROM pixxi_config LIMIT 1)`);

    // Log sync
    await query(`INSERT INTO sync_log (sync_type, records_synced, errors, status) VALUES ('properties', $1, $2, $3)`,
      [totalSynced, totalErrors, totalErrors > 0 ? 'partial' : 'success']);

    res.json({ success: true, synced: totalSynced, errors: totalErrors, duration: Date.now() - startTime });
  } catch (err) {
    await query(`INSERT INTO sync_log (sync_type, records_synced, errors, status, error_message) VALUES ('properties', $1, $2, 'error', $3)`,
      [totalSynced, totalErrors, err.message]).catch(() => {});
    res.status(500).json({ error: err.message, synced: totalSynced });
  }
});

// ─── Sync: Leads ──────────────────────────────────────────────────────────────

router.post('/sync/leads', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  let totalSynced = 0;
  let totalErrors = 0;
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      let data;
      try {
        data = await pixxiFetch('/pixxiapi/v1/lead/list', {
          method: 'POST',
          body: JSON.stringify({ page, size: 50 }),
        });
      } catch (err) {
        console.error(`Pixxi leads fetch error (p${page}):`, err.message);
        hasMore = false;
        totalErrors++;
        break;
      }

      const _d = data?.data; const items = Array.isArray(_d) ? _d : (_d?.list || _d?.content || (Array.isArray(data) ? data : []));
      if (!items.length) { hasMore = false; break; }

      for (const lead of items) {
        try {
          const leadId = lead.id || lead.leadId;
          const name = lead.name || lead.clientName || '';
          const phone = lead.phone || lead.mobile || lead.contact || '';
          const email = lead.email || '';
          const status = lead.status || 'new';
          const clientType = lead.clientType || lead.type || '';
          const source = lead.source || 'pixxi';
          const notes = lead.notes || lead.note || '';
          const agentName = lead.agent?.name || lead.agentName || '';

          // Upsert pixxi_leads
          await query(`
            INSERT INTO pixxi_leads (pixxi_id, name, phone, email, status, client_type, source, notes, agent_name, created_at_pixxi, updated_at_pixxi)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT(pixxi_id) DO UPDATE SET
              name=excluded.name, phone=excluded.phone, email=excluded.email, status=excluded.status,
              client_type=excluded.client_type, source=excluded.source, notes=excluded.notes,
              agent_name=excluded.agent_name, created_at_pixxi=excluded.created_at_pixxi,
              updated_at_pixxi=excluded.updated_at_pixxi, synced_at=CURRENT_TIMESTAMP
          `, [leadId, name, phone, email, status, clientType, source, notes, agentName, lead.createdAt, lead.updatedAt]);

          // Upsert into main contacts table
          try {
            const existing = await query(`SELECT id FROM contacts WHERE pixxi_id = $1`, [leadId]);
            if (existing.rows.length) {
              await query(`UPDATE contacts SET name=$1, phone=$2, email=$3, status=$4, source=$5, notes=$6, pixxi_id=$7 WHERE pixxi_id=$7`,
                [name, phone, email, status === 'active' ? 'active' : 'new', source, notes, leadId]);
            } else {
              // Check by phone to avoid duplicates
              const byPhone = phone ? await query(`SELECT id FROM contacts WHERE phone = $1 LIMIT 1`, [phone]) : { rows: [] };
              if (byPhone.rows.length) {
                await query(`UPDATE contacts SET pixxi_id=$1 WHERE id=$2`, [leadId, byPhone.rows[0].id]);
              } else {
                await query(`INSERT INTO contacts (name, phone, email, type, source, notes, status, pixxi_id)
                  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                  [name, phone, email, clientType === 'seller' ? 'seller' : 'buyer', source, notes, 'new', leadId]);
              }
            }
          } catch (e) { /* non-critical */ }

          totalSynced++;
        } catch (e) {
          console.error('Error saving lead:', e.message);
          totalErrors++;
        }
      }

      if (items.length < 50) hasMore = false;
      else page++;
    }

    await query(`UPDATE pixxi_config SET last_leads_sync = datetime('now'), updated_at = datetime('now') WHERE id = (SELECT id FROM pixxi_config LIMIT 1)`);
    await query(`INSERT INTO sync_log (sync_type, records_synced, errors, status) VALUES ('leads', $1, $2, $3)`,
      [totalSynced, totalErrors, totalErrors > 0 ? 'partial' : 'success']);

    res.json({ success: true, synced: totalSynced, errors: totalErrors, duration: Date.now() - startTime });
  } catch (err) {
    await query(`INSERT INTO sync_log (sync_type, records_synced, errors, status, error_message) VALUES ('leads', $1, $2, 'error', $3)`,
      [totalSynced, totalErrors, err.message]).catch(() => {});
    res.status(500).json({ error: err.message, synced: totalSynced });
  }
});

// ─── Sync: Developers ─────────────────────────────────────────────────────────

router.post('/sync/developers', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  let totalSynced = 0;

  try {
    const data = await pixxiFetch('/pixxiapi/v1/developer/list', { method: 'POST', body: JSON.stringify({}) });
    const _d = data?.data; const items = Array.isArray(_d) ? _d : (_d?.list || _d?.content || (Array.isArray(data) ? data : []));

    for (const dev of items) {
      try {
        const name = dev.name || dev.developerName || '';
        const logo = dev.logo || dev.logoUrl || dev.developerLogo || '';

        const existing = await query(`SELECT id FROM developers WHERE name = $1 LIMIT 1`, [name]);
        if (!existing.rows.length && name) {
          await query(`INSERT INTO developers (name, logo_url, status) VALUES ($1, $2, 'active')
`, [name, logo]);
        }
        totalSynced++;
      } catch (e) { /* skip */ }
    }

    await query(`UPDATE pixxi_config SET last_developers_sync = datetime('now'), updated_at = datetime('now') WHERE id = (SELECT id FROM pixxi_config LIMIT 1)`);
    await query(`INSERT INTO sync_log (sync_type, records_synced, errors, status) VALUES ('developers', $1, 0, 'success')`, [totalSynced]);

    res.json({ success: true, synced: totalSynced, errors: 0, duration: Date.now() - startTime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sync: Agents ─────────────────────────────────────────────────────────────

router.post('/sync/agents', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  let totalSynced = 0;

  try {
    const data = await pixxiFetch('/pixxiapi/v1/agent/list');
    const _d = data?.data; const items = Array.isArray(_d) ? _d : (_d?.list || _d?.content || (Array.isArray(data) ? data : []));

    for (const agent of items) {
      try {
        // Store agents as users if they don't exist
        const name = agent.name || agent.agentName || '';
        const email = agent.email || '';
        const phone = agent.phone || agent.mobile || '';

        if (email) {
          const existing = await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
          if (!existing.rows.length) {
            await query(`INSERT INTO users (name, email, phone, role, status) VALUES ($1,$2,$3,'agent','active')
`, [name, email, phone]);
          }
        }
        totalSynced++;
      } catch (e) { /* skip */ }
    }

    await query(`UPDATE pixxi_config SET last_agents_sync = datetime('now'), updated_at = datetime('now') WHERE id = (SELECT id FROM pixxi_config LIMIT 1)`);
    await query(`INSERT INTO sync_log (sync_type, records_synced, errors, status) VALUES ('agents', $1, 0, 'success')`, [totalSynced]);

    res.json({ success: true, synced: totalSynced, errors: 0, duration: Date.now() - startTime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sync All ─────────────────────────────────────────────────────────────────

router.post('/sync/all', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const results = {};

  const doSync = async (type, url, opts) => {
    try {
      const r = await fetch(`http://localhost:${process.env.PORT || 3001}/api/pixxi/sync/${type}`, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json',
        },
      });
      results[type] = await r.json();
    } catch (err) {
      results[type] = { error: err.message, synced: 0 };
    }
  };

  await doSync('properties');
  await doSync('leads');
  await doSync('developers');
  await doSync('agents');

  res.json({
    success: true,
    duration: Date.now() - startTime,
    results,
  });
});

// ─── Webhook: Setup ───────────────────────────────────────────────────────────

router.post('/webhook/setup', authenticateToken, async (req, res) => {
  const callbackUrl = 'https://crm.astraterra.ae/api/pixxi/webhook/receive';
  const events = ['ADD_LEADS', 'UPDATE_LEADS', 'ADD_LISTINGS', 'UPDATE_LISTINGS'];
  const results = [];

  for (const event of events) {
    try {
      const data = await pixxiFetch('/pixxiapi/webhook/v1/subscribe', {
        method: 'POST',
        body: JSON.stringify({ event, callbackUrl }),
      });
      results.push({ event, success: true, data });
    } catch (err) {
      results.push({ event, success: false, error: err.message });
    }
  }

  const allOk = results.every(r => r.success);
  await query(`UPDATE pixxi_config SET webhook_subscribed = $1, updated_at = datetime('now') WHERE id = (SELECT id FROM pixxi_config LIMIT 1)`,
    [allOk ? 1 : 0]);

  res.json({ success: allOk, results });
});

// ─── Webhook: Receive (PUBLIC — no auth) ──────────────────────────────────────

router.post('/webhook/receive', async (req, res) => {
  try {
    const { event, data } = req.body;
    console.log(`[Pixxi Webhook] Received event: ${event}`);

    if (event === 'ADD_LEADS' || event === 'UPDATE_LEADS') {
      const leads = Array.isArray(data) ? data : [data];
      for (const lead of leads) {
        if (!lead) continue;
        const leadId = lead.id || lead.leadId;
        const name = lead.name || lead.clientName || '';
        const phone = lead.phone || lead.mobile || '';
        const email = lead.email || '';
        const status = lead.status || 'new';
        const source = 'pixxi_webhook';

        try {
          await query(`
            INSERT INTO pixxi_leads (pixxi_id, name, phone, email, status, source, synced_at)
            VALUES ($1,$2,$3,$4,$5,$6,datetime('now'))
            ON CONFLICT(pixxi_id) DO UPDATE SET
              name=$2, phone=$3, email=$4, status=$5, synced_at=datetime('now')
          `, [leadId, name, phone, email, status, source]);

          // Upsert main contacts
          const existing = await query(`SELECT id FROM contacts WHERE pixxi_id = $1 LIMIT 1`, [leadId]);
          if (existing.rows.length) {
            await query(`UPDATE contacts SET name=$1, phone=$2, email=$3, status=$4 WHERE pixxi_id=$5`,
              [name, phone, email, 'new', leadId]);
          } else {
            await query(`INSERT INTO contacts (name, phone, email, type, source, status, pixxi_id) VALUES ($1,$2,$3,'buyer',$4,'new',$5)`,
              [name, phone, email, source, leadId]);
          }
        } catch (e) { console.error('Webhook lead upsert error:', e.message); }
      }
    }

    if (event === 'ADD_LISTINGS' || event === 'UPDATE_LISTINGS') {
      const listings = Array.isArray(data) ? data : [data];
      for (const prop of listings) {
        if (!prop) continue;
        try {
          const photos = JSON.stringify(prop.photos || []);
          const amenities = JSON.stringify(prop.amenities || []);
          const propertyType = Array.isArray(prop.propertyType) ? prop.propertyType.join(',') : (prop.propertyType || '');

          await query(`
            INSERT INTO pixxi_properties (pixxi_id, pixxi_property_id, title, listing_type, property_type, price, bedrooms, photos, status, synced_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,datetime('now'))
            ON CONFLICT(pixxi_id) DO UPDATE SET
              title=$3, price=$6, status=$9, synced_at=datetime('now')
          `, [prop.id, prop.propertyId, prop.title, prop.listingType, propertyType, prop.price, prop.bedRooms, photos, prop.status]);
        } catch (e) { console.error('Webhook property upsert error:', e.message); }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook receive error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Webhook: Subscriptions ───────────────────────────────────────────────────

router.get('/webhook/subscriptions', authenticateToken, async (req, res) => {
  try {
    const data = await pixxiFetch('/pixxiapi/webhook/v1/subscription/list');
    res.json({ success: true, subscriptions: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Webhook: Unsubscribe ─────────────────────────────────────────────────────

router.post('/webhook/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const { event } = req.body;
    const data = await pixxiFetch('/pixxiapi/webhook/v1/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ event }),
    });
    await query(`UPDATE pixxi_config SET webhook_subscribed = 0, updated_at = datetime('now') WHERE id = (SELECT id FROM pixxi_config LIMIT 1)`);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Agents list (for test connection) ───────────────────────────────────────

router.get('/agent/list', authenticateToken, async (req, res) => {
  try {
    const data = await pixxiFetch('/pixxiapi/v1/agent/list');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
