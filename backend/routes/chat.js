const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const FormData = require('form-data');
const fetch = require('node-fetch');
const { query, db } = require('../config/database-sqlite');
const { authenticateToken } = require('../middleware/auth');

// Cloudinary credentials
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || 'dumt7udjd';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '714597318371755';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'fJX-95cOy2jkNd-8jz81d6leDZU';

// Multer for file uploads
const upload = multer({ dest: '/tmp/crm-chat-uploads/' });

// Helper: upload to Cloudinary (raw for docs, image for images)
async function uploadToCloudinary(filePath, originalName, folder, resourceType = 'raw') {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(paramsToSign + CLOUDINARY_API_SECRET).digest('hex');

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), { filename: originalName });
  form.append('folder', folder);
  form.append('timestamp', String(timestamp));
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('signature', signature);

  const endpoint = resourceType === 'image' ? 'image/upload' : 'raw/upload';
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${endpoint}`, {
    method: 'POST', body: form
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
  return data;
}

// Helper: build the enriched message query
const MESSAGE_QUERY = `
  SELECT cm.*,
    u.name AS sender_name, u.avatar_url AS sender_avatar, u.role AS sender_role,
    rm.message AS reply_to_message, rm.sender_id AS reply_to_sender_id,
    ru.name AS reply_to_sender_name,
    (SELECT json_group_array(json_object('emoji', cr.emoji, 'user_id', cr.user_id, 'user_name', cr.user_name))
     FROM chat_reactions cr WHERE cr.message_id = cm.id) AS reactions_json
  FROM chat_messages cm
  JOIN users u ON cm.sender_id = u.id
  LEFT JOIN chat_messages rm ON cm.reply_to_id = rm.id
  LEFT JOIN users ru ON rm.sender_id = ru.id
`;

function parseReactions(rows) {
  return rows.map(m => ({
    ...m,
    reactions: m.reactions_json ? (() => { try { return JSON.parse(m.reactions_json); } catch { return []; } })() : []
  }));
}

// GET /api/chat/rooms — list all rooms user is member of
router.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const rooms = await query(`
      SELECT cr.*,
        (SELECT COUNT(*) FROM chat_messages cm
         WHERE cm.room_id = cr.id
         AND cm.created_at > COALESCE(
           (SELECT last_read_at FROM chat_room_members WHERE room_id = cr.id AND user_id = ?), '1970-01-01'
         )
        ) AS unread_count,
        (SELECT cm2.message FROM chat_messages cm2 WHERE cm2.room_id = cr.id ORDER BY cm2.created_at DESC LIMIT 1) AS last_message,
        (SELECT cm2.created_at FROM chat_messages cm2 WHERE cm2.room_id = cr.id ORDER BY cm2.created_at DESC LIMIT 1) AS last_message_at,
        (SELECT u.name FROM chat_messages cm2 JOIN users u ON cm2.sender_id = u.id WHERE cm2.room_id = cr.id ORDER BY cm2.created_at DESC LIMIT 1) AS last_sender,
        (SELECT cm2.sender_id FROM chat_messages cm2 WHERE cm2.room_id = cr.id ORDER BY cm2.created_at DESC LIMIT 1) AS last_sender_id
      FROM chat_rooms cr
      JOIN chat_room_members crm ON cr.id = crm.room_id
      WHERE crm.user_id = ?
      ORDER BY COALESCE(last_message_at, cr.created_at) DESC
    `, [uid, uid]);

    // For direct rooms, set name to the OTHER person's name
    const enriched = await Promise.all(rooms.rows.map(async room => {
      if (room.type === 'direct') {
        const other = await query(`
          SELECT u.id, u.name, u.avatar_url, u.role FROM chat_room_members crm
          JOIN users u ON crm.user_id = u.id
          WHERE crm.room_id = ? AND crm.user_id != ?
          LIMIT 1
        `, [room.id, uid]);
        if (other.rows[0]) {
          room.display_name = other.rows[0].name;
          room.other_user = other.rows[0];
        }
      } else {
        room.display_name = room.name;
      }
      return room;
    }));

    res.json({ rooms: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// POST /api/chat/rooms/direct — get or create DM room with another user
router.post('/rooms/direct', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const { target_user_id } = req.body;
    if (!target_user_id) return res.status(400).json({ error: 'target_user_id required' });

    const existing = await query(`
      SELECT cr.id FROM chat_rooms cr
      JOIN chat_room_members m1 ON cr.id = m1.room_id AND m1.user_id = ?
      JOIN chat_room_members m2 ON cr.id = m2.room_id AND m2.user_id = ?
      WHERE cr.type = 'direct'
      LIMIT 1
    `, [uid, target_user_id]);

    if (existing.rows[0]) {
      return res.json({ room_id: existing.rows[0].id });
    }

    const room = await query(`INSERT INTO chat_rooms (type, created_by) VALUES ('direct', ?) RETURNING id`, [uid]);
    const roomId = room.rows[0].id;
    await query(`INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)`, [roomId, uid]);
    await query(`INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)`, [roomId, target_user_id]);

    res.json({ room_id: roomId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// POST /api/chat/rooms/group — create group room
router.post('/rooms/group', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const { name, member_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const room = await query(`INSERT INTO chat_rooms (name, type, created_by) VALUES (?, 'group', ?) RETURNING id`, [name, uid]);
    const roomId = room.rows[0].id;

    const allMembers = [...new Set([uid, ...(member_ids || [])])];
    for (const mid of allMembers) {
      await query(`INSERT OR IGNORE INTO chat_room_members (room_id, user_id) VALUES (?, ?)`, [roomId, mid]);
    }

    res.json({ room_id: roomId, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// GET /api/chat/rooms/:id/messages — paginated messages (polling)
router.get('/rooms/:id/messages', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const roomId = req.params.id;
    const since = req.query.since || '1970-01-01';

    const mem = await query(`SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ?`, [roomId, uid]);
    if (!mem.rows[0]) return res.status(403).json({ error: 'Not a member' });

    const msgs = await query(MESSAGE_QUERY + ` WHERE cm.room_id = ? AND cm.created_at > ? ORDER BY cm.created_at ASC LIMIT 100`, [roomId, since]);
    msgs.rows = parseReactions(msgs.rows);

    await query(`UPDATE chat_room_members SET last_read_at = datetime('now') WHERE room_id = ? AND user_id = ?`, [roomId, uid]);

    res.json({ messages: msgs.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// GET /api/chat/rooms/:id/messages/history — last 50 messages
router.get('/rooms/:id/messages/history', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const roomId = req.params.id;

    const mem = await query(`SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ?`, [roomId, uid]);
    if (!mem.rows[0]) return res.status(403).json({ error: 'Not a member' });

    const msgs = await query(MESSAGE_QUERY + ` WHERE cm.room_id = ? ORDER BY cm.created_at DESC LIMIT 50`, [roomId]);
    msgs.rows = parseReactions(msgs.rows.reverse());

    await query(`UPDATE chat_room_members SET last_read_at = datetime('now') WHERE room_id = ? AND user_id = ?`, [roomId, uid]);

    res.json({ messages: msgs.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// POST /api/chat/rooms/:id/messages — send message
router.post('/rooms/:id/messages', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const roomId = req.params.id;
    const { message, message_type, reply_to_id } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });

    const mem = await query(`SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ?`, [roomId, uid]);
    if (!mem.rows[0]) return res.status(403).json({ error: 'Not a member' });

    const result = await query(`
      INSERT INTO chat_messages (room_id, sender_id, message, message_type, reply_to_id)
      VALUES (?, ?, ?, ?, ?) RETURNING id, created_at
    `, [roomId, uid, message.trim(), message_type || 'text', reply_to_id || null]);

    const sender = await query(`SELECT name, avatar_url, role FROM users WHERE id = ?`, [uid]);

    // Fetch reply_to info if applicable
    let replyData = {};
    if (reply_to_id) {
      const rMsg = await query(`SELECT cm.message, cm.sender_id, u.name AS sender_name FROM chat_messages cm JOIN users u ON cm.sender_id = u.id WHERE cm.id = ?`, [reply_to_id]);
      if (rMsg.rows[0]) {
        replyData = {
          reply_to_message: rMsg.rows[0].message,
          reply_to_sender_id: rMsg.rows[0].sender_id,
          reply_to_sender_name: rMsg.rows[0].sender_name
        };
      }
    }

    res.json({
      success: true,
      message: {
        ...result.rows[0],
        room_id: parseInt(roomId),
        sender_id: uid,
        message: message.trim(),
        message_type: message_type || 'text',
        reply_to_id: reply_to_id || null,
        sender_name: sender.rows[0]?.name || 'A team member',
        sender_avatar: sender.rows[0]?.avatar_url,
        sender_role: sender.rows[0]?.role,
        reactions: [],
        ...replyData
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/chat/messages/:id/react — toggle emoji reaction
router.post('/messages/:id/react', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const msgId = req.params.id;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'emoji required' });

    const userName = await query(`SELECT name FROM users WHERE id = ?`, [uid]);
    const uname = userName.rows[0]?.name || 'Unknown';

    // Check if same emoji already exists for this user
    const existing = await query(`SELECT id FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`, [msgId, uid, emoji]);

    if (existing.rows[0]) {
      // Toggle off
      await query(`DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`, [msgId, uid, emoji]);
    } else {
      // Insert or replace (handles case of switching emoji)
      await query(`INSERT OR REPLACE INTO chat_reactions (message_id, user_id, emoji, user_name) VALUES (?, ?, ?, ?)`, [msgId, uid, emoji, uname]);
    }

    // Return full reactions list
    const reactions = await query(`SELECT emoji, user_id, user_name FROM chat_reactions WHERE message_id = ?`, [msgId]);
    res.json({ reactions: reactions.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to react' });
  }
});

// DELETE /api/chat/messages/:id — soft delete
router.delete('/messages/:id', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const msgId = req.params.id;
    const userRole = req.user.role;

    const msg = await query(`SELECT sender_id FROM chat_messages WHERE id = ?`, [msgId]);
    if (!msg.rows[0]) return res.status(404).json({ error: 'Message not found' });

    const isOwner = msg.rows[0].sender_id === uid;
    const isAdmin = ['admin', 'owner'].includes(userRole);
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not allowed' });

    await query(`UPDATE chat_messages SET deleted_at = datetime('now') WHERE id = ?`, [msgId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// POST /api/chat/rooms/:id/typing — set typing indicator
router.post('/rooms/:id/typing', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const roomId = req.params.id;
    const userName = await query(`SELECT name FROM users WHERE id = ?`, [uid]);
    const uname = userName.rows[0]?.name || 'Unknown';
    await query(`INSERT OR REPLACE INTO chat_typing (room_id, user_id, user_name, updated_at) VALUES (?, ?, ?, datetime('now'))`, [roomId, uid, uname]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

// GET /api/chat/rooms/:id/typing — get who's typing
router.get('/rooms/:id/typing', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const roomId = req.params.id;
    // Cleanup stale entries
    await query(`DELETE FROM chat_typing WHERE updated_at < datetime('now', '-10 seconds')`);
    const result = await query(`SELECT user_name FROM chat_typing WHERE room_id = ? AND user_id != ? AND updated_at > datetime('now', '-5 seconds')`, [roomId, uid]);
    res.json({ typing: result.rows.map(r => r.user_name) });
  } catch (err) {
    res.json({ typing: [] });
  }
});

// POST /api/chat/rooms/:id/upload — file/image upload
router.post('/rooms/:id/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const uid = req.user.id;
    const roomId = req.params.id;
    const reply_to_id = req.body.reply_to_id || null;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const mem = await query(`SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ?`, [roomId, uid]);
    if (!mem.rows[0]) return res.status(403).json({ error: 'Not a member' });

    const mime = req.file.mimetype || '';
    const isImage = mime.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';
    const messageType = isImage ? 'image' : 'file';
    const folder = `crm-chat/${roomId}`;

    const cloudData = await uploadToCloudinary(req.file.path, req.file.originalname, folder, resourceType);

    // Cleanup temp file
    try { fs.unlinkSync(req.file.path); } catch {}

    const caption = req.body.caption || req.file.originalname;
    const result = await query(`
      INSERT INTO chat_messages (room_id, sender_id, message, message_type, reply_to_id, file_url, file_name, file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at
    `, [roomId, uid, caption, messageType, reply_to_id, cloudData.secure_url, req.file.originalname, mime]);

    const sender = await query(`SELECT name, avatar_url, role FROM users WHERE id = ?`, [uid]);

    let replyData = {};
    if (reply_to_id) {
      const rMsg = await query(`SELECT cm.message, cm.sender_id, u.name AS sender_name FROM chat_messages cm JOIN users u ON cm.sender_id = u.id WHERE cm.id = ?`, [reply_to_id]);
      if (rMsg.rows[0]) {
        replyData = {
          reply_to_message: rMsg.rows[0].message,
          reply_to_sender_id: rMsg.rows[0].sender_id,
          reply_to_sender_name: rMsg.rows[0].sender_name
        };
      }
    }

    res.json({
      success: true,
      message: {
        ...result.rows[0],
        room_id: parseInt(roomId),
        sender_id: uid,
        message: caption,
        message_type: messageType,
        reply_to_id: reply_to_id || null,
        file_url: cloudData.secure_url,
        file_name: req.file.originalname,
        file_type: mime,
        sender_name: sender.rows[0]?.name || 'A team member',
        sender_avatar: sender.rows[0]?.avatar_url,
        sender_role: sender.rows[0]?.role,
        reactions: [],
        ...replyData
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// GET /api/chat/unread-count — total unread across all rooms
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const result = await query(`
      SELECT SUM(sub.unread) AS total FROM (
        SELECT COUNT(*) AS unread FROM chat_messages cm
        JOIN chat_room_members crm ON cm.room_id = crm.room_id AND crm.user_id = ?
        WHERE cm.created_at > COALESCE(crm.last_read_at, '1970-01-01')
        AND cm.sender_id != ?
      ) sub
    `, [uid, uid]);
    res.json({ unread: result.rows[0]?.total || 0 });
  } catch (err) {
    res.json({ unread: 0 });
  }
});

module.exports = router;
