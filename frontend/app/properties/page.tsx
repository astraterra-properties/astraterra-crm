'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Edit2, Trash2, Building2, Bed, Bath, Maximize2 } from 'lucide-react';

interface Property {
  id: number;
  property_id: string;
  title: string;
  type: string;
  location: string;
  bedrooms: number;
  bathrooms: number;
  size: number;
  price: number;
  purpose: string;
  status: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  description: string;
  features: string;
  created_at: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  available:    { bg: '#ECFDF5', text: '#065F46' },
  rented:       { bg: '#EFF6FF', text: '#1D4ED8' },
  sold:         { bg: '#F5F3FF', text: '#5B21B6' },
  'off-market': { bg: '#F9FAFB', text: '#6B7280' },
};

const purposeColors: Record<string, { bg: string; text: string }> = {
  sale: { bg: 'rgba(201,169,110,0.12)', text: '#8A6F2F' },
  rent: { bg: '#EFF6FF', text: '#1D4ED8' },
};

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [canAddEdit, setCanAddEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [currentProperty, setCurrentProperty] = useState<Partial<Property> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 50;

  useEffect(() => {
    const _role = localStorage.getItem('userRole') || 'agent';
    const _levels: Record<string,number> = { owner: 4, admin: 3, marketing: 2, agent: 1 };
    setCanAddEdit((_levels[_role] ?? 0) >= (_levels['admin'] ?? 99));
    setCanDelete((_levels[_role] ?? 0) >= (_levels['owner'] ?? 99));
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchProperties(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchProperties(currentPage);
  }, [currentPage]);

  const fetchProperties = async (page: number) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const res = await fetch(`/api/properties?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setProperties(data.properties || data.data || []);
        setTotalCount(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 1);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchProperties(1);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty) return;
    try {
      const token = localStorage.getItem('token');
      const method = currentProperty.id ? 'PUT' : 'POST';
      const url = currentProperty.id ? `/api/properties/${currentProperty.id}` : '/api/properties';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(currentProperty),
      });
      if (res.ok) { setShowModal(false); setCurrentProperty(null); fetchProperties(currentPage); }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this property?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/properties/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchProperties(currentPage);
  };

  // Server-side filtering — no client-side filter needed
  const filtered = properties;

  const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
  const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Properties</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{totalCount.toLocaleString()} listings</p>
            </div>
          </div>
          {canAddEdit && (
          <button
            onClick={() => { setCurrentProperty({ status: 'available', purpose: 'sale', type: 'apartment' }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Property
          </button>
          )}
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
            <input type="text" placeholder="Search by title, location, ID..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none"
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle}>
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="rented">Rented</option>
            <option value="sold">Sold</option>
            <option value="off-market">Off Market</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((property) => {
              const sc = statusColors[property.status] || { bg: '#F9FAFB', text: '#6B7280' };
              const pc = purposeColors[property.purpose] || { bg: '#F9FAFB', text: '#6B7280' };
              return (
                <div
                  key={property.id}
                  className="bg-white rounded-xl border overflow-hidden group"
                  style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
                >
                  {/* Card top strip */}
                  <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #C9A96E, #8A6F2F)' }} />

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{property.property_id}</span>
                      <div className="flex gap-1.5">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: sc.bg, color: sc.text }}>{property.status}</span>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: pc.bg, color: pc.text }}>{property.purpose}</span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold mb-1.5 line-clamp-1" style={{ color: '#131B2B' }}>{property.title}</h3>
                    <p className="text-xs mb-3 flex items-center gap-1" style={{ color: '#6B7280' }}>
                      <span>📍</span> {property.location}
                    </p>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-1">
                        <Bed className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                        <span className="text-xs font-medium" style={{ color: '#374151' }}>{property.bedrooms} BR</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bath className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                        <span className="text-xs font-medium" style={{ color: '#374151' }}>{property.bathrooms} Bath</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                        <span className="text-xs font-medium" style={{ color: '#374151' }}>{property.size?.toLocaleString()} sqft</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xl font-bold" style={{ color: '#C9A96E' }}>
                        AED {property.price?.toLocaleString()}
                        {property.purpose === 'rent' && <span className="text-xs font-normal ml-1" style={{ color: '#9CA3AF' }}>/yr</span>}
                      </p>
                    </div>

                    <div className="pt-3 border-t mb-3" style={{ borderColor: '#F3F4F6' }}>
                      <p className="text-xs font-medium" style={{ color: '#374151' }}>{property.owner_name}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>{property.owner_phone}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setCurrentProperty(property); setShowModal(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg"
                        style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(property.id)}
                        className="flex items-center justify-center px-3 py-2 rounded-lg"
                        style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
                      >
                        <Trash2 className="w-3 h-3" style={{ color: '#DC2626' }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No properties found</p>
            <p className="text-xs mt-1">Add your first property listing</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 bg-white rounded-xl border px-5 py-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Showing {((currentPage - 1) * LIMIT) + 1}–{Math.min(currentPage * LIMIT, totalCount)} of {totalCount.toLocaleString()} properties
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40"
                style={{ background: currentPage === 1 ? '#F3F4F6' : 'rgba(201,169,110,0.1)', color: currentPage === 1 ? '#9CA3AF' : '#8A6F2F', border: '1px solid', borderColor: currentPage === 1 ? '#E5E7EB' : 'rgba(201,169,110,0.3)' }}
              >← Prev</button>
              <span className="text-xs font-medium px-2" style={{ color: '#374151' }}>Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40"
                style={{ background: currentPage === totalPages ? '#F3F4F6' : 'rgba(201,169,110,0.1)', color: currentPage === totalPages ? '#9CA3AF' : '#8A6F2F', border: '1px solid', borderColor: currentPage === totalPages ? '#E5E7EB' : 'rgba(201,169,110,0.3)' }}
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && currentProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{currentProperty.id ? 'Edit Property' : 'New Property'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Property Title *</label>
                  <input type="text" required value={currentProperty.title || ''}
                    onChange={(e) => setCurrentProperty({ ...currentProperty, title: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. Luxury 3BR in Dubai Marina"
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>

                {[
                  { label: 'Type', key: 'type', opts: ['apartment','villa','townhouse','penthouse','commercial','office','retail','studio'] },
                  { label: 'Purpose', key: 'purpose', opts: ['sale','rent'] },
                  { label: 'Status', key: 'status', opts: ['available','rented','sold','off-market'] },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>{f.label}</label>
                    <select value={(currentProperty as any)[f.key] || ''} onChange={(e) => setCurrentProperty({ ...currentProperty, [f.key]: e.target.value })}
                      className={inputCls} style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}>
                      {f.opts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}

                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Location *</label>
                  <input type="text" required value={currentProperty.location || ''}
                    onChange={(e) => setCurrentProperty({ ...currentProperty, location: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. Dubai Marina, Tower A"
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>

                {[
                  { label: 'Bedrooms', key: 'bedrooms', type: 'number' },
                  { label: 'Bathrooms', key: 'bathrooms', type: 'number' },
                  { label: 'Size (sqft)', key: 'size', type: 'number' },
                  { label: 'Price (AED)', key: 'price', type: 'number' },
                  { label: 'Owner Name', key: 'owner_name', type: 'text' },
                  { label: 'Owner Phone', key: 'owner_phone', type: 'text' },
                  { label: 'Owner Email', key: 'owner_email', type: 'email' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>{f.label}</label>
                    <input type={f.type} value={(currentProperty as any)[f.key] || ''}
                      onChange={(e) => setCurrentProperty({ ...currentProperty, [f.key]: f.type === 'number' ? parseFloat(e.target.value) : e.target.value })}
                      className={inputCls} style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                    />
                  </div>
                ))}

                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Features</label>
                  <input type="text" value={currentProperty.features || ''}
                    onChange={(e) => setCurrentProperty({ ...currentProperty, features: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="Pool, Gym, Parking, Balcony..."
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Description</label>
                  <textarea value={currentProperty.description || ''}
                    onChange={(e) => setCurrentProperty({ ...currentProperty, description: e.target.value })}
                    className={inputCls} style={inputStyle} rows={3} placeholder="Property description..."
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  {currentProperty.id ? 'Update Property' : 'Create Property'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setCurrentProperty(null); }}
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
