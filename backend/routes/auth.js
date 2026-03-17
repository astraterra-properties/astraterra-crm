/**
 * Authentication API Routes
 * User login, registration, and token management
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Fallback JWT secret — ensures login never crashes if .env is missing JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'astraterra-crm-jwt-secret-2026-secure-default-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/register
 * Register new user (admin only in production)
 */
router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      phone,
      role = 'agent'
    } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: 'Email, password, and name are required' 
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password — 12 rounds is the current security standard
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await query(`
      INSERT INTO users (email, password_hash, name, phone, role, active)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id, email, name, role, created_at
    `, [email, password_hash, name, phone, role, true]);

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user from database
    const result = await query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.active) {
      return res.status(403).json({ error: 'Account is inactive. Contact administrator.' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        avatar_url: user.avatar_url,
        rera_number: user.rera_number,
        specialty: user.specialty,
        transactions_count: user.transactions_count,
        about: user.about,
        profile_complete: user.profile_complete
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * POST /api/auth/logout
 * User logout (client-side token removal, optional server-side blacklist)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a production app, you might want to blacklist the token
    // For now, just return success (client removes token)
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id, email, name, phone, role, team_id, 
        commission_rate, avatar_url, active, last_login, created_at,
        rera_number, specialty, transactions_count, about, profile_complete
      FROM users 
      WHERE id = ?
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * PUT /api/auth/me
 * Update current user profile
 */
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { name, phone, avatar_url } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (phone) {
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }

    if (avatar_url) {
      updates.push(`avatar_url = $${paramCount}`);
      values.push(avatar_url);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.user.id);
    const result = await query(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, name, phone, role, avatar_url
    `, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * PUT /api/auth/profile
 * Update current user profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, email, avatar_url, rera_number, specialty, transactions_count, about } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) { updates.push(`name = $${paramCount}`); values.push(name); paramCount++; }
    if (phone !== undefined) { updates.push(`phone = $${paramCount}`); values.push(phone); paramCount++; }
    if (email !== undefined) { updates.push(`email = $${paramCount}`); values.push(email); paramCount++; }
    if (avatar_url !== undefined) { updates.push(`avatar_url = $${paramCount}`); values.push(avatar_url); paramCount++; }
    if (rera_number !== undefined) { updates.push(`rera_number = $${paramCount}`); values.push(rera_number); paramCount++; }
    if (specialty !== undefined) { updates.push(`specialty = $${paramCount}`); values.push(specialty); paramCount++; }
    if (transactions_count !== undefined) { updates.push(`transactions_count = $${paramCount}`); values.push(Number(transactions_count) || 0); paramCount++; }
    if (about !== undefined) { updates.push(`about = $${paramCount}`); values.push(about); paramCount++; }

    // Auto-compute profile_complete: required fields must be non-empty
    // We need current values to check — fetch them first
    const current = await query(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
    const cur = current.rows[0] || {};
    const merged = {
      name: name !== undefined ? name : cur.name,
      phone: phone !== undefined ? phone : cur.phone,
      rera_number: rera_number !== undefined ? rera_number : cur.rera_number,
      specialty: specialty !== undefined ? specialty : cur.specialty,
      about: about !== undefined ? about : cur.about,
    };
    const reraRequiredRoles = ['agent', 'sales_manager'];
    const userRole = cur.role || 'agent';
    const reraOk = reraRequiredRoles.includes(userRole) ? !!merged.rera_number : true;
    const isComplete = !!(merged.name && merged.phone && reraOk && merged.specialty && merged.about);
    updates.push(`profile_complete = $${paramCount}`); values.push(isComplete ? 1 : 0); paramCount++;
    updates.push(`updated_at = $${paramCount}`); values.push(new Date().toISOString()); paramCount++;

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.user.id);
    const result = await query(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, name, phone, role, avatar_url, rera_number, specialty, transactions_count, about, profile_complete
    `, values);

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * GET /api/auth/team
 * Get all staff profiles (visible to authenticated users)
 */
router.get('/team', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, email, phone, role, avatar_url, rera_number, specialty, transactions_count, about, profile_complete, created_at
      FROM users
      WHERE active = 1
      ORDER BY role DESC, name ASC
    `, []);
    res.json({ team: result.rows });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ 
        error: 'Current password and new password are required' 
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters' 
      });
    }

    // Get current password hash
    const result = await query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    const user = result.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(current_password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const new_password_hash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [new_password_hash, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * POST /api/auth/verify-token
 * Verify if token is valid
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ valid: false, error: 'Invalid or expired token' });
      }

      res.json({ valid: true, userId: decoded.userId, email: decoded.email });
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

/**
 * POST /api/auth/avatar
 * Upload profile photo → Cloudinary → save avatar_url on user
 */
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const FormData = require('form-data');
const nodeFetch = (() => { try { return require('node-fetch'); } catch(e) { return null; } })();
const avatarUpload = multer({ dest: '/tmp/crm-avatars/' });

const CLOUDINARY_CLOUD  = process.env.CLOUDINARY_CLOUD_NAME  || 'dumt7udjd';
const CLOUDINARY_KEY    = process.env.CLOUDINARY_API_KEY     || '714597318371755';
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET  || 'fJX-95cOy2jkNd-8jz81d6leDZU';

router.post('/avatar', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const fetch = nodeFetch || (await import('node-fetch')).default;
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'crm-avatars';
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(paramsToSign + CLOUDINARY_SECRET).digest('hex');

    const form = new FormData();
    form.append('file', fs.createReadStream(req.file.path), { filename: req.file.originalname || 'avatar.jpg' });
    form.append('folder', folder);
    form.append('timestamp', String(timestamp));
    form.append('api_key', CLOUDINARY_KEY);
    form.append('signature', signature);

    const upload = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: form });
    const data = await upload.json();
    fs.unlink(req.file.path, () => {});
    if (!upload.ok) throw new Error(data.error?.message || 'Upload failed');

    // Save avatar_url on user
    await query(`UPDATE users SET avatar_url = ? WHERE id = ?`, [data.secure_url, req.user.id]);
    res.json({ success: true, avatar_url: data.secure_url });
  } catch (err) {
    console.error('Avatar upload error:', err);
    fs.unlink(req.file?.path || '', () => {});
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Emergency: self-update + restart (no auth, uses deploy secret)
router.post('/deploy', async (req, res) => {
  const secret = req.headers['x-deploy-secret'] || req.body?.secret;
  if (secret !== 'astra-deploy-2026-secure') return res.status(403).json({ error: 'Forbidden' });
  res.json({ status: 'deploying', message: 'git pull + restart in progress...' });
  const { exec } = require('child_process');
  // Find the project directory
  const dirs = ['/root/astraterra-crm', '/home/ubuntu/astraterra-crm', process.cwd() + '/..', process.cwd()];
  let projectDir = dirs.find(d => { try { require('fs').accessSync(d + '/.git'); return true; } catch(e) { return false; } });
  if (!projectDir) projectDir = process.cwd();
  exec(`cd "${projectDir}" && git fetch origin && git reset --hard origin/main && node backend/scripts/migrate.js && echo PULLED`, { timeout: 120000 }, (err, stdout, stderr) => {
    console.log('[Deploy] git pull + migrate + build:', stdout, stderr);
    setTimeout(() => process.exit(0), 1000); // pm2 will auto-restart
  });
});

/**
 * POST /api/auth/forgot-password
 * Request a password reset — generates token and emails a link (or returns token for admin direct-use)
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const result = await query('SELECT id, email, name FROM users WHERE email = ?', [email]);
    // Always return 200 to avoid user enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const user = result.rows[0];
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    // Store token in DB
    await query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [token, expires, user.id]
    );

    const resetUrl = `https://crm.astraterra.ae/reset-password?token=${token}`;

    // Send reset email via Gmail OAuth (reuse same helper from email-own)
    try {
      const { google } = require('googleapis');
      const oauth2Client = new google.auth.OAuth2(
        '755978414447-dsptstqakm3jna7li6fm5hnlmr7ogv5m.apps.googleusercontent.com',
        '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',
        'http://localhost'
      );
      oauth2Client.setCredentials({ refresh_token: '1//0gxC7sM6PDgb3CgYIARAAGBASNwF-L9IrUGzadEquKq6GV6dpyD5WnhLZ2ZvwWZrq2-6BFaZrAwxlRWhooC6XLvHXpgNIFTNK24A' });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#131B2B;color:#fff;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#C9A96E,#8A6F2F);height:4px"></div>
          <div style="padding:40px 32px">
            <h2 style="margin:0 0 8px;color:#C9A96E;font-size:22px">Password Reset Request</h2>
            <p style="margin:0 0 24px;color:#9ca3af;font-size:14px">Astraterra CRM — crm.astraterra.ae</p>
            <p style="margin:0 0 20px;font-size:15px">Hi ${user.name},</p>
            <p style="margin:0 0 28px;font-size:15px;color:#d1d5db">Click the button below to reset your password. This link expires in <strong style="color:#C9A96E">1 hour</strong>.</p>
            <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#C9A96E,#8A6F2F);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px">Reset My Password</a>
            <p style="margin:28px 0 0;font-size:12px;color:#6b7280">If you didn't request this, ignore this email. Your password won't change.</p>
          </div>
        </div>`;

      const rawMessage = [
        `From: "Astraterra CRM" <admin@astraterra.ae>`,
        `To: ${user.email}`,
        `Subject: Reset your CRM password`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        '',
        html
      ].join('\r\n');

      const encoded = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
    } catch (mailErr) {
      console.error('[ForgotPassword] Email send failed:', mailErr.message);
      // Don't fail the request — still return success
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token from email link
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const result = await query(
      "SELECT id, email, name, reset_token_expires FROM users WHERE reset_token = ?",
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const user = result.rows[0];

    // Check expiry
    if (new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    await query(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
      [password_hash, user.id]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;

// ─── TEMPORARY: DB Restore endpoint — remove after use ──────────────────────
const multerRestore = require('multer')({ dest: '/tmp/', limits: { fileSize: 100 * 1024 * 1024 } });
const fsRestore = require('fs');
const pathRestore = require('path');

router.post('/restore-db', multerRestore.single('db'), (req, res) => {
  const secret = req.headers['x-restore-secret'];
  if (secret !== 'astra-restore-db-2026-secure') return res.status(403).json({ error: 'Forbidden' });
  if (!req.file) return res.status(400).json({ error: 'No DB file uploaded' });

  const DB_PATH = pathRestore.join(__dirname, '../../../../data/astraterra-crm.db');
  const dataDir = pathRestore.dirname(DB_PATH);
  if (!fsRestore.existsSync(dataDir)) fsRestore.mkdirSync(dataDir, { recursive: true });

  // Backup existing
  if (fsRestore.existsSync(DB_PATH)) {
    fsRestore.copyFileSync(DB_PATH, DB_PATH + '.backup-' + Date.now());
  }

  fsRestore.copyFileSync(req.file.path, DB_PATH);
  try { fsRestore.unlinkSync(req.file.path); } catch(e) {}

  res.json({ success: true, message: 'DB uploaded. Run: pm2 restart astraterra-backend', size: req.file.size });
});
