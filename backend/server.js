/**
 * Astraterra CRM - Backend API Server
 * Main Express server with all API endpoints
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { pool } = require('./config/database');

// Load environment variables
dotenv.config();

// ── Crash Protection ──────────────────────────────────────────────────────────
// Prevent unhandled errors from killing the entire process
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] [UNCAUGHT EXCEPTION] ${err.message}`);
  console.error(err.stack);
  // Keep the process alive — do NOT exit
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] [UNHANDLED REJECTION]`, reason);
  // Keep the process alive — do NOT exit
});

// Graceful shutdown on SIGTERM/SIGINT
process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] SIGTERM received — shutting down gracefully`);
  process.exit(0);
});
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
// ⚠️ Always use 3001 — OpenClaw sets PORT=59053 in shell env which must be ignored
const PORT = 3001;

// Test database connection on startup
pool.query("SELECT datetime('now') as now", (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.log('⚠️  Server starting without database. Some features will not work.');
  } else {
    console.log('✅ Database connected at:', res.rows[0]?.now || 'now');
  }
});

// Initialize HR/Accounting tables
(async () => {
  const { query: dbQuery } = require('./config/database');
  try {
    await dbQuery(`CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, phone TEXT,
      role TEXT DEFAULT 'Agent', department TEXT DEFAULT 'Sales',
      contract_type TEXT DEFAULT 'full-time', start_date TEXT, base_salary REAL DEFAULT 0,
      currency TEXT DEFAULT 'AED', payment_frequency TEXT DEFAULT 'monthly',
      iban TEXT, bank_name TEXT, status TEXT DEFAULT 'active', notes TEXT, crm_user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
    await dbQuery(`CREATE TABLE IF NOT EXISTS salary_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, pay_month TEXT NOT NULL,
      base_amount REAL DEFAULT 0, bonus REAL DEFAULT 0, deductions REAL DEFAULT 0,
      net_amount REAL DEFAULT 0, payment_date TEXT, payment_method TEXT DEFAULT 'bank_transfer',
      status TEXT DEFAULT 'pending', notes TEXT, created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id))`);
    await dbQuery(`CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER, deal_id INTEGER, deal_title TEXT,
      amount REAL DEFAULT 0, percentage REAL DEFAULT 0, commission_date TEXT,
      status TEXT DEFAULT 'pending', notes TEXT, created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id))`);
    await dbQuery(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT DEFAULT 'General', description TEXT NOT NULL,
      amount REAL DEFAULT 0, currency TEXT DEFAULT 'AED', expense_date TEXT,
      paid_by_employee_id INTEGER, receipt_url TEXT, status TEXT DEFAULT 'pending',
      approved_by INTEGER, notes TEXT, created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (paid_by_employee_id) REFERENCES employees(id))`);
    console.log('✅ HR/Accounting tables initialized');
  } catch (e) {
    console.error('HR table init error:', e.message);
  }
})();

// Initialize Documents table
(async () => {
  const { query: dbQuery } = require('./config/database');
  try {
    await dbQuery(`CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      category TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT 'company',
      entity_id INTEGER,
      entity_name TEXT,
      drive_file_id TEXT,
      drive_view_link TEXT,
      drive_download_link TEXT,
      drive_folder_id TEXT,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT,
      notes TEXT,
      uploaded_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    console.log('✅ Documents table initialized');
  } catch (e) {
    console.error('Documents table init error:', e.message);
  }
})();

// Initialize Brochure Leads table
(async () => {
  const { query: dbQuery } = require('./config/database');
  try {
    await dbQuery(`CREATE TABLE IF NOT EXISTS brochure_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, project_name TEXT, project_slug TEXT, brochure_url TEXT, ip_address TEXT, created_at TEXT DEFAULT (datetime('now')))`);
    console.log('✅ Brochure leads table initialized');
  } catch (e) {
    console.error('Brochure leads table init error:', e.message);
  }
})();

// Initialize Complaints table
(async () => {
  const { query: dbQuery } = require('./config/database');
  try {
    await dbQuery(`CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      property_ref TEXT DEFAULT '',
      nature TEXT DEFAULT '',
      details TEXT NOT NULL,
      resolution TEXT DEFAULT '',
      submitted_at TEXT DEFAULT '',
      source TEXT DEFAULT 'website-complaints-form',
      status TEXT DEFAULT 'New',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    console.log('✅ Complaints table initialized');
  } catch (e) {
    console.error('Complaints table init error:', e.message);
  }
})();

// Initialize Notifications table
(async () => {
  const { query: dbQuery } = require('./config/database');
  try {
    await dbQuery(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT DEFAULT 'info',
      icon TEXT DEFAULT '🔔',
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      link TEXT DEFAULT '',
      meta TEXT DEFAULT '{}',
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    console.log('✅ Notifications table initialized');
  } catch (e) {
    console.error('Notifications table init error:', e.message);
  }
})();

// Initialize Portal Integrations table + seed default portals
(async () => {
  const { query: dbQuery } = require('./config/database');
  try {
    await dbQuery(`CREATE TABLE IF NOT EXISTS portal_integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portal_name TEXT NOT NULL UNIQUE,
      api_key TEXT,
      api_secret TEXT,
      account_id TEXT,
      status TEXT DEFAULT 'disconnected',
      last_sync TEXT,
      leads_synced INTEGER DEFAULT 0,
      listings_synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);
    // Seed default portals — INSERT OR IGNORE is safe with UNIQUE constraint on portal_name
    const defaults = ['Bayut', 'Property Finder', 'Dubizzle'];
    for (const name of defaults) {
      await dbQuery(
        `INSERT OR IGNORE INTO portal_integrations (portal_name, status) VALUES ($1, 'disconnected')`,
        [name]
      ).catch(() => {}); // silently ignore if already exists
    }
    // Seed Website integration — always connected
    await dbQuery(
      `INSERT OR IGNORE INTO portal_integrations (portal_name, status) VALUES ('Website', 'connected')`,
      []
    ).catch(() => {});
    console.log('✅ Portal integrations table initialized');
  } catch (e) {
    console.error('Portal integrations init error:', e.message);
  }
})();

// Trust the first proxy (Cloudflare / nginx) so rate limiting uses real client IP
app.set('trust proxy', 1);

// ── Security Middleware ───────────────────────────────────────────────────────

// Helmet — sets secure HTTP headers (XSS, clickjacking, MIME sniffing, HSTS, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // disabled — Next.js frontend manages its own CSP
  crossOriginEmbedderPolicy: false, // needed for Jitsi iframe
  hsts: {
    maxAge: 31536000,       // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Rate limiter for auth endpoints — prevents brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15-minute window
  max: 20,                      // max 20 auth attempts per window per IP
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1-minute window
  max: 300,               // max 300 requests/min per IP
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/internal/'), // skip internal queue polling
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', apiLimiter);

// Middleware
app.use(cors({
  origin: [
    'https://crm.astraterra.ae',
    'https://www.astraterra.ae',
    'https://astraterra.ae',
    'http://localhost:3000',   // kept for local development
    'http://localhost:3001',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', require('express').static(require('path').join(__dirname, '..', 'data', 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Astraterra CRM API is running' });
});

// API Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const leadsRoutes = require('./routes/leads');
const contactsRoutes = require('./routes/contacts');
const propertiesRoutes = require('./routes/properties');
const dealsRoutes = require('./routes/deals');
const viewingsRoutes = require('./routes/viewings');
const commissionsRoutes = require('./routes/commissions');
const tasksRoutes = require('./routes/tasks');
const usersRoutes = require('./routes/users');
const reportsRoutes = require('./routes/reports');
const emailRoutes = require('./routes/email');
const driveRoutes = require('./routes/drive');
const uploadRoutes = require('./routes/upload');
const searchRoutes = require('./routes/search');
const offplanRoutes = require('./routes/offplan');
const developersRoutes = require('./routes/developers');
const communitiesRoutes = require('./routes/communities');
const saleListingsRoutes = require('./routes/sale-listings');
const rentListingsRoutes = require('./routes/rent-listings');
const portalsRoutes = require('./routes/portals');
const leadActivityRoutes = require('./routes/lead-activity');
const socialRoutes = require('./routes/social');
const hrRoutes = require('./routes/hr');
const pixxiRoutes = require('./routes/pixxi');
const complaintsRoutes = require('./routes/complaints');
const documentsRoutes = require('./routes/documents');
const brochureLeadsRoutes = require('./routes/brochureLeads');
const notificationsRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');
const oversightRoutes = require('./routes/oversight');
const meetingsRoutes = require('./routes/meetings');

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/portals', portalsRoutes);         // ⚠️ Must be before /api catchall — webhook routes are public
app.use('/api/notifications', notificationsRoutes); // ⚠️ Must be before /api catchall
app.use('/api/email-own', require('./routes/email-own')); // ⚠️ Must be before /api catchall — /welcome + /subscribe are public
// Public inbound lead webhook (no auth) — extracted from leadActivityRoutes to avoid wildcard /:contactId interference
app.post('/api/leads/inbound', require('./routes/inbound-lead'));
app.use('/api/leads', leadsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/viewings', viewingsRoutes);
app.use('/api/commissions', commissionsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/offplan', offplanRoutes);
app.use('/api/developers', developersRoutes);
app.use('/api/communities', communitiesRoutes);
app.use('/api/sale-listings', saleListingsRoutes);
app.use('/api/rent-listings', rentListingsRoutes);
app.use('/api/lead-activity', leadActivityRoutes); // activity log (authenticated)
app.use('/api/social', socialRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/pixxi', pixxiRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/brochure-leads', brochureLeadsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/oversight', oversightRoutes);

// ══ PROXY: Futures Pro Bot API ═════════════════════════════════════════════════
// Forward /api/futures-pro/* requests to localhost:4509/pro/*
app.all('/api/futures-pro/:path(*)', async (req, res) => {
  try {
    const targetUrl = `http://localhost:4509/pro/${req.params.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;
    const config = {
      method: req.method,
      timeout: 10000,
      validateStatus: () => true, // Don't throw on any status
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      config.data = req.body;
    }
    const response = await axios(targetUrl, config);
    
    // Filter out headers that shouldn't be passed through
    const headersToExclude = [
      'transfer-encoding',
      'content-encoding',
      'content-length',
      'connection',
      'keep-alive',
      'server',
    ];
    const filteredHeaders = {};
    Object.entries(response.headers).forEach(([key, value]) => {
      if (!headersToExclude.includes(key.toLowerCase())) {
        filteredHeaders[key] = value;
      }
    });
    
    res.status(response.status).set(filteredHeaders).send(response.data);
  } catch (error) {
    console.error('[Futures Pro Proxy]', error.message);
    res.status(503).json({ error: 'Futures Pro API unavailable', details: error.message });
  }
});

// Internal: WhatsApp notification queue (no auth token — uses secret header)
const WA_SECRET = process.env.WA_QUEUE_SECRET || 'astra-wa-queue-2026';
app.get('/api/internal/whatsapp-queue', async (req, res) => {
  if (req.headers['x-queue-secret'] !== WA_SECRET) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { query: q } = require('./config/database-sqlite');
    const result = await q(`SELECT * FROM whatsapp_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 20`, []);
    res.json({ notifications: result.rows });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});
app.post('/api/internal/whatsapp-queue/:id/sent', async (req, res) => {
  if (req.headers['x-queue-secret'] !== WA_SECRET) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { query: q } = require('./config/database-sqlite');
    await q(`UPDATE whatsapp_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});
// (portals + notifications registered above before /api catchall)

// Lead Pool Stats endpoint (direct)
app.get('/api/lead-pool/stats', require('./middleware/auth').authenticateToken, async (req, res) => {
  const { query } = require('./config/database');
  try {
    const totalResult   = await query(`SELECT COUNT(*) as total FROM contacts WHERE lead_pool = 1`);
    const byStatusResult = await query(`
      SELECT lead_source_status as status, COUNT(*) as count
      FROM contacts WHERE lead_pool = 1
      GROUP BY lead_source_status ORDER BY count DESC
    `);
    const byTypeResult  = await query(`
      SELECT type, COUNT(*) as count FROM contacts WHERE lead_pool = 1
      GROUP BY type ORDER BY count DESC
    `);
    const assignedResult = await query(`
      SELECT COUNT(*) as assigned FROM contacts WHERE lead_pool = 1 AND assigned_agent IS NOT NULL
    `);
    const unassignedResult = await query(`
      SELECT COUNT(*) as unassigned FROM contacts WHERE lead_pool = 1 AND assigned_agent IS NULL
    `);
    res.json({
      total:      parseInt(totalResult.rows[0].total),
      assigned:   parseInt(assignedResult.rows[0].assigned),
      unassigned: parseInt(unassignedResult.rows[0].unassigned),
      byStatus:   byStatusResult.rows,
      byType:     byTypeResult.rows,
    });
  } catch (e) {
    console.error('Lead pool stats error:', e);
    res.status(500).json({ error: 'Failed to fetch lead pool stats' });
  }
});

// Global stats endpoint
app.get('/api/stats', async (req, res) => {
  const { query } = require('./config/database');
  try {
    const totals = await query(`
      SELECT
        COUNT(*) as total_contacts,
        SUM(CASE WHEN lead_pool = 1 THEN 1 ELSE 0 END) as lead_pool_count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN type = 'tenant' THEN 1 ELSE 0 END) as rent_leads,
        SUM(CASE WHEN type = 'buyer' THEN 1 ELSE 0 END) as buy_leads
      FROM contacts
    `);
    res.json({ ok: true, db: totals.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Astraterra CRM API running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/health`);
});

module.exports = app;
