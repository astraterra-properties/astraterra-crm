'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, User, Phone, Mail, Building, Calendar, Search, RefreshCw } from 'lucide-react';

interface BrochureLead {
  id: number;
  name: string;
  phone: string;
  email: string;
  project_name: string;
  project_slug: string;
  brochure_url: string;
  ip_address: string;
  created_at: string;
}

export default function OffplanLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<BrochureLead[]>([]);
  const [filtered, setFiltered] = useState<BrochureLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/brochure-leads', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        setFiltered(data.leads || []);
      } else {
        setError('Failed to load leads');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(leads);
    } else {
      const q = search.toLowerCase();
      setFiltered(leads.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.project_name?.toLowerCase().includes(q)
      ));
    }
  }, [search, leads]);

  const formatDate = (dt: string) => {
    try {
      return new Date(dt).toLocaleString('en-AE', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return dt; }
  };

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0a1628', margin: 0 }}>
            📥 Brochure Download Leads
          </h1>
          <p style={{ color: '#6b7280', marginTop: 6 }}>
            People who filled in their details to download a project brochure
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{
            background: '#d4af37', color: '#0a1628',
            borderRadius: 10, padding: '8px 18px',
            fontWeight: 700, fontSize: 18,
          }}>
            {leads.length} total leads
          </div>
          <button
            onClick={fetchLeads}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#0a1628', color: '#fff',
              border: 'none', borderRadius: 8, padding: '8px 16px',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          type="text"
          placeholder="Search by name, email, phone or project..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', paddingLeft: 40, padding: '12px 14px 12px 40px',
            border: '1.5px solid #e5e7eb', borderRadius: 10,
            fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading leads...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#ef4444' }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          No leads yet. When someone downloads a brochure, they'll appear here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(lead => (
            <div key={lead.id} style={{
              background: '#fff',
              border: '1.5px solid #e5e7eb',
              borderRadius: 12,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              flexWrap: 'wrap',
            }}>
              {/* Lead number */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#f0f4ff', color: '#0a1628',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {lead.id}
              </div>

              {/* Name & Contact */}
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <User size={14} color="#d4af37" />
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#0a1628' }}>{lead.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6b7280', fontSize: 13 }}>
                    <Phone size={12} /> {lead.phone}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#6b7280', fontSize: 13 }}>
                    <Mail size={12} /> {lead.email}
                  </div>
                </div>
              </div>

              {/* Project */}
              <div style={{ flex: '1 1 180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building size={14} color="#d4af37" />
                  <span style={{ fontWeight: 600, color: '#0a1628', fontSize: 14 }}>{lead.project_name || '—'}</span>
                </div>
              </div>

              {/* Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13 }}>
                <Calendar size={13} /> {formatDate(lead.created_at)}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a
                  href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#25d366', color: '#fff',
                    border: 'none', borderRadius: 8,
                    padding: '7px 14px', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer',
                    textDecoration: 'none', display: 'inline-flex',
                    alignItems: 'center', gap: 5,
                  }}
                >
                  💬 WhatsApp
                </a>
                {lead.brochure_url && (
                  <a
                    href={`https://astraterra.ae${lead.brochure_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: '#f3f4f6', color: '#374151',
                      border: '1px solid #e5e7eb', borderRadius: 8,
                      padding: '7px 14px', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer',
                      textDecoration: 'none', display: 'inline-flex',
                      alignItems: 'center', gap: 5,
                    }}
                  >
                    <Download size={12} /> Brochure
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
