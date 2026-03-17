'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://crm.astraterra.ae/api';
const NAVY = '#0a1628';
const GOLD = '#d4af37';
const PROPERTY_TYPES = ['Apartment','Villa','Townhouse','Penthouse','Studio','Office','Retail','Land'];
const BED_OPTIONS = ['Studio','1','2','3','4','5+'];

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface Owner {
  id: number;
  full_name: string;
  phone?: string;
  email?: string;
  nationality?: string;
  building?: string;
  area?: string;
  unit_number?: string;
  property_type?: string;
  bedrooms?: number;
  notes?: string;
  visibility?: string;
  assigned_areas?: string;
  assigned_buildings?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Add/Edit Modal ───
function OwnerModal({ owner, onClose, onSave, filterOptions }: {
  owner: Owner | null;
  onClose: () => void;
  onSave: (data: any) => void;
  filterOptions: { buildings: string[]; areas: string[] };
}) {
  const [form, setForm] = useState({
    full_name: owner?.full_name || '',
    phone: owner?.phone || '',
    email: owner?.email || '',
    nationality: owner?.nationality || '',
    building: owner?.building || '',
    area: owner?.area || '',
    unit_number: owner?.unit_number || '',
    property_type: owner?.property_type || '',
    bedrooms: owner?.bedrooms ?? '',
    notes: owner?.notes || '',
    visibility: owner?.visibility || 'all',
    assigned_areas: owner?.assigned_areas ? (typeof owner.assigned_areas === 'string' ? JSON.parse(owner.assigned_areas || '[]') : owner.assigned_areas) : [],
    assigned_buildings: owner?.assigned_buildings ? (typeof owner.assigned_buildings === 'string' ? JSON.parse(owner.assigned_buildings || '[]') : owner.assigned_buildings) : [],
  });

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const submit = () => {
    if (!form.full_name.trim()) return alert('Full Name is required');
    onSave({
      ...form,
      bedrooms: form.bedrooms === '' ? null : Number(form.bedrooms),
      assigned_areas: JSON.stringify(form.assigned_areas),
      assigned_buildings: JSON.stringify(form.assigned_buildings),
    });
  };

  const toggleArr = (key: string, val: string) => {
    const arr = (form as any)[key] as string[];
    set(key, arr.includes(val) ? arr.filter((x: string) => x !== val) : [...arr, val]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: NAVY, border: `1px solid ${GOLD}33` }} onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4" style={{ color: GOLD }}>{owner ? 'Edit Owner' : 'Add Owner'}</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['full_name', 'Full Name *', 'text'],
            ['phone', 'Phone', 'text'],
            ['email', 'Email', 'email'],
            ['nationality', 'Nationality', 'text'],
            ['building', 'Building', 'text'],
            ['area', 'Area', 'text'],
            ['unit_number', 'Unit Number', 'text'],
          ].map(([k, label, type]) => (
            <div key={k}>
              <label className="text-xs text-gray-400 mb-1 block">{label}</label>
              <input type={type} value={(form as any)[k]} onChange={e => set(k, e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:border-amber-500 outline-none" />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Property Type</label>
            <select value={form.property_type} onChange={e => set('property_type', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:border-amber-500 outline-none">
              <option value="">—</option>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Bedrooms</label>
            <input type="number" min={0} value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:border-amber-500 outline-none" />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs text-gray-400 mb-1 block">Notes</label>
          <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:border-amber-500 outline-none" />
        </div>

        {/* Visibility */}
        <div className="mt-4 p-3 rounded-lg bg-white/5">
          <label className="text-xs text-gray-400 mb-2 block">Share with</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input type="radio" checked={form.visibility === 'all'} onChange={() => set('visibility', 'all')} /> All Agents
            </label>
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input type="radio" checked={form.visibility === 'restricted'} onChange={() => set('visibility', 'restricted')} /> Restricted
            </label>
          </div>
          {form.visibility === 'restricted' && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">By Area</label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {filterOptions.areas.map(a => (
                    <label key={a} className="flex items-center gap-2 text-xs text-white cursor-pointer">
                      <input type="checkbox" checked={(form.assigned_areas as string[]).includes(a)} onChange={() => toggleArr('assigned_areas', a)} /> {a}
                    </label>
                  ))}
                  {!filterOptions.areas.length && <span className="text-xs text-gray-500">No areas yet</span>}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">By Building</label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {filterOptions.buildings.map(b => (
                    <label key={b} className="flex items-center gap-2 text-xs text-white cursor-pointer">
                      <input type="checkbox" checked={(form.assigned_buildings as string[]).includes(b)} onChange={() => toggleArr('assigned_buildings', b)} /> {b}
                    </label>
                  ))}
                  {!filterOptions.buildings.length && <span className="text-xs text-gray-500">No buildings yet</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 bg-white/10 hover:bg-white/20">Cancel</button>
          <button onClick={submit} className="px-4 py-2 rounded-lg text-sm font-semibold text-black" style={{ background: GOLD }}>
            {owner ? 'Save Changes' : 'Add Owner'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Import Modal ───
function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const parse = () => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const parsed = lines.map(line => {
      const parts = line.split('|').map(s => s.trim());
      return {
        full_name: parts[0] || '',
        phone: parts[1] || '',
        email: parts[2] || '',
        building: parts[3] || '',
        area: parts[4] || '',
        unit_number: parts[5] || '',
        property_type: parts[6] || '',
        bedrooms: parts[7] ? parseInt(parts[7]) : null,
      };
    }).filter(o => o.full_name);
    setPreview(parsed);
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const res = await fetch(`${API}/owner-database/bulk-import`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify({ owners: preview }),
      });
      const data = await res.json();
      setResult(data);
      if (data.imported > 0) onImported();
    } catch { setResult({ imported: 0, errors: ['Network error'] }); }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ background: NAVY, border: `1px solid ${GOLD}33` }} onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-2" style={{ color: GOLD }}>Bulk Import Owners</h2>
        <p className="text-xs text-gray-400 mb-3">Format: <code className="text-amber-300">Name | Phone | Email | Building | Area | Unit | Type | Bedrooms</code> (one per line)</p>
        <textarea rows={8} value={text} onChange={e => setText(e.target.value)} placeholder="John Doe | +971501234567 | john@email.com | Marina Tower | Dubai Marina | 1204 | Apartment | 2"
          className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:border-amber-500 outline-none font-mono" />
        <div className="flex gap-3 mt-3">
          <button onClick={parse} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-white/10 hover:bg-white/20">Preview</button>
          {preview.length > 0 && !result && (
            <button onClick={doImport} disabled={importing} className="px-4 py-2 rounded-lg text-sm font-semibold text-black" style={{ background: GOLD }}>
              {importing ? 'Importing...' : `Import ${preview.length} Owners`}
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 bg-white/10 hover:bg-white/20 ml-auto">Close</button>
        </div>
        {preview.length > 0 && !result && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs text-white">
              <thead><tr className="border-b border-white/10">
                {['Name','Phone','Email','Building','Area','Unit','Type','Beds'].map(h => <th key={h} className="text-left py-2 px-2 text-gray-400">{h}</th>)}
              </tr></thead>
              <tbody>
                {preview.map((o, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-1 px-2">{o.full_name}</td><td className="py-1 px-2">{o.phone}</td>
                    <td className="py-1 px-2">{o.email}</td><td className="py-1 px-2">{o.building}</td>
                    <td className="py-1 px-2">{o.area}</td><td className="py-1 px-2">{o.unit_number}</td>
                    <td className="py-1 px-2">{o.property_type}</td><td className="py-1 px-2">{o.bedrooms ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && (
          <div className="mt-4 p-3 rounded-lg bg-white/5">
            <p className="text-sm text-green-400">✅ Imported {result.imported} owners</p>
            {result.errors.length > 0 && <div className="mt-2 text-xs text-red-400">{result.errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function OwnerDatabasePage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<{ buildings: string[]; areas: string[] }>({ buildings: [], areas: [] });
  const [search, setSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [bedFilter, setBedFilter] = useState('');
  const [sortField, setSortField] = useState<'full_name' | 'building' | 'area'>('full_name');
  const [sortAsc, setSortAsc] = useState(true);
  const [editOwner, setEditOwner] = useState<Owner | null | 'new'>(null);
  const [showImport, setShowImport] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (buildingFilter) params.set('building', buildingFilter);
      if (areaFilter) params.set('area', areaFilter);
      if (typeFilter) params.set('property_type', typeFilter);
      if (bedFilter) params.set('bedrooms', bedFilter === 'Studio' ? '0' : bedFilter === '5+' ? '5' : bedFilter);
      const res = await fetch(`${API}/owner-database?${params}`, { headers: getHeaders() });
      const data = await res.json();
      setOwners(data.owners || []);
      setTotal(data.total || 0);
    } catch { setOwners([]); }
    setLoading(false);
  }, [search, buildingFilter, areaFilter, typeFilter, bedFilter]);

  const fetchFilterOptions = async () => {
    try {
      const res = await fetch(`${API}/owner-database/filter-options`, { headers: getHeaders() });
      const data = await res.json();
      setFilterOptions({
        buildings: Array.isArray(data?.buildings) ? data.buildings : [],
        areas: Array.isArray(data?.areas) ? data.areas : [],
      });
    } catch {
      setFilterOptions({ buildings: [], areas: [] });
    }
  };

  useEffect(() => { fetchOwners(); }, [fetchOwners]);
  useEffect(() => { fetchFilterOptions(); }, []);

  const handleSave = async (data: any) => {
    const isEdit = editOwner && editOwner !== 'new' && (editOwner as Owner).id;
    const url = isEdit ? `${API}/owner-database/${(editOwner as Owner).id}` : `${API}/owner-database`;
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(data) });
      if (res.ok) { setEditOwner(null); fetchOwners(); fetchFilterOptions(); }
      else { const err = await res.json(); alert(err.error || 'Failed'); }
    } catch { alert('Network error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this owner?')) return;
    setDeleting(id);
    try {
      await fetch(`${API}/owner-database/${id}`, { method: 'DELETE', headers: getHeaders() });
      fetchOwners(); fetchFilterOptions();
    } catch {}
    setDeleting(null);
  };

  const sorted = useMemo(() => {
    return [...owners].sort((a, b) => {
      const av = ((a as any)[sortField] || '').toLowerCase();
      const bv = ((b as any)[sortField] || '').toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [owners, sortField, sortAsc]);

  const toggleSort = (field: 'full_name' | 'building' | 'area') => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  // Stats
  const thisMonth = owners.filter(o => {
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const filteredBuildingCount = buildingFilter ? owners.length : 0;
  const filteredAreaCount = areaFilter ? owners.length : 0;

  const SortIcon = ({ field }: { field: string }) => (
    <span className="ml-1 text-xs">{sortField === field ? (sortAsc ? '▲' : '▼') : '⇅'}</span>
  );

  return (
    <div className="min-h-screen p-6" style={{ background: NAVY, color: '#fff' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: GOLD }}>Owner Database</h1>
        <div className="flex gap-3">
          <button onClick={() => setShowImport(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-white/10 hover:bg-white/20 flex items-center gap-2">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import
          </button>
          <button onClick={() => setEditOwner('new')} className="px-4 py-2 rounded-lg text-sm font-semibold text-black flex items-center gap-2" style={{ background: GOLD }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Owner
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Owners', value: total, color: GOLD },
          { label: 'This Building', value: buildingFilter ? filteredBuildingCount : '—', color: '#60a5fa' },
          { label: 'This Area', value: areaFilter ? filteredAreaCount : '—', color: '#34d399' },
          { label: 'Added This Month', value: thisMonth, color: '#f472b6' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl p-4 border" style={{ background: `${NAVY}`, borderColor: `${s.color}33` }}>
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" placeholder="Search name, phone, email, unit..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 focus:border-amber-500 outline-none w-64" />
        <select value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 outline-none">
          <option value="">All Buildings</option>
          {filterOptions.buildings.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 outline-none">
          <option value="">All Areas</option>
          {filterOptions.areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 outline-none">
          <option value="">All Types</option>
          {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={bedFilter} onChange={e => setBedFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 outline-none">
          <option value="">All Beds</option>
          {BED_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: `${GOLD}22` }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: `${GOLD}22`, background: `${GOLD}0a` }}>
              <th className="text-left py-3 px-3 text-gray-400 cursor-pointer select-none" onClick={() => toggleSort('full_name')}>Name <SortIcon field="full_name" /></th>
              <th className="text-left py-3 px-3 text-gray-400">Phone</th>
              <th className="text-left py-3 px-3 text-gray-400">Email</th>
              <th className="text-left py-3 px-3 text-gray-400">Nationality</th>
              <th className="text-left py-3 px-3 text-gray-400 cursor-pointer select-none" onClick={() => toggleSort('building')}>Building <SortIcon field="building" /></th>
              <th className="text-left py-3 px-3 text-gray-400 cursor-pointer select-none" onClick={() => toggleSort('area')}>Area <SortIcon field="area" /></th>
              <th className="text-left py-3 px-3 text-gray-400">Unit</th>
              <th className="text-left py-3 px-3 text-gray-400">Type</th>
              <th className="text-left py-3 px-3 text-gray-400">Beds</th>
              <th className="text-left py-3 px-3 text-gray-400">Notes</th>
              <th className="text-left py-3 px-3 text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-8 text-gray-500">No owners found. Add your first owner above.</td></tr>
            ) : sorted.map(o => (
              <tr key={o.id} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: `${GOLD}11` }}>
                <td className="py-2 px-3 font-medium">{o.full_name}</td>
                <td className="py-2 px-3">
                  {o.phone ? <a href={`https://wa.me/${o.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener" className="text-green-400 hover:underline">{o.phone}</a> : '—'}
                </td>
                <td className="py-2 px-3">
                  {o.email ? <a href={`mailto:${o.email}`} className="text-blue-400 hover:underline">{o.email}</a> : '—'}
                </td>
                <td className="py-2 px-3 text-gray-300">{o.nationality || '—'}</td>
                <td className="py-2 px-3 text-gray-300">{o.building || '—'}</td>
                <td className="py-2 px-3 text-gray-300">{o.area || '—'}</td>
                <td className="py-2 px-3 text-gray-300">{o.unit_number || '—'}</td>
                <td className="py-2 px-3 text-gray-300">{o.property_type || '—'}</td>
                <td className="py-2 px-3 text-gray-300">{o.bedrooms != null ? o.bedrooms : '—'}</td>
                <td className="py-2 px-3 text-gray-400 max-w-[200px] truncate" title={o.notes || ''}>{o.notes || '—'}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-2">
                    <button onClick={() => setEditOwner(o)} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white" title="Edit">
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => handleDelete(o.id)} disabled={deleting === o.id} className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400" title="Delete">
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-gray-500">Showing {sorted.length} of {total} owners</div>

      {/* Modals */}
      {editOwner && (
        <OwnerModal
          owner={editOwner === 'new' ? null : editOwner as Owner}
          onClose={() => setEditOwner(null)}
          onSave={handleSave}
          filterOptions={filterOptions}
        />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => { fetchOwners(); fetchFilterOptions(); }} />}
    </div>
  );
}
