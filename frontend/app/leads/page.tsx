'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Archive, UserCheck, MessageCircle, BookMarked } from 'lucide-react';

interface PoolContact {
  id: number;
  name: string;
  phone: string;
  email: string;
  type: string;
  source: string;
  status: string;
  lead_pool: number;
  lead_source_status: string;
  assigned_agent: string;
  location_preference: string;
  budget_min: number;
  budget_max: number;
  property_type: string;
  bedrooms: number;
  created_at: string;
}

export default function LeadsPage() {
  const router = useRouter();
  const [poolContacts, setPoolContacts] = useState<PoolContact[]>([]);
  const [poolStats, setPoolStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [poolSourceFilter, setPoolSourceFilter] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState<PoolContact | null>(null);
  const [assignAgentName, setAssignAgentName] = useState('');
  const [agents, setAgents] = useState<{id: number; name: string; role: string}[]>([]);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchAgents();
    fetchPool();
  }, [poolSourceFilter]);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const users = data.data?.rows || data.users || [];
        setAgents(users.filter((u: any) => u.active !== 0));
      }
    } catch (e) { console.error('Failed to fetch agents', e); }
  };

  const fetchPool = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = '/api/contacts?pool=true&limit=200';
      if (poolSourceFilter !== 'all') url += `&status=${poolSourceFilter}`;
      const [poolRes, statsRes] = await Promise.all([
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/lead-pool/stats', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (poolRes.ok) {
        const data = await poolRes.json();
        setPoolContacts(data.contacts || []);
      }
      if (statsRes.ok) {
        setPoolStats(await statsRes.json());
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignAgentName.trim()) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/contacts/${assignTarget.id}/assign`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_name: assignAgentName }),
    });
    setShowAssignModal(false);
    setAssignTarget(null);
    setAssignAgentName('');
    fetchPool();
  };

  const claimToPipeline = async (contactId: number) => {
    setClaimingId(contactId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/contacts/${contactId}/convert-to-lead`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        await fetchPool();
        router.push('/pipeline');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to claim lead');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to claim lead');
    } finally {
      setClaimingId(null);
    }
  };

  const filteredPool = poolContacts.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>
              <Archive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Lead Pool</h1>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>
                {poolStats ? `${poolStats.total?.toLocaleString()} contacts in pool` : `${poolContacts.length} in Lead Pool`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">

        {/* Stats Banner */}
        {poolStats && (
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Total Pool', value: poolStats.total?.toLocaleString(), color: '#7C3AED', bg: '#F5F3FF' },
              { label: 'Assigned', value: poolStats.assigned?.toLocaleString(), color: '#065F46', bg: '#ECFDF5' },
              { label: 'Unassigned', value: poolStats.unassigned?.toLocaleString(), color: '#DC2626', bg: '#FEF2F2' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: '#E5E7EB' }}>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-sm font-medium" style={{ color: '#6B7280' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-5 flex flex-wrap gap-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none"
              style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
            />
          </div>
          <select value={poolSourceFilter} onChange={(e) => setPoolSourceFilter(e.target.value)}
            className="px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
            style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}>
            <option value="all">All Statuses</option>
            <option value="inactive">Inactive</option>
            <option value="UNDEAL">Undeal</option>
            <option value="DEAL">Deal (Closed)</option>
            <option value="INVALID">Invalid</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7C3AED', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ background: '#131B2B' }}>
                    {['Contact', 'Phone', 'Type', 'Source Status', 'Location/Budget', 'Assigned Agent', 'Created', 'Action'].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPool.map((contact, index) => (
                    <tr
                      key={contact.id}
                      style={{ background: index % 2 === 0 ? 'white' : '#FAFBFC', borderBottom: '1px solid #F3F4F6' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F5F3FF'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = index % 2 === 0 ? 'white' : '#FAFBFC'; }}
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{contact.name}</p>
                        <p className="text-xs" style={{ color: '#9CA3AF' }}>#{contact.id}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm" style={{ color: '#374151' }}>{contact.phone || '—'}</span>
                          {contact.phone && (
                            <a href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="w-3.5 h-3.5" style={{ color: '#25D366' }} />
                            </a>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: '#9CA3AF' }}>{contact.email}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full capitalize"
                          style={{ background: contact.type === 'tenant' ? '#FFFBEB' : '#EFF6FF', color: contact.type === 'tenant' ? '#92400E' : '#1D4ED8' }}>
                          {contact.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full"
                          style={{ background: '#F5F3FF', color: '#7C3AED' }}>
                          {contact.lead_source_status || contact.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm" style={{ color: '#374151' }}>{contact.location_preference || '—'}</p>
                        {contact.budget_min ? (
                          <p className="text-xs font-medium" style={{ color: '#8A6F2F' }}>
                            AED {contact.budget_min.toLocaleString()}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5">
                        {contact.assigned_agent ? (
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5" style={{ color: '#065F46' }} />
                            <span className="text-sm font-medium" style={{ color: '#065F46' }}>{contact.assigned_agent}</span>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: '#9CA3AF' }}>Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs" style={{ color: '#9CA3AF' }}>
                        {new Date(contact.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setAssignTarget(contact); setAssignAgentName(contact.assigned_agent || ''); setShowAssignModal(true); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all"
                            style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)' }}
                          >
                            <UserCheck className="w-3 h-3" /> Assign
                          </button>
                          <button
                            onClick={() => claimToPipeline(contact.id)}
                            disabled={claimingId === contact.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all"
                            style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white', border: 'none', opacity: claimingId === contact.id ? 0.6 : 1 }}
                          >
                            <BookMarked className="w-3 h-3" />
                            {claimingId === contact.id ? 'Claiming...' : 'Claim → Pipeline'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPool.length === 0 && !loading && (
                <div className="text-center py-16" style={{ color: '#9CA3AF' }}>
                  <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Lead Pool is empty</p>
                  <p className="text-xs mt-1">Run the Pixxi import to populate the Lead Pool</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && assignTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-lg font-bold mb-1" style={{ color: '#131B2B' }}>Assign Lead</h2>
            <p className="text-sm mb-4" style={{ color: '#6B7280' }}>{assignTarget.name}</p>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Select Agent</label>
            <select
              value={assignAgentName}
              onChange={(e) => setAssignAgentName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none mb-4"
              style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
            >
              <option value="">— Unassigned —</option>
              {agents.map(a => (
                <option key={a.id} value={a.name}>{a.name} ({a.role})</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={handleAssign}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}>
                Assign
              </button>
              <button onClick={() => { setShowAssignModal(false); setAssignTarget(null); }}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
