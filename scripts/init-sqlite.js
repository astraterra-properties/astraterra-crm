/**
 * Initialize SQLite Database
 * Creates all tables and sample data
 */

const { db, query } = require('../backend/config/database');
const fs = require('fs');
const path = require('path');
const bcrypt = require('../backend/node_modules/bcrypt');

async function initDatabase() {
  try {
    console.log('🚀 Initializing SQLite database...\n');

    // Read schema file
    const schemaPath = path.join(__dirname, '../database/schema-sqlite.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Executing schema-sqlite.sql...');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Execute each statement
    for (const statement of statements) {
      await query(statement + ';');
    }

    console.log('✅ Database tables created successfully!');

    // Create default admin user
    const password_hash = await bcrypt.hash('admin123', 10);

    await query(`
      INSERT OR IGNORE INTO users (email, password_hash, name, role, active)
      VALUES (?, ?, ?, ?, ?)
    `, ['admin@astraterra.ae', password_hash, 'Admin User', 'admin', 1]);

    console.log('✅ Default admin user created');
    console.log('   Email: admin@astraterra.ae');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change this password after first login!\n');

    // Create Joseph's user
    const josephPassword = await bcrypt.hash('joseph123', 10);
    await query(`
      INSERT OR IGNORE INTO users (email, password_hash, name, role, active, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['joseph@astraterra.ae', josephPassword, 'Joseph Dib Toubia', 'admin', 1, '+971501234567']);

    console.log('✅ Joseph\'s user created');
    console.log('   Email: joseph@astraterra.ae');
    console.log('   Password: joseph123\n');

    // Create sample data
    console.log('📊 Creating sample data...');

    // Sample contact
    await query(`
      INSERT OR IGNORE INTO contacts (name, phone, email, type, location_preference, budget_min, budget_max, property_type, bedrooms, purpose, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['John Doe', '+971501234567', 'john@example.com', 'buyer', 'Dubai Marina', 1000000, 2000000, 'apartment', 2, 'buy', 'website', 'active']);

    // Sample property
    await query(`
      INSERT OR IGNORE INTO properties (property_id, title, type, location, bedrooms, bathrooms, size, price, purpose, status, listed_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['PROP-001', '2BR Apartment in Dubai Marina', 'apartment', 'Dubai Marina', 2, 2, 1200, 1500000, 'sale', 'available', new Date().toISOString()]);

    console.log('✅ Sample data created\n');

    console.log('🎉 Database initialization complete!');
    console.log('📍 Database location: data/astraterra-crm.db\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run
initDatabase();
