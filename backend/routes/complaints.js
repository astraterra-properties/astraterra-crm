/**
 * Complaints API Routes
 * Handles complaints submitted via the Astraterra website contact form
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/complaints
 * Public endpoint — called from the website complaints form (no auth required)
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      propertyRef,
      nature,
      details,
      resolution,
      submittedAt,
      source,
    } = req.body;

    if (!name || !details) {
      return res.status(400).json({ success: false, error: 'Name and details are required' });
    }

    const result = await query(
      `INSERT INTO complaints
         (name, email, phone, property_ref, nature, details, resolution, submitted_at, source, status, created_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'New', datetime('now'))
       RETURNING id`,
      [
        name || '',
        email || '',
        phone || '',
        propertyRef || '',
        nature || '',
        details || '',
        resolution || '',
        submittedAt || new Date().toISOString(),
        source || 'website-complaints-form',
      ]
    );

    const id = result.rows?.[0]?.id || null;
    res.json({ success: true, id });
  } catch (err) {
    console.error('POST /api/complaints error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to save complaint' });
  }
});

/**
 * GET /api/complaints
 * Protected — CRM users only
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let queryText = `SELECT * FROM complaints`;
    const params = [];
    let paramCount = 1;

    if (status) {
      queryText += ` WHERE status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const result = await query(queryText, params);

    const countResult = await query(
      status ? `SELECT COUNT(*) as total FROM complaints WHERE status = $1` : `SELECT COUNT(*) as total FROM complaints`,
      status ? [status] : []
    );

    res.json({
      complaints: result.rows,
      total: parseInt(countResult.rows[0]?.total || 0),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('GET /api/complaints error:', err.message);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

/**
 * PATCH /api/complaints/:id/status
 * Update complaint status — CRM users only
 */
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['New', 'In Progress', 'Resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use: New, In Progress, Resolved' });
    }

    await query(
      `UPDATE complaints SET status = $1, updated_at = datetime('now') WHERE id = $2`,
      [status, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/complaints/:id/status error:', err.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

/**
 * GET /api/complaints/:id
 * Get single complaint — CRM users only
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM complaints WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Complaint not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch complaint' });
  }
});

module.exports = router;
