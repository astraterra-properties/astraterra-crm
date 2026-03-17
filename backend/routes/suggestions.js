/**
 * Suggestions API Routes
 * Handles feedback/suggestions submitted via the Astraterra website
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Ensure table exists on route load
(async () => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      category TEXT DEFAULT 'General Feedback',
      message TEXT NOT NULL,
      source TEXT DEFAULT 'website',
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch (e) { /* table already exists */ }
})();

/**
 * POST /api/suggestions
 * Public endpoint — called from the website suggestions form (no auth required)
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, category, message, timestamp, source } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const result = await query(
      `INSERT INTO suggestions
         (name, email, category, message, source, status, created_at)
       VALUES
         (?, ?, ?, ?, ?, 'new', datetime('now'))
       RETURNING id`,
      [
        name || '',
        email || '',
        category || 'General Feedback',
        message.trim().substring(0, 500),
        source || 'website',
      ]
    );

    const id = result.rows?.[0]?.id || null;
    res.json({ success: true, id });
  } catch (err) {
    console.error('POST /api/suggestions error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to save suggestion' });
  }
});

/**
 * GET /api/suggestions
 * Admin endpoint — list all suggestions (requires auth)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM suggestions ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ success: true, suggestions: result.rows || [] });
  } catch (err) {
    console.error('GET /api/suggestions error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch suggestions' });
  }
});

/**
 * PATCH /api/suggestions/:id
 * Admin endpoint — update suggestion status (requires auth)
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['new', 'reviewed', 'actioned'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Use: new, reviewed, actioned' });
    }

    await query(
      `UPDATE suggestions SET status = ? WHERE id = ?`,
      [status, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/suggestions error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update suggestion' });
  }
});

module.exports = router;
