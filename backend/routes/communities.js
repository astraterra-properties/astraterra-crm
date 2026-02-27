/**
 * Communities / Areas API Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireMinRole } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/communities
router.get('/', async (req, res) => {
  try {
    const { search, area, city, status, page = 1, limit = 100 } = req.query;
    let q = 'SELECT * FROM communities WHERE 1=1';
    const params = [];
    let p = 1;

    if (status) { q += ` AND status = $${p}`; params.push(status); p++; }
    if (area) { q += ` AND area LIKE $${p}`; params.push(`%${area}%`); p++; }
    if (city) { q += ` AND city LIKE $${p}`; params.push(`%${city}%`); p++; }
    if (search) { q += ` AND name LIKE $${p}`; params.push(`%${search}%`); p++; }

    const offset = (page - 1) * limit;
    q += ` ORDER BY name ASC LIMIT $${p} OFFSET $${p+1}`;
    params.push(limit, offset);

    const result = await query(q, params);
    const countResult = await query('SELECT COUNT(*) as count FROM communities');

    res.json({ communities: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

// GET /api/communities/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM communities WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch community' });
  }
});

// POST /api/communities
router.post('/', requireMinRole('admin'), async (req, res) => {
  try {
    const { name, area, city = 'Dubai', description, avg_price_sqft, popular_for = '[]', amenities = '[]', image_url, status = 'active' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await query(`
      INSERT INTO communities (name, area, city, description, avg_price_sqft, popular_for, amenities, image_url, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [name, area, city, description, avg_price_sqft, popular_for, amenities, image_url, status]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create community' });
  }
});

// PUT /api/communities/:id
router.put('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const fields = ['name', 'area', 'city', 'description', 'avg_price_sqft', 'popular_for', 'amenities', 'image_url', 'status'];
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

    const result = await query(`UPDATE communities SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update community' });
  }
});

// DELETE /api/communities/:id
router.delete('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const result = await query('DELETE FROM communities WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete community' });
  }
});

module.exports = router;
