/**
 * Notifications API Routes
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// All notifications routes require auth
router.use(authenticateToken);

// GET /api/notifications — get all unread + recent notifications
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM notifications
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const unreadCount = (result.rows || []).filter(n => !n.is_read).length;
    res.json({ notifications: result.rows || [], unread_count: unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/read-all — mark all as read (must be before /:id/read)
router.patch('/read-all', async (req, res) => {
  try {
    await query(`UPDATE notifications SET is_read=1, updated_at=datetime('now') WHERE is_read=0`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// PATCH /api/notifications/:id/read — mark single as read
router.patch('/:id/read', async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read=1, updated_at=datetime('now') WHERE id=?`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// DELETE /api/notifications/:id — delete a notification
router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM notifications WHERE id=?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
