/**
 * Documents API Routes
 * Upload, list, and delete documents stored in Cloudinary, metadata in SQLite
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const FormData = require('form-data');
const fetch = require('node-fetch');
const { authenticateToken, requireMinRole } = require('../middleware/auth');
const { query } = require('../config/database');

// Document Manager — management only (admin+)
// Applied per-route below

// Cloudinary credentials
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || 'dumt7udjd';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '714597318371755';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'fJX-95cOy2jkNd-8jz81d6leDZU';

// Temp upload dir
const upload = multer({ dest: '/tmp/crm-uploads/' });

// Apply auth to all routes
router.use(authenticateToken);
router.use(requireMinRole('finance')); // Document Manager — finance+ (finance sees own docs only; admin+ sees all)

// Helper: is this user restricted to their own documents only?
function isOwnDocsOnly(user) {
  const ROLE_LEVELS = { owner: 4, admin: 3, finance: 2, agent: 1 };
  return (ROLE_LEVELS[user.role] ?? 0) < (ROLE_LEVELS['admin'] ?? 99);
}

/**
 * Upload a file buffer to Cloudinary (raw resource type for docs/PDFs)
 */
async function uploadToCloudinary(filePath, originalName, folder) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(paramsToSign + CLOUDINARY_API_SECRET)
    .digest('hex');

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
  return data; // { public_id, secure_url, ... }
}

/**
 * Delete a file from Cloudinary by public_id
 */
async function deleteFromCloudinary(publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(paramsToSign + CLOUDINARY_API_SECRET)
    .digest('hex');

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('timestamp', String(timestamp));
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('signature', signature);

  await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/destroy`, {
    method: 'POST',
    body: form,
  });
}

// GET /api/documents/categories — must be before /:id route
router.get('/categories', async (req, res) => {
  try {
    let sql = 'SELECT category, entity_type, COUNT(*) as count FROM documents';
    const params = [];
    if (isOwnDocsOnly(req.user)) {
      sql += ' WHERE (uploaded_by = $1 OR (entity_type = \'agent\' AND entity_id = $2))';
      params.push(req.user.email, req.user.id);
    }
    sql += ' GROUP BY category, entity_type';
    const result = await query(sql, params);
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents — list with optional filters
router.get('/', async (req, res) => {
  try {
    const { entity_type, entity_id, category, search } = req.query;
    let sql = 'SELECT * FROM documents WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Finance/restricted users: only see their own documents
    if (isOwnDocsOnly(req.user)) {
      sql += ` AND (uploaded_by = $${paramCount} OR (entity_type = 'agent' AND entity_id = $${paramCount + 1}))`;
      params.push(req.user.email, req.user.id);
      paramCount += 2;
    }

    if (entity_type) {
      sql += ` AND entity_type = $${paramCount++}`;
      params.push(entity_type);
    }
    if (entity_id) {
      sql += ` AND entity_id = $${paramCount++}`;
      params.push(entity_id);
    }
    if (category && category !== 'all') {
      sql += ` AND category = $${paramCount++}`;
      params.push(category);
    }
    if (search) {
      sql += ` AND (name LIKE $${paramCount} OR original_name LIKE $${paramCount + 1} OR entity_name LIKE $${paramCount + 2})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramCount += 3;
    }
    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    res.json({ success: true, documents: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  const tempPath = req.file?.path;
  try {
    let { entity_type, entity_id, entity_name, category, notes } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    // Finance/restricted users: force their own agent record only
    if (isOwnDocsOnly(req.user)) {
      entity_type = 'agent';
      entity_id = req.user.id;
      entity_name = req.user.name || req.user.email;
    }

    // Determine Cloudinary folder path based on entity type
    let cloudinaryFolder;
    if (entity_type === 'agent') {
      const safeAgentName = (entity_name || `agent-${entity_id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      cloudinaryFolder = `crm-documents/hr/${safeAgentName}`;
    } else if (entity_type === 'client') {
      const safeClientName = (entity_name || `client-${entity_id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      cloudinaryFolder = `crm-documents/clients/${safeClientName}`;
    } else {
      const safeCat = (category || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
      cloudinaryFolder = `crm-documents/company/${safeCat}`;
    }

    // Upload to Cloudinary
    const cloudResult = await uploadToCloudinary(tempPath, req.file.originalname, cloudinaryFolder);

    // Build view & download URLs
    const viewUrl = cloudResult.secure_url;
    // Cloudinary raw download: replace /upload/ with /upload/fl_attachment/
    const downloadUrl = viewUrl.replace('/upload/', '/upload/fl_attachment/');

    // Save metadata to SQLite
    const insertSql = `
      INSERT INTO documents
        (name, original_name, category, entity_type, entity_id, entity_name,
         drive_file_id, drive_view_link, drive_download_link, drive_folder_id,
         file_size, mime_type, notes, uploaded_by)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `;
    const insertResult = await query(insertSql, [
      req.file.originalname,
      req.file.originalname,
      category || 'General',
      entity_type || 'company',
      entity_id || null,
      entity_name || null,
      cloudResult.public_id,
      viewUrl,
      downloadUrl,
      cloudinaryFolder,
      req.file.size,
      req.file.mimetype,
      notes || null,
      req.user?.email || req.user?.username || 'admin',
    ]);

    res.json({
      success: true,
      document: {
        id: insertResult.rows[0]?.id,
        name: req.file.originalname,
        drive_view_link: viewUrl,
        drive_download_link: downloadUrl,
      },
    });
  } catch (err) {
    console.error('Document upload error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    const doc = result.rows[0];

    // Finance/restricted users: can only delete their own documents
    if (isOwnDocsOnly(req.user)) {
      const isOwn = doc.uploaded_by === req.user.email ||
        (doc.entity_type === 'agent' && String(doc.entity_id) === String(req.user.id));
      if (!isOwn) return res.status(403).json({ error: 'Access denied' });
    }

    // Try to delete from Cloudinary (non-fatal if it fails)
    try {
      if (doc.drive_file_id) {
        await deleteFromCloudinary(doc.drive_file_id);
      }
    } catch (cloudErr) {
      console.error('Cloudinary delete error (continuing):', cloudErr.message);
    }

    await query('DELETE FROM documents WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
