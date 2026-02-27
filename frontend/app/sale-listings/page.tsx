'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, Plus, Edit2, Trash2, Search } from 'lucide-react';

interface Listing {
  id: number;
  title: string;
  property_type?: string;
  community?: string;
  location?: string;
  bedrooms?: number;
  bathrooms?: number;
  size_sqft?: number;
  price?: number;
  price_per_sqft?: number;
  furnished?: string;
  status?: string;
  featured?: number;
  portal_status?: string;
  bayut_id?: string;
  pf_id?: string;
  dubizzle_id?: string;
  permit_number?: string;
  description?: string;
}

const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

const statusColors: Record<string, { bg: string; text: string }> = {
  available: { bg: '#ECFDF5', text: '#065F46' },
  reserved: { bg: '#FFFBEB', text: '#92400E' },
  sold: { bg: '#EFF6FF', text: '#1D4ED8' },
  off_market: { bg: '#F9FAFB', text: '#6B7280' },
};

const PortalBadge = ({ label, connected }: { label: string; connected: boolean }) => (
  <span className="px-1.5 py-0.5 text-xs rounded font-medium"
    style={{ background: connected ? '#ECFDF5' : '#F3F4F6', color: connected ? '#065F46' : '#9CA3AF' }}>
    {label}
  </span>
);

export default function SaleListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [bedsFilter, setBedsFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [current, setCurrent] = useState<Partial<Listing> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchData();
  }, [typeFilter, statusFilter, bedsFilter]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    let url = '/api/sale-listings?limit=100';
    if (typeFilter) url += `&property_type=${typeFilter}`;
    if (statusFilter) url += `&status=${statusFilter}`;
    if (bedsFilter) url += `&bedrooms=${bedsFilter}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setListings(d.listings || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const token = localStorage.getItem('token');
    const method = current.id ? 'PUT' : 'POST';
    const url = current.id ? `/api/sale-listings/${current.id}` : '/api/sale-listings';
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    });
    if (res.ok) { setShowModal(false); setCurrent(null); fetchData(); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this listing?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/sale-listings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchData();
  };

  const filtered = listings.filter(l =>
    (l.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.community || '').toLowerCase().includes(search.toLowerCase())
  );

  const getPortalStatus = (listing: Listing) => {
    try {
      const ps = listing.portal_status ? JSON.parse(listing.portal_status) : {};
      return {
        bayut: !!(listing.bayut_id || ps.bayut),
        pf: !!(listing.pf_id || ps.property_finder),
        dubizzle: !!(listing.dubizzle_id || ps.dubizzle),
      };
    } catch { return { bayut: false, pf: false, dubizzle: false }; }
  };

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Sale Listings</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{filtered.length} listings</p>
            </div>
          </div>
          <button
            onClick={() => { setCurrent({ status: 'available', furnished: 'unfurnished' }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Listing
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
            <input type="text" placeholder="Search listings..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle} />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3.5 py-2.5 text-sm border rounded-lg" style={inputStyle}>
            <option value="">All Types</option>
            <option value="apartment">Apartment</option>
            <option value="villa">Villa</option>
            <option value="townhouse">Townhouse</option>
            <option value="penthouse">Penthouse</option>
            <option value="commercial">Commercial</option>
            <option value="office">Office</option>
            <option value="retail">Retail</option>
            <option value="studio">Studio</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3.5 py-2.5 text-sm border rounded-lg" style={inputStyle}>
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
            <option value="off_market">Off Market</option>
          </select>
          <select value={bedsFilter} onChange={e => setBedsFilter(e.target.value)} className="px-3.5 py-2.5 text-sm border rounded-lg" style={inputStyle}>
            <option value="">All Beds</option>
            <option value="0">Studio</option>
            <option value="1">1 Bed</option>
            <option value="2">2 Beds</option>
            <option value="3">3 Beds</option>
            <option value="4">4 Beds</option>
            <option value="5">5+ Beds</option>
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
                    {['Title', 'Type', 'Community', 'Beds', 'Size', 'Price', 'Status', 'Portals', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l, i) => {
                    const sc = statusColors[l.status || 'available'] || { bg: '#F9FAFB', text: '#6B7280' };
                    const portals = getPortalStatus(l);
                    return (
                      <tr key={l.id}
                        style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF9F0'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFBFC'; }}
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{l.title}</p>
                          {l.permit_number && <p className="text-xs" style={{ color: '#9CA3AF' }}>Permit: {l.permit_number}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-sm capitalize" style={{ color: '#374151' }}>{l.property_type || '—'}</td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>{l.community || '—'}</td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>{l.bedrooms === 0 ? 'Studio' : l.bedrooms ? `${l.bedrooms} BR` : '—'}</td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: '#374151' }}>{l.size_sqft ? `${l.size_sqft.toLocaleString()} sqft` : '—'}</td>
                        <td className="px-5 py-3.5 text-sm font-medium" style={{ color: '#C9A96E' }}>
                          {l.price ? `AED ${(l.price / 1000000).toFixed(2)}M` : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: sc.bg, color: sc.text }}>
                            {l.status || 'available'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-1">
                            <PortalBadge label="Bayut" connected={portals.bayut} />
                            <PortalBadge label="PF" connected={portals.pf} />
                            <PortalBadge label="DZ" connected={portals.dubizzle} />
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setCurrent(l); setShowModal(true); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                              style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => handleDelete(l.id)}
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
                  <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No sale listings found</p>
                  <p className="text-xs mt-1">Add your first listing to get started</p>
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
                  <Home className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{current.id ? 'Edit Listing' : 'New Sale Listing'}</h2>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Title *</label>
                  <input type="text" required value={current.title || ''} onChange={e => setCurrent({ ...current, title: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. Spacious 2BR Apartment in Dubai Marina" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Property Type</label>
                  <select value={current.property_type || ''} onChange={e => setCurrent({ ...current, property_type: e.target.value })}
                    className={inputCls} style={inputStyle}>
                    <option value="">Select Type</option>
                    {['apartment','villa','townhouse','penthouse','commercial','office','retail','studio','warehouse'].map(t => (
                      <option key={t} value={t} className="capitalize">{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Community</label>
                  <input type="text" value={current.community || ''} onChange={e => setCurrent({ ...current, community: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. Dubai Marina" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Bedrooms</label>
                  <select value={current.bedrooms ?? ''} onChange={e => setCurrent({ ...current, bedrooms: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                    className={inputCls} style={inputStyle}>
                    <option value="">Select</option>
                    <option value="0">Studio</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Bathrooms</label>
                  <select value={current.bathrooms ?? ''} onChange={e => setCurrent({ ...current, bathrooms: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                    className={inputCls} style={inputStyle}>
                    <option value="">Select</option>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Size (sqft)</label>
                  <input type="number" value={current.size_sqft || ''} onChange={e => setCurrent({ ...current, size_sqft: parseInt(e.target.value) || undefined })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Price (AED)</label>
                  <input type="number" value={current.price || ''} onChange={e => setCurrent({ ...current, price: parseInt(e.target.value) || undefined })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Furnished</label>
                  <select value={current.furnished || 'unfurnished'} onChange={e => setCurrent({ ...current, furnished: e.target.value })}
                    className={inputCls} style={inputStyle}>
                    <option value="unfurnished">Unfurnished</option>
                    <option value="furnished">Furnished</option>
                    <option value="semi-furnished">Semi-Furnished</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Status</label>
                  <select value={current.status || 'available'} onChange={e => setCurrent({ ...current, status: e.target.value })}
                    className={inputCls} style={inputStyle}>
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="sold">Sold</option>
                    <option value="off_market">Off Market</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Permit Number</label>
                  <input type="text" value={current.permit_number || ''} onChange={e => setCurrent({ ...current, permit_number: e.target.value })}
                    className={inputCls} style={inputStyle} />
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
                  {current.id ? 'Update Listing' : 'Create Listing'}
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
