'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Building, Plus, Edit2, Trash2, Search, Star, Image as ImageIcon, Eye, Download, X, ChevronLeft, ChevronRight, MapPin, Calendar, DollarSign, Home, CheckCircle, Upload, Loader2 } from 'lucide-react';

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
  images?: string;
  description?: string;
  amenities?: string;
  brochure_url?: string;
  created_at?: string;
}

interface Developer { id: number; name: string; }

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: '#ECFDF5', text: '#065F46' },
  sold_out: { bg: '#FEF2F2', text: '#DC2626' },
  'sold out': { bg: '#FEF2F2', text: '#DC2626' },
  coming_soon: { bg: '#EFF6FF', text: '#1D4ED8' },
  'coming soon': { bg: '#EFF6FF', text: '#1D4ED8' },
  'handed-over': { bg: '#F3E8FF', text: '#6B21A8' },
  inactive: { bg: '#F9FAFB', text: '#6B7280' },
};

const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

function parseJsonArray(val?: string): string[] {
  if (!val) return [];
  try {
    const arr = JSON.parse(val);
    if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
  } catch {
    return val.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function getFirstImage(images?: string): string | null {
  const arr = parseJsonArray(images);
  return arr[0] || null;
}

function fmt(n?: number) {
  if (!n) return null;
  return n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(1)}M` : `AED ${n.toLocaleString()}`;
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ project, onClose, onEdit }: { project: Project; onClose: () => void; onEdit: () => void }) {
  const images = parseJsonArray(project.images);
  const amenities = parseJsonArray(project.amenities);
  const unitTypes = parseJsonArray(project.unit_types);
  const [imgIdx, setImgIdx] = useState(0);
  const sc = statusColors[project.status || 'active'] || { bg: '#F9FAFB', text: '#6B7280' };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{project.name}</h2>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{project.developer_name} · {project.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
              style={{ background: 'rgba(201,169,110,0.12)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div>

        {/* Photo Gallery */}
        {images.length > 0 ? (
          <div className="relative" style={{ background: '#0a1628' }}>
            <img src={images[imgIdx]} alt={project.name}
              className="w-full object-cover" style={{ height: '280px' }} />
            {images.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 transition-all">
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button onClick={() => setImgIdx(i => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 transition-all">
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{ background: i === imgIdx ? '#C9A96E' : 'rgba(255,255,255,0.5)' }} />
                  ))}
                </div>
                <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs text-white font-medium"
                  style={{ background: 'rgba(0,0,0,0.5)' }}>
                  {imgIdx + 1} / {images.length}
                </div>
              </>
            )}
            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto" style={{ background: '#0a1628' }}>
                {images.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className="flex-shrink-0 rounded-lg overflow-hidden transition-all"
                    style={{ border: i === imgIdx ? '2px solid #C9A96E' : '2px solid transparent' }}>
                    <img src={img} alt="" className="w-16 h-12 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12" style={{ background: '#F9FAFB' }}>
            <ImageIcon className="w-12 h-12 mb-2" style={{ color: '#D1D5DB' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>No photos added yet</p>
          </div>
        )}

        {/* Key Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b" style={{ borderColor: '#E5E7EB' }}>
          {[
            { icon: DollarSign, label: 'Starting From', value: fmt(project.min_price) || '—' },
            { icon: Calendar, label: 'Handover', value: project.handover_date || '—' },
            { icon: Home, label: 'Down Payment', value: project.down_payment_percent ? `${project.down_payment_percent}%` : '—' },
            { icon: Building, label: 'Completion', value: project.completion_percent != null ? `${project.completion_percent}%` : '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col items-center justify-center py-4 px-3 border-r last:border-r-0"
              style={{ borderColor: '#E5E7EB' }}>
              <Icon className="w-4 h-4 mb-1" style={{ color: '#C9A96E' }} />
              <p className="text-xs font-medium" style={{ color: '#9CA3AF' }}>{label}</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: '#131B2B' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">

          {/* Status + Featured + Price */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 text-xs font-semibold rounded-full" style={{ background: sc.bg, color: sc.text }}>
              {project.status || 'active'}
            </span>
            {project.featured === 1 && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1"
                style={{ background: '#FEF3C7', color: '#92400E' }}>
                <Star className="w-3 h-3 fill-current" /> Featured
              </span>
            )}
            {project.min_price && project.max_price && (
              <span className="text-sm font-semibold ml-auto" style={{ color: '#131B2B' }}>
                {fmt(project.min_price)} – {fmt(project.max_price)}
              </span>
            )}
          </div>

          {/* Location + Community */}
          {(project.location || project.community) && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: '#C9A96E' }} />
              <span>{[project.location, project.community].filter(Boolean).join(' · ')}</span>
            </div>
          )}

          {/* Description */}
          {project.description && (
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#131B2B' }}>About the Project</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{project.description}</p>
            </div>
          )}

          {/* Payment Plan */}
          {project.payment_plan && (
            <div className="rounded-xl p-4" style={{ background: '#F9F5EE', border: '1px solid rgba(201,169,110,0.2)' }}>
              <h3 className="text-sm font-semibold mb-1" style={{ color: '#131B2B' }}>Payment Plan</h3>
              <p className="text-sm font-medium" style={{ color: '#8A6F2F' }}>{project.payment_plan}</p>
              {project.down_payment_percent && (
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Down payment: {project.down_payment_percent}%</p>
              )}
            </div>
          )}

          {/* Unit Types */}
          {unitTypes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#131B2B' }}>Unit Types</h3>
              <div className="flex flex-wrap gap-2">
                {unitTypes.map(u => (
                  <span key={u} className="px-3 py-1 text-xs font-medium rounded-full"
                    style={{ background: '#EFF6FF', color: '#1D4ED8' }}>{u}</span>
                ))}
              </div>
            </div>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#131B2B' }}>Amenities</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {amenities.map(a => (
                  <div key={a} className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C9A96E' }} />
                    <span className="text-xs" style={{ color: '#374151' }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Availability */}
          {(project.total_units || project.available_units) && (
            <div className="flex gap-4">
              {project.total_units && (
                <div className="text-center">
                  <p className="text-xl font-bold" style={{ color: '#131B2B' }}>{project.total_units}</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>Total Units</p>
                </div>
              )}
              {project.available_units && (
                <div className="text-center">
                  <p className="text-xl font-bold" style={{ color: '#065F46' }}>{project.available_units}</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>Available</p>
                </div>
              )}
            </div>
          )}

          {/* Brochure Download */}
          {project.brochure_url && (
            <div className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: '#131B2B', border: '1px solid #1e2a3d' }}>
              <div>
                <p className="text-sm font-semibold text-white">Project Brochure</p>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Official marketing materials from developer</p>
              </div>
              <a href={project.brochure_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white' }}>
                <Download className="w-4 h-4" /> View Files
              </a>
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-3 pt-2">
            <a href={`https://wa.me/971585580053?text=I'm interested in ${encodeURIComponent(project.name)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg text-center transition-all hover:opacity-90"
              style={{ background: '#25D366' }}>
              WhatsApp Lead
            </a>
            <button onClick={onEdit}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white' }}>
              Edit Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Image Uploader Component ──────────────────────────────────────────────────
function ImageUploader({ images, onChange }: { images: string[]; onChange: (urls: string[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const uploadFiles = async (files: FileList) => {
    setUploading(true);
    const token = localStorage.getItem('token');
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('files', file);
      fd.append('category', 'offplan');
      fd.append('entityId', 'photos');
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          for (const f of data.files || []) {
            newUrls.push(f.url);
          }
        }
      } catch {}
    }
    onChange([...images, ...newUrls]);
    setUploading(false);
  };

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    onChange([...images, url]);
    setUrlInput('');
  };

  const removeImage = (i: number) => {
    onChange(images.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:border-yellow-400 transition-colors"
        style={{ borderColor: '#D1D5DB', background: '#FAFAFA' }}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2" style={{ color: '#C9A96E' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Uploading...</span>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 mx-auto mb-1.5" style={{ color: '#C9A96E' }} />
            <p className="text-sm font-medium" style={{ color: '#374151' }}>Click or drag photos here</p>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>JPG, PNG, WEBP up to 10MB each — multiple files supported</p>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => e.target.files && uploadFiles(e.target.files)} />
      </div>

      {/* URL input */}
      <div className="flex gap-2 mt-2">
        <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUrl())}
          className="flex-1 px-3.5 py-2 text-sm border rounded-lg focus:outline-none"
          style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
          placeholder="Or paste image URL and press Add" />
        <button type="button" onClick={addUrl}
          className="px-3 py-2 text-xs font-semibold rounded-lg text-white"
          style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>Add</button>
      </div>

      {/* Thumbnail grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {images.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden aspect-square">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                <button type="button" onClick={() => removeImage(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              {i === 0 && (
                <span className="absolute top-1 left-1 text-xs px-1.5 py-0.5 rounded font-bold"
                  style={{ background: '#C9A96E', color: '#131B2B' }}>Cover</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function OffplanPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [current, setCurrent] = useState<Partial<Project> | null>(null);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

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

  const openDetail = (project: Project) => {
    setDetailProject(project);
    setShowDetail(true);
  };

  const openModal = (project?: Project) => {
    setShowDetail(false);
    if (project) {
      setCurrent(project);
      setUploadedImages(parseJsonArray(project.images));
    } else {
      setCurrent({ status: 'active', completion_percent: 0, featured: 0 });
      setUploadedImages([]);
    }
    setShowModal(true);
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
      body: JSON.stringify({ ...current, images: JSON.stringify(uploadedImages) }),
    });
    if (res.ok) { setShowModal(false); setCurrent(null); fetchData(); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this project permanently?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/offplan/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchData();
  };

  const toggleFeatured = async (project: Project) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/offplan/${project.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: project.featured ? 0 : 1 }),
    });
    fetchData();
  };

  const toggleStatus = async (project: Project) => {
    const statuses = ['active', 'coming soon', 'sold out', 'inactive'];
    const idx = statuses.indexOf(project.status || 'active');
    const next = statuses[(idx + 1) % statuses.length];
    const token = localStorage.getItem('token');
    await fetch(`/api/offplan/${project.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    fetchData();
  };

  const filtered = projects.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.location || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.developer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.community || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Off-Plan Projects</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{filtered.length} projects</p>
            </div>
          </div>
          <button onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}>
            <Plus className="w-4 h-4" /> Add Project
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3"
          style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
            <input type="text" placeholder="Search projects, developer, location..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none" style={inputStyle}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="sold out">Sold Out</option>
            <option value="coming soon">Coming Soon</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden"
            style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: '#131B2B' }}>
                    {['Photo', 'Project', 'Developer', 'Location', 'Price Range', 'Payment Plan', 'Handover', 'Status', '★', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const sc = statusColors[p.status || 'active'] || { bg: '#F9FAFB', text: '#6B7280' };
                    const thumb = getFirstImage(p.images);
                    return (
                      <tr key={p.id}
                        style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FEF9F0'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFBFC'; }}>
                        <td className="px-4 py-3">
                          <button onClick={() => openDetail(p)} className="block">
                            {thumb ? (
                              <img src={thumb} alt="" className="w-14 h-14 rounded-xl object-cover hover:opacity-80 transition-opacity" />
                            ) : (
                              <div className="w-14 h-14 rounded-xl flex items-center justify-center hover:opacity-80 transition-opacity"
                                style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
                                <Building className="w-6 h-6 text-white opacity-40" />
                              </div>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => openDetail(p)} className="text-left hover:underline">
                            <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{p.name}</p>
                            {p.completion_percent != null && p.completion_percent > 0 && (
                              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{p.completion_percent}% complete</p>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#374151' }}>{p.developer_name || '—'}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#374151' }}>{p.location || p.community || '—'}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#374151' }}>
                          {p.min_price ? `${fmt(p.min_price)}${p.max_price ? ` – ${fmt(p.max_price)}` : ''}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#374151' }}>
                          {p.payment_plan || '—'}{p.down_payment_percent ? ` (${p.down_payment_percent}% down)` : ''}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#374151' }}>{p.handover_date || '—'}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleStatus(p)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 whitespace-nowrap"
                            style={{ background: sc.bg, color: sc.text }}>
                            {p.status || 'active'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleFeatured(p)}>
                            <Star className="w-5 h-5" style={{ color: p.featured ? '#F59E0B' : '#D1D5DB', fill: p.featured ? '#F59E0B' : 'none' }} />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openDetail(p)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                              style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                              <Eye className="w-3 h-3" /> View
                            </button>
                            <button onClick={() => openModal(p)}
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

      {/* Detail Modal */}
      {showDetail && detailProject && (
        <DetailModal
          project={detailProject}
          onClose={() => setShowDetail(false)}
          onEdit={() => openModal(detailProject)}
        />
      )}

      {/* Edit/Create Modal */}
      {showModal && current && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                    <Building className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{current.id ? 'Edit Project' : 'New Off-Plan Project'}</h2>
                </div>
                <button onClick={() => { setShowModal(false); setCurrent(null); setUploadedImages([]); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" style={{ color: '#6B7280' }} />
                </button>
              </div>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Payment Plan</label>
                  <input type="text" value={current.payment_plan || ''} onChange={e => setCurrent({ ...current, payment_plan: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. 20/80, 40/60" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Down Payment %</label>
                  <input type="number" value={current.down_payment_percent || ''} onChange={e => setCurrent({ ...current, down_payment_percent: parseFloat(e.target.value) || undefined })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Handover Date</label>
                  <input type="text" value={current.handover_date || ''} onChange={e => setCurrent({ ...current, handover_date: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. Q4 2027" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Completion %</label>
                  <input type="number" min="0" max="100" value={current.completion_percent || 0} onChange={e => setCurrent({ ...current, completion_percent: parseInt(e.target.value) || 0 })}
                    className={inputCls} style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Brochure URL</label>
                  <input type="text" value={(current as Project).brochure_url || ''} onChange={e => setCurrent({ ...current, brochure_url: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="https://dam.ac/agent-2023 or direct PDF link" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Project Photos</label>
                  <ImageUploader images={uploadedImages} onChange={setUploadedImages} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Description</label>
                  <textarea rows={3} value={current.description || ''} onChange={e => setCurrent({ ...current, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none resize-none" style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!current.featured} onChange={e => setCurrent({ ...current, featured: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded" />
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>
                      <Star className="w-4 h-4 inline mr-1" style={{ color: '#F59E0B' }} /> Featured on Website
                    </span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  {current.id ? 'Update Project' : 'Create Project'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setCurrent(null); setUploadedImages([]); }}
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
