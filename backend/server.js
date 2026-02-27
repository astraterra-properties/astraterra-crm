/**
 * Astraterra CRM - Backend API Server
 * Main Express server with all API endpoints
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
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
const PORT = process.env.PORT || 3001;

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
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
app.use('/api/portals', portalsRoutes);
app.use('/api/lead-activity', leadActivityRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/pixxi', pixxiRoutes);
app.use('/api', leadActivityRoutes); // for /api/leads/inbound webhook

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
