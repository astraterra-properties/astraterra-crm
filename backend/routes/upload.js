/**
 * File Upload Route — Astraterra CRM
 * Local file upload for property documents and photos
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken: auth } = require("../middleware/auth");

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { category, entityId } = req.body;
    const subDir = path.join(UPLOAD_DIR, category || 'general', entityId || 'misc');
    fs.mkdirSync(subDir, { recursive: true });
    cb(null, subDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '-');
    cb(null, `${timestamp}-${base}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Supported: images, PDF, Word, Excel'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// POST /api/upload — Upload one or more files
router.post('/', auth, upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const uploaded = req.files.map((file) => ({
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    path: file.path,
    url: `/uploads/${req.body.category || 'general'}/${req.body.entityId || 'misc'}/${file.filename}`,
  }));

  res.json({ success: true, files: uploaded, count: uploaded.length });
});

// GET /api/upload/list — List uploaded files
router.get('/list', auth, (req, res) => {
  const { category, entityId } = req.query;
  const dir = path.join(UPLOAD_DIR, category || '', entityId || '');

  if (!fs.existsSync(dir)) {
    return res.json({ success: true, files: [] });
  }

  try {
    const getAllFiles = (dirPath, base = '') => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const files = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          files.push(...getAllFiles(path.join(dirPath, entry.name), `${base}${entry.name}/`));
        } else {
          const stat = fs.statSync(path.join(dirPath, entry.name));
          files.push({
            filename: entry.name,
            path: `${base}${entry.name}`,
            size: stat.size,
            created: stat.birthtime,
          });
        }
      }
      return files;
    };

    const files = getAllFiles(dir);
    res.json({ success: true, files, count: files.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/upload/:filename — Delete a file
router.delete('/:category/:entityId/:filename', auth, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.category, req.params.entityId, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
