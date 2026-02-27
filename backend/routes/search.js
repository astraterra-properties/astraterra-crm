/**
 * Global Search Route — Astraterra CRM
 * Search across contacts, properties, and deals
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken: auth } = require('../middleware/auth');

// GET /api/search?q=query — Search across all entities
router.get('/', auth, async (req, res) => {
  const { q, limit = 5 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.json({ results: { leads: [], contacts: [], properties: [], deals: [] }, all: [] });
  }

  const term = `%${q.trim()}%`;
  const lim = Math.min(parseInt(limit) || 5, 20);

  try {
    const [contacts, properties] = await Promise.all([
      pool.query(
        `SELECT id, name, email, phone, type, status 
         FROM contacts 
         WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?
         LIMIT ?`,
        [term, term, term, lim]
      ),
      pool.query(
        `SELECT id, title, type, location, status, price 
         FROM properties 
         WHERE title LIKE ? OR location LIKE ? OR type LIKE ?
         LIMIT ?`,
        [term, term, term, lim]
      ),
    ]);

    const formatContacts = (contacts.rows || []).map((c) => ({
      id: c.id,
      type: 'contact',
      title: c.name || c.phone || `Contact #${c.id}`,
      subtitle: [c.phone, c.email].filter(Boolean).join(' · ') || '',
      badge: c.type || 'contact',
      url: `/contacts/${c.id}`,
    }));

    const formatProperties = (properties.rows || []).map((p) => ({
      id: p.id,
      type: 'property',
      title: p.title || 'Property',
      subtitle: `${p.location || ''} — AED ${p.price ? Number(p.price).toLocaleString() : 'TBD'}`,
      badge: p.status || 'available',
      url: `/properties/${p.id}`,
    }));

    const allResults = [...formatContacts, ...formatProperties];

    res.json({
      query: q,
      total: allResults.length,
      results: {
        contacts: formatContacts,
        properties: formatProperties,
      },
      all: allResults,
    });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

module.exports = router;
