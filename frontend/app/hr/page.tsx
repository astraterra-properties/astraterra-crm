'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users2, Plus, Edit2, Trash2, ChevronDown, ChevronUp, X, Search,
  DollarSign, TrendingUp, AlertCircle, Calendar, CheckCircle, Clock,
  Building2, CreditCard, FileText, Filter,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Employee {
  id: number; name: string; email: string; phone: string;
  role: string; department: string; contract_type: string;
  start_date: string; base_salary: number; currency: string;
  payment_frequency: string; iban: string; bank_name: string;
  status: string; notes: string; crm_user_id: number;
  created_at: string;
}

interface SalaryPayment {
  id: number; employee_id: number; employee_name: string; pay_month: string;
  base_amount: number; bonus: number; deductions: number; net_amount: number;
  payment_date: string; payment_method: string; status: string; notes: string;
}

interface Commission {
  id: number; employee_id: number; employee_name: string; deal_id: number;
  deal_title: string; amount: number; percentage: number;
  commission_date: string; status: string; notes: string;
}

interface Expense {
  id: number; category: string; description: string; amount: number;
  currency: string; expense_date: string; paid_by_employee_id: number;
  paid_by_name: string; status: string; notes: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const badge = (status: string) => {
  const map: Record<string, string> = {
    active: 'bg-green-900/30 text-green-400',
    paid: 'bg-green-900/30 text-green-400',
    approved: 'bg-green-900/30 text-green-400',
    pending: 'bg-yellow-900/30 text-yellow-400',
    inactive: 'bg-red-900/30 text-red-400',
    rejected: 'bg-red-900/30 text-red-400',
    'full-time': 'bg-blue-900/30 text-blue-400',
    'part-time': 'bg-purple-900/30 text-purple-400',
    freelance: 'bg-orange-900/30 text-orange-400',
    contractor: 'bg-pink-900/30 text-pink-400',
  };
  return `px-2 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-700 text-gray-300'}`;
};

const getCurrentMonth = () => new Date().toISOString().substring(0, 7);

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color }: { title: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>{title}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{sub}</p>}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm text-white border focus:outline-none focus:border-yellow-500/60 transition-colors";
const inputStyle = { background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(201,169,110,0.3)', color: 'white' };

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <Field label={label}><input className={inputCls} style={inputStyle} {...props} /></Field>;
}

function Select({ label, children, ...props }: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label}>
      <select className={inputCls} style={{ ...inputStyle, background: '#1a2438' }} {...props}>
        {children}
      </select>
    </Field>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function HRPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll' | 'commissions' | 'expenses'>('employees');
  const [token, setToken] = useState('');

  // Employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expandedEmp, setExpandedEmp] = useState<number | null>(null);
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [empSearch, setEmpSearch] = useState('');

  // Payroll
  const [payroll, setPayroll] = useState<SalaryPayment[]>([]);
  const [payrollMonth, setPayrollMonth] = useState(getCurrentMonth());

  // Commissions
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [showAddComm, setShowAddComm] = useState(false);
  const [commFilter, setCommFilter] = useState('');

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddExp, setShowAddExp] = useState(false);
  const [expCatFilter, setExpCatFilter] = useState('');

  // Summary
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const loadEmployees = useCallback(async () => {
    if (!token) return;
    const r = await fetch('/api/hr/employees', { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setEmployees(d.data);
  }, [token, authHeaders]);

  const loadPayroll = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/hr/salary-payments?month=${payrollMonth}`, { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setPayroll(d.data);
  }, [token, payrollMonth, authHeaders]);

  const loadCommissions = useCallback(async () => {
    if (!token) return;
    const r = await fetch('/api/hr/commissions', { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setCommissions(d.data);
  }, [token, authHeaders]);

  const loadExpenses = useCallback(async () => {
    if (!token) return;
    const r = await fetch('/api/hr/expenses', { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setExpenses(d.data);
  }, [token, authHeaders]);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    const r = await fetch('/api/hr/payroll-summary', { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setSummary(d.data);
  }, [token, authHeaders]);

  useEffect(() => {
    if (!token) return;
    loadEmployees();
    loadCommissions();
    loadExpenses();
    loadSummary();
  }, [token]);

  useEffect(() => { if (token) loadPayroll(); }, [token, payrollMonth]);

  // ── Employee form ──────────────────────────────────────────────────────────
  const emptyEmp = { name: '', email: '', phone: '', role: 'Agent', department: 'Sales', contract_type: 'full-time', start_date: '', base_salary: '', currency: 'AED', payment_frequency: 'monthly', iban: '', bank_name: '', notes: '' };
  const [empForm, setEmpForm] = useState<any>(emptyEmp);

  const openEditEmp = (e: Employee) => { setEditEmp(e); setEmpForm({ ...e, base_salary: String(e.base_salary) }); };

  const saveEmployee = async () => {
    const body = { ...empForm, base_salary: parseFloat(empForm.base_salary) || 0 };
    const url = editEmp ? `/api/hr/employees/${editEmp.id}` : '/api/hr/employees';
    const method = editEmp ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
    const d = await r.json();
    if (d.success) { loadEmployees(); loadSummary(); setShowAddEmp(false); setEditEmp(null); setEmpForm(emptyEmp); }
    else alert(d.message);
  };

  const deleteEmployee = async (id: number) => {
    if (!confirm('Deactivate this employee?')) return;
    await fetch(`/api/hr/employees/${id}`, { method: 'DELETE', headers: authHeaders() });
    loadEmployees(); loadSummary();
  };

  // ── Payroll ────────────────────────────────────────────────────────────────
  const generatePayroll = async () => {
    const activeEmps = employees.filter(e => e.status === 'active');
    const existing = new Set(payroll.map(p => p.employee_id));
    let created = 0;
    for (const emp of activeEmps) {
      if (!existing.has(emp.id)) {
        await fetch('/api/hr/salary-payments', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ employee_id: emp.id, pay_month: payrollMonth, base_amount: emp.base_salary }),
        });
        created++;
      }
    }
    loadPayroll();
    if (created === 0) alert('Payroll already generated for all active employees this month.');
  };

  const markPaid = async (payment: SalaryPayment) => {
    await fetch(`/api/hr/salary-payments/${payment.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'paid', payment_date: new Date().toISOString().substring(0, 10) }),
    });
    loadPayroll();
  };

  // ── Commission form ────────────────────────────────────────────────────────
  const [commForm, setCommForm] = useState<any>({ employee_id: '', deal_title: '', amount: '', percentage: '', commission_date: '', notes: '' });

  const saveCommission = async () => {
    const r = await fetch('/api/hr/commissions', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ ...commForm, amount: parseFloat(commForm.amount) || 0, percentage: parseFloat(commForm.percentage) || 0 }),
    });
    const d = await r.json();
    if (d.success) { loadCommissions(); setShowAddComm(false); setCommForm({ employee_id: '', deal_title: '', amount: '', percentage: '', commission_date: '', notes: '' }); }
    else alert(d.message);
  };

  const updateCommissionStatus = async (id: number, status: string) => {
    await fetch(`/api/hr/commissions/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status }) });
    loadCommissions();
  };

  // ── Expense form ───────────────────────────────────────────────────────────
  const [expForm, setExpForm] = useState<any>({ category: 'General', description: '', amount: '', currency: 'AED', expense_date: '', paid_by_employee_id: '', notes: '' });

  const saveExpense = async () => {
    const r = await fetch('/api/hr/expenses', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ ...expForm, amount: parseFloat(expForm.amount) || 0 }),
    });
    const d = await r.json();
    if (d.success) { loadExpenses(); setShowAddExp(false); setExpForm({ category: 'General', description: '', amount: '', currency: 'AED', expense_date: '', paid_by_employee_id: '', notes: '' }); }
    else alert(d.message);
  };

  const updateExpenseStatus = async (id: number, status: string) => {
    await fetch(`/api/hr/expenses/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status, approved_by: 1 }) });
    loadExpenses();
  };

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredEmps = employees.filter(e => !empSearch || e.name.toLowerCase().includes(empSearch.toLowerCase()) || e.role.toLowerCase().includes(empSearch.toLowerCase()));
  const filteredComm = commissions.filter(c => !commFilter || c.status === commFilter || (c.employee_name || '').toLowerCase().includes(commFilter.toLowerCase()));
  const filteredExp = expenses.filter(e => !expCatFilter || e.category === expCatFilter);

  const payrollTotals = {
    total: payroll.reduce((s, p) => s + (p.net_amount || 0), 0),
    paid: payroll.filter(p => p.status === 'paid').reduce((s, p) => s + (p.net_amount || 0), 0),
    pending: payroll.filter(p => p.status === 'pending').reduce((s, p) => s + (p.net_amount || 0), 0),
  };

  const tabs = [
    { id: 'employees', label: 'Employees' },
    { id: 'payroll', label: 'Payroll' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'expenses', label: 'Expenses' },
  ] as const;

  const thCls = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider";
  const thStyle = { color: 'rgba(201,169,110,0.8)' };
  const tdCls = "px-4 py-3 text-sm text-white";
  const trStyle = { borderColor: 'rgba(201,169,110,0.1)' };

  return (
    <div className="flex-1 min-h-screen p-6" style={{ background: '#0f1623' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
            <Users2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">HR Management</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Staff, payroll, commissions & expenses</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Total Staff" value={String(summary?.employees?.active_count || 0)} sub="Active employees" icon={Users2} color="bg-blue-500/20 text-blue-400" />
        <KpiCard title="Monthly Payroll" value={`AED ${fmt(summary?.employees?.monthly_payroll || 0)}`} sub="Sum of base salaries" icon={DollarSign} color="bg-yellow-500/20 text-yellow-400" />
        <KpiCard title="Commissions Due" value={`AED ${fmt(summary?.commissions?.pending || 0)}`} sub="Pending commissions" icon={TrendingUp} color="bg-green-500/20 text-green-400" />
        <KpiCard title="Expenses This Month" value={`AED ${fmt(summary?.expenses?.total_approved || 0)}`} sub="Approved expenses" icon={AlertCircle} color="bg-red-500/20 text-red-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === t.id
              ? { background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white' }
              : { color: 'rgba(255,255,255,0.55)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── EMPLOYEES TAB ── */}
      {activeTab === 'employees' && (
        <div className="rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
              <input value={empSearch} onChange={e => setEmpSearch(e.target.value)} placeholder="Search employees..."
                className="pl-9 pr-4 py-2 rounded-lg text-sm text-white border focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(201,169,110,0.3)', width: '220px' }} />
            </div>
            <button onClick={() => { setShowAddEmp(true); setEditEmp(null); setEmpForm(emptyEmp); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={trStyle}>
                <th className={thCls} style={thStyle}>Name</th>
                <th className={thCls} style={thStyle}>Role</th>
                <th className={thCls} style={thStyle}>Department</th>
                <th className={thCls} style={thStyle}>Contract</th>
                <th className={thCls} style={thStyle}>Base Salary</th>
                <th className={thCls} style={thStyle}>Status</th>
                <th className={thCls} style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmps.map(emp => (
                <>
                  <tr key={emp.id} className="border-b cursor-pointer hover:bg-white/5 transition-colors" style={trStyle}
                    onClick={() => setExpandedEmp(expandedEmp === emp.id ? null : emp.id)}>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white' }}>
                          {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white">{emp.name}</p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={tdCls}>{emp.role}</td>
                    <td className={tdCls}>{emp.department}</td>
                    <td className={tdCls}><span className={badge(emp.contract_type)}>{emp.contract_type}</span></td>
                    <td className={tdCls}><span className="font-semibold" style={{ color: '#C9A96E' }}>AED {fmt(emp.base_salary)}</span></td>
                    <td className={tdCls}><span className={badge(emp.status)}>{emp.status}</span></td>
                    <td className={tdCls} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditEmp(emp)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteEmployee(emp.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {expandedEmp === emp.id ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                    </td>
                  </tr>
                  {expandedEmp === emp.id && (
                    <tr key={`exp-${emp.id}`} style={{ background: 'rgba(201,169,110,0.05)' }}>
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Phone</p>
                            <p className="text-white">{emp.phone || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Start Date</p>
                            <p className="text-white">{emp.start_date || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Payment Frequency</p>
                            <p className="text-white capitalize">{emp.payment_frequency}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Bank</p>
                            <p className="text-white">{emp.bank_name || '—'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>IBAN</p>
                            <p className="text-white font-mono text-xs">{emp.iban || '—'}</p>
                          </div>
                          {emp.notes && (
                            <div className="col-span-2">
                              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Notes</p>
                              <p className="text-white">{emp.notes}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {filteredEmps.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PAYROLL TAB ── */}
      {activeTab === 'payroll' && (
        <div>
          {/* Payroll summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-xl p-4 border" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Total Payroll</p>
              <p className="text-xl font-bold" style={{ color: '#C9A96E' }}>AED {fmt(payrollTotals.total)}</p>
            </div>
            <div className="rounded-xl p-4 border" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Paid</p>
              <p className="text-xl font-bold text-green-400">AED {fmt(payrollTotals.paid)}</p>
            </div>
            <div className="rounded-xl p-4 border" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Pending</p>
              <p className="text-xl font-bold text-yellow-400">AED {fmt(payrollTotals.pending)}</p>
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4" style={{ color: '#C9A96E' }} />
                <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-sm text-white border focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(201,169,110,0.3)' }} />
              </div>
              <button onClick={generatePayroll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                <Plus className="w-4 h-4" /> Generate Payroll
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b" style={trStyle}>
                  <th className={thCls} style={thStyle}>Employee</th>
                  <th className={thCls} style={thStyle}>Base</th>
                  <th className={thCls} style={thStyle}>Bonus</th>
                  <th className={thCls} style={thStyle}>Deductions</th>
                  <th className={thCls} style={thStyle}>Net</th>
                  <th className={thCls} style={thStyle}>Status</th>
                  <th className={thCls} style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payroll.map(p => (
                  <tr key={p.id} className="border-b hover:bg-white/5 transition-colors" style={trStyle}>
                    <td className={tdCls}>{p.employee_name}</td>
                    <td className={tdCls}>AED {fmt(p.base_amount)}</td>
                    <td className={tdCls}><span className="text-green-400">+AED {fmt(p.bonus)}</span></td>
                    <td className={tdCls}><span className="text-red-400">-AED {fmt(p.deductions)}</span></td>
                    <td className={tdCls}><span className="font-semibold" style={{ color: '#C9A96E' }}>AED {fmt(p.net_amount)}</span></td>
                    <td className={tdCls}><span className={badge(p.status)}>{p.status}</span></td>
                    <td className={tdCls}>
                      {p.status === 'pending' && (
                        <button onClick={() => markPaid(p)}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors">
                          <CheckCircle className="w-3.5 h-3.5" /> Pay
                        </button>
                      )}
                      {p.status === 'paid' && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.payment_date}</span>}
                    </td>
                  </tr>
                ))}
                {payroll.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    No payroll records for this month. Click "Generate Payroll" to create them.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── COMMISSIONS TAB ── */}
      {activeTab === 'commissions' && (
        <div className="rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
              <input value={commFilter} onChange={e => setCommFilter(e.target.value)} placeholder="Filter by name or status..."
                className="pl-9 pr-4 py-2 rounded-lg text-sm text-white border focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(201,169,110,0.3)', width: '220px' }} />
            </div>
            <button onClick={() => setShowAddComm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
              <Plus className="w-4 h-4" /> Add Commission
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={trStyle}>
                <th className={thCls} style={thStyle}>Employee</th>
                <th className={thCls} style={thStyle}>Deal</th>
                <th className={thCls} style={thStyle}>Amount</th>
                <th className={thCls} style={thStyle}>%</th>
                <th className={thCls} style={thStyle}>Date</th>
                <th className={thCls} style={thStyle}>Status</th>
                <th className={thCls} style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComm.map(c => (
                <tr key={c.id} className="border-b hover:bg-white/5 transition-colors" style={trStyle}>
                  <td className={tdCls}>{c.employee_name || '—'}</td>
                  <td className={tdCls}>{c.deal_title || '—'}</td>
                  <td className={tdCls}><span className="font-semibold" style={{ color: '#C9A96E' }}>AED {fmt(c.amount)}</span></td>
                  <td className={tdCls}>{c.percentage ? `${c.percentage}%` : '—'}</td>
                  <td className={tdCls}>{c.commission_date || '—'}</td>
                  <td className={tdCls}><span className={badge(c.status)}>{c.status}</span></td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-1">
                      {c.status === 'pending' && (
                        <button onClick={() => updateCommissionStatus(c.id, 'paid')}
                          className="px-2 py-1 rounded text-xs bg-green-900/30 text-green-400 hover:bg-green-900/50">Mark Paid</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredComm.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No commissions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── EXPENSES TAB ── */}
      {activeTab === 'expenses' && (
        <div className="rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
            <select value={expCatFilter} onChange={e => setExpCatFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm text-white border focus:outline-none"
              style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)', minWidth: '160px' }}>
              <option value="">All Categories</option>
              {['Marketing', 'Office', 'Travel', 'Utilities', 'General', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button onClick={() => setShowAddExp(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={trStyle}>
                <th className={thCls} style={thStyle}>Category</th>
                <th className={thCls} style={thStyle}>Description</th>
                <th className={thCls} style={thStyle}>Amount</th>
                <th className={thCls} style={thStyle}>Date</th>
                <th className={thCls} style={thStyle}>Paid By</th>
                <th className={thCls} style={thStyle}>Status</th>
                <th className={thCls} style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExp.map(e => (
                <tr key={e.id} className="border-b hover:bg-white/5 transition-colors" style={trStyle}>
                  <td className={tdCls}>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-400">{e.category}</span>
                  </td>
                  <td className={tdCls}>{e.description}</td>
                  <td className={tdCls}><span className="font-semibold text-red-400">AED {fmt(e.amount)}</span></td>
                  <td className={tdCls}>{e.expense_date || '—'}</td>
                  <td className={tdCls}>{e.paid_by_name || '—'}</td>
                  <td className={tdCls}><span className={badge(e.status)}>{e.status}</span></td>
                  <td className={tdCls}>
                    {e.status === 'pending' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateExpenseStatus(e.id, 'approved')}
                          className="px-2 py-1 rounded text-xs bg-green-900/30 text-green-400 hover:bg-green-900/50">Approve</button>
                        <button onClick={() => updateExpenseStatus(e.id, 'rejected')}
                          className="px-2 py-1 rounded text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredExp.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No expenses found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Add/Edit Employee Modal */}
      {(showAddEmp || editEmp) && (
        <Modal title={editEmp ? 'Edit Employee' : 'Add Employee'} onClose={() => { setShowAddEmp(false); setEditEmp(null); setEmpForm(emptyEmp); }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Input label="Full Name *" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} placeholder="e.g. John Smith" /></div>
            <Input label="Email" type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} placeholder="john@company.com" />
            <Input label="Phone" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} placeholder="+971 50 123 4567" />
            <Select label="Role" value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })}>
              {['Agent', 'Admin', 'Support', 'Finance'].map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Select label="Department" value={empForm.department} onChange={e => setEmpForm({ ...empForm, department: e.target.value })}>
              {['Sales', 'Admin', 'Finance', 'Marketing'].map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Select label="Contract Type" value={empForm.contract_type} onChange={e => setEmpForm({ ...empForm, contract_type: e.target.value })}>
              {[['full-time','Full-time'],['part-time','Part-time'],['freelance','Freelance'],['contractor','Contractor']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Input label="Start Date" type="date" value={empForm.start_date} onChange={e => setEmpForm({ ...empForm, start_date: e.target.value })} />
            <Input label="Base Salary (AED)" type="number" value={empForm.base_salary} onChange={e => setEmpForm({ ...empForm, base_salary: e.target.value })} placeholder="0.00" />
            <Select label="Payment Frequency" value={empForm.payment_frequency} onChange={e => setEmpForm({ ...empForm, payment_frequency: e.target.value })}>
              <option value="monthly">Monthly</option>
              <option value="bi-weekly">Bi-weekly</option>
            </Select>
            <Input label="IBAN" value={empForm.iban} onChange={e => setEmpForm({ ...empForm, iban: e.target.value })} placeholder="AE07 0331 2345 6789 012" />
            <Input label="Bank Name" value={empForm.bank_name} onChange={e => setEmpForm({ ...empForm, bank_name: e.target.value })} placeholder="Emirates NBD" />
            <div className="col-span-2">
              <Field label="Notes">
                <textarea value={empForm.notes} onChange={e => setEmpForm({ ...empForm, notes: e.target.value })} rows={3}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white border focus:outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(201,169,110,0.3)' }} />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => { setShowAddEmp(false); setEditEmp(null); setEmpForm(emptyEmp); }}
              className="px-4 py-2 rounded-lg text-sm text-white border" style={{ borderColor: 'rgba(201,169,110,0.3)' }}>Cancel</button>
            <button onClick={saveEmployee}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>{editEmp ? 'Save Changes' : 'Add Employee'}</button>
          </div>
        </Modal>
      )}

      {/* Add Commission Modal */}
      {showAddComm && (
        <Modal title="Add Commission" onClose={() => setShowAddComm(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Employee" value={commForm.employee_id} onChange={e => setCommForm({ ...commForm, employee_id: e.target.value })}>
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Input label="Deal Title" value={commForm.deal_title} onChange={e => setCommForm({ ...commForm, deal_title: e.target.value })} placeholder="Deal name" />
            <Input label="Amount (AED)" type="number" value={commForm.amount} onChange={e => setCommForm({ ...commForm, amount: e.target.value })} placeholder="0.00" />
            <Input label="Percentage (%)" type="number" value={commForm.percentage} onChange={e => setCommForm({ ...commForm, percentage: e.target.value })} placeholder="0" />
            <Input label="Commission Date" type="date" value={commForm.commission_date} onChange={e => setCommForm({ ...commForm, commission_date: e.target.value })} />
            <Field label="Notes">
              <input value={commForm.notes} onChange={e => setCommForm({ ...commForm, notes: e.target.value })} className={inputCls} style={inputStyle} placeholder="Optional notes" />
            </Field>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowAddComm(false)} className="px-4 py-2 rounded-lg text-sm text-white border" style={{ borderColor: 'rgba(201,169,110,0.3)' }}>Cancel</button>
            <button onClick={saveCommission} className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>Add Commission</button>
          </div>
        </Modal>
      )}

      {/* Add Expense Modal */}
      {showAddExp && (
        <Modal title="Add Expense" onClose={() => setShowAddExp(false)}>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })}>
              {['Marketing', 'Office', 'Travel', 'Utilities', 'General', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="Amount (AED)" type="number" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} placeholder="0.00" />
            <div className="col-span-2">
              <Input label="Description *" value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })} placeholder="Describe the expense" />
            </div>
            <Input label="Expense Date" type="date" value={expForm.expense_date} onChange={e => setExpForm({ ...expForm, expense_date: e.target.value })} />
            <Select label="Paid By" value={expForm.paid_by_employee_id} onChange={e => setExpForm({ ...expForm, paid_by_employee_id: e.target.value })}>
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <div className="col-span-2">
              <Field label="Notes">
                <input value={expForm.notes} onChange={e => setExpForm({ ...expForm, notes: e.target.value })} className={inputCls} style={inputStyle} placeholder="Optional notes" />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowAddExp(false)} className="px-4 py-2 rounded-lg text-sm text-white border" style={{ borderColor: 'rgba(201,169,110,0.3)' }}>Cancel</button>
            <button onClick={saveExpense} className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>Add Expense</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
