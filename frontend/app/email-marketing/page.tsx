'use client';

import { useState, useEffect } from 'react';
import {
  Mail, Send, FileText, BarChart3, Plus, Eye, Clock, CheckCircle,
  Users, TrendingUp, MousePointerClick, UserMinus, RefreshCw, X
} from 'lucide-react';

const TABS = ['Campaigns', 'Send Campaign', 'Templates', 'Stats'] as const;
type Tab = typeof TABS[number];

const cardStyle = {
  background: '#1a2438',
  border: '1px solid rgba(201,169,110,0.2)',
  borderRadius: '12px',
  padding: '20px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(201,169,110,0.3)',
  borderRadius: '8px',
  color: 'white',
  padding: '10px 14px',
  fontSize: '14px',
  outline: 'none',
};

const btnGold: React.CSSProperties = {
  background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const btnSecondary: React.CSSProperties = {
  background: 'rgba(201,169,110,0.15)',
  color: '#C9A96E',
  border: '1px solid rgba(201,169,110,0.3)',
  borderRadius: '8px',
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

function StatCard({ icon: Icon, label, value, sub, color = '#C9A96E' }: any) {
  return (
    <div style={{ ...cardStyle, display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
      <div style={{ width: 44, height: 44, borderRadius: '10px', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 22, height: 22, color }} />
      </div>
      <div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 4px' }}>{label}</p>
        <p style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: '0 0 2px' }}>{value}</p>
        {sub && <p style={{ color, fontSize: '12px', margin: 0 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Campaigns Tab ──────────────────────────────────────────────────────────
function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'sent' | 'draft' | 'all'>('all');

  useEffect(() => {
    const token = localStorage.getItem('token');
    setLoading(true);
    fetch('/api/email/campaigns/all', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setCampaigns(d.campaigns || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.statusLabel === filter || c.status === filter);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['all', 'sent', 'draft'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none',
            background: filter === f ? 'linear-gradient(135deg,#C9A96E,#8A6F2F)' : 'rgba(255,255,255,0.08)',
            color: filter === f ? 'white' : 'rgba(255,255,255,0.6)',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>
          <RefreshCw style={{ width: 32, height: 32, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <p>Loading campaigns...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '60px' }}>
          <Mail style={{ width: 48, height: 48, color: 'rgba(201,169,110,0.4)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>No campaigns found</p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Create your first campaign in the "Send Campaign" tab</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((c: any, i) => {
            const stats = c.statistics?.campaignStats?.[0] || {};
            const delivered = stats.delivered || 0;
            const opens = stats.uniqueViews || 0;
            const clicks = stats.uniqueClicks || 0;
            const openRate = delivered > 0 ? ((opens / delivered) * 100).toFixed(1) : '—';
            const clickRate = delivered > 0 ? ((clicks / delivered) * 100).toFixed(1) : '—';
            const statusLabel = c.statusLabel || c.status || 'unknown';
            return (
              <div key={c.id || i} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 600, margin: 0 }}>{c.name}</h3>
                      <span style={{
                        padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        background: statusLabel === 'sent' ? 'rgba(34,197,94,0.2)' : 'rgba(201,169,110,0.2)',
                        color: statusLabel === 'sent' ? '#22c55e' : '#C9A96E',
                      }}>{statusLabel}</span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
                      {c.subject} {c.sentDate ? `• Sent ${new Date(c.sentDate).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                </div>
                {statusLabel === 'sent' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    {[
                      { label: 'Delivered', val: delivered.toLocaleString(), icon: CheckCircle, color: '#22c55e' },
                      { label: 'Opens', val: opens.toLocaleString(), icon: Eye, color: '#C9A96E' },
                      { label: 'Open Rate', val: `${openRate}%`, icon: TrendingUp, color: '#60a5fa' },
                      { label: 'Click Rate', val: `${clickRate}%`, icon: MousePointerClick, color: '#a78bfa' },
                    ].map(({ label, val, icon: Icon, color }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <Icon style={{ width: 16, height: 16, color, margin: '0 auto 6px' }} />
                        <p style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: '0 0 2px' }}>{val}</p>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0 }}>{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Send Campaign Tab ──────────────────────────────────────────────────────
function SendCampaignTab() {
  const [form, setForm] = useState({
    name: '',
    subject: '',
    senderName: 'Astraterra Properties',
    senderEmail: 'admin@astraterra.ae',
    templateId: '',
    listIds: [3],
    scheduledAt: '',
    htmlContent: '',
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    Promise.all([
      fetch('/api/email/templates', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/email/lists', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([t, l]) => {
      setTemplates(t.templates || []);
      setLists(l.lists || []);
    }).catch(() => {});
  }, []);

  const handleSend = async (schedule = false) => {
    if (!form.name || !form.subject) { setError('Campaign name and subject are required'); return; }
    setError('');
    setSending(true);
    const token = localStorage.getItem('token');
    try {
      const payload: any = {
        name: form.name,
        subject: form.subject,
        senderName: form.senderName,
        senderEmail: form.senderEmail,
        listIds: form.listIds,
        templateId: form.templateId || null,
        htmlContent: form.htmlContent || null,
      };
      if (schedule && form.scheduledAt) payload.scheduledAt = form.scheduledAt;
      const res = await fetch('/api/email/campaign/send-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setForm({ name: '', subject: '', senderName: 'Astraterra Properties', senderEmail: 'admin@astraterra.ae', templateId: '', listIds: [3], scheduledAt: '', htmlContent: '' });
      } else {
        setError(data.detail || data.error || 'Failed to send campaign');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px' }}>
      {result && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#22c55e', fontWeight: 600, margin: '0 0 4px' }}>✅ {result.message}</p>
            {result.campaignId && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 }}>Campaign ID: {result.campaignId}</p>}
          </div>
          <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ color: '#f87171', margin: 0 }}>❌ {error}</p>
        </div>
      )}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Campaign Name *</label>
            <input style={inputStyle} placeholder="e.g. March Property Newsletter" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Subject Line *</label>
            <input style={inputStyle} placeholder="e.g. Discover Dubai's Latest Luxury Listings" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Sender Name</label>
              <input style={inputStyle} value={form.senderName} onChange={e => setForm({ ...form, senderName: e.target.value })} />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Sender Email</label>
              <input style={inputStyle} value={form.senderEmail} onChange={e => setForm({ ...form, senderEmail: e.target.value })} />
            </div>
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Template</label>
            <select style={{ ...inputStyle, appearance: 'none' }} value={form.templateId} onChange={e => setForm({ ...form, templateId: e.target.value })}>
              <option value="">— No template (use HTML content below) —</option>
              {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Contact List</label>
            <select style={{ ...inputStyle, appearance: 'none' }} value={form.listIds[0]} onChange={e => setForm({ ...form, listIds: [parseInt(e.target.value)] })}>
              <option value={3}>All Clients (List #3)</option>
              {lists.map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l.uniqueSubscribers || 0} subscribers)</option>)}
            </select>
          </div>
          {!form.templateId && (
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>HTML Content (optional)</label>
              <textarea
                style={{ ...inputStyle, height: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                placeholder="<div>Your email HTML content here...</div>"
                value={form.htmlContent}
                onChange={e => setForm({ ...form, htmlContent: e.target.value })}
              />
            </div>
          )}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Schedule For (optional)</label>
            <input type="datetime-local" style={inputStyle} value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
            <button style={btnGold} onClick={() => handleSend(false)} disabled={sending}>
              <Send style={{ width: 15, height: 15 }} />
              {sending ? 'Sending...' : 'Send Now'}
            </button>
            <button style={btnSecondary} onClick={() => handleSend(true)} disabled={sending || !form.scheduledAt}>
              <Clock style={{ width: 15, height: 15 }} />
              Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Templates Tab ──────────────────────────────────────────────────────────
function TemplatesTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/email/templates', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setTemplates(d.templates || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>Loading templates...</div>;

  return (
    <div>
      {templates.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '60px' }}>
          <FileText style={{ width: 48, height: 48, color: 'rgba(201,169,110,0.4)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>No templates found</p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Create templates in your Brevo dashboard at app.brevo.com</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {templates.map((t: any) => (
            <div key={t.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ color: 'white', fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>{t.name}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>ID: {t.id}</p>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: t.isActive ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)', color: t.isActive ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
                  {t.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 4px' }}>Subject: {t.subject}</p>
              {t.updatedAt && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 }}>Updated: {new Date(t.updatedAt).toLocaleDateString()}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stats Tab ──────────────────────────────────────────────────────────────
function StatsTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/email/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setStats(d.stats); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>Loading stats...</div>;
  if (!stats) return <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>No stats available</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon={Send} label="Total Emails Sent" value={stats.totalSent?.toLocaleString() || 0} sub="Across all campaigns" color="#C9A96E" />
        <StatCard icon={Eye} label="Total Opens" value={stats.totalOpened?.toLocaleString() || 0} sub={`${stats.openRate}% open rate`} color="#60a5fa" />
        <StatCard icon={MousePointerClick} label="Total Clicks" value={stats.totalClicked?.toLocaleString() || 0} sub={`${stats.clickRate}% click rate`} color="#a78bfa" />
        <StatCard icon={UserMinus} label="Unsubscribes" value={stats.totalUnsubscribed?.toLocaleString() || 0} sub="Recent campaigns" color="#f87171" />
      </div>
      <div style={cardStyle}>
        <h3 style={{ color: 'white', fontWeight: 600, marginBottom: '16px' }}>Campaign Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 4px' }}>Campaigns Analyzed</p>
            <p style={{ color: 'white', fontSize: '20px', fontWeight: 700 }}>{stats.campaignCount}</p>
          </div>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 4px' }}>Last Campaign</p>
            <p style={{ color: '#C9A96E', fontSize: '14px', fontWeight: 600 }}>{stats.lastCampaign || '—'}</p>
            {stats.lastCampaignDate && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: 0 }}>{new Date(stats.lastCampaignDate).toLocaleDateString()}</p>}
          </div>
        </div>
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Open Rate</span>
            <span style={{ color: '#C9A96E', fontWeight: 600 }}>{stats.openRate}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '8px' }}>
            <div style={{ background: 'linear-gradient(90deg,#C9A96E,#8A6F2F)', height: '100%', borderRadius: '4px', width: `${Math.min(stats.openRate, 100)}%`, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', marginTop: '12px' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Click Rate</span>
            <span style={{ color: '#60a5fa', fontWeight: 600 }}>{stats.clickRate}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '8px' }}>
            <div style={{ background: 'linear-gradient(90deg,#60a5fa,#3b82f6)', height: '100%', borderRadius: '4px', width: `${Math.min(stats.clickRate * 5, 100)}%`, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function EmailMarketingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Campaigns');
  const tabIcons: Record<Tab, any> = { Campaigns: BarChart3, 'Send Campaign': Send, Templates: FileText, Stats: TrendingUp };

  return (
    <div style={{ minHeight: '100vh', background: '#131B2B', padding: '28px', color: 'white' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ color: 'white', fontSize: '26px', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Mail style={{ width: 28, height: 28, color: '#C9A96E' }} />
              Email Marketing
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Brevo-powered campaigns to your 2,600+ contacts</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
          {TABS.map((tab) => {
            const Icon = tabIcons[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: activeTab === tab ? 'linear-gradient(135deg,#C9A96E,#8A6F2F)' : 'transparent',
                  color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.55)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {tab}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'Campaigns' && <CampaignsTab />}
        {activeTab === 'Send Campaign' && <SendCampaignTab />}
        {activeTab === 'Templates' && <TemplatesTab />}
        {activeTab === 'Stats' && <StatsTab />}
      </div>
    </div>
  );
}
