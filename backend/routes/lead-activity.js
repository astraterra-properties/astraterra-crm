/**
 * Lead Activity Log API Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// POST /api/leads/inbound - webhook endpoint (no auth required for external webhooks)
router.post('/leads/inbound', async (req, res) => {
  try {
    const {
      name, phone, email, source, message,
      property_type, budget, location,
      channel = 'webhook'
    } = req.body;

    // Create or find contact
    let contact;

    if (phone || email) {
      const searchField = phone ? 'phone' : 'email';
      const searchValue = phone || email;
      const existing = await query(
        `SELECT * FROM contacts WHERE ${searchField} = $1 LIMIT 1`,
        [searchValue]
      );

      if (existing.rows.length) {
        contact = existing.rows[0];
      } else {
        // Create new contact
        const newContact = await query(`
          INSERT INTO contacts (name, phone, email, type, source, notes)
          VALUES ($1, $2, $3, 'buyer', $4, $5)
          RETURNING *
        `, [name || 'Unknown', phone, email, source || channel, message || '']);
        contact = newContact.rows[0];
      }
    } else {
      return res.status(400).json({ error: 'phone or email required' });
    }

    // Create lead
    const lead = await query(`
      INSERT INTO leads (contact_id, status, priority, source, notes, pipeline_stage, source_channel)
      VALUES ($1, 'not_contacted', 'medium', $2, $3, 'new_lead', $4)
      RETURNING *
    `, [contact.id, source || channel, message || '', channel]);

    // Log activity
    await query(`
      INSERT INTO lead_activity (contact_id, lead_id, channel, activity_type, description, metadata)
      VALUES ($1, $2, $3, 'inbound_lead', $4, $5)
    `, [contact.id, lead.rows[0].id, channel, `New inbound lead from ${source || channel}`, JSON.stringify(req.body)]);

    const isWebsiteLead = channel === 'website' || source === 'Newsletter Signup' || source === 'Contact Form'
        || source === 'Valuation Tool' || source === 'List Property Form'
        || source === 'Rent Enquiry' || source === 'AstraEstimate';

    if (isWebsiteLead) {
      // Increment website portal counter
      query(`
        UPDATE portal_integrations
        SET leads_synced = leads_synced + 1,
            last_sync = datetime('now'),
            status = 'connected',
            updated_at = datetime('now')
        WHERE LOWER(portal_name) = 'website'
      `).catch(() => {});

      // Create notification for the new website lead
      const displayName = name || email || phone || 'Unknown';
      const sourceLabel = source || channel || 'Website';
      query(`
        INSERT INTO notifications (type, icon, title, body, link, meta, is_read)
        VALUES ('lead', '🌐', $1, $2, '/pipeline', $3, 0)
      `, [
        `New lead from ${sourceLabel}`,
        `${displayName} just signed up via your website${message ? ` — "${message.substring(0, 80)}..."` : ''}`,
        JSON.stringify({ contact_id: contact.id, lead_id: lead.rows[0].id, source: sourceLabel })
      ]).catch(() => {});
    }

    res.status(201).json({
      success: true,
      contact_id: contact.id,
      lead_id: lead.rows[0].id,
      message: 'Lead captured successfully'
    });
  } catch (err) {
    console.error('Inbound lead error:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

// Apply auth to remaining routes
router.use(authenticateToken);

// GET /api/lead-activity/:contactId - get activity for a contact
router.get('/:contactId', async (req, res) => {
  try {
    const result = await query(`
      SELECT la.*, u.name as created_by_name
      FROM lead_activity la
      LEFT JOIN users u ON la.created_by = u.id
      WHERE la.contact_id = $1
      ORDER BY la.created_at DESC
      LIMIT 100
    `, [req.params.contactId]);

    res.json({ activities: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// POST /api/lead-activity - log new activity
router.post('/', async (req, res) => {
  try {
    const { contact_id, lead_id, channel, activity_type, description, metadata = '{}' } = req.body;

    if (!contact_id && !lead_id) {
      return res.status(400).json({ error: 'contact_id or lead_id required' });
    }

    const metadataStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

    const result = await query(`
      INSERT INTO lead_activity (contact_id, lead_id, channel, activity_type, description, metadata, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [contact_id, lead_id, channel, activity_type, description, metadataStr, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

module.exports = router;
