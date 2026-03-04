'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface Complaint {
  id: number;
  name: string;
  email: string;
  phone: string;
  property_ref: string;
  nature: string;
  details: string;
  resolution: string;
  submitted_at: string;
  source: string;
  status: string;
  created_at: string;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  'New':         { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  'In Progress': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  'Resolved':    { bg: '#ECFDF5', text: '#065F46', border: '#6EE7B7' },
};

const STATUSES = ['New', 'In Progress', 'Resolved'];

export default function ComplaintsPage() {
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus) params.set('status', filterStatus);
      const res = await apiFetch(`/api/complaints?${params.toString()}`);
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setComplaints(data.complaints || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await apiFetch(`/api/complaints/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev);
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = complaints.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.property_ref.toLowerCase().includes(q) ||
      c.nature.toLowerCase().includes(q)
    );
  });

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={28} color="#C5A265" />
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Complaints</h1>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Website complaints form submissions</p>
          </div>
        </div>
        <button
          onClick={fetchComplaints}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {STATUSES.map(s => {
          const count = complaints.filter(c => c.status === s).length;
          const col = statusColors[s];
          return (
            <div key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)} style={{ padding: '10px 20px', background: filterStatus === s ? col.bg : '#F9FAFB', border: `1px solid ${filterStatus === s ? col.border : '#E5E7EB'}`, borderRadius: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: filterStatus === s ? col.text : '#111827' }}>{count}</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>{s}</div>
            </div>
          );
        })}
        <div style={{ padding: '10px 20px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>{total}</div>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>Total</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '16px' }}>
        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, property…"
          style={{ width: '100%', paddingLeft: '34px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6B7280' }}>Loading complaints…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6B7280' }}>
          <AlertCircle size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p>{search || filterStatus ? 'No complaints match your filter.' : 'No complaints yet.'}</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Date', 'Name', 'Phone', 'Nature', 'Property Ref', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const col = statusColors[c.status] || statusColors['New'];
                return (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid #F3F4F6', background: idx % 2 === 0 ? '#fff' : '#FAFAFA', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => setSelected(c)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F0F7FF')}
                    onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFAFA')}
                  >
                    <td style={{ padding: '10px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: '600', color: '#111827' }}>{c.name}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{c.phone || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{c.nature || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{c.property_ref || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}`, padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>{c.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                      <select
                        value={c.status}
                        disabled={updatingId === c.id}
                        onChange={e => updateStatus(c.id, e.target.value)}
                        style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: '16px', maxWidth: '640px', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827' }}>{selected.name}</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>Submitted {formatDate(selected.created_at)}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select
                  value={selected.status}
                  disabled={updatingId === selected.id}
                  onChange={e => updateStatus(selected.id, e.target.value)}
                  style={{ fontSize: '13px', padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#fff' }}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#6B7280', lineHeight: 1 }}>✕</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {[
                ['Email', selected.email || '—'],
                ['Phone', selected.phone || '—'],
                ['Property Ref', selected.property_ref || '—'],
                ['Nature', selected.nature || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ background: '#F9FAFB', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Complaint Details</div>
              <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '14px', fontSize: '14px', color: '#374151', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{selected.details || '—'}</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Desired Resolution</div>
              <div style={{ background: '#F9FAFB', borderRadius: '8px', padding: '14px', fontSize: '14px', color: '#374151', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{selected.resolution || '—'}</div>
            </div>

            {selected.phone && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                <a
                  href={`https://wa.me/${selected.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#25D366', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}
                >
                  💬 WhatsApp {selected.name}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
