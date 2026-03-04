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
      .replace(/CURRENT_TIMESTAMP/g, "datetime('now')")
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
          console.error('Query error:', err.message);
          console.error('Query:', sqliteText);
          reject(err);
        } else {
          resolve({ rows: rows || [], rowCount: rows ? rows.length : 0 });
        }
      });
    } else if (isInsert && hasReturning) {
      db.run(sqliteText, params, function(err) {
        if (err) {
          console.error('Query error:', err.message);
          console.error('Query:', sqliteText);
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
          console.error('Query error:', err.message);
          console.error('Query:', sqliteText);
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
          console.error('Query error:', err.message);
          console.error('Query:', sqliteText);
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
