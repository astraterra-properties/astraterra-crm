'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Home, Bed, Bath, Maximize2, Plus, Edit2, Trash2, Search, X,
  Video, Eye, Image as ImageIcon, Star, Upload, Play, ChevronLeft, ChevronRight,
  RefreshCw, Filter, Globe
} from 'lucide-react';

interface Listing {
  id: number;
  title: string;
  property_type: string;
  community: string;
  location: string;
  bedrooms: number;
  bathrooms: number;
  size_sqft: number;
  annual_rent: number;
  monthly_rent: number;
  security_deposit: number;
  furnished: string;
  floor: number;
  total_floors: number;
  view: string;
  owner_name: string;
  owner_contact: string;
  owner_email: string;
  images: string;
  video_url: string;
  tour_360_url: string;
  amenities: string;
  bayut_id: string;
  pf_id: string;
  dubizzle_id: string;
  description: string;
  status: string;
  featured: number;
  permit_number: string;
  ejari_number: string;
  available_from: string;
  lease_term: string;
  payment_terms: string;
  agent_id: number;
  agent_name: string;
  created_at: string;
}

const PROPERTY_TYPES = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Studio', 'Office', 'Retail', 'Land'];
const STATUS_OPTIONS = ['available', 'rented', 'reserved', 'off_market'];
const BEDROOM_OPTIONS = ['Studio', '1', '2', '3', '4', '5', '6', '7+'];
const FURNISHED_OPTIONS = ['unfurnished', 'furnished', 'semi_furnished'];
const LEASE_TERMS = ['1 year', '2 years', '6 months', '3 months', 'Monthly', 'Flexible'];
const PAYMENT_OPTIONS = ['annual', 'semi_annual', 'quarterly', 'monthly'];

const statusColors: Record<string, { bg: string; text: string }> = {
  available: { bg: '#dcfce7', text: '#166534' },
  rented: { bg: '#dbeafe', text: '#1e40af' },
  reserved: { bg: '#fef9c3', text: '#854d0e' },
  off_market: { bg: '#f3f4f6', text: '#374151' },
};

function formatAED(n: number | null | undefined) {
  if (!n) return 'AED 0';
  return 'AED ' + Number(n).toLocaleString('en-US');
}

function parseImages(img: string | null | undefined): string[] {
  if (!img) return [];
  try { const p = JSON.parse(img); return Array.isArray(p) ? p : []; } catch { return []; }
}

const emptyForm = {
  title: '', property_type: 'Apartment', community: '', location: '',
  bedrooms: 0, bathrooms: 0, size_sqft: 0, annual_rent: 0, monthly_rent: 0,
  security_deposit: 0, floor: 0, total_floors: 0, view: '', furnished: 'unfurnished',
  owner_name: '', owner_contact: '', owner_email: '',
  permit_number: '', ejari_number: '', bayut_id: '', pf_id: '', dubizzle_id: '',
  description: '', status: 'available', featured: 0,
  video_url: '', tour_360_url: '', images: '[]',
  available_from: '', lease_term: '1 year', payment_terms: 'annual',
};

export default function RentListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBeds, setFilterBeds] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [formImages, setFormImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [mediaViewer, setMediaViewer] = useState<Listing | null>(null);
  const [mediaIdx, setMediaIdx] = useState(0);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rent-listings?limit=500', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setListings(data.listings || []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const filtered = listings.filter(l => {
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!(l.title || '').toLowerCase().includes(q) && !(l.community || '').toLowerCase().includes(q) && !(l.location || '').toLowerCase().includes(q)) return false;
    }
    if (filterType && l.property_type !== filterType) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    if (filterBeds) {
      if (filterBeds === 'Studio' && l.bedrooms !== 0) return false;
      else if (filterBeds === '7+' && l.bedrooms < 7) return false;
      else if (filterBeds !== 'Studio' && filterBeds !== '7+' && l.bedrooms !== parseInt(filterBeds)) return false;
    }
    return true;
  });

  const stats = {
    total: listings.length,
    available: listings.filter(l => l.status === 'available').length,
    rented: listings.filter(l => l.status === 'rented').length,
    reserved: listings.filter(l => l.status === 'reserved').length,
  };

  const openAdd = () => { setEditId(null); setForm({ ...emptyForm }); setFormImages([]); setShowModal(true); };
  const openEdit = (l: Listing) => {
    setEditId(l.id);
    setForm({
      title: l.title || '', property_type: l.property_type || 'Apartment', community: l.community || '',
      location: l.location || '', bedrooms: l.bedrooms || 0, bathrooms: l.bathrooms || 0,
      size_sqft: l.size_sqft || 0, annual_rent: l.annual_rent || 0, monthly_rent: l.monthly_rent || 0,
      security_deposit: l.security_deposit || 0,
      floor: l.floor || 0, total_floors: l.total_floors || 0, view: l.view || '',
      furnished: l.furnished || 'unfurnished', owner_name: l.owner_name || '',
      owner_contact: l.owner_contact || '', owner_email: l.owner_email || '',
      permit_number: l.permit_number || '', ejari_number: l.ejari_number || '',
      bayut_id: l.bayut_id || '', pf_id: l.pf_id || '', dubizzle_id: l.dubizzle_id || '',
      description: l.description || '', status: l.status || 'available', featured: l.featured || 0,
      video_url: l.video_url || '', tour_360_url: l.tour_360_url || '',
      available_from: l.available_from || '', lease_term: l.lease_term || '1 year',
      payment_terms: l.payment_terms || 'annual',
    });
    setFormImages(parseImages(l.images));
    setShowModal(true);
  };

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.append('file', files[i]);
      try {
        const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
        if (res.ok) { const d = await res.json(); setFormImages(prev => [...prev, d.url]); }
      } catch {}
    }
    setUploading(false);
  };

  const removeImage = (idx: number) => setFormImages(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    const body = { ...form, images: JSON.stringify(formImages) };
    try {
      const url = editId ? `/api/rent-listings/${editId}` : '/api/rent-listings';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Save failed'); }
      setShowModal(false);
      fetchListings();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await fetch(`/api/rent-listings/${deleteId}`, { method: 'DELETE', headers });
      setDeleteId(null);
      fetchListings();
    } catch { alert('Delete failed'); }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 bg-white";

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: '#f8fafc' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0a1628' }}>Rent Listings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage rental properties</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchListings} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: '#d4af37' }}>
            <Plus className="w-4 h-4" /> Add Listing
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: '#0a1628' },
          { label: 'Available', value: stats.available, color: '#166534' },
          { label: 'Rented', value: stats.rented, color: '#1e40af' },
          { label: 'Reserved', value: stats.reserved, color: '#854d0e' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search listings..." className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none">
            <option value="">All Types</option>
            {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none">
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>)}
          </select>
          <select value={filterBeds} onChange={e => setFilterBeds(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none">
            <option value="">All Bedrooms</option>
            {BEDROOM_OPTIONS.map(b => <option key={b} value={b}>{b === 'Studio' ? 'Studio' : `${b} Bed`}</option>)}
          </select>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && <div className="text-center py-20"><div className="inline-block w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#d4af37' }}></div><p className="mt-3 text-gray-500">Loading listings...</p></div>}
      {error && <div className="text-center py-20 text-red-500">{error}</div>}

      {/* Cards Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 && <div className="col-span-full text-center py-16 text-gray-400">No listings found</div>}
          {filtered.map(l => {
            const imgs = parseImages(l.images);
            const sc = statusColors[l.status] || statusColors.available;
            return (
              <div key={l.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Hero Image */}
                <div className="relative h-48 bg-gray-100">
                  {imgs.length > 0 ? (
                    <img src={imgs[0]} alt={l.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Building2 className="w-12 h-12 text-gray-300" /></div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: sc.bg, color: sc.text }}>{l.status}</span>
                    {l.property_type && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 text-gray-700">{l.property_type}</span>}
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    {imgs.length > 0 && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-black/60 text-white"><ImageIcon className="w-3 h-3" />{imgs.length}</span>}
                    {l.video_url && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-black/60 text-white"><Video className="w-3 h-3" /></span>}
                    {l.tour_360_url && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-black/60 text-white"><Globe className="w-3 h-3" />360°</span>}
                  </div>
                  {l.featured === 1 && <div className="absolute bottom-2 left-2"><Star className="w-5 h-5 fill-amber-400 text-amber-400" /></div>}
                </div>
                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-sm truncate" style={{ color: '#0a1628' }}>{l.title || 'Untitled'}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{[l.community, l.location].filter(Boolean).join(', ') || '—'}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{l.bedrooms ?? 0}</span>
                    <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{l.bathrooms ?? 0}</span>
                    <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" />{l.size_sqft ? `${Number(l.size_sqft).toLocaleString()} sqft` : '—'}</span>
                  </div>
                  <div className="mt-2">
                    <p className="text-lg font-bold" style={{ color: '#d4af37' }}>{formatAED(l.annual_rent)}<span className="text-xs font-normal text-gray-400">/yr</span></p>
                    {l.monthly_rent > 0 && <p className="text-xs text-gray-500">{formatAED(l.monthly_rent)}/mo</p>}
                  </div>
                  {l.agent_name && <p className="text-xs text-gray-400 mt-1">Agent: {l.agent_name}</p>}
                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => openEdit(l)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-600">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => setDeleteId(l.id)} className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 hover:bg-red-50 text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {(imgs.length > 0 || l.video_url || l.tour_360_url) && (
                      <button onClick={() => { setMediaViewer(l); setMediaIdx(0); }} className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 hover:bg-blue-50 text-blue-500">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between p-5 border-b" style={{ background: '#0a1628', borderRadius: '16px 16px 0 0' }}>
              <h2 className="text-lg font-bold text-white">{editId ? 'Edit Listing' : 'New Rent Listing'}</h2>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2"><label className="text-xs text-gray-500">Title *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Property Type</label><select value={form.property_type} onChange={e => setForm({ ...form, property_type: e.target.value })} className={inputClass}>{PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Community</label><input value={form.community} onChange={e => setForm({ ...form, community: e.target.value })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={inputClass} /></div>
                </div>
              </div>
              {/* Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Property Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className="text-xs text-gray-500">Bedrooms</label><input type="number" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: parseInt(e.target.value) || 0 })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Bathrooms</label><input type="number" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: parseInt(e.target.value) || 0 })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Size (sqft)</label><input type="number" value={form.size_sqft} onChange={e => setForm({ ...form, size_sqft: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Furnished</label><select value={form.furnished} onChange={e => setForm({ ...form, furnished: e.target.value })} className={inputClass}>{FURNISHED_OPTIONS.map(f => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Floor</label><input type="number" value={form.floor} onChange={e => setForm({ ...form, floor: parseInt(e.target.value) || 0 })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Total Floors</label><input type="number" value={form.total_floors} onChange={e => setForm({ ...form, total_floors: parseInt(e.target.value) || 0 })} className={inputClass} /></div>
                </div>
                <div className="mt-3"><label className="text-xs text-gray-500">View</label><input value={form.view} onChange={e => setForm({ ...form, view: e.target.value })} className={inputClass} placeholder="Sea view, City view, etc." /></div>
              </div>
              {/* Rental Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Rental Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className="text-xs text-gray-500">Annual Rent (AED)</label><input type="number" value={form.annual_rent} onChange={e => setForm({ ...form, annual_rent: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Monthly Rent (AED)</label><input type="number" value={form.monthly_rent} onChange={e => setForm({ ...form, monthly_rent: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Security Deposit</label><input type="number" value={form.security_deposit} onChange={e => setForm({ ...form, security_deposit: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Available From</label><input type="date" value={form.available_from} onChange={e => setForm({ ...form, available_from: e.target.value })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Lease Term</label><select value={form.lease_term} onChange={e => setForm({ ...form, lease_term: e.target.value })} className={inputClass}>{LEASE_TERMS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Payment Terms</label><select value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} className={inputClass}>{PAYMENT_OPTIONS.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Ejari #</label><input value={form.ejari_number} onChange={e => setForm({ ...form, ejari_number: e.target.value })} className={inputClass} /></div>
                </div>
              </div>
              {/* Owner */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Owner Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label className="text-xs text-gray-500">Owner Name</label><input value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Owner Contact</label><input value={form.owner_contact} onChange={e => setForm({ ...form, owner_contact: e.target.value })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Owner Email</label><input value={form.owner_email} onChange={e => setForm({ ...form, owner_email: e.target.value })} className={inputClass} /></div>
                </div>
              </div>
              {/* Portal IDs */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Portal & Permits</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className="text-xs text-gray-500">Permit #</label><input value={form.permit_number} onChange={e => setForm({ ...form, permit_number: e.target.value })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Bayut ID</label><input value={form.bayut_id} onChange={e => setForm({ ...form, bayut_id: e.target.value })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">PF ID</label><input value={form.pf_id} onChange={e => setForm({ ...form, pf_id: e.target.value })} className={inputClass} /></div>
                  <div><label className="text-xs text-gray-500">Dubizzle ID</label><input value={form.dubizzle_id} onChange={e => setForm({ ...form, dubizzle_id: e.target.value })} className={inputClass} /></div>
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="text-xs text-gray-500">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className={inputClass} />
              </div>
              {/* Featured */}
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.featured === 1} onChange={e => setForm({ ...form, featured: e.target.checked ? 1 : 0 })} className="rounded" />
                <label className="text-sm text-gray-700 flex items-center gap-1"><Star className="w-4 h-4 text-amber-400" /> Featured Listing</label>
              </div>
              {/* Media */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Media</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div><label className="text-xs text-gray-500">Video URL</label><input value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} className={inputClass} placeholder="YouTube or video link" /></div>
                  <div><label className="text-xs text-gray-500">360° Tour URL</label><input value={form.tour_360_url} onChange={e => setForm({ ...form, tour_360_url: e.target.value })} className={inputClass} placeholder="Virtual tour link" /></div>
                </div>
                <label className="text-xs text-gray-500">Images</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {formImages.map((img, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-amber-400 transition-colors">
                    {uploading ? <div className="w-5 h-5 border-2 border-gray-300 border-t-amber-400 rounded-full animate-spin"></div> : <><Upload className="w-5 h-5 text-gray-400" /><span className="text-[10px] text-gray-400 mt-0.5">Upload</span></>}
                    <input type="file" multiple accept="image/*" className="hidden" onChange={e => e.target.files && handleUpload(e.target.files)} />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#d4af37' }}>{saving ? 'Saving...' : editId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Delete Listing?</h3>
            <p className="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Media Viewer Modal */}
      {mediaViewer && (() => {
        const imgs = parseImages(mediaViewer.images);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b" style={{ background: '#0a1628' }}>
                <h2 className="text-white font-semibold">Media — {mediaViewer.title}</h2>
                <div className="flex items-center gap-2">
                  {mediaViewer.video_url && (
                    <a href={mediaViewer.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600"><Play className="w-3.5 h-3.5" /> Video</a>
                  )}
                  {mediaViewer.tour_360_url && (
                    <a href={mediaViewer.tour_360_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600"><Globe className="w-3.5 h-3.5" /> 360°</a>
                  )}
                  <button onClick={() => setMediaViewer(null)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
              </div>
              {imgs.length > 0 ? (
                <div className="p-4">
                  <div className="relative rounded-xl overflow-hidden bg-gray-100" style={{ height: '400px' }}>
                    <img src={imgs[mediaIdx]} alt="" className="w-full h-full object-contain" />
                    {imgs.length > 1 && (
                      <>
                        <button onClick={() => setMediaIdx(i => (i - 1 + imgs.length) % imgs.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"><ChevronLeft className="w-5 h-5" /></button>
                        <button onClick={() => setMediaIdx(i => (i + 1) % imgs.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"><ChevronRight className="w-5 h-5" /></button>
                      </>
                    )}
                  </div>
                  {imgs.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                      {imgs.map((img, i) => (
                        <button key={i} onClick={() => setMediaIdx(i)} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors" style={{ borderColor: i === mediaIdx ? '#d4af37' : 'transparent' }}>
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400">No images</div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
