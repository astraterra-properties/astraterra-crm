'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, Edit2, Trash2, Clock, MapPin, User, Building2 } from 'lucide-react';
import SearchSelector from '../../components/SearchSelector';

interface Viewing {
  id: number;
  property_id: number;
  contact_id: number;
  agent_id?: number;
  viewing_date: string;
  viewing_time: string;
  status: string;
  notes: string;
  created_at: string;
  property_title?: string;
  property_location?: string;
  contact_name?: string;
  contact_phone?: string;
  agent_name?: string;
}

interface ContactOption { id: number; name: string; phone: string; email: string; }
interface PropertyOption { id: number; title: string; location: string; price: number; }

const statusColors: Record<string, { bg: string; text: string }> = {
  scheduled:   { bg: '#EFF6FF', text: '#1D4ED8' },
  completed:   { bg: '#ECFDF5', text: '#065F46' },
  cancelled:   { bg: '#FEF2F2', text: '#DC2626' },
  rescheduled: { bg: '#FFFBEB', text: '#92400E' },
};

export default function ViewingsPage() {
  const router = useRouter();
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentViewing, setCurrentViewing] = useState<Partial<Viewing> | null>(null);
  const [stats, setStats] = useState({ total: 0, upcoming: 0, today: 0, completed: 0 });

  // Selector state
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<PropertyOption | null>(null);
  const [agents, setAgents] = useState<{ id: number; name: string; role: string }[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchViewings(); fetchStats(); fetchAgents();
  }, []);

  const fetchViewings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/viewings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setViewings(data.data || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/viewings/stats', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setStats(data.data || stats); }
    } catch (e) { console.error(e); }
  };

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAgents((data.data?.rows || data.users || []).filter((u: any) => u.active !== 0));
      }
    } catch (e) { console.error(e); }
  };

  const searchContacts = async (q: string) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ limit: '10', page: '1' });
      if (q.trim()) params.set('search', q.trim());
      const res = await fetch(`/api/contacts?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setContactOptions((data.contacts || []).map((c: any) => ({
          id: c.id, name: c.name || c.phone || 'Unknown', phone: c.phone || '', email: c.email || '',
        })));
      }
    } catch (e) { console.error(e); }
  };

  const searchProperties = async (q: string) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ limit: '10' });
      if (q.trim()) params.set('search', q.trim());
      const res = await fetch(`/api/properties?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPropertyOptions((data.properties || data.data || []).map((p: any) => ({
          id: p.id, title: p.title || `Property #${p.id}`,
          location: p.location || p.community || '', price: p.price || 0,
        })));
      }
    } catch (e) { console.error(e); }
  };

  const openModal = (viewing?: Partial<Viewing>) => {
    if (viewing?.id) {
      setCurrentViewing(viewing);
      setSelectedContact(viewing.contact_id ? {
        id: viewing.contact_id, name: viewing.contact_name || `Contact #${viewing.contact_id}`,
        phone: viewing.contact_phone || '', email: '',
      } : null);
      setSelectedProperty(viewing.property_id ? {
        id: viewing.property_id, title: viewing.property_title || `Property #${viewing.property_id}`,
        location: viewing.property_location || '', price: 0,
      } : null);
      setSelectedAgentId(viewing.agent_id ? String(viewing.agent_id) : '');
    } else {
      setCurrentViewing({ status: 'scheduled', viewing_date: new Date().toISOString().split('T')[0] });
      setSelectedContact(null);
      setSelectedProperty(null);
      setSelectedAgentId('');
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentViewing) return;
    try {
      const token = localStorage.getItem('token');
      const method = currentViewing.id ? 'PUT' : 'POST';
      const url = currentViewing.id ? `/api/viewings/${currentViewing.id}` : '/api/viewings';
      const payload = {
        ...currentViewing,
        contact_id: selectedContact?.id || currentViewing.contact_id || null,
        property_id: selectedProperty?.id || currentViewing.property_id || null,
        agent_id: selectedAgentId ? parseInt(selectedAgentId) : null,
      };
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) { setShowModal(false); setCurrentViewing(null); fetchViewings(); fetchStats(); }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this viewing?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/viewings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchViewings(); fetchStats();
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
  const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

  const statsCards = [
    { label: 'Total', value: stats.total, color: '#131B2B' },
    { label: 'Upcoming', value: stats.upcoming, color: '#3B82F6' },
    { label: 'Today', value: stats.today, color: '#C9A96E' },
    { label: 'Completed', value: stats.completed, color: '#10B981' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Viewings</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{viewings.length} total viewings</p>
            </div>
          </div>
          <button onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}>
            <Plus className="w-4 h-4" /> Schedule Viewing
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {statsCards.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <p className="text-xs mb-1" style={{ color: '#9CA3AF' }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
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
                    {['Property', 'Client', 'Agent', 'Date & Time', 'Status', 'Notes', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewings.map((v, i) => {
                    const sc = statusColors[v.status] || { bg: '#F9FAFB', text: '#6B7280' };
                    return (
                      <tr key={v.id}
                        style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#FEF9F0'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? 'white' : '#FAFBFC'; }}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-start gap-2">
                            <Building2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#C9A96E' }} />
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#131B2B' }}>{v.property_title || `Property #${v.property_id}`}</p>
                              {v.property_location && <p className="text-xs" style={{ color: '#9CA3AF' }}>{v.property_location}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-start gap-2">
                            <User className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#9CA3AF' }} />
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#374151' }}>{v.contact_name || `Contact #${v.contact_id}`}</p>
                              {v.contact_phone && <p className="text-xs" style={{ color: '#9CA3AF' }}>{v.contact_phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {v.agent_name ? (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit" style={{ background: 'rgba(201,169,110,0.12)', color: '#8A6F2F' }}>
                              👤 {v.agent_name}
                            </span>
                          ) : <span className="text-xs" style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                            <span className="text-sm" style={{ color: '#374151' }}>
                              {v.viewing_date ? new Date(v.viewing_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            </span>
                          </div>
                          {v.viewing_time && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
                              <span className="text-xs" style={{ color: '#6B7280' }}>{v.viewing_time}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: sc.bg, color: sc.text }}>{v.status}</span>
                        </td>
                        <td className="px-5 py-3.5 max-w-[180px]">
                          <p className="text-xs truncate" style={{ color: '#6B7280' }}>{v.notes || '—'}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openModal(v)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                              style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => handleDelete(v.id)}
                              className="px-2.5 py-1.5 text-xs rounded-lg"
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
              {viewings.length === 0 && (
                <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No viewings scheduled</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && currentViewing && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{currentViewing.id ? 'Edit Viewing' : 'Schedule Viewing'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">

              {/* Property Selector */}
              <SearchSelector
                label="Property"
                value={selectedProperty?.id || null}
                displayValue={selectedProperty ? `${selectedProperty.title}${selectedProperty.location ? ` · ${selectedProperty.location}` : ''}` : ''}
                placeholder="Search by title or location..."
                onSearch={searchProperties}
                options={propertyOptions}
                onSelect={(p) => setSelectedProperty(p)}
                onClear={() => setSelectedProperty(null)}
                renderOption={(p) => (
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#131B2B' }}>{p.title}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{p.location}{p.price ? ` · AED ${p.price.toLocaleString()}` : ''}</p>
                  </div>
                )}
              />

              {/* Contact Selector */}
              <SearchSelector
                label="Client / Contact"
                value={selectedContact?.id || null}
                displayValue={selectedContact ? `${selectedContact.name}${selectedContact.phone ? ` · ${selectedContact.phone}` : ''}` : ''}
                placeholder="Search by name or phone..."
                onSearch={searchContacts}
                options={contactOptions}
                onSelect={(c) => setSelectedContact(c)}
                onClear={() => setSelectedContact(null)}
                renderOption={(c) => (
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#131B2B' }}>{c.name || 'No name'}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                  </div>
                )}
              />

              {/* Agent Dropdown */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Assigned Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className={inputCls} style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                >
                  <option value="">— Unassigned —</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                  ))}
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Date *</label>
                  <input type="date" required value={currentViewing.viewing_date || ''}
                    onChange={(e) => setCurrentViewing({ ...currentViewing, viewing_date: e.target.value })}
                    className={inputCls} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Time</label>
                  <input type="time" value={currentViewing.viewing_time || ''}
                    onChange={(e) => setCurrentViewing({ ...currentViewing, viewing_time: e.target.value })}
                    className={inputCls} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Status</label>
                <select value={currentViewing.status || 'scheduled'} onChange={(e) => setCurrentViewing({ ...currentViewing, status: e.target.value })}
                  className={inputCls} style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Notes</label>
                <textarea value={currentViewing.notes || ''} onChange={(e) => setCurrentViewing({ ...currentViewing, notes: e.target.value })}
                  className={inputCls} style={inputStyle} rows={3} placeholder="Notes about this viewing..."
                  onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  {currentViewing.id ? 'Update Viewing' : 'Schedule Viewing'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setCurrentViewing(null); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg" style={{ background: '#F3F4F6', color: '#374151' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
