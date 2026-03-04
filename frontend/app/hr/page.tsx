'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users2, Plus, Edit2, Trash2, ChevronDown, ChevronUp, X, Search,
  DollarSign, TrendingUp, AlertCircle, Calendar, CheckCircle, Clock,
  Building2, CreditCard, FileText, Filter, Upload, Paperclip,
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

interface HRDoc {
  id: number;
  name: string;
  original_name: string;
  category: string;
  entity_name: string;
  drive_view_link: string;
  drive_download_link: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

const HR_DOC_CATEGORIES = [
  'Contract', 'Passport', 'Emirates ID', 'RERA Card', 'Visa',
  'Work Permit', 'Insurance', 'Medical', 'Offer Letter',
  'Warning Letter', 'Performance Review', 'Other',
];

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
          <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
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
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll' | 'commissions' | 'expenses' | 'leave' | 'performance' | 'recruitment' | 'training' | 'documents'>('employees');
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

  // Payroll edit
  const [editPayroll, setEditPayroll] = useState<SalaryPayment | null>(null);
  const [payrollEditForm, setPayrollEditForm] = useState({ bonus: '0', deductions: '0', notes: '' });

  // Commissions
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [showAddComm, setShowAddComm] = useState(false);
  const [commFilter, setCommFilter] = useState('');

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showAddExp, setShowAddExp] = useState(false);
  const [expCatFilter, setExpCatFilter] = useState('');

  // HR Documents state
  const [hrDocs, setHrDocs] = useState<HRDoc[]>([]);
  const [hrDocsLoading, setHrDocsLoading] = useState(false);
  const [selectedHREmployee, setSelectedHREmployee] = useState<Employee | null>(null);
  const [hrDocCategory, setHrDocCategory] = useState('all');
  const [hrDocUploading, setHrDocUploading] = useState(false);
  const [showHrDocUpload, setShowHrDocUpload] = useState(false);
  const [hrUploadCategory, setHrUploadCategory] = useState('Contract');
  const [hrUploadFile, setHrUploadFile] = useState<File | null>(null);
  const [hrDocSearch, setHrDocSearch] = useState('');

  // Summary
  const [summary, setSummary] = useState<any>(null);

  // Leave Management
  const [leaves, setLeaves] = useState<any[]>([]);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ employee_id: '', employee_name: '', leave_type: 'annual', start_date: '', end_date: '', days_requested: '', reason: '' });

  // Expiry Alerts
  const [expiryAlerts, setExpiryAlerts] = useState<any[]>([]);
  const [showExpiryPanel, setShowExpiryPanel] = useState(true);

  // Performance KPIs
  const [kpis, setKpis] = useState<any[]>([]);
  const [kpiMonth, setKpiMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [editKpi, setEditKpi] = useState<any>(null);
  const [kpiForm, setKpiForm] = useState({ employee_id: '', month: new Date().toISOString().slice(0, 7), listings_created: '0', deals_closed: '0', revenue_generated: '0', viewings_conducted: '0', leads_converted: '0', target_revenue: '0', notes: '' });

  // Recruitment
  const [applicants, setApplicants] = useState<any[]>([]);
  const [showAddApplicant, setShowAddApplicant] = useState(false);
  const [appForm, setAppForm] = useState({ full_name: '', email: '', phone: '', role_applied: 'Agent', source: 'LinkedIn', salary_expectation: '' });

  // Training
  const [trainingRecords, setTrainingRecords] = useState<any[]>([]);
  const [showAddTraining, setShowAddTraining] = useState(false);
  const [trainingForm, setTrainingForm] = useState({ employee_id: '', employee_name: '', training_type: 'RERA Exam', course_name: '', provider: '', completion_date: '', expiry_date: '', status: 'pending', score: '' });

  // Employee UAE compliance accordion
  const [showUaeSection, setShowUaeSection] = useState(false);

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

  const loadLeaves = useCallback(async () => {
    if (!token) return;
    const r = await fetch('/api/hr/leaves', { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setLeaves(d.data);
  }, [token, authHeaders]);

  const loadExpiryAlerts = useCallback(async () => {
    if (!token) return;
    const r = await fetch('/api/hr/expiry-alerts', { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setExpiryAlerts(d.data);
  }, [token, authHeaders]);

  const loadKpis = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/hr/kpis?month=${kpiMonth}`, { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setKpis(d.data);
  }, [token, kpiMonth, authHeaders]);

  const loadApplicants = useCallback(async () => {
    if (!token) return;
    const r = await fetch('/api/hr/applicants', { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setApplicants(d.data);
  }, [token, authHeaders]);

  const loadTraining = useCallback(async () => {
    if (!token) return;
    const r = await fetch('/api/hr/training', { headers: authHeaders() });
    const d = await r.json();
    if (d.success) setTrainingRecords(d.data);
  }, [token, authHeaders]);

  useEffect(() => {
    if (!token) return;
    loadEmployees();
    loadCommissions();
    loadExpenses();
    loadSummary();
    loadLeaves();
    loadExpiryAlerts();
    loadApplicants();
    loadTraining();
  }, [token]);

  useEffect(() => { if (token) loadKpis(); }, [token, kpiMonth]);

  useEffect(() => { if (token) loadPayroll(); }, [token, payrollMonth]);

  // ── Employee form ──────────────────────────────────────────────────────────
  const emptyEmp = { name: '', email: '', phone: '', role: 'Agent', department: 'Sales', contract_type: 'full-time', start_date: '', base_salary: '', currency: 'AED', payment_frequency: 'monthly', iban: '', bank_name: '', notes: '' };
  const [empForm, setEmpForm] = useState<any>(emptyEmp);

  // Pending documents to attach when creating/editing an employee
  const [empPendingDocs, setEmpPendingDocs] = useState<Array<{ file: File; category: string }>>([]);
  const [empDocUploading, setEmpDocUploading] = useState(false);
  const empDocFileRef = useRef<HTMLInputElement>(null);

  const EMP_DOC_CATEGORIES = [
    'Contract', 'Passport', 'Emirates ID', 'RERA Card', 'Visa',
    'Work Permit', 'Insurance', 'Medical', 'Offer Letter',
    'Warning Letter', 'Performance Review', 'Other',
  ];

  const openEditEmp = (e: Employee) => { setEditEmp(e); setEmpForm({ ...e, base_salary: String(e.base_salary) }); setEmpPendingDocs([]); };

  const saveEmployee = async () => {
    const body = { ...empForm, base_salary: parseFloat(empForm.base_salary) || 0 };
    const url = editEmp ? `/api/hr/employees/${editEmp.id}` : '/api/hr/employees';
    const method = editEmp ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
    const d = await r.json();
    if (!d.success) { alert(d.message); return; }

    // Upload any pending documents
    if (empPendingDocs.length > 0) {
      setEmpDocUploading(true);
      const employeeId = editEmp ? editEmp.id : d.data?.id;
      const employeeName = empForm.name;
      const tk = localStorage.getItem('token') || '';
      for (const { file, category } of empPendingDocs) {
        try {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('entity_type', 'agent');
          fd.append('entity_id', String(employeeId));
          fd.append('entity_name', employeeName);
          fd.append('category', category);
          const res = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${tk}` },
            body: fd,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn('Doc upload failed:', err.error || res.status);
          }
        } catch (err) {
          console.warn('Doc upload error:', err);
        }
      }
      setEmpDocUploading(false);
    }

    loadEmployees(); loadSummary();
    setShowAddEmp(false); setEditEmp(null); setEmpForm(emptyEmp); setEmpPendingDocs([]);
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

  const deletePayroll = async (id: number) => {
    if (!confirm('Delete this payroll record? This cannot be undone.')) return;
    await fetch(`/api/hr/salary-payments/${id}`, { method: 'DELETE', headers: authHeaders() });
    loadPayroll();
    loadSummary();
  };

  const savePayrollEdit = async () => {
    if (!editPayroll) return;
    const bonus = parseFloat(payrollEditForm.bonus) || 0;
    const deductions = parseFloat(payrollEditForm.deductions) || 0;
    const net_amount = editPayroll.base_amount + bonus - deductions;
    await fetch(`/api/hr/salary-payments/${editPayroll.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ bonus, deductions, net_amount, notes: payrollEditForm.notes }),
    });
    setEditPayroll(null);
    loadPayroll();
    loadSummary();
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

  // ── HR Documents ───────────────────────────────────────────────────────────
  const fetchHrDocs = useCallback(async (employeeId?: number, category?: string) => {
    setHrDocsLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
      const tk = localStorage.getItem('token') || '';
      const params = new URLSearchParams({ entity_type: 'agent' });
      if (employeeId) params.append('entity_id', String(employeeId));
      if (category && category !== 'all') params.append('category', category);
      const res = await fetch(`${API_BASE}/api/documents?${params}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const data = await res.json();
      setHrDocs(data.documents || []);
    } catch {}
    setHrDocsLoading(false);
  }, []);

  const handleHrDocUpload = async () => {
    if (!hrUploadFile || !selectedHREmployee) return;
    setHrDocUploading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
      const tk = localStorage.getItem('token') || '';
      const fd = new FormData();
      fd.append('file', hrUploadFile);
      fd.append('entity_type', 'agent');
      fd.append('entity_id', String(selectedHREmployee.crm_user_id || selectedHREmployee.id));
      fd.append('entity_name', selectedHREmployee.name);
      fd.append('category', hrUploadCategory);
      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert('Upload failed: ' + (err.error || 'Unknown error'));
        setHrDocUploading(false);
        return;
      }
      setHrUploadFile(null);
      setShowHrDocUpload(false);
      fetchHrDocs(selectedHREmployee.crm_user_id || selectedHREmployee.id, hrDocCategory !== 'all' ? hrDocCategory : undefined);
    } catch (err) {
      alert('Upload failed: ' + String(err));
    }
    setHrDocUploading(false);
  };

  const deleteHrDoc = async (docId: number) => {
    if (!confirm('Delete this document?')) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
    const tk = localStorage.getItem('token') || '';
    await fetch(`${API_BASE}/api/documents/${docId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tk}` },
    });
    setHrDocs(prev => prev.filter(d => d.id !== docId));
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
    { id: 'leave', label: 'Leave' },
    { id: 'performance', label: 'Performance' },
    { id: 'recruitment', label: 'Recruitment' },
    { id: 'training', label: 'Training' },
    { id: 'documents', label: 'Documents' },
  ] as const;

  const thCls = "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider";
  const thStyle = { color: 'rgba(201,169,110,0.8)' };
  const tdCls = "px-4 py-3 text-sm text-white";
  const trStyle = { borderColor: 'rgba(201,169,110,0.1)' };

  return (
    <div className="flex-1 min-h-screen p-4 lg:p-6" style={{ background: '#0f1623' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
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
      <div className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto tab-scroll" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
            style={activeTab === t.id
              ? { background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white' }
              : { color: 'rgba(255,255,255,0.55)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── EMPLOYEES TAB ── */}
      {activeTab === 'employees' && (
        <div>
          {/* Expiry Alerts Panel */}
          <div className="mb-4 rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: expiryAlerts.length > 0 ? 'rgba(251,146,60,0.4)' : 'rgba(52,211,153,0.3)' }}>
            <button type="button" onClick={() => setShowExpiryPanel(s => !s)} className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold" style={{ color: expiryAlerts.length > 0 ? '#fb923c' : '#34d399' }}>
              <span>{expiryAlerts.length > 0 ? `⚠️ ${expiryAlerts.length} document(s) expiring in the next 90 days` : '✅ All documents up to date'}</span>
              {showExpiryPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showExpiryPanel && expiryAlerts.length > 0 && (
              <div className="overflow-x-auto">
              <table className="w-full border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <thead><tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Employee', 'Document', 'Expiry Date', 'Days Remaining'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(201,169,110,0.8)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {expiryAlerts.map((a, i) => {
                    const c = a.days_remaining < 30 ? '#f87171' : a.days_remaining < 60 ? '#fb923c' : '#facc15';
                    return (
                      <tr key={i} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <td className="px-4 py-2 text-sm font-medium text-white">{a.employee_name}</td>
                        <td className="px-4 py-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{a.doc_type}</td>
                        <td className="px-4 py-2 text-sm" style={{ color: c }}>{a.expiry_date}</td>
                        <td className="px-4 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: `${c}20`, color: c }}>{a.days_remaining}d</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
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
          <div className="overflow-x-auto">
          <table className="w-full min-w-max">
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
          </div>
        </div>
      )}

      {/* ── PAYROLL TAB ── */}
      {activeTab === 'payroll' && (
        <div>
          {/* Payroll summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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
            <div className="overflow-x-auto">
            <table className="w-full min-w-max">
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
                      <div className="flex items-center gap-1.5">
                        {p.status === 'pending' && (
                          <button onClick={() => markPaid(p)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors">
                            <CheckCircle className="w-3 h-3" /> Pay
                          </button>
                        )}
                        <button onClick={() => { setEditPayroll(p); setPayrollEditForm({ bonus: String(p.bonus || 0), deductions: String(p.deductions || 0), notes: p.notes || '' }); }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}>
                          Edit
                        </button>
                        <button onClick={() => deletePayroll(p.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                          Delete
                        </button>
                      </div>
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

          {/* Gratuity Calculator */}
          <div className="mt-4 rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
              <h3 className="text-sm font-semibold text-white">📊 Gratuity Calculator</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Per UAE Federal Decree Law No. 33 of 2021 — End-of-service entitlements</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead><tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Employee', 'Start Date', 'Years Served', 'Daily Wage (AED)', 'Gratuity Entitlement'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(201,169,110,0.8)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {employees.filter(e => e.status === 'active' && e.start_date).map(emp => {
                    const startDate = new Date(emp.start_date);
                    const years = (Date.now() - startDate.getTime()) / (365.25 * 24 * 3600 * 1000);
                    const annualSalary = (emp.base_salary || 0) * 12;
                    const dailyWage = annualSalary / 365;
                    let gratuity = 0;
                    if (years >= 1 && years <= 5) gratuity = 21 * dailyWage * years;
                    else if (years > 5) gratuity = (21 * 5 * dailyWage) + (30 * dailyWage * (years - 5));
                    gratuity = Math.min(gratuity, annualSalary * 2);
                    return (
                      <tr key={emp.id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <td className="px-4 py-3 text-sm font-medium text-white">{emp.name}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{emp.start_date}</td>
                        <td className="px-4 py-3 text-sm text-white">{years.toFixed(1)}y</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#C9A96E' }}>AED {dailyWage.toFixed(0)}</td>
                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: gratuity > 0 ? '#34d399' : 'rgba(255,255,255,0.4)' }}>
                          {gratuity > 0 ? `AED ${Math.round(gratuity).toLocaleString()}` : 'Not eligible yet'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {/* ── LEAVE TAB ── */}
      {activeTab === 'leave' && (
        <div>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Pending Approvals', value: leaves.filter(l => l.status === 'pending').length, color: '#C9A96E' },
              { label: 'On Leave Today', value: leaves.filter(l => { const t = new Date().toISOString().split('T')[0]; return l.status === 'approved' && l.start_date <= t && l.end_date >= t; }).length, color: '#60a5fa' },
              { label: 'Total Requests', value: leaves.length, color: '#34d399' },
            ].map(c => (
              <div key={c.label} className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{c.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
              <h3 className="text-sm font-semibold text-white">Leave Requests</h3>
              <button onClick={() => setShowAddLeave(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                <Plus className="w-3.5 h-3.5" /> Apply Leave
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead><tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Employee', 'Type', 'Start', 'End', 'Days', 'Status', 'Reason', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(201,169,110,0.8)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {leaves.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No leave requests yet</td></tr>
                  ) : leaves.map(l => (
                    <tr key={l.id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <td className="px-4 py-3 text-sm text-white font-medium">{l.employee_name}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>{l.leave_type}</span></td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{l.start_date}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{l.end_date}</td>
                      <td className="px-4 py-3 text-sm text-white">{l.days_requested}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: l.status === 'approved' ? 'rgba(52,211,153,0.15)' : l.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(201,169,110,0.15)', color: l.status === 'approved' ? '#34d399' : l.status === 'rejected' ? '#f87171' : '#C9A96E' }}>{l.status}</span></td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 150 }}>{l.reason || '—'}</td>
                      <td className="px-4 py-3">
                        {l.status === 'pending' && (
                          <div className="flex gap-1.5">
                            <button onClick={async () => { await fetch(`/api/hr/leaves/${l.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status: 'approved', approved_by: 'Admin' }) }); loadLeaves(); }} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>Approve</button>
                            <button onClick={async () => { await fetch(`/api/hr/leaves/${l.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status: 'rejected', approved_by: 'Admin' }) }); loadLeaves(); }} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              🇦🇪 UAE Labour Law: Annual leave = 30 days/year · Sick leave = 15 days paid, 30 days half-pay, 45 days unpaid
            </div>
          </div>
        </div>
      )}

      {/* ── PERFORMANCE TAB ── */}
      {activeTab === 'performance' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <h3 className="text-white font-semibold">Agent Performance KPIs</h3>
            <div className="flex items-center gap-3">
              <input type="month" value={kpiMonth} onChange={e => setKpiMonth(e.target.value)}
                className="text-sm rounded-lg px-3 py-2 border" style={{ background: '#1a2438', color: '#C9A96E', borderColor: 'rgba(201,169,110,0.3)' }} />
              <button onClick={() => { setEditKpi(null); setKpiForm({ employee_id: '', month: kpiMonth, listings_created: '0', deals_closed: '0', revenue_generated: '0', viewings_conducted: '0', leads_converted: '0', target_revenue: '0', notes: '' }); setShowKpiModal(true); }} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                <Plus className="w-3.5 h-3.5" /> Add KPIs
              </button>
            </div>
          </div>

          {/* Leaderboard */}
          {kpis.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {kpis.slice(0, 3).map((k, i) => (
                <div key={k.id} className="rounded-xl p-4 text-center border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: i === 0 ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.08)' }}>
                  <div className="text-2xl mb-1">{['🥇', '🥈', '🥉'][i]}</div>
                  <p className="font-bold text-white text-sm">{k.employee_name}</p>
                  <p className="text-xs mt-1" style={{ color: '#C9A96E' }}>AED {Number(k.revenue_generated).toLocaleString()}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{k.deals_closed} deals · {k.listings_created} listings</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead><tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Agent', 'Listings', 'Deals', 'Revenue (AED)', 'Viewings', 'Leads', 'Target', '% Achieved', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(201,169,110,0.8)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {kpis.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No KPIs for {kpiMonth} — click Add KPIs to enter data</td></tr>
                  ) : kpis.map(k => {
                    const pct = k.target_revenue > 0 ? Math.min(100, Math.round((k.revenue_generated / k.target_revenue) * 100)) : 0;
                    return (
                      <tr key={k.id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <td className="px-4 py-3 text-sm font-medium text-white">{k.employee_name}</td>
                        <td className="px-4 py-3 text-sm text-white">{k.listings_created}</td>
                        <td className="px-4 py-3 text-sm text-white">{k.deals_closed}</td>
                        <td className="px-4 py-3 text-sm text-white">{Number(k.revenue_generated).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-white">{k.viewings_conducted}</td>
                        <td className="px-4 py-3 text-sm text-white">{k.leads_converted}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{Number(k.target_revenue).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', minWidth: 60 }}>
                              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#34d399' : pct >= 60 ? '#C9A96E' : '#f87171' }} />
                            </div>
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => { setEditKpi(k); setKpiForm({ employee_id: String(k.employee_id), month: k.month, listings_created: String(k.listings_created), deals_closed: String(k.deals_closed), revenue_generated: String(k.revenue_generated), viewings_conducted: String(k.viewings_conducted), leads_converted: String(k.leads_converted), target_revenue: String(k.target_revenue), notes: k.notes || '' }); setShowKpiModal(true); }} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)' }}>Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── RECRUITMENT TAB ── */}
      {activeTab === 'recruitment' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div>
              <h3 className="text-white font-semibold">Recruitment Pipeline</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{applicants.filter(a => a.stage !== 'hired' && a.stage !== 'rejected').length} active applicants</p>
            </div>
            <button onClick={() => setShowAddApplicant(true)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
              <Plus className="w-3.5 h-3.5" /> Add Applicant
            </button>
          </div>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
              {[
                { key: 'applied', label: 'Applied', color: '#6b7280' },
                { key: 'screening', label: 'Screening', color: '#C9A96E' },
                { key: 'interview_1', label: 'Interview 1', color: '#60a5fa' },
                { key: 'interview_2', label: 'Interview 2', color: '#a78bfa' },
                { key: 'offer', label: 'Offer', color: '#f59e0b' },
                { key: 'hired', label: 'Hired ✅', color: '#34d399' },
                { key: 'rejected', label: 'Rejected', color: '#f87171' },
              ].map(stage => {
                const stageApps = applicants.filter(a => a.stage === stage.key);
                const stageOrder = ['applied', 'screening', 'interview_1', 'interview_2', 'offer', 'hired', 'rejected'];
                return (
                  <div key={stage.key} style={{ width: 200, minWidth: 200 }}>
                    <div className="flex items-center justify-between px-3 py-2 rounded-t-lg mb-2" style={{ background: 'rgba(255,255,255,0.05)', borderBottom: `2px solid ${stage.color}` }}>
                      <span className="text-xs font-semibold" style={{ color: stage.color }}>{stage.label}</span>
                      <span className="text-xs rounded-full px-1.5 py-0.5" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>{stageApps.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {stageApps.map(app => {
                        const daysSince = Math.floor((Date.now() - new Date(app.created_at).getTime()) / 86400000);
                        const nextStage = stageOrder[stageOrder.indexOf(stage.key) + 1];
                        return (
                          <div key={app.id} className="rounded-lg p-3" style={{ background: '#1a2438', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <p className="text-sm font-medium text-white truncate">{app.full_name}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{app.role_applied}</p>
                            {app.source && <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E' }}>{app.source}</span>}
                            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{daysSince}d ago</p>
                            <div className="flex gap-1 mt-2">
                              {nextStage && nextStage !== 'rejected' && (
                                <button onClick={async () => { await fetch(`/api/hr/applicants/${app.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ stage: nextStage }) }); loadApplicants(); }} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>→ Next</button>
                              )}
                              {stage.key !== 'rejected' && stage.key !== 'hired' && (
                                <button onClick={async () => { await fetch(`/api/hr/applicants/${app.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ stage: 'rejected' }) }); loadApplicants(); }} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}>✕</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TRAINING TAB ── */}
      {activeTab === 'training' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Records', value: trainingRecords.length },
              { label: 'Expiring in 90 Days', value: trainingRecords.filter(t => { if (!t.expiry_date) return false; const days = Math.ceil((new Date(t.expiry_date).getTime() - Date.now()) / 86400000); return days >= 0 && days <= 90; }).length },
              { label: 'Active RERA Licenses', value: trainingRecords.filter(t => t.training_type === 'RERA Exam' && t.status === 'completed').length },
            ].map(c => (
              <div key={c.label} className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-2xl font-bold text-white">{c.value}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{c.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border overflow-hidden" style={{ background: '#1a2438', borderColor: 'rgba(201,169,110,0.3)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(201,169,110,0.2)' }}>
              <h3 className="text-sm font-semibold text-white">Training &amp; Licensing Records</h3>
              <button onClick={() => setShowAddTraining(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                <Plus className="w-3.5 h-3.5" /> Add Record
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead><tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Employee', 'Type', 'Course', 'Provider', 'Completed', 'Expires', 'Score', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(201,169,110,0.8)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {trainingRecords.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>No training records yet</td></tr>
                  ) : trainingRecords.map(t => {
                    const daysToExpiry = t.expiry_date ? Math.ceil((new Date(t.expiry_date).getTime() - Date.now()) / 86400000) : null;
                    const expiryColor = daysToExpiry !== null ? (daysToExpiry < 30 ? '#f87171' : daysToExpiry < 60 ? '#fb923c' : daysToExpiry < 90 ? '#facc15' : '#34d399') : 'rgba(255,255,255,0.4)';
                    const statusColor = t.status === 'completed' ? '#34d399' : t.status === 'expired' ? '#f87171' : t.status === 'in_progress' ? '#60a5fa' : '#C9A96E';
                    return (
                      <tr key={t.id} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <td className="px-4 py-3 text-sm font-medium text-white">{t.employee_name}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}>{t.training_type}</span></td>
                        <td className="px-4 py-3 text-sm text-white">{t.course_name || '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{t.provider || '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{t.completion_date || '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: expiryColor }}>{t.expiry_date ? `${t.expiry_date}${daysToExpiry !== null && daysToExpiry <= 90 ? ` (${daysToExpiry}d)` : ''}` : '—'}</td>
                        <td className="px-4 py-3 text-sm text-white">{t.score ?? '—'}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${statusColor}20`, color: statusColor }}>{t.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Agent Documents</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '4px 0 0' }}>
                Upload and manage HR files for each agent — contracts, IDs, RERA cards, and more.
              </p>
            </div>
          </div>

          {/* Employee selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
              Select Agent / Employee
            </label>
            <select
              value={selectedHREmployee?.id || ''}
              onChange={e => {
                const emp = employees.find(x => x.id === Number(e.target.value));
                setSelectedHREmployee(emp || null);
                setHrDocCategory('all');
                if (emp) fetchHrDocs(emp.crm_user_id || emp.id);
                else setHrDocs([]);
              }}
              style={{
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                width: '100%',
                maxWidth: 400,
                outline: 'none',
              }}
            >
              <option value="">— Select an agent —</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id} style={{ background: '#1a2438' }}>
                  {emp.name} ({emp.role})
                </option>
              ))}
            </select>
          </div>

          {selectedHREmployee && (
            <>
              {/* Selected employee bar */}
              <div style={{
                background: 'rgba(197,162,101,0.06)',
                border: '1px solid rgba(197,162,101,0.2)',
                borderRadius: 10,
                padding: '12px 18px',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <p style={{ color: '#fff', fontWeight: 600, margin: 0 }}>{selectedHREmployee.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '2px 0 0', textTransform: 'capitalize' }}>
                    {selectedHREmployee.role} · {selectedHREmployee.department || 'Astraterra'}
                  </p>
                </div>
                <button
                  onClick={() => setShowHrDocUpload(f => !f)}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #DEC993 0%, #C5A265 50%, #B59556 100%)',
                    color: '#0D1625',
                    border: 'none',
                    borderRadius: 7,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  + Upload Document
                </button>
              </div>

              {/* Upload form */}
              {showHrDocUpload && (
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: 20,
                  marginBottom: 20,
                }}>
                  <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
                    Upload Document for {selectedHREmployee.name}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>Category</label>
                      <select
                        value={hrUploadCategory}
                        onChange={e => setHrUploadCategory(e.target.value)}
                        style={{
                          width: '100%', padding: '9px 12px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 7, color: '#fff', fontSize: 13, outline: 'none',
                        }}
                      >
                        {HR_DOC_CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#1a2438' }}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>File</label>
                      <input
                        type="file"
                        onChange={e => setHrUploadFile(e.target.files?.[0] || null)}
                        style={{
                          width: '100%', padding: '8px 12px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 7, color: 'rgba(255,255,255,0.6)', fontSize: 13,
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={handleHrDocUpload}
                      disabled={!hrUploadFile || hrDocUploading}
                      style={{
                        padding: '9px 20px',
                        background: hrDocUploading ? 'rgba(197,162,101,0.4)' : 'linear-gradient(135deg, #DEC993 0%, #C5A265 50%, #B59556 100%)',
                        color: '#0D1625', border: 'none', borderRadius: 7,
                        fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      {hrDocUploading ? 'Uploading...' : 'Upload'}
                    </button>
                    <button
                      onClick={() => { setShowHrDocUpload(false); setHrUploadFile(null); }}
                      style={{
                        padding: '9px 20px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.6)', borderRadius: 7,
                        fontWeight: 400, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Category pills */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {['all', ...HR_DOC_CATEGORIES].map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setHrDocCategory(cat);
                      fetchHrDocs(
                        selectedHREmployee.crm_user_id || selectedHREmployee.id,
                        cat !== 'all' ? cat : undefined
                      );
                    }}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                      border: hrDocCategory === cat ? '1px solid #C5A265' : '1px solid rgba(255,255,255,0.1)',
                      background: hrDocCategory === cat ? 'rgba(197,162,101,0.1)' : 'rgba(255,255,255,0.04)',
                      color: hrDocCategory === cat ? '#C5A265' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {cat === 'all' ? 'ALL' : cat}
                  </button>
                ))}
              </div>

              {/* Documents list */}
              {hrDocsLoading ? (
                <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 40 }}>Loading...</p>
              ) : hrDocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: 'rgba(255,255,255,0.3)' }}>
                  <p style={{ fontSize: 14 }}>No documents uploaded for {selectedHREmployee.name} yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {hrDocs.map(doc => (
                    <div key={doc.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8, padding: '12px 16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: 'rgba(197,162,101,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <FileText style={{ width: 18, height: 18, color: '#C5A265' }} />
                        </div>
                        <div>
                          <p style={{ color: '#fff', fontSize: 14, fontWeight: 500, margin: 0 }}>{doc.original_name || doc.name}</p>
                          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '2px 0 0' }}>
                            {doc.category} · {new Date(doc.created_at).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {doc.drive_view_link && (
                          <a href={doc.drive_view_link} target="_blank" rel="noopener noreferrer" style={{
                            padding: '6px 12px', borderRadius: 6, fontSize: 12,
                            background: 'rgba(255,255,255,0.06)', color: '#C5A265',
                            border: '1px solid rgba(197,162,101,0.2)', textDecoration: 'none',
                          }}>Preview</a>
                        )}
                        {doc.drive_download_link && (
                          <a href={doc.drive_download_link} target="_blank" rel="noopener noreferrer" style={{
                            padding: '6px 12px', borderRadius: 6, fontSize: 12,
                            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none',
                          }}>Download</a>
                        )}
                        <button onClick={() => deleteHrDoc(doc.id)} style={{
                          padding: '6px 12px', borderRadius: 6, fontSize: 12,
                          background: 'rgba(239,68,68,0.08)', color: '#f87171',
                          border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                        }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!selectedHREmployee && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.25)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"
                width="52" height="52" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginBottom: 12 }}>
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <p style={{ fontSize: 14 }}>Select an agent above to view their documents</p>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Add/Edit Employee Modal */}
      {(showAddEmp || editEmp) && (
        <Modal title={editEmp ? 'Edit Employee' : 'Add Employee'} onClose={() => { setShowAddEmp(false); setEditEmp(null); setEmpForm(emptyEmp); }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2"><Input label="Full Name *" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} placeholder="e.g. John Smith" /></div>
            <Input label="Email" type="email" value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} placeholder="john@company.com" />
            <Input label="Phone" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} placeholder="+971 50 123 4567" />
            <Select label="Role" value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })}>
              {['Owner', 'Agent', 'Admin', 'Support', 'Finance'].map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Select label="Department" value={empForm.department} onChange={e => setEmpForm({ ...empForm, department: e.target.value })}>
              {['Management', 'Sales', 'Admin', 'Finance', 'Marketing'].map(d => <option key={d} value={d}>{d}</option>)}
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

            {/* ── UAE Documents & Compliance ─────────────────────────── */}
            <div className="col-span-2">
              <button type="button" onClick={() => setShowUaeSection(s => !s)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.25)', color: '#C9A96E' }}>
                <span>🇦🇪 UAE Documents &amp; Compliance</span>
                {showUaeSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showUaeSection && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(201,169,110,0.15)' }}>
                  <Input label="Passport No." value={empForm.passport_no || ''} onChange={e => setEmpForm({ ...empForm, passport_no: e.target.value })} placeholder="e.g. N1234567" />
                  <Input label="Emirates ID" value={empForm.emirates_id || ''} onChange={e => setEmpForm({ ...empForm, emirates_id: e.target.value })} placeholder="784-XXXX-XXXXXXX-X" />
                  <Input label="Visa No." value={empForm.visa_no || ''} onChange={e => setEmpForm({ ...empForm, visa_no: e.target.value })} placeholder="Residence visa number" />
                  <Input label="RERA License No." value={empForm.rera_license_no || ''} onChange={e => setEmpForm({ ...empForm, rera_license_no: e.target.value })} placeholder="RERA agent license" />
                  <Input label="Nationality" value={empForm.nationality || ''} onChange={e => setEmpForm({ ...empForm, nationality: e.target.value })} placeholder="e.g. Lebanese" />
                  <Input label="Date of Birth" type="date" value={empForm.date_of_birth || ''} onChange={e => setEmpForm({ ...empForm, date_of_birth: e.target.value })} />
                  <Input label="Visa Expiry" type="date" value={empForm.visa_expiry || ''} onChange={e => setEmpForm({ ...empForm, visa_expiry: e.target.value })} />
                  <Input label="Emirates ID Expiry" type="date" value={empForm.emirates_id_expiry || ''} onChange={e => setEmpForm({ ...empForm, emirates_id_expiry: e.target.value })} />
                  <Input label="RERA License Expiry" type="date" value={empForm.rera_expiry || ''} onChange={e => setEmpForm({ ...empForm, rera_expiry: e.target.value })} />
                  <Input label="Insurance Expiry" type="date" value={empForm.insurance_expiry || ''} onChange={e => setEmpForm({ ...empForm, insurance_expiry: e.target.value })} />
                  <Input label="Probation End Date" type="date" value={empForm.probation_end_date || ''} onChange={e => setEmpForm({ ...empForm, probation_end_date: e.target.value })} />
                  <Input label="Notice Period (days)" type="number" value={empForm.notice_period_days || '30'} onChange={e => setEmpForm({ ...empForm, notice_period_days: e.target.value })} placeholder="30" />
                  <div className="col-span-2">
                    <Input label="MOL Contract No." value={empForm.mol_contract_no || ''} onChange={e => setEmpForm({ ...empForm, mol_contract_no: e.target.value })} placeholder="Ministry of Labour contract number" />
                  </div>
                </div>
              )}
            </div>

            {/* ── Attach Documents ─────────────────────────────────────── */}
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(201,169,110,0.8)' }}>
                  <Paperclip className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Attach Documents
                </span>
                <button
                  type="button"
                  onClick={() => empDocFileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.3)' }}
                >
                  <Upload className="w-3 h-3" /> Add File
                </button>
                <input
                  ref={empDocFileRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e => {
                    const files = Array.from(e.target.files || []);
                    setEmpPendingDocs(prev => [
                      ...prev,
                      ...files.map(f => ({ file: f, category: 'Contract' })),
                    ]);
                    e.target.value = '';
                  }}
                />
              </div>

              {empPendingDocs.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-center"
                  style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    No documents attached — click "Add File" to upload passport, contract, RERA card, etc.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {empPendingDocs.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg p-2"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <FileText className="w-4 h-4 flex-shrink-0" style={{ color: '#C9A96E' }} />
                      <span className="flex-1 text-xs text-white truncate">{item.file.name}</span>
                      <select
                        value={item.category}
                        onChange={e => setEmpPendingDocs(prev => prev.map((d, i) => i === idx ? { ...d, category: e.target.value } : d))}
                        className="text-xs rounded px-2 py-1 border"
                        style={{ background: '#1a2438', color: '#C9A96E', borderColor: 'rgba(201,169,110,0.3)', maxWidth: 130 }}
                      >
                        {EMP_DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button type="button" onClick={() => setEmpPendingDocs(prev => prev.filter((_, i) => i !== idx))}
                        className="text-white/30 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => { setShowAddEmp(false); setEditEmp(null); setEmpForm(emptyEmp); setEmpPendingDocs([]); }}
              className="px-4 py-2 rounded-lg text-sm text-white border" style={{ borderColor: 'rgba(201,169,110,0.3)' }}>Cancel</button>
            <button onClick={saveEmployee} disabled={empDocUploading}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', opacity: empDocUploading ? 0.7 : 1 }}>
              {empDocUploading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {empDocUploading ? 'Uploading docs…' : (editEmp ? 'Save Changes' : 'Add Employee')}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit Payroll Modal ── */}
      {editPayroll && (
        <Modal title={`Edit Payroll — ${editPayroll.employee_name}`} onClose={() => setEditPayroll(null)}>
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Base Salary</p>
            <p className="text-lg font-bold" style={{ color: '#C9A96E' }}>AED {fmt(editPayroll.base_amount)}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Bonus (AED)" type="number" value={payrollEditForm.bonus} onChange={e => setPayrollEditForm({ ...payrollEditForm, bonus: e.target.value })} placeholder="0" />
            <Input label="Deductions (AED)" type="number" value={payrollEditForm.deductions} onChange={e => setPayrollEditForm({ ...payrollEditForm, deductions: e.target.value })} placeholder="0" />
            <div className="col-span-2">
              <Field label="Notes (e.g. reason for deduction)">
                <input value={payrollEditForm.notes} onChange={e => setPayrollEditForm({ ...payrollEditForm, notes: e.target.value })} className={inputCls} style={inputStyle} placeholder="Deduction reason, late days, etc." />
              </Field>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg flex items-center justify-between" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Net Pay after changes:</span>
            <span className="text-lg font-bold" style={{ color: '#34d399' }}>
              AED {fmt(editPayroll.base_amount + (parseFloat(payrollEditForm.bonus) || 0) - (parseFloat(payrollEditForm.deductions) || 0))}
            </span>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setEditPayroll(null)} className="px-4 py-2 rounded-lg text-sm text-white border" style={{ borderColor: 'rgba(201,169,110,0.3)' }}>Cancel</button>
            <button onClick={savePayrollEdit} className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>Save Changes</button>
          </div>
        </Modal>
      )}

      {/* ── Leave Modal ── */}
      {showAddLeave && (
        <Modal title="Apply Leave" onClose={() => setShowAddLeave(false)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Employee *" value={leaveForm.employee_id} onChange={e => { const emp = employees.find(x => String(x.id) === e.target.value); setLeaveForm({ ...leaveForm, employee_id: e.target.value, employee_name: emp?.name || '' }); }}>
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Select label="Leave Type" value={leaveForm.leave_type} onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>
              {['annual', 'sick', 'unpaid', 'emergency', 'maternity', 'paternity'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </Select>
            <Input label="Start Date *" type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} />
            <Input label="End Date *" type="date" value={leaveForm.end_date} onChange={e => {
              const days = leaveForm.start_date ? Math.ceil((new Date(e.target.value).getTime() - new Date(leaveForm.start_date).getTime()) / 86400000) + 1 : 1;
              setLeaveForm({ ...leaveForm, end_date: e.target.value, days_requested: String(Math.max(1, days)) });
            }} />
            <Input label="Days Requested" type="number" value={leaveForm.days_requested} onChange={e => setLeaveForm({ ...leaveForm, days_requested: e.target.value })} />
            <div className="col-span-2">
              <Field label="Reason">
                <input value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} className={inputCls} style={inputStyle} placeholder="Reason for leave" />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowAddLeave(false)} className="px-4 py-2 rounded-lg text-sm text-white border" style={{ borderColor: 'rgba(201,169,110,0.3)' }}>Cancel</button>
            <button onClick={async () => {
              if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date) { alert('Employee, start and end dates are required'); return; }
              const r = await fetch('/api/hr/leaves', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...leaveForm, days_requested: parseInt(leaveForm.days_requested) || 1 }) });
              const d = await r.json();
              if (d.success) { setShowAddLeave(false); setLeaveForm({ employee_id: '', employee_name: '', leave_type: 'annual', start_date: '', end_date: '', days_requested: '', reason: '' }); loadLeaves(); }
              else alert(d.message);
            }} className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>Submit Request</button>
          </div>
        </Modal>
      )}

      {/* ── KPI Modal ── */}
      {showKpiModal && (
        <Modal title={editKpi ? 'Edit KPIs' : 'Add KPIs'} onClose={() => setShowKpiModal(false)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Employee *" value={kpiForm.employee_id} onChange={e => setKpiForm({ ...kpiForm, employee_id: e.target.value })}>
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Input label="Month" type="month" value={kpiForm.month} onChange={e => setKpiForm({ ...kpiForm, month: e.target.value })} />
            <Input label="Listings Created" type="number" value={kpiForm.listings_created} onChange={e => setKpiForm({ ...kpiForm, listings_created: e.target.value })} />
            <Input label="Deals Closed" type="number" value={kpiForm.deals_closed} onChange={e => setKpiForm({ ...kpiForm, deals_closed: e.target.value })} />
            <Input label="Revenue Generated (AED)" type="number" value={kpiForm.revenue_generated} onChange={e => setKpiForm({ ...kpiForm, revenue_generated: e.target.value })} />
            <Input label="Target Revenue (AED)" type="number" value={kpiForm.target_revenue} onChange={e => setKpiForm({ ...kpiForm, target_revenue: e.target.value })} />
            <Input label="Viewings Conducted" type="number" value={kpiForm.viewings_conducted} onChange={e => setKpiForm({ ...kpiForm, viewings_conducted: e.target.value })} />
            <Input label="Leads Converted" type="number" value={kpiForm.leads_converted} onChange={e => setKpiForm({ ...kpiForm, leads_converted: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowKpiModal(false)} className="px-4 py-2 rounded-lg text-sm text-white border" style={{ borderColor: 'rgba(201,169,110,0.3)' }}>Cancel</button>
            <button onClick={async () => {
              if (!kpiForm.employee_id) { alert('Employee required'); return; }
              const r = await fetch('/api/hr/kpis', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...kpiForm, listings_created: parseInt(kpiForm.listings_created)||0, deals_closed: parseInt(kpiForm.deals_closed)||0, revenue_generated: parseFloat(kpiForm.revenue_generated)||0, viewings_conducted: parseInt(kpiForm.viewings_conducted)||0, leads_converted: parseInt(kpiForm.leads_converted)||0, target_revenue: parseFloat(kpiForm.target_revenue)||0 }) });
              const d = await r.json();
              if (d.success) { setShowKpiModal(false); loadKpis(); }
              else alert(d.message);
            }} className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>Save KPIs</button>
          </div>
        </Modal>
      )}

      {/* ── Applicant Modal ── */}
      {showAddApplicant && (
        <Modal title="Add Applicant" onClose={() => setShowAddApplicant(false)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2"><Input label="Full Name *" value={appForm.full_name} onChange={e => setAppForm({ ...appForm, full_name: e.target.value })} placeholder="Applicant full name" /></div>
            <Input label="Email" value={appForm.email} onChange={e => setAppForm({ ...appForm, email: e.target.value })} placeholder="email@example.com" />
            <Input label="Phone" value={appForm.phone} onChange={e => setAppForm({ ...appForm, phone: e.target.value })} placeholder="+971 XX XXX XXXX" />
            <Select label="Role Applied" value={appForm.role_applied} onChange={e => setAppForm({ ...appForm, role_applied: e.target.value })}>
              {['Agent', 'Senior Agent', 'Team Leader', 'Property Manager', 'Admin', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Select label="Source" value={appForm.source} onChange={e => setAppForm({ ...appForm, source: e.target.value })}>
              {['LinkedIn', 'Referral', 'Website', 'Indeed', 'Walk-in', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <div className="col-span-2"><Input label="Salary Expectation (AED)" type="number" value={appForm.salary_expectation} onChange={e => setAppForm({ ...appForm, salary_expectation: e.target.value })} placeholder="Monthly AED" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowAddApplicant(false)} className="px-4 py-2 rounded-lg text-sm text-white border" style={{ borderColor: 'rgba(201,169,110,0.3)' }}>Cancel</button>
            <button onClick={async () => {
              if (!appForm.full_name) { alert('Full name required'); return; }
              const r = await fetch('/api/hr/applicants', { method: 'POST', headers: authHeaders(), body: JSON.stringify(appForm) });
              const d = await r.json();
              if (d.success) { setShowAddApplicant(false); setAppForm({ full_name: '', email: '', phone: '', role_applied: 'Agent', source: 'LinkedIn', salary_expectation: '' }); loadApplicants(); }
              else alert(d.message);
            }} className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>Add Applicant</button>
          </div>
        </Modal>
      )}

      {/* ── Training Modal ── */}
      {showAddTraining && (
        <Modal title="Add Training Record" onClose={() => setShowAddTraining(false)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Employee *" value={trainingForm.employee_id} onChange={e => { const emp = employees.find(x => String(x.id) === e.target.value); setTrainingForm({ ...trainingForm, employee_id: e.target.value, employee_name: emp?.name || '' }); }}>
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <Select label="Training Type" value={trainingForm.training_type} onChange={e => setTrainingForm({ ...trainingForm, training_type: e.target.value })}>
              {['RERA Exam', 'DLD Training', 'AML Compliance', 'Sales Training', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input label="Course Name" value={trainingForm.course_name} onChange={e => setTrainingForm({ ...trainingForm, course_name: e.target.value })} placeholder="Course or certification name" />
            <Input label="Provider" value={trainingForm.provider} onChange={e => setTrainingForm({ ...trainingForm, provider: e.target.value })} placeholder="e.g. RERA, DLD Academy" />
            <Input label="Completion Date" type="date" value={trainingForm.completion_date} onChange={e => setTrainingForm({ ...trainingForm, completion_date: e.target.value })} />
            <Input label="Expiry Date" type="date" value={trainingForm.expiry_date} onChange={e => setTrainingForm({ ...trainingForm, expiry_date: e.target.value })} />
            <Select label="Status" value={trainingForm.status} onChange={e => setTrainingForm({ ...trainingForm, status: e.target.value })}>
              {['pending', 'in_progress', 'completed', 'expired'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </Select>
            <Input label="Score (%)" type="number" value={trainingForm.score} onChange={e => setTrainingForm({ ...trainingForm, score: e.target.value })} placeholder="Exam score" />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowAddTraining(false)} className="px-4 py-2 rounded-lg text-sm text-white border" style={{ borderColor: 'rgba(201,169,110,0.3)' }}>Cancel</button>
            <button onClick={async () => {
              if (!trainingForm.employee_id || !trainingForm.training_type) { alert('Employee and training type required'); return; }
              const r = await fetch('/api/hr/training', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...trainingForm, score: trainingForm.score ? parseInt(trainingForm.score) : null }) });
              const d = await r.json();
              if (d.success) { setShowAddTraining(false); setTrainingForm({ employee_id: '', employee_name: '', training_type: 'RERA Exam', course_name: '', provider: '', completion_date: '', expiry_date: '', status: 'pending', score: '' }); loadTraining(); }
              else alert(d.message);
            }} className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>Add Record</button>
          </div>
        </Modal>
      )}

      {/* Add Commission Modal */}
      {showAddComm && (
        <Modal title="Add Commission" onClose={() => setShowAddComm(false)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
