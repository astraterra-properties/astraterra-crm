/**
 * Brochure Leads Route — PUBLIC (no auth required for POST)
 * Captures lead details before allowing brochure download
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// POST /api/brochure-leads — save a lead, no auth required
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, projectName, projectSlug, brochureUrl } = req.body;

    // Basic validation
    if (!name || !phone || !email) {
      return res.status(400).json({ error: 'Name, phone, and email are required' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    await query(
      `INSERT INTO brochure_leads (name, phone, email, project_name, project_slug, brochure_url, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email, projectName || '', projectSlug || '', brochureUrl || '', String(ip).slice(0, 100)]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Brochure lead error:', err.message);
    res.status(500).json({ error: 'Failed to save lead' });
  }
});

// GET /api/brochure-leads — list all leads (requires auth — for CRM internal use)
const { authenticateToken: auth } = require('../middleware/auth');
router.get('/', auth, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM brochure_leads ORDER BY created_at DESC LIMIT 500',
      []
    );
    res.json({ success: true, leads: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
