'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye, Users, KanbanSquare, CheckSquare, Calendar, FolderOpen,
  Contact, TrendingUp, Activity, ChevronRight, X, Search,
  ArrowLeft, Clock, Phone, Mail, FileText, Building2,
  AlertCircle, CheckCircle, Loader2, Download,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}
function formatDate(dt?: string) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(dt?: string) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function timeAgo(dt?: string) {
  if (!dt) return '—';
  const diff = Date.now() - new Date(dt).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
function initials(name: string) {
  return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
}
function formatFileSize(b: number) {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const ROLE_COLORS: Record<string, string> = {
  agent: '#92400E', finance: '#065F46', admin: '#1D4ED8', owner: '#7C3AED',
};
const STAGE_COLORS: Record<string, string> = {
  new_lead: '#3B82F6', contacted: '#8B5CF6', viewing_scheduled: '#F59E0B',
  offer_made: '#10B981', negotiating: '#F97316', won: '#22C55E', lost: '#EF4444',
};
const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B', in_progress: '#3B82F6', completed: '#22C55E',
  scheduled: '#3B82F6', confirmed: '#10B981', cancelled: '#EF4444', done: '#22C55E',
};

const ACTIVITY_ICONS: Record<string, string> = {
  lead: '🎯', contact: '👤', task: '✅', viewing: '🏠', document: '📄',
};
const ACTIVITY_COLORS: Record<string, string> = {
  lead: '#3B82F6', contact: '#8B5CF6', task: '#F59E0B', viewing: '#10B981', document: '#C9A96E',
};

interface Agent {
  id: number; name: string; email: string; role: string; avatar_url?: string;
  rera_number?: string; specialty?: string; profile_complete?: number;
  lead_count: number; contact_count: number; task_count: number;
  viewing_count: number; doc_count: number;
}
interface ActivityItem {
  type: string; id: number; subject: string; detail: string;
  agent_name: string; agent_id: number; ts: string;
}

type DrillTab = 'leads' | 'contacts' | 'tasks' | 'viewings' | 'documents';

function Avatar({ name, url, size = 44 }: { name: string; url?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#1e2a3d,#0a1628)', border: '2px solid rgba(201,169,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 700, color: 'white', flexShrink: 0, overflow: 'hidden' }}>
      {url ? <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={name} /> : initials(name)}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 8, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontWeight: 700, fontSize: 14, color }}>{value}</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
    </div>
  );
}

export default function OversightPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [drillTab, setDrillTab] = useState<DrillTab>('leads');
  const [drillData, setDrillData] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('all');

  const token = getToken();

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { router.push('/login'); return; }
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    if (!['owner', 'admin'].includes(u.role)) { router.push('/dashboard'); return; }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [agR, acR] = await Promise.all([
        fetch(`${API_BASE}/api/oversight/agents`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/oversight/activity`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [agD, acD] = await Promise.all([agR.json(), acR.json()]);
      setAgents(agD.agents || []);
      setActivity(acD.activity || []);
    } catch {}
    setLoading(false);
  };

  const fetchDrill = useCallback(async (agent: Agent, tab: DrillTab) => {
    setDrillLoading(true);
    setDrillData([]);
    try {
      const url = `${API_BASE}/api/oversight/agents/${agent.id}/${tab}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const key = tab === 'leads' ? 'leads' : tab === 'contacts' ? 'contacts' :
        tab === 'tasks' ? 'tasks' : tab === 'viewings' ? 'viewings' : 'documents';
      setDrillData(data[key] || []);
    } catch {}
    setDrillLoading(false);
  }, [token]);

  useEffect(() => {
    if (selectedAgent) fetchDrill(selectedAgent, drillTab);
  }, [selectedAgent, drillTab]);

  const openAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setDrillTab('leads');
  };

  const filteredAgents = agents.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredActivity = activityFilter === 'all' ? activity :
    activity.filter(a => a.type === activityFilter);

  const goldStyle = { background: 'linear-gradient(135deg,#DEC993 0%,#C5A265 50%,#B59556 100%)', color: '#0D1625', fontWeight: 600 };

  // Totals
  const totals = agents.reduce((acc, a) => ({
    leads: acc.leads + a.lead_count,
    contacts: acc.contacts + a.contact_count,
    tasks: acc.tasks + a.task_count,
    viewings: acc.viewings + a.viewing_count,
    docs: acc.docs + a.doc_count,
  }), { leads: 0, contacts: 0, tasks: 0, viewings: 0, docs: 0 });

  return (
    <div className="min-h-screen p-6" style={{ background: '#0a1628', color: '#E5E7EB' }}>
      <style>{`
        .oversight-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media(max-width:1200px) { .oversight-grid { grid-template-columns: repeat(2,1fr); } }
        @media(max-width:700px) { .oversight-grid { grid-template-columns: 1fr; } }
        .drill-table { width: 100%; border-collapse: collapse; }
        .drill-table th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .drill-table td { padding: 10px 12px; font-size: 13px; color: #E5E7EB; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .drill-table tr:hover td { background: rgba(255,255,255,0.03); }
        .tab-btn { padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
        .pill { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
      `}</style>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.15)' }}>
            <Eye className="w-5 h-5" style={{ color: '#C9A96E' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Agent Oversight</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Monitor all agent activity, inputs, and documents in real time</p>
          </div>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all hover:opacity-90" style={goldStyle}>
          <Activity className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Leads', value: totals.leads, icon: KanbanSquare, color: '#3B82F6' },
          { label: 'Total Contacts', value: totals.contacts, icon: Contact, color: '#8B5CF6' },
          { label: 'Tasks Created', value: totals.tasks, icon: CheckSquare, color: '#F59E0B' },
          { label: 'Viewings Done', value: totals.viewings, icon: Calendar, color: '#10B981' },
          { label: 'Docs Uploaded', value: totals.docs, icon: FolderOpen, color: '#C9A96E' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${stat.color}15` }}>
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{loading ? '…' : stat.value}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-6 items-start flex-wrap lg:flex-nowrap">
        {/* LEFT — Agent cards / drill-in */}
        <div className="flex-1 min-w-0">
          {selectedAgent ? (
            /* ── DRILL-IN VIEW ── */
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Drill header */}
              <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0f1e35' }}>
                <button onClick={() => setSelectedAgent(null)} className="p-1.5 rounded-lg hover:bg-white/10">
                  <ArrowLeft className="w-4 h-4 text-white/60" />
                </button>
                <Avatar name={selectedAgent.name} url={selectedAgent.avatar_url} size={38} />
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{selectedAgent.name}</h3>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{selectedAgent.email}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <StatPill label="Leads" value={selectedAgent.lead_count} color="#3B82F6" />
                  <StatPill label="Contacts" value={selectedAgent.contact_count} color="#8B5CF6" />
                  <StatPill label="Tasks" value={selectedAgent.task_count} color="#F59E0B" />
                  <StatPill label="Viewings" value={selectedAgent.viewing_count} color="#10B981" />
                  <StatPill label="Docs" value={selectedAgent.doc_count} color="#C9A96E" />
                </div>
              </div>

              {/* Drill tabs */}
              <div className="flex gap-2 px-5 pt-4 pb-0 overflow-x-auto">
                {(['leads','contacts','tasks','viewings','documents'] as DrillTab[]).map(tab => (
                  <button key={tab} onClick={() => setDrillTab(tab)}
                    className="tab-btn capitalize flex-shrink-0"
                    style={drillTab === tab ? { ...goldStyle, border: '1px solid rgba(201,169,110,0.3)' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {tab}
                  </button>
                ))}
              </div>

              {/* Drill content */}
              <div className="p-5 overflow-x-auto">
                {drillLoading ? (
                  <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Loading {drillTab}…</p>
                  </div>
                ) : drillData.length === 0 ? (
                  <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No {drillTab} found for this agent.</p>
                  </div>
                ) : drillTab === 'leads' ? (
                  <table className="drill-table">
                    <thead><tr><th>Contact</th><th>Stage</th><th>Budget</th><th>Priority</th><th>Last Updated</th></tr></thead>
                    <tbody>
                      {drillData.map((r: any) => (
                        <tr key={r.id}>
                          <td>
                            <p className="font-medium">{r.contact_name || '—'}</p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.contact_phone}</p>
                          </td>
                          <td>
                            <span className="pill" style={{ background: `${STAGE_COLORS[r.pipeline_stage] || '#6B7280'}20`, color: STAGE_COLORS[r.pipeline_stage] || '#9CA3AF' }}>
                              {r.pipeline_stage?.replace(/_/g, ' ') || r.status}
                            </span>
                          </td>
                          <td>{r.budget ? `AED ${Number(r.budget).toLocaleString()}` : '—'}</td>
                          <td>
                            <span className="pill" style={{ background: r.priority === 'high' ? '#EF444420' : r.priority === 'medium' ? '#F59E0B20' : '#6B728020', color: r.priority === 'high' ? '#EF4444' : r.priority === 'medium' ? '#F59E0B' : '#9CA3AF' }}>
                              {r.priority}
                            </span>
                          </td>
                          <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{formatDate(r.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : drillTab === 'contacts' ? (
                  <table className="drill-table">
                    <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Type</th><th>Status</th><th>Added</th></tr></thead>
                    <tbody>
                      {drillData.map((r: any) => (
                        <tr key={r.id}>
                          <td className="font-medium">{r.name}</td>
                          <td style={{ color: 'rgba(255,255,255,0.5)' }}>{r.phone || '—'}</td>
                          <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{r.email || '—'}</td>
                          <td><span className="pill" style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>{r.type}</span></td>
                          <td><span className="pill" style={{ background: `${STATUS_COLORS[r.status] || '#6B7280'}20`, color: STATUS_COLORS[r.status] || '#9CA3AF' }}>{r.status}</span></td>
                          <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{formatDate(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : drillTab === 'tasks' ? (
                  <table className="drill-table">
                    <thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Assigned To</th><th>Due Date</th><th>Created</th></tr></thead>
                    <tbody>
                      {drillData.map((r: any) => (
                        <tr key={r.id}>
                          <td>
                            <p className="font-medium">{r.title}</p>
                            {r.description && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.description.substring(0, 60)}{r.description.length > 60 ? '…' : ''}</p>}
                          </td>
                          <td>
                            <span className="pill" style={{ background: `${STATUS_COLORS[r.status] || '#6B7280'}20`, color: STATUS_COLORS[r.status] || '#9CA3AF' }}>
                              {r.status}
                            </span>
                          </td>
                          <td>
                            <span className="pill" style={{ background: r.priority === 'high' ? '#EF444420' : r.priority === 'medium' ? '#F59E0B20' : '#6B728020', color: r.priority === 'high' ? '#EF4444' : r.priority === 'medium' ? '#F59E0B' : '#9CA3AF' }}>
                              {r.priority}
                            </span>
                          </td>
                          <td style={{ color: 'rgba(255,255,255,0.5)' }}>{r.assigned_to_name || '—'}</td>
                          <td style={{ color: r.due_date && new Date(r.due_date) < new Date() ? '#EF4444' : 'rgba(255,255,255,0.5)', fontSize: 12 }}>{formatDate(r.due_date)}</td>
                          <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{formatDate(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : drillTab === 'viewings' ? (
                  <table className="drill-table">
                    <thead><tr><th>Client</th><th>Status</th><th>Date</th><th>Rating</th><th>Follow-Up</th></tr></thead>
                    <tbody>
                      {drillData.map((r: any) => (
                        <tr key={r.id}>
                          <td>
                            <p className="font-medium">{r.contact_name || '—'}</p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.contact_phone}</p>
                          </td>
                          <td>
                            <span className="pill" style={{ background: `${STATUS_COLORS[r.status] || '#6B7280'}20`, color: STATUS_COLORS[r.status] || '#9CA3AF' }}>{r.status}</span>
                          </td>
                          <td style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{r.viewing_date || formatDate(r.scheduled_at)}</td>
                          <td>{r.rating ? '⭐'.repeat(r.rating) : '—'}</td>
                          <td>
                            {r.follow_up_required ? (
                              <span className="pill" style={{ background: '#F59E0B20', color: '#F59E0B' }}>Required</span>
                            ) : <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : drillTab === 'documents' ? (
                  <table className="drill-table">
                    <thead><tr><th>Document</th><th>Category</th><th>Size</th><th>Uploaded</th><th>Actions</th></tr></thead>
                    <tbody>
                      {drillData.map((r: any) => (
                        <tr key={r.id}>
                          <td>
                            <p className="font-medium truncate max-w-xs">{r.original_name || r.name}</p>
                            {r.notes && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.notes}</p>}
                          </td>
                          <td><span className="pill" style={{ background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>{r.category}</span></td>
                          <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{formatFileSize(r.file_size)}</td>
                          <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{formatDate(r.created_at)}</td>
                          <td>
                            <div className="flex gap-1">
                              {r.drive_view_link && (
                                <a href={r.drive_view_link} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Preview">
                                  <Eye className="w-3.5 h-3.5 text-white/60" />
                                </a>
                              )}
                              {r.drive_download_link && (
                                <a href={r.drive_download_link} target="_blank" rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Download">
                                  <Download className="w-3.5 h-3.5 text-white/60" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            </div>
          ) : (
            /* ── AGENT CARDS GRID ── */
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-white/30" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search agents..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E5E7EB' }} />
                </div>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{filteredAgents.length} agents</span>
              </div>

              {loading ? (
                <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                  <p className="text-sm">Loading agents…</p>
                </div>
              ) : filteredAgents.length === 0 ? (
                <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No agents found.</p>
                </div>
              ) : (
                <div className="oversight-grid">
                  {filteredAgents.map(agent => (
                    <div key={agent.id}
                      className="rounded-2xl p-5 cursor-pointer transition-all hover:border-amber-400/30"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                      onClick={() => openAgent(agent)}>
                      {/* Agent header */}
                      <div className="flex items-start gap-3 mb-4">
                        <Avatar name={agent.name} url={agent.avatar_url} size={44} />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">{agent.name}</h3>
                          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{agent.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="pill capitalize" style={{ background: `${ROLE_COLORS[agent.role] || '#6B7280'}20`, color: ROLE_COLORS[agent.role] || '#9CA3AF' }}>
                              {agent.role}
                            </span>
                            {agent.profile_complete ? (
                              <span className="pill" style={{ background: '#22C55E20', color: '#22C55E' }}>✓ Profile Complete</span>
                            ) : (
                              <span className="pill" style={{ background: '#EF444420', color: '#EF4444' }}>Profile Incomplete</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                          { label: 'Leads', value: agent.lead_count, color: '#3B82F6' },
                          { label: 'Contacts', value: agent.contact_count, color: '#8B5CF6' },
                          { label: 'Tasks', value: agent.task_count, color: '#F59E0B' },
                          { label: 'Viewings', value: agent.viewing_count, color: '#10B981' },
                          { label: 'Docs', value: agent.doc_count, color: '#C9A96E' },
                        ].map(stat => (
                          <div key={stat.label} className="rounded-lg p-2.5 text-center" style={{ background: `${stat.color}10`, border: `1px solid ${stat.color}20` }}>
                            <p className="font-bold text-lg" style={{ color: stat.color }}>{stat.value}</p>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</p>
                          </div>
                        ))}
                        {/* RERA */}
                        {agent.rera_number && (
                          <div className="rounded-lg p-2.5 col-span-3" style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)' }}>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>RERA No.</p>
                            <p className="font-semibold text-sm" style={{ color: '#C9A96E' }}>{agent.rera_number}</p>
                          </div>
                        )}
                      </div>

                      {/* View button */}
                      <button className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                        style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.2)' }}>
                        <Eye className="w-4 h-4" />
                        View All Activity
                        <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT — Recent Activity Feed */}
        <div className="w-80 flex-shrink-0">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: '#C9A96E' }} />
                <h3 className="font-semibold text-white text-sm">Activity Feed</h3>
              </div>
              {/* Filter pills */}
              <div className="flex gap-1">
                {['all','lead','contact','task','viewing','document'].map(f => (
                  <button key={f} onClick={() => setActivityFilter(f)}
                    className="px-1.5 py-0.5 rounded text-xs font-medium transition-all"
                    style={activityFilter === f ? { background: '#C9A96E', color: '#0a1628' } : { color: 'rgba(255,255,255,0.4)', background: 'transparent' }}>
                    {f === 'all' ? 'All' : ACTIVITY_ICONS[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 600 }}>
              {filteredActivity.length === 0 ? (
                <div className="text-center py-10" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <Clock className="w-7 h-7 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No recent activity</p>
                </div>
              ) : (
                filteredActivity.map((item, i) => (
                  <div key={`${item.type}-${item.id}-${i}`} className="px-4 py-3 border-b flex gap-3 items-start"
                    style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: `${ACTIVITY_COLORS[item.type] || '#6B7280'}15` }}>
                      {ACTIVITY_ICONS[item.type] || '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{item.subject || '—'}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.agent_name}</span>
                        {item.detail && (
                          <span className="text-xs px-1.5 rounded" style={{ background: `${ACTIVITY_COLORS[item.type] || '#6B7280'}20`, color: ACTIVITY_COLORS[item.type] || '#9CA3AF' }}>
                            {item.detail?.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{timeAgo(item.ts)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
