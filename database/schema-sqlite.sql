-- Astraterra CRM - SQLite Schema
-- Simplified version for development/testing

-- Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'agent',
    team_id INTEGER,
    commission_rate REAL DEFAULT 0.00,
    avatar_url TEXT,
    active INTEGER DEFAULT 1,
    last_login TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Contacts Database
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    type TEXT DEFAULT 'buyer',
    location_preference TEXT,
    budget_min REAL,
    budget_max REAL,
    property_type TEXT,
    bedrooms INTEGER,
    purpose TEXT,
    timeline TEXT,
    must_haves TEXT,
    nice_to_haves TEXT,
    source TEXT,
    source_details TEXT,
    notes TEXT,
    tags TEXT,
    assigned_to INTEGER REFERENCES users(id),
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Leads Management
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER REFERENCES contacts(id),
    status TEXT NOT NULL DEFAULT 'not_contacted',
    priority TEXT DEFAULT 'medium',
    assigned_to INTEGER REFERENCES users(id),
    budget REAL,
    requirements TEXT,
    notes TEXT,
    source TEXT,
    source_url TEXT,
    last_contact_date TEXT,
    next_follow_up TEXT,
    follow_up_notes TEXT,
    score INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Properties/Listings
CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id TEXT UNIQUE,
    title TEXT,
    type TEXT,
    location TEXT,
    bedrooms INTEGER,
    bathrooms INTEGER,
    size REAL,
    price REAL,
    purpose TEXT,
    furnished INTEGER DEFAULT 0,
    owner_name TEXT,
    owner_contact TEXT,
    owner_email TEXT,
    description TEXT,
    key_features TEXT,
    status TEXT DEFAULT 'available',
    photos TEXT,
    documents TEXT,
    listed_date TEXT,
    sold_rented_date TEXT,
    assigned_to INTEGER REFERENCES users(id),
    views_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Deals/Transactions
CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_number TEXT UNIQUE,
    lead_id INTEGER REFERENCES leads(id),
    property_id INTEGER REFERENCES properties(id),
    contact_id INTEGER REFERENCES contacts(id),
    agent_id INTEGER REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    deal_type TEXT,
    deal_value REAL,
    commission_percentage REAL,
    commission_amount REAL,
    start_date TEXT,
    expected_close_date TEXT,
    actual_close_date TEXT,
    documents TEXT,
    timeline TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Viewings/Appointments
CREATE TABLE IF NOT EXISTS viewings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER REFERENCES properties(id),
    contact_id INTEGER REFERENCES contacts(id),
    lead_id INTEGER REFERENCES leads(id),
    agent_id INTEGER REFERENCES users(id),
    scheduled_at TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status TEXT DEFAULT 'scheduled',
    feedback TEXT,
    rating INTEGER,
    follow_up_required INTEGER DEFAULT 0,
    follow_up_notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Commission Tracking
CREATE TABLE IF NOT EXISTS commissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id INTEGER REFERENCES deals(id),
    broker_id INTEGER REFERENCES users(id),
    broker_name TEXT,
    commission_type TEXT,
    percentage REAL,
    amount REAL,
    status TEXT DEFAULT 'pending',
    payment_date TEXT,
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tasks Management
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    related_type TEXT,
    related_id INTEGER,
    due_date TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    completed_at TEXT,
    reminder_sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Communications Log
CREATE TABLE IF NOT EXISTS communications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER REFERENCES contacts(id),
    user_id INTEGER REFERENCES users(id),
    type TEXT,
    direction TEXT,
    content TEXT,
    duration_seconds INTEGER,
    attachments TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    manager_id INTEGER REFERENCES users(id),
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Property-Contact Matches
CREATE TABLE IF NOT EXISTS property_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER REFERENCES contacts(id),
    property_id INTEGER REFERENCES properties(id),
    match_score INTEGER,
    match_criteria TEXT,
    status TEXT DEFAULT 'suggested',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT,
    entity_type TEXT,
    entity_id INTEGER,
    changes TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
