const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/owner-database — list with filters
router.get('/', async (req, res) => {
  try {
    const { search, building, area, property_type, bedrooms, page = 1, limit = 100 } = req.query;
    let q = 'SELECT * FROM owner_database WHERE 1=1';
    const params = [];
    let p = 1;
    if (search) { q += ` AND (full_name LIKE $${p} OR phone LIKE $${p} OR email LIKE $${p} OR unit_number LIKE $${p})`; params.push(`%${search}%`); p++; }
    if (building) { q += ` AND building LIKE $${p}`; params.push(`%${building}%`); p++; }
    if (area) { q += ` AND area LIKE $${p}`; params.push(`%${area}%`); p++; }
    if (property_type) { q += ` AND property_type = $${p}`; params.push(property_type); p++; }
    if (bedrooms !== undefined && bedrooms !== '') { q += ` AND bedrooms = $${p}`; params.push(parseInt(bedrooms)); p++; }
    const offset = (parseInt(page) - 1) * parseInt(limit);
    q += ` ORDER BY full_name ASC LIMIT $${p} OFFSET $${p+1}`;
    params.push(parseInt(limit), offset);
    const result = await query(q, params);
    const countResult = await query('SELECT COUNT(*) as count FROM owner_database');
    res.json({ owners: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch owners' }); }
});

// GET /api/owner-database/filter-options — unique buildings/areas for dropdowns
router.get('/filter-options', async (req, res) => {
  try {
    const buildings = await query("SELECT DISTINCT building FROM owner_database WHERE building IS NOT NULL AND building != '' ORDER BY building");
    const areas = await query("SELECT DISTINCT area FROM owner_database WHERE area IS NOT NULL AND area != '' ORDER BY area");
    res.json({ buildings: buildings.rows.map(r => r.building), areas: areas.rows.map(r => r.area) });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch filter options' }); }
});

// POST /api/owner-database — create owner
router.post('/', async (req, res) => {
  try {
    const { full_name, phone, email, nationality, building, area, unit_number, property_type, bedrooms, notes, visibility = 'all', assigned_areas = '[]', assigned_buildings = '[]' } = req.body;
    if (!full_name) return res.status(400).json({ error: 'full_name is required' });
    const result = await query(`INSERT INTO owner_database (full_name, phone, email, nationality, building, area, unit_number, property_type, bedrooms, notes, visibility, assigned_areas, assigned_buildings, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [full_name, phone, email, nationality, building, area, unit_number, property_type, bedrooms || null, notes, visibility, assigned_areas, assigned_buildings, req.user?.id || null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create owner' }); }
});

// PUT /api/owner-database/:id
router.put('/:id', async (req, res) => {
  try {
    const fields = ['full_name','phone','email','nationality','building','area','unit_number','property_type','bedrooms','notes','visibility','assigned_areas','assigned_buildings'];
    const updates = []; const values = []; let p = 1;
    fields.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f} = $${p}`); values.push(req.body[f]); p++; } });
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push(`updated_at = datetime('now')`);
    values.push(req.params.id);
    const result = await query(`UPDATE owner_database SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update owner' }); }
});

// DELETE /api/owner-database/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM owner_database WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted', id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: 'Failed to delete owner' }); }
});

// POST /api/owner-database/bulk-import — import array of owners
router.post('/bulk-import', async (req, res) => {
  try {
    const { owners } = req.body;
    if (!Array.isArray(owners) || owners.length === 0) return res.status(400).json({ error: 'owners array required' });
    let imported = 0; const errors = [];
    for (const o of owners) {
      try {
        if (!o.full_name) { errors.push(`Skipped row: no full_name`); continue; }
        await query(`INSERT INTO owner_database (full_name, phone, email, nationality, building, area, unit_number, property_type, bedrooms, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [o.full_name, o.phone||null, o.email||null, o.nationality||null, o.building||null, o.area||null, o.unit_number||null, o.property_type||null, o.bedrooms||null, o.notes||null, req.user?.id||null]);
        imported++;
      } catch (e) { errors.push(`Error for ${o.full_name}: ${e.message}`); }
    }
    res.json({ imported, errors });
  } catch (err) { res.status(500).json({ error: 'Bulk import failed' }); }
});

module.exports = router;
