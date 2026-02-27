/**
 * Contacts API Routes
 * Complete CRUD operations for contact management
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireRole, requireMinRole } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/contacts
 * Get all contacts with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { 
      type,
      status,
      assigned_to,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const pool = req.query.pool;

    let queryText = `
      SELECT 
        c.*,
        u.name as assigned_to_name,
        COUNT(l.id) as leads_count
      FROM contacts c
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN leads l ON l.contact_id = c.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 1;

    // Lead pool filter
    if (pool === 'true' || pool === '1') {
      queryText += ` AND c.lead_pool = 1`;
    }

    // Filters
    if (type) {
      queryText += ` AND c.type = $${paramCount}`;
      queryParams.push(type);
      paramCount++;
    }

    if (status) {
      queryText += ` AND c.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }

    if (assigned_to) {
      queryText += ` AND c.assigned_to = $${paramCount}`;
      queryParams.push(assigned_to);
      paramCount++;
    }

    if (search) {
      queryText += ` AND (
        c.name ILIKE $${paramCount} OR 
        c.phone ILIKE $${paramCount + 1} OR 
        c.email ILIKE $${paramCount + 2}
      )`;
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramCount += 3;
    }

    queryText += ` GROUP BY c.id, u.name`;

    // Pagination
    const offset = (page - 1) * limit;
    queryText += ` ORDER BY c.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM contacts c WHERE 1=1';
    const countParams = [];
    let countIndex = 1;

    if (pool === 'true' || pool === '1') {
      countQuery += ` AND c.lead_pool = 1`;
    }

    if (type) {
      countQuery += ` AND c.type = $${countIndex}`;
      countParams.push(type);
      countIndex++;
    }

    if (status) {
      countQuery += ` AND c.status = $${countIndex}`;
      countParams.push(status);
      countIndex++;
    }

    if (assigned_to) {
      countQuery += ` AND c.assigned_to = $${countIndex}`;
      countParams.push(assigned_to);
      countIndex++;
    }

    if (search) {
      countQuery += ` AND (c.name LIKE $${countIndex} OR c.phone LIKE $${countIndex + 1} OR c.email LIKE $${countIndex + 2})`;
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      countIndex += 3;
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      contacts: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

/**
 * GET /api/contacts/:id
 * Get single contact by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        c.*,
        u.name as assigned_to_name,
        u.email as assigned_to_email
      FROM contacts c
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Get contact's leads
    const leadsResult = await query(`
      SELECT id, status, priority, budget, created_at
      FROM leads
      WHERE contact_id = $1
      ORDER BY created_at DESC
    `, [id]);

    // Get contact's viewings
    const viewingsResult = await query(`
      SELECT 
        v.id, v.scheduled_at, v.status,
        p.title as property_title,
        p.location as property_location
      FROM viewings v
      LEFT JOIN properties p ON v.property_id = p.id
      WHERE v.contact_id = $1
      ORDER BY v.scheduled_at DESC
    `, [id]);

    const contact = result.rows[0];
    contact.leads = leadsResult.rows;
    contact.viewings = viewingsResult.rows;

    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

/**
 * POST /api/contacts
 * Create new contact
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      type = 'buyer',
      location_preference,
      budget_min,
      budget_max,
      property_type,
      bedrooms,
      purpose,
      timeline,
      must_haves,
      nice_to_haves,
      source,
      source_details,
      notes,
      tags,
      assigned_to
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!phone && !email) {
      return res.status(400).json({ error: 'Phone or email is required' });
    }

    const result = await query(`
      INSERT INTO contacts (
        name, phone, email, type, location_preference,
        budget_min, budget_max, property_type, bedrooms,
        purpose, timeline, must_haves, nice_to_haves,
        source, source_details, notes, tags, assigned_to, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      name,
      phone,
      email,
      type,
      location_preference,
      budget_min,
      budget_max,
      property_type,
      bedrooms,
      purpose,
      timeline,
      must_haves,
      nice_to_haves,
      source,
      source_details,
      notes,
      tags,
      assigned_to || req.user.id,
      'active'
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

/**
 * PUT /api/contacts/:id
 * Update contact
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramCount = 1;

    // List of updatable fields
    const fields = [
      'name', 'phone', 'email', 'type', 'location_preference',
      'budget_min', 'budget_max', 'property_type', 'bedrooms',
      'purpose', 'timeline', 'must_haves', 'nice_to_haves',
      'source', 'source_details', 'notes', 'tags', 'assigned_to', 'status'
    ];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(req.body[field]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await query(`
      UPDATE contacts
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

/**
 * DELETE /api/contacts/:id
 * Delete contact (only if no related leads/deals)
 */
router.delete('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check for related leads
    const leadsCheck = await query('SELECT COUNT(*) as count FROM leads WHERE contact_id = $1', [id]);
    if (parseInt(leadsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete contact with existing leads. Archive instead.' 
      });
    }

    const result = await query('DELETE FROM contacts WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

/**
 * POST /api/contacts/import
 * Bulk import contacts from array
 */
router.post('/import', requireMinRole('admin'), async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Invalid contacts array' });
    }

    const imported = [];
    const errors = [];

    for (const contact of contacts) {
      try {
        const result = await query(`
          INSERT INTO contacts (
            name, phone, email, type, location_preference,
            budget_min, budget_max, property_type, bedrooms,
            purpose, timeline, must_haves, nice_to_haves,
            source, notes, assigned_to, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING id
        `, [
          contact.name,
          contact.phone,
          contact.email,
          contact.type || 'buyer',
          contact.location_preference,
          contact.budget_min,
          contact.budget_max,
          contact.property_type,
          contact.bedrooms,
          contact.purpose,
          contact.timeline,
          contact.must_haves,
          contact.nice_to_haves,
          contact.source || 'google_sheets',
          contact.notes,
          contact.assigned_to || req.user.id,
          'active'
        ]);

        imported.push({ id: result.rows[0].id, name: contact.name });
      } catch (error) {
        errors.push({ name: contact.name, error: error.message });
      }
    }

    res.json({
      success: true,
      imported: imported.length,
      failed: errors.length,
      details: { imported, errors }
    });
  } catch (error) {
    console.error('Error importing contacts:', error);
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

/**
 * PUT /api/contacts/:id/assign
 * Assign a contact (lead) to an agent
 */
router.put('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { agent_name, assigned_to } = req.body;

    if (!agent_name && !assigned_to) {
      return res.status(400).json({ error: 'agent_name or assigned_to is required' });
    }

    const result = await query(`
      UPDATE contacts
      SET assigned_agent = $1, assigned_to = $2, updated_at = datetime('now')
      WHERE id = $3
      RETURNING *
    `, [agent_name || null, assigned_to || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ success: true, contact: result.rows[0] });
  } catch (error) {
    console.error('Error assigning contact:', error);
    res.status(500).json({ error: 'Failed to assign contact' });
  }
});

/**
 * GET /api/lead-pool/stats
 * Lead Pool statistics by status and source
 */
router.get('/lead-pool/stats', async (req, res) => {
  try {
    const totalResult = await query(`SELECT COUNT(*) as total FROM contacts WHERE lead_pool = 1`);
    const byStatusResult = await query(`
      SELECT lead_source_status as status, COUNT(*) as count
      FROM contacts WHERE lead_pool = 1
      GROUP BY lead_source_status ORDER BY count DESC
    `);
    const byTypeResult = await query(`
      SELECT type, COUNT(*) as count
      FROM contacts WHERE lead_pool = 1
      GROUP BY type ORDER BY count DESC
    `);
    const assignedResult = await query(`
      SELECT COUNT(*) as assigned FROM contacts WHERE lead_pool = 1 AND assigned_agent IS NOT NULL
    `);
    const unassignedResult = await query(`
      SELECT COUNT(*) as unassigned FROM contacts WHERE lead_pool = 1 AND assigned_agent IS NULL
    `);

    res.json({
      total: parseInt(totalResult.rows[0].total),
      assigned: parseInt(assignedResult.rows[0].assigned),
      unassigned: parseInt(unassignedResult.rows[0].unassigned),
      byStatus: byStatusResult.rows,
      byType: byTypeResult.rows,
    });
  } catch (error) {
    console.error('Error fetching lead pool stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead pool stats' });
  }
});

/**
 * GET /api/contacts/stats/overview
 * Get contact statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total_contacts,
        COUNT(*) FILTER (WHERE type = 'buyer') as buyers,
        COUNT(*) FILTER (WHERE type = 'seller') as sellers,
        COUNT(*) FILTER (WHERE type = 'both') as both,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'converted') as converted,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_this_month
      FROM contacts
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching contact stats:', error);
    res.status(500).json({ error: 'Failed to fetch contact statistics' });
  }
});

module.exports = router;
