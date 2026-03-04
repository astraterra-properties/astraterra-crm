/**
 * Leads API Routes
 * Complete CRUD operations for lead management with pipeline stages
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireRole, requireMinRole } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/leads
 * Get all leads with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      assigned_to, 
      search,
      pipeline_stage,
      lead_type,
      view,
      page = 1, 
      limit = 50 
    } = req.query;

    let queryText = `
      SELECT 
        l.*,
        c.name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email,
        c.budget_min,
        c.budget_max,
        c.property_type,
        c.location_preference,
        c.lead_pool,
        u.name as assigned_to_name,
        (SELECT COUNT(*) FROM tasks WHERE related_type='lead' AND related_id=l.id AND status != 'completed' AND completed != 1) as pending_tasks,
        (SELECT json_group_array(json_object('id',t.id,'title',t.title,'due_date',t.due_date,'priority',t.priority)) FROM tasks t WHERE t.related_type='lead' AND t.related_id=l.id AND t.status != 'completed' AND t.completed != 1 ORDER BY t.due_date ASC LIMIT 3) as task_list
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 1;

    // Agent role: restrict to own leads only
    if (req.user.role === 'agent') {
      queryText += ` AND l.assigned_to = $${paramCount}`;
      queryParams.push(req.user.id);
      paramCount++;
    }

    // Filters
    if (status) {
      queryText += ` AND l.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }

    if (priority) {
      queryText += ` AND l.priority = $${paramCount}`;
      queryParams.push(priority);
      paramCount++;
    }

    if (assigned_to) {
      queryText += ` AND l.assigned_to = $${paramCount}`;
      queryParams.push(assigned_to);
      paramCount++;
    }

    if (pipeline_stage) {
      queryText += ` AND l.pipeline_stage = $${paramCount}`;
      queryParams.push(pipeline_stage);
      paramCount++;
    }

    if (lead_type) {
      queryText += ` AND l.lead_type = $${paramCount}`;
      queryParams.push(lead_type);
      paramCount++;
    }

    if (search) {
      queryText += ` AND (
        c.name LIKE $${paramCount} OR 
        c.phone LIKE $${paramCount} OR 
        c.email LIKE $${paramCount} OR
        l.notes LIKE $${paramCount}
      )`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    // If kanban view, return grouped by pipeline stage
    if (view === 'kanban') {
      queryText += ` ORDER BY l.created_at DESC`;
      const result = await query(queryText, queryParams);
      
      const stages = ['new_lead', 'contacted', 'qualified', 'site_visit', 'offer_made', 'negotiation', 'deal_closed', 'lost'];
      const grouped = {};
      stages.forEach(s => { grouped[s] = []; });
      
      result.rows.forEach(lead => {
        const stage = lead.pipeline_stage || 'new_lead';
        const normalized = {
          ...lead,
          name: lead.name || lead.contact_name || 'Unknown',
          phone: lead.phone || lead.contact_phone || '',
          email: lead.email || lead.contact_email || '',
        };
        if (grouped[stage]) {
          grouped[stage].push(normalized);
        } else {
          grouped['new_lead'].push(normalized);
        }
      });
      
      return res.json({ kanban: grouped });
    }

    // Pagination
    const offset = (page - 1) * limit;
    queryText += ` ORDER BY l.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);

    // Normalize field names
    const normalized = result.rows.map(l => ({
      ...l,
      name: l.name || l.contact_name || 'Unknown',
      phone: l.phone || l.contact_phone || '',
      email: l.email || l.contact_email || '',
    }));

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM leads l LEFT JOIN contacts c ON l.contact_id = c.id WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND l.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (pipeline_stage) {
      countQuery += ` AND l.pipeline_stage = $${countParamIndex}`;
      countParams.push(pipeline_stage);
      countParamIndex++;
    }

    if (lead_type) {
      countQuery += ` AND l.lead_type = $${countParamIndex}`;
      countParams.push(lead_type);
      countParamIndex++;
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      leads: normalized,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/**
 * GET /api/leads/stats/overview
 * Get lead statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { assigned_to } = req.query;

    let whereClause = '';
    const params = [];

    if (assigned_to) {
      whereClause = 'WHERE assigned_to = ?';
      params.push(assigned_to);
    }

    const result = await query(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'not_contacted' THEN 1 END) as not_contacted,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified,
        COUNT(CASE WHEN status = 'hot' THEN 1 END) as hot,
        COUNT(CASE WHEN status = 'viewing_scheduled' THEN 1 END) as viewing_scheduled,
        COUNT(CASE WHEN status = 'deal_won' THEN 1 END) as won,
        COUNT(CASE WHEN status = 'deal_lost' THEN 1 END) as lost,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent,
        AVG(score) as avg_score
      FROM leads
      ${whereClause}
    `, params);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead statistics' });
  }
});

/**
 * GET /api/leads/:id
 * Get single lead by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        l.*,
        c.name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email,
        c.budget_min,
        c.budget_max,
        c.property_type,
        c.location_preference,
        c.lead_pool,
        u.name as assigned_to_name,
        u.email as assigned_to_email
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = result.rows[0];
    res.json({
      ...lead,
      name: lead.name || lead.contact_name || 'Unknown',
      phone: lead.phone || lead.contact_phone || '',
      email: lead.email || lead.contact_email || '',
    });
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

/**
 * POST /api/leads
 * Create new lead
 */
router.post('/', async (req, res) => {
  try {
    const {
      contact_id,
      status = 'not_contacted',
      priority = 'medium',
      assigned_to,
      budget,
      requirements,
      notes,
      source,
      source_url,
      next_follow_up,
      pipeline_stage = 'new_lead',
      lead_type = 'buyer',
      tags = '[]',
      source_channel,
      whatsapp_number,
      next_followup_date,
    } = req.body;

    // Validate required fields
    if (!contact_id) {
      return res.status(400).json({ error: 'contact_id is required' });
    }

    const result = await query(`
      INSERT INTO leads (
        contact_id, status, priority, assigned_to, budget,
        requirements, notes, source, source_url, next_follow_up,
        score, pipeline_stage, lead_type, tags, source_channel,
        whatsapp_number, next_followup_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      contact_id,
      status,
      priority,
      assigned_to || req.user.id,
      budget,
      requirements,
      notes,
      source,
      source_url,
      next_follow_up,
      50, // Default score
      pipeline_stage,
      lead_type,
      tags,
      source_channel,
      whatsapp_number,
      next_followup_date,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

/**
 * PUT /api/leads/:id
 * Update lead — saves to leads table AND linked contacts table
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      // Contact fields (stored in contacts table)
      name,
      phone,
      email,
      location_preference,
      budget_min,
      budget_max,
      property_type,
      // Lead fields (stored in leads table)
      status,
      priority,
      assigned_to,
      budget,
      requirements,
      notes,
      next_follow_up,
      score,
      pipeline_stage,
      lead_type,
      tags,
      source,
      source_channel,
      whatsapp_number,
      last_activity,
      next_followup_date,
    } = req.body;

    // ── 1. Get the lead's contact_id ──────────────────────────────────
    const leadRow = await query('SELECT contact_id FROM leads WHERE id = $1', [id]);
    if (!leadRow.rows.length) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const contactId = leadRow.rows[0].contact_id;

    // ── 2. Update contacts table if there's a linked contact ──────────
    if (contactId) {
      const contactUpdates = [];
      const contactValues = [];
      let cp = 1;

      if (name  !== undefined) { contactUpdates.push(`name = $${cp++}`);                contactValues.push(name); }
      if (phone !== undefined) { contactUpdates.push(`phone = $${cp++}`);               contactValues.push(phone); }
      if (email !== undefined) { contactUpdates.push(`email = $${cp++}`);               contactValues.push(email); }
      if (location_preference !== undefined) { contactUpdates.push(`location_preference = $${cp++}`); contactValues.push(location_preference); }
      if (budget_min  !== undefined) { contactUpdates.push(`budget_min = $${cp++}`);    contactValues.push(budget_min); }
      if (budget_max  !== undefined) { contactUpdates.push(`budget_max = $${cp++}`);    contactValues.push(budget_max); }
      if (property_type !== undefined) { contactUpdates.push(`property_type = $${cp++}`); contactValues.push(property_type); }
      if (source !== undefined) { contactUpdates.push(`source = $${cp++}`);             contactValues.push(source); }
      if (notes !== undefined) { contactUpdates.push(`notes = $${cp++}`);               contactValues.push(notes); }

      if (contactUpdates.length > 0) {
        contactValues.push(contactId);
        await query(
          `UPDATE contacts SET ${contactUpdates.join(', ')}, updated_at = datetime('now') WHERE id = $${cp}`,
          contactValues
        );
      }
    }

    // ── 3. Update leads table ─────────────────────────────────────────
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status         !== undefined) { updates.push(`status = $${paramCount++}`);          values.push(status); }
    if (priority       !== undefined) { updates.push(`priority = $${paramCount++}`);         values.push(priority); }
    if (assigned_to    !== undefined) { updates.push(`assigned_to = $${paramCount++}`);      values.push(assigned_to); }
    if (budget         !== undefined) { updates.push(`budget = $${paramCount++}`);           values.push(budget); }
    if (requirements   !== undefined) { updates.push(`requirements = $${paramCount++}`);     values.push(requirements); }
    if (notes          !== undefined) { updates.push(`notes = $${paramCount++}`);            values.push(notes); }
    if (next_follow_up !== undefined) { updates.push(`next_follow_up = $${paramCount++}`);   values.push(next_follow_up); }
    if (score          !== undefined) { updates.push(`score = $${paramCount++}`);            values.push(score); }
    if (pipeline_stage !== undefined) { updates.push(`pipeline_stage = $${paramCount++}`);   values.push(pipeline_stage); }
    if (lead_type      !== undefined) { updates.push(`lead_type = $${paramCount++}`);        values.push(lead_type); }
    if (tags           !== undefined) { updates.push(`tags = $${paramCount++}`);             values.push(tags); }
    if (source_channel !== undefined) { updates.push(`source_channel = $${paramCount++}`);   values.push(source_channel); }
    if (source         !== undefined) { updates.push(`source = $${paramCount++}`);           values.push(source); }
    if (whatsapp_number !== undefined) { updates.push(`whatsapp_number = $${paramCount++}`); values.push(whatsapp_number); }
    if (last_activity  !== undefined) { updates.push(`last_activity = $${paramCount++}`);    values.push(last_activity); }
    if (next_followup_date !== undefined) { updates.push(`next_followup_date = $${paramCount++}`); values.push(next_followup_date); }

    if (status) {
      updates.push(`last_contact_date = datetime('now')`);
    }

    // Always update updated_at
    updates.push(`updated_at = datetime('now')`);

    values.push(id);
    const result = await query(
      `UPDATE leads SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    // ── 4. Auto-pool: if stage moved to 'lost', add contact to lead pool ──
    if (pipeline_stage === 'lost' && contactId) {
      await query(
        `UPDATE contacts SET lead_pool = 1, updated_at = datetime('now') WHERE id = $1`,
        [contactId]
      );
    }

    // ── 5. Return the updated lead with contact fields merged in ──────
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Fetch the full lead+contact data to return
    const fullLead = await query(`
      SELECT l.*,
             c.name   AS contact_name,
             c.phone  AS contact_phone,
             c.email  AS contact_email,
             c.location_preference,
             c.budget_min,
             c.budget_max,
             c.property_type
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      WHERE l.id = $1
    `, [id]);

    res.json(fullLead.rows[0] || result.rows[0]);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

/**
 * DELETE /api/leads/:id
 * Delete lead
 */
router.delete('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ message: 'Lead deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

/**
 * POST /api/leads/bulk-update
 * Bulk update multiple leads
 */
router.post('/bulk-update', async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'updates object is required' });
    }

    // Build SET clause dynamically from allowed fields
    const allowedFields = ['status', 'pipeline_stage', 'priority', 'assigned_to', 'lead_type'];
    const setClauses = [];
    const params = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIdx}`);
        params.push(updates[field]);
        paramIdx++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = datetime('now')`);

    // Build placeholders for ids
    const idPlaceholders = ids.map((_, i) => `$${paramIdx + i}`).join(',');
    params.push(...ids);

    const result = await query(
      `UPDATE leads SET ${setClauses.join(', ')} WHERE id IN (${idPlaceholders}) RETURNING id`,
      params
    );

    res.json({
      message: `${result.rows.length} leads updated successfully`,
      updated_ids: result.rows.map(r => r.id)
    });
  } catch (error) {
    console.error('Error bulk updating leads:', error);
    res.status(500).json({ error: 'Failed to bulk update leads' });
  }
});

/**
 * POST /api/leads/bulk-delete
 * Bulk delete multiple leads
 */
router.post('/bulk-delete', requireMinRole('admin'), async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const idPlaceholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(
      `DELETE FROM leads WHERE id IN (${idPlaceholders}) RETURNING id`,
      ids
    );

    res.json({
      message: `${result.rows.length} leads deleted successfully`,
      deleted_ids: result.rows.map(r => r.id)
    });
  } catch (error) {
    console.error('Error bulk deleting leads:', error);
    res.status(500).json({ error: 'Failed to bulk delete leads' });
  }
});

// ─────────────────────────────────────────────
//  LEAD DOCUMENT ROUTES
//  Uploaded files go to Cloudinary + saved in documents table
//  Accessible to all authenticated users (not admin-only)
// ─────────────────────────────────────────────
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const FormData = require('form-data');
const nodeFetch = (() => { try { return require('node-fetch'); } catch(e) { return null; } })();

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || 'dumt7udjd';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '714597318371755';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'fJX-95cOy2jkNd-8jz81d6leDZU';

const leadDocUpload = multer({ dest: '/tmp/crm-lead-uploads/' });

async function uploadLeadDocToCloudinary(filePath, originalName, folder) {
  const fetch = nodeFetch || (await import('node-fetch')).default;
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha1').update(paramsToSign + CLOUDINARY_API_SECRET).digest('hex');
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), { filename: originalName });
  form.append('folder', folder);
  form.append('timestamp', String(timestamp));
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('signature', signature);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/upload`,
    { method: 'POST', body: form }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
  return data;
}

/**
 * GET /api/leads/:id/documents
 * List all documents for a lead
 */
router.get('/:id/documents', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM documents WHERE entity_type = 'lead' AND entity_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, documents: result.rows });
  } catch (err) {
    console.error('Error fetching lead documents:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/leads/:id/documents
 * Upload a document for a lead → Cloudinary + documents table
 */
router.post('/:id/documents', leadDocUpload.single('file'), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    const leadId = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    // Get lead name for the folder
    const leadResult = await query(
      `SELECT l.id, c.name AS contact_name, l.whatsapp_number
       FROM leads l LEFT JOIN contacts c ON l.contact_id = c.id
       WHERE l.id = $1`,
      [leadId]
    );
    if (!leadResult.rows.length) return res.status(404).json({ error: 'Lead not found' });

    const lead = leadResult.rows[0];
    const leadName = lead.contact_name || lead.whatsapp_number || `lead-${leadId}`;
    const safeLeadName = leadName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cloudinaryFolder = `crm-documents/leads/${safeLeadName}`;

    // Upload to Cloudinary
    const cloudResult = await uploadLeadDocToCloudinary(tempPath, req.file.originalname, cloudinaryFolder);
    const viewUrl = cloudResult.secure_url;
    const downloadUrl = viewUrl.replace('/upload/', '/upload/fl_attachment/');

    // Save to documents table (appears in Document Manager too)
    const insertResult = await query(
      `INSERT INTO documents
        (name, original_name, category, entity_type, entity_id, entity_name,
         drive_file_id, drive_view_link, drive_download_link, drive_folder_id,
         file_size, mime_type, notes, uploaded_by)
       VALUES ($1, $2, $3, 'lead', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        req.file.originalname,
        req.file.originalname,
        req.body.category || 'Client Document',
        leadId,
        leadName,
        cloudResult.public_id,
        viewUrl,
        downloadUrl,
        cloudinaryFolder,
        req.file.size,
        req.file.mimetype,
        req.body.notes || null,
        req.user?.email || req.user?.username || 'agent',
      ]
    );

    res.json({
      success: true,
      document: {
        id: insertResult.rows[0]?.id,
        name: req.file.originalname,
        category: req.body.category || 'Client Document',
        drive_view_link: viewUrl,
        drive_download_link: downloadUrl,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Lead document upload error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
  }
});

/**
 * DELETE /api/leads/:id/documents/:docId
 * Delete a document from a lead
 */
router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM documents WHERE id = $1 AND entity_type = 'lead' AND entity_id = $2`,
      [req.params.docId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Document not found' });

    // Try Cloudinary delete (non-fatal)
    try {
      const doc = result.rows[0];
      if (doc.drive_file_id) {
        const fetch = nodeFetch || (await import('node-fetch')).default;
        const timestamp = Math.floor(Date.now() / 1000);
        const paramsToSign = `public_id=${doc.drive_file_id}&timestamp=${timestamp}`;
        const signature = crypto.createHash('sha1').update(paramsToSign + CLOUDINARY_API_SECRET).digest('hex');
        const form = new FormData();
        form.append('public_id', doc.drive_file_id);
        form.append('timestamp', String(timestamp));
        form.append('api_key', CLOUDINARY_API_KEY);
        form.append('signature', signature);
        await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/destroy`, { method: 'POST', body: form });
      }
    } catch (_) {}

    await query('DELETE FROM documents WHERE id = $1', [req.params.docId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Lead document delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
