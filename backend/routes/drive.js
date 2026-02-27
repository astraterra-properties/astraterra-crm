/**
 * Google Drive Integration Route — Astraterra CRM
 * Upload and manage property documents via Google Drive
 */

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { authenticateToken: auth } = require("../middleware/auth");

const DRIVE_FOLDER_ID = '10LyPHdzLcmP-EBfqtdtNrJN7k0_tXQT8';
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'google-service-account.json');

function getDriveClient() {
  const credentials = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  const authClient = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth: authClient });
}

// GET /api/drive/files — List files in the main Astraterra folder
router.get('/files', auth, async (req, res) => {
  try {
    const drive = getDriveClient();
    const { folderId } = req.query;

    const response = await drive.files.list({
      q: `'${folderId || DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, createdTime, webViewLink, webContentLink)',
      orderBy: 'createdTime desc',
    });

    res.json({ success: true, files: response.data.files });
  } catch (err) {
    console.error('Drive list error:', err.message);
    res.status(500).json({ error: 'Failed to list files', detail: err.message });
  }
});

// GET /api/drive/folders — List property folders
router.get('/folders', auth, async (req, res) => {
  try {
    const drive = getDriveClient();
    const response = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'name',
    });
    res.json({ success: true, folders: response.data.files });
  } catch (err) {
    console.error('Drive folders error:', err.message);
    res.status(500).json({ error: 'Failed to list folders', detail: err.message });
  }
});

// POST /api/drive/folder — Create a folder for a property
router.post('/folder', auth, async (req, res) => {
  const { name, parentId } = req.body;
  if (!name) return res.status(400).json({ error: 'Folder name is required' });

  try {
    const drive = getDriveClient();
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId || DRIVE_FOLDER_ID],
      },
      fields: 'id, name, webViewLink',
    });
    res.json({ success: true, folder: response.data });
  } catch (err) {
    console.error('Drive folder create error:', err.message);
    res.status(500).json({ error: 'Failed to create folder', detail: err.message });
  }
});

// GET /api/drive/status — Check Drive connection
router.get('/status', auth, async (req, res) => {
  try {
    const drive = getDriveClient();
    const response = await drive.files.get({
      fileId: DRIVE_FOLDER_ID,
      fields: 'id, name',
    });
    res.json({
      success: true,
      connected: true,
      folder: response.data,
      message: 'Google Drive connected successfully',
    });
  } catch (err) {
    res.status(500).json({ success: false, connected: false, error: err.message });
  }
});

module.exports = router;
