/**
 * Properties API Routes
 * Complete CRUD operations for property management
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { query } = require('../config/database');
const { authenticateToken, requireRole, requireMinRole } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/properties
 * Get all properties with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const {
      type,
      status,
      purpose,
      location,
      bedrooms,
      price_min,
      price_max,
      search,
      page = 1,
      limit = 50
    } = req.query;

    let queryText = `
      SELECT 
        p.*,
        u.name as assigned_to_name
      FROM properties p
      LEFT JOIN users u ON p.assigned_to = u.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 1;

    // Filters
    if (type) {
      queryText += ` AND p.type = $${paramCount}`;
      queryParams.push(type);
      paramCount++;
    }

    if (status) {
      queryText += ` AND p.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }

    if (purpose) {
      queryText += ` AND p.purpose = $${paramCount}`;
      queryParams.push(purpose);
      paramCount++;
    }

    if (location) {
      queryText += ` AND p.location ILIKE $${paramCount}`;
      queryParams.push(`%${location}%`);
      paramCount++;
    }

    if (bedrooms) {
      queryText += ` AND p.bedrooms = $${paramCount}`;
      queryParams.push(bedrooms);
      paramCount++;
    }

    if (price_min) {
      queryText += ` AND p.price >= $${paramCount}`;
      queryParams.push(price_min);
      paramCount++;
    }

    if (price_max) {
      queryText += ` AND p.price <= $${paramCount}`;
      queryParams.push(price_max);
      paramCount++;
    }

    if (search) {
      queryText += ` AND (
        p.title ILIKE $${paramCount} OR 
        p.location ILIKE $${paramCount + 1} OR 
        p.description ILIKE $${paramCount + 2} OR
        p.property_id ILIKE $${paramCount + 3}
      )`;
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      paramCount += 4;
    }

    // Pagination
    const offset = (page - 1) * limit;
    queryText += ` ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);

    const result = await query(queryText, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM properties p WHERE 1=1';
    const countParams = [];
    let countIndex = 1;

    if (type) {
      countQuery += ` AND p.type = $${countIndex}`;
      countParams.push(type);
      countIndex++;
    }

    if (status) {
      countQuery += ` AND p.status = $${countIndex}`;
      countParams.push(status);
      countIndex++;
    }

    if (purpose) {
      countQuery += ` AND p.purpose = $${countIndex}`;
      countParams.push(purpose);
      countIndex++;
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      properties: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

/**
 * GET /api/properties/:id
 * Get single property by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        p.*,
        u.name as assigned_to_name,
        u.email as assigned_to_email
      FROM properties p
      LEFT JOIN users u ON p.assigned_to = u.id
      WHERE p.id = ? OR p.property_id = ?
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Get property viewings
    const viewingsResult = await query(`
      SELECT 
        v.id, v.scheduled_at, v.status,
        c.name as contact_name,
        c.phone as contact_phone
      FROM viewings v
      LEFT JOIN contacts c ON v.contact_id = c.id
      WHERE v.property_id = ?
      ORDER BY v.scheduled_at DESC
    `, [result.rows[0].id]);

    // Get property matches
    const matchesResult = await query(`
      SELECT 
        pm.id, pm.match_score, pm.status,
        c.name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email
      FROM property_matches pm
      LEFT JOIN contacts c ON pm.contact_id = c.id
      WHERE pm.property_id = ? AND pm.match_score >= 50
      ORDER BY pm.match_score DESC
      LIMIT 10
    `, [result.rows[0].id]);

    const property = result.rows[0];
    property.viewings = viewingsResult.rows;
    property.matches = matchesResult.rows;

    res.json(property);
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

/**
 * POST /api/properties
 * Create new property (admin+)
 */
router.post('/', requireMinRole('admin'), async (req, res) => {
  try {
    const {
      title,
      type,
      location,
      bedrooms,
      bathrooms,
      size,
      price,
      purpose,
      furnished = false,
      owner_name,
      owner_contact,
      owner_email,
      description,
      key_features,
      photos,
      documents,
      assigned_to
    } = req.body;

    // Validate required fields
    if (!type || !location || !price || !purpose) {
      return res.status(400).json({ 
        error: 'Missing required fields: type, location, price, purpose' 
      });
    }

    // Generate property ID
    const idResult = await query(
      'SELECT COUNT(*) FROM properties WHERE created_at >= CURRENT_DATE'
    );
    const count = parseInt(idResult.rows[0].count) + 1;
    const property_id = `PROP-${Date.now().toString().slice(-6)}${count.toString().padStart(3, '0')}`;

    const result = await query(`
      INSERT INTO properties (
        property_id, title, type, location, bedrooms, bathrooms, size,
        price, purpose, furnished, owner_name, owner_contact, owner_email,
        description, key_features, photos, documents, status,
        assigned_to, listed_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `, [
      property_id,
      title || `${type} in ${location}`,
      type,
      location,
      bedrooms,
      bathrooms,
      size,
      price,
      purpose,
      furnished,
      owner_name,
      owner_contact,
      owner_email,
      description,
      key_features,
      photos,
      documents,
      'available',
      assigned_to || req.user.id,
      new Date()
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

/**
 * PUT /api/properties/:id
 * Update property (admin+)
 */
router.put('/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];
    let paramCount = 1;

    // List of updatable fields
    const fields = [
      'title', 'type', 'location', 'bedrooms', 'bathrooms', 'size',
      'price', 'purpose', 'furnished', 'owner_name', 'owner_contact',
      'owner_email', 'description', 'key_features', 'photos', 'documents',
      'status', 'assigned_to'
    ];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        values.push(req.body[field]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update sold/rented date if status changed to sold/rented
    if (req.body.status === 'sold' || req.body.status === 'rented') {
      updates.push(`sold_rented_date = CURRENT_DATE`);
    }

    values.push(id);
    const result = await query(`
      UPDATE properties
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} OR property_id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

/**
 * DELETE /api/properties/:id
 * Delete property (only if no related deals)
 */
router.delete('/:id', requireMinRole('owner'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check for related deals
    const dealsCheck = await query(
      'SELECT COUNT(*) FROM deals WHERE property_id = (SELECT id FROM properties WHERE id = ? OR property_id = ?)',
      [id]
    );
    
    if (parseInt(dealsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete property with existing deals. Archive instead.' 
      });
    }

    const result = await query(
      'DELETE FROM properties WHERE id = ? OR property_id = ? RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({ message: 'Property deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

/**
 * POST /api/properties/:id/match
 * Find matching contacts for a property
 */
router.post('/:id/match', async (req, res) => {
  try {
    const { id } = req.params;

    // Get property details
    const propResult = await query(`
      SELECT * FROM properties WHERE id = ? OR property_id = ?
    `, [id]);

    if (propResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = propResult.rows[0];

    // Find matching contacts based on criteria
    const matchesResult = await query(`
      SELECT 
        c.*,
        (
          CASE 
            WHEN c.budget_min <= ? AND c.budget_max >= ? THEN 40
            WHEN c.budget_max >= ? * 0.8 THEN 20
            ELSE 0
          END +
          CASE 
            WHEN c.location_preference ILIKE ? THEN 30
            ELSE 0
          END +
          CASE 
            WHEN c.property_type = ? THEN 20
            ELSE 0
          END +
          CASE 
            WHEN c.bedrooms = ? THEN 10
            ELSE 0
          END
        ) as match_score
      FROM contacts c
      WHERE c.status = 'active'
        AND c.type IN ('buyer', 'both')
      HAVING match_score >= 30
      ORDER BY match_score DESC
      LIMIT 20
    `, [property.price, `%${property.location}%`, property.type, property.bedrooms]);

    // Save matches to property_matches table
    for (const contact of matchesResult.rows) {
      await query(`
        INSERT INTO property_matches (property_id, contact_id, match_score, match_criteria, status)
        VALUES (?, ?, ?, ?, 'suggested')
        ON CONFLICT DO NOTHING
      `, [
        property.id,
        contact.id,
        contact.match_score,
        JSON.stringify({
          budget_match: contact.budget_max >= property.price,
          location_match: contact.location_preference?.includes(property.location),
          type_match: contact.property_type === property.type,
          bedroom_match: contact.bedrooms === property.bedrooms
        })
      ]);
    }

    res.json({
      property: property.property_id,
      matches: matchesResult.rows.length,
      results: matchesResult.rows
    });
  } catch (error) {
    console.error('Error matching property:', error);
    res.status(500).json({ error: 'Failed to match property' });
  }
});

/**
 * GET /api/properties/stats/overview
 * Get property statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total_properties,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'under_offer') as under_offer,
        COUNT(*) FILTER (WHERE status = 'sold') as sold,
        COUNT(*) FILTER (WHERE status = 'rented') as rented,
        COUNT(*) FILTER (WHERE purpose = 'sale') as for_sale,
        COUNT(*) FILTER (WHERE purpose = 'rent') as for_rent,
        AVG(price) FILTER (WHERE purpose = 'sale') as avg_sale_price,
        AVG(price) FILTER (WHERE purpose = 'rent') as avg_rent_price,
        COUNT(*) FILTER (WHERE listed_date >= CURRENT_DATE - INTERVAL '30 days') as new_this_month
      FROM properties
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching property stats:', error);
    res.status(500).json({ error: 'Failed to fetch property statistics' });
  }
});

/**
 * POST /api/properties/import
 * Import properties from an Excel file (.xlsx / .xls / .csv)
 * Accepted column names (case-insensitive, order doesn't matter):
 *   Title, Type, Location, Bedrooms, Bathrooms, Size, Price,
 *   Purpose, Furnished, Owner Name, Owner Contact, Owner Email,
 *   Description, Key Features, Status
 */
router.post('/import', requireMinRole('agent'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) return res.status(400).json({ error: 'Excel file is empty' });

    // Normalise column names
    const normalise = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    const COL_MAP = {
      title: ['title', 'propertytitle', 'name'],
      type: ['type', 'propertytype'],
      location: ['location', 'area', 'community', 'address'],
      bedrooms: ['bedrooms', 'beds', 'br'],
      bathrooms: ['bathrooms', 'baths'],
      size: ['size', 'sqft', 'sqm', 'area'],
      price: ['price', 'askingprice', 'listprice', 'value'],
      purpose: ['purpose', 'saleorrent', 'category'],
      furnished: ['furnished'],
      owner_name: ['ownername', 'owner'],
      owner_contact: ['ownercontact', 'ownermobile', 'ownerphone', 'ownertel'],
      owner_email: ['owneremail'],
      description: ['description', 'notes', 'remarks'],
      key_features: ['keyfeatures', 'features', 'amenities'],
      status: ['status'],
    };

    const firstRow = rows[0];
    const colKeys = Object.keys(firstRow);
    const colLookup = {};
    for (const [field, aliases] of Object.entries(COL_MAP)) {
      for (const key of colKeys) {
        if (aliases.includes(normalise(key))) {
          colLookup[field] = key;
          break;
        }
      }
    }

    const get = (row, field) => {
      const k = colLookup[field];
      return k !== undefined ? String(row[k] || '').trim() : '';
    };

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const title = get(row, 'title') || `Imported Property ${Date.now()}-${i}`;
        const price = parseFloat(get(row, 'price').replace(/[^0-9.]/g, '')) || 0;
        const bedrooms = parseInt(get(row, 'bedrooms')) || null;
        const bathrooms = parseInt(get(row, 'bathrooms')) || null;
        const size = parseFloat(get(row, 'size').replace(/[^0-9.]/g, '')) || null;
        const furnished = /yes|true|1/i.test(get(row, 'furnished')) ? 1 : 0;
        const purpose = /rent/i.test(get(row, 'purpose')) ? 'rent' : 'sale';
        const status = get(row, 'status') || 'available';
        const propertyId = `PROP-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;

        await query(
          `INSERT INTO properties
            (property_id, title, type, location, bedrooms, bathrooms, size, price, purpose,
             furnished, owner_name, owner_contact, owner_email, description, key_features,
             status, listed_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), datetime('now'), datetime('now'))`,
          [
            propertyId,
            title,
            get(row, 'type') || 'apartment',
            get(row, 'location'),
            bedrooms,
            bathrooms,
            size,
            price,
            purpose,
            furnished,
            get(row, 'owner_name'),
            get(row, 'owner_contact'),
            get(row, 'owner_email'),
            get(row, 'description'),
            get(row, 'key_features'),
            status,
          ]
        );
        imported++;
      } catch (rowErr) {
        skipped++;
        errors.push(`Row ${i + 2}: ${rowErr.message}`);
      }
    }

    res.json({ success: true, imported, skipped, errors: errors.slice(0, 10) });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

/**
 * GET /api/properties/import/template
 * Download a sample Excel template
 */
router.get('/import/template', requireMinRole('agent'), (req, res) => {
  const wb = XLSX.utils.book_new();
  const headers = [
    'Title', 'Type', 'Location', 'Bedrooms', 'Bathrooms', 'Size (sqft)',
    'Price (AED)', 'Purpose', 'Furnished', 'Owner Name', 'Owner Contact',
    'Owner Email', 'Description', 'Key Features', 'Status'
  ];
  const sample = [
    'Luxury 2BR in Marina', 'apartment', 'Dubai Marina', 2, 2, 1200,
    1500000, 'sale', 'Yes', 'Ahmed Al Rashid', '+971501234567',
    'ahmed@email.com', 'Stunning sea views, high floor', 'Pool, Gym, Parking', 'available'
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Properties');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="properties-import-template.xlsx"');
  res.send(buf);
});

module.exports = router;
