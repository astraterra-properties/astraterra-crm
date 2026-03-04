'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Handshake, Plus, Edit2, Trash2, LayoutGrid, List, ChevronRight, ChevronLeft, Search, User, Building2, X } from 'lucide-react';

interface Deal {
  id: number;
  title: string;
  contact_id: number;
  property_id: number;
  stage: string;
  value: number;
  probability: number;
  expected_close_date: string;
  status: string;
  notes: string;
  created_at: string;
  contact_name?: string;
  contact_phone?: string;
  property_title?: string;
  property_location?: string;
}

interface ContactOption { id: number; name: string; phone: string; email: string; }
interface PropertyOption { id: number; title: string; location: string; price: number; }

const DEAL_STAGES = [
  { id: 'lead', name: 'Lead', dot: '#9CA3AF' },
  { id: 'qualified', name: 'Qualified', dot: '#3B82F6' },
  { id: 'meeting', name: 'Meeting', dot: '#F59E0B' },
  { id: 'proposal', name: 'Proposal', dot: '#8B5CF6' },
  { id: 'negotiation', name: 'Negotiation', dot: '#F97316' },
  { id: 'closed_won', name: 'Won', dot: '#10B981' },
  { id: 'closed_lost', name: 'Lost', dot: '#EF4444' },
];

// ─── Searchable Selector Component ────────────────────────────────────────────
function SearchSelector({
  label, value, displayValue, placeholder, onSearch, options, onSelect, onClear, renderOption,
}: {
  label: string;
  value: number | null;
  displayValue: string;
  placeholder: string;
  onSearch: (q: string) => void;
  options: any[];
  onSelect: (item: any) => void;
  onClear: () => void;
  renderOption: (item: any) => React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (query.trim()) onSearch(query); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>{label}</label>
      {value ? (
        <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm border rounded-lg" style={inputStyle}>
          <span className="flex-1 font-medium" style={{ color: '#131B2B' }}>{displayValue}</span>
          <button type="button" onClick={onClear} className="text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => { setOpen(true); if (!query) onSearch(''); }}
              placeholder={placeholder}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none"
              style={inputStyle}
            />
          </div>
          {open && options.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-48 overflow-y-auto" style={{ borderColor: '#E5E7EB' }}>
              {options.map((item) => (
                <button key={item.id} type="button"
                  className="w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors border-b last:border-0"
                  style={{ borderColor: '#F3F4F6' }}
                  onClick={() => { onSelect(item); setQuery(''); setOpen(false); }}>
                  {renderOption(item)}
                </button>
              ))}
            </div>
          )}
          {open && query && options.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl px-4 py-3 text-sm" style={{ borderColor: '#E5E7EB', color: '#9CA3AF' }}>
              No results found
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
  const [showModal, setShowModal] = useState(false);
  const [currentDeal, setCurrentDeal] = useState<Partial<Deal> | null>(null);
  const [stats, setStats] = useState({ total: 0, active: 0, won: 0, lost: 0, total_value: 0 });

  // Contact / Property search state
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<PropertyOption | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchDeals(); fetchStats();
  }, []);

  const fetchDeals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/deals', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setDeals(data.data || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/deals/stats', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setStats(data.data || stats); }
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
        const props = data.properties || data.data || [];
        setPropertyOptions(props.map((p: any) => ({
          id: p.id, title: p.title || p.property_id || `Property #${p.id}`,
          location: p.location || p.community || '', price: p.price || 0,
        })));
      }
    } catch (e) { console.error(e); }
  };

  const openModal = (deal?: Partial<Deal>) => {
    if (deal?.id) {
      setCurrentDeal(deal);
      setSelectedContact(deal.contact_id ? { id: deal.contact_id, name: deal.contact_name || `Contact #${deal.contact_id}`, phone: deal.contact_phone || '', email: '' } : null);
      setSelectedProperty(deal.property_id ? { id: deal.property_id, title: deal.property_title || `Property #${deal.property_id}`, location: deal.property_location || '', price: 0 } : null);
    } else {
      setCurrentDeal({ stage: 'lead', status: 'active', probability: 50 });
      setSelectedContact(null);
      setSelectedProperty(null);
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDeal) return;
    try {
      const token = localStorage.getItem('token');
      const method = currentDeal.id ? 'PUT' : 'POST';
      const url = currentDeal.id ? `/api/deals/${currentDeal.id}` : '/api/deals';
      const payload = {
        ...currentDeal,
        contact_id: selectedContact?.id || currentDeal.contact_id || null,
        property_id: selectedProperty?.id || currentDeal.property_id || null,
      };
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) { setShowModal(false); setCurrentDeal(null); fetchDeals(); fetchStats(); }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this deal?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/deals/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchDeals(); fetchStats();
  };

  const handleStageChange = async (dealId: number, newStage: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      fetchDeals(); fetchStats();
    } catch (e) { console.error(e); }
  };

  const getDealsByStage = (stage: string) => deals.filter(d => d.stage === stage);
  const getStageDot = (stage: string) => DEAL_STAGES.find(s => s.id === stage)?.dot || '#9CA3AF';
  const getStageName = (stage: string) => DEAL_STAGES.find(s => s.id === stage)?.name || stage;

  const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
  const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

  const statsCards = [
    { label: 'Total', value: stats.total, color: '#6B7280' },
    { label: 'Active', value: stats.active, color: '#3B82F6' },
    { label: 'Won', value: stats.won, color: '#10B981' },
    { label: 'Lost', value: stats.lost, color: '#EF4444' },
    { label: 'Pipeline Value', value: `AED ${(stats.total_value / 1000000).toFixed(1)}M`, color: '#C9A96E' },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <Handshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Deals Pipeline</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>{deals.length} total deals</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F3F4F6' }}>
              <button onClick={() => setViewMode('pipeline')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                style={{ background: viewMode === 'pipeline' ? 'white' : 'transparent', color: '#374151', boxShadow: viewMode === 'pipeline' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                <LayoutGrid className="w-3.5 h-3.5" /> Pipeline
              </button>
              <button onClick={() => setViewMode('list')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                style={{ background: viewMode === 'list' ? 'white' : 'transparent', color: '#374151', boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                <List className="w-3.5 h-3.5" /> List
              </button>
            </div>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', boxShadow: '0 2px 8px rgba(201,169,110,0.3)' }}
            >
              <Plus className="w-4 h-4" /> Add Deal
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {statsCards.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <p className="text-xs mb-1" style={{ color: '#9CA3AF' }}>{s.label}</p>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          </div>
        ) : viewMode === 'pipeline' ? (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4" style={{ minWidth: '1200px' }}>
              {DEAL_STAGES.filter(s => !['closed_won','closed_lost'].includes(s.id)).map((stage) => {
                const stageDeals = getDealsByStage(stage.id);
                return (
                  <div key={stage.id} className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.dot }} />
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#374151' }}>{stage.name}</span>
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#F3F4F6', color: '#6B7280' }}>{stageDeals.length}</span>
                    </div>
                    <div className="space-y-3">
                      {stageDeals.map((deal) => (
                        <div key={deal.id} className="bg-white rounded-xl border p-4 cursor-pointer transition-all"
                          style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderTop: `3px solid ${stage.dot}` }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
                          onClick={() => openModal(deal)}
                        >
                          <p className="text-sm font-semibold mb-1.5 line-clamp-2" style={{ color: '#131B2B' }}>{deal.title}</p>
                          <p className="text-lg font-bold mb-2" style={{ color: '#C9A96E' }}>AED {deal.value?.toLocaleString()}</p>

                          {/* Contact & Property badges */}
                          {deal.contact_name && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <User className="w-3 h-3 flex-shrink-0" style={{ color: '#6B7280' }} />
                              <span className="text-xs truncate" style={{ color: '#374151' }}>{deal.contact_name}</span>
                            </div>
                          )}
                          {deal.property_title && (
                            <div className="flex items-center gap-1.5 mb-2">
                              <Building2 className="w-3 h-3 flex-shrink-0" style={{ color: '#6B7280' }} />
                              <span className="text-xs truncate" style={{ color: '#374151' }}>{deal.property_title}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: '#F3F4F6' }}>
                              <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #C9A96E, #8A6F2F)', width: `${deal.probability}%` }} />
                            </div>
                            <span className="text-xs font-medium" style={{ color: '#6B7280' }}>{deal.probability}%</span>
                          </div>
                          {deal.expected_close_date && (
                            <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>📅 {new Date(deal.expected_close_date).toLocaleDateString()}</p>
                          )}
                          <div className="flex gap-1.5">
                            <button className="flex-1 flex items-center justify-center py-1.5 text-xs rounded-lg transition-all"
                              style={{ background: '#F3F4F6', color: '#6B7280' }}
                              onClick={(e) => { e.stopPropagation(); const i = DEAL_STAGES.findIndex(s => s.id === stage.id); if (i > 0) handleStageChange(deal.id, DEAL_STAGES[i - 1].id); }}>
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <button className="flex-1 flex items-center justify-center py-1.5 text-xs rounded-lg font-medium transition-all"
                              style={{ background: 'rgba(16,185,129,0.1)', color: '#065F46' }}
                              onClick={(e) => { e.stopPropagation(); handleStageChange(deal.id, 'closed_won'); }}>Win</button>
                            <button className="flex-1 flex items-center justify-center py-1.5 text-xs rounded-lg font-medium transition-all"
                              style={{ background: '#FEF2F2', color: '#DC2626' }}
                              onClick={(e) => { e.stopPropagation(); handleStageChange(deal.id, 'closed_lost'); }}>Lose</button>
                            <button className="flex-1 flex items-center justify-center py-1.5 text-xs rounded-lg transition-all"
                              style={{ background: '#F3F4F6', color: '#6B7280' }}
                              onClick={(e) => { e.stopPropagation(); const i = DEAL_STAGES.findIndex(s => s.id === stage.id); if (i < DEAL_STAGES.length - 3) handleStageChange(deal.id, DEAL_STAGES[i + 1].id); }}>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {stageDeals.length === 0 && (
                        <div className="border-2 border-dashed rounded-xl py-8 text-center" style={{ borderColor: '#E5E7EB' }}>
                          <p className="text-xs" style={{ color: '#D1D5DB' }}>No deals</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: '#131B2B' }}>
                    {['Deal', 'Contact', 'Property', 'Value', 'Stage', 'Probability', 'Close Date', 'Actions'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal, i) => (
                    <tr key={deal.id}
                      style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#FEF9F0'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? 'white' : '#FAFBFC'; }}
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{deal.title}</p>
                        <p className="text-xs" style={{ color: '#9CA3AF' }}>#{deal.id}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {deal.contact_name ? (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#374151' }}>{deal.contact_name}</p>
                              {deal.contact_phone && <p className="text-xs" style={{ color: '#9CA3AF' }}>{deal.contact_phone}</p>}
                            </div>
                          </div>
                        ) : <span className="text-xs" style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {deal.property_title ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#9CA3AF' }} />
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#374151' }}>{deal.property_title}</p>
                              {deal.property_location && <p className="text-xs" style={{ color: '#9CA3AF' }}>{deal.property_location}</p>}
                            </div>
                          </div>
                        ) : <span className="text-xs" style={{ color: '#D1D5DB' }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-bold" style={{ color: '#C9A96E' }}>AED {deal.value?.toLocaleString()}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: getStageDot(deal.stage) }} />
                          <span className="text-sm" style={{ color: '#374151' }}>{getStageName(deal.stage)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full" style={{ background: '#F3F4F6' }}>
                            <div className="h-full rounded-full" style={{ background: '#C9A96E', width: `${deal.probability}%` }} />
                          </div>
                          <span className="text-xs" style={{ color: '#6B7280' }}>{deal.probability}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm" style={{ color: '#6B7280' }}>
                        {deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openModal(deal)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg"
                            style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <button onClick={() => handleDelete(deal.id)}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-lg"
                            style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deals.length === 0 && (
                <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
                  <Handshake className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No deals yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && currentDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>{currentDeal.id ? 'Edit Deal' : 'New Deal'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Deal Title *</label>
                  <input type="text" required value={currentDeal.title || ''}
                    onChange={(e) => setCurrentDeal({ ...currentDeal, title: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="e.g. Villa Sale - Dubai Marina"
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>

                {/* Contact Selector */}
                <div className="col-span-2 md:col-span-1">
                  <SearchSelector
                    label="Contact"
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
                </div>

                {/* Property Selector */}
                <div className="col-span-2 md:col-span-1">
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
                </div>

                {[
                  { label: 'Deal Value (AED) *', key: 'value', type: 'number' },
                  { label: 'Probability (%)', key: 'probability', type: 'number' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>{f.label}</label>
                    <input type={f.type} value={(currentDeal as any)[f.key] || ''}
                      onChange={(e) => setCurrentDeal({ ...currentDeal, [f.key]: parseInt(e.target.value) })}
                      className={inputCls} style={inputStyle}
                      onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Stage</label>
                  <select value={currentDeal.stage || 'lead'} onChange={(e) => setCurrentDeal({ ...currentDeal, stage: e.target.value })}
                    className={inputCls} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}>
                    {DEAL_STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Expected Close Date</label>
                  <input type="date" value={currentDeal.expected_close_date || ''}
                    onChange={(e) => setCurrentDeal({ ...currentDeal, expected_close_date: e.target.value })}
                    className={inputCls} style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Notes</label>
                  <textarea value={currentDeal.notes || ''}
                    onChange={(e) => setCurrentDeal({ ...currentDeal, notes: e.target.value })}
                    className={inputCls} style={inputStyle} rows={3} placeholder="Deal notes..."
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; }} onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; }}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  {currentDeal.id ? 'Update Deal' : 'Create Deal'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setCurrentDeal(null); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg" style={{ background: '#F3F4F6', color: '#374151' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
