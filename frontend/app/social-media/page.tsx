'use client';

import { useState, useEffect } from 'react';
import {
  Share2, Calendar, PenSquare, BarChart3, List, Send, Clock,
  Plus, Trash2, TrendingUp, Users, Heart, Eye, RefreshCw, X, CheckCircle,
  Wifi, WifiOff, Loader2, AlertCircle
} from 'lucide-react';

const TABS = ['Calendar', 'Create Post', 'Drafts', 'Upcoming Posts', 'Analytics'] as const;
type Tab = typeof TABS[number];

// ─── All 10 Platforms ────────────────────────────────────────────────────────
const PLATFORMS = [
  // Buffer platforms
  { id: 'twitter',          name: 'Twitter/X',              color: '#000000', emoji: '🐦', via: 'Buffer',    limit: 280  },
  { id: 'linkedin-personal',name: 'LinkedIn Personal',       color: '#0a66c2', emoji: '💼', via: 'Buffer',    limit: 3000 },
  { id: 'linkedin-company', name: 'LinkedIn Company',        color: '#0056a3', emoji: '🏢', via: 'Buffer',    limit: 3000 },
  // Metricool platforms
  { id: 'facebook',         name: 'Facebook',                color: '#1877f2', emoji: '📘', via: 'Metricool', limit: 63206 },
  { id: 'instagram',        name: 'Instagram',               color: '#e1306c', emoji: '📷', via: 'Metricool', limit: 2200  },
  { id: 'tiktok',           name: 'TikTok',                  color: '#010101', emoji: '🎵', via: 'Metricool', limit: 2200  },
  { id: 'threads',          name: 'Threads',                 color: '#101010', emoji: '🧵', via: 'Metricool', limit: 500   },
  { id: 'bluesky',          name: 'Bluesky',                 color: '#0285ff', emoji: '🦋', via: 'Metricool', limit: 300   },
  { id: 'pinterest',        name: 'Pinterest',               color: '#bd081c', emoji: '📌', via: 'Metricool', limit: 500   },
  { id: 'youtube',          name: 'YouTube',                 color: '#ff0000', emoji: '📺', via: 'Metricool', limit: 5000  },
  { id: 'google-business',  name: 'Google Business',         color: '#4285f4', emoji: '🔍', via: 'Metricool', limit: 1500  },
] as const;

type PlatformId = typeof PLATFORMS[number]['id'];

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
  boxSizing: 'border-box',
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

function PlatformBadge({ platformId, size = 'sm' }: { platformId: string; size?: 'sm' | 'md' }) {
  const p = PLATFORMS.find(x => x.id === platformId);
  if (!p) return <span style={{ fontSize: '11px', color: '#aaa', padding: '2px 6px', border: '1px solid #333', borderRadius: '8px' }}>{platformId}</span>;
  const pad = size === 'sm' ? '2px 8px' : '4px 12px';
  const fs  = size === 'sm' ? '11px' : '13px';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: pad, borderRadius: '12px', fontSize: fs, fontWeight: 600, background: `${p.color}33`, color: p.color, border: `1px solid ${p.color}55` }}>
      {p.emoji} {p.name}
    </span>
  );
}

// ─── Platform Status Panel ───────────────────────────────────────────────────
function PlatformStatusPanel() {
  const [status, setStatus] = useState<Record<string, { connected: boolean; via: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/social/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setStatus(d.platforms || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ ...cardStyle, marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Wifi style={{ width: 16, height: 16, color: '#C9A96E' }} />
        <h3 style={{ color: 'white', fontSize: '14px', fontWeight: 600, margin: 0 }}>Platform Connections</h3>
        {loading && <Loader2 style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {PLATFORMS.map(p => {
          const s = status[p.id];
          const connected = s?.connected ?? null;
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '20px', fontSize: '12px',
              background: connected === true ? `${p.color}22` : connected === false ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${connected === true ? `${p.color}55` : connected === false ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
              color: connected === true ? p.color : connected === false ? '#f87171' : 'rgba(255,255,255,0.4)',
            }}>
              {p.emoji}
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>via {p.via}</span>
              {connected === true && <CheckCircle style={{ width: 12, height: 12, color: '#22c55e' }} />}
              {connected === false && <WifiOff style={{ width: 12, height: 12, color: '#f87171' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Calendar Tab ────────────────────────────────────────────────────────────
function CalendarTab() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/social/scheduled', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setPosts(d.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const postsByDate: Record<string, any[]> = {};
  posts.forEach(p => {
    const date = p.scheduledAt ? new Date(p.scheduledAt).toDateString() : null;
    if (date) {
      if (!postsByDate[date]) postsByDate[date] = [];
      postsByDate[date].push(p);
    }
  });

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={prevMonth} style={{ ...btnGold, padding: '8px 16px' }}>‹</button>
        <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700 }}>
          {currentMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={nextMonth} style={{ ...btnGold, padding: '8px 16px' }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', color: '#C9A96E', fontSize: '12px', fontWeight: 600, padding: '8px 0' }}>{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const date = new Date(year, month, day);
          const dayPosts = postsByDate[date.toDateString()] || [];
          const isToday = date.toDateString() === today.toDateString();
          return (
            <div key={day} style={{
              minHeight: '80px',
              background: isToday ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
              borderRadius: '8px', padding: '6px',
              border: isToday ? '1px solid rgba(201,169,110,0.4)' : '1px solid rgba(255,255,255,0.06)',
            }}>
              <p style={{ color: isToday ? '#C9A96E' : 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: isToday ? 700 : 400, margin: '0 0 4px' }}>{day}</p>
              {dayPosts.slice(0, 2).map((p, i) => {
                const net = (p.networks || ['facebook'])[0];
                const plat = PLATFORMS.find(x => x.id === net);
                return (
                  <div key={i} style={{
                    background: `${plat?.color || '#C9A96E'}33`,
                    borderLeft: `3px solid ${plat?.color || '#C9A96E'}`,
                    borderRadius: '3px', padding: '2px 4px',
                    fontSize: '10px', color: 'white',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>{plat?.emoji} {p.content?.substring(0, 18)}...</div>
                );
              })}
              {dayPosts.length > 2 && <div style={{ fontSize: '10px', color: '#C9A96E', textAlign: 'center' }}>+{dayPosts.length - 2}</div>}
            </div>
          );
        })}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Loading...
      </div>}
    </div>
  );
}

// ─── Create Post Tab ─────────────────────────────────────────────────────────
function CreatePostTab() {
  const [content, setContent] = useState('');
  const [selected, setSelected] = useState<string[]>(['instagram', 'facebook']);
  const [scheduledAt, setScheduledAt] = useState('');
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const lowestLimit = selected.reduce((min, id) => {
    const p = PLATFORMS.find(x => x.id === id);
    return p ? Math.min(min, p.limit) : min;
  }, Infinity);

  const overLimit = selected.some(id => {
    const p = PLATFORMS.find(x => x.id === id);
    return p ? content.length > p.limit : false;
  });

  const handlePost = async (schedule: boolean) => {
    if (!content.trim()) { setError('Post content is required'); return; }
    if (selected.length === 0) { setError('Select at least one platform'); return; }
    if (overLimit) { setError('Content exceeds character limit for some platforms'); return; }
    setError(''); setPosting(true);
    const token = localStorage.getItem('token');
    try {
      const payload: any = { content, platforms: selected };
      if (schedule && scheduledAt) payload.scheduledAt = scheduledAt;
      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data); setContent(''); setScheduledAt('');
      } else {
        setError(data.error || data.detail || 'Failed to post');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      {result && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: '#22c55e', fontWeight: 600, margin: '0 0 8px' }}>✅ {result.message}</p>
            {result.results?.map((r: any, i: number) => (
              <div key={i} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                {r.success ? '✓' : '✗'} {r.platform} via {r.source} {r.postId ? `(${r.postId})` : ''}
              </div>
            ))}
            {result.errors?.map((e: any, i: number) => (
              <div key={i} style={{ fontSize: '12px', color: '#f87171' }}>✗ {e.platform}: {e.error}</div>
            ))}
          </div>
          <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '16px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <AlertCircle style={{ width: 16, height: 16, color: '#f87171', flexShrink: 0 }} />
          <p style={{ color: '#f87171', margin: 0 }}>{error}</p>
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Platform Selection */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '10px' }}>Select Platforms *</label>
            {/* Buffer group */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📡 Via Buffer</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PLATFORMS.filter(p => p.via === 'Buffer').map(p => {
                  const sel = selected.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => toggle(p.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      background: sel ? `${p.color}33` : 'rgba(255,255,255,0.06)',
                      border: sel ? `2px solid ${p.color}` : '2px solid transparent',
                      color: sel ? p.color : 'rgba(255,255,255,0.5)',
                    }}>
                      {p.emoji} {p.name}
                      {sel && <CheckCircle style={{ width: 11, height: 11 }} />}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Metricool group */}
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Via Metricool</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PLATFORMS.filter(p => p.via === 'Metricool').map(p => {
                  const sel = selected.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => toggle(p.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      background: sel ? `${p.color}33` : 'rgba(255,255,255,0.06)',
                      border: sel ? `2px solid ${p.color}` : '2px solid transparent',
                      color: sel ? p.color : 'rgba(255,255,255,0.5)',
                    }}>
                      {p.emoji} {p.name}
                      {sel && <CheckCircle style={{ width: 11, height: 11 }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Content */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Post Content *</label>
            <textarea
              style={{ ...inputStyle, height: '160px', resize: 'vertical' }}
              placeholder="Share something about Astraterra Properties... 🏙️✨"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            <div style={{ marginTop: '8px' }}>
              {/* Per-platform char counters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selected.map(id => {
                  const p = PLATFORMS.find(x => x.id === id);
                  if (!p) return null;
                  const left = p.limit - content.length;
                  const over = left < 0;
                  return (
                    <div key={id} style={{
                      padding: '3px 10px', borderRadius: '12px', fontSize: '11px',
                      background: over ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                      color: over ? '#f87171' : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${over ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      {p.emoji} {over ? `${Math.abs(left)} over` : `${left} left`}
                    </div>
                  );
                })}
                <div style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.03)' }}>
                  {content.length} chars
                </div>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
              📅 Schedule For (optional — leave blank to add to queue)
            </label>
            <input type="datetime-local" style={inputStyle} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
            <button style={btnGold} onClick={() => handlePost(false)} disabled={posting}>
              <Send style={{ width: 15, height: 15 }} />
              {posting ? 'Posting...' : 'Add to Queue'}
            </button>
            <button
              style={{ ...btnGold, background: 'rgba(201,169,110,0.2)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.4)', opacity: scheduledAt ? 1 : 0.5 }}
              onClick={() => handlePost(true)}
              disabled={posting || !scheduledAt}
            >
              <Clock style={{ width: 15, height: 15 }} />
              Schedule at Time
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drafts Tab ──────────────────────────────────────────────────────────────
function DraftsTab() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch('/api/social/drafts', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setDrafts(d.drafts || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  const deleteDraft = async (id: string) => {
    if (!confirm('Delete this draft?')) return;
    setDeleting(id);
    const token = localStorage.getItem('token');
    await fetch(`/api/social/draft/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setDeleting(null);
    load();
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} /> Loading Buffer drafts...
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 600, margin: 0 }}>Buffer Drafts ({drafts.length})</h2>
        <button onClick={load} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
        </button>
      </div>
      {drafts.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '60px' }}>
          <PenSquare style={{ width: 48, height: 48, color: 'rgba(201,169,110,0.4)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>No Buffer drafts found</p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Create posts in the "Create Post" tab</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {drafts.map((d: any) => (
            <div key={d.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'white', fontSize: '14px', margin: '0 0 10px', lineHeight: 1.5 }}>
                    {d.content?.substring(0, 250)}{d.content?.length > 250 ? '...' : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <PlatformBadge platformId={d.platform} />
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>Draft</span>
                  </div>
                </div>
                <button onClick={() => deleteDraft(d.id)} disabled={deleting === d.id}
                  style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '8px', color: '#f87171', padding: '8px', cursor: 'pointer', marginLeft: '12px', flexShrink: 0 }}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
              {d.createdAt && (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock style={{ width: 11, height: 11 }} />
                  Created {new Date(d.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Upcoming Posts Tab ──────────────────────────────────────────────────────
function UpcomingPostsTab() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch('/api/social/scheduled', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setPosts(d.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  const handleDelete = async (id: string, source: string) => {
    if (!confirm('Remove this post?')) return;
    setDeleting(id);
    const token = localStorage.getItem('token');
    const endpoint = source === 'buffer' ? `/api/social/draft/${id}` : `/api/social/post/${id}`;
    await fetch(endpoint, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setDeleting(null);
    load();
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} /> Loading scheduled posts...
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 600, margin: 0 }}>
          Scheduled Posts ({posts.length})
        </h2>
        <button onClick={load} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
        </button>
      </div>
      {posts.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '60px' }}>
          <Calendar style={{ width: 48, height: 48, color: 'rgba(201,169,110,0.4)', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>No scheduled posts</p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>Create a post in the "Create Post" tab</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {posts.map((p: any, i) => {
            const scheduled = p.scheduledAt ? new Date(p.scheduledAt) : null;
            return (
              <div key={p.id || i} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'white', fontSize: '14px', margin: '0 0 10px', lineHeight: 1.5 }}>
                      {p.content?.substring(0, 220)}{p.content?.length > 220 ? '...' : ''}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {(p.networks || ['facebook']).map((net: string) => <PlatformBadge key={net} platformId={net} />)}
                      {p.source && (
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                          via {p.source}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(p.id, p.source)} disabled={deleting === p.id}
                    style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '8px', color: '#f87171', padding: '8px', cursor: 'pointer', marginLeft: '12px', flexShrink: 0 }}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                {scheduled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#C9A96E', fontSize: '12px' }}>
                    <Clock style={{ width: 12, height: 12 }} />
                    {scheduled.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                    {scheduled.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
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

// ─── Analytics Tab ───────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/social/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setAnalytics(d.analytics); setIsMock(!!d.mock); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} /> Loading analytics...
    </div>
  );

  if (!analytics) return <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>No analytics available</div>;

  return (
    <div>
      {isMock && (
        <div style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <AlertCircle style={{ width: 14, height: 14, color: '#C9A96E' }} />
          <p style={{ color: '#C9A96E', fontSize: '13px', margin: 0 }}>Showing sample data. Live Metricool analytics will appear once API auth is configured.</p>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {Object.entries(analytics).map(([platformId, data]: [string, any]) => {
          const p = PLATFORMS.find(x => x.id === platformId);
          if (!p) return null;
          return (
            <div key={platformId} style={{ ...cardStyle, borderTop: `3px solid ${p.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>{p.emoji}</span>
                <div>
                  <h3 style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: 0 }}>{p.name}</h3>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>via {p.via}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <Users style={{ width: 14, height: 14, color: p.color, margin: '0 auto 4px' }} />
                  <p style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: '0 0 2px' }}>{data.followers?.toLocaleString() || 0}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', margin: 0 }}>Followers</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <TrendingUp style={{ width: 14, height: 14, color: '#f87171', margin: '0 auto 4px' }} />
                  <p style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: '0 0 2px' }}>{data.engagement}%</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', margin: 0 }}>Engagement</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <Eye style={{ width: 14, height: 14, color: '#60a5fa', margin: '0 auto 4px' }} />
                  <p style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: '0 0 2px' }}>{data.reach?.toLocaleString() || 0}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', margin: 0 }}>Reach</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <PenSquare style={{ width: 14, height: 14, color: '#a78bfa', margin: '0 auto 4px' }} />
                  <p style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: '0 0 2px' }}>{data.posts || 0}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', margin: 0 }}>Posts</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SocialMediaPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Calendar');

  const tabIcons: Record<Tab, any> = {
    'Calendar': Calendar,
    'Create Post': PenSquare,
    'Drafts': List,
    'Upcoming Posts': Clock,
    'Analytics': BarChart3,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#131B2B', padding: '28px', color: 'white' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: 'white', fontSize: '26px', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Share2 style={{ width: 28, height: 28, color: '#C9A96E' }} />
              Social Media Manager
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
              Schedule & publish across 11 platforms — via Buffer & Metricool
            </p>
          </div>
          <button onClick={() => setActiveTab('Create Post')} style={btnGold}>
            <Plus style={{ width: 16, height: 16 }} />
            New Post
          </button>
        </div>

        {/* Platform Status */}
        <PlatformStatusPanel />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '4px', width: 'fit-content', flexWrap: 'wrap' }}>
          {TABS.map(tab => {
            const Icon = tabIcons[tab];
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: activeTab === tab ? 'linear-gradient(135deg,#C9A96E,#8A6F2F)' : 'transparent',
                color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.55)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}>
                <Icon style={{ width: 14, height: 14 }} />
                {tab}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'Calendar' && <CalendarTab />}
        {activeTab === 'Create Post' && <CreatePostTab />}
        {activeTab === 'Drafts' && <DraftsTab />}
        {activeTab === 'Upcoming Posts' && <UpcomingPostsTab />}
        {activeTab === 'Analytics' && <AnalyticsTab />}
      </div>
    </div>
  );
}
