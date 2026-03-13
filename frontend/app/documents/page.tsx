'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FolderOpen,
  Upload,
  Search,
  Eye,
  Download,
  Trash2,
  FileText,
  X,
  Building2,
  User,
  File,
  Image as ImageIcon,
  ChevronDown,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const COMPANY_CATEGORIES = [
  'Trade License',
  'RERA & Licenses',
  'HR & Contracts',
  'Legal',
  'Marketing',
  'Templates',
  'Processes & SOPs',
  'Other',
];

const CLIENT_CATEGORIES = [
  'Passport',
  'Emirates ID',
  'Visa',
  'Title Deed',
  'SPA',
  'Tenancy Contract',
  'NOC',
  'RERA Form',
  'DEWA',
  'Bank Statement',
  'Salary Certificate',
  'POA',
  'Offer Letter',
  'Other',
];


interface Document {
  id: number;
  name: string;
  original_name: string;
  category: string;
  entity_type: string;
  entity_id: number | null;
  entity_name: string | null;
  drive_file_id: string;
  drive_view_link: string;
  drive_download_link: string;
  file_size: number;
  mime_type: string;
  notes: string | null;
  uploaded_by: string;
  created_at: string;
}

interface Contact {
  id: number;
  name: string;
  phone: string;
  email: string;
}

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (!mimeType) return <File className="w-10 h-10 text-white/40" />;
  if (mimeType.includes('pdf')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <rect width="40" height="40" rx="8" fill="rgba(239,68,68,0.15)" />
        <path d="M12 8h11l9 9v15a2 2 0 01-2 2H12a2 2 0 01-2-2V10a2 2 0 012-2z" fill="#ef4444" opacity="0.8"/>
        <path d="M23 8l9 9h-9V8z" fill="#dc2626"/>
        <text x="20" y="27" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">PDF</text>
      </svg>
    );
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <rect width="40" height="40" rx="8" fill="rgba(59,130,246,0.15)" />
        <path d="M12 8h11l9 9v15a2 2 0 01-2 2H12a2 2 0 01-2-2V10a2 2 0 012-2z" fill="#3b82f6" opacity="0.8"/>
        <path d="M23 8l9 9h-9V8z" fill="#2563eb"/>
        <text x="20" y="27" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">DOC</text>
      </svg>
    );
  }
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <rect width="40" height="40" rx="8" fill="rgba(34,197,94,0.15)" />
        <path d="M12 8h11l9 9v15a2 2 0 01-2 2H12a2 2 0 01-2-2V10a2 2 0 012-2z" fill="#22c55e" opacity="0.8"/>
        <path d="M23 8l9 9h-9V8z" fill="#16a34a"/>
        <text x="20" y="27" textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">XLS</text>
      </svg>
    );
  }
  if (mimeType.includes('image')) {
    return (
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <rect width="40" height="40" rx="8" fill="rgba(168,85,247,0.15)" />
        <rect x="8" y="10" width="24" height="20" rx="3" fill="#a855f7" opacity="0.8"/>
        <circle cx="16" cy="17" r="3" fill="white" opacity="0.7"/>
        <path d="M8 26l8-6 6 5 4-3 6 4" stroke="white" strokeWidth="1.5" opacity="0.7"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
      <rect width="40" height="40" rx="8" fill="rgba(255,255,255,0.08)" />
      <path d="M12 8h11l9 9v15a2 2 0 01-2 2H12a2 2 0 01-2-2V10a2 2 0 012-2z" fill="rgba(255,255,255,0.4)"/>
      <path d="M23 8l9 9h-9V8z" fill="rgba(255,255,255,0.25)"/>
    </svg>
  );
}

function DocViewer({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const isPdf = name.toLowerCase().endsWith('.pdf') || url.includes('.pdf');
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(name) || /\.(png|jpg|jpeg|gif|webp)/i.test(url);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10" onClick={e => e.stopPropagation()}>
        <span className="text-white font-medium text-sm truncate max-w-[70%]">{name}</span>
        <div className="flex gap-2">
          <a href={url.replace('/upload/', '/upload/fl_attachment/')} download className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80">⬇ Download</a>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80">↗ Open</a>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-300">✕ Close</button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden" onClick={e => e.stopPropagation()}>
        {isPdf ? (
          <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`} className="w-full h-full border-0" title={name} />
        ) : isImage ? (
          <div className="flex items-center justify-center h-full p-4">
            <img src={url} alt={name} className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-white/50 gap-4">
            <span className="text-5xl">📄</span>
            <p>Cannot preview this file type.</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30">Open in new tab</a>
          </div>
        )}
      </div>
    </div>
  );
}

function DocCard({
  doc,
  showClientChip,
  onDelete,
}: {
  doc: Document;
  showClientChip?: boolean;
  onDelete: (id: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  return (
    <>
      {previewing && <DocViewer url={doc.drive_view_link} name={doc.name} onClose={() => setPreviewing(false)} />}
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 hover:border-white/20 transition-all">
      {showClientChip && doc.entity_name && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 w-fit truncate max-w-full">
          👤 {doc.entity_name}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <FileIcon mimeType={doc.mime_type} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate leading-tight" title={doc.name}>
            {doc.name}
          </p>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
            {doc.category}
          </span>
        </div>
      </div>
      <div className="text-xs text-white/40 flex flex-col gap-0.5">
        <span>📅 {formatDate(doc.created_at)}</span>
        <span>📦 {formatFileSize(doc.file_size)}</span>
        {doc.uploaded_by && <span>👤 {doc.uploaded_by}</span>}
      </div>
      <div className="flex gap-2 mt-auto pt-2 border-t border-white/5">
        <button
          onClick={() => setPreviewing(true)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
        >
          <Eye className="w-3 h-3" />
          Preview
        </button>
        <a
          href={doc.drive_download_link || doc.drive_view_link}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
        >
          <Download className="w-3 h-3" />
        </a>
        {confirming ? (
          <>
            <button
              onClick={() => onDelete(doc.id)}
              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-red-500/30 hover:bg-red-500/50 text-red-300 transition-colors ml-auto"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs px-2 py-1.5 rounded-lg bg-white/10 text-white/50 hover:bg-white/20 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
    </>
  );
}

// Detect finance/restricted role (can only see own documents)
function getUserRole(): string {
  if (typeof window === 'undefined') return '';
  try { return JSON.parse(localStorage.getItem('user') || '{}').role || ''; } catch { return ''; }
}
function isOwnDocsOnly(role: string): boolean {
  const ROLE_LEVELS: Record<string, number> = { owner: 4, admin: 3, finance: 2, agent: 1 };
  return (ROLE_LEVELS[role] ?? 0) < (ROLE_LEVELS['admin'] ?? 99);
}

export default function DocumentsPage() {
  const [userRole, setUserRole] = useState('');
  const [activeTab, setActiveTab] = useState<'company' | 'client' | 'mine'>('company');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client tab state
  const [selectedClient, setSelectedClient] = useState<Contact | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Contact[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [recentClientDocs, setRecentClientDocs] = useState<Document[]>([]);

  const token = getToken();

  // Detect role on mount; set default tab to 'mine' for finance/restricted
  useEffect(() => {
    const role = getUserRole();
    setUserRole(role);
    if (isOwnDocsOnly(role)) {
      setActiveTab('mine');
    }
  }, []);

  const fetchDocuments = useCallback(
    async (entityType: string, entityId?: number, cat?: string, search?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ entity_type: entityType });
        if (entityId) params.append('entity_id', String(entityId));
        if (cat && cat !== 'all') params.append('category', cat);
        if (search) params.append('search', search);
        const res = await fetch(`${API_BASE}/api/documents?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          // Token expired — redirect to login
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          console.error('Documents API error:', data.error);
          setDocuments([]);
          return;
        }
        setDocuments(data.documents || []);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const fetchRecentClientDocs = useCallback(async () => {
    try {
      // Fetch both client and lead documents, merge and sort by date
      const [clientRes, leadRes] = await Promise.all([
        fetch(`${API_BASE}/api/documents?entity_type=client`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/documents?entity_type=lead`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const [clientData, leadData] = await Promise.all([clientRes.json(), leadRes.json()]);
      const merged = [
        ...(clientData.documents || []),
        ...(leadData.documents || []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentClientDocs(merged.slice(0, 20));
    } catch {
      setRecentClientDocs([]);
    }
  }, [token]);


  // Load documents when tab/category/search changes
  useEffect(() => {
    if (activeTab === 'mine') {
      // Backend filters to own docs automatically
      fetchDocuments('agent', undefined, selectedCategory, searchQuery);
    } else if (activeTab === 'company') {
      fetchDocuments('company', undefined, selectedCategory, searchQuery);
    } else if (activeTab === 'client') {
      if (selectedClient) {
        fetchDocuments('client', selectedClient.id, selectedCategory, searchQuery);
      } else {
        fetchRecentClientDocs();
      }
    }
  }, [activeTab, selectedCategory, selectedClient, fetchDocuments, fetchRecentClientDocs]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'mine') {
        fetchDocuments('agent', undefined, selectedCategory, searchQuery);
      } else if (activeTab === 'company') {
        fetchDocuments('company', undefined, selectedCategory, searchQuery);
      } else if (activeTab === 'client' && selectedClient) {
        fetchDocuments('client', selectedClient.id, selectedCategory, searchQuery);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search contacts
  useEffect(() => {
    if (!clientSearch || clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/contacts?search=${encodeURIComponent(clientSearch)}&limit=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setClientResults(data.contacts || data.rows || []);
        setShowClientDropdown(true);
      } catch {
        setClientResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, token]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      // 'mine' tab → backend forces agent/self; client tab uses selected client
      formData.append('entity_type', activeTab === 'mine' ? 'agent' : activeTab);
      if (activeTab === 'client' && selectedClient) {
        formData.append('entity_id', String(selectedClient.id));
        formData.append('entity_name', selectedClient.name);
      }
      formData.append('category', uploadCategory || 'Other');
      if (uploadNotes) formData.append('notes', uploadNotes);

      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        setShowUploadForm(false);
        setUploadFile(null);
        setUploadCategory('');
        setUploadNotes('');
        if (activeTab === 'mine') {
          fetchDocuments('agent', undefined, selectedCategory, searchQuery);
        } else if (activeTab === 'company') {
          fetchDocuments('company', undefined, selectedCategory, searchQuery);
        } else if (activeTab === 'client') {
          fetchDocuments('client', selectedClient?.id, selectedCategory, searchQuery);
        }
      } else {
        const err = await res.json();
        alert('Upload failed: ' + (err.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Upload failed: ' + String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`${API_BASE}/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        setRecentClientDocs((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      alert('Delete failed');
    }
  }

  function handleTabSwitch(tab: 'company' | 'client' | 'mine') {
    setActiveTab(tab);
    setSelectedCategory('all');
    setSearchQuery('');
    setShowUploadForm(false);
    setDocuments([]);
    if (tab === 'client') {
      setSelectedClient(null);
    }
  }

  const categories = activeTab === 'company' ? COMPANY_CATEGORIES : CLIENT_CATEGORIES; // mine and client both use personal doc categories

  const goldStyle = {
    background: 'linear-gradient(135deg, #DEC993 0%, #C5A265 50%, #B59556 100%)',
    color: '#0D1625',
    fontWeight: 600,
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white p-6">
      <style>{`
        .doc-grid { display: grid; gap: 16px; grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 1024px) { .doc-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .doc-grid { grid-template-columns: 1fr; } }
        .pill-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
        .pill-scroll::-webkit-scrollbar { height: 4px; }
        .pill-scroll::-webkit-scrollbar-track { background: transparent; }
        .pill-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 9999px; }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(222,201,147,0.15)' }}>
              <FolderOpen className="w-5 h-5" style={{ color: '#DEC993' }} />
            </div>
            <h1 className="text-2xl font-bold text-white">Document Manager</h1>
          </div>
          <p className="text-white/50 text-sm ml-13">
            Manage client and company documents — stored securely in Google Drive
          </p>
        </div>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all hover:opacity-90"
          style={goldStyle}
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-3 mb-6">
        {isOwnDocsOnly(userRole) ? (
          /* Finance/restricted: only "My Documents" tab */
          <button
            onClick={() => handleTabSwitch('mine')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={goldStyle}
          >
            <FolderOpen className="w-4 h-4" />
            My Documents
          </button>
        ) : (
          /* Admin+ tabs */
          <>
            <button
              onClick={() => handleTabSwitch('company')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'company' ? '' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
              style={activeTab === 'company' ? goldStyle : {}}
            >
              <Building2 className="w-4 h-4" />
              Company Documents
            </button>
            <button
              onClick={() => handleTabSwitch('client')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'client' ? '' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
              style={activeTab === 'client' ? goldStyle : {}}
            >
              <User className="w-4 h-4" />
              Client Documents
            </button>
          </>
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <h3 className="font-semibold text-white">
              Upload {activeTab === 'mine' ? 'My' : activeTab === 'company' ? 'Company' : 'Client'} Document
            </h3>
            <button onClick={() => setShowUploadForm(false)} className="text-white/40 hover:text-white/70">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            {/* Client selector (client tab only, not for mine/company) */}
            {activeTab === 'client' && (
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Client *</label>
                {selectedClient ? (
                  <div className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-white text-sm font-medium">{selectedClient.name}</p>
                      <p className="text-white/50 text-xs">{selectedClient.phone}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedClient(null)}
                      className="text-white/40 hover:text-white/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-amber-400 text-xs bg-amber-400/10 rounded-lg px-3 py-2">
                    Please select a client from the search below before uploading.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Category *</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30"
                >
                  <option value="" disabled>Select category...</option>
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-[#0a1628]">{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Notes (optional)</label>
                <input
                  type="text"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
                />
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) setUploadFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-amber-400/60 bg-amber-400/5' : 'border-white/20 hover:border-white/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setUploadFile(f);
                }}
              />
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-amber-400" />
                  <div className="text-left">
                    <p className="text-white font-medium text-sm">{uploadFile.name}</p>
                    <p className="text-white/40 text-xs">{formatFileSize(uploadFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                    className="text-white/40 hover:text-white/70 ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-white/30 mx-auto mb-2" />
                  <p className="text-white/50 text-sm">Drag & drop a file, or click to browse</p>
                  <p className="text-white/30 text-xs mt-1">PDF, Word, Excel, Images, ZIP</p>
                </>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="px-4 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || !uploadFile || (activeTab === 'client' && !selectedClient)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                style={goldStyle}
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#0D1625] border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MY DOCUMENTS TAB (finance/restricted role) ── */}
      {activeTab === 'mine' && (
        <>
          {/* Category pills */}
          <div className="pill-scroll mb-4">
            {['all', ...CLIENT_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  selectedCategory === cat
                    ? 'border-amber-400/60 text-amber-300'
                    : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                }`}
                style={selectedCategory === cat ? { background: 'rgba(222,201,147,0.08)' } : {}}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your documents..."
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
            />
          </div>

          {loading ? (
            <div className="text-center py-16 text-white/40">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-3" />
              Loading your documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No documents found.</p>
              <p className="text-xs mt-1 opacity-60">Click "Upload Document" to add your first file.</p>
            </div>
          ) : (
            <div className="doc-grid">
              {documents.map((doc) => (
                <DocCard key={doc.id} doc={doc} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── AGENT DOCS TAB (admin+ oversight) ── */}
      {/* ── COMPANY TAB ── */}
      {activeTab === 'company' && (
        <>
          {/* Category pills */}
          <div className="pill-scroll mb-4">
            {['all', ...COMPANY_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  selectedCategory === cat
                    ? 'border-amber-400/60 text-amber-300'
                    : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                }`}
                style={selectedCategory === cat ? { background: 'rgba(222,201,147,0.08)' } : {}}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
            />
          </div>

          {/* Grid */}
          {loading ? (
            <div className="text-center py-16 text-white/40">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-3" />
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No documents found.</p>
              <p className="text-xs mt-1 opacity-60">Click "Upload Document" to add your first file.</p>
            </div>
          ) : (
            <div className="doc-grid">
              {documents.map((doc) => (
                <DocCard key={doc.id} doc={doc} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CLIENT TAB ── */}
      {activeTab === 'client' && (
        <>
          {/* Client search */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <label className="block text-xs text-white/50 mb-2">Search Client</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                onFocus={() => clientResults.length > 0 && setShowClientDropdown(true)}
                placeholder="Type client name to search..."
                className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
              />
              {showClientDropdown && clientResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f1f3a] border border-white/10 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                  {clientResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedClient(c);
                        setClientSearch(c.name);
                        setShowClientDropdown(false);
                        setSelectedCategory('all');
                        fetchDocuments('client', c.id);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                    >
                      <p className="text-white text-sm font-medium">{c.name}</p>
                      <p className="text-white/40 text-xs">{c.phone} {c.email ? `· ${c.email}` : ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedClient && (
              <div className="mt-3 flex items-center justify-between bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                <div>
                  <p className="text-amber-300 font-medium text-sm">{selectedClient.name}</p>
                  <p className="text-white/40 text-xs">{selectedClient.phone}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedClient(null);
                    setClientSearch('');
                    setDocuments([]);
                    fetchRecentClientDocs();
                  }}
                  className="text-white/40 hover:text-white/70 ml-4"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {selectedClient ? (
            <>
              {/* Category pills for client */}
              <div className="pill-scroll mb-4">
                {['all', ...CLIENT_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      fetchDocuments('client', selectedClient.id, cat, searchQuery);
                    }}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      selectedCategory === cat
                        ? 'border-amber-400/60 text-amber-300'
                        : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                    }`}
                    style={selectedCategory === cat ? { background: 'rgba(222,201,147,0.08)' } : {}}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search client documents..."
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-white/30 placeholder-white/20"
                />
              </div>

              {loading ? (
                <div className="text-center py-16 text-white/40">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-3" />
                  Loading documents...
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-16 text-white/30">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No documents for {selectedClient.name} yet.</p>
                  <p className="text-xs mt-1 opacity-60">Click "Upload Document" to add files for this client.</p>
                </div>
              ) : (
                <div className="doc-grid">
                  {documents.map((doc) => (
                    <DocCard key={doc.id} doc={doc} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Recent client docs */}
              <div>
                <h3 className="text-white/60 text-sm font-medium mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  All Client &amp; Lead Documents
                </h3>
                {recentClientDocs.length === 0 ? (
                  <div className="text-center py-16 text-white/30">
                    <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No client documents uploaded yet.</p>
                    <p className="text-xs mt-1 opacity-60">Upload client docs here, or open a lead in Pipeline → 📎 Documents tab.</p>
                  </div>
                ) : (
                  <div className="doc-grid">
                    {recentClientDocs.map((doc) => (
                      <DocCard key={doc.id} doc={doc} showClientChip onDelete={(id) => {
                        setRecentClientDocs((prev) => prev.filter((d) => d.id !== id));
                        handleDelete(id);
                      }} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}


    </div>
  );
}