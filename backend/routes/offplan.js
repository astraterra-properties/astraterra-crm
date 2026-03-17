/**
 * Off-Plan Projects API Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireMinRole } = require('../middleware/auth');

// ── PUBLIC endpoints (no auth) ────────────────────────────────────────────────

// GET /api/offplan/public — active off-plan projects for website
router.get('/public', async (req, res) => {
  try {
    const { community, featured, page = 1, limit = 50 } = req.query;
    let q = `
      SELECT op.*, d.name as developer_name
      FROM offplan_projects op
      LEFT JOIN developers d ON op.developer_id = d.id
      WHERE op.status = 'active'
    `;
    const params = [];
    let p = 1;

    if (community) { q += ` AND op.community LIKE $${p}`; params.push(`%${community}%`); p++; }
    if (featured) { q += ` AND op.featured = 1`; }

    const offset = (page - 1) * limit;
    q += ` ORDER BY op.featured DESC, op.created_at DESC LIMIT $${p} OFFSET $${p+1}`;
    params.push(parseInt(limit), offset);

    const result = await query(q, params);
    const countResult = await query("SELECT COUNT(*) as count FROM offplan_projects WHERE status = 'active'");

    res.json({ projects: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch public off-plan projects' });
  }
});

// GET /api/offplan/public/:id — single project for website
router.get('/public/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT op.*, d.name as developer_name
      FROM offplan_projects op
      LEFT JOIN developers d ON op.developer_id = d.id
      WHERE op.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ── AUTHENTICATED endpoints ───────────────────────────────────────────────────
router.use(authenticateToken);

// GET /api/offplan - List all projects with filters
router.get('/', async (req, res) => {
  try {
    const { status, developer_id, community, page = 1, limit = 50 } = req.query;

    let q = `
      SELECT op.*, d.name as developer_name
      FROM offplan_projects op
      LEFT JOIN developers d ON op.developer_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (status) { q += ` AND op.status = $${p}`; params.push(status); p++; }
    if (developer_id) { q += ` AND op.developer_id = $${p}`; params.push(developer_id); p++; }
    if (community) { q += ` AND op.community LIKE $${p}`; params.push(`%${community}%`); p++; }

    const offset = (page - 1) * limit;
    q += ` ORDER BY op.created_at DESC LIMIT $${p} OFFSET $${p+1}`;
    params.push(limit, offset);

    const result = await query(q, params);

    const countResult = await query(`SELECT COUNT(*) as count FROM offplan_projects WHERE 1=1${status ? ` AND status = '${status}'` : ''}`);
    const total = parseInt(countResult.rows[0].count);

    res.json({ projects: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/offplan/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT op.*, d.name as developer_name
      FROM offplan_projects op
      LEFT JOIN developers d ON op.developer_id = d.id
      WHERE op.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /api/offplan
router.post('/', requireMinRole('admin'), async (req, res) => {
  try {
    const {
      name, developer_id, location, community, project_type,
      unit_types = '[]', min_price, max_price, payment_plan,
      down_payment_percent, handover_date, completion_percent = 0,
      total_units, available_units, brochure_url, images = '[]',
      status = 'active', description, amenities = '[]'
    } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    // Auto-feature new projects: unfeature old ones (keep max 3 featured)
    // New project always gets featured = 1
    const featured = 1;
    // Unfeature oldest featured if we already have 3
    const featuredRes = await query("SELECT id FROM offplan_projects WHERE featured = 1 ORDER BY created_at DESC");
    if (featuredRes.rows.length >= 3) {
      const toUnfeature = featuredRes.rows.slice(2).map(r => r.id);
      for (const id of toUnfeature) {
        await query("UPDATE offplan_projects SET featured = 0 WHERE id = $1", [id]);
      }
    }

    const result = await query(`
      INSERT INTO offplan_projects (
        name, developer_id, location, community, project_type, unit_types,
        min_price, max_price, payment_plan, down_payment_percent, handover_date,
        completion_percent, total_units, available_units, brochure_url, images,
        status, featured, description, amenities
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `, [name, developer_id, location, community, project_type, unit_types,
        min_price, max_price, payment_plan, down_payment_percent, handover_date,
        completion_percent, total_units, available_units, brochure_url, images,
        status, featured, description, amenities]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/offplan/:id
router.put('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const fields = ['name', 'developer_id', 'location', 'community', 'project_type', 'unit_types',
      'min_price', 'max_price', 'payment_plan', 'down_payment_percent', 'handover_date',
      'completion_percent', 'total_units', 'available_units', 'brochure_url', 'images',
      'status', 'featured', 'description', 'amenities', 'slug'];

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

    const result = await query(`UPDATE offplan_projects SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/offplan/:id
router.delete('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const result = await query('DELETE FROM offplan_projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
