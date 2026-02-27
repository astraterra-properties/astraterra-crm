/**
 * Leads API Routes
 * Complete CRUD operations for lead management with pipeline stages
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireRole, requireMinRole } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/leads
 * Get all leads with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      assigned_to, 
      search,
      pipeline_stage,
      lead_type,
      view,
      page = 1, 
      limit = 50 
    } = req.query;

    let queryText = `
      SELECT 
        l.*,
        c.name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email,
        c.budget_min,
        c.budget_max,
        c.property_type,
        c.location_preference,
        u.name as assigned_to_name
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 1;

    // Agent role: restrict to own leads only
    if (req.user.role === 'agent') {
      queryText += ` AND l.assigned_to = $${paramCount}`;
      queryParams.push(req.user.id);
      paramCount++;
    }

    // Filters
    if (status) {
      queryText += ` AND l.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }

    if (priority) {
      queryText += ` AND l.priority = $${paramCount}`;
      queryParams.push(priority);
      paramCount++;
    }

    if (assigned_to) {
      queryText += ` AND l.assigned_to = $${paramCount}`;
      queryParams.push(assigned_to);
      paramCount++;
    }

    if (pipeline_stage) {
      queryText += ` AND l.pipeline_stage = $${paramCount}`;
      queryParams.push(pipeline_stage);
      paramCount++;
    }

    if (lead_type) {
      queryText += ` AND l.lead_type = $${paramCount}`;
      queryParams.push(lead_type);
      paramCount++;
    }

    if (search) {
      queryText += ` AND (
        c.name LIKE $${paramCount} OR 
        c.phone LIKE $${paramCount} OR 
        c.email LIKE $${paramCount} OR
        l.notes LIKE $${paramCount}
      )`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    // If kanban view, return grouped by pipeline stage
    if (view === 'kanban') {
      queryText += ` ORDER BY l.created_at DESC`;
      const result = await query(queryText, queryParams);
      
      const stages = ['new_lead', 'contacted', 'qualified', 'site_visit', 'offer_made', 'negotiation', 'deal_closed', 'lost'];
      const grouped = {};
      stages.forEach(s => { grouped[s] = []; });
      
      result.rows.forEach(lead => {
        const stage = lead.pipeline_stage || 'new_lead';
        const normalized = {
          ...lead,
          name: lead.name || lead.contact_name || 'Unknown',
          phone: lead.phone || lead.contact_phone || '',
          email: lead.email || lead.contact_email || '',
        };
        if (grouped[stage]) {
          grouped[stage].push(normalized);
        } else {
          grouped['new_lead'].push(normalized);
        }
      });
      
      return res.json({ kanban: grouped });
    }

    // Pagination
    const offset = (page - 1) * limit;
    queryText += ` ORDER BY l.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);

    // Normalize field names
    const normalized = result.rows.map(l => ({
      ...l,
      name: l.name || l.contact_name || 'Unknown',
      phone: l.phone || l.contact_phone || '',
      email: l.email || l.contact_email || '',
    }));

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM leads l LEFT JOIN contacts c ON l.contact_id = c.id WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND l.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (pipeline_stage) {
      countQuery += ` AND l.pipeline_stage = $${countParamIndex}`;
      countParams.push(pipeline_stage);
      countParamIndex++;
    }

    if (lead_type) {
      countQuery += ` AND l.lead_type = $${countParamIndex}`;
      countParams.push(lead_type);
      countParamIndex++;
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      leads: normalized,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/**
 * GET /api/leads/stats/overview
 * Get lead statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { assigned_to } = req.query;

    let whereClause = '';
    const params = [];

    if (assigned_to) {
      whereClause = 'WHERE assigned_to = ?';
      params.push(assigned_to);
    }

    const result = await query(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'not_contacted' THEN 1 END) as not_contacted,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified,
        COUNT(CASE WHEN status = 'hot' THEN 1 END) as hot,
        COUNT(CASE WHEN status = 'viewing_scheduled' THEN 1 END) as viewing_scheduled,
        COUNT(CASE WHEN status = 'deal_won' THEN 1 END) as won,
        COUNT(CASE WHEN status = 'deal_lost' THEN 1 END) as lost,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent,
        AVG(score) as avg_score
      FROM leads
      ${whereClause}
    `, params);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead statistics' });
  }
});

/**
 * GET /api/leads/:id
 * Get single lead by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        l.*,
        c.name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email,
        c.budget_min,
        c.budget_max,
        c.property_type,
        c.location_preference,
        u.name as assigned_to_name,
        u.email as assigned_to_email
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = result.rows[0];
    res.json({
      ...lead,
      name: lead.name || lead.contact_name || 'Unknown',
      phone: lead.phone || lead.contact_phone || '',
      email: lead.email || lead.contact_email || '',
    });
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

/**
 * POST /api/leads
 * Create new lead
 */
router.post('/', async (req, res) => {
  try {
    const {
      contact_id,
      status = 'not_contacted',
      priority = 'medium',
      assigned_to,
      budget,
      requirements,
      notes,
      source,
      source_url,
      next_follow_up,
      pipeline_stage = 'new_lead',
      lead_type = 'buyer',
      tags = '[]',
      source_channel,
      whatsapp_number,
      next_followup_date,
    } = req.body;

    // Validate required fields
    if (!contact_id) {
      return res.status(400).json({ error: 'contact_id is required' });
    }

    const result = await query(`
      INSERT INTO leads (
        contact_id, status, priority, assigned_to, budget,
        requirements, notes, source, source_url, next_follow_up,
        score, pipeline_stage, lead_type, tags, source_channel,
        whatsapp_number, next_followup_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      contact_id,
      status,
      priority,
      assigned_to || req.user.id,
      budget,
      requirements,
      notes,
      source,
      source_url,
      next_follow_up,
      50, // Default score
      pipeline_stage,
      lead_type,
      tags,
      source_channel,
      whatsapp_number,
      next_followup_date,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

/**
 * PUT /api/leads/:id
 * Update lead
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      priority,
      assigned_to,
      budget,
      requirements,
      notes,
      next_follow_up,
      score,
      pipeline_stage,
      lead_type,
      tags,
      source_channel,
      whatsapp_number,
      last_activity,
      next_followup_date,
    } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (priority !== undefined) {
      updates.push(`priority = $${paramCount}`);
      values.push(priority);
      paramCount++;
    }

    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramCount}`);
      values.push(assigned_to);
      paramCount++;
    }

    if (budget !== undefined) {
      updates.push(`budget = $${paramCount}`);
      values.push(budget);
      paramCount++;
    }

    if (requirements !== undefined) {
      updates.push(`requirements = $${paramCount}`);
      values.push(requirements);
      paramCount++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramCount}`);
      values.push(notes);
      paramCount++;
    }

    if (next_follow_up !== undefined) {
      updates.push(`next_follow_up = $${paramCount}`);
      values.push(next_follow_up);
      paramCount++;
    }

    if (score !== undefined) {
      updates.push(`score = $${paramCount}`);
      values.push(score);
      paramCount++;
    }

    if (pipeline_stage !== undefined) {
      updates.push(`pipeline_stage = $${paramCount}`);
      values.push(pipeline_stage);
      paramCount++;
    }

    if (lead_type !== undefined) {
      updates.push(`lead_type = $${paramCount}`);
      values.push(lead_type);
      paramCount++;
    }

    if (tags !== undefined) {
      updates.push(`tags = $${paramCount}`);
      values.push(tags);
      paramCount++;
    }

    if (source_channel !== undefined) {
      updates.push(`source_channel = $${paramCount}`);
      values.push(source_channel);
      paramCount++;
    }

    if (whatsapp_number !== undefined) {
      updates.push(`whatsapp_number = $${paramCount}`);
      values.push(whatsapp_number);
      paramCount++;
    }

    if (last_activity !== undefined) {
      updates.push(`last_activity = $${paramCount}`);
      values.push(last_activity);
      paramCount++;
    }

    if (next_followup_date !== undefined) {
      updates.push(`next_followup_date = $${paramCount}`);
      values.push(next_followup_date);
      paramCount++;
    }

    // Update last_contact_date if status changed
    if (status) {
      updates.push(`last_contact_date = datetime('now')`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await query(`
      UPDATE leads
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

/**
 * DELETE /api/leads/:id
 * Delete lead
 */
router.delete('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

/**
 * POST /api/leads/bulk-update
 * Bulk update multiple leads
 */
router.post('/bulk-update', async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'updates object is required' });
    }

    // Build SET clause dynamically from allowed fields
    const allowedFields = ['status', 'pipeline_stage', 'priority', 'assigned_to', 'lead_type'];
    const setClauses = [];
    const params = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIdx}`);
        params.push(updates[field]);
        paramIdx++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = datetime('now')`);

    // Build placeholders for ids
    const idPlaceholders = ids.map((_, i) => `$${paramIdx + i}`).join(',');
    params.push(...ids);

    const result = await query(
      `UPDATE leads SET ${setClauses.join(', ')} WHERE id IN (${idPlaceholders}) RETURNING id`,
      params
    );

    res.json({
      message: `${result.rows.length} leads updated successfully`,
      updated_ids: result.rows.map(r => r.id)
    });
  } catch (error) {
    console.error('Error bulk updating leads:', error);
    res.status(500).json({ error: 'Failed to bulk update leads' });
  }
});

/**
 * POST /api/leads/bulk-delete
 * Bulk delete multiple leads
 */
router.post('/bulk-delete', requireMinRole('admin'), async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const idPlaceholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(
      `DELETE FROM leads WHERE id IN (${idPlaceholders}) RETURNING id`,
      ids
    );

    res.json({
      message: `${result.rows.length} leads deleted successfully`,
      deleted_ids: result.rows.map(r => r.id)
    });
  } catch (error) {
    console.error('Error bulk deleting leads:', error);
    res.status(500).json({ error: 'Failed to bulk delete leads' });
  }
});

module.exports = router;
