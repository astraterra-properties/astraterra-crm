/**
 * Public inbound lead webhook handler
 * No authentication required — for external websites and portals
 * Registered at: POST /api/leads/inbound
 */

const { query } = require('../config/database');

module.exports = async (req, res) => {
  try {
    const {
      name, phone, email, source, message,
      property_type, budget, location,
      channel = 'webhook',
    } = req.body;

    if (!phone && !email) {
      return res.status(400).json({ error: 'phone or email required' });
    }

    // Create or find contact
    let contact;
    const searchField = phone ? 'phone' : 'email';
    const searchValue = (phone || email || '').trim();

    const existing = await query(
      `SELECT * FROM contacts WHERE ${searchField} = ? LIMIT 1`,
      [searchValue]
    );

    if (existing.rows && existing.rows.length > 0) {
      contact = existing.rows[0];
    } else {
      const newContact = await query(`
        INSERT INTO contacts (name, phone, email, type, source, notes)
        VALUES (?, ?, ?, 'buyer', ?, ?)
      `, [name || 'Unknown', phone || null, email || null, source || channel, message || '']);
      contact = { id: newContact.lastID, name: name || 'Unknown', phone, email };
    }

    // Create lead
    const lead = await query(`
      INSERT INTO leads (contact_id, status, priority, source, notes, pipeline_stage, source_channel)
      VALUES (?, 'not_contacted', 'medium', ?, ?, 'new_lead', ?)
    `, [contact.id, source || channel, message || '', channel]);

    const leadId = lead.lastID;

    // Log activity
    query(`
      INSERT INTO lead_activity (contact_id, lead_id, channel, activity_type, description, metadata)
      VALUES (?, ?, ?, 'inbound_lead', ?, ?)
    `, [contact.id, leadId, channel, `New inbound lead from ${source || channel}`, JSON.stringify(req.body)]).catch(() => {});

    const isWebsiteLead = channel === 'website'
      || source === 'Newsletter Signup'
      || source === 'Contact Form'
      || source === 'Valuation Tool'
      || source === 'List Property Form'
      || source === 'Rent Enquiry'
      || source === 'AstraEstimate';

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

      // Create notification
      const displayName = name || email || phone || 'Unknown';
      const sourceLabel = source || channel || 'Website';
      query(`
        INSERT INTO notifications (type, icon, title, body, link, meta, is_read)
        VALUES ('lead', '🌐', ?, ?, '/pipeline', ?, 0)
      `, [
        `New lead from ${sourceLabel}`,
        `${displayName} just signed up via your website${message ? ` — "${message.substring(0, 80)}..."` : ''}`,
        JSON.stringify({ contact_id: contact.id, lead_id: leadId, source: sourceLabel }),
      ]).catch(() => {});
    }

    res.status(201).json({
      success: true,
      contact_id: contact.id,
      lead_id: leadId,
      message: 'Lead captured successfully',
    });
  } catch (err) {
    console.error('Inbound lead error:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
};
