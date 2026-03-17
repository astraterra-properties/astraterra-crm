/**
 * Developers API Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireMinRole } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/developers
router.get('/', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 100 } = req.query;
    let q = 'SELECT * FROM developers WHERE 1=1';
    const params = [];
    let p = 1;

    if (status) { q += ` AND status = $${p}`; params.push(status); p++; }
    if (search) { q += ` AND name LIKE $${p}`; params.push(`%${search}%`); p++; }

    const offset = (page - 1) * limit;
    q += ` ORDER BY name ASC LIMIT $${p} OFFSET $${p+1}`;
    params.push(limit, offset);

    const result = await query(q, params);
    const countResult = await query('SELECT COUNT(*) as count FROM developers');
    
    res.json({ developers: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch developers' });
  }
});

// GET /api/developers/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM developers WHERE id = ?', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch developer' });
  }
});

// POST /api/developers
router.post('/', requireMinRole('admin'), async (req, res) => {
  try {
    const { name, logo_url, website, phone, email, address, description, established_year, status = 'active' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await query(`
      INSERT INTO developers (name, logo_url, website, phone, email, address, description, established_year, status)
      VALUES (?,?,?,?,?,?,?,?,?)
      RETURNING *
    `, [name, logo_url, website, phone, email, address, description, established_year, status]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create developer' });
  }
});

// PUT /api/developers/:id
router.put('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const fields = ['name', 'logo_url', 'website', 'phone', 'email', 'address', 'description', 'established_year', 'projects_count', 'status'];
    const updates = [];
    const values = [];
    let p = 1;

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${p}`);
        values.push(req.body[f]);
        p++;
      }
    });

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push(`updated_at = datetime('now')`);
    values.push(req.params.id);

    const result = await query(`UPDATE developers SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update developer' });
  }
});

// DELETE /api/developers/:id
router.delete('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const result = await query('DELETE FROM developers WHERE id = ? RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete developer' });
  }
});

module.exports = router;
