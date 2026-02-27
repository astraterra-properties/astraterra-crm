/**
 * Portal Integrations API Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireMinRole } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/portals - list all integrations
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM portal_integrations ORDER BY portal_name ASC');
    res.json({ portals: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch portals' });
  }
});

// GET /api/portals/:name/status
router.get('/:name/status', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM portal_integrations WHERE LOWER(portal_name) = LOWER($1)',
      [req.params.name]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Portal not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch portal status' });
  }
});

// POST /api/portals/:name/connect - save API credentials
router.post('/:name/connect', requireMinRole('marketing'), async (req, res) => {
  try {
    const { api_key, api_secret, account_id } = req.body;
    const portalName = req.params.name;

    // Check if portal exists
    const existing = await query(
      'SELECT * FROM portal_integrations WHERE LOWER(portal_name) = LOWER($1)',
      [portalName]
    );

    if (existing.rows.length) {
      // Update
      const result = await query(`
        UPDATE portal_integrations 
        SET api_key = $1, api_secret = $2, account_id = $3, status = 'connected', updated_at = datetime('now')
        WHERE LOWER(portal_name) = LOWER($4)
        RETURNING *
      `, [api_key, api_secret, account_id, portalName]);
      res.json({ success: true, portal: result.rows[0] });
    } else {
      // Insert
      const result = await query(`
        INSERT INTO portal_integrations (portal_name, api_key, api_secret, account_id, status)
        VALUES ($1, $2, $3, $4, 'connected')
        RETURNING *
      `, [portalName, api_key, api_secret, account_id]);
      res.json({ success: true, portal: result.rows[0] });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to connect portal' });
  }
});

// POST /api/portals/:name/sync - trigger sync
router.post('/:name/sync', requireMinRole('marketing'), async (req, res) => {
  try {
    const portalName = req.params.name;

    // Update last sync timestamp
    await query(`
      UPDATE portal_integrations 
      SET last_sync = datetime('now'), updated_at = datetime('now')
      WHERE LOWER(portal_name) = LOWER($1)
    `, [portalName]);

    res.json({
      status: 'sync_started',
      message: 'Integration ready - connect API key to activate',
      portal: portalName,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync portal' });
  }
});

// POST /api/portals/:name/disconnect
router.post('/:name/disconnect', requireMinRole('marketing'), async (req, res) => {
  try {
    const result = await query(`
      UPDATE portal_integrations 
      SET status = 'disconnected', api_key = NULL, api_secret = NULL, account_id = NULL, updated_at = datetime('now')
      WHERE LOWER(portal_name) = LOWER($1)
      RETURNING *
    `, [req.params.name]);

    if (!result.rows.length) return res.status(404).json({ error: 'Portal not found' });
    res.json({ success: true, portal: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect portal' });
  }
});

module.exports = router;
