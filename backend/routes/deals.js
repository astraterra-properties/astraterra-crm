/**
 * Deals API Routes
 * Manage property deals, offers, and transactions
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireMinRole } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/deals
 * Get all deals with filters and pagination
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      property_id,
      contact_id,
      stage,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];

    // Agent role: restrict to own deals only
    if (req.user.role === 'agent') {
      conditions.push('d.agent_id = ?');
      params.push(req.user.id);
    }

    if (status) {
      conditions.push('d.status = ?');
      params.push(status);
    }

    if (property_id) {
      conditions.push('d.property_id = ?');
      params.push(property_id);
    }

    if (contact_id) {
      conditions.push('d.contact_id = ?');
      params.push(contact_id);
    }

    // Note: deals table uses 'status' not 'stage'
    if (stage) {
      conditions.push('d.status = ?');
      params.push(stage);
    }

    if (search) {
      conditions.push('(c.name LIKE ? OR p.title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const dealsResult = await query(`
      SELECT 
        d.*,
        c.name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email,
        p.title as property_title,
        p.location as property_location,
        p.price as property_price,
        u.name as agent_name
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN properties p ON d.property_id = p.id
      LEFT JOIN users u ON d.agent_id = u.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const totalResult = await query(`
      SELECT COUNT(*) as count
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN properties p ON d.property_id = p.id
      ${whereClause}
    `, params);

    const dealsData = dealsResult.rows || [];
    const totalCount = parseInt(totalResult.rows[0]?.count || 0);

    res.json({
      success: true,
      data: dealsData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deals',
      error: error.message
    });
  }
});

/**
 * GET /api/deals/stats
 * Get deals statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_deals,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_deals,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won_deals,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost_deals,
        SUM(CASE WHEN status = 'won' THEN deal_value ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status = 'won' THEN deal_value ELSE NULL END) as avg_deal_value
      FROM deals
    `);

    // Deals by status
    const byStage = await query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(deal_value) as total_value
      FROM deals
      GROUP BY status
    `);

    // Monthly performance
    const monthly = await query(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as deals_count,
        SUM(CASE WHEN status = 'won' THEN deal_value ELSE 0 END) as revenue
      FROM deals
      WHERE created_at >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month DESC
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        by_stage: byStage,
        monthly_performance: monthly
      }
    });

  } catch (error) {
    console.error('Get deals stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deals statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/deals/:id
 * Get single deal by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deals = await query(`
      SELECT 
        d.*,
        c.name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email,
        c.type as contact_type,
        p.property_id,
        p.title as property_title,
        p.location as property_location,
        p.price as property_price,
        p.bedrooms,
        p.bathrooms,
        p.size,
        u.name as assigned_to_name,
        u.email as assigned_to_email
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN properties p ON d.property_id = p.id
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE d.id = ?
    `, [id]);

    if (deals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
      });
    }

    // Get deal activity history
    const activity = await query(`
      SELECT *
      FROM activity_log
      WHERE entity_type = 'deal' AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [id]);

    res.json({
      success: true,
      data: {
        ...deals[0],
        activity_history: activity
      }
    });

  } catch (error) {
    console.error('Get deal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deal',
      error: error.message
    });
  }
});

/**
 * POST /api/deals
 * Create new deal
 */
router.post('/', async (req, res) => {
  try {
    const {
      contact_id,
      property_id,
      deal_value,
      stage,
      probability,
      expected_close_date,
      notes,
      assigned_to
    } = req.body;

    // Validate required fields
    if (!contact_id || !property_id || !deal_value) {
      return res.status(400).json({
        success: false,
        message: 'Contact ID, Property ID, and Deal Value are required'
      });
    }

    const result = await query(`
      INSERT INTO deals (
        contact_id, property_id, deal_value,
        expected_close_date, notes, agent_id, status
      )
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `, [
      contact_id,
      property_id,
      deal_value,
      expected_close_date || null,
      notes || null,
      assigned_to || req.user.id
    ]);

    // Log activity
    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, changes)
      VALUES (?, 'deal', ?, 'created', ?)
    `, [req.user.id, result.lastID, JSON.stringify({ deal_value })]);

    res.status(201).json({
      success: true,
      message: 'Deal created successfully',
      data: { id: result.lastID }
    });

  } catch (error) {
    console.error('Create deal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create deal',
      error: error.message
    });
  }
});

/**
 * PUT /api/deals/:id
 * Update deal
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      deal_value,
      stage,
      probability,
      expected_close_date,
      status,
      notes,
      assigned_to
    } = req.body;

    // Get current deal data
    const current = await query('SELECT * FROM deals WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
      });
    }

    const updates = [];
    const params = [];

    if (deal_value !== undefined) {
      updates.push('deal_value = ?');
      params.push(deal_value);
    }
    // Note: 'stage' is not in the schema, using 'status' instead
    if (stage !== undefined) {
      updates.push('status = ?');
      params.push(stage);
    }
    // Note: probability field not in schema, skip it
    // if (probability !== undefined) { updates.push('probability = ?'); params.push(probability); }
    if (expected_close_date !== undefined) {
      updates.push('expected_close_date = ?');
      params.push(expected_close_date);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
      
      // Auto-set close date when deal is won/lost
      if (status === 'won' || status === 'lost') {
        updates.push('close_date = ?');
        params.push(new Date().toISOString());
      }
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await query(`
      UPDATE deals
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);

    // Log activity
    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, changes)
      VALUES (?, 'deal', ?, 'updated', ?)
    `, [req.user.id, id, JSON.stringify(req.body)]);

    res.json({
      success: true,
      message: 'Deal updated successfully'
    });

  } catch (error) {
    console.error('Update deal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update deal',
      error: error.message
    });
  }
});

/**
 * DELETE /api/deals/:id
 * Delete deal (admin+)
 */
router.delete('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM deals WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
      });
    }

    // Log activity
    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, changes)
      VALUES (?, 'deal', ?, 'deleted', '{}')
    `, [req.user.id, id]);

    res.json({
      success: true,
      message: 'Deal deleted successfully'
    });

  } catch (error) {
    console.error('Delete deal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete deal',
      error: error.message
    });
  }
});

module.exports = router;
