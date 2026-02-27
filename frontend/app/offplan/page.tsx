'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building, Plus, Edit2, Trash2, Search, Filter } from 'lucide-react';

interface Project {
  id: number;
  name: string;
  developer_name?: string;
  developer_id?: number;
  location?: string;
  community?: string;
  project_type?: string;
  unit_types?: string;
  min_price?: number;
  max_price?: number;
  payment_plan?: string;
  down_payment_percent?: number;
  handover_date?: string;
  completion_percent?: number;
  total_units?: number;
  available_units?: number;
  status?: string;
  featured?: number;
  description?: string;
}

interface Developer {
  id: number;
  name: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: '#ECFDF5', text: '#065F46' },
  'sold out': { bg: '#FEF2F2', text: '#DC2626' },
  'coming soon': { bg: '#EFF6FF', text: '#1D4ED8' },
  inactive: { bg: '#F9FAFB', text: '#6B7280' },
};

const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

export default function OffplanPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [current, setCurrent] = useState<Partial<Project> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [projRes, devRes] = await Promise.all([
        fetch(`/api/offplan${statusFilter ? `?status=${statusFilter}` : ''}`, { headers }),
        fetch('/api/developers?limit=100', { headers }),
      ]);
      if (projRes.ok) { const d = await projRes.json(); setProjects(d.projects || []); }
      if (devRes.ok) { const d = await devRes.json(); setDevelopers(d.developers || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const token = localStorage.getItem('token');
    const method = current.id ? 'PUT' : 'POST';
    const url = current.id ? `/api/offplan/${current.id}` : '/api/offplan';
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    });
    if (res.ok) { setShowModal(false); setCurrent(null); fetchData(); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this project?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/offplan/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchData();
  };

  const filtered = projects.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.location || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Off-Plan Projects</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{filtered.length} projects</p>
            </div>
          </div>
          <button
            onClick={() => { setCurrent({ status: 'active', completion_percent: 0 }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Project
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
            <input
              type="text" placeholder="Search projects..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none"
              style={inputStyle}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="sold out">Sold Out</option>
            <option value="coming soon">Coming Soon</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

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
                    {['Name', 'Developer', 'Location', 'Unit Types', 'Price Range', 'Handover', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const sc = statusColors[p.status || 'active'] || { bg: '#F9FAFB', text: '#6B7280' };
                    return (
                      <tr key={p.id}
                        style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF9F0'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFBFC'; }}
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{p.name}</p>
                          {p.completion_percent !== undefined && <p className="text-xs" style={{ color: '#9CA3AF' }}>{p.completion_percent}% complete</p>}
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>{p.developer_name || '—'}</td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>{p.location || p.community || '—'}</td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>{p.unit_types ? p.unit_types.replace(/[\[\]"]/g, '') : '—'}</td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>
                          {p.min_price ? `AED ${(p.min_price / 1000000).toFixed(1)}M – ${p.max_price ? (p.max_price / 1000000).toFixed(1) + 'M' : '?'}` : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>{p.handover_date || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: sc.bg, color: sc.text }}>
                            {p.status || 'active'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setCurrent(p); setShowModal(true); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                              style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => handleDelete(p.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
                  <Building className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No projects found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && current && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  <Building className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{current.id ? 'Edit Project' : 'New Off-Plan Project'}</h2>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Project Name *</label>
                  <input type="text" required value={current.name || ''} onChange={e => setCurrent({ ...current, name: e.target.value })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Developer</label>
                  <select value={current.developer_id || ''} onChange={e => setCurrent({ ...current, developer_id: parseInt(e.target.value) || undefined })}
                    className={inputCls} style={inputStyle}>
                    <option value="">Select Developer</option>
                    {developers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Status</label>
                  <select value={current.status || 'active'} onChange={e => setCurrent({ ...current, status: e.target.value })}
                    className={inputCls} style={inputStyle}>
                    <option value="active">Active</option>
                    <option value="coming soon">Coming Soon</option>
                    <option value="sold out">Sold Out</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Location</label>
                  <input type="text" value={current.location || ''} onChange={e => setCurrent({ ...current, location: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. Dubai Marina" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Community</label>
                  <input type="text" value={current.community || ''} onChange={e => setCurrent({ ...current, community: e.target.value })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Project Type</label>
                  <select value={current.project_type || ''} onChange={e => setCurrent({ ...current, project_type: e.target.value })}
                    className={inputCls} style={inputStyle}>
                    <option value="">Select Type</option>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="mixed-use">Mixed-Use</option>
                    <option value="villa">Villa Community</option>
                    <option value="townhouse">Townhouse</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Handover Date</label>
                  <input type="text" value={current.handover_date || ''} onChange={e => setCurrent({ ...current, handover_date: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. Q4 2026" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Min Price (AED)</label>
                  <input type="number" value={current.min_price || ''} onChange={e => setCurrent({ ...current, min_price: parseInt(e.target.value) || undefined })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Max Price (AED)</label>
                  <input type="number" value={current.max_price || ''} onChange={e => setCurrent({ ...current, max_price: parseInt(e.target.value) || undefined })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Down Payment %</label>
                  <input type="number" value={current.down_payment_percent || ''} onChange={e => setCurrent({ ...current, down_payment_percent: parseFloat(e.target.value) || undefined })}
                    className={inputCls} style={inputStyle} placeholder="e.g. 20" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Completion %</label>
                  <input type="number" min="0" max="100" value={current.completion_percent || 0} onChange={e => setCurrent({ ...current, completion_percent: parseInt(e.target.value) || 0 })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Total Units</label>
                  <input type="number" value={current.total_units || ''} onChange={e => setCurrent({ ...current, total_units: parseInt(e.target.value) || undefined })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Available Units</label>
                  <input type="number" value={current.available_units || ''} onChange={e => setCurrent({ ...current, available_units: parseInt(e.target.value) || undefined })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Payment Plan</label>
                  <input type="text" value={current.payment_plan || ''} onChange={e => setCurrent({ ...current, payment_plan: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. 60/40, 1% monthly" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Description</label>
                  <textarea rows={3} value={current.description || ''} onChange={e => setCurrent({ ...current, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none resize-none" style={inputStyle} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  {current.id ? 'Update Project' : 'Create Project'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setCurrent(null); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg" style={{ background: '#F3F4F6', color: '#374151' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
