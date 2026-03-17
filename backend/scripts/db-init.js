#!/usr/bin/env node
/**
 * Database Initialization Script — Astraterra CRM
 * 
 * Creates all required tables with correct SQLite syntax.
 * Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS).
 * NO regex replacements on CURRENT_TIMESTAMP — uses datetime('now') directly.
 * 
 * Usage:
 *   node db-init.js           # Initialize all tables
 *   node db-init.js --reset   # Drop and recreate all tables (DESTRUCTIVE)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../../../data/astraterra-crm.db');
const RESET_MODE = process.argv.includes('--reset');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log(`📂 Database: ${DB_PATH}`);
console.log(`🔧 Mode: ${RESET_MODE ? '⚠️  RESET (drop + recreate)' : 'Safe (create if not exists)'}`);

const db = new sqlite3.Database(DB_PATH);
db.run('PRAGMA foreign_keys = ON');
db.run('PRAGMA journal_mode = WAL');

// All table definitions — using datetime('now') NOT CURRENT_TIMESTAMP in DEFAULT clauses
const TABLES = [
  // Core CRM tables
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'agent',
    active INTEGER DEFAULT 1,
    profile_complete INTEGER DEFAULT 0,
    rera_number TEXT,
    specialty TEXT,
    total_transactions INTEGER DEFAULT 0,
    transactions_count INTEGER DEFAULT 0,
    about TEXT,
    avatar_url TEXT,
    reset_token TEXT,
    reset_token_expires TEXT,
    last_login TEXT,
    team_id INTEGER,
    commission_rate REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER REFERENCES contacts(id),
    name TEXT,
    email TEXT,
    phone TEXT,
    source TEXT DEFAULT 'manual',
    source_url TEXT,
    source_channel TEXT,
    status TEXT DEFAULT 'new',
    stage TEXT DEFAULT 'new_lead',
    pipeline_stage TEXT DEFAULT 'new_lead',
    priority TEXT DEFAULT 'medium',
    lead_type TEXT DEFAULT 'buyer',
    score INTEGER DEFAULT 50,
    assigned_to INTEGER REFERENCES users(id),
    assigned_agent TEXT,
    budget REAL,
    currency TEXT DEFAULT 'AED',
    requirements TEXT,
    property_type TEXT,
    location_preference TEXT,
    bedrooms TEXT,
    purpose TEXT,
    timeline TEXT,
    tags TEXT,
    notes TEXT,
    whatsapp_number TEXT,
    last_contacted TEXT,
    next_follow_up TEXT,
    next_followup_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    nationality TEXT,
    language TEXT,
    type TEXT DEFAULT 'buyer',
    status TEXT DEFAULT 'active',
    property_type TEXT,
    bedrooms TEXT,
    budget_min REAL,
    budget_max REAL,
    location_preference TEXT,
    purpose TEXT DEFAULT 'Buy',
    timeline TEXT,
    must_haves TEXT,
    nice_to_haves TEXT,
    source TEXT,
    source_details TEXT,
    lead_source TEXT,
    lead_source_status TEXT,
    lead_pool INTEGER DEFAULT 0,
    tags TEXT,
    notes TEXT,
    last_contacted TEXT,
    next_follow_up TEXT,
    assigned_to INTEGER REFERENCES users(id),
    assigned_agent TEXT,
    assigned_agent_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id TEXT,
    title TEXT,
    type TEXT,
    property_type TEXT,
    location TEXT,
    community TEXT,
    building TEXT,
    unit_number TEXT,
    floor TEXT,
    bedrooms INTEGER,
    bathrooms INTEGER,
    size REAL,
    price REAL,
    currency TEXT DEFAULT 'AED',
    purpose TEXT DEFAULT 'sale',
    furnished TEXT DEFAULT 'unfurnished',
    description TEXT,
    features TEXT,
    images TEXT,
    floor_plan TEXT,
    video_url TEXT,
    owner_name TEXT,
    owner_contact TEXT,
    owner_email TEXT,
    owner_id INTEGER,
    status TEXT DEFAULT 'available',
    listed_date TEXT,
    permit_number TEXT,
    rera_number TEXT,
    agent_id INTEGER,
    assigned_to INTEGER REFERENCES users(id),
    notes TEXT,
    views INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    lead_id INTEGER,
    property_id INTEGER,
    agent_id INTEGER,
    deal_type TEXT DEFAULT 'sale',
    value REAL DEFAULT 0,
    commission_rate REAL DEFAULT 2,
    commission_amount REAL DEFAULT 0,
    stage TEXT DEFAULT 'negotiation',
    status TEXT DEFAULT 'active',
    expected_close_date TEXT,
    actual_close_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (agent_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'general',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    assigned_to INTEGER,
    lead_id INTEGER,
    deal_id INTEGER,
    due_date TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'viewing',
    location TEXT,
    start_time TEXT,
    end_time TEXT,
    lead_id INTEGER,
    property_id INTEGER,
    organizer_id INTEGER,
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (organizer_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS viewings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER,
    lead_id INTEGER,
    agent_id INTEGER,
    viewing_date TEXT,
    status TEXT DEFAULT 'scheduled',
    feedback TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (agent_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    file_url TEXT,
    file_size INTEGER,
    mime_type TEXT,
    entity_type TEXT,
    entity_id INTEGER,
    uploaded_by INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS communications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT DEFAULT 'note',
    subject TEXT,
    body TEXT,
    lead_id INTEGER,
    contact_id INTEGER,
    user_id INTEGER,
    direction TEXT DEFAULT 'outbound',
    status TEXT DEFAULT 'sent',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    user_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    link TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  // Chat system
  `CREATE TABLE IF NOT EXISTS chat_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT DEFAULT 'group',
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS chat_room_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(room_id, user_id)
  )`,

  `CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'text',
    reply_to_id INTEGER,
    deleted_at TEXT,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS chat_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    user_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(message_id, user_id)
  )`,

  `CREATE TABLE IF NOT EXISTS chat_typing (
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY(room_id, user_id)
  )`,

  // HR & Accounting
  `CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT DEFAULT 'Agent',
    department TEXT DEFAULT 'Sales',
    contract_type TEXT DEFAULT 'full-time',
    start_date TEXT,
    base_salary REAL DEFAULT 0,
    currency TEXT DEFAULT 'AED',
    payment_frequency TEXT DEFAULT 'monthly',
    iban TEXT,
    bank_name TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT,
    crm_user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS salary_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    pay_month TEXT NOT NULL,
    base_amount REAL DEFAULT 0,
    bonus REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    net_amount REAL DEFAULT 0,
    payment_date TEXT,
    payment_method TEXT DEFAULT 'bank_transfer',
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`,

  `CREATE TABLE IF NOT EXISTS commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    deal_id INTEGER,
    deal_title TEXT,
    amount REAL DEFAULT 0,
    percentage REAL DEFAULT 0,
    commission_date TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`,

  `CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT DEFAULT 'General',
    description TEXT NOT NULL,
    amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'AED',
    expense_date TEXT,
    paid_by_employee_id INTEGER,
    receipt_url TEXT,
    status TEXT DEFAULT 'pending',
    approved_by INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (paid_by_employee_id) REFERENCES employees(id)
  )`,

  `CREATE TABLE IF NOT EXISTS leaves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    type TEXT DEFAULT 'annual',
    start_date TEXT,
    end_date TEXT,
    days INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    approved_by INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`,

  `CREATE TABLE IF NOT EXISTS training_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'course',
    provider TEXT,
    completion_date TEXT,
    certificate_url TEXT,
    status TEXT DEFAULT 'in_progress',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`,

  // Accounting
  `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'asset',
    code TEXT,
    balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'AED',
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS accounting_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    type TEXT DEFAULT 'debit',
    amount REAL DEFAULT 0,
    description TEXT,
    reference TEXT,
    category TEXT,
    transaction_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  )`,

  `CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE,
    client_name TEXT,
    client_email TEXT,
    amount REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL DEFAULT 0,
    currency TEXT DEFAULT 'AED',
    status TEXT DEFAULT 'draft',
    due_date TEXT,
    paid_date TEXT,
    notes TEXT,
    deal_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    total REAL DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  )`,

  `CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    bank_name TEXT,
    account_number TEXT,
    iban TEXT,
    currency TEXT DEFAULT 'AED',
    balance REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_account_id INTEGER,
    type TEXT DEFAULT 'credit',
    amount REAL DEFAULT 0,
    description TEXT,
    reference TEXT,
    transaction_date TEXT,
    reconciled INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
  )`,

  `CREATE TABLE IF NOT EXISTS reconciliations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_account_id INTEGER,
    period TEXT,
    bank_balance REAL DEFAULT 0,
    book_balance REAL DEFAULT 0,
    difference REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
  )`,

  // Teams & KPIs
  `CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    leader_id INTEGER,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (leader_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS agent_kpis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    period TEXT,
    leads_assigned INTEGER DEFAULT 0,
    leads_converted INTEGER DEFAULT 0,
    viewings_done INTEGER DEFAULT 0,
    deals_closed INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    commission_earned REAL DEFAULT 0,
    rating REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  // Listings
  `CREATE TABLE IF NOT EXISTS sale_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER,
    permit_number TEXT,
    listing_agent_id INTEGER,
    price REAL,
    status TEXT DEFAULT 'active',
    portal_status TEXT DEFAULT 'not_listed',
    featured INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    inquiries INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (listing_agent_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS rent_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER,
    permit_number TEXT,
    listing_agent_id INTEGER,
    annual_rent REAL,
    payment_terms TEXT DEFAULT 'annual',
    status TEXT DEFAULT 'active',
    portal_status TEXT DEFAULT 'not_listed',
    views INTEGER DEFAULT 0,
    inquiries INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (listing_agent_id) REFERENCES users(id)
  )`,

  // Portal Integrations
  `CREATE TABLE IF NOT EXISTS portal_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portal_name TEXT NOT NULL,
    api_key TEXT,
    api_secret TEXT,
    agent_id TEXT,
    status TEXT DEFAULT 'inactive',
    last_sync TEXT,
    config TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  // Pixxi CRM sync
  `CREATE TABLE IF NOT EXISTS pixxi_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_url TEXT,
    api_key TEXT,
    sync_enabled INTEGER DEFAULT 0,
    last_sync TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS pixxi_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pixxi_id TEXT,
    local_lead_id INTEGER,
    sync_status TEXT DEFAULT 'synced',
    last_sync TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (local_lead_id) REFERENCES leads(id)
  )`,

  `CREATE TABLE IF NOT EXISTS pixxi_properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pixxi_id TEXT,
    local_property_id INTEGER,
    sync_status TEXT DEFAULT 'synced',
    last_sync TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (local_property_id) REFERENCES properties(id)
  )`,

  // Offplan
  `CREATE TABLE IF NOT EXISTS offplan_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    developer TEXT,
    location TEXT,
    community TEXT,
    type TEXT,
    status TEXT DEFAULT 'upcoming',
    launch_date TEXT,
    completion_date TEXT,
    starting_price REAL,
    description TEXT,
    features TEXT,
    payment_plan TEXT,
    images TEXT,
    brochure_url TEXT,
    agent_id INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES users(id)
  )`,

  // Communities & Developers
  `CREATE TABLE IF NOT EXISTS communities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT DEFAULT 'Dubai',
    district TEXT,
    description TEXT,
    avg_sale_price REAL,
    avg_rent_price REAL,
    amenities TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS developers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    website TEXT,
    phone TEXT,
    email TEXT,
    description TEXT,
    projects_count INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  // Email & Social
  `CREATE TABLE IF NOT EXISTS email_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    status TEXT DEFAULT 'draft',
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS email_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    recipient_email TEXT,
    status TEXT DEFAULT 'pending',
    opened INTEGER DEFAULT 0,
    clicked INTEGER DEFAULT 0,
    sent_at TEXT,
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'active',
    source TEXT DEFAULT 'website',
    subscribed_at TEXT DEFAULT (datetime('now')),
    unsubscribed_at TEXT
  )`,

  // Misc
  `CREATE TABLE IF NOT EXISTS brochure_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    project_name TEXT,
    project_slug TEXT,
    brochure_url TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complainant_name TEXT NOT NULL,
    complainant_email TEXT,
    complainant_phone TEXT,
    subject TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    assigned_to INTEGER,
    resolution TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS property_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    property_id INTEGER,
    score REAL DEFAULT 0,
    status TEXT DEFAULT 'suggested',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (property_id) REFERENCES properties(id)
  )`,

  `CREATE TABLE IF NOT EXISTS lead_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    type TEXT DEFAULT 'note',
    description TEXT,
    user_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS applicants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    position TEXT,
    resume_url TEXT,
    status TEXT DEFAULT 'new',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS whatsapp_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    recipient_name TEXT,
    message TEXT NOT NULL,
    notification_type TEXT DEFAULT 'general',
    status TEXT DEFAULT 'pending',
    sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id INTEGER,
    status TEXT DEFAULT 'success',
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];

async function run() {
  let success = 0;
  let failed = 0;
  
  for (const sql of TABLES) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 'unknown';
    
    try {
      if (RESET_MODE) {
        await new Promise((resolve, reject) => {
          db.run(`DROP TABLE IF EXISTS ${tableName}`, (err) => {
            if (err) reject(err); else resolve();
          });
        });
      }
      
      await new Promise((resolve, reject) => {
        db.run(sql, (err) => {
          if (err) reject(err); else resolve();
        });
      });
      
      success++;
    } catch (e) {
      console.error(`❌ Failed: ${tableName} — ${e.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Result: ${success} tables OK, ${failed} failed out of ${TABLES.length} total`);
  
  // Verify all tables exist
  const existing = await new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
      if (err) reject(err); else resolve(rows.map(r => r.name));
    });
  });
  
  console.log(`📋 Tables in database: ${existing.length}`);
  console.log(`   ${existing.join(', ')}`);
  
  db.close();
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Suggestions table migration (run after main tables)
async function ensureSuggestionsTable(db) {
  return new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      category TEXT DEFAULT 'General Feedback',
      message TEXT NOT NULL,
      source TEXT DEFAULT 'website',
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now'))
    )`, (err) => {
      if (err) console.error('[db-init] suggestions table error:', err.message);
      else console.log('✅ Suggestions table initialized');
      resolve();
    });
  });
}

// Export for programmatic use
module.exports = { TABLES, run, ensureSuggestionsTable };

// Run if executed directly
if (require.main === module) {
  run().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}
