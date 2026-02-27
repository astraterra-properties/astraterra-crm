/**
 * Tasks API Routes
 * Manage tasks, reminders, and follow-ups
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/tasks
 * Get all tasks with filters
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      priority,
      assigned_to,
      type,
      due_date_from,
      due_date_to,
      overdue
    } = req.query;

    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];

    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (priority) {
      conditions.push('t.priority = ?');
      params.push(priority);
    }

    if (assigned_to) {
      conditions.push('t.assigned_to = ?');
      params.push(assigned_to);
    }

    if (type) {
      conditions.push('t.type = ?');
      params.push(type);
    }

    if (due_date_from) {
      conditions.push('t.due_date >= ?');
      params.push(due_date_from);
    }

    if (due_date_to) {
      conditions.push('t.due_date <= ?');
      params.push(due_date_to);
    }

    if (overdue === 'true') {
      conditions.push('t.due_date < date("now")');
      conditions.push('t.status != "completed"');
    }

    // Agent role: restrict to own tasks only
    if (req.user.role === 'agent') {
      conditions.push('t.assigned_to = ?');
      params.push(req.user.id);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const tasks = await query(`
      SELECT 
        t.*,
        u.name as assigned_to_name,
        u.email as assigned_to_email,
        NULL as contact_name,
        NULL as property_id,
        NULL as property_title
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      -- LEFT JOIN contacts c ON t.related_contact_id = c.id
      -- LEFT JOIN properties p ON t.related_property_id = p.id
      ${whereClause}
      ORDER BY 
        CASE t.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        t.due_date ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const total = await query(`
      SELECT COUNT(*) as count
      FROM tasks t
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: tasks.rows || tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.rows?.[0]?.count || total[0]?.count || 0),
        pages: Math.ceil(parseInt(total.rows?.[0]?.count || total[0]?.count || 0) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
});

/**
 * GET /api/tasks/my-tasks
 * Get tasks assigned to current user
 */
router.get('/my-tasks', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const tasks = await query(`
      SELECT 
        t.*,
        NULL as contact_name,
        NULL as property_id,
        NULL as property_title
      FROM tasks t
      -- LEFT JOIN contacts c ON t.related_contact_id = c.id
      -- LEFT JOIN properties p ON t.related_property_id = p.id
      WHERE t.assigned_to = ? AND t.status = ?
      ORDER BY 
        CASE t.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        t.due_date ASC
      LIMIT 100
    `, [req.user.id, status]);

    res.json({
      success: true,
      data: tasks
    });

  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your tasks',
      error: error.message
    });
  }
});

/**
 * GET /api/tasks/upcoming
 * Get upcoming tasks (next 7 days)
 */
router.get('/upcoming', async (req, res) => {
  try {
    const { assigned_to } = req.query;
    let conditions = [
      't.due_date >= date("now")',
      't.due_date <= date("now", "+7 days")',
      't.status != "completed"'
    ];
    let params = [];

    if (assigned_to) {
      conditions.push('t.assigned_to = ?');
      params.push(assigned_to);
    }

    const tasks = await query(`
      SELECT 
        t.*,
        u.name as assigned_to_name,
        NULL as contact_name,
        NULL as property_id,
        NULL as property_title
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      -- LEFT JOIN contacts c ON t.related_contact_id = c.id
      -- LEFT JOIN properties p ON t.related_property_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.due_date ASC
      LIMIT 50
    `, params);

    res.json({
      success: true,
      data: tasks
    });

  } catch (error) {
    console.error('Get upcoming tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming tasks',
      error: error.message
    });
  }
});

/**
 * GET /api/tasks/stats
 * Get task statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN due_date < date('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue
      FROM tasks
    `);

    // By priority
    const byPriority = await query(`
      SELECT 
        priority,
        COUNT(*) as count
      FROM tasks
      WHERE status != 'completed'
      GROUP BY priority
    `);

    // By type
    const byType = await query(`
      SELECT 
        type,
        COUNT(*) as count
      FROM tasks
      WHERE status != 'completed'
      GROUP BY type
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        by_priority: byPriority,
        by_type: byType
      }
    });

  } catch (error) {
    console.error('Get tasks stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/tasks/:id
 * Get single task by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tasks = await query(`
      SELECT 
        t.*,
        u.name as assigned_to_name,
        u.email as assigned_to_email,
        NULL as contact_name,
        c.phone as contact_phone,
        NULL as property_id,
        NULL as property_title
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      -- LEFT JOIN contacts c ON t.related_contact_id = c.id
      -- LEFT JOIN properties p ON t.related_property_id = p.id
      WHERE t.id = ?
    `, [id]);

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: tasks[0]
    });

  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task',
      error: error.message
    });
  }
});

/**
 * POST /api/tasks
 * Create new task
 */
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      priority,
      due_date,
      due_time,
      assigned_to,
      related_contact_id,
      related_property_id,
      related_deal_id,
      reminder_time
    } = req.body;

    // Validate required fields
    if (!title || !type) {
      return res.status(400).json({
        success: false,
        message: 'Title and Type are required'
      });
    }

    const result = await query(`
      INSERT INTO tasks (
        title, description, type, priority, due_date, due_time,
        assigned_to, related_contact_id, related_property_id,
        related_deal_id, reminder_time, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      title,
      description,
      type,
      priority || 'medium',
      due_date,
      due_time,
      assigned_to || req.user.id,
      related_contact_id,
      related_property_id,
      related_deal_id,
      reminder_time
    ]);

    // Log activity
    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, details)
      VALUES (?, 'task', ?, 'created', ?)
    `, [req.user.id, result.lastID, JSON.stringify({ title, type, priority })]);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: { id: result.lastID }
    });

  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: error.message
    });
  }
});

/**
 * PUT /api/tasks/:id
 * Update task
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      type,
      priority,
      due_date,
      due_time,
      status,
      assigned_to,
      reminder_time
    } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(due_date);
    }
    if (due_time !== undefined) {
      updates.push('due_time = ?');
      params.push(due_time);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);

      // Auto-set completed_at when status changes to completed
      if (status === 'completed') {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      }
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }
    if (reminder_time !== undefined) {
      updates.push('reminder_time = ?');
      params.push(reminder_time);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await query(`
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Log activity
    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, details)
      VALUES (?, 'task', ?, 'updated', ?)
    `, [req.user.id, id, JSON.stringify(req.body)]);

    res.json({
      success: true,
      message: 'Task updated successfully'
    });

  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
      error: error.message
    });
  }
});

/**
 * POST /api/tasks/:id/complete
 * Mark task as completed
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { completion_notes } = req.body;

    const result = await query(`
      UPDATE tasks
      SET status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          completion_notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [completion_notes, id]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Log activity
    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, details)
      VALUES (?, 'task', ?, 'completed', ?)
    `, [req.user.id, id, JSON.stringify({ completion_notes })]);

    res.json({
      success: true,
      message: 'Task marked as completed'
    });

  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete task',
      error: error.message
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Agents can only delete their own tasks
    let deleteQuery = 'DELETE FROM tasks WHERE id = ?';
    const deleteParams = [id];
    if (req.user.role === 'agent') {
      deleteQuery += ' AND assigned_to = ?';
      deleteParams.push(req.user.id);
    }

    const result = await query(deleteQuery, deleteParams);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Log activity
    await query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, details)
      VALUES (?, 'task', ?, 'deleted', '{}')
    `, [req.user.id, id]);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: error.message
    });
  }
});

module.exports = router;
