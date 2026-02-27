/**
 * Database Configuration
 * Uses SQLite for development (fallback from PostgreSQL)
 */

require('dotenv').config();

// Use SQLite for now (easier setup for development)
console.log('🔄 Using SQLite database for development');
const sqliteDb = require('./database-sqlite');

module.exports = sqliteDb;
