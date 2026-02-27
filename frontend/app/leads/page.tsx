'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Edit2, Trash2, Users, MessageCircle, Archive, UserCheck, CheckSquare, Square, Filter, TrendingUp } from 'lucide-react';

interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  source_channel?: string;
  status: string;
  priority: string;
  pipeline_stage?: string;
  lead_type?: string;
  tags?: string;
  budget_min: number;
  budget_max: number;
  property_type: string;
  location_preference: string;
  created_at: string;
}

interface PoolContact {
  id: number;
  name: string;
  phone: string;
  email: string;
  type: string;
  source: string;
  status: string;
  lead_pool: number;
  lead_source_status: string;
  assigned_agent: string;
  location_preference: string;
  budget_min: number;
  budget_max: number;
  property_type: string;
  bedrooms: number;
  created_at: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  new:          { bg: '#EFF6FF', text: '#1D4ED8' },
  contacted:    { bg: '#FFFBEB', text: '#92400E' },
  qualified:    { bg: '#ECFDF5', text: '#065F46' },
  unqualified:  { bg: '#FEF2F2', text: '#DC2626' },
  converted:    { bg: '#F5F3FF', text: '#5B21B6' },
};

const pipelineStageColors: Record<string, { bg: string; text: string }> = {
  new_lead:     { bg: '#EFF6FF', text: '#1D4ED8' },
  contacted:    { bg: '#FFFBEB', text: '#92400E' },
  qualified:    { bg: '#ECFDF5', text: '#065F46' },
  site_visit:   { bg: '#F5F3FF', text: '#5B21B6' },
  offer_made:   { bg: '#FFF7ED', text: '#C2410C' },
  negotiation:  { bg: '#FEF2F2', text: '#DC2626' },
  deal_closed:  { bg: '#ECFDF5', text: '#064E3B' },
  lost:         { bg: '#F9FAFB', text: '#6B7280' },
};

const pipelineStageLabels: Record<string, string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  site_visit: 'Site Visit',
  offer_made: 'Offer Made',
  negotiation: 'Negotiation',
  deal_closed: 'Deal Closed',
  lost: 'Lost',
};

const priorityColors: Record<string, { bg: string; text: string }> = {
  high:   { bg: '#FEF2F2', text: '#DC2626' },
  medium: { bg: '#FFFBEB', text: '#92400E' },
  low:    { bg: '#F9FAFB', text: '#6B7280' },
};

const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

export default function LeadsPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'active' | 'pool'>('active');
  const [canDelete, setCanDelete] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [poolContacts, setPoolContacts] = useState<PoolContact[]>([]);
  const [poolStats, setPoolStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [leadTypeFilter, setLeadTypeFilter] = useState('all');
  const [poolSourceFilter, setPoolSourceFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState<PoolContact | null>(null);
  const [assignAgentName, setAssignAgentName] = useState('');
  const [currentLead, setCurrentLead] = useState<Partial<Lead> | null>(null);
  const [agents, setAgents] = useState<{id: number; name: string; role: string}[]>([]);
  const [agentFilter, setAgentFilter] = useState('all');
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkUpdate, setBulkUpdate] = useState<{ status?: string; pipeline_stage?: string; priority?: string; assigned_to?: string }>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [leadStats, setLeadStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const _role = localStorage.getItem('userRole') || 'agent';
    const _levels: Record<string,number> = { owner: 4, admin: 3, marketing: 2, agent: 1 };
    setCanDelete((_levels[_role] ?? 0) >= (_levels['admin'] ?? 99));
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchAgents();
    if (viewMode === 'active') {
      fetchLeads();
    } else {
      fetchPool();
    }
  }, [viewMode, statusFilter, pipelineFilter, leadTypeFilter, poolSourceFilter, agentFilter]);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const users = data.data?.rows || data.users || [];
        setAgents(users.filter((u: any) => u.active !== 0));
      }
    } catch (e) { console.error('Failed to fetch agents', e); }
  };

  const fetchPool = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = '/api/contacts?pool=true&limit=200';
      if (poolSourceFilter !== 'all') url += `&status=${poolSourceFilter}`;
      const [poolRes, statsRes] = await Promise.all([
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/lead-pool/stats', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (poolRes.ok) {
        const data = await poolRes.json();
        setPoolContacts(data.contacts || []);
      }
      if (statsRes.ok) {
        setPoolStats(await statsRes.json());
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAssign = async () => {
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

  const fetchLeads = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = '/api/leads?limit=500';
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (pipelineFilter !== 'all') url += `&pipeline_stage=${pipelineFilter}`;
      if (leadTypeFilter !== 'all') url += `&lead_type=${leadTypeFilter}`;
      if (agentFilter !== 'all') url += `&assigned_to=${agentFilter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const rawLeads = data.leads || data.data || [];
        const normalized = rawLeads.map((l: any) => ({
          ...l,
          name: l.name || l.contact_name || 'Unknown',
          phone: l.phone || l.contact_phone || '',
          email: l.email || l.contact_email || '',
          budget_min: l.budget_min ?? l.budget ?? null,
          budget_max: l.budget_max ?? l.budget ?? null,
        }));
        setLeads(normalized);
        // Compute quick stats by pipeline stage
        const stats: Record<string, number> = {};
        normalized.forEach((l: Lead) => {
          const stage = l.pipeline_stage || 'new_lead';
          stats[stage] = (stats[stage] || 0) + 1;
        });
        setLeadStats(stats);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const toggleSelectLead = (id: number) => {
    const next = new Set(selectedLeads);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    setSelectedLeads(next);
  };

  const handleBulkUpdate = async () => {
    if (selectedLeads.size === 0) return;
    setBulkLoading(true);
    try {
      const token = localStorage.getItem('token');
      const updates: any = {};
      if (bulkUpdate.status) updates.status = bulkUpdate.status;
      if (bulkUpdate.pipeline_stage) updates.pipeline_stage = bulkUpdate.pipeline_stage;
      if (bulkUpdate.priority) updates.priority = bulkUpdate.priority;
      if (bulkUpdate.assigned_to) updates.assigned_to = parseInt(bulkUpdate.assigned_to);
      const res = await fetch('/api/leads/bulk-update', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedLeads), updates }),
      });
      if (res.ok) {
        setSelectedLeads(new Set());
        setShowBulkModal(false);
        setBulkUpdate({});
        fetchLeads();
      }
    } catch (e) { console.error(e); }
    finally { setBulkLoading(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return;
    if (!confirm(`Delete ${selectedLeads.size} selected leads? This cannot be undone.`)) return;
    setBulkLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/leads/bulk-delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedLeads) }),
      });
      if (res.ok) {
        setSelectedLeads(new Set());
        fetchLeads();
      }
    } catch (e) { console.error(e); }
    finally { setBulkLoading(false); }
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLead) return;
    try {
      const token = localStorage.getItem('token');
      const method = currentLead.id ? 'PUT' : 'POST';
      const url = currentLead.id ? `/api/leads/${currentLead.id}` : '/api/leads';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(currentLead),
      });
      if (res.ok) { setShowModal(false); setCurrentLead(null); fetchLeads(); }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this lead?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/leads/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchLeads();
  };

  const parseTags = (tags: string | undefined): string[] => {
    if (!tags) return [];
    try { const parsed = JSON.parse(tags); return Array.isArray(parsed) ? parsed : []; }
    catch { return tags.split(',').map(t => t.trim()).filter(Boolean); }
  };

  const filteredLeads = leads.filter(l =>
    (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.phone || '').includes(searchTerm) ||
    ((l.email || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sourceStatusLabels: Record<string, string> = {
    INACTIVE: 'Inactive (9,125)',
    UNDEAL: 'Undeal',
    DEAL: 'Closed Deal',
    INVALID: 'Invalid',
  };

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Leads</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>
                {viewMode === 'active' ? `${filteredLeads.length} active leads` : `${poolContacts.length} in Lead Pool`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Tabs */}
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: '#E5E7EB' }}>
              <button
                onClick={() => setViewMode('active')}
                className="px-4 py-2 text-sm font-semibold transition-all"
                style={{
                  background: viewMode === 'active' ? 'linear-gradient(135deg, #131B2B, #1e2a3d)' : 'white',
                  color: viewMode === 'active' ? 'white' : '#374151',
                }}
              >
                <Users className="w-4 h-4 inline mr-1.5" />
                Active Leads
              </button>
              <button
                onClick={() => setViewMode('pool')}
                className="px-4 py-2 text-sm font-semibold transition-all border-l"
                style={{
                  borderColor: '#E5E7EB',
                  background: viewMode === 'pool' ? 'linear-gradient(135deg, #7C3AED, #5B21B6)' : 'white',
                  color: viewMode === 'pool' ? 'white' : '#374151',
                }}
              >
                <Archive className="w-4 h-4 inline mr-1.5" />
                Lead Pool
                {poolStats && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }}>
                    {poolStats.total?.toLocaleString()}
                  </span>
                )}
              </button>
            </div>
            {viewMode === 'active' && (
              <button
                onClick={() => { setCurrentLead({ status: 'new', priority: 'medium', pipeline_stage: 'new_lead', lead_type: 'buyer' }); setShowModal(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}
              >
                <Plus className="w-4 h-4" />
                Add Lead
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-5">

        {/* Lead Pool Stats Banner */}
        {viewMode === 'pool' && poolStats && (
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Total Pool', value: poolStats.total?.toLocaleString(), color: '#7C3AED', bg: '#F5F3FF' },
              { label: 'Assigned', value: poolStats.assigned?.toLocaleString(), color: '#065F46', bg: '#ECFDF5' },
              { label: 'Unassigned', value: poolStats.unassigned?.toLocaleString(), color: '#DC2626', bg: '#FEF2F2' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: '#E5E7EB' }}>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-sm font-medium" style={{ color: '#6B7280' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Lead Pool View */}
        {viewMode === 'pool' ? (
          <>
            {/* Pool Filters */}
            <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
                <input
                  type="text"
                  placeholder="Search by name, phone, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none"
                  style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
                />
              </div>
              <select value={poolSourceFilter} onChange={(e) => setPoolSourceFilter(e.target.value)}
                className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
                style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>
                <option value="all">All Statuses</option>
                <option value="inactive">Inactive</option>
                <option value="UNDEAL">Undeal</option>
                <option value="DEAL">Deal (Closed)</option>
                <option value="INVALID">Invalid</option>
              </select>
            </div>

            {/* Pool Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr style={{ background: '#131B2B' }}>
                        {['Contact', 'Phone', 'Type', 'Source Status', 'Location/Budget', 'Assigned Agent', 'Created', 'Action'].map((h) => (
                          <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {poolContacts
                        .filter(c =>
                          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.phone || '').includes(searchTerm) ||
                          (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((contact, index) => (
                          <tr
                            key={contact.id}
                            style={{ background: index % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F5F3FF'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = index % 2 === 0 ? 'white' : '#FAFBFC'; }}
                          >
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
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full"
                                style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                                {contact.lead_source_status || contact.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="text-sm" style={{ color: '#374151' }}>{contact.location_preference || '—'}</p>
                              {contact.budget_min ? (
                                <p className="text-xs font-medium" style={{ color: '#8A6F2F' }}>
                                  AED {contact.budget_min.toLocaleString()}
                                </p>
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
                              <button
                                onClick={() => { setAssignTarget(contact); setAssignAgentName(contact.assigned_agent || ''); setShowAssignModal(true); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all"
                                style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)' }}
                              >
                                <UserCheck className="w-3 h-3" /> Assign
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {poolContacts.length === 0 && !loading && (
                    <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
                      <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium">Lead Pool is empty</p>
                      <p className="text-xs mt-1">Run the Pixxi import to populate the Lead Pool</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
        {/* Quick Stats Bar */}
        {Object.keys(leadStats).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: 'new_lead', label: 'New', color: '#3B82F6' },
              { key: 'contacted', label: 'Contacted', color: '#F59E0B' },
              { key: 'qualified', label: 'Qualified', color: '#10B981' },
              { key: 'site_visit', label: 'Site Visit', color: '#8B5CF6' },
              { key: 'offer_made', label: 'Offer Made', color: '#F97316' },
              { key: 'negotiation', label: 'Negotiation', color: '#EF4444' },
              { key: 'deal_closed', label: 'Closed', color: '#065F46' },
              { key: 'lost', label: 'Lost', color: '#6B7280' },
            ].filter(s => leadStats[s.key]).map(s => (
              <button
                key={s.key}
                onClick={() => setPipelineFilter(pipelineFilter === s.key ? 'all' : s.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all"
                style={{
                  background: pipelineFilter === s.key ? s.color : 'white',
                  color: pipelineFilter === s.key ? 'white' : s.color,
                  borderColor: s.color,
                  boxShadow: pipelineFilter === s.key ? `0 2px 8px ${s.color}40` : 'none',
                }}
              >
                <TrendingUp className="w-3 h-3" />
                {s.label}: <span className="font-bold">{leadStats[s.key] || 0}</span>
              </button>
            ))}
            {leads.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ml-auto"
                style={{ background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB' }}>
                Total: {leads.length}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none"
              style={inputStyle}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle}>
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="not_contacted">Not Contacted</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="hot">Hot</option>
            <option value="viewing_scheduled">Viewing Scheduled</option>
            <option value="unqualified">Unqualified</option>
            <option value="converted">Converted</option>
            <option value="deal_won">Deal Won</option>
            <option value="deal_lost">Deal Lost</option>
          </select>
          <select value={pipelineFilter} onChange={(e) => setPipelineFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle}>
            <option value="all">All Pipeline Stages</option>
            <option value="new_lead">New Lead</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="site_visit">Site Visit</option>
            <option value="offer_made">Offer Made</option>
            <option value="negotiation">Negotiation</option>
            <option value="deal_closed">Deal Closed</option>
            <option value="lost">Lost</option>
          </select>
          <select value={leadTypeFilter} onChange={(e) => setLeadTypeFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle}>
            <option value="all">All Types</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="tenant">Tenant</option>
            <option value="landlord">Landlord</option>
            <option value="investor">Investor</option>
            <option value="agent">Agent</option>
          </select>
          <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle}>
            <option value="all">All Agents</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {(statusFilter !== 'all' || pipelineFilter !== 'all' || leadTypeFilter !== 'all' || agentFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => { setStatusFilter('all'); setPipelineFilter('all'); setLeadTypeFilter('all'); setAgentFilter('all'); setSearchTerm(''); }}
              className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-all"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedLeads.size > 0 && (
          <div className="mb-4 p-3 rounded-xl border flex items-center gap-3 flex-wrap" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)', borderColor: 'rgba(201,169,110,0.3)' }}>
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" style={{ color: '#C9A96E' }} />
              <span className="text-sm font-semibold text-white">{selectedLeads.size} lead{selectedLeads.size !== 1 ? 's' : ''} selected</span>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all"
              style={{ background: 'rgba(201,169,110,0.2)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.3)' }}
            >
              <Filter className="w-4 h-4" />
              Bulk Update
            </button>
            {canDelete && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
            )}
            <button
              onClick={() => setSelectedLeads(new Set())}
              className="px-3 py-2 text-sm text-white/60 hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: '#131B2B' }}>
                    <th className="px-4 py-3.5 text-center">
                      <button onClick={toggleSelectAll} className="text-white/70 hover:text-white transition-colors">
                        {selectedLeads.size === filteredLeads.length && filteredLeads.length > 0
                          ? <CheckSquare className="w-4 h-4" />
                          : <Square className="w-4 h-4" />
                        }
                      </button>
                    </th>
                    {['Lead Info', 'Contact', 'Requirements', 'Pipeline Stage', 'Status', 'Source', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead, index) => {
                    const sc = statusColors[lead.status] || { bg: '#F9FAFB', text: '#6B7280' };
                    const pc = pipelineStageColors[lead.pipeline_stage || 'new_lead'] || { bg: '#EFF6FF', text: '#1D4ED8' };
                    const tags = parseTags(lead.tags);
                    return (
                      <tr
                        key={lead.id}
                        style={{
                          background: selectedLeads.has(lead.id) ? 'rgba(201,169,110,0.08)' : (index % 2 === 0 ? 'white' : '#FAFBFC'),
                          borderBottom: '1px solid #F3F4F6',
                          borderLeft: selectedLeads.has(lead.id) ? '3px solid #C9A96E' : '3px solid transparent',
                        }}
                        onMouseEnter={(e) => { if (!selectedLeads.has(lead.id)) (e.currentTarget as HTMLTableRowElement).style.background = '#FEF9F0'; }}
                        onMouseLeave={(e) => { if (!selectedLeads.has(lead.id)) (e.currentTarget as HTMLTableRowElement).style.background = index % 2 === 0 ? 'white' : '#FAFBFC'; }}
                      >
                        <td className="px-4 py-3.5 text-center">
                          <button onClick={() => toggleSelectLead(lead.id)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            {selectedLeads.has(lead.id)
                              ? <CheckSquare className="w-4 h-4" style={{ color: '#C9A96E' }} />
                              : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{lead.name}</p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>#{lead.id}</p>
                          {lead.lead_type && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 text-xs rounded capitalize"
                              style={{ background: '#F3F4F6', color: '#374151' }}>
                              {lead.lead_type}
                            </span>
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tags.slice(0, 2).map((tag, i) => (
                                <span key={i} className="px-1.5 py-0.5 text-xs rounded"
                                  style={{ background: 'rgba(201,169,110,0.15)', color: '#8A6F2F' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm" style={{ color: '#374151' }}>{lead.phone}</span>
                            {lead.phone && (
                              <a
                                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MessageCircle className="w-3.5 h-3.5" style={{ color: '#25D366' }} />
                              </a>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>{lead.email}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm" style={{ color: '#374151' }}>{lead.property_type || '—'}</p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>{lead.location_preference}</p>
                          {lead.budget_min ? (
                            <p className="text-xs font-medium" style={{ color: '#8A6F2F' }}>
                              AED {lead.budget_min.toLocaleString()} – {lead.budget_max?.toLocaleString()}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap" style={{ background: pc.bg, color: pc.text }}>
                            {pipelineStageLabels[lead.pipeline_stage || 'new_lead'] || lead.pipeline_stage || 'New Lead'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: sc.bg, color: sc.text }}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: '#6B7280' }}>
                          {lead.source_channel || lead.source || '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setCurrentLead(lead); setShowModal(true); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all"
                              style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            {canDelete && (
                            <button
                              onClick={() => handleDelete(lead.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all"
                              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredLeads.length === 0 && (
                <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No leads found</p>
                  <p className="text-xs mt-1">Add your first lead to get started</p>
                </div>
              )}
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && assignTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-lg font-bold mb-1" style={{ color: '#131B2B' }}>Assign Lead</h2>
            <p className="text-sm mb-4" style={{ color: '#6B7280' }}>{assignTarget.name}</p>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Select Agent</label>
            <select
              value={assignAgentName}
              onChange={(e) => setAssignAgentName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none mb-4"
              style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
            >
              <option value="">— Unassigned —</option>
              {agents.map(a => (
                <option key={a.id} value={a.name}>{a.name} ({a.role})</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={handleAssign}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>
                Assign
              </button>
              <button onClick={() => { setShowAssignModal(false); setAssignTarget(null); }}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && currentLead && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>
                  {currentLead.id ? 'Edit Lead' : 'New Lead'}
                </h2>
              </div>
            </div>
            <form onSubmit={handleSaveLead} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Name *', key: 'name', type: 'text', required: true },
                  { label: 'Phone *', key: 'phone', type: 'text', required: true },
                  { label: 'Email', key: 'email', type: 'email', required: false },
                ].map((f) => (
                  <div key={f.key} className={f.key === 'email' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>{f.label}</label>
                    <input
                      type={f.type}
                      required={f.required}
                      value={(currentLead as any)[f.key] || ''}
                      onChange={(e) => setCurrentLead({ ...currentLead, [f.key]: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                ))}

                {[
                  { label: 'Lead Type', key: 'lead_type', options: ['buyer','seller','tenant','landlord','investor','agent'] },
                  { label: 'Pipeline Stage', key: 'pipeline_stage', options: ['new_lead','contacted','qualified','site_visit','offer_made','negotiation','deal_closed','lost'] },
                  { label: 'Status', key: 'status', options: ['new','contacted','qualified','unqualified','converted'] },
                  { label: 'Priority', key: 'priority', options: ['low','medium','high'] },
                  { label: 'Source', key: 'source', options: ['website','referral','social_media','walk_in','phone_call','bayut','property_finder','dubizzle','whatsapp'] },
                  { label: 'Property Type', key: 'property_type', options: ['','apartment','villa','townhouse','penthouse','commercial','office','retail','studio'] },
                  { label: 'Source Channel', key: 'source_channel', options: ['','website','referral','social_media','walk_in','phone_call','bayut','property_finder','dubizzle','whatsapp'] },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>{f.label}</label>
                    <select
                      value={(currentLead as any)[f.key] || ''}
                      onChange={(e) => setCurrentLead({ ...currentLead, [f.key]: e.target.value })}
                      className={inputCls}
                      style={inputStyle}
                    >
                      {f.options.map((o) => <option key={o} value={o}>{o ? o.replace(/_/g, ' ') : 'Select...'}</option>)}
                    </select>
                  </div>
                ))}

                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Location Preference</label>
                  <input
                    type="text"
                    value={currentLead.location_preference || ''}
                    onChange={(e) => setCurrentLead({ ...currentLead, location_preference: e.target.value })}
                    className={inputCls}
                    style={inputStyle}
                    placeholder="e.g. Dubai Marina, Downtown"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Budget Min (AED)</label>
                  <input
                    type="number"
                    value={currentLead.budget_min || ''}
                    onChange={(e) => setCurrentLead({ ...currentLead, budget_min: parseInt(e.target.value) })}
                    className={inputCls} style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Budget Max (AED)</label>
                  <input
                    type="number"
                    value={currentLead.budget_max || ''}
                    onChange={(e) => setCurrentLead({ ...currentLead, budget_max: parseInt(e.target.value) })}
                    className={inputCls} style={inputStyle}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Assigned Agent</label>
                  <select
                    value={(currentLead as any).assigned_to || ''}
                    onChange={(e) => setCurrentLead({ ...currentLead, assigned_to: e.target.value ? parseInt(e.target.value) : null } as any)}
                    className={inputCls} style={inputStyle}
                  >
                    <option value="">— Unassigned —</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}
                >
                  {currentLead.id ? 'Update Lead' : 'Create Lead'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setCurrentLead(null); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                  style={{ background: '#F3F4F6', color: '#374151' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Update Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
                  <CheckSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>Bulk Update</h2>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>{selectedLeads.size} leads selected</p>
                </div>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>Pipeline Stage</label>
                <select value={bulkUpdate.pipeline_stage || ''} onChange={(e) => setBulkUpdate(p => ({ ...p, pipeline_stage: e.target.value || undefined }))}
                  className="w-full px-3.5 py-2.5 text-sm border rounded-lg" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                  <option value="">— No change —</option>
                  <option value="new_lead">New Lead</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="site_visit">Site Visit</option>
                  <option value="offer_made">Offer Made</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="deal_closed">Deal Closed</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>Status</label>
                <select value={bulkUpdate.status || ''} onChange={(e) => setBulkUpdate(p => ({ ...p, status: e.target.value || undefined }))}
                  className="w-full px-3.5 py-2.5 text-sm border rounded-lg" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                  <option value="">— No change —</option>
                  <option value="new">New</option>
                  <option value="not_contacted">Not Contacted</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="hot">Hot</option>
                  <option value="viewing_scheduled">Viewing Scheduled</option>
                  <option value="unqualified">Unqualified</option>
                  <option value="deal_won">Deal Won</option>
                  <option value="deal_lost">Deal Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>Priority</label>
                <select value={bulkUpdate.priority || ''} onChange={(e) => setBulkUpdate(p => ({ ...p, priority: e.target.value || undefined }))}
                  className="w-full px-3.5 py-2.5 text-sm border rounded-lg" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                  <option value="">— No change —</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>Assign to Agent</label>
                <select value={bulkUpdate.assigned_to || ''} onChange={(e) => setBulkUpdate(p => ({ ...p, assigned_to: e.target.value || undefined }))}
                  className="w-full px-3.5 py-2.5 text-sm border rounded-lg" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                  <option value="">— No change —</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleBulkUpdate}
                disabled={bulkLoading || Object.values(bulkUpdate).every(v => !v)}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}
              >
                {bulkLoading ? 'Updating...' : `Update ${selectedLeads.size} Leads`}
              </button>
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                style={{ background: '#F3F4F6', color: '#374151' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
