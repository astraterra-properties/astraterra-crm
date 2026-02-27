/**
 * Viewings API Routes
 * Manage property viewing appointments
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/viewings
 * Get all viewings with filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      property_id,
      contact_id,
      agent_id,
      date_from,
      date_to,
      upcoming
    } = req.query;

    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];

    if (status) {
      conditions.push('v.status = ?');
      params.push(status);
    }

    if (property_id) {
      conditions.push('v.property_id = ?');
      params.push(property_id);
    }

    if (contact_id) {
      conditions.push('v.contact_id = ?');
      params.push(contact_id);
    }

    if (agent_id) {
      conditions.push('v.agent_id = ?');
      params.push(agent_id);
    }

    if (date_from) {
      conditions.push('v.scheduled_at >= ?');
      params.push(date_from);
    }

    if (date_to) {
      conditions.push('v.scheduled_at <= ?');
      params.push(date_to);
    }

    if (upcoming === 'true') {
      conditions.push('v.scheduled_at >= datetime("now")');
      conditions.push('v.status = "scheduled"');
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const viewings = await query(`
      SELECT 
        v.*,
        c.name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email,
        p.property_id,
        p.title as property_title,
        p.location as property_location,
        p.type as property_type,
        p.price as property_price,
        u.name as agent_name,
        u.email as agent_email
      FROM viewings v
      LEFT JOIN contacts c ON v.contact_id = c.id
      LEFT JOIN properties p ON v.property_id = p.id
      LEFT JOIN users u ON v.agent_id = u.id
      ${whereClause}
      ORDER BY v.scheduled_at ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const total = await query(`
      SELECT COUNT(*) as count
      FROM viewings v
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: viewings.rows || viewings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.rows?.[0]?.count || total[0]?.count || 0),
        pages: Math.ceil(parseInt(total.rows?.[0]?.count || total[0]?.count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get viewings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch viewings',
      error: error.message
    });
  }
});

/**
 * GET /api/viewings/upcoming
 * Get upcoming viewings (next 7 days)
 */
router.get('/upcoming', async (req, res) => {
  try {
    const { agent_id } = req.query;
    let conditions = ['v.scheduled_at >= datetime("now")', 'v.status = "scheduled"'];
    let params = [];

    if (agent_id) {
      conditions.push('v.agent_id = ?');
      params.push(agent_id);
    }

    const viewings = await query(`
      SELECT 
        v.*,
        c.name as contact_name,
        c.phone as contact_phone,
        p.property_id,
        p.title as property_title,
        p.location as property_location,
        u.name as agent_name
      FROM viewings v
      LEFT JOIN contacts c ON v.contact_id = c.id
      LEFT JOIN properties p ON v.property_id = p.id
      LEFT JOIN users u ON v.agent_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY v.scheduled_at ASC
      LIMIT 50
    `, params);

    res.json({
      success: true,
      data: viewings
    });

  } catch (error) {
    console.error('Get upcoming viewings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming viewings',
      error: error.message
    });
  }
});

/**
 * GET /api/viewings/stats
 * Get viewing statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_viewings,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_shows
      FROM viewings
    `);

    // Viewings by feedback
    const outcomes = await query(`
      SELECT 
        feedback as outcome,
        COUNT(*) as count
      FROM viewings
      WHERE status = 'completed' AND feedback IS NOT NULL
      GROUP BY feedback
    `);

    // This month vs last month
    const monthly = await query(`
      SELECT 
        strftime('%Y-%m', scheduled_at) as month,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM viewings
      WHERE scheduled_at >= date('now', '-2 months')
      GROUP BY month
      ORDER BY month DESC
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        by_outcome: outcomes,
        monthly_comparison: monthly
      }
    });

  } catch (error) {
    console.error('Get viewings stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch viewings statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/viewings/:id
 * Get single viewing by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const viewings = await query(`
      SELECT 
        v.*,
        c.name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email,
        p.property_id,
        p.title as property_title,
        p.location as property_location,
        p.type as property_type,
        p.price as property_price,
        p.bedrooms,
        p.bathrooms,
        u.name as agent_name,
        u.email as agent_email,
        u.phone as agent_phone
      FROM viewings v
      LEFT JOIN contacts c ON v.contact_id = c.id
      LEFT JOIN properties p ON v.property_id = p.id
      LEFT JOIN users u ON v.agent_id = u.id
      WHERE v.id = ?
    `, [id]);

    if (viewings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Viewing not found'
      });
    }

    res.json({
      success: true,
      data: viewings[0]
    });

  } catch (error) {
    console.error('Get viewing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch viewing',
      error: error.message
    });
  }
});

/**
 * POST /api/viewings
 * Create new viewing
 */
router.post('/', async (req, res) => {
  try {
    const {
      contact_id,
      property_id,
      scheduled_at,
      scheduled_time,
      agent_id,
      notes,
      reminder_sent
    } = req.body;

    // Validate required fields
    if (!contact_id || !property_id || !scheduled_at) {
      return res.status(400).json({
        success: false,
        message: 'Contact ID, Property ID, and Scheduled Date are required'
      });
    }

    const result = await query(`
      INSERT INTO viewings (
        contact_id, property_id, scheduled_at, scheduled_time,
        agent_id, notes, reminder_sent, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')
    `, [
      contact_id,
      property_id,
      scheduled_at,
      scheduled_time || '10:00',
      agent_id || req.user.id,
      notes,
      reminder_sent || 0
    ]);

    // Log activity
    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, details)
      VALUES (?, 'viewing', ?, 'created', ?)
    `, [req.user.id, result.lastID, JSON.stringify({ scheduled_at, scheduled_time })]);

    res.status(201).json({
      success: true,
      message: 'Viewing scheduled successfully',
      data: { id: result.lastID }
    });

  } catch (error) {
    console.error('Create viewing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule viewing',
      error: error.message
    });
  }
});

/**
 * PUT /api/viewings/:id
 * Update viewing
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      scheduled_at, scheduled_time,
      viewing_date, viewing_time,
      status, feedback, notes,
      agent_id, contact_id, property_id,
    } = req.body;

    const updates = [];
    const params = [];

    if (scheduled_at !== undefined) { updates.push('scheduled_at = ?'); params.push(scheduled_at); }
    if (scheduled_time !== undefined) { updates.push('scheduled_time = ?'); params.push(scheduled_time); }
    if (viewing_date !== undefined) { updates.push('viewing_date = ?'); params.push(viewing_date); }
    if (viewing_time !== undefined) { updates.push('viewing_time = ?'); params.push(viewing_time); }
    if (contact_id !== undefined) { updates.push('contact_id = ?'); params.push(contact_id); }
    if (property_id !== undefined) { updates.push('property_id = ?'); params.push(property_id); }
    if (agent_id !== undefined) { updates.push('agent_id = ?'); params.push(agent_id); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (feedback !== undefined) { updates.push('feedback = ?'); params.push(feedback); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (reminder_sent !== undefined) { updates.push('reminder_sent = ?'); params.push(reminder_sent); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await query(`
      UPDATE viewings
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Viewing not found'
      });
    }

    // Log activity
    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, details)
      VALUES (?, 'viewing', ?, 'updated', ?)
    `, [req.user.id, id, JSON.stringify(req.body)]);

    res.json({
      success: true,
      message: 'Viewing updated successfully'
    });

  } catch (error) {
    console.error('Update viewing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update viewing',
      error: error.message
    });
  }
});

/**
 * DELETE /api/viewings/:id
 * Delete viewing
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM viewings WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Viewing not found'
      });
    }

    // Log activity
    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, details)
      VALUES (?, 'viewing', ?, 'deleted', '{}')
    `, [req.user.id, id]);

    res.json({
      success: true,
      message: 'Viewing deleted successfully'
    });

  } catch (error) {
    console.error('Delete viewing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete viewing',
      error: error.message
    });
  }
});

module.exports = router;
