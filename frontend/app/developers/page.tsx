'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Edit2, Trash2, Search, Globe } from 'lucide-react';

interface Developer {
  id: number;
  name: string;
  logo_url?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  description?: string;
  established_year?: number;
  projects_count?: number;
  status?: string;
}

const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

export default function DevelopersPage() {
  const router = useRouter();
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [current, setCurrent] = useState<Partial<Developer> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/developers?limit=200', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setDevelopers(d.developers || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const token = localStorage.getItem('token');
    const method = current.id ? 'PUT' : 'POST';
    const url = current.id ? `/api/developers/${current.id}` : '/api/developers';
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    });
    if (res.ok) { setShowModal(false); setCurrent(null); fetchData(); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this developer?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/developers/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchData();
  };

  const filtered = developers.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Developers</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{filtered.length} developers</p>
            </div>
          </div>
          <button
            onClick={() => { setCurrent({ status: 'active' }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Developer
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Search */}
        <div className="bg-white rounded-xl border p-4 mb-5 flex gap-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
            <input type="text" placeholder="Search developers..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(dev => (
              <div key={dev.id} className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow" style={{ borderColor: '#E5E7EB' }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold" 
                    style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)', color: '#C9A96E' }}>
                    {dev.name.charAt(0)}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setCurrent(dev); setShowModal(true); }}
                      className="p-1.5 rounded-lg" style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F' }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(dev.id)}
                      className="p-1.5 rounded-lg" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-sm mb-1" style={{ color: '#131B2B' }}>{dev.name}</h3>
                {dev.website && (
                  <a href={`https://${dev.website}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs mb-2" style={{ color: '#C9A96E' }}>
                    <Globe className="w-3 h-3" /> {dev.website}
                  </a>
                )}
                {dev.phone && <p className="text-xs mb-1" style={{ color: '#6B7280' }}>{dev.phone}</p>}
                <div className="mt-3 pt-3 border-t" style={{ borderColor: '#F3F4F6' }}>
                  <span className="text-xs font-medium" style={{ color: '#6B7280' }}>
                    {dev.projects_count || 0} projects
                  </span>
                  {dev.established_year && (
                    <span className="text-xs ml-3" style={{ color: '#9CA3AF' }}>Est. {dev.established_year}</span>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-4 text-center py-16" style={{ color: '#9CA3AF' }}>
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No developers found</p>
              </div>
            )}
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
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{current.id ? 'Edit Developer' : 'New Developer'}</h2>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-4">
                {[
                  { label: 'Developer Name *', key: 'name', type: 'text', required: true },
                  { label: 'Website', key: 'website', type: 'text', required: false },
                  { label: 'Phone', key: 'phone', type: 'text', required: false },
                  { label: 'Email', key: 'email', type: 'email', required: false },
                  { label: 'Address', key: 'address', type: 'text', required: false },
                  { label: 'Established Year', key: 'established_year', type: 'number', required: false },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>{f.label}</label>
                    <input type={f.type} required={f.required} value={(current as any)[f.key] || ''}
                      onChange={e => setCurrent({ ...current, [f.key]: e.target.value })}
                      className={inputCls} style={inputStyle} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Description</label>
                  <textarea rows={3} value={current.description || ''} onChange={e => setCurrent({ ...current, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none resize-none" style={inputStyle} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  {current.id ? 'Update' : 'Create'} Developer
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
