/**
 * Users API Routes
 * Manage team members and user accounts
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireMinRole } = require('../middleware/auth');
const bcrypt = require('bcrypt');

router.use(authenticateToken);

// GET /api/users - Get all users (admin+)
router.get('/', requireMinRole('admin'), async (req, res) => {
  try {
    const { role, active, team_id } = req.query;
    
    let conditions = [];
    let params = [];
    
    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }
    if (active !== undefined) {
      conditions.push('active = ?');
      params.push(active === 'true' ? 1 : 0);
    }
    if (team_id) {
      conditions.push('team_id = ?');
      params.push(team_id);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const users = await query(`
      SELECT 
        id, email, name, phone, role, team_id, active, 
        created_at, last_login
      FROM users
      ${whereClause}
      ORDER BY name ASC
    `, params);

    res.json({ success: true, data: users });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
});

// GET /api/users/:id - Get single user (admin+)
router.get('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const users = await query(`
      SELECT 
        id, email, name, phone, role, team_id, active,
        created_at, last_login
      FROM users
      WHERE id = ?
    `, [id]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: users[0] });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user', error: error.message });
  }
});

// POST /api/users - Create new user (owner only)
router.post('/', requireMinRole('owner'), async (req, res) => {
  try {
    const { email, password, name, phone, role, team_id } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Email, password, and name are required' });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(`
      INSERT INTO users (email, password_hash, name, phone, role, team_id, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [email, password_hash, name, phone, role || 'agent', team_id]);

    res.status(201).json({ success: true, message: 'User created', data: { id: result.lastID } });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Failed to create user', error: error.message });
  }
});

// PUT /api/users/:id - Update user (admin+)
router.put('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const { name, phone, role, team_id, active } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    
    // Only admin can change role, team, and active status
    if (req.user.role === 'admin') {
      if (role !== undefined) {
        updates.push('role = ?');
        params.push(role);
      }
      if (team_id !== undefined) {
        updates.push('team_id = ?');
        params.push(team_id);
      }
      if (active !== undefined) {
        updates.push('active = ?');
        params.push(active ? 1 : 0);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'User updated' });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
});

// DELETE /api/users/:id - Delete user (owner only)
router.delete('/:id', requireMinRole('owner'), async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const result = await query('DELETE FROM users WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
});

// POST /api/users/:id/reset-password (owner only)
router.post('/:id/reset-password', requireMinRole('owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const result = await query('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [password_hash, id]);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password', error: error.message });
  }
});

module.exports = router;
