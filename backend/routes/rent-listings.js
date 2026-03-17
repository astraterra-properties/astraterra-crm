/**
 * Rent Listings API Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ── PUBLIC endpoints (no auth) ────────────────────────────────────────────────

// GET /api/rent-listings/public — available rentals for website
router.get('/public', async (req, res) => {
  try {
    const { property_type, community, bedrooms, min_rent, max_rent, featured, page = 1, limit = 50 } = req.query;
    let q = 'SELECT rl.*, u.name as agent_name FROM rent_listings rl LEFT JOIN users u ON rl.agent_id = u.id WHERE rl.status = \'available\'';
    const params = [];
    let p = 1;

    if (property_type) { q += ` AND rl.property_type = $${p}`; params.push(property_type); p++; }
    if (community) { q += ` AND rl.community LIKE $${p}`; params.push(`%${community}%`); p++; }
    if (bedrooms !== undefined && bedrooms !== '') { q += ` AND rl.bedrooms = $${p}`; params.push(parseInt(bedrooms)); p++; }
    if (min_rent) { q += ` AND rl.annual_rent >= $${p}`; params.push(parseInt(min_rent)); p++; }
    if (max_rent) { q += ` AND rl.annual_rent <= $${p}`; params.push(parseInt(max_rent)); p++; }
    if (featured) { q += ` AND rl.featured = 1`; }

    const offset = (page - 1) * limit;
    q += ` ORDER BY rl.featured DESC, rl.created_at DESC LIMIT $${p} OFFSET $${p+1}`;
    params.push(parseInt(limit), offset);

    const result = await query(q, params);
    const countQ = 'SELECT COUNT(*) as count FROM rent_listings WHERE status = \'available\'';
    const countResult = await query(countQ);

    res.json({ listings: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch public rent listings' });
  }
});

// GET /api/rent-listings/public/:id — single rental for website
router.get('/public/:id', async (req, res) => {
  try {
    const result = await query('SELECT rl.*, u.name as agent_name FROM rent_listings rl LEFT JOIN users u ON rl.agent_id = u.id WHERE rl.id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// ── AUTHENTICATED endpoints ───────────────────────────────────────────────────
router.use(authenticateToken);

// GET /api/rent-listings
router.get('/', async (req, res) => {
  try {
    const { property_type, community, status, bedrooms, page = 1, limit = 50 } = req.query;
    let q = 'SELECT rl.*, u.name as agent_name FROM rent_listings rl LEFT JOIN users u ON rl.agent_id = u.id WHERE 1=1';
    const params = [];
    let p = 1;

    if (property_type) { q += ` AND rl.property_type = $${p}`; params.push(property_type); p++; }
    if (community) { q += ` AND rl.community LIKE $${p}`; params.push(`%${community}%`); p++; }
    if (status) { q += ` AND rl.status = $${p}`; params.push(status); p++; }
    if (bedrooms !== undefined && bedrooms !== '') { q += ` AND rl.bedrooms = $${p}`; params.push(parseInt(bedrooms)); p++; }

    const offset = (page - 1) * limit;
    q += ` ORDER BY rl.created_at DESC LIMIT $${p} OFFSET $${p+1}`;
    params.push(limit, offset);

    const result = await query(q, params);
    const countResult = await query('SELECT COUNT(*) as count FROM rent_listings');

    res.json({ listings: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rent listings' });
  }
});

// GET /api/rent-listings/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM rent_listings WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// POST /api/rent-listings
router.post('/', async (req, res) => {
  try {
    const {
      title, property_type, community_id, community, location,
      bedrooms, bathrooms, size_sqft, annual_rent, monthly_rent,
      security_deposit, furnished = 'unfurnished', floor, total_floors, view,
      owner_id, agent_id, bayut_id, dubizzle_id, pf_id,
      permit_number, ejari_number, images = '[]', amenities = '[]',
      description, available_from, lease_term = '1 year',
      status = 'available', featured = 0, portal_status = '{}',
      video_url = null, tour_360_url = null, owner_name, owner_contact, owner_email, agent_name, payment_terms = 'annual'
    } = req.body;

    if (!title) return res.status(400).json({ error: 'title is required' });

    const result = await query(`
      INSERT INTO rent_listings (
        title, property_type, community_id, community, location,
        bedrooms, bathrooms, size_sqft, annual_rent, monthly_rent,
        security_deposit, furnished, floor, total_floors, view,
        owner_id, agent_id, bayut_id, dubizzle_id, pf_id,
        permit_number, ejari_number, images, amenities, description,
        available_from, lease_term, status, featured, portal_status,
        video_url, tour_360_url, owner_name, owner_contact, owner_email, agent_name, payment_terms
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
      RETURNING *
    `, [title, property_type, community_id, community, location,
        bedrooms, bathrooms, size_sqft, annual_rent, monthly_rent,
        security_deposit, furnished, floor, total_floors, view,
        owner_id, agent_id, bayut_id, dubizzle_id, pf_id,
        permit_number, ejari_number, images, amenities, description,
        available_from, lease_term, status, featured, portal_status,
        video_url, tour_360_url, owner_name, owner_contact, owner_email, agent_name, payment_terms]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// PUT /api/rent-listings/:id
router.put('/:id', async (req, res) => {
  try {
    const fields = ['title', 'property_type', 'community_id', 'community', 'location',
      'bedrooms', 'bathrooms', 'size_sqft', 'annual_rent', 'monthly_rent',
      'security_deposit', 'furnished', 'floor', 'total_floors', 'view',
      'owner_id', 'agent_id', 'bayut_id', 'dubizzle_id', 'pf_id',
      'permit_number', 'ejari_number', 'images', 'amenities', 'description',
      'available_from', 'lease_term', 'status', 'featured', 'portal_status',
      'video_url', 'tour_360_url', 'owner_name', 'owner_contact', 'owner_email', 'agent_name', 'payment_terms'];

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

    const result = await query(`UPDATE rent_listings SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// DELETE /api/rent-listings/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM rent_listings WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;
