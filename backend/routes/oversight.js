/**
 * Agent Oversight Routes
 * Owner/Admin can see all activity per agent — leads, contacts, tasks, viewings, documents
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database-sqlite');
const { authenticateToken, requireMinRole } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireMinRole('admin')); // Owner + Admin only

// GET /api/oversight/agents — all agents with summary stats
router.get('/agents', async (req, res) => {
  try {
    const agents = await query(`
      SELECT 
        u.id, u.name, u.email, u.role, u.avatar_url, u.rera_number, u.specialty, u.profile_complete,
        COUNT(DISTINCT l.id) AS lead_count,
        COUNT(DISTINCT c.id) AS contact_count,
        COUNT(DISTINCT t.id) AS task_count,
        COUNT(DISTINCT v.id) AS viewing_count,
        COUNT(DISTINCT d.id) AS doc_count
      FROM users u
      LEFT JOIN leads l ON l.assigned_to = u.id
      LEFT JOIN contacts c ON c.assigned_to = u.id
      LEFT JOIN tasks t ON t.created_by = u.id
      LEFT JOIN viewings v ON v.agent_id = u.id
      LEFT JOIN documents d ON d.uploaded_by = u.email
      WHERE u.role NOT IN ('owner', 'admin')
      GROUP BY u.id
      ORDER BY u.name ASC
    `, []);
    res.json({ agents: agents.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oversight/agents/:id/leads — leads for a specific agent
router.get('/agents/:id/leads', async (req, res) => {
  try {
    const rows = await query(`
      SELECT l.*, c.name AS contact_name, c.phone AS contact_phone, c.email AS contact_email
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      WHERE l.assigned_to = ?
      ORDER BY l.updated_at DESC
      LIMIT 100
    `, [req.params.id]);
    res.json({ leads: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oversight/agents/:id/contacts — contacts assigned to agent
router.get('/agents/:id/contacts', async (req, res) => {
  try {
    const rows = await query(`
      SELECT id, name, phone, email, type, status, source, lead_pool, created_at, updated_at
      FROM contacts WHERE assigned_to = ?
      ORDER BY updated_at DESC LIMIT 100
    `, [req.params.id]);
    res.json({ contacts: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oversight/agents/:id/tasks — tasks created by agent
router.get('/agents/:id/tasks', async (req, res) => {
  try {
    const rows = await query(`
      SELECT t.*, u.name AS assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.created_by = ?
      ORDER BY t.created_at DESC LIMIT 100
    `, [req.params.id]);
    res.json({ tasks: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oversight/agents/:id/viewings — viewings by agent
router.get('/agents/:id/viewings', async (req, res) => {
  try {
    const rows = await query(`
      SELECT v.*, c.name AS contact_name, c.phone AS contact_phone
      FROM viewings v
      LEFT JOIN contacts c ON v.contact_id = c.id
      WHERE v.agent_id = ?
      ORDER BY v.created_at DESC LIMIT 100
    `, [req.params.id]);
    res.json({ viewings: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oversight/agents/:id/documents — documents uploaded by agent
router.get('/agents/:id/documents', async (req, res) => {
  try {
    // Get agent email first
    const user = await query(`SELECT email FROM users WHERE id = ?`, [req.params.id]);
    const email = user.rows[0]?.email;
    if (!email) return res.json({ documents: [] });

    const rows = await query(`
      SELECT * FROM documents 
      WHERE uploaded_by = ? OR (entity_type = 'agent' AND entity_id = ?)
      ORDER BY created_at DESC LIMIT 100
    `, [email, req.params.id]);
    res.json({ documents: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oversight/all-docs — all agent documents (entity_type='agent') 
router.get('/all-docs', async (req, res) => {
  try {
    const rows = await query(`
      SELECT d.*, u.name AS agent_display_name, u.role AS agent_role
      FROM documents d
      LEFT JOIN users u ON d.entity_id = u.id AND d.entity_type = 'agent'
      WHERE d.entity_type = 'agent'
      ORDER BY d.created_at DESC
    `, []);
    res.json({ documents: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oversight/activity — recent activity feed across all agents
router.get('/activity', async (req, res) => {
  try {
    const leads = await query(`
      SELECT 'lead' AS type, l.id, c.name AS subject, l.pipeline_stage AS detail, 
             u.name AS agent_name, u.id AS agent_id, l.created_at AS ts
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE u.role NOT IN ('owner','admin')
      ORDER BY l.created_at DESC LIMIT 20
    `, []);

    const contacts = await query(`
      SELECT 'contact' AS type, c.id, c.name AS subject, c.type AS detail,
             u.name AS agent_name, u.id AS agent_id, c.created_at AS ts
      FROM contacts c
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE u.role NOT IN ('owner','admin')
      ORDER BY c.created_at DESC LIMIT 20
    `, []);

    const tasks = await query(`
      SELECT 'task' AS type, t.id, t.title AS subject, t.status AS detail,
             u.name AS agent_name, u.id AS agent_id, t.created_at AS ts
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE u.role NOT IN ('owner','admin')
      ORDER BY t.created_at DESC LIMIT 20
    `, []);

    const viewings = await query(`
      SELECT 'viewing' AS type, v.id, c.name AS subject, v.status AS detail,
             u.name AS agent_name, u.id AS agent_id, v.created_at AS ts
      FROM viewings v
      LEFT JOIN contacts c ON v.contact_id = c.id
      LEFT JOIN users u ON v.agent_id = u.id
      WHERE u.role NOT IN ('owner','admin')
      ORDER BY v.created_at DESC LIMIT 20
    `, []);

    const docs = await query(`
      SELECT 'document' AS type, d.id, d.name AS subject, d.category AS detail,
             d.uploaded_by AS agent_name, u.id AS agent_id, d.created_at AS ts
      FROM documents d
      LEFT JOIN users u ON d.entity_id = u.id AND d.entity_type = 'agent'
      WHERE d.entity_type = 'agent'
      ORDER BY d.created_at DESC LIMIT 20
    `, []);

    const all = [
      ...leads.rows,
      ...contacts.rows,
      ...tasks.rows,
      ...viewings.rows,
      ...docs.rows,
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 50);

    res.json({ activity: all });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
