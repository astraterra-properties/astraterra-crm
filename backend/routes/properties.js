/**
 * Properties API Routes
 * Complete CRUD operations for property management
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireRole, requireMinRole } = require('../middleware/auth');

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
      WHERE p.id = $1 OR p.property_id = $1
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
      WHERE v.property_id = $1
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
      WHERE pm.property_id = $1 AND pm.match_score >= 50
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
      'SELECT COUNT(*) FROM deals WHERE property_id = (SELECT id FROM properties WHERE id = $1 OR property_id = $1)',
      [id]
    );
    
    if (parseInt(dealsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete property with existing deals. Archive instead.' 
      });
    }

    const result = await query(
      'DELETE FROM properties WHERE id = $1 OR property_id = $1 RETURNING id',
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
      SELECT * FROM properties WHERE id = $1 OR property_id = $1
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
            WHEN c.budget_min <= $1 AND c.budget_max >= $1 THEN 40
            WHEN c.budget_max >= $1 * 0.8 THEN 20
            ELSE 0
          END +
          CASE 
            WHEN c.location_preference ILIKE $2 THEN 30
            ELSE 0
          END +
          CASE 
            WHEN c.property_type = $3 THEN 20
            ELSE 0
          END +
          CASE 
            WHEN c.bedrooms = $4 THEN 10
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
        VALUES ($1, $2, $3, $4, 'suggested')
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

module.exports = router;
