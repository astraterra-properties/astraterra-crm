'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Edit2, Trash2, Contact, MessageCircle, Mail, Send, X } from 'lucide-react';

interface ContactItem {
  id: number;
  name: string;
  phone: string;
  email: string;
  type: string;
  location_preference: string;
  budget_min: number;
  budget_max: number;
  property_type: string;
  bedrooms: number;
  purpose: string;
  status: string;
  notes: string;
  created_at: string;
}

const typeColors: Record<string, { bg: string; text: string }> = {
  buyer:    { bg: '#ECFDF5', text: '#065F46' },
  seller:   { bg: '#EFF6FF', text: '#1D4ED8' },
  tenant:   { bg: '#FFFBEB', text: '#92400E' },
  landlord: { bg: '#F5F3FF', text: '#5B21B6' },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  active:   { bg: '#ECFDF5', text: '#065F46' },
  inactive: { bg: '#F9FAFB', text: '#6B7280' },
  archived: { bg: '#FEF2F2', text: '#DC2626' },
};

// Role check helper
function hasMinRoleLocal(userRole: string, minRole: string): boolean {
  const levels: Record<string,number> = { owner: 4, admin: 3, marketing: 2, agent: 1 };
  return (levels[userRole] ?? 0) >= (levels[minRole] ?? 99);
}

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [currentContact, setCurrentContact] = useState<Partial<ContactItem> | null>(null);
  const [emailModal, setEmailModal] = useState<ContactItem | null>(null);
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [typeFilter]);

  // Auth check on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const role = localStorage.getItem('userRole') || 'agent';
    const levels: Record<string, number> = { owner: 4, admin: 3, finance: 2, agent: 1 };
    setCanDelete((levels[role] ?? 0) >= (levels['admin'] ?? 99));
  }, []);

  // Fetch whenever page, searchTerm, or typeFilter changes
  useEffect(() => {
    fetchContacts();
  }, [page, searchTerm, typeFilter]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const res = await fetch(`/api/contacts?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContact) return;
    try {
      const token = localStorage.getItem('token');
      const method = currentContact.id ? 'PUT' : 'POST';
      const url = currentContact.id ? `/api/contacts/${currentContact.id}` : '/api/contacts';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(currentContact),
      });
      if (res.ok) { setShowModal(false); setCurrentContact(null); fetchContacts(); }
    } catch (e) { console.error(e); }
  };

  const handleSendEmail = async () => {
    if (!emailModal || !emailForm.subject || !emailForm.body) return;
    setSendingEmail(true);
    setEmailResult(null);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/email/transactional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: emailModal.email,
          toName: emailModal.name,
          subject: emailForm.subject,
          htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#131B2B;color:#fff;border-radius:12px;overflow:hidden;"><div style="background:linear-gradient(135deg,#C9A96E,#8A6F2F);padding:28px;"><h2 style="margin:0;color:white;font-size:20px;">Astraterra Properties</h2></div><div style="padding:28px;">${emailForm.body.replace(/\n/g, '<br/>')}</div><div style="padding:16px 28px;background:#1a2438;border-top:1px solid rgba(201,169,110,0.2);font-size:12px;color:rgba(255,255,255,0.4);">Oxford Tower, Office 502, Business Bay, Dubai · +971 4 570 3846</div></div>`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailResult('Email sent successfully!');
        setEmailForm({ subject: '', body: '' });
        setTimeout(() => { setEmailModal(null); setEmailResult(null); }, 2000);
      } else {
        setEmailResult(`Error: ${data.error || 'Failed to send'}`);
      }
    } catch (e: any) {
      setEmailResult(`Error: ${e.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this contact?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/contacts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchContacts();
  };

  const filtered = contacts; // server-side filtered

  const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
  const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <Contact className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Contacts</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{total.toLocaleString()} total contacts</p>
            </div>
          </div>
          <button
            onClick={() => { setCurrentContact({ type: 'buyer', status: 'active', purpose: 'buy' }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Contact
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
            <input
              type="text" placeholder="Search contacts..."
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none"
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
            />
          </div>
          <select
            value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
            style={inputStyle}
          >
            <option value="all">All Types</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="tenant">Tenant</option>
            <option value="landlord">Landlord</option>
          </select>
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
                    {['Contact', 'Phone / Email', 'Requirements', 'Type', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const tc = typeColors[c.type] || { bg: '#F9FAFB', text: '#6B7280' };
                    const sc = statusColors[c.status] || { bg: '#F9FAFB', text: '#6B7280' };
                    return (
                      <tr key={c.id}
                        style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#FEF9F0'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? 'white' : '#FAFBFC'; }}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
                              {(c.name || c.phone || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{c.name || <span style={{color:'#9CA3AF'}}>No name</span>}</p>
                              <p className="text-xs" style={{ color: '#9CA3AF' }}>#{c.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm" style={{ color: '#374151' }}>{c.phone}</span>
                            {c.phone && (
                              <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                <MessageCircle className="w-3.5 h-3.5" style={{ color: '#25D366' }} />
                              </a>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>{c.email}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-sm" style={{ color: '#374151' }}>{c.property_type} {c.bedrooms > 0 ? `· ${c.bedrooms}BR` : ''}</p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>{c.location_preference}</p>
                          {c.budget_min ? (
                            <p className="text-xs font-medium" style={{ color: '#8A6F2F' }}>
                              AED {c.budget_min.toLocaleString()} – {c.budget_max?.toLocaleString()}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: tc.bg, color: tc.text }}>{c.type}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: sc.bg, color: sc.text }}>{c.status}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setCurrentContact(c); setShowModal(true); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                              style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            {c.email && (
                              <button onClick={() => { setEmailModal(c); setEmailForm({ subject: '', body: '' }); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                                style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}
                                title="Send Email">
                                <Mail className="w-3 h-3" />
                              </button>
                            )}
                            {canDelete && (
                            <button onClick={() => handleDelete(c.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && !loading && (
                <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
                  <Contact className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No contacts found</p>
                </div>
              )}
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t" style={{ borderColor: '#E5E7EB' }}>
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  Page {page} of {totalPages} · {total.toLocaleString()} contacts
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(1)} disabled={page === 1}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg disabled:opacity-40"
                    style={{ background: '#F3F4F6', color: '#374151' }}>«</button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg disabled:opacity-40"
                    style={{ background: '#F3F4F6', color: '#374151' }}>‹ Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const p = start + i;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg"
                        style={{ background: p === page ? 'linear-gradient(135deg,#C9A96E,#8A6F2F)' : '#F3F4F6', color: p === page ? 'white' : '#374151' }}>
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg disabled:opacity-40"
                    style={{ background: '#F3F4F6', color: '#374151' }}>Next ›</button>
                  <button
                    onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg disabled:opacity-40"
                    style={{ background: '#F3F4F6', color: '#374151' }}>»</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && currentContact && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{currentContact.id ? 'Edit Contact' : 'New Contact'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Name *', key: 'name', type: 'text', req: true },
                  { label: 'Phone *', key: 'phone', type: 'text', req: true },
                  { label: 'Email', key: 'email', type: 'email', req: false },
                ].map((f) => (
                  <div key={f.key} className={f.key === 'email' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>{f.label}</label>
                    <input type={f.type} required={f.req}
                      value={(currentContact as any)[f.key] || ''}
                      onChange={(e) => setCurrentContact({ ...currentContact, [f.key]: e.target.value })}
                      className={inputCls} style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                    />
                  </div>
                ))}
                {[
                  { label: 'Type', key: 'type', opts: ['buyer','seller','tenant','landlord'] },
                  { label: 'Purpose', key: 'purpose', opts: ['buy','rent'] },
                  { label: 'Status', key: 'status', opts: ['active','inactive','archived'] },
                  { label: 'Property Type', key: 'property_type', opts: ['','apartment','villa','townhouse','penthouse','commercial','office','retail','studio'] },
                  { label: 'Bedrooms', key: 'bedrooms', opts: ['0','1','2','3','4','5'] },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>{f.label}</label>
                    <select value={(currentContact as any)[f.key] || ''} onChange={(e) => setCurrentContact({ ...currentContact, [f.key]: f.key === 'bedrooms' ? parseInt(e.target.value) : e.target.value })}
                      className={inputCls} style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}>
                      {f.opts.map((o) => <option key={o} value={o}>{o || 'Select...'}</option>)}
                    </select>
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Location Preference</label>
                  <input type="text" value={currentContact.location_preference || ''}
                    onChange={(e) => setCurrentContact({ ...currentContact, location_preference: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. Dubai Marina, Downtown"
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Budget Min (AED)</label>
                  <input type="number" value={currentContact.budget_min || ''}
                    onChange={(e) => setCurrentContact({ ...currentContact, budget_min: parseInt(e.target.value) })}
                    className={inputCls} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Budget Max (AED)</label>
                  <input type="number" value={currentContact.budget_max || ''}
                    onChange={(e) => setCurrentContact({ ...currentContact, budget_max: parseInt(e.target.value) })}
                    className={inputCls} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Notes</label>
                  <textarea value={currentContact.notes || ''}
                    onChange={(e) => setCurrentContact({ ...currentContact, notes: e.target.value })}
                    className={inputCls} style={inputStyle} rows={3} placeholder="Additional notes..."
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  {currentContact.id ? 'Update Contact' : 'Create Contact'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setCurrentContact(null); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg" style={{ background: '#F3F4F6', color: '#374151' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Send Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#131B2B', border: '1px solid rgba(201,169,110,0.3)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.15)' }}>
                  <Mail className="w-4 h-4" style={{ color: '#C9A96E' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Send Email</h3>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>To: {emailModal.name} ({emailModal.email})</p>
                </div>
              </div>
              <button onClick={() => { setEmailModal(null); setEmailResult(null); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {emailResult && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${emailResult.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`} style={{ background: emailResult.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${emailResult.startsWith('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                  {emailResult}
                </div>
              )}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Subject</label>
                  <input
                    type="text"
                    value={emailForm.subject}
                    onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                    placeholder="e.g. Exclusive Property Opportunity for You"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,169,110,0.3)', color: 'white' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Message</label>
                  <textarea
                    value={emailForm.body}
                    onChange={e => setEmailForm({ ...emailForm, body: e.target.value })}
                    placeholder={`Dear ${emailModal.name},\n\nI wanted to reach out regarding...`}
                    rows={6}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,169,110,0.3)', color: 'white' }}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !emailForm.subject || !emailForm.body}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-lg"
                    style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', cursor: sendingEmail ? 'not-allowed' : 'pointer', opacity: sendingEmail ? 0.7 : 1 }}
                  >
                    <Send className="w-4 h-4" />
                    {sendingEmail ? 'Sending...' : 'Send Email'}
                  </button>
                  <button onClick={() => { setEmailModal(null); setEmailResult(null); }}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
