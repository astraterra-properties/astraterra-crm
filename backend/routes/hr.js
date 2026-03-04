/**
 * HR & Payroll API Routes
 * Manages employees, salary payments, commissions, and expenses
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireMinRole } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireMinRole('finance')); // Finance+ can access HR (view); admin+ for mutations

// Salary data is restricted to Finance + Owner only (Admin cannot see salary per permissions matrix)
const requireFinanceOrOwner = (req, res, next) => {
  if (['finance', 'owner'].includes(req.user?.role)) return next();
  return res.status(403).json({ error: 'Access restricted to Finance and Owner roles only' });
};

// ─── EMPLOYEES ──────────────────────────────────────────────────────────────

// GET /api/hr/employees
router.get('/employees', async (req, res) => {
  try {
    const { status } = req.query;
    let conditions = [];
    let params = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(`
      SELECT * FROM employees
      ${whereClause}
      ORDER BY name ASC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch employees', error: err.message });
  }
});

// POST /api/hr/employees — admin only
router.post('/employees', requireMinRole('admin'), async (req, res) => {
  try {
    const {
      name, email, phone, role, department, contract_type,
      start_date, base_salary, currency, payment_frequency,
      iban, bank_name, notes, crm_user_id,
      passport_no, emirates_id, visa_no, rera_license_no, nationality, date_of_birth,
      visa_expiry, emirates_id_expiry, rera_expiry, insurance_expiry,
      probation_end_date, notice_period_days, mol_contract_no
    } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const result = await query(`
      INSERT INTO employees (name, email, phone, role, department, contract_type,
        start_date, base_salary, currency, payment_frequency, iban, bank_name, notes, crm_user_id,
        passport_no, emirates_id, visa_no, rera_license_no, nationality, date_of_birth,
        visa_expiry, emirates_id_expiry, rera_expiry, insurance_expiry,
        probation_end_date, notice_period_days, mol_contract_no)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, email || null, phone || null, role || 'Agent', department || 'Sales',
      contract_type || 'full-time', start_date || null,
      parseFloat(base_salary) || 0, currency || 'AED',
      payment_frequency || 'monthly', iban || null, bank_name || null,
      notes || null, crm_user_id || null,
      passport_no || null, emirates_id || null, visa_no || null, rera_license_no || null,
      nationality || null, date_of_birth || null, visa_expiry || null, emirates_id_expiry || null,
      rera_expiry || null, insurance_expiry || null, probation_end_date || null,
      notice_period_days || 30, mol_contract_no || null
    ]);

    const newEmployee = await query('SELECT * FROM employees WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: newEmployee.rows[0] });
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ success: false, message: 'Failed to create employee', error: err.message });
  }
});

// PUT /api/hr/employees/:id — admin only
router.put('/employees/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, email, phone, role, department, contract_type,
      start_date, base_salary, currency, payment_frequency,
      iban, bank_name, notes, status, crm_user_id,
      passport_no, emirates_id, visa_no, rera_license_no, nationality, date_of_birth,
      visa_expiry, emirates_id_expiry, rera_expiry, insurance_expiry,
      probation_end_date, notice_period_days, mol_contract_no
    } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (department !== undefined) { updates.push('department = ?'); params.push(department); }
    if (contract_type !== undefined) { updates.push('contract_type = ?'); params.push(contract_type); }
    if (start_date !== undefined) { updates.push('start_date = ?'); params.push(start_date); }
    if (base_salary !== undefined) { updates.push('base_salary = ?'); params.push(parseFloat(base_salary)); }
    if (currency !== undefined) { updates.push('currency = ?'); params.push(currency); }
    if (payment_frequency !== undefined) { updates.push('payment_frequency = ?'); params.push(payment_frequency); }
    if (iban !== undefined) { updates.push('iban = ?'); params.push(iban); }
    if (bank_name !== undefined) { updates.push('bank_name = ?'); params.push(bank_name); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (crm_user_id !== undefined) { updates.push('crm_user_id = ?'); params.push(crm_user_id); }
    if (passport_no !== undefined) { updates.push('passport_no = ?'); params.push(passport_no); }
    if (emirates_id !== undefined) { updates.push('emirates_id = ?'); params.push(emirates_id); }
    if (visa_no !== undefined) { updates.push('visa_no = ?'); params.push(visa_no); }
    if (rera_license_no !== undefined) { updates.push('rera_license_no = ?'); params.push(rera_license_no); }
    if (nationality !== undefined) { updates.push('nationality = ?'); params.push(nationality); }
    if (date_of_birth !== undefined) { updates.push('date_of_birth = ?'); params.push(date_of_birth); }
    if (visa_expiry !== undefined) { updates.push('visa_expiry = ?'); params.push(visa_expiry); }
    if (emirates_id_expiry !== undefined) { updates.push('emirates_id_expiry = ?'); params.push(emirates_id_expiry); }
    if (rera_expiry !== undefined) { updates.push('rera_expiry = ?'); params.push(rera_expiry); }
    if (insurance_expiry !== undefined) { updates.push('insurance_expiry = ?'); params.push(insurance_expiry); }
    if (probation_end_date !== undefined) { updates.push('probation_end_date = ?'); params.push(probation_end_date); }
    if (notice_period_days !== undefined) { updates.push('notice_period_days = ?'); params.push(notice_period_days); }
    if (mol_contract_no !== undefined) { updates.push('mol_contract_no = ?'); params.push(mol_contract_no); }

    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

    updates.push("updated_at = datetime('now')");
    params.push(id);

    await query(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, params);
    const updated = await query('SELECT * FROM employees WHERE id = ?', [id]);
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    console.error('Update employee error:', err);
    res.status(500).json({ success: false, message: 'Failed to update employee', error: err.message });
  }
});

// DELETE /api/hr/employees/:id — owner only (termination)
router.delete('/employees/:id', requireMinRole('owner'), async (req, res) => {
  try {
    const { id } = req.params;
    await query("UPDATE employees SET status = 'inactive', updated_at = datetime('now') WHERE id = ?", [id]);
    res.json({ success: true, message: 'Employee deactivated' });
  } catch (err) {
    console.error('Delete employee error:', err);
    res.status(500).json({ success: false, message: 'Failed to deactivate employee', error: err.message });
  }
});

// ─── SALARY PAYMENTS ────────────────────────────────────────────────────────

// GET /api/hr/salary-payments
router.get('/salary-payments', requireFinanceOrOwner, async (req, res) => {
  try {
    const { employee_id, month, status } = req.query;
    let conditions = [];
    let params = [];

    if (employee_id) { conditions.push('sp.employee_id = ?'); params.push(employee_id); }
    if (month) { conditions.push('sp.pay_month = ?'); params.push(month); }
    if (status) { conditions.push('sp.status = ?'); params.push(status); }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(`
      SELECT sp.*, e.name as employee_name, e.role as employee_role, e.department
      FROM salary_payments sp
      LEFT JOIN employees e ON sp.employee_id = e.id
      ${whereClause}
      ORDER BY sp.pay_month DESC, e.name ASC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get salary payments error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch salary payments', error: err.message });
  }
});

// POST /api/hr/salary-payments
router.post('/salary-payments', requireFinanceOrOwner, async (req, res) => {
  try {
    const {
      employee_id, pay_month, base_amount, bonus, deductions,
      payment_date, payment_method, status, notes
    } = req.body;

    if (!employee_id || !pay_month) {
      return res.status(400).json({ success: false, message: 'employee_id and pay_month are required' });
    }

    const base = parseFloat(base_amount) || 0;
    const bonusAmt = parseFloat(bonus) || 0;
    const deductAmt = parseFloat(deductions) || 0;
    const net = base + bonusAmt - deductAmt;

    const result = await query(`
      INSERT INTO salary_payments (employee_id, pay_month, base_amount, bonus, deductions, net_amount,
        payment_date, payment_method, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      employee_id, pay_month, base, bonusAmt, deductAmt, net,
      payment_date || null, payment_method || 'bank_transfer',
      status || 'pending', notes || null
    ]);

    const newPayment = await query(`
      SELECT sp.*, e.name as employee_name FROM salary_payments sp
      LEFT JOIN employees e ON sp.employee_id = e.id
      WHERE sp.id = ?
    `, [result.lastID]);
    res.status(201).json({ success: true, data: newPayment.rows[0] });
  } catch (err) {
    console.error('Create salary payment error:', err);
    res.status(500).json({ success: false, message: 'Failed to create salary payment', error: err.message });
  }
});

// PUT /api/hr/salary-payments/:id
router.put('/salary-payments/:id', requireFinanceOrOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { base_amount, bonus, deductions, payment_date, payment_method, status, notes } = req.body;

    const current = await query('SELECT * FROM salary_payments WHERE id = ?', [id]);
    if (current.rows.length === 0) return res.status(404).json({ success: false, message: 'Payment not found' });

    const base = base_amount !== undefined ? parseFloat(base_amount) : current.rows[0].base_amount;
    const bonusAmt = bonus !== undefined ? parseFloat(bonus) : current.rows[0].bonus;
    const deductAmt = deductions !== undefined ? parseFloat(deductions) : current.rows[0].deductions;
    const net = base + bonusAmt - deductAmt;

    await query(`
      UPDATE salary_payments SET
        base_amount = ?, bonus = ?, deductions = ?, net_amount = ?,
        payment_date = ?, payment_method = ?, status = ?, notes = ?
      WHERE id = ?
    `, [
      base, bonusAmt, deductAmt, net,
      payment_date !== undefined ? payment_date : current.rows[0].payment_date,
      payment_method !== undefined ? payment_method : current.rows[0].payment_method,
      status !== undefined ? status : current.rows[0].status,
      notes !== undefined ? notes : current.rows[0].notes,
      id
    ]);

    const updated = await query(`
      SELECT sp.*, e.name as employee_name FROM salary_payments sp
      LEFT JOIN employees e ON sp.employee_id = e.id WHERE sp.id = ?
    `, [id]);
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    console.error('Update salary payment error:', err);
    res.status(500).json({ success: false, message: 'Failed to update salary payment', error: err.message });
  }
});

// DELETE /api/hr/salary-payments/:id
router.delete('/salary-payments/:id', requireFinanceOrOwner, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM salary_payments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete payment', error: err.message });
  }
});

// ─── COMMISSIONS ────────────────────────────────────────────────────────────

// GET /api/hr/commissions
router.get('/commissions', async (req, res) => {
  try {
    const { broker_id, status } = req.query;
    let conditions = [];
    let params = [];

    if (broker_id) { conditions.push('c.broker_id = ?'); params.push(broker_id); }
    if (status) { conditions.push('c.status = ?'); params.push(status); }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(`
      SELECT c.*, u.name as broker_name_resolved
      FROM commissions c
      LEFT JOIN users u ON c.broker_id = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get commissions error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch commissions', error: err.message });
  }
});

// POST /api/hr/commissions
router.post('/commissions', async (req, res) => {
  try {
    const { broker_id, broker_name, deal_id, commission_type, amount, percentage, payment_date, status, notes } = req.body;

    const result = await query(`
      INSERT INTO commissions (broker_id, broker_name, deal_id, commission_type, amount, percentage, payment_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      broker_id || null, broker_name || null, deal_id || null,
      commission_type || 'sale', parseFloat(amount) || 0, parseFloat(percentage) || 0,
      payment_date || null, status || 'pending', notes || null
    ]);

    const newComm = await query(`
      SELECT c.*, u.name as broker_name_resolved FROM commissions c
      LEFT JOIN users u ON c.broker_id = u.id WHERE c.id = ?
    `, [result.lastID]);
    res.status(201).json({ success: true, data: newComm.rows[0] });
  } catch (err) {
    console.error('Create commission error:', err);
    res.status(500).json({ success: false, message: 'Failed to create commission', error: err.message });
  }
});

// PUT /api/hr/commissions/:id
router.put('/commissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { broker_id, broker_name, deal_id, commission_type, amount, percentage, payment_date, status, notes } = req.body;

    const updates = [];
    const params = [];

    if (broker_id !== undefined) { updates.push('broker_id = ?'); params.push(broker_id); }
    if (broker_name !== undefined) { updates.push('broker_name = ?'); params.push(broker_name); }
    if (deal_id !== undefined) { updates.push('deal_id = ?'); params.push(deal_id); }
    if (commission_type !== undefined) { updates.push('commission_type = ?'); params.push(commission_type); }
    if (amount !== undefined) { updates.push('amount = ?'); params.push(parseFloat(amount)); }
    if (percentage !== undefined) { updates.push('percentage = ?'); params.push(parseFloat(percentage)); }
    if (payment_date !== undefined) { updates.push('payment_date = ?'); params.push(payment_date); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

    params.push(id);
    await query(`UPDATE commissions SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await query(`
      SELECT c.*, u.name as broker_name_resolved FROM commissions c
      LEFT JOIN users u ON c.broker_id = u.id WHERE c.id = ?
    `, [id]);
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    console.error('Update commission error:', err);
    res.status(500).json({ success: false, message: 'Failed to update commission', error: err.message });
  }
});

// DELETE /api/hr/commissions/:id
router.delete('/commissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM commissions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Commission deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete commission', error: err.message });
  }
});

// ─── EXPENSES ────────────────────────────────────────────────────────────────

// GET /api/hr/expenses
router.get('/expenses', async (req, res) => {
  try {
    const { category, status } = req.query;
    let conditions = [];
    let params = [];

    if (category) { conditions.push('ex.category = ?'); params.push(category); }
    if (status) { conditions.push('ex.status = ?'); params.push(status); }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(`
      SELECT ex.*, e.name as paid_by_name
      FROM expenses ex
      LEFT JOIN employees e ON ex.paid_by_employee_id = e.id
      ${whereClause}
      ORDER BY ex.created_at DESC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get expenses error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch expenses', error: err.message });
  }
});

// POST /api/hr/expenses
router.post('/expenses', async (req, res) => {
  try {
    const { category, description, amount, currency, expense_date, paid_by_employee_id, receipt_url, notes } = req.body;

    if (!description) return res.status(400).json({ success: false, message: 'Description is required' });

    const result = await query(`
      INSERT INTO expenses (category, description, amount, currency, expense_date, paid_by_employee_id, receipt_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      category || 'General', description, parseFloat(amount) || 0,
      currency || 'AED', expense_date || null,
      paid_by_employee_id || null, receipt_url || null, notes || null
    ]);

    const newExp = await query(`
      SELECT ex.*, e.name as paid_by_name FROM expenses ex
      LEFT JOIN employees e ON ex.paid_by_employee_id = e.id WHERE ex.id = ?
    `, [result.lastID]);
    res.status(201).json({ success: true, data: newExp.rows[0] });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ success: false, message: 'Failed to create expense', error: err.message });
  }
});

// PUT /api/hr/expenses/:id
router.put('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, description, amount, currency, expense_date, paid_by_employee_id, status, approved_by, notes } = req.body;

    const updates = [];
    const params = [];

    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (amount !== undefined) { updates.push('amount = ?'); params.push(parseFloat(amount)); }
    if (currency !== undefined) { updates.push('currency = ?'); params.push(currency); }
    if (expense_date !== undefined) { updates.push('expense_date = ?'); params.push(expense_date); }
    if (paid_by_employee_id !== undefined) { updates.push('paid_by_employee_id = ?'); params.push(paid_by_employee_id); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (approved_by !== undefined) { updates.push('approved_by = ?'); params.push(approved_by); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

    params.push(id);
    await query(`UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await query(`
      SELECT ex.*, e.name as paid_by_name FROM expenses ex
      LEFT JOIN employees e ON ex.paid_by_employee_id = e.id WHERE ex.id = ?
    `, [id]);
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ success: false, message: 'Failed to update expense', error: err.message });
  }
});

// DELETE /api/hr/expenses/:id
router.delete('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM expenses WHERE id = ?', [id]);
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete expense', error: err.message });
  }
});

// ─── PAYROLL SUMMARY ────────────────────────────────────────────────────────

// GET /api/hr/payroll-summary
router.get('/payroll-summary', async (req, res) => {
  try {
    const { month } = req.query; // format: YYYY-MM

    let salaryCondition = '';
    let commCondition = '';
    let expCondition = '';
    let params1 = [], params2 = [], params3 = [];

    if (month) {
      salaryCondition = 'WHERE pay_month = ?';
      params1 = [month];
      commCondition = "WHERE strftime('%Y-%m', created_at) = ?";
      params2 = [month];
      expCondition = "WHERE strftime('%Y-%m', expense_date) = ? AND status = 'approved'";
      params3 = [month];
    }

    const [salaries, commissions, expenses, activeEmps] = await Promise.all([
      query(`
        SELECT
          SUM(CASE WHEN status='paid' THEN net_amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN status='pending' THEN net_amount ELSE 0 END) as total_pending,
          COUNT(*) as count
        FROM salary_payments ${salaryCondition}
      `, params1),
      query(`
        SELECT
          SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN status='pending' THEN amount ELSE 0 END) as total_pending
        FROM commissions ${commCondition}
      `, params2),
      query(`
        SELECT SUM(amount) as total_approved FROM expenses ${expCondition}
      `, params3),
      query(`SELECT SUM(base_salary) as monthly_payroll, COUNT(*) as count FROM employees WHERE status='active'`),
    ]);

    res.json({
      success: true,
      data: {
        salaries: {
          paid: salaries.rows[0]?.total_paid || 0,
          pending: salaries.rows[0]?.total_pending || 0,
          count: salaries.rows[0]?.count || 0,
        },
        commissions: {
          paid: commissions.rows[0]?.total_paid || 0,
          pending: commissions.rows[0]?.total_pending || 0,
        },
        expenses: {
          total_approved: expenses.rows[0]?.total_approved || 0,
        },
        employees: {
          active_count: activeEmps.rows[0]?.count || 0,
          monthly_payroll: activeEmps.rows[0]?.monthly_payroll || 0,
        },
      },
    });
  } catch (err) {
    console.error('Payroll summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll summary', error: err.message });
  }
});

// ─── ACCOUNTING SUMMARY ─────────────────────────────────────────────────────

// GET /api/hr/accounting-summary
router.get('/accounting-summary', async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM

    const currentMonth = month || new Date().toISOString().substring(0, 7);

    const [revenue, salaryCosts, commCosts, expCosts] = await Promise.all([
      query(`
        SELECT COALESCE(SUM(deal_value), 0) as total
        FROM deals
        WHERE status = 'closed_won'
        AND strftime('%Y-%m', updated_at) = ?
      `, [currentMonth]),
      query(`
        SELECT
          COALESCE(SUM(CASE WHEN status='paid' THEN net_amount ELSE 0 END), 0) as paid,
          COALESCE(SUM(CASE WHEN status='pending' THEN net_amount ELSE 0 END), 0) as pending
        FROM salary_payments
        WHERE pay_month = ?
      `, [currentMonth]),
      query(`
        SELECT
          COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END), 0) as paid,
          COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END), 0) as pending
        FROM commissions
        WHERE strftime('%Y-%m', created_at) = ?
      `, [currentMonth]),
      query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE strftime('%Y-%m', expense_date) = ?
        AND status = 'approved'
      `, [currentMonth]),
    ]);

    const totalRevenue = revenue.rows[0]?.total || 0;
    const totalSalaries = (salaryCosts.rows[0]?.paid || 0) + (salaryCosts.rows[0]?.pending || 0);
    const totalComm = (commCosts.rows[0]?.paid || 0) + (commCosts.rows[0]?.pending || 0);
    const totalExp = expCosts.rows[0]?.total || 0;
    const netPL = totalRevenue - totalSalaries - totalComm - totalExp;

    res.json({
      success: true,
      data: {
        month: currentMonth,
        revenue: totalRevenue,
        salary_costs: { paid: salaryCosts.rows[0]?.paid || 0, pending: salaryCosts.rows[0]?.pending || 0 },
        commission_costs: { paid: commCosts.rows[0]?.paid || 0, pending: commCosts.rows[0]?.pending || 0 },
        expenses: totalExp,
        net_pl: netPL,
      },
    });
  } catch (err) {
    console.error('Accounting summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch accounting summary', error: err.message });
  }
});

// ─── LEAVE MANAGEMENT ───────────────────────────────────────────────────────

router.get('/leaves', async (req, res) => {
  try {
    const { employee_id, status } = req.query;
    let sql = 'SELECT * FROM leaves WHERE 1=1';
    const params = [];
    if (employee_id) { sql += ' AND employee_id=?'; params.push(employee_id); }
    if (status) { sql += ' AND status=?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/leaves', async (req, res) => {
  try {
    const { employee_id, employee_name, leave_type, start_date, end_date, days_requested, reason } = req.body;
    const result = await query(
      'INSERT INTO leaves (employee_id,employee_name,leave_type,start_date,end_date,days_requested,reason) VALUES (?,?,?,?,?,?,?)',
      [employee_id, employee_name, leave_type, start_date, end_date, days_requested, reason]
    );
    res.json({ success: true, data: { id: result.lastID } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/leaves/:id', async (req, res) => {
  try {
    const { status, approved_by, notes } = req.body;
    await query(
      "UPDATE leaves SET status=?, approved_by=?, approved_at=datetime('now'), notes=? WHERE id=?",
      [status, approved_by, notes, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/leaves/:id', async (req, res) => {
  try {
    await query('DELETE FROM leaves WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── DOCUMENT EXPIRY ALERTS ─────────────────────────────────────────────────

router.get('/expiry-alerts', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const in90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const result = await query(
      `SELECT id, name, visa_expiry, emirates_id_expiry, rera_expiry, insurance_expiry
       FROM employees WHERE status='active' AND (
         (visa_expiry BETWEEN ? AND ?) OR (emirates_id_expiry BETWEEN ? AND ?) OR
         (rera_expiry BETWEEN ? AND ?) OR (insurance_expiry BETWEEN ? AND ?)
       )`,
      [today, in90, today, in90, today, in90, today, in90]
    );
    const alerts = [];
    result.rows.forEach(r => {
      const docs = [
        { type: 'Visa', expiry: r.visa_expiry },
        { type: 'Emirates ID', expiry: r.emirates_id_expiry },
        { type: 'RERA License', expiry: r.rera_expiry },
        { type: 'Medical Insurance', expiry: r.insurance_expiry },
      ];
      docs.forEach(d => {
        if (d.expiry && d.expiry >= today && d.expiry <= in90) {
          const days = Math.ceil((new Date(d.expiry) - new Date(today)) / 86400000);
          alerts.push({ employee_id: r.id, employee_name: r.name, doc_type: d.type, expiry_date: d.expiry, days_remaining: days });
        }
      });
    });
    res.json({ success: true, data: alerts.sort((a, b) => a.days_remaining - b.days_remaining) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── PERFORMANCE KPIs ────────────────────────────────────────────────────────

router.get('/kpis', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const result = await query(
      `SELECT k.*, e.name as employee_name FROM agent_kpis k
       LEFT JOIN employees e ON e.id=k.employee_id
       WHERE k.month=? ORDER BY k.revenue_generated DESC`,
      [month]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/kpis', async (req, res) => {
  try {
    const { employee_id, month, listings_created, deals_closed, revenue_generated, viewings_conducted, leads_converted, target_revenue, notes } = req.body;
    const result = await query(
      `INSERT INTO agent_kpis (employee_id,month,listings_created,deals_closed,revenue_generated,viewings_conducted,leads_converted,target_revenue,notes)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(employee_id,month) DO UPDATE SET
       listings_created=excluded.listings_created, deals_closed=excluded.deals_closed,
       revenue_generated=excluded.revenue_generated, viewings_conducted=excluded.viewings_conducted,
       leads_converted=excluded.leads_converted, target_revenue=excluded.target_revenue, notes=excluded.notes`,
      [employee_id, month, listings_created || 0, deals_closed || 0, revenue_generated || 0, viewings_conducted || 0, leads_converted || 0, target_revenue || 0, notes]
    );
    res.json({ success: true, data: { id: result.lastID } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── RECRUITMENT / APPLICANTS ────────────────────────────────────────────────

router.get('/applicants', async (req, res) => {
  try {
    const { stage } = req.query;
    let sql = 'SELECT * FROM applicants WHERE 1=1';
    const params = [];
    if (stage) { sql += ' AND stage=?'; params.push(stage); }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/applicants', requireMinRole('admin'), async (req, res) => {
  try {
    const { full_name, email, phone, role_applied, source, stage, interview_date, interview_notes, salary_expectation, cv_url, rera_registered } = req.body;
    const result = await query(
      'INSERT INTO applicants (full_name,email,phone,role_applied,source,stage,interview_date,interview_notes,salary_expectation,cv_url,rera_registered) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [full_name, email, phone, role_applied || 'Agent', source, stage || 'applied', interview_date, interview_notes, salary_expectation, cv_url, rera_registered || 0]
    );
    res.json({ success: true, data: { id: result.lastID } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/applicants/:id', requireMinRole('admin'), async (req, res) => {
  try {
    const { stage, interview_notes, interview_date, full_name, email, phone, role_applied, source, salary_expectation } = req.body;
    const updates = [];
    const params = [];
    if (stage !== undefined) { updates.push('stage=?'); params.push(stage); }
    if (interview_notes !== undefined) { updates.push('interview_notes=?'); params.push(interview_notes); }
    if (interview_date !== undefined) { updates.push('interview_date=?'); params.push(interview_date); }
    if (full_name !== undefined) { updates.push('full_name=?'); params.push(full_name); }
    if (email !== undefined) { updates.push('email=?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone=?'); params.push(phone); }
    if (role_applied !== undefined) { updates.push('role_applied=?'); params.push(role_applied); }
    if (source !== undefined) { updates.push('source=?'); params.push(source); }
    if (salary_expectation !== undefined) { updates.push('salary_expectation=?'); params.push(salary_expectation); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    updates.push("updated_at=datetime('now')");
    params.push(req.params.id);
    await query(`UPDATE applicants SET ${updates.join(',')} WHERE id=?`, params);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/applicants/:id', requireMinRole('admin'), async (req, res) => {
  try {
    await query('DELETE FROM applicants WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─── TRAINING & LICENSING ────────────────────────────────────────────────────

router.get('/training', async (req, res) => {
  try {
    const { employee_id, status } = req.query;
    let sql = 'SELECT * FROM training_records WHERE 1=1';
    const params = [];
    if (employee_id) { sql += ' AND employee_id=?'; params.push(employee_id); }
    if (status) { sql += ' AND status=?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/training', async (req, res) => {
  try {
    const { employee_id, employee_name, training_type, course_name, provider, completion_date, expiry_date, certificate_url, status, score, notes } = req.body;
    const result = await query(
      'INSERT INTO training_records (employee_id,employee_name,training_type,course_name,provider,completion_date,expiry_date,certificate_url,status,score,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [employee_id, employee_name, training_type, course_name, provider, completion_date, expiry_date, certificate_url, status || 'pending', score, notes]
    );
    res.json({ success: true, data: { id: result.lastID } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/training/:id', async (req, res) => {
  try {
    const { status, score, completion_date, expiry_date, notes, training_type, course_name, provider } = req.body;
    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status=?'); params.push(status); }
    if (score !== undefined) { updates.push('score=?'); params.push(score); }
    if (completion_date !== undefined) { updates.push('completion_date=?'); params.push(completion_date); }
    if (expiry_date !== undefined) { updates.push('expiry_date=?'); params.push(expiry_date); }
    if (notes !== undefined) { updates.push('notes=?'); params.push(notes); }
    if (training_type !== undefined) { updates.push('training_type=?'); params.push(training_type); }
    if (course_name !== undefined) { updates.push('course_name=?'); params.push(course_name); }
    if (provider !== undefined) { updates.push('provider=?'); params.push(provider); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await query(`UPDATE training_records SET ${updates.join(',')} WHERE id=?`, params);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/training/:id', async (req, res) => {
  try {
    await query('DELETE FROM training_records WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
