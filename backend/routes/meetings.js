const express = require('express');
const router = express.Router();
const { query } = require('../config/database-sqlite');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

// GET /api/meetings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const { upcoming } = req.query;
    
    let sql = `
      SELECT m.*, u.name AS creator_name
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE (m.created_by = ? OR json_extract(m.attendees, '$') LIKE ?)
    `;
    const params = [uid, `%${uid}%`];
    
    if (upcoming === '1') {
      sql += ` AND m.start_time >= datetime('now') AND m.status != 'cancelled'`;
    }
    sql += ` ORDER BY m.start_time ASC`;
    
    const result = await query(sql, params);
    
    const meetings = result.rows.map(m => ({
      ...m,
      attendees: typeof m.attendees === 'string' ? JSON.parse(m.attendees || '[]') : (m.attendees || [])
    }));
    
    res.json({ meetings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get meetings' });
  }
});

// POST /api/meetings
router.post('/', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const { title, description, start_time, end_time, attendees, meeting_type, client_name, client_email, client_phone } = req.body;
    
    if (!title || !start_time) return res.status(400).json({ error: 'title and start_time required' });
    
    // Generate unique Jitsi room ID
    const roomId = `astraterra-${crypto.randomBytes(6).toString('hex')}`;
    const attendeeList = Array.isArray(attendees) ? attendees : [];
    if (!attendeeList.includes(uid)) attendeeList.unshift(uid);
    
    const result = await query(`
      INSERT INTO meetings (title, description, start_time, end_time, created_by, attendees, video_room_id, meeting_type, client_name, client_email, client_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [title, description || '', start_time, end_time || null, uid, JSON.stringify(attendeeList), roomId, meeting_type || 'internal', client_name || null, client_email || null, client_phone || null]);

    // Queue WhatsApp notifications for all attendees except the organiser
    try {
      const organiser = await query(`SELECT name FROM users WHERE id = ?`, [uid]);
      const organiserName = organiser.rows[0]?.name || 'A team member';
      const dt = new Date(start_time).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai'
      });
      const otherAttendees = attendeeList.filter(id => id !== uid);
      if (otherAttendees.length > 0) {
        const members = await query(`
          SELECT name, phone FROM users
          WHERE id IN (${otherAttendees.map(() => '?').join(',')})
          AND phone IS NOT NULL AND phone != ''
        `, otherAttendees);
        for (const m of members.rows) {
          const waMsg = `📅 *Meeting Scheduled*\n\n*${organiserName}* scheduled a meeting with you:\n\n*📌 ${title}*\n⏰ ${dt} (Dubai)\n\n🔗 View: https://crm.astraterra.ae/meetings`;
          await query(`INSERT INTO whatsapp_queue (phone, recipient_name, message, notification_type) VALUES (?, ?, ?, 'meeting')`,
            [m.phone, m.name, waMsg]);
        }
      }
    } catch (e) { console.error('Meeting notify error:', e); }
    
    res.json({ success: true, meeting_id: result.rows[0].id, video_room_id: roomId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// GET /api/meetings/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`SELECT m.*, u.name AS creator_name FROM meetings m LEFT JOIN users u ON m.created_by = u.id WHERE m.id = ?`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    const m = result.rows[0];
    m.attendees = typeof m.attendees === 'string' ? JSON.parse(m.attendees || '[]') : [];
    res.json({ meeting: m });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get meeting' });
  }
});

// PATCH /api/meetings/:id
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { status, title, description, start_time, end_time, attendees } = req.body;
    const updates = [];
    const vals = [];
    if (status) { updates.push('status = ?'); vals.push(status); }
    if (title) { updates.push('title = ?'); vals.push(title); }
    if (description !== undefined) { updates.push('description = ?'); vals.push(description); }
    if (start_time) { updates.push('start_time = ?'); vals.push(start_time); }
    if (end_time) { updates.push('end_time = ?'); vals.push(end_time); }
    if (attendees) { updates.push('attendees = ?'); vals.push(JSON.stringify(attendees)); }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    await query(`UPDATE meetings SET ${updates.join(', ')} WHERE id = ?`, vals);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

// DELETE /api/meetings/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await query(`UPDATE meetings SET status = 'cancelled' WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel meeting' });
  }
});

module.exports = router;
