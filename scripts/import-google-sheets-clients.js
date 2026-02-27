/**
 * Import Clients from Google Sheets to CRM Database
 * Imports 986 existing clients from Joseph's Google Sheet
 */

const { google } = require('googleapis');
const { query } = require('../backend/config/database');
const path = require('path');
const fs = require('fs');

// Google Sheets configuration
const SPREADSHEET_ID = '1KegT1-HxhTfhU5xWIzwAWX6KBY3Qoou4bbxkcO8nZm0';
const SHEET_NAME = 'Clients'; // Adjust based on actual sheet name

// Service account credentials path
const CREDENTIALS_PATH = path.join(__dirname, '../google-credentials.json');

/**
 * Initialize Google Sheets API
 */
async function initGoogleSheets() {
  try {
    // Check if credentials file exists
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.error('❌ Google credentials file not found at:', CREDENTIALS_PATH);
      console.log('Please download service account JSON and save it as google-credentials.json');
      process.exit(1);
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    return sheets;
  } catch (error) {
    console.error('❌ Failed to initialize Google Sheets API:', error);
    throw error;
  }
}

/**
 * Fetch clients from Google Sheets
 */
async function fetchClientsFromSheets() {
  try {
    const sheets = await initGoogleSheets();

    console.log('📊 Fetching clients from Google Sheets...');

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:O`, // Adjust range based on columns
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log('⚠️  No data found in sheet');
      return [];
    }

    // First row is headers
    const headers = rows[0];
    console.log('📋 Sheet headers:', headers);

    // Convert rows to objects
    const clients = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Map sheet columns to CRM fields
      const client = {
        name: row[0] || '',
        phone: row[1] || '',
        email: row[2] || '',
        budget_min: parseFloat(row[3]) || null,
        budget_max: parseFloat(row[4]) || null,
        property_type: row[5] || null,
        location_preference: row[6] || null,
        bedrooms: parseInt(row[7]) || null,
        purpose: row[8] || null,
        timeline: row[9] || null,
        must_haves: row[10] || null,
        nice_to_haves: row[11] || null,
        status: row[12] || 'active',
        notes: row[13] || null,
        source: 'google_sheets',
        type: 'buyer' // Default type
      };

      // Only add if name exists
      if (client.name) {
        clients.push(client);
      }
    }

    console.log(`✅ Fetched ${clients.length} clients from Google Sheets`);
    return clients;

  } catch (error) {
    console.error('❌ Error fetching from Google Sheets:', error);
    throw error;
  }
}

/**
 * Import clients to database
 */
async function importClientsToDatabase(clients) {
  try {
    console.log(`\n📥 Importing ${clients.length} clients to database...`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const client of clients) {
      try {
        // Check if contact already exists (by phone or email)
        const existing = await query(
          'SELECT id FROM contacts WHERE phone = $1 OR email = $2',
          [client.phone, client.email]
        );

        if (existing.rows.length > 0) {
          console.log(`⏭️  Skipping duplicate: ${client.name}`);
          skipped++;
          continue;
        }

        // Insert contact
        await query(`
          INSERT INTO contacts (
            name, phone, email, type, location_preference,
            budget_min, budget_max, property_type, bedrooms,
            purpose, timeline, must_haves, nice_to_haves,
            source, notes, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          client.name,
          client.phone,
          client.email,
          client.type,
          client.location_preference,
          client.budget_min,
          client.budget_max,
          client.property_type,
          client.bedrooms,
          client.purpose,
          client.timeline,
          client.must_haves,
          client.nice_to_haves,
          client.source,
          client.notes,
          client.status
        ]);

        imported++;
        
        if (imported % 50 === 0) {
          console.log(`✅ Imported ${imported} clients...`);
        }

      } catch (error) {
        console.error(`❌ Error importing ${client.name}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`✅ Successfully imported: ${imported}`);
    console.log(`⏭️  Skipped (duplicates): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📈 Total processed: ${clients.length}`);

    return { imported, skipped, errors };

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

/**
 * Main import function
 */
async function main() {
  try {
    console.log('🚀 Starting Google Sheets import...\n');

    // Fetch clients from Google Sheets
    const clients = await fetchClientsFromSheets();

    if (clients.length === 0) {
      console.log('⚠️  No clients to import');
      return;
    }

    // Import to database
    const result = await importClientsToDatabase(clients);

    console.log('\n✅ Import completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchClientsFromSheets, importClientsToDatabase };
