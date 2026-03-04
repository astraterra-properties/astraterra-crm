/**
 * Portal Integrations API Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireMinRole } = require('../middleware/auth');

// Helper: create contact + lead + notification from portal webhook
async function capturePortalLead(portalName, data) {
  const { query: q } = require('../config/database');
  // Normalize field names from different portal formats
  const name = data.name || data.lead_name || data.full_name || data.sender_name || '';
  const email = data.email || data.lead_email || data.sender_email || '';
  const phone = data.phone || data.mobile || data.lead_phone || data.contact_number || data.phone_number || '';
  const message = data.message || data.enquiry || data.comments || data.notes || '';
  const property = data.property_title || data.listing_title || data.title || data.reference || '';

  if (!name && !email && !phone) return null;

  // Upsert contact
  let contactId;
  const contactKey = email || phone;
  if (contactKey) {
    const existing = email
      ? await q(`SELECT id FROM contacts WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email])
      : await q(`SELECT id FROM contacts WHERE phone = $1 LIMIT 1`, [phone]);
    if (existing.rows.length) {
      contactId = existing.rows[0].id;
    } else {
      const c = await q(
        `INSERT INTO contacts (name, email, phone, source, status) VALUES ($1,$2,$3,$4,'active') RETURNING id`,
        [name || email.split('@')[0], email, phone, portalName]
      );
      contactId = c.rows[0].id;
    }
  } else {
    const c = await q(
      `INSERT INTO contacts (name, source, status) VALUES ($1,$2,'active') RETURNING id`,
      [name, portalName]
    );
    contactId = c.rows[0].id;
  }

  // Create lead
  const lead = await q(
    `INSERT INTO leads (contact_id, pipeline_stage, status, source, source_channel, notes)
     VALUES ($1,'new_lead','not_contacted',$2,$3,$4) RETURNING id`,
    [contactId, portalName, portalName.toLowerCase().replace(/\s+/g, '-'), property ? `Enquiry about: ${property}. ${message}` : message]
  );
  const leadId = lead.rows[0].id;

  // Increment portal counter + update status
  await q(`
    UPDATE portal_integrations
    SET leads_synced = leads_synced + 1,
        last_sync = datetime('now'),
        status = 'connected',
        updated_at = datetime('now')
    WHERE LOWER(portal_name) = LOWER($1)
  `, [portalName]);

  // Create notification
  const displayName = name || email || phone || 'Unknown';
  await q(
    `INSERT INTO notifications (type, icon, title, body, link, meta, is_read)
     VALUES ('lead', $1, $2, $3, '/pipeline', $4, 0)`,
    [
      portalName === 'Bayut' ? '🏠' : portalName === 'Dubizzle' ? '🔑' : '🌿',
      `New lead from ${portalName}`,
      `${displayName} just sent an enquiry${property ? ` about "${property}"` : ''}${message ? ` — "${message.substring(0, 80)}"` : ''}`,
      JSON.stringify({ contact_id: contactId, lead_id: leadId, source: portalName })
    ]
  ).catch(() => {});

  return { contact_id: contactId, lead_id: leadId };
}

// ─────────── PUBLIC WEBHOOK ENDPOINTS (no auth) ─────────────────────────────

// POST /api/portals/bayut/webhook
router.post('/bayut/webhook', async (req, res) => {
  try {
    const result = await capturePortalLead('Bayut', req.body);
    if (!result) return res.status(400).json({ error: 'Insufficient lead data' });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Bayut webhook error:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

// POST /api/portals/dubizzle/webhook
router.post('/dubizzle/webhook', async (req, res) => {
  try {
    const result = await capturePortalLead('Dubizzle', req.body);
    if (!result) return res.status(400).json({ error: 'Insufficient lead data' });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Dubizzle webhook error:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

// POST /api/portals/property-finder/webhook
router.post('/property-finder/webhook', async (req, res) => {
  try {
    // Property Finder wraps leads in a "lead" object sometimes
    const data = req.body.lead || req.body;
    const result = await capturePortalLead('Property Finder', data);
    if (!result) return res.status(400).json({ error: 'Insufficient lead data' });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Property Finder webhook error:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

// POST /api/portals/website/increment — no auth (called by website on inbound lead)
router.post('/website/increment', async (req, res) => {
  try {
    await query(`
      UPDATE portal_integrations
      SET leads_synced = leads_synced + 1,
          last_sync = datetime('now'),
          status = 'connected',
          updated_at = datetime('now')
      WHERE LOWER(portal_name) = 'website'
    `);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to increment' });
  }
});

router.use(authenticateToken);

// GET /api/portals - list all integrations
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM portal_integrations ORDER BY portal_name ASC');
    res.json({ portals: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch portals' });
  }
});

// GET /api/portals/:name/status
router.get('/:name/status', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM portal_integrations WHERE LOWER(portal_name) = LOWER($1)',
      [req.params.name]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Portal not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch portal status' });
  }
});

// POST /api/portals/:name/connect - save API credentials
router.post('/:name/connect', requireMinRole('admin'), async (req, res) => {
  try {
    const { api_key, api_secret, account_id } = req.body;
    const portalName = req.params.name;

    // Check if portal exists
    const existing = await query(
      'SELECT * FROM portal_integrations WHERE LOWER(portal_name) = LOWER($1)',
      [portalName]
    );

    if (existing.rows.length) {
      // Update
      const result = await query(`
        UPDATE portal_integrations 
        SET api_key = $1, api_secret = $2, account_id = $3, status = 'connected', updated_at = datetime('now')
        WHERE LOWER(portal_name) = LOWER($4)
        RETURNING *
      `, [api_key, api_secret, account_id, portalName]);
      res.json({ success: true, portal: result.rows[0] });
    } else {
      // Insert
      const result = await query(`
        INSERT INTO portal_integrations (portal_name, api_key, api_secret, account_id, status)
        VALUES ($1, $2, $3, $4, 'connected')
        RETURNING *
      `, [portalName, api_key, api_secret, account_id]);
      res.json({ success: true, portal: result.rows[0] });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to connect portal' });
  }
});

// POST /api/portals/:name/sync - trigger sync
router.post('/:name/sync', requireMinRole('admin'), async (req, res) => {
  try {
    const portalName = req.params.name;

    // Update last sync timestamp
    await query(`
      UPDATE portal_integrations 
      SET last_sync = datetime('now'), updated_at = datetime('now')
      WHERE LOWER(portal_name) = LOWER($1)
    `, [portalName]);

    res.json({
      status: 'sync_started',
      message: 'Integration ready - connect API key to activate',
      portal: portalName,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync portal' });
  }
});

// POST /api/portals/:name/disconnect
router.post('/:name/disconnect', requireMinRole('admin'), async (req, res) => {
  try {
    const result = await query(`
      UPDATE portal_integrations 
      SET status = 'disconnected', api_key = NULL, api_secret = NULL, account_id = NULL, updated_at = datetime('now')
      WHERE LOWER(portal_name) = LOWER($1)
      RETURNING *
    `, [req.params.name]);

    if (!result.rows.length) return res.status(404).json({ error: 'Portal not found' });
    res.json({ success: true, portal: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect portal' });
  }
});

// POST /api/portals/website/sync — refresh leads count from actual DB
router.post('/website/sync', async (req, res) => {
  try {
    await query(`
      UPDATE portal_integrations
      SET leads_synced = (
        SELECT COUNT(*) FROM leads
        WHERE source = 'Website' OR source = 'Newsletter Signup'
          OR source = 'AstraEstimate' OR source = 'Contact Form'
          OR source = 'Valuation Tool' OR source_channel = 'website'
      ),
          last_sync = datetime('now'),
          updated_at = datetime('now')
      WHERE LOWER(portal_name) = 'website'
    `);
    const result = await query(`SELECT * FROM portal_integrations WHERE LOWER(portal_name) = 'website'`);
    res.json({ success: true, portal: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync website portal' });
  }
});

module.exports = router;
