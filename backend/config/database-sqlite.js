/**
 * SQLite Database Configuration (for testing/development)
 * Falls back to SQLite when PostgreSQL is not available
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path
const DB_PATH = path.join(__dirname, '../../../data/astraterra-crm.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ SQLite connection failed:', err.message);
  } else {
    console.log('✅ SQLite database connected at:', DB_PATH);
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Run migrations (wrapped in try/catch for idempotency)
const migrations = [
  // ── Core tables (run first — other tables may depend on users) ──────────────
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
    about TEXT,
    avatar_url TEXT,
    last_login TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  // ── Password reset columns ──────────────────────────────────────────────────
  "ALTER TABLE users ADD COLUMN reset_token TEXT",
  "ALTER TABLE users ADD COLUMN reset_token_expires TEXT",
  // ── Chat tables ─────────────────────────────────────────────────────────────
  "ALTER TABLE chat_messages ADD COLUMN reply_to_id INTEGER",
  "ALTER TABLE chat_messages ADD COLUMN deleted_at DATETIME",
  "ALTER TABLE chat_messages ADD COLUMN file_url TEXT",
  "ALTER TABLE chat_messages ADD COLUMN file_name TEXT",
  "ALTER TABLE chat_messages ADD COLUMN file_type TEXT",
  `CREATE TABLE IF NOT EXISTS chat_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    user_name TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(message_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS chat_typing (
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT,
    updated_at DATETIME DEFAULT (datetime('now')),
    PRIMARY KEY(room_id, user_id)
  )`
];

// Auto-run db-init on startup (creates all missing tables — safe, idempotent)
setTimeout(() => {
  try {
    const { execSync } = require('child_process');
    const dbInitScript = require('path').join(__dirname, '../scripts/db-init.js');
    if (require('fs').existsSync(dbInitScript)) {
      execSync(`node "${dbInitScript}"`, { timeout: 60000, env: { ...process.env, DB_PATH: DB_PATH } });
      console.log('[DB] db-init completed — all tables ready');
    }
  } catch(e) { console.warn('[DB] db-init warning:', e.message?.split('\n')[0]); }
}, 300);

// Seed default admin users after migrations run (self-healing — runs on every startup)
setTimeout(async () => {
  try {
    const bcrypt = require('bcrypt');
    // Ensure admin@astraterra.ae always exists (upsert on each startup)
    const adminAstraHash = await bcrypt.hash('AstraTerra2026!', 12);
    db.run(
      `INSERT OR IGNORE INTO users (email,password_hash,name,role,active,profile_complete) VALUES (?,?,?,?,1,1)`,
      ['admin@astraterra.ae', adminAstraHash, 'Admin', 'admin']
    );

    db.get('SELECT COUNT(*) as cnt FROM users', [], async (err, row) => {
      if (err) return;
      // Always seed core users if missing
      const adminHash = await bcrypt.hash('qwerty@123', 12);
      const josephHash = await bcrypt.hash('joseph123', 12);
      db.run(`INSERT OR IGNORE INTO users (email,password_hash,name,role,active,profile_complete) VALUES (?,?,?,?,1,1)`,
        ['Test@admin.com', adminHash, 'Admin', 'admin']);
      db.run(`INSERT OR IGNORE INTO users (email,password_hash,name,role,active,profile_complete) VALUES (?,?,?,?,1,1)`,
        ['joseph@astraterra.ae', josephHash, 'Joseph Toubia', 'owner']);
      console.log('✅ [DB] Default admin users seeded (admin@astraterra.ae, Test@admin.com, joseph@astraterra.ae).');
    });
  } catch(e) { console.error('[DB Seed Error]', e.message); }
}, 2000);

for (const sql of migrations) {
  db.run(sql, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      // ignore "duplicate column" errors from ALTER TABLE — already ran
      if (!err.message.includes('already exists')) {
        console.warn('Migration warning:', err.message);
      }
    }
  });
}

/**
 * Query wrapper (converts PostgreSQL-style queries to SQLite)
 */
const query = (text, params = []) => {
  return new Promise((resolve, reject) => {
    // Convert PostgreSQL $1, $2... to SQLite ?
    let sqliteText = text;
    if (params.length > 0) {
      let paramIndex = 1;
      sqliteText = text.replace(/\$\d+/g, () => {
        return '?';
      });
    }

    // Handle RETURNING clause (PostgreSQL) -> SQLite doesn't support it
    const hasReturning = /RETURNING/i.test(sqliteText);
    let returningColumns = [];
    
    if (hasReturning) {
      const match = sqliteText.match(/RETURNING\s+(.+)$/i);
      if (match) {
        returningColumns = match[1].split(',').map(c => c.trim().replace('*', ''));
        sqliteText = sqliteText.replace(/RETURNING\s+.+$/i, '');
      }
    }

    // Convert PostgreSQL specific syntax
    sqliteText = sqliteText
      .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      // CURRENT_TIMESTAMP is valid native SQLite — no replacement needed
      .replace(/CURRENT_DATE/g, "date('now')")
      .replace(/INTERVAL\s+'(\d+)\s+days'/gi, (match, days) => `'-${days} days'`)
      .replace(/::numeric/g, '')
      .replace(/::text/g, '')
      .replace(/ILIKE/g, 'LIKE')
      .replace(/FILTER\s*\(\s*WHERE/gi, 'WHERE')
      .replace(/TEXT\[\]/g, 'TEXT')
      .replace(/JSONB/g, 'TEXT')
      .replace(/DECIMAL\([^)]+\)/g, 'REAL')
      .replace(/VARCHAR\([^)]+\)/g, 'TEXT');

    // Trim leading whitespace before checking query type (multiline queries start with \n)
    sqliteText = sqliteText.trim();
    const isSelect = /^SELECT/i.test(sqliteText);
    const isInsert = /^INSERT/i.test(sqliteText);
    const isUpdate = /^UPDATE/i.test(sqliteText);
    const isDelete = /^DELETE/i.test(sqliteText);

    if (isSelect) {
      db.all(sqliteText, params, (err, rows) => {
        if (err) {
          if (!err.message.includes('duplicate column name')) {
            console.error('Query error:', err.message);
            console.error('Query:', sqliteText);
          }
          reject(err);
        } else {
          resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
        }
      });
    } else if (isInsert && hasReturning) {
      db.run(sqliteText, params, function(err) {
        if (err) {
          if (!err.message.includes('duplicate column name')) {
            console.error('Query error:', err.message);
            console.error('Query:', sqliteText);
          }
          reject(err);
        } else {
          // Get the inserted row
          const insertId = this.lastID;
          const tableName = sqliteText.match(/INSERT\s+INTO\s+(\w+)/i)[1];
          db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [insertId], (err, row) => {
            if (err) reject(err);
            else resolve({ rows: [row], rowCount: 1 });
          });
        }
      });
    } else if (isUpdate && hasReturning) {
      db.run(sqliteText, params, function(err) {
        if (err) {
          if (!err.message.includes('duplicate column name')) {
            console.error('Query error:', err.message);
            console.error('Query:', sqliteText);
          }
          reject(err);
        } else {
          const tableName = sqliteText.match(/UPDATE\s+(\w+)/i)[1];
          const whereMatch = sqliteText.match(/WHERE\s+(.+?)(?:\s+RETURNING|$)/is);
          if (whereMatch) {
            // Count how many ? placeholders are in the WHERE clause
            const whereClause = whereMatch[1];
            const wherePlaceholderCount = (whereClause.match(/\?/g) || []).length;
            // WHERE params are the last N params in the array
            const whereParams = params.slice(params.length - wherePlaceholderCount);
            db.all(`SELECT * FROM ${tableName} WHERE ${whereClause}`, whereParams, (err, rows) => {
              if (err) reject(err);
              else resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
            });
          } else {
            resolve({ rows: [], rowCount: this.changes });
          }
        }
      });
    } else if (isDelete && hasReturning) {
      // For DELETE with RETURNING, we need to select first then delete
      const tableName = sqliteText.match(/DELETE\s+FROM\s+(\w+)/i)[1];
      const whereMatch = sqliteText.match(/WHERE\s+(.+)$/i);
      if (whereMatch) {
        db.all(`SELECT * FROM ${tableName} WHERE ${whereMatch[1]}`, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            db.run(sqliteText, params, (err) => {
              if (err) reject(err);
              else resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
            });
          }
        });
      } else {
        db.run(sqliteText, params, function(err) {
          if (err) reject(err);
          else resolve({ rows: [], rowCount: this.changes });
        });
      }
    } else {
      db.run(sqliteText, params, function(err) {
        if (err) {
          if (!err.message.includes('duplicate column name')) {
            console.error('Query error:', err.message);
            console.error('Query:', sqliteText);
          }
          reject(err);
        } else {
          resolve({ rows: [], rowCount: this.changes });
        }
      });
    }
  });
};

/**
 * Get client for transactions
 */
const getClient = async () => {
  return {
    query,
    release: () => {}, // No-op for SQLite
  };
};

/**
 * Pool object (for compatibility with PostgreSQL code)
 */
const pool = {
  query: (text, params, callback) => {
    if (callback) {
      query(text, params)
        .then(result => callback(null, result))
        .catch(err => callback(err));
    } else {
      return query(text, params);
    }
  },
  connect: () => Promise.resolve({
    query,
    release: () => {},
  }),
};

module.exports = {
  pool,
  query,
  getClient,
  db,
};

// ─── Column migration: safely add missing columns to existing tables ──────────
setTimeout(() => {
  const alterStatements = [
    // contacts missing columns
    `ALTER TABLE contacts ADD COLUMN nationality TEXT`,
    `ALTER TABLE contacts ADD COLUMN language TEXT`,
    `ALTER TABLE contacts ADD COLUMN type TEXT DEFAULT 'buyer'`,
    `ALTER TABLE contacts ADD COLUMN location_preference TEXT`,
    `ALTER TABLE contacts ADD COLUMN budget_min REAL`,
    `ALTER TABLE contacts ADD COLUMN budget_max REAL`,
    `ALTER TABLE contacts ADD COLUMN property_type TEXT`,
    `ALTER TABLE contacts ADD COLUMN bedrooms TEXT`,
    `ALTER TABLE contacts ADD COLUMN purpose TEXT`,
    `ALTER TABLE contacts ADD COLUMN timeline TEXT`,
    `ALTER TABLE contacts ADD COLUMN must_haves TEXT`,
    `ALTER TABLE contacts ADD COLUMN nice_to_haves TEXT`,
    `ALTER TABLE contacts ADD COLUMN source TEXT`,
    `ALTER TABLE contacts ADD COLUMN source_details TEXT`,
    `ALTER TABLE contacts ADD COLUMN lead_source TEXT`,
    `ALTER TABLE contacts ADD COLUMN lead_source_status TEXT`,
    `ALTER TABLE contacts ADD COLUMN lead_pool INTEGER DEFAULT 0`,
    `ALTER TABLE contacts ADD COLUMN tags TEXT`,
    `ALTER TABLE contacts ADD COLUMN assigned_to INTEGER`,
    `ALTER TABLE contacts ADD COLUMN assigned_agent TEXT`,
    `ALTER TABLE contacts ADD COLUMN assigned_agent_id INTEGER`,
    `ALTER TABLE contacts ADD COLUMN last_contacted TEXT`,
    `ALTER TABLE contacts ADD COLUMN next_follow_up TEXT`,
    // properties missing columns
    `ALTER TABLE properties ADD COLUMN property_id TEXT`,
    `ALTER TABLE properties ADD COLUMN type TEXT`,
    `ALTER TABLE properties ADD COLUMN assigned_to INTEGER`,
    `ALTER TABLE properties ADD COLUMN owner_email TEXT`,
    `ALTER TABLE properties ADD COLUMN owner_id INTEGER`,
    `ALTER TABLE properties ADD COLUMN floor TEXT`,
    `ALTER TABLE properties ADD COLUMN unit_number TEXT`,
    `ALTER TABLE properties ADD COLUMN floor_plan TEXT`,
    `ALTER TABLE properties ADD COLUMN video_url TEXT`,
    `ALTER TABLE properties ADD COLUMN rera_number TEXT`,
    `ALTER TABLE properties ADD COLUMN views INTEGER DEFAULT 0`,
    // leads missing columns
    `ALTER TABLE leads ADD COLUMN contact_id INTEGER`,
    `ALTER TABLE leads ADD COLUMN source_url TEXT`,
    `ALTER TABLE leads ADD COLUMN source_channel TEXT`,
    `ALTER TABLE leads ADD COLUMN stage TEXT DEFAULT 'new_lead'`,
    `ALTER TABLE leads ADD COLUMN pipeline_stage TEXT DEFAULT 'new_lead'`,
    `ALTER TABLE leads ADD COLUMN lead_type TEXT DEFAULT 'buyer'`,
    `ALTER TABLE leads ADD COLUMN score INTEGER DEFAULT 50`,
    `ALTER TABLE leads ADD COLUMN requirements TEXT`,
    `ALTER TABLE leads ADD COLUMN assigned_agent TEXT`,
    `ALTER TABLE leads ADD COLUMN currency TEXT DEFAULT 'AED'`,
    `ALTER TABLE leads ADD COLUMN tags TEXT`,
    `ALTER TABLE leads ADD COLUMN whatsapp_number TEXT`,
    `ALTER TABLE leads ADD COLUMN next_followup_date TEXT`,
    // users missing columns (for profile page)
    `ALTER TABLE users ADD COLUMN rera_number TEXT`,
    `ALTER TABLE users ADD COLUMN specialty TEXT`,
    `ALTER TABLE users ADD COLUMN total_transactions INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN transactions_count INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN about TEXT`,
    `ALTER TABLE users ADD COLUMN avatar_url TEXT`,
    `ALTER TABLE users ADD COLUMN team_id INTEGER`,
    `ALTER TABLE users ADD COLUMN commission_rate REAL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN profile_complete INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN reset_token TEXT`,
    `ALTER TABLE users ADD COLUMN reset_token_expires TEXT`,
  ];

  alterStatements.forEach(sql => {
    db.run(sql, err => {
      // Ignore "duplicate column" errors — expected on subsequent runs
    });
  });
  console.log('[DB] Column migrations applied');
}, 1500);
