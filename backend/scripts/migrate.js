/**
 * Astraterra CRM — Simple Migration System
 * 
 * Run: node scripts/migrate.js
 * 
 * Migrations are versioned and tracked in a `_migrations` table.
 * Each migration runs exactly once. Safe to run repeatedly.
 * 
 * To add a new migration: add an entry to the MIGRATIONS array.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// DB path — same logic as database-sqlite.js
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../data/astraterra-crm.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

console.log(`\n🔧 Astraterra CRM Migration System`);
console.log(`📁 DB: ${DB_PATH}\n`);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('❌ Cannot open DB:', err.message); process.exit(1); }
  console.log('✅ Database opened');
});

db.serialize(() => {
  // Bootstrap: create migrations tracking table
  db.run(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    ran_at TEXT DEFAULT (datetime('now'))
  )`, runMigrations);
});

// ─── Migrations ───────────────────────────────────────────────────────────────
const MIGRATIONS = [
  {
    version: 1,
    name: 'create_core_tables',
    up: (db, done) => {
      db.serialize(() => {
        // Drop malformed users table and recreate clean
        db.run(`DROP TABLE IF EXISTS users_backup_old`);

        // Backup existing users if any
        db.run(`CREATE TABLE IF NOT EXISTS users_backup_v1 AS SELECT * FROM users WHERE 1=0`, () => {});
        db.run(`INSERT OR IGNORE INTO users_backup_v1 SELECT * FROM users`, () => {});

        // Drop and recreate users with correct schema
        db.run(`DROP TABLE IF EXISTS users`);
        db.run(`CREATE TABLE IF NOT EXISTS users (
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
        )`, done);
      });
    }
  },
  {
    version: 2,
    name: 'seed_default_users',
    up: async (db, done) => {
      const bcrypt = require('bcrypt');
      const josephHash = await bcrypt.hash('Joseph@1234!', 12);
      const adminHash  = await bcrypt.hash('AstraTerra2026!', 12);
      const testHash   = await bcrypt.hash('qwerty@123', 12);
      const hazelHash  = await bcrypt.hash('Hazel@1234', 12);
      const ramziHash  = await bcrypt.hash('Ramzi@1234', 12);

      db.serialize(() => {
        db.run(`INSERT OR IGNORE INTO users (email,password_hash,name,role,active,profile_complete) VALUES (?,?,?,?,1,1)`,
          ['joseph@astraterra.ae', josephHash, 'Joseph Dib Toubia', 'owner']);
        db.run(`INSERT OR IGNORE INTO users (email,password_hash,name,role,active,profile_complete) VALUES (?,?,?,?,1,1)`,
          ['admin@astraterra.ae', adminHash, 'Admin', 'admin']);
        db.run(`INSERT OR IGNORE INTO users (email,password_hash,name,role,active,profile_complete) VALUES (?,?,?,?,1,1)`,
          ['Test@admin.com', testHash, 'Admin', 'admin']);
        db.run(`INSERT OR IGNORE INTO users (email,password_hash,name,role,active,profile_complete) VALUES (?,?,?,?,1,1)`,
          ['hazel@astraterra.ae', hazelHash, 'Hazel Ebola', 'agent']);
        db.run(`INSERT OR IGNORE INTO users (email,password_hash,name,role,active,profile_complete) VALUES (?,?,?,?,1,1)`,
          ['accounts@astraterra.ae', ramziHash, 'Ramzi Oweis', 'finance'], done);
      });
    }
  },
  {
    version: 3,
    name: 'create_contacts_leads_tasks_core',
    up: (db, done) => {
      db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL, email TEXT, phone TEXT,
          nationality TEXT, language TEXT,
          property_type TEXT, bedrooms TEXT, budget_min REAL, budget_max REAL,
          location_preference TEXT, purpose TEXT DEFAULT 'Buy',
          lead_source TEXT, lead_source_status TEXT,
          status TEXT DEFAULT 'new',
          lead_pool INTEGER DEFAULT 0,
          assigned_agent TEXT, assigned_agent_id INTEGER,
          notes TEXT, last_contacted TEXT, next_follow_up TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS leads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contact_id INTEGER REFERENCES contacts(id),
          stage TEXT DEFAULT 'new_lead',
          priority TEXT DEFAULT 'medium',
          budget REAL, currency TEXT DEFAULT 'AED',
          property_type TEXT, bedrooms TEXT, location TEXT,
          notes TEXT, assigned_agent TEXT, assigned_agent_id INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL, description TEXT,
          status TEXT DEFAULT 'todo', priority TEXT DEFAULT 'medium',
          due_date TEXT, completed INTEGER DEFAULT 0, completed_at TEXT,
          related_type TEXT, related_id INTEGER,
          assigned_to INTEGER, created_by INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )`, done);
      });
    }
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────
function runMigrations() {
  db.all('SELECT version FROM _migrations ORDER BY version ASC', [], (err, rows) => {
    if (err) { console.error('❌ Cannot read migrations table:', err.message); db.close(); return; }

    const ran = new Set(rows.map(r => r.version));
    const pending = MIGRATIONS.filter(m => !ran.has(m.version));

    if (pending.length === 0) {
      console.log('✅ All migrations up to date. Nothing to run.\n');
      db.all('SELECT version, name, ran_at FROM _migrations ORDER BY version', [], (e, r) => {
        console.log('Migration history:');
        r.forEach(m => console.log(`  v${m.version} — ${m.name} (${m.ran_at})`));
        db.close();
      });
      return;
    }

    console.log(`📋 ${pending.length} pending migration(s):\n`);
    runNext(pending, 0);
  });
}

function runNext(pending, i) {
  if (i >= pending.length) {
    console.log('\n✅ All migrations complete!\n');
    db.all('SELECT version, name, ran_at FROM _migrations ORDER BY version', [], (e, r) => {
      console.log('Migration history:');
      r.forEach(m => console.log(`  v${m.version} — ${m.name} (${m.ran_at})`));
      db.close();
    });
    return;
  }

  const migration = pending[i];
  console.log(`⏳ Running v${migration.version}: ${migration.name}...`);

  const done = (err) => {
    if (err && err.message && !err.message.includes('already exists') && !err.message.includes('duplicate')) {
      console.error(`  ❌ Failed: ${err.message}`);
      db.close();
      process.exit(1);
    }
    db.run('INSERT INTO _migrations (version, name) VALUES (?, ?)', [migration.version, migration.name], (e2) => {
      if (e2) console.warn(`  ⚠️  Could not record migration: ${e2.message}`);
      console.log(`  ✅ Done`);
      runNext(pending, i + 1);
    });
  };

  try {
    const result = migration.up(db, done);
    if (result && typeof result.then === 'function') {
      result.then(() => {}).catch(err => {
        console.error(`  ❌ Async failed: ${err.message}`);
        db.close();
        process.exit(1);
      });
    }
  } catch (e) {
    console.error(`  ❌ Exception: ${e.message}`);
    db.close();
    process.exit(1);
  }
}
