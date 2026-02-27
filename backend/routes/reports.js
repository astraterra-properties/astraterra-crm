/**
 * Reports API Routes
 * Generate business intelligence and analytics reports
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireMinRole } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireMinRole('admin')); // All reports require admin+

// GET /api/reports/sales - Sales performance report
router.get('/sales', async (req, res) => {
  try {
    const { period = 'month', agent_id } = req.query;

    let dateFilter = '';
    if (period === 'week') dateFilter = "date('now', '-7 days')";
    else if (period === 'month') dateFilter = "date('now', '-30 days')";
    else if (period === 'quarter') dateFilter = "date('now', '-90 days')";
    else if (period === 'year') dateFilter = "date('now', '-365 days')";

    let agentFilter = agent_id ? `AND d.assigned_to = ${agent_id}` : '';

    const salesData = await query(`
      SELECT 
        COUNT(*) as total_deals,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won_deals,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost_deals,
        SUM(CASE WHEN status = 'won' THEN deal_value ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status = 'won' THEN deal_value ELSE NULL END) as avg_deal_value,
        ROUND(
          CAST(SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS REAL) / 
          NULLIF(COUNT(*), 0) * 100, 
          2
        ) as win_rate
      FROM deals d
      WHERE created_at >= ${dateFilter} ${agentFilter}
    `);

    // Daily breakdown
    const dailyBreakdown = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as deals,
        SUM(CASE WHEN status = 'won' THEN deal_value ELSE 0 END) as revenue
      FROM deals
      WHERE created_at >= ${dateFilter} ${agentFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: {
        summary: salesData[0],
        daily_breakdown: dailyBreakdown
      }
    });

  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate sales report', error: error.message });
  }
});

// GET /api/reports/pipeline - Deal pipeline report
router.get('/pipeline', async (req, res) => {
  try {
    const pipelineData = await query(`
      SELECT 
        stage,
        COUNT(*) as count,
        SUM(deal_value) as total_value,
        AVG(deal_value) as avg_value
      FROM deals
      WHERE status = 'active'
      GROUP BY stage
      ORDER BY 
        CASE stage
          WHEN 'initial_contact' THEN 1
          WHEN 'viewing_scheduled' THEN 2
          WHEN 'viewing_done' THEN 3
          WHEN 'offer_made' THEN 4
          WHEN 'negotiation' THEN 5
          WHEN 'contract_sent' THEN 6
          WHEN 'contract_signed' THEN 7
          ELSE 8
        END
    `);

    const totalPipelineValue = await query(`
      SELECT SUM(deal_value) as total FROM deals WHERE status = 'active'
    `);

    res.json({
      success: true,
      data: {
        pipeline_stages: pipelineData,
        total_pipeline_value: totalPipelineValue[0].total || 0
      }
    });

  } catch (error) {
    console.error('Pipeline report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate pipeline report', error: error.message });
  }
});

// GET /api/reports/agents - Agent performance report
router.get('/agents', async (req, res) => {
  try {
    const agentPerformance = await query(`
      SELECT 
        u.id,
        u.name as agent_name,
        COUNT(DISTINCT d.id) as total_deals,
        SUM(CASE WHEN d.status = 'won' THEN 1 ELSE 0 END) as won_deals,
        SUM(CASE WHEN d.status = 'won' THEN d.deal_value ELSE 0 END) as total_revenue,
        COUNT(DISTINCT v.id) as total_viewings,
        COUNT(DISTINCT l.id) as total_leads,
        SUM(c.commission_amount) as total_commissions
      FROM users u
      LEFT JOIN deals d ON u.id = d.assigned_to
      LEFT JOIN viewings v ON u.id = v.agent_id
      LEFT JOIN leads l ON u.id = l.assigned_to
      LEFT JOIN commissions c ON u.id = c.agent_id AND c.status = 'paid'
      WHERE u.role IN ('agent', 'manager')
      GROUP BY u.id, u.name
      ORDER BY total_revenue DESC
    `);

    res.json({
      success: true,
      data: agentPerformance
    });

  } catch (error) {
    console.error('Agent performance report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate agent report', error: error.message });
  }
});

// GET /api/reports/properties - Property performance report
router.get('/properties', async (req, res) => {
  try {
    const propertyStats = await query(`
      SELECT 
        type,
        COUNT(*) as total_properties,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'sold' OR status = 'rented' THEN 1 ELSE 0 END) as closed,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM properties
      GROUP BY type
      ORDER BY total_properties DESC
    `);

    const locationStats = await query(`
      SELECT 
        location,
        COUNT(*) as count,
        AVG(price) as avg_price
      FROM properties
      WHERE status = 'available'
      GROUP BY location
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        by_type: propertyStats,
        top_locations: locationStats
      }
    });

  } catch (error) {
    console.error('Property report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate property report', error: error.message });
  }
});

// GET /api/reports/contacts - Contact analytics
router.get('/contacts', async (req, res) => {
  try {
    const contactStats = await query(`
      SELECT 
        COUNT(*) as total_contacts,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN type = 'buyer' THEN 1 ELSE 0 END) as buyers,
        SUM(CASE WHEN type = 'seller' THEN 1 ELSE 0 END) as sellers,
        SUM(CASE WHEN type = 'tenant' THEN 1 ELSE 0 END) as tenants,
        SUM(CASE WHEN type = 'landlord' THEN 1 ELSE 0 END) as landlords
      FROM contacts
    `);

    const sourceBreakdown = await query(`
      SELECT 
        source,
        COUNT(*) as count
      FROM contacts
      GROUP BY source
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        summary: contactStats[0],
        by_source: sourceBreakdown
      }
    });

  } catch (error) {
    console.error('Contact report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate contact report', error: error.message });
  }
});

// GET /api/reports/activity - Activity log report
router.get('/activity', async (req, res) => {
  try {
    const { limit = 100, entity_type, user_id } = req.query;
    
    let conditions = [];
    let params = [];
    
    if (entity_type) {
      conditions.push('entity_type = ?');
      params.push(entity_type);
    }
    if (user_id) {
      conditions.push('user_id = ?');
      params.push(user_id);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const activities = await query(`
      SELECT 
        a.*,
        u.name as user_name
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);

    res.json({
      success: true,
      data: activities
    });

  } catch (error) {
    console.error('Activity report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate activity report', error: error.message });
  }
});

module.exports = router;
