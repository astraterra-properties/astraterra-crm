'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, Edit2, Trash2, Search } from 'lucide-react';

interface Community {
  id: number;
  name: string;
  area?: string;
  city?: string;
  description?: string;
  avg_price_sqft?: number;
  popular_for?: string;
  amenities?: string;
  image_url?: string;
  status?: string;
}

const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

export default function CommunitiesPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [current, setCurrent] = useState<Partial<Community> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/communities?limit=200', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setCommunities(d.communities || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const token = localStorage.getItem('token');
    const method = current.id ? 'PUT' : 'POST';
    const url = current.id ? `/api/communities/${current.id}` : '/api/communities';
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    });
    if (res.ok) { setShowModal(false); setCurrent(null); fetchData(); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this community?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/communities/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchData();
  };

  const filtered = communities.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.area || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Areas & Communities</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{filtered.length} communities</p>
            </div>
          </div>
          <button
            onClick={() => { setCurrent({ city: 'Dubai', status: 'active' }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Community
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="bg-white rounded-xl border p-4 mb-5" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
            <input type="text" placeholder="Search communities..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle} />
          </div>
        </div>

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
                    {['Community', 'Area', 'City', 'Avg Price/sqft', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id}
                      style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF9F0'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFBFC'; }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: '#C9A96E' }} />
                          <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{c.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>{c.area || '—'}</td>
                      <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>{c.city || 'Dubai'}</td>
                      <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>
                        {c.avg_price_sqft ? `AED ${c.avg_price_sqft.toLocaleString()}/sqft` : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full"
                          style={{ background: c.status === 'active' ? '#ECFDF5' : '#F9FAFB', color: c.status === 'active' ? '#065F46' : '#6B7280' }}>
                          {c.status || 'active'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setCurrent(c); setShowModal(true); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                            style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={() => handleDelete(c.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                            style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
                  <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No communities found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && current && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{current.id ? 'Edit Community' : 'New Community'}</h2>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Community Name *</label>
                  <input type="text" required value={current.name || ''} onChange={e => setCurrent({ ...current, name: e.target.value })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Area</label>
                    <input type="text" value={current.area || ''} onChange={e => setCurrent({ ...current, area: e.target.value })}
                      className={inputCls} style={inputStyle} placeholder="e.g. New Dubai" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>City</label>
                    <input type="text" value={current.city || 'Dubai'} onChange={e => setCurrent({ ...current, city: e.target.value })}
                      className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Avg Price per sqft (AED)</label>
                  <input type="number" value={current.avg_price_sqft || ''} onChange={e => setCurrent({ ...current, avg_price_sqft: parseInt(e.target.value) || undefined })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Description</label>
                  <textarea rows={3} value={current.description || ''} onChange={e => setCurrent({ ...current, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none resize-none" style={inputStyle} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  {current.id ? 'Update' : 'Create'} Community
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
