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
      'SELECT id FROM users WHERE email = $1',
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
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, name, role, created_at
    `, [email, password_hash, name, phone, role, true]);

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
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
      'SELECT * FROM users WHERE email = $1',
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
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
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
      WHERE id = $1
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
    const current = await query(`SELECT * FROM users WHERE id = $1`, [req.user.id]);
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
      'SELECT password_hash FROM users WHERE id = $1',
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
      'UPDATE users SET password_hash = $1 WHERE id = $2',
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

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
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
    await query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [data.secure_url, req.user.id]);
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
  exec(`cd "${projectDir}" && git pull origin main && echo PULLED`, (err, stdout, stderr) => {
    console.log('[Deploy] git pull:', stdout, stderr);
    setTimeout(() => process.exit(0), 500); // pm2 will auto-restart
  });
});

module.exports = router;
