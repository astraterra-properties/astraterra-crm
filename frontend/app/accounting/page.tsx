'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calculator, TrendingUp, TrendingDown, DollarSign, BarChart3,
  Download, Filter, ChevronUp, ChevronDown, CheckCircle, XCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SalaryPayment {
  id: number; employee_name: string; pay_month: string;
  base_amount: number; bonus: number; deductions: number; net_amount: number;
  payment_method: string; payment_date: string; status: string;
}

interface Commission {
  id: number; employee_name: string; deal_title: string;
  amount: number; percentage: number; commission_date: string; status: string;
}

interface Expense {
  id: number; category: string; description: string; amount: number;
  currency: string; expense_date: string; paid_by_name: string; status: string;
}

interface AccountingSummary {
  month: string;
  revenue: number;
  salary_costs: { paid: number; pending: number };
  commission_costs: { paid: number; pending: number };
  expenses: number;
  net_pl: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const getCurrentMonth = () => new Date().toISOString().substring(0, 7);

const badge = (status: string) => {
  const map: Record<string, string> = {
    paid: 'bg-green-900/30 text-green-400',
    approved: 'bg-green-900/30 text-green-400',
    pending: 'bg-yellow-900/30 text-yellow-400',
    rejected: 'bg-red-900/30 text-red-400',
  };
  return `px-2 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-700 text-gray-300'}`;
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color, trend }: {
  title: string; value: string; sub?: string; icon: any; color: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="rounded-xl p-5 border" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>{title}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      {sub && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{sub}</p>}
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AccountingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'payroll' | 'commissions' | 'expenses'>('overview');
  const [token, setToken] = useState('');
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());

  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [payrollHistory, setPayrollHistory] = useState<SalaryPayment[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Filters
  const [payrollFilter, setPayrollFilter] = useState({ month: '', employee: '', status: '' });
  const [commFilter, setCommFilter] = useState({ from: '', to: '' });
  const [expCatFilter, setExpCatFilter] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/hr/accounting-summary?month=${currentMonth}`, { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setSummary(d.data);
  }, [token, currentMonth, authHeaders]);

  const loadPayrollHistory = useCallback(async () => {
    if (!token) return;
    let url = '/api/hr/salary-payments?';
    if (payrollFilter.month) url += `month=${payrollFilter.month}&`;
    if (payrollFilter.status) url += `status=${payrollFilter.status}&`;
    const r = await fetch(url, { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setPayrollHistory(d.data);
  }, [token, payrollFilter, authHeaders]);

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

  useEffect(() => {
    if (!token) return;
    loadSummary();
    loadPayrollHistory();
    loadCommissions();
    loadExpenses();
  }, [token]);

  useEffect(() => { if (token) loadSummary(); }, [currentMonth, token]);
  useEffect(() => { if (token) loadPayrollHistory(); }, [payrollFilter, token]);

  const updateExpenseStatus = async (id: number, status: string) => {
    await fetch(`/api/hr/expenses/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status }) });
    loadExpenses();
  };

  // CSV Export
  const exportPayrollCSV = () => {
    const headers = ['Employee', 'Month', 'Base', 'Bonus', 'Deductions', 'Net', 'Method', 'Date Paid', 'Status'];
    const rows = payrollHistory.map(p => [
      p.employee_name, p.pay_month, p.base_amount, p.bonus, p.deductions,
      p.net_amount, p.payment_method, p.payment_date || '', p.status
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `payroll-${currentMonth}.csv`; a.click();
  };

  // Expense category totals
  const expByCat = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  // Commission totals by employee
  const commByEmp = commissions.reduce((acc, c) => {
    const name = c.employee_name || 'Unknown';
    if (!acc[name]) acc[name] = { paid: 0, pending: 0 };
    if (c.status === 'paid') acc[name].paid += c.amount;
    else acc[name].pending += c.amount;
    return acc;
  }, {} as Record<string, { paid: number; pending: number }>);

  const filteredExp = expCatFilter ? expenses.filter(e => e.category === expCatFilter) : expenses;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'payroll', label: 'Payroll History' },
    { id: 'commissions', label: 'Commission Ledger' },
    { id: 'expenses', label: 'Expense Tracker' },
  ] as const;

  const thCls = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider";
  const thStyle = { color: 'rgba(201,169,110,0.8)' };
  const tdCls = "px-4 py-3 text-sm text-white";
  const trStyle = { borderColor: 'rgba(201,169,110,0.1)' };

  const netPositive = (summary?.net_pl || 0) >= 0;

  return (
    <div className="flex-1 min-h-screen p-4 lg:p-6" style={{ background: '#0f1623' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Accounting</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Financial overview, payroll history & P&L</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-400">Month:</label>
          <input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm text-white border focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(201,169,110,0.3)' }} />
        </div>
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

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard title="Monthly Revenue" value={`AED ${fmt(summary?.revenue || 0)}`} sub="From closed deals" icon={TrendingUp} color="bg-green-500/20 text-green-400" trend="up" />
            <KpiCard title="Salary Costs" value={`AED ${fmt((summary?.salary_costs?.paid || 0) + (summary?.salary_costs?.pending || 0))}`} sub={`Paid: AED ${fmt(summary?.salary_costs?.paid || 0)}`} icon={DollarSign} color="bg-blue-500/20 text-blue-400" />
            <KpiCard title="Commission Costs" value={`AED ${fmt((summary?.commission_costs?.paid || 0) + (summary?.commission_costs?.pending || 0))}`} sub={`Paid: AED ${fmt(summary?.commission_costs?.paid || 0)}`} icon={BarChart3} color="bg-yellow-500/20 text-yellow-400" />
            <KpiCard title="Net P&L" value={`${netPositive ? '+' : ''}AED ${fmt(summary?.net_pl || 0)}`} sub="Revenue minus all costs" icon={netPositive ? TrendingUp : TrendingDown} color={netPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} trend={netPositive ? 'up' : 'down'} />
          </div>

          {/* Monthly Summary Table */}
          <div className="rounded-xl border overflow-hidden mb-6" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
              <h3 className="text-base font-semibold text-white">Monthly Summary — {currentMonth}</h3>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full min-w-max">
                <tbody className="divide-y" style={{ borderColor: 'rgba(201,169,110,0.1)' }}>
                  <tr>
                    <td className="py-3 text-sm text-white font-medium">💰 Total Revenue (Closed Deals)</td>
                    <td className="py-3 text-sm text-right font-semibold text-green-400">AED {fmt(summary?.revenue || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Salaries Paid</td>
                    <td className="py-3 text-sm text-right text-red-400">- AED {fmt(summary?.salary_costs?.paid || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Salaries Pending</td>
                    <td className="py-3 text-sm text-right text-yellow-400">~ AED {fmt(summary?.salary_costs?.pending || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Commissions Paid</td>
                    <td className="py-3 text-sm text-right text-red-400">- AED {fmt(summary?.commission_costs?.paid || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Commissions Pending</td>
                    <td className="py-3 text-sm text-right text-yellow-400">~ AED {fmt(summary?.commission_costs?.pending || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Expenses (Approved)</td>
                    <td className="py-3 text-sm text-right text-red-400">- AED {fmt(summary?.expenses || 0)}</td>
                  </tr>
                  <tr className="border-t-2" style={{ borderColor: 'rgba(201,169,110,0.4)' }}>
                    <td className="py-3 text-sm font-bold text-white">Net Position</td>
                    <td className={`py-3 text-sm text-right font-bold text-lg ${netPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {netPositive ? '+' : ''}AED {fmt(summary?.net_pl || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Expense breakdown by category */}
          {Object.keys(expByCat).length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
              <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
                <h3 className="text-base font-semibold text-white">Expense Breakdown by Category</h3>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(expByCat).map(([cat, total]) => (
                  <div key={cat} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <span className="text-sm text-white">{cat}</span>
                    <span className="text-sm font-semibold text-red-400">AED {fmt(total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PAYROLL HISTORY TAB ── */}
      {activeTab === 'payroll' && (
        <div>
          <div className="rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
              <div className="flex items-center gap-3">
                <input type="month" value={payrollFilter.month} onChange={e => setPayrollFilter({ ...payrollFilter, month: e.target.value })}
                  className="px-3 py-1.5 rounded-lg text-sm text-white border focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(201,169,110,0.3)' }} />
                <select value={payrollFilter.status} onChange={e => setPayrollFilter({ ...payrollFilter, status: e.target.value })}
                  className="px-3 py-1.5 rounded-lg text-sm text-white border focus:outline-none"
                  style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
                  <option value="">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <button onClick={exportPayrollCSV}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white border"
                style={{ borderColor: 'rgba(201,169,110,0.4)', color: '#C9A96E' }}>
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={trStyle}>
                    <th className={thCls} style={thStyle}>Employee</th>
                    <th className={thCls} style={thStyle}>Month</th>
                    <th className={thCls} style={thStyle}>Base</th>
                    <th className={thCls} style={thStyle}>Bonus</th>
                    <th className={thCls} style={thStyle}>Deductions</th>
                    <th className={thCls} style={thStyle}>Net</th>
                    <th className={thCls} style={thStyle}>Method</th>
                    <th className={thCls} style={thStyle}>Date Paid</th>
                    <th className={thCls} style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollHistory.map(p => (
                    <tr key={p.id} className="border-b hover:bg-white/5 transition-colors" style={trStyle}>
                      <td className={tdCls}>{p.employee_name}</td>
                      <td className={tdCls}>{p.pay_month}</td>
                      <td className={tdCls}>AED {fmt(p.base_amount)}</td>
                      <td className={tdCls}><span className="text-green-400">+{fmt(p.bonus)}</span></td>
                      <td className={tdCls}><span className="text-red-400">-{fmt(p.deductions)}</span></td>
                      <td className={tdCls}><span className="font-semibold" style={{ color: '#C9A96E' }}>AED {fmt(p.net_amount)}</span></td>
                      <td className={tdCls}><span className="capitalize">{(p.payment_method || '').replace('_', ' ')}</span></td>
                      <td className={tdCls}>{p.payment_date || '—'}</td>
                      <td className={tdCls}><span className={badge(p.status)}>{p.status}</span></td>
                    </tr>
                  ))}
                  {payrollHistory.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No payroll records found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {payrollHistory.length > 0 && (
              <div className="px-5 py-3 border-t flex items-center justify-between text-sm" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>{payrollHistory.length} records</span>
                <span style={{ color: '#C9A96E' }}>Total: AED {fmt(payrollHistory.reduce((s, p) => s + p.net_amount, 0))}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COMMISSION LEDGER TAB ── */}
      {activeTab === 'commissions' && (
        <div>
          {/* Totals by employee */}
          {Object.keys(commByEmp).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {Object.entries(commByEmp).map(([name, totals]) => (
                <div key={name} className="rounded-xl p-4 border" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
                  <p className="text-sm font-semibold text-white mb-2">{name}</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-400">Paid: AED {fmt(totals.paid)}</span>
                    <span className="text-yellow-400">Pending: AED {fmt(totals.pending)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-400">From:</label>
                <input type="date" value={commFilter.from} onChange={e => setCommFilter({ ...commFilter, from: e.target.value })}
                  className="px-3 py-1.5 rounded-lg text-sm text-white border focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(201,169,110,0.3)' }} />
                <label className="text-xs text-gray-400">To:</label>
                <input type="date" value={commFilter.to} onChange={e => setCommFilter({ ...commFilter, to: e.target.value })}
                  className="px-3 py-1.5 rounded-lg text-sm text-white border focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(201,169,110,0.3)' }} />
              </div>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Total: AED {fmt(commissions.reduce((s, c) => s + c.amount, 0))}
              </span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b" style={trStyle}>
                  <th className={thCls} style={thStyle}>Employee</th>
                  <th className={thCls} style={thStyle}>Deal</th>
                  <th className={thCls} style={thStyle}>Amount</th>
                  <th className={thCls} style={thStyle}>%</th>
                  <th className={thCls} style={thStyle}>Date</th>
                  <th className={thCls} style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions
                  .filter(c => {
                    if (commFilter.from && c.commission_date && c.commission_date < commFilter.from) return false;
                    if (commFilter.to && c.commission_date && c.commission_date > commFilter.to) return false;
                    return true;
                  })
                  .map(c => (
                    <tr key={c.id} className="border-b hover:bg-white/5 transition-colors" style={trStyle}>
                      <td className={tdCls}>{c.employee_name || '—'}</td>
                      <td className={tdCls}>{c.deal_title || '—'}</td>
                      <td className={tdCls}><span className="font-semibold" style={{ color: '#C9A96E' }}>AED {fmt(c.amount)}</span></td>
                      <td className={tdCls}>{c.percentage ? `${c.percentage}%` : '—'}</td>
                      <td className={tdCls}>{c.commission_date || '—'}</td>
                      <td className={tdCls}><span className={badge(c.status)}>{c.status}</span></td>
                    </tr>
                  ))}
                {commissions.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No commissions recorded yet</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPENSE TRACKER TAB ── */}
      {activeTab === 'expenses' && (
        <div>
          {/* Category totals */}
          {Object.keys(expByCat).length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
              {Object.entries(expByCat).map(([cat, total]) => (
                <div key={cat} className="rounded-lg p-3 text-center border cursor-pointer"
                  style={{
                    background: expCatFilter === cat ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.04)',
                    borderColor: expCatFilter === cat ? 'rgba(201,169,110,0.6)' : 'rgba(201,169,110,0.2)',
                  }}
                  onClick={() => setExpCatFilter(expCatFilter === cat ? '' : cat)}>
                  <p className="text-xs text-gray-400 mb-1">{cat}</p>
                  <p className="text-sm font-semibold text-red-400">AED {fmt(total)}</p>
                </div>
              ))}
            </div>
          )}

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
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Total: AED {fmt(filteredExp.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-max">
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
                            className="p-1.5 rounded hover:bg-green-900/30 text-gray-400 hover:text-green-400 transition-colors" title="Approve">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => updateExpenseStatus(e.id, 'rejected')}
                            className="p-1.5 rounded hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-colors" title="Reject">
                            <XCircle className="w-4 h-4" />
                          </button>
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
          </div>
        </div>
      )}
    </div>
  );
}
