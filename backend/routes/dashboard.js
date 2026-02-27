/**
 * Dashboard API Routes
 * Overview statistics and activity feed
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/dashboard/stats
 * Get dashboard overview statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { assigned_to } = req.query;

    // Build WHERE clause for filtering by agent
    const whereClause = assigned_to ? 'WHERE assigned_to = $1' : '';
    const params = assigned_to ? [assigned_to] : [];

    // Get all stats in parallel
    const [leadsStats, contactsStats, propertiesStats, dealsStats, viewingsStats] = await Promise.all([
      // Leads stats
      query(`
        SELECT
          COUNT(*) as total_leads,
          SUM(CASE WHEN status = 'hot' THEN 1 ELSE 0 END) as hot_leads,
          SUM(CASE WHEN status = 'viewing_scheduled' THEN 1 ELSE 0 END) as viewing_scheduled,
          SUM(CASE WHEN created_at >= date('now', '-7 days') THEN 1 ELSE 0 END) as new_this_week
        FROM leads
        ${whereClause}
      `, params),

      // Contacts stats
      query(`
        SELECT
          COUNT(*) as total_contacts,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_contacts,
          SUM(CASE WHEN created_at >= date('now', '-30 days') THEN 1 ELSE 0 END) as new_this_month
        FROM contacts
        ${whereClause}
      `, params),

      // Properties stats
      query(`
        SELECT
          COUNT(*) as total_properties,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status = 'under_offer' THEN 1 ELSE 0 END) as under_offer,
          SUM(CASE WHEN listed_date >= date('now', '-30 days') THEN 1 ELSE 0 END) as new_listings
        FROM properties
        ${whereClause}
      `, params),

      // Deals stats
      query(`
        SELECT
          COUNT(*) as total_deals,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status IN ('pending', 'contract_sent', 'contract_signed', 'under_processing') THEN 1 ELSE 0 END) as active_deals,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN deal_value ELSE 0 END), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN status = 'completed' AND actual_close_date >= date('now', '-30 days') THEN deal_value ELSE 0 END), 0) as revenue_this_month
        FROM deals
        ${assigned_to ? 'WHERE agent_id = $1' : ''}
      `, params),

      // Viewings stats
      query(`
        SELECT
          COUNT(*) as total_viewings,
          SUM(CASE WHEN scheduled_at >= datetime('now') THEN 1 ELSE 0 END) as upcoming,
          SUM(CASE WHEN scheduled_at >= date('now') AND scheduled_at < date('now', '+1 day') THEN 1 ELSE 0 END) as today
        FROM viewings
        ${assigned_to ? 'WHERE agent_id = $1' : ''}
      `, params)
    ]);

    // Additional quick stats
    const [tasksStats, conversionStats] = await Promise.all([
      query(`
        SELECT
          COUNT(*) as total_tasks,
          SUM(CASE WHEN status != 'completed' AND date(due_date) = date('now') THEN 1 ELSE 0 END) as due_today,
          SUM(CASE WHEN status != 'completed' AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue,
          SUM(CASE WHEN status = 'completed' AND date(updated_at) = date('now') THEN 1 ELSE 0 END) as completed_today
        FROM tasks
      `),
      query(`
        SELECT
          COUNT(CASE WHEN status = 'deal_won' THEN 1 END) as won,
          COUNT(*) as total,
          ROUND(100.0 * COUNT(CASE WHEN status = 'deal_won' THEN 1 END) / NULLIF(COUNT(*), 0), 1) as conversion_rate,
          COUNT(CASE WHEN created_at >= date('now', '-30 days') THEN 1 END) as new_this_month
        FROM leads
        WHERE created_at >= date('now', '-90 days')
      `)
    ]);

    res.json({
      leads: leadsStats.rows[0],
      contacts: contactsStats.rows[0],
      properties: propertiesStats.rows[0],
      deals: dealsStats.rows[0],
      viewings: viewingsStats.rows[0],
      tasks: tasksStats.rows[0],
      conversion: conversionStats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

/**
 * GET /api/dashboard/activity
 * Get recent activity feed
 */
router.get('/activity', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const result = await query(`
      SELECT
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.created_at,
        u.name as user_name,
        u.avatar_url as user_avatar
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

/**
 * GET /api/dashboard/recent-leads
 * Get recent leads
 */
router.get('/recent-leads', async (req, res) => {
  try {
    const { limit = 10, assigned_to } = req.query;

    const whereClause = assigned_to ? 'WHERE l.assigned_to = $2' : '';
    const params = assigned_to ? [limit, assigned_to] : [limit];

    const result = await query(`
      SELECT
        l.id,
        l.status,
        l.priority,
        l.budget,
        l.created_at,
        c.name as contact_name,
        c.phone as contact_phone,
        u.name as assigned_to_name
      FROM leads l
      LEFT JOIN contacts c ON l.contact_id = c.id
      LEFT JOIN users u ON l.assigned_to = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT $1
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent leads:', error);
    res.status(500).json({ error: 'Failed to fetch recent leads' });
  }
});

/**
 * GET /api/dashboard/upcoming-tasks
 * Get upcoming tasks and follow-ups
 */
router.get('/upcoming-tasks', async (req, res) => {
  try {
    const { assigned_to } = req.query;

    const whereClause = assigned_to ? 'WHERE t.assigned_to = $1' : '';
    const params = assigned_to ? [assigned_to] : [];

    const result = await query(`
      SELECT
        t.id,
        t.title,
        t.description,
        t.due_date,
        t.priority,
        t.status,
        t.related_type,
        t.related_id,
        u.name as assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      ${whereClause}
      AND t.status != 'completed'
      ORDER BY t.due_date ASC
      LIMIT 10
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching upcoming tasks:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming tasks' });
  }
});

/**
 * GET /api/dashboard/upcoming-viewings
 * Get upcoming viewings
 */
router.get('/upcoming-viewings', async (req, res) => {
  try {
    const { assigned_to } = req.query;

    const whereClause = assigned_to ? 'WHERE v.agent_id = $1 AND ' : 'WHERE ';
    const params = assigned_to ? [assigned_to] : [];

    const result = await query(`
      SELECT
        v.id,
        v.scheduled_at,
        v.status,
        c.name as contact_name,
        c.phone as contact_phone,
        p.title as property_title,
        p.location as property_location,
        u.name as agent_name
      FROM viewings v
      LEFT JOIN contacts c ON v.contact_id = c.id
      LEFT JOIN properties p ON v.property_id = p.id
      LEFT JOIN users u ON v.agent_id = u.id
      ${whereClause} v.scheduled_at >= CURRENT_TIMESTAMP
      ORDER BY v.scheduled_at ASC
      LIMIT 10
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching upcoming viewings:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming viewings' });
  }
});

/**
 * GET /api/dashboard/performance
 * Get performance metrics
 */
router.get('/performance', async (req, res) => {
  try {
    const { period = '30', assigned_to } = req.query;

    const whereClause = assigned_to ? 'WHERE agent_id = $2' : '';
    const params = assigned_to ? [period, assigned_to] : [period];

    const [conversionRate, avgDealTime, topAgents] = await Promise.all([
      // Conversion rate
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'deal_won') as won,
          COUNT(*) as total,
          CASE 
            WHEN COUNT(*) > 0 THEN 
              ROUND((COUNT(*) FILTER (WHERE status = 'deal_won')::numeric / COUNT(*)::numeric) * 100, 2)
            ELSE 0
          END as conversion_rate
        FROM leads
        ${whereClause}
        AND created_at >= CURRENT_DATE - INTERVAL '${period} days'
      `, assigned_to ? [assigned_to] : []),

      // Average deal time
      query(`
        SELECT
          AVG(actual_close_date - start_date) as avg_days
        FROM deals
        ${whereClause}
        AND status = 'completed'
        AND actual_close_date >= CURRENT_DATE - INTERVAL '${period} days'
      `, assigned_to ? [assigned_to] : []),

      // Top performing agents (if not filtered by agent)
      !assigned_to ? query(`
        SELECT
          u.id,
          u.name,
          COUNT(d.id) as deals_count,
          SUM(d.deal_value) as total_revenue,
          AVG(d.commission_amount) as avg_commission
        FROM users u
        LEFT JOIN deals d ON d.agent_id = u.id AND d.status = 'completed'
        WHERE u.role IN ('agent', 'manager')
        AND d.actual_close_date >= CURRENT_DATE - INTERVAL '${period} days'
        GROUP BY u.id, u.name
        ORDER BY total_revenue DESC
        LIMIT 5
      `) : Promise.resolve({ rows: [] })
    ]);

    res.json({
      conversion_rate: conversionRate.rows[0],
      avg_deal_time: avgDealTime.rows[0],
      top_agents: topAgents.rows
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

module.exports = router;
