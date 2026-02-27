/**
 * Commissions API Routes
 * Manage agent commissions and payouts
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireMinRole } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/commissions - Get all commissions
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, agent_id, status, deal_id } = req.query;
    const offset = (page - 1) * limit;
    
    let conditions = [];
    let params = [];
    
    if (agent_id) {
      conditions.push('c.agent_id = ?');
      params.push(agent_id);
    }
    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }
    if (deal_id) {
      conditions.push('c.deal_id = ?');
      params.push(deal_id);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const commissions = await query(`
      SELECT 
        c.*,
        u.name as agent_name,
        u.email as agent_email,
        d.deal_value,
        p.property_id,
        p.title as property_title,
        co.name as contact_name
      FROM commissions c
      LEFT JOIN users u ON c.agent_id = u.id
      LEFT JOIN deals d ON c.deal_id = d.id
      LEFT JOIN properties p ON d.property_id = p.id
      LEFT JOIN contacts co ON d.contact_id = co.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const total = await query(`SELECT COUNT(*) as count FROM commissions c ${whereClause}`, params);

    res.json({
      success: true,
      data: commissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total[0].count,
        pages: Math.ceil(total[0].count / limit)
      }
    });

  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch commissions', error: error.message });
  }
});

// GET /api/commissions/stats - Commission statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_commissions,
        SUM(commission_amount) as total_amount,
        SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as paid_amount
      FROM commissions
    `);

    const byAgent = await query(`
      SELECT 
        u.name as agent_name,
        COUNT(*) as count,
        SUM(c.commission_amount) as total_earned
      FROM commissions c
      LEFT JOIN users u ON c.agent_id = u.id
      WHERE c.status = 'paid'
      GROUP BY c.agent_id
      ORDER BY total_earned DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        top_agents: byAgent
      }
    });

  } catch (error) {
    console.error('Get commission stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
  }
});

// POST /api/commissions - Create commission (admin+)
router.post('/', requireMinRole('admin'), async (req, res) => {
  try {
    const { deal_id, agent_id, commission_amount, commission_percentage, notes } = req.body;

    if (!deal_id || !agent_id || !commission_amount) {
      return res.status(400).json({ success: false, message: 'Deal ID, Agent ID, and Amount are required' });
    }

    const result = await query(`
      INSERT INTO commissions (deal_id, agent_id, commission_amount, commission_percentage, notes, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [deal_id, agent_id, commission_amount, commission_percentage, notes]);

    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, details)
      VALUES (?, 'commission', ?, 'created', ?)
    `, [req.user.id, result.lastID, JSON.stringify({ commission_amount })]);

    res.status(201).json({ success: true, message: 'Commission created', data: { id: result.lastID } });

  } catch (error) {
    console.error('Create commission error:', error);
    res.status(500).json({ success: false, message: 'Failed to create commission', error: error.message });
  }
});

// PUT /api/commissions/:id - Update commission (admin+)
router.put('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paid_date, payment_method, notes } = req.body;

    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (paid_date !== undefined) {
      updates.push('paid_date = ?');
      params.push(paid_date);
    }
    if (payment_method !== undefined) {
      updates.push('payment_method = ?');
      params.push(payment_method);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await query(`UPDATE commissions SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Commission updated' });

  } catch (error) {
    console.error('Update commission error:', error);
    res.status(500).json({ success: false, message: 'Failed to update commission', error: error.message });
  }
});

// DELETE /api/commissions/:id - Delete commission (owner only)
router.delete('/:id', requireMinRole('owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM commissions WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Commission not found' });
    }
    res.json({ success: true, message: 'Commission deleted' });
  } catch (error) {
    console.error('Delete commission error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete commission', error: error.message });
  }
});

module.exports = router;
