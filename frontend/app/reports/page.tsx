'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Download, TrendingUp, Users, Building2, Handshake, Contact } from 'lucide-react';

interface ReportStats {
  total_leads: number;
  active_leads: number;
  total_contacts: number;
  total_properties: number;
  total_deals: number;
  active_deals: number;
  total_revenue: number;
}

export default function Reports() {
  const router = useRouter();
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [totals, setTotals] = useState({ contacts: 0, leads: 0, properties: 0, deals: 0 });
  const [leads, setLeads] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'leads' | 'contacts' | 'properties' | 'deals'>('summary');

  const [hasReportsAccess, setHasReportsAccess] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const role = localStorage.getItem('userRole') || 'agent';
    const levels: Record<string, number> = { owner: 4, admin: 3, marketing: 2, agent: 1 };
    if ((levels[role] ?? 0) < (levels['admin'] ?? 99)) {
      setHasReportsAccess(false);
      setLoading(false);
      return;
    }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [statsRes, leadsRes, contactsRes, propertiesRes, dealsRes] = await Promise.all([
        fetch('/api/dashboard/stats', { headers }),
        fetch('/api/leads?limit=1000', { headers }),
        fetch('/api/contacts?limit=1000', { headers }),
        fetch('/api/properties?limit=1000', { headers }),
        fetch('/api/deals?limit=1000', { headers }),
      ]);
      if (statsRes.ok) setStats((await statsRes.json()).data);
      const newTotals = { contacts: 0, leads: 0, properties: 0, deals: 0 };
      if (leadsRes.ok) { const d = await leadsRes.json(); setLeads(d.data || d.leads || []); newTotals.leads = d.pagination?.total || (d.data || d.leads || []).length; }
      if (contactsRes.ok) { const d = await contactsRes.json(); setContacts(d.data || d.contacts || []); newTotals.contacts = d.pagination?.total || (d.data || d.contacts || []).length; }
      if (propertiesRes.ok) { const d = await propertiesRes.json(); setProperties(d.data || d.properties || []); newTotals.properties = d.pagination?.total || (d.data || d.properties || []).length; }
      if (dealsRes.ok) { const d = await dealsRes.json(); setDeals(d.data || d.deals || []); newTotals.deals = d.pagination?.total || (d.data || d.deals || []).length; }
      setTotals(newTotals);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const exportCSV = (data: any[], filename: string) => {
    if (!data?.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((row) => Object.values(row).map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `astraterra-${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const formatCurrency = (v: number) => v >= 1000000 ? `AED ${(v / 1000000).toFixed(2)}M` : `AED ${(v || 0).toLocaleString()}`;

  const leadsByStatus: Record<string, number> = {};
  leads.forEach((l) => { leadsByStatus[l.status || 'unknown'] = (leadsByStatus[l.status || 'unknown'] || 0) + 1; });

  const dealsByStage: Record<string, number> = {};
  deals.forEach((d) => { dealsByStage[d.stage || 'unknown'] = (dealsByStage[d.stage || 'unknown'] || 0) + 1; });

  const tabs = [
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'leads', label: 'Leads', icon: Users, count: totals.leads },
    { id: 'contacts', label: 'Contacts', icon: Contact, count: totals.contacts },
    { id: 'properties', label: 'Properties', icon: Building2, count: totals.properties },
    { id: 'deals', label: 'Deals', icon: Handshake, count: totals.deals },
  ];

  const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

  if (!hasReportsAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F6F9' }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(201,169,110,0.15)' }}>
            <BarChart3 className="w-8 h-8" style={{ color: '#C9A96E' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#131B2B' }}>Reports Limited</h2>
          <p className="text-sm" style={{ color: '#6B7280' }}>Reports are restricted to your performance data. Contact your administrator for full access.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F6F9' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#6B7280' }}>Generating reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Reports & Analytics</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>
                Astra Terra Properties · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportCSV(leads, 'leads')}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all"
              style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
              <Download className="w-3.5 h-3.5" /> Leads CSV
            </button>
            <button onClick={() => exportCSV(contacts, 'contacts')}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all"
              style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
              <Download className="w-3.5 h-3.5" /> Contacts CSV
            </button>
            <button onClick={() => exportCSV(deals, 'deals')}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white rounded-lg"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
              <Download className="w-3.5 h-3.5" /> Deals CSV
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b" style={{ borderColor: '#E5E7EB' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative"
                style={{ color: isActive ? '#C9A96E' : '#6B7280', borderBottom: isActive ? '2px solid #C9A96E' : '2px solid transparent', marginBottom: '-1px' }}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {(tab as any).count !== undefined && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{(tab as any).count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Summary Tab */}
        {activeTab === 'summary' && stats && (
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Leads', value: totals.leads.toLocaleString(), icon: Users, color: '#3B82F6', bg: '#EFF6FF' },
                { label: 'Total Contacts', value: totals.contacts.toLocaleString(), icon: Contact, color: '#8B5CF6', bg: '#F5F3FF' },
                { label: 'Total Properties', value: totals.properties.toLocaleString(), icon: Building2, color: '#8A6F2F', bg: '#FEF3C7' },
                { label: 'Total Revenue', value: formatCurrency(deals.reduce((s, d) => s + (Number(d.value) || 0), 0)), icon: TrendingUp, color: '#C9A96E', bg: 'rgba(201,169,110,0.1)' },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="bg-white rounded-xl border p-5" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `4px solid ${card.color}` }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: card.bg }}>
                      <Icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                    <p className="text-2xl font-bold mb-1" style={{ color: '#131B2B' }}>{card.value}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{card.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Two column breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Leads by Status */}
              <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: '#131B2B' }}>Leads by Status</h3>
                <div className="space-y-3">
                  {Object.entries(leadsByStatus).map(([status, count]) => {
                    const pct = leads.length ? Math.round((count / leads.length) * 100) : 0;
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs capitalize font-medium" style={{ color: '#374151' }}>{status}</span>
                          <span className="text-xs" style={{ color: '#6B7280' }}>{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: '#F3F4F6' }}>
                          <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #C9A96E, #8A6F2F)', width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Deals by Stage */}
              <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: '#131B2B' }}>Deals by Stage</h3>
                <div className="space-y-3">
                  {Object.entries(dealsByStage).map(([stage, count]) => {
                    const pct = deals.length ? Math.round((count / deals.length) * 100) : 0;
                    return (
                      <div key={stage}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs capitalize font-medium" style={{ color: '#374151' }}>{stage.replace('_', ' ')}</span>
                          <span className="text-xs" style={{ color: '#6B7280' }}>{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: '#F3F4F6' }}>
                          <div className="h-full rounded-full" style={{ background: '#131B2B', width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: '#131B2B' }}>
                    {['Name', 'Phone', 'Email', 'Status', 'Priority', 'Source', 'Budget'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 50).map((lead, i) => (
                    <tr key={lead.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: '#131B2B' }}>{lead.name}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{lead.phone}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{lead.email}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: '#F3F4F6', color: '#374151' }}>{lead.status}</span></td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>{lead.priority}</span></td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{lead.source}</td>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: '#8A6F2F' }}>
                        {lead.budget_min ? `AED ${Number(lead.budget_min).toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 && <div className="text-center py-12" style={{ color: '#9CA3AF' }}>No leads data</div>}
            </div>
          </div>
        )}

        {/* Contacts Tab */}
        {activeTab === 'contacts' && (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: '#131B2B' }}>
                    {['Name', 'Phone', 'Email', 'Type', 'Status', 'Property Type', 'Budget'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.slice(0, 50).map((c, i) => (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: '#131B2B' }}>{c.name}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{c.phone}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{c.email}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: '#ECFDF5', color: '#065F46' }}>{c.type}</span></td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{c.status}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{c.property_type}</td>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: '#8A6F2F' }}>
                        {c.budget_min ? `AED ${Number(c.budget_min).toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {contacts.length === 0 && <div className="text-center py-12" style={{ color: '#9CA3AF' }}>No contacts data</div>}
            </div>
          </div>
        )}

        {/* Properties Tab */}
        {activeTab === 'properties' && (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: '#131B2B' }}>
                    {['ID', 'Title', 'Type', 'Location', 'Beds', 'Price', 'Status'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {properties.slice(0, 50).map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}>
                      <td className="px-5 py-3 text-xs font-mono" style={{ color: '#9CA3AF' }}>{p.property_id}</td>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: '#131B2B' }}>{p.title}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{p.type}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{p.location}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{p.bedrooms}</td>
                      <td className="px-5 py-3 text-sm font-bold" style={{ color: '#C9A96E' }}>AED {Number(p.price).toLocaleString()}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 text-xs rounded-full" style={{ background: '#ECFDF5', color: '#065F46' }}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {properties.length === 0 && <div className="text-center py-12" style={{ color: '#9CA3AF' }}>No properties data</div>}
            </div>
          </div>
        )}

        {/* Deals Tab */}
        {activeTab === 'deals' && (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: '#131B2B' }}>
                    {['Title', 'Value', 'Stage', 'Probability', 'Close Date', 'Status'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deals.slice(0, 50).map((d, i) => (
                    <tr key={d.id} style={{ background: i % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: '#131B2B' }}>{d.title}</td>
                      <td className="px-5 py-3 text-sm font-bold" style={{ color: '#C9A96E' }}>AED {Number(d.value || 0).toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{d.stage}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{d.probability}%</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#6B7280' }}>{d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : '—'}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 text-xs rounded-full" style={{ background: '#F3F4F6', color: '#374151' }}>{d.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deals.length === 0 && <div className="text-center py-12" style={{ color: '#9CA3AF' }}>No deals data</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
