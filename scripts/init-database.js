/**
 * Initialize Database
 * Creates all tables from schema.sql
 */

const { pool } = require('../backend/config/database');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  try {
    console.log('🚀 Initializing database...\n');

    // Read schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Executing schema.sql...');

    // Execute schema
    await pool.query(schema);

    console.log('✅ Database tables created successfully!');

    // Create default admin user
    const bcrypt = require('bcrypt');
    const password_hash = await bcrypt.hash('admin123', 10);

    await pool.query(`
      INSERT INTO users (email, password_hash, name, role, active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, ['admin@astraterra.ae', password_hash, 'Admin User', 'admin', true]);

    console.log('✅ Default admin user created');
    console.log('   Email: admin@astraterra.ae');
    console.log('   Password: admin123');
    console.log('   ⚠️  Please change this password after first login!\n');

    // Create sample data for testing
    console.log('📊 Creating sample data...');

    // Sample contact
    await pool.query(`
      INSERT INTO contacts (name, phone, email, type, location_preference, budget_min, budget_max, property_type, bedrooms, purpose, source, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT DO NOTHING
    `, ['John Doe', '+971501234567', 'john@example.com', 'buyer', 'Dubai Marina', 1000000, 2000000, 'apartment', 2, 'buy', 'website', 'active']);

    // Sample property
    await pool.query(`
      INSERT INTO properties (property_id, title, type, location, bedrooms, bathrooms, size, price, purpose, status, listed_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT DO NOTHING
    `, ['PROP-001', '2BR Apartment in Dubai Marina', 'apartment', 'Dubai Marina', 2, 2, 1200, 1500000, 'sale', 'available', new Date()]);

    console.log('✅ Sample data created\n');

    console.log('🎉 Database initialization complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run
initDatabase();
