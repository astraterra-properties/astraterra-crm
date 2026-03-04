'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  KanbanSquare, Phone, DollarSign, ChevronLeft, ChevronRight,
  Edit2, X, Save, Trash2, Paperclip, FileText, Download, Upload,
  File as FileIcon, Image as ImageIcon, Flag,
  Archive, Search, UserCheck, MessageCircle, BookMarked, Users,
} from 'lucide-react';

interface Lead {
  id: number;
  contact_id?: number;
  name?: string;
  contact_name?: string;
  phone?: string;
  contact_phone?: string;
  email?: string;
  contact_email?: string;
  budget?: number;
  budget_min?: number;
  budget_max?: number;
  property_type?: string;
  location_preference?: string;
  source?: string;
  lead_pool?: number;
  source_channel?: string;
  lead_type?: string;
  pipeline_stage?: string;
  priority?: string;
  notes?: string;
  status?: string;
  pending_tasks?: number;
  task_list?: string; // JSON string of [{id,title,due_date,priority}]
}

interface LeadDoc {
  id: number;
  name: string;
  original_name: string;
  category: string;
  drive_view_link: string;
  drive_download_link: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
}

interface PoolContact {
  id: number; name: string; phone: string; email: string; type: string;
  source: string; status: string; lead_pool: number; lead_source_status: string;
  assigned_agent: string; location_preference: string;
  budget_min: number; budget_max: number; property_type: string;
  bedrooms: number; created_at: string;
}

const STAGES = [
  { key: 'new_lead',    label: 'New Lead',     color: '#3B82F6' },
  { key: 'contacted',   label: 'Contacted',    color: '#F59E0B' },
  { key: 'qualified',   label: 'Qualified',    color: '#10B981' },
  { key: 'site_visit',  label: 'Site Visit',   color: '#8B5CF6' },
  { key: 'offer_made',  label: 'Offer Made',   color: '#F97316' },
  { key: 'negotiation', label: 'Negotiation',  color: '#EF4444' },
  { key: 'deal_closed', label: 'Deal Closed',  color: '#065F46' },
  { key: 'lost',        label: 'Lost',         color: '#6B7280' },
];

const LEAD_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  buyer:    { bg: '#EFF6FF', text: '#1D4ED8' },
  seller:   { bg: '#ECFDF5', text: '#065F46' },
  tenant:   { bg: '#F5F3FF', text: '#5B21B6' },
  landlord: { bg: '#FFF7ED', text: '#C2410C' },
  investor: { bg: '#FEFCE8', text: '#854D0E' },
  agent:    { bg: '#F9FAFB', text: '#374151' },
  mistake:  { bg: '#FEF2F2', text: '#991B1B' },
  job_seeker: { bg: '#FFF7ED', text: '#92400E' },
};

const DOC_CATEGORIES = [
  'Passport', 'Emirates ID', 'Visa', 'Title Deed', 'SPA',
  'Tenancy Contract', 'NOC', 'RERA Form', 'Bank Statement',
  'Salary Certificate', 'POA', 'Offer Letter', 'Other',
];

const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

function whatsappUrl(phone: string): string {
  // Strip everything except digits, then build wa.me link
  const digits = phone.replace(/\D/g, '');
  // If starts with 0, replace with country code 971 (UAE default)
  const normalized = digits.startsWith('0') ? '971' + digits.slice(1) : digits;
  return `https://wa.me/${normalized}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string) {
  if (mime?.startsWith('image/')) return <ImageIcon className="w-4 h-4" style={{ color: '#3B82F6' }} />;
  if (mime === 'application/pdf') return <FileText className="w-4 h-4" style={{ color: '#EF4444' }} />;
  return <FileIcon className="w-4 h-4" style={{ color: '#6B7280' }} />;
}

export default function PipelinePage() {
  const router = useRouter();
  const [kanban, setKanban] = useState<Record<string, Lead[]>>({});
  const [loading, setLoading] = useState(true);
  const [movingLead, setMovingLead] = useState<number | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showMistakes, setShowMistakes] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Document tab state
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details');
  const [leadDocs, setLeadDocs] = useState<LeadDoc[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState('');
  const [docCategory, setDocCategory] = useState('Passport');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lead Pool tab state
  const [viewMode, setViewMode] = useState<'kanban' | 'pool'>('kanban');
  const [poolContacts, setPoolContacts] = useState<PoolContact[]>([]);
  const [poolStats, setPoolStats] = useState<any>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolSearch, setPoolSearch] = useState('');
  const [poolFilter, setPoolFilter] = useState('all');
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<PoolContact | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignAgentName, setAssignAgentName] = useState('');
  const [agentList, setAgentList] = useState<{id: number; name: string; role: string}[]>([]);
  const [poolCount, setPoolCount] = useState(0);

  const fetchPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = '/api/contacts?pool=true&limit=200';
      if (poolFilter !== 'all') url += `&status=${poolFilter}`;
      const [poolRes, statsRes] = await Promise.all([
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/lead-pool/stats', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (poolRes.ok) {
        const data = await poolRes.json();
        setPoolContacts(data.contacts || []);
        setPoolCount(data.contacts?.length || 0);
      }
      if (statsRes.ok) setPoolStats(await statsRes.json());
    } catch {}
    setPoolLoading(false);
  }, [poolFilter]);

  const fetchAgentList = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAgentList((data.data?.rows || data.users || []).filter((u: any) => u.active !== 0));
      }
    } catch {}
  }, []);

  const claimToPipeline = async (contactId: number) => {
    setClaimingId(contactId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/contacts/${contactId}/convert-to-lead`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        await fetchPool();
        await fetchKanban();
        setViewMode('kanban'); // switch to pipeline after claiming
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to claim lead');
      }
    } catch { alert('Failed to claim lead'); }
    setClaimingId(null);
  };

  const handlePoolAssign = async () => {
    if (!assignTarget || !assignAgentName.trim()) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/contacts/${assignTarget.id}/assign`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_name: assignAgentName }),
    });
    setShowAssignModal(false);
    setAssignTarget(null);
    setAssignAgentName('');
    fetchPool();
  };

  const fetchKanban = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    try {
      const res = await fetch('/api/leads?view=kanban', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setKanban(data.kanban || {});
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    const role = localStorage.getItem('userRole') || 'agent';
    const levels: Record<string, number> = { owner: 4, admin: 3, finance: 2, agent: 1 };
    setCanDelete((levels[role] ?? 0) >= (levels['admin'] ?? 99));
    fetchKanban();
    fetchPool();
    fetchAgentList();
  }, [fetchKanban, fetchPool, fetchAgentList]);

  // Re-fetch pool when filter changes
  useEffect(() => {
    if (viewMode === 'pool') fetchPool();
  }, [poolFilter, viewMode, fetchPool]);

  const fetchLeadDocs = useCallback(async (leadId: number) => {
    setDocLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${leadId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeadDocs(data.documents || []);
      }
    } catch (e) { console.error(e); }
    finally { setDocLoading(false); }
  }, []);

  const handleDocUpload = async (file: File) => {
    if (!editLead?.id || !file) return;
    setDocUploading(true);
    setDocError('');
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', docCategory);
      const res = await fetch(`/api/leads/${editLead.id}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        setLeadDocs(prev => [data.document, ...prev]);
      } else {
        setDocError(data.error || 'Upload failed');
      }
    } catch (e: unknown) {
      setDocError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setDocUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDocDelete = async (docId: number) => {
    if (!confirm('Delete this document?')) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/leads/${editLead!.id}/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLeadDocs(prev => prev.filter(d => d.id !== docId));
      }
    } catch (e) { console.error(e); }
  };

  const moveToStage = async (leadId: number, newStage: string) => {
    setMovingLead(leadId);
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage: newStage }),
      });
      // Auto-move to Lead Pool when stage reaches Lost
      if (newStage === 'lost') {
        const allLeads = Object.values(kanban).flat();
        const lead = allLeads.find(l => l.id === leadId);
        if (lead?.contact_id) {
          await fetch(`/api/contacts/${lead.contact_id}/pool`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ in_pool: true }),
          });
        }
      }
      await fetchKanban();
    } catch (e) { console.error(e); }
    finally { setMovingLead(null); }
  };

  const markAsMistake = async (leadId: number, currentType: string) => {
    const newType = currentType === 'mistake' ? 'buyer' : 'mistake';
    const label = newType === 'mistake' ? 'Mark as mistake?' : 'Restore this lead?';
    if (!confirm(label)) return;
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_type: newType }),
      });
      await fetchKanban();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (leadId: number) => {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setEditLead(null);
      await fetchKanban();
    } catch (e) { console.error(e); }
  };

  const toggleLeadPool = async (lead: Lead, addToPool: boolean) => {
    const token = localStorage.getItem('token');
    const contactId = lead.contact_id;
    if (!contactId) return;
    try {
      await fetch(`/api/contacts/${contactId}/pool`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ in_pool: addToPool }),
      });
      setEditLead(prev => prev ? { ...prev, lead_pool: addToPool ? 1 : 0 } : prev);
      await fetchKanban();
    } catch (e) { console.error(e); }
  };

  const openEdit = (lead: Lead) => {
    setEditLead({
      ...lead,
      name: lead.name || lead.contact_name || '',
      phone: lead.phone || lead.contact_phone || '',
      email: lead.email || lead.contact_email || '',
      budget_min: lead.budget_min || lead.budget || undefined,
    });
    setActiveTab('details');
    setLeadDocs([]);
    setDocError('');
    fetchLeadDocs(lead.id);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLead?.id) return;
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/leads/${editLead.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editLead),
      });
      if (res.ok) {
        setEditLead(null);
        await fetchKanban();
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleSaveAndAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLead?.id) return;
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const currentStageIndex = STAGES.findIndex(s => s.key === (editLead.pipeline_stage || 'new_lead'));
      const nextStage = currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1].key : editLead.pipeline_stage;
      const res = await fetch(`/api/leads/${editLead.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editLead, pipeline_stage: nextStage }),
      });
      if (res.ok) {
        setEditLead(null);
        await fetchKanban();
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const getLeadName = (lead: Lead) => lead.name || lead.contact_name || 'Unknown';
  const getLeadPhone = (lead: Lead) => lead.phone || lead.contact_phone || '';
  const getBudget = (lead: Lead) => lead.budget_min || lead.budget;

  const getTotalBudget = (leads: Lead[]) => {
    const total = leads.reduce((sum, l) => sum + (getBudget(l) || 0), 0);
    return total > 0 ? `AED ${(total / 1000000).toFixed(1)}M` : '';
  };

  const currentStageIndex = STAGES.findIndex(s => s.key === (editLead?.pipeline_stage || 'new_lead'));
  const canAdvance = currentStageIndex < STAGES.length - 1;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F6F9' }}>
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tab switcher */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#E5E7EB' }}>
            <button
              onClick={() => setViewMode('kanban')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all"
              style={viewMode === 'kanban'
                ? { background: '#131B2B', color: 'white' }
                : { background: 'white', color: '#6B7280' }}
            >
              <KanbanSquare className="w-4 h-4" />
              Pipeline
              <span className="text-xs px-1.5 py-0.5 rounded-full ml-0.5"
                style={viewMode === 'kanban' ? { background: 'rgba(255,255,255,0.2)', color: 'white' } : { background: '#F3F4F6', color: '#6B7280' }}>
                {Object.values(kanban).reduce((sum, leads) => sum + leads.filter(l => l.lead_type !== 'mistake' && l.lead_type !== 'job_seeker').length, 0)}
              </span>
            </button>
            <button
              onClick={() => { setViewMode('pool'); fetchPool(); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all border-l"
              style={{
                borderColor: '#E5E7EB',
                ...(viewMode === 'pool'
                  ? { background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: 'white' }
                  : { background: 'white', color: '#6B7280' })
              }}
            >
              <Archive className="w-4 h-4" />
              Lead Pool
              {poolStats?.total ? (
                <span className="text-xs px-1.5 py-0.5 rounded-full ml-0.5"
                  style={viewMode === 'pool' ? { background: 'rgba(255,255,255,0.2)', color: 'white' } : { background: '#F5F3FF', color: '#7C3AED' }}>
                  {poolStats.total.toLocaleString()}
                </span>
              ) : null}
            </button>
          </div>

          {/* Title when in pool mode */}
          {viewMode === 'pool' && (
            <div>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Claim contacts → move them directly into your pipeline</p>
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Type legend pills — Mistakes is a clickable filter, others are static labels */}
            {Object.entries(LEAD_TYPE_COLORS).filter(([t]) => t !== 'job_seeker').map(([type, colors]) => {
              const isMistake = type === 'mistake';
              const isActive = isMistake && showMistakes;
              if (isMistake) {
                return (
                  <button
                    key={type}
                    onClick={() => setShowMistakes(v => !v)}
                    className="px-2.5 py-1 text-xs font-medium rounded-full capitalize transition-all border cursor-pointer hover:opacity-80"
                    style={isActive
                      ? { background: '#DC2626', color: '#fff', borderColor: '#DC2626' }
                      : { background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }}
                  >
                    Mistakes
                  </button>
                );
              }
              return (
                <span key={type} className="px-2.5 py-1 text-xs font-medium rounded-full capitalize"
                  style={{ background: colors.bg, color: colors.text }}>
                  {type}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── LEAD POOL VIEW ── */}
      {viewMode === 'pool' && (
        <div className="px-6 py-5">
          {/* Stats */}
          {poolStats && (
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Total Pool', value: poolStats.total?.toLocaleString(), color: '#7C3AED', bg: '#F5F3FF' },
                { label: 'Assigned', value: poolStats.assigned?.toLocaleString(), color: '#065F46', bg: '#ECFDF5' },
                { label: 'Unassigned', value: poolStats.unassigned?.toLocaleString(), color: '#DC2626', bg: '#FEF2F2' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: '#E5E7EB' }}>
                  <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-sm font-medium" style={{ color: '#6B7280' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Search + Filter */}
          <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3" style={{ borderColor: '#E5E7EB' }}>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
              <input type="text" placeholder="Search by name, phone, email..."
                value={poolSearch} onChange={e => setPoolSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none"
                style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }} />
            </div>
            <select value={poolFilter} onChange={e => setPoolFilter(e.target.value)}
              className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
              style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>
              <option value="all">All Statuses</option>
              <option value="inactive">Inactive</option>
              <option value="UNDEAL">Undeal</option>
              <option value="DEAL">Deal (Closed)</option>
              <option value="INVALID">Invalid</option>
            </select>
          </div>

          {/* Table */}
          {poolLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr style={{ background: '#131B2B' }}>
                      {['Contact', 'Phone', 'Type', 'Source Status', 'Location / Budget', 'Assigned Agent', 'Created', 'Actions'].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {poolContacts
                      .filter(c =>
                        c.name?.toLowerCase().includes(poolSearch.toLowerCase()) ||
                        (c.phone || '').includes(poolSearch) ||
                        (c.email || '').toLowerCase().includes(poolSearch.toLowerCase())
                      )
                      .map((contact, index) => (
                        <tr key={contact.id}
                          style={{ background: index % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#F5F3FF'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = index % 2 === 0 ? 'white' : '#FAFBFC'; }}>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{contact.name}</p>
                            <p className="text-xs" style={{ color: '#9CA3AF' }}>#{contact.id}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm" style={{ color: '#374151' }}>{contact.phone || '—'}</span>
                              {contact.phone && (
                                <a href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle className="w-3.5 h-3.5" style={{ color: '#25D366' }} />
                                </a>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: '#9CA3AF' }}>{contact.email}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full capitalize"
                              style={{ background: contact.type === 'tenant' ? '#FFFBEB' : '#EFF6FF', color: contact.type === 'tenant' ? '#92400E' : '#1D4ED8' }}>
                              {contact.type}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                              {contact.lead_source_status || contact.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm" style={{ color: '#374151' }}>{contact.location_preference || '—'}</p>
                            {contact.budget_min ? (
                              <p className="text-xs font-medium" style={{ color: '#8A6F2F' }}>AED {contact.budget_min.toLocaleString()}</p>
                            ) : null}
                          </td>
                          <td className="px-5 py-3.5">
                            {contact.assigned_agent ? (
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5" style={{ color: '#065F46' }} />
                                <span className="text-sm font-medium" style={{ color: '#065F46' }}>{contact.assigned_agent}</span>
                              </div>
                            ) : (
                              <span className="text-xs" style={{ color: '#9CA3AF' }}>Unassigned</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs" style={{ color: '#9CA3AF' }}>
                            {new Date(contact.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setAssignTarget(contact); setAssignAgentName(contact.assigned_agent || ''); setShowAssignModal(true); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all"
                                style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)' }}>
                                <UserCheck className="w-3 h-3" /> Assign
                              </button>
                              <button
                                onClick={() => claimToPipeline(contact.id)}
                                disabled={claimingId === contact.id}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all"
                                style={{ background: 'linear-gradient(135deg,#C9A96E,#8A6F2F)', color: 'white', opacity: claimingId === contact.id ? 0.6 : 1 }}>
                                <BookMarked className="w-3 h-3" />
                                {claimingId === contact.id ? 'Claiming…' : 'Claim → Pipeline'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {poolContacts.filter(c =>
                  c.name?.toLowerCase().includes(poolSearch.toLowerCase()) ||
                  (c.phone || '').includes(poolSearch) ||
                  (c.email || '').toLowerCase().includes(poolSearch.toLowerCase())
                ).length === 0 && !poolLoading && (
                  <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
                    <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Lead Pool is empty</p>
                    <p className="text-xs mt-1">Contacts that are in the pool will appear here</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assign Modal */}
          {showAssignModal && assignTarget && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                <h2 className="text-lg font-bold mb-1" style={{ color: '#131B2B' }}>Assign Lead</h2>
                <p className="text-sm mb-4" style={{ color: '#6B7280' }}>{assignTarget.name}</p>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Select Agent</label>
                <select value={assignAgentName} onChange={e => setAssignAgentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none mb-4"
                  style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>
                  <option value="">— Unassigned —</option>
                  {agentList.map(a => (
                    <option key={a.id} value={a.name}>{a.name} ({a.role})</option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <button onClick={handlePoolAssign}
                    className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg"
                    style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)' }}>Assign</button>
                  <button onClick={() => { setShowAssignModal(false); setAssignTarget(null); }}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                    style={{ background: '#F3F4F6', color: '#374151' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kanban Board */}
      <div className="overflow-x-auto px-6 py-5" style={{ display: viewMode === 'kanban' ? 'block' : 'none' }}>
        <div className="flex gap-4" style={{ minWidth: STAGES.length * 280 + 'px' }}>
          {STAGES.map((stage) => {
            const allLeads: Lead[] = kanban[stage.key] || [];
            const leads = showMistakes
              ? allLeads
              : allLeads.filter(l => l.lead_type !== 'mistake' && l.lead_type !== 'job_seeker');
            return (
              <div key={stage.key} className="flex-shrink-0 w-68 rounded-xl overflow-hidden"
                style={{ width: '272px', background: '#F9FAFB', border: '1px solid #E5E7EB', outline: dragOverStage === stage.key && draggedLeadId ? `2px dashed ${stage.color}` : 'none', outlineOffset: '-2px', transition: 'outline 0.1s' }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(stage.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = parseInt(e.dataTransfer.getData('text/plain'));
                  if (!id) return;
                  const alreadyHere = (kanban[stage.key] || []).some((l: any) => l.id === id);
                  if (!alreadyHere) moveToStage(id, stage.key);
                  setDragOverStage(null);
                }}>
                {/* Stage Header */}
                <div className="px-4 py-3" style={{ background: stage.color + '12', borderBottom: `2px solid ${stage.color}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: stage.color }}>{stage.label}</p>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: stage.color }}>
                      {leads.length}
                    </div>
                  </div>
                  {getTotalBudget(leads) ? (
                    <p className="text-sm font-bold" style={{ color: stage.color }}>{getTotalBudget(leads)}</p>
                  ) : (
                    <p className="text-xs" style={{ color: '#C9C9C9' }}>—</p>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
                </div>

                {/* Leads */}
                <div className="p-3 space-y-2 max-h-[72vh] overflow-y-auto">
                  {leads.map((lead) => {
                    const stageIndex = STAGES.findIndex(s => s.key === stage.key);
                    const isMoving = movingLead === lead.id;
                    const budget = getBudget(lead);
                    const typeColors = LEAD_TYPE_COLORS[lead.lead_type || 'buyer'];

                    return (
                      <div key={lead.id} className="bg-white rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md"
                        draggable
                        onDragStart={(e) => {
                          setDraggedLeadId(lead.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(lead.id));
                        }}
                        onDragEnd={() => { setDraggedLeadId(null); setDragOverStage(null); }}
                        style={{ border: '1px solid #F3F4F6', opacity: draggedLeadId === lead.id ? 0.45 : 1, cursor: 'grab', transition: 'opacity 0.15s' }}>
                        {/* Lead Header */}
                        <div className="px-4 pt-3 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: '#131B2B' }}>
                                {getLeadName(lead)}
                              </p>
                              {getLeadPhone(lead) && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <a href={`tel:${getLeadPhone(lead)}`}
                                    className="flex items-center gap-1 text-xs hover:underline"
                                    style={{ color: '#6B7280' }}>
                                    <Phone className="w-3 h-3" />
                                    {getLeadPhone(lead)}
                                  </a>
                                  <a
                                    href={whatsappUrl(getLeadPhone(lead))}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`WhatsApp ${getLeadName(lead)}`}
                                    onClick={e => e.stopPropagation()}
                                    className="flex items-center justify-center rounded-full transition-all hover:scale-110 flex-shrink-0"
                                    style={{ background: '#25D366', width: '18px', height: '18px' }}
                                  >
                                    <svg viewBox="0 0 24 24" style={{ width: '10px', height: '10px' }} fill="white">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {/* Mark as mistake / restore */}
                              <button
                                onClick={() => markAsMistake(lead.id, lead.lead_type || '')}
                                className="p-1.5 rounded-lg transition-all hover:scale-110"
                                style={
                                  lead.lead_type === 'mistake' || lead.lead_type === 'job_seeker'
                                    ? { background: '#FEF2F2', color: '#DC2626' }
                                    : { background: '#F9FAFB', color: '#9CA3AF' }
                                }
                                title={lead.lead_type === 'mistake' || lead.lead_type === 'job_seeker' ? 'Restore lead' : 'Mark as mistake'}
                              >
                                <Flag className="w-3 h-3" />
                              </button>
                              {/* Edit */}
                              <button
                                onClick={() => openEdit(lead)}
                                className="p-1.5 rounded-lg transition-all hover:scale-110"
                                style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E' }}
                                title="Edit lead"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Type + Priority badges */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                              style={{ background: typeColors.bg, color: typeColors.text }}>
                              {lead.lead_type || 'buyer'}
                            </span>
                            {lead.priority === 'high' || lead.priority === 'urgent' ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ background: lead.priority === 'urgent' ? '#FEF2F2' : '#FFF7ED', color: lead.priority === 'urgent' ? '#DC2626' : '#C2410C' }}>
                                {lead.priority === 'urgent' ? '🔥 Urgent' : '⚡ High'}
                              </span>
                            ) : null}
                          </div>

                          {/* Tasks List */}
                          {lead.pending_tasks && lead.pending_tasks > 0 ? (() => {
                            let tasks: Array<{id:number,title:string,due_date:string,priority:string}> = [];
                            try { tasks = JSON.parse(lead.task_list || '[]'); } catch {}
                            const priorityDot: Record<string,string> = { high:'#DC2626', medium:'#F59E0B', low:'#9CA3AF' };
                            return (
                              <div style={{ marginTop: '6px', borderTop: '1px solid #FEE2E2', paddingTop: '5px' }}>
                                {tasks.map(t => (
                                  <div key={t.id} className="flex items-start gap-1.5 mb-1">
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: priorityDot[t.priority] || '#9CA3AF', flexShrink: 0, marginTop: '3px', display: 'inline-block' }} />
                                    <div className="min-w-0">
                                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#374151', lineHeight: '1.3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'160px' }}>{t.title}</p>
                                      {t.due_date && <p style={{ fontSize: '9px', color: '#9CA3AF' }}>Due {new Date(t.due_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</p>}
                                    </div>
                                  </div>
                                ))}
                                {lead.pending_tasks > 3 && <p style={{ fontSize: '9px', color: '#DC2626', fontWeight: 700 }}>+{lead.pending_tasks - 3} more task{lead.pending_tasks - 3 !== 1 ? 's' : ''}</p>}
                              </div>
                            );
                          })() : null}

                          {/* Budget */}
                          {budget && budget > 0 && (
                            <p className="text-xs font-medium mt-1.5 flex items-center gap-1" style={{ color: '#C9A96E' }}>
                              <DollarSign className="w-3 h-3" />
                              AED {budget.toLocaleString()}
                            </p>
                          )}

                          {/* Source */}
                          {(lead.source || lead.source_channel) && (
                            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                              via {lead.source_channel || lead.source}
                            </p>
                          )}
                        </div>

                        {/* Move buttons */}
                        <div className="flex gap-1 px-4 py-2 border-t" style={{ borderColor: '#F3F4F6' }}>
                          {stageIndex > 0 && (
                            <button
                              onClick={() => moveToStage(lead.id, STAGES[stageIndex - 1].key)}
                              disabled={isMoving}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg transition-all"
                              style={{ background: '#F3F4F6', color: '#374151' }}
                            >
                              <ChevronLeft className="w-3 h-3" />
                              Back
                            </button>
                          )}
                          {stageIndex < STAGES.length - 1 && (
                            <button
                              onClick={() => moveToStage(lead.id, STAGES[stageIndex + 1].key)}
                              disabled={isMoving}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg font-medium transition-all"
                              style={{ background: stage.color + '15', color: stage.color }}
                            >
                              Advance
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {leads.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed p-6 text-center"
                      style={{ borderColor: stage.color + '30', color: '#9CA3AF' }}>
                      <p className="text-xs">No leads</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Edit Lead Modal ─── */}
      {editLead && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  <Edit2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>Edit Lead</h2>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>
                    Currently in: <span className="font-semibold" style={{ color: STAGES.find(s => s.key === editLead.pipeline_stage)?.color || '#3B82F6' }}>
                      {STAGES.find(s => s.key === editLead.pipeline_stage)?.label || 'New Lead'}
                    </span>
                    {canAdvance && (
                      <span style={{ color: '#9CA3AF' }}>
                        {' '}→ next: <span className="font-semibold" style={{ color: STAGES[currentStageIndex + 1]?.color }}>
                          {STAGES[currentStageIndex + 1]?.label}
                        </span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={() => setEditLead(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" style={{ color: '#6B7280' }} />
              </button>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b px-6" style={{ borderColor: '#E5E7EB' }}>
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className="px-4 py-3 text-sm font-semibold border-b-2 transition-all"
                style={{
                  borderColor: activeTab === 'details' ? '#C9A96E' : 'transparent',
                  color: activeTab === 'details' ? '#C9A96E' : '#6B7280',
                }}
              >
                📋 Lead Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className="px-4 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2"
                style={{
                  borderColor: activeTab === 'documents' ? '#C9A96E' : 'transparent',
                  color: activeTab === 'documents' ? '#C9A96E' : '#6B7280',
                }}
              >
                <Paperclip className="w-4 h-4" />
                Documents
                {leadDocs.length > 0 && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full font-bold text-white"
                    style={{ background: '#C9A96E' }}>
                    {leadDocs.length}
                  </span>
                )}
              </button>
            </div>

            {/* ── DETAILS TAB ── */}
            {activeTab === 'details' && (
              <form onSubmit={handleSave} className="p-6">
                {/* Contact Info */}
                <div className="mb-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Contact Info</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Full Name *</label>
                      <input type="text" required value={editLead.name || ''}
                        onChange={e => setEditLead({ ...editLead, name: e.target.value })}
                        className={inputCls} style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                        onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Phone *</label>
                      <input type="text" required value={editLead.phone || ''}
                        onChange={e => setEditLead({ ...editLead, phone: e.target.value })}
                        className={inputCls} style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                        onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Email</label>
                      <input type="email" value={editLead.email || ''}
                        onChange={e => setEditLead({ ...editLead, email: e.target.value })}
                        className={inputCls} style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                        onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>
                </div>

                {/* Lead Classification */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>Lead Classification</h3>
                    {/* Lead Pool Toggle */}
                    <button
                      type="button"
                      onClick={() => editLead && toggleLeadPool(editLead, !editLead.lead_pool)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                      style={editLead?.lead_pool
                        ? { background: 'rgba(124,58,237,0.15)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.4)' }
                        : { background: '#F5F3FF', color: '#9CA3AF', border: '1px solid #DDD6FE' }
                      }
                    >
                      {editLead?.lead_pool ? '🟣 In Lead Pool — Click to Remove' : '○ Add to Lead Pool'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Lead Type</label>
                      <select value={editLead.lead_type || 'buyer'}
                        onChange={e => setEditLead({ ...editLead, lead_type: e.target.value })}
                        className={inputCls} style={inputStyle}>
                        {[
                          { v: 'buyer',      l: 'Buyer' },
                          { v: 'seller',     l: 'Seller' },
                          { v: 'tenant',     l: 'Tenant' },
                          { v: 'landlord',   l: 'Landlord' },
                          { v: 'investor',   l: 'Investor' },
                          { v: 'agent',      l: 'Agent / Broker' },
                          { v: 'job_seeker', l: 'Job Seeker' },
                          { v: 'mistake',    l: 'Mistake / Wrong Number' },
                        ].map(o => (
                          <option key={o.v} value={o.v}>{o.l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Priority</label>
                      <select value={editLead.priority || 'medium'}
                        onChange={e => setEditLead({ ...editLead, priority: e.target.value })}
                        className={inputCls} style={inputStyle}>
                        {['low','medium','high','urgent'].map(o => (
                          <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Status</label>
                      <select value={editLead.status || 'new'}
                        onChange={e => setEditLead({ ...editLead, status: e.target.value })}
                        className={inputCls} style={inputStyle}>
                        {['new','contacted','qualified','hot','viewing_scheduled','unqualified','converted','deal_won','deal_lost'].map(o => (
                          <option key={o} value={o}>{o.replace(/_/g,' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Pipeline Stage</label>
                      <select value={editLead.pipeline_stage || 'new_lead'}
                        onChange={e => setEditLead({ ...editLead, pipeline_stage: e.target.value })}
                        className={inputCls} style={inputStyle}>
                        {STAGES.map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Property Type</label>
                      <select value={editLead.property_type || ''}
                        onChange={e => setEditLead({ ...editLead, property_type: e.target.value })}
                        className={inputCls} style={inputStyle}>
                        <option value="">Select...</option>
                        {['apartment','villa','townhouse','penthouse','commercial','office','retail','studio'].map(o => (
                          <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Source</label>
                      <select value={editLead.source_channel || editLead.source || ''}
                        onChange={e => setEditLead({ ...editLead, source_channel: e.target.value, source: e.target.value })}
                        className={inputCls} style={inputStyle}>
                        <option value="">Select...</option>
                        {['website','referral','social_media','walk_in','phone_call','bayut','property_finder','dubizzle','whatsapp'].map(o => (
                          <option key={o} value={o}>{o.replace(/_/g,' ')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                <div className="mb-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Requirements</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Location Preference</label>
                      <input type="text" value={editLead.location_preference || ''}
                        onChange={e => setEditLead({ ...editLead, location_preference: e.target.value })}
                        placeholder="e.g. Dubai Marina, Downtown, JVC"
                        className={inputCls} style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                        onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Budget Min (AED)</label>
                      <input type="number" value={editLead.budget_min || ''}
                        onChange={e => setEditLead({ ...editLead, budget_min: parseInt(e.target.value) || undefined })}
                        className={inputCls} style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                        onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Budget Max (AED)</label>
                      <input type="number" value={editLead.budget_max || ''}
                        onChange={e => setEditLead({ ...editLead, budget_max: parseInt(e.target.value) || undefined })}
                        className={inputCls} style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                        onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>Notes</h3>
                  <textarea
                    rows={3}
                    value={editLead.notes || ''}
                    onChange={e => setEditLead({ ...editLead, notes: e.target.value })}
                    placeholder="Add any notes about this lead..."
                    className={inputCls} style={{ ...inputStyle, resize: 'vertical' }}
                    onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                    onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {canAdvance && (
                    <button
                      type="button"
                      onClick={handleSaveAndAdvance}
                      disabled={saving}
                      className="flex-1 py-3 text-sm font-bold text-white rounded-xl flex items-center justify-center gap-2 transition-all"
                      style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 4px 14px rgba(201,169,110,0.35)' }}
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : `Save & Advance to ${STAGES[currentStageIndex + 1]?.label}`}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                    style={{ background: canAdvance ? '#F3F4F6' : 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: canAdvance ? '#374151' : 'white' }}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Only'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditLead(null)}
                    disabled={saving}
                    className="py-3 px-5 text-sm font-semibold rounded-xl transition-all"
                    style={{ background: '#F3F4F6', color: '#6B7280' }}
                  >
                    Cancel
                  </button>
                </div>

                {/* Delete */}
                {canDelete && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: '#FEE2E2' }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(editLead.id!)}
                      disabled={saving}
                      className="w-full py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
                      style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Lead Permanently
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* ── DOCUMENTS TAB ── */}
            {activeTab === 'documents' && (
              <div className="p-6">
                {/* Upload Section */}
                <div className="rounded-xl border-2 border-dashed p-5 mb-5 text-center"
                  style={{ borderColor: '#C9A96E', background: 'rgba(201,169,110,0.04)' }}>
                  <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: '#C9A96E' }} />
                  <p className="text-sm font-semibold mb-1" style={{ color: '#131B2B' }}>Upload Client Document</p>
                  <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>PDF, images, Word, Excel — max 10MB. Saved to Cloudinary + Document Manager.</p>

                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                    {/* Category selector */}
                    <select
                      value={docCategory}
                      onChange={e => setDocCategory(e.target.value)}
                      className="px-3 py-2 text-sm border rounded-lg focus:outline-none"
                      style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white', minWidth: '160px' }}
                    >
                      {DOC_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    {/* File input */}
                    <label
                      className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}
                    >
                      {docUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Paperclip className="w-4 h-4" />
                          Choose File
                        </>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        disabled={docUploading}
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleDocUpload(file);
                        }}
                      />
                    </label>
                  </div>

                  {docError && (
                    <p className="mt-3 text-sm font-medium" style={{ color: '#DC2626' }}>
                      ⚠️ {docError}
                    </p>
                  )}
                </div>

                {/* Document List */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#9CA3AF' }}>
                    Uploaded Documents ({leadDocs.length})
                  </h3>

                  {docLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
                    </div>
                  ) : leadDocs.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: '#E5E7EB' }}>
                      <FileText className="w-10 h-10 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                      <p className="text-sm" style={{ color: '#9CA3AF' }}>No documents uploaded yet</p>
                      <p className="text-xs mt-1" style={{ color: '#D1D5DB' }}>Upload passport, Emirates ID, or any client document above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {leadDocs.map(doc => (
                        <div key={doc.id}
                          className="flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm"
                          style={{ borderColor: '#E5E7EB', background: '#FAFAFA' }}>
                          {/* File icon */}
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: '#F3F4F6' }}>
                            {fileIcon(doc.mime_type)}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: '#131B2B' }}>
                              {doc.original_name || doc.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="px-1.5 py-0.5 text-xs rounded-full font-medium"
                                style={{ background: 'rgba(201,169,110,0.12)', color: '#8A6F2F' }}>
                                {doc.category}
                              </span>
                              {doc.file_size > 0 && (
                                <span className="text-xs" style={{ color: '#9CA3AF' }}>{formatBytes(doc.file_size)}</span>
                              )}
                              <span className="text-xs" style={{ color: '#9CA3AF' }}>
                                {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1 flex-shrink-0">
                            <a
                              href={doc.drive_view_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg transition-all hover:bg-blue-50"
                              title="View"
                              style={{ color: '#3B82F6' }}
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleDocDelete(doc.id)}
                              className="p-2 rounded-lg transition-all hover:bg-red-50"
                              title="Delete"
                              style={{ color: '#EF4444' }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Close button */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setEditLead(null)}
                    className="w-full py-3 text-sm font-semibold rounded-xl transition-all"
                    style={{ background: '#F3F4F6', color: '#6B7280' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
