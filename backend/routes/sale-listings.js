/**
 * Sale Listings API Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ── PUBLIC endpoints (no auth) ────────────────────────────────────────────────

// GET /api/sale-listings/public — available listings for website
router.get('/public', async (req, res) => {
  try {
    const { property_type, community, bedrooms, min_price, max_price, featured, page = 1, limit = 50 } = req.query;
    let q = 'SELECT sl.*, u.name as agent_name FROM sale_listings sl LEFT JOIN users u ON sl.agent_id = u.id WHERE sl.status = \'available\'';
    const params = [];
    let p = 1;

    if (property_type) { q += ` AND sl.property_type = $${p}`; params.push(property_type); p++; }
    if (community) { q += ` AND sl.community LIKE $${p}`; params.push(`%${community}%`); p++; }
    if (bedrooms !== undefined && bedrooms !== '') { q += ` AND sl.bedrooms = $${p}`; params.push(parseInt(bedrooms)); p++; }
    if (min_price) { q += ` AND sl.price >= $${p}`; params.push(parseInt(min_price)); p++; }
    if (max_price) { q += ` AND sl.price <= $${p}`; params.push(parseInt(max_price)); p++; }
    if (featured) { q += ` AND sl.featured = 1`; }

    const offset = (page - 1) * limit;
    q += ` ORDER BY sl.featured DESC, sl.created_at DESC LIMIT $${p} OFFSET $${p+1}`;
    params.push(parseInt(limit), offset);

    const result = await query(q, params);
    const countQ = 'SELECT COUNT(*) as count FROM sale_listings WHERE status = \'available\'';
    const countResult = await query(countQ);

    res.json({ listings: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch public sale listings' });
  }
});

// GET /api/sale-listings/public/:id — single listing for website
router.get('/public/:id', async (req, res) => {
  try {
    const result = await query('SELECT sl.*, u.name as agent_name FROM sale_listings sl LEFT JOIN users u ON sl.agent_id = u.id WHERE sl.id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// ── AUTHENTICATED endpoints ───────────────────────────────────────────────────
router.use(authenticateToken);

// GET /api/sale-listings
router.get('/', async (req, res) => {
  try {
    const { property_type, community, status, bedrooms, page = 1, limit = 50 } = req.query;
    let q = 'SELECT sl.*, u.name as agent_name FROM sale_listings sl LEFT JOIN users u ON sl.agent_id = u.id WHERE 1=1';
    const params = [];
    let p = 1;

    if (property_type) { q += ` AND sl.property_type = $${p}`; params.push(property_type); p++; }
    if (community) { q += ` AND sl.community LIKE $${p}`; params.push(`%${community}%`); p++; }
    if (status) { q += ` AND sl.status = $${p}`; params.push(status); p++; }
    if (bedrooms !== undefined && bedrooms !== '') { q += ` AND sl.bedrooms = $${p}`; params.push(parseInt(bedrooms)); p++; }

    const offset = (page - 1) * limit;
    q += ` ORDER BY sl.created_at DESC LIMIT $${p} OFFSET $${p+1}`;
    params.push(limit, offset);

    const result = await query(q, params);
    const countResult = await query('SELECT COUNT(*) as count FROM sale_listings');

    res.json({ listings: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sale listings' });
  }
});

// GET /api/sale-listings/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM sale_listings WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// POST /api/sale-listings
router.post('/', async (req, res) => {
  try {
    const {
      title, property_type, community_id, community, location,
      bedrooms, bathrooms, size_sqft, price, price_per_sqft,
      furnished = 'unfurnished', floor, total_floors, view,
      owner_id, agent_id, bayut_id, dubizzle_id, pf_id,
      permit_number, title_deed, images = '[]', amenities = '[]',
      description, status = 'available', featured = 0, portal_status = '{}',
      video_url = null, tour_360_url = null, owner_name, owner_contact, owner_email, agent_name
    } = req.body;

    if (!title) return res.status(400).json({ error: 'title is required' });

    const result = await query(`
      INSERT INTO sale_listings (
        title, property_type, community_id, community, location,
        bedrooms, bathrooms, size_sqft, price, price_per_sqft,
        furnished, floor, total_floors, view, owner_id, agent_id,
        bayut_id, dubizzle_id, pf_id, permit_number, title_deed,
        images, amenities, description, status, featured, portal_status,
        video_url, tour_360_url, owner_name, owner_contact, owner_email, agent_name
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
      RETURNING *
    `, [title, property_type, community_id, community, location,
        bedrooms, bathrooms, size_sqft, price, price_per_sqft,
        furnished, floor, total_floors, view, owner_id, agent_id,
        bayut_id, dubizzle_id, pf_id, permit_number, title_deed,
        images, amenities, description, status, featured, portal_status,
        video_url, tour_360_url, owner_name, owner_contact, owner_email, agent_name]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// PUT /api/sale-listings/:id
router.put('/:id', async (req, res) => {
  try {
    const fields = ['title', 'property_type', 'community_id', 'community', 'location',
      'bedrooms', 'bathrooms', 'size_sqft', 'price', 'price_per_sqft',
      'furnished', 'floor', 'total_floors', 'view', 'owner_id', 'agent_id',
      'bayut_id', 'dubizzle_id', 'pf_id', 'permit_number', 'title_deed',
      'images', 'amenities', 'description', 'status', 'featured', 'portal_status',
      'video_url', 'tour_360_url', 'owner_name', 'owner_contact', 'owner_email', 'agent_name'];

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

    const result = await query(`UPDATE sale_listings SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// DELETE /api/sale-listings/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM sale_listings WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;
