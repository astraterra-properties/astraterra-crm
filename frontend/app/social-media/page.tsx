'use client';

import { useState, useEffect } from 'react';
import {
  Share2, Calendar, PenSquare, BarChart3, List, Send, Clock,
  Facebook, Instagram, Twitter, Linkedin, Plus, Trash2, Edit3,
  TrendingUp, Users, Heart, Eye, RefreshCw, X, CheckCircle
} from 'lucide-react';

const TABS = ['Calendar', 'Create Post', 'Analytics', 'Upcoming Posts'] as const;
type Tab = typeof TABS[number];

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', color: '#1877f2', emoji: '📘' },
  { id: 'instagram', name: 'Instagram', color: '#e1306c', emoji: '📷' },
  { id: 'twitter', name: 'Twitter/X', color: '#000000', emoji: '🐦' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', emoji: '💼' },
  { id: 'tiktok', name: 'TikTok', color: '#00f2ea', emoji: '🎵' },
  { id: 'pinterest', name: 'Pinterest', color: '#bd081c', emoji: '📌' },
  { id: 'google', name: 'Google Business', color: '#4285f4', emoji: '🔍' },
];

const CHAR_LIMITS: Record<string, number> = {
  twitter: 280, facebook: 63206, instagram: 2200, linkedin: 3000, tiktok: 2200, pinterest: 500, google: 1500
};

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

function PlatformBadge({ platform, size = 'sm' }: { platform: string; size?: 'sm' | 'md' }) {
  const p = PLATFORMS.find(x => x.id === platform);
  if (!p) return null;
  const pad = size === 'sm' ? '2px 8px' : '4px 12px';
  const fs = size === 'sm' ? '11px' : '13px';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: pad, borderRadius: '12px', fontSize: fs, fontWeight: 600, background: `${p.color}33`, color: p.color, border: `1px solid ${p.color}55` }}>
      {p.emoji} {p.name}
    </span>
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
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const date = new Date(year, month, day);
          const dateStr = date.toDateString();
          const dayPosts = postsByDate[dateStr] || [];
          const isToday = date.toDateString() === today.toDateString();
          return (
            <div key={day} style={{
              minHeight: '80px',
              background: isToday ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              padding: '6px',
              border: isToday ? '1px solid rgba(201,169,110,0.4)' : '1px solid rgba(255,255,255,0.06)',
            }}>
              <p style={{ color: isToday ? '#C9A96E' : 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: isToday ? 700 : 400, margin: '0 0 4px' }}>{day}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {dayPosts.slice(0, 2).map((p, i) => {
                  const net = p.networks?.[0] || 'facebook';
                  const platform = PLATFORMS.find(x => x.id === net);
                  return (
                    <div key={i} style={{
                      background: `${platform?.color || '#C9A96E'}33`,
                      borderLeft: `3px solid ${platform?.color || '#C9A96E'}`,
                      borderRadius: '3px',
                      padding: '2px 4px',
                      fontSize: '10px',
                      color: 'white',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}>{platform?.emoji} {p.content?.substring(0, 20)}...</div>
                  );
                })}
                {dayPosts.length > 2 && (
                  <div style={{ fontSize: '10px', color: '#C9A96E', textAlign: 'center' }}>+{dayPosts.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)' }}>
          <RefreshCw style={{ width: 20, height: 20, margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
          Loading scheduled posts...
        </div>
      )}
    </div>
  );
}

// ─── Create Post Tab ─────────────────────────────────────────────────────────
function CreatePostTab() {
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'facebook']);
  const [scheduledAt, setScheduledAt] = useState('');
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const minCharsLeft = selectedPlatforms.reduce((min, pid) => Math.min(min, (CHAR_LIMITS[pid] || 2200) - content.length), Infinity);
  const overLimit = selectedPlatforms.some(pid => content.length > (CHAR_LIMITS[pid] || 2200));

  const handlePost = async (schedule = false) => {
    if (!content.trim()) { setError('Post content is required'); return; }
    if (selectedPlatforms.length === 0) { setError('Select at least one platform'); return; }
    if (overLimit) { setError('Content exceeds character limit for selected platforms'); return; }
    setError('');
    setPosting(true);
    const token = localStorage.getItem('token');
    try {
      const payload: any = { content, platforms: selectedPlatforms };
      if (schedule && scheduledAt) payload.scheduledAt = scheduledAt;
      const res = await fetch('/api/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        setContent('');
        setScheduledAt('');
      } else {
        setError(data.detail || data.error || 'Failed to post');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px' }}>
      {result && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#22c55e', fontWeight: 600, margin: 0 }}>✅ {result.message} {result.mock ? '(Metricool auth pending — will connect once JWT available)' : ''}</p>
          <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ color: '#f87171', margin: 0 }}>❌ {error}</p>
        </div>
      )}
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Platform Selection */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '10px' }}>Platforms *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {PLATFORMS.map(p => {
                const selected = selectedPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s',
                      background: selected ? `${p.color}33` : 'rgba(255,255,255,0.06)',
                      border: selected ? `2px solid ${p.color}` : '2px solid transparent',
                      color: selected ? p.color : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {p.emoji} {p.name}
                    {selected && <CheckCircle style={{ width: 12, height: 12 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Post Content *</label>
            <textarea
              style={{ ...inputStyle, height: '140px', resize: 'vertical' }}
              placeholder="Share something about Astraterra Properties... ✨"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              <span style={{ fontSize: '12px', color: overLimit ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
                {content.length} characters
                {selectedPlatforms.includes('twitter') && ` (Twitter limit: 280)`}
              </span>
              {overLimit && <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>⚠ Over limit for some platforms</span>}
            </div>
          </div>

          {/* Per-platform char counts */}
          {selectedPlatforms.length > 0 && content.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {selectedPlatforms.map(pid => {
                const limit = CHAR_LIMITS[pid] || 2200;
                const left = limit - content.length;
                const over = left < 0;
                const p = PLATFORMS.find(x => x.id === pid);
                return (
                  <div key={pid} style={{
                    padding: '4px 12px', borderRadius: '12px', fontSize: '12px',
                    background: over ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                    color: over ? '#f87171' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${over ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  }}>
                    {p?.emoji} {over ? `${Math.abs(left)} over` : `${left} left`}
                  </div>
                );
              })}
            </div>
          )}

          {/* Schedule */}
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Schedule For (optional)</label>
            <input type="datetime-local" style={inputStyle} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
            <button style={btnGold} onClick={() => handlePost(false)} disabled={posting}>
              <Send style={{ width: 15, height: 15 }} />
              {posting ? 'Posting...' : 'Post Now'}
            </button>
            <button
              style={{ ...btnGold, background: 'rgba(201,169,110,0.2)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.4)' }}
              onClick={() => handlePost(true)}
              disabled={posting || !scheduledAt}
            >
              <Clock style={{ width: 15, height: 15 }} />
              Schedule
            </button>
          </div>
        </div>
      </div>
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

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>Loading analytics...</div>;
  if (!analytics) return <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>No analytics available</div>;

  return (
    <div>
      {isMock && (
        <div style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
          <p style={{ color: '#C9A96E', fontSize: '13px', margin: 0 }}>ℹ️ Showing sample data. Live Metricool data will appear once API authentication is configured.</p>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {Object.entries(analytics).map(([platform, data]: [string, any]) => {
          const p = PLATFORMS.find(x => x.id === platform);
          if (!p) return null;
          return (
            <div key={platform} style={{ ...cardStyle, borderTop: `3px solid ${p.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>{p.emoji}</span>
                <h3 style={{ color: 'white', fontSize: '16px', fontWeight: 700, margin: 0 }}>{p.name}</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <Users style={{ width: 16, height: 16, color: p.color, margin: '0 auto 4px' }} />
                  <p style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: '0 0 2px' }}>{data.followers?.toLocaleString() || 0}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0 }}>Followers</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <Heart style={{ width: 16, height: 16, color: '#f87171', margin: '0 auto 4px' }} />
                  <p style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: '0 0 2px' }}>{data.engagement}%</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0 }}>Engagement</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <Eye style={{ width: 16, height: 16, color: '#60a5fa', margin: '0 auto 4px' }} />
                  <p style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: '0 0 2px' }}>{data.reach?.toLocaleString() || 0}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0 }}>Reach</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <PenSquare style={{ width: 16, height: 16, color: '#a78bfa', margin: '0 auto 4px' }} />
                  <p style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: '0 0 2px' }}>{data.posts || 0}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: 0 }}>Posts</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Upcoming Posts Tab ──────────────────────────────────────────────────────
function UpcomingPostsTab() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    fetch('/api/social/upcoming', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setPosts(d.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this scheduled post?')) return;
    setDeleting(id);
    const token = localStorage.getItem('token');
    await fetch(`/api/social/post/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setDeleting(null);
    load();
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>Loading upcoming posts...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 600, margin: 0 }}>Next 7 Days</h2>
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
                    <p style={{ color: 'white', fontSize: '14px', margin: '0 0 8px', lineHeight: 1.5 }}>
                      {p.content?.substring(0, 200)}{p.content?.length > 200 ? '...' : ''}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {(p.networks || ['facebook']).map((net: string) => <PlatformBadge key={net} platform={net} />)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleting === p.id}
                    style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '8px', color: '#f87171', padding: '8px', cursor: 'pointer', marginLeft: '12px', flexShrink: 0 }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                {scheduled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#C9A96E', fontSize: '12px' }}>
                    <Clock style={{ width: 12, height: 12 }} />
                    {scheduled.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })} at {scheduled.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
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

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SocialMediaPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Calendar');
  const tabIcons: Record<Tab, any> = { Calendar, 'Create Post': PenSquare, Analytics: BarChart3, 'Upcoming Posts': List };

  return (
    <div style={{ minHeight: '100vh', background: '#131B2B', padding: '28px', color: 'white' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ color: 'white', fontSize: '26px', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Share2 style={{ width: 28, height: 28, color: '#C9A96E' }} />
              Social Media
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Schedule & manage posts across all platforms via Metricool</p>
          </div>
          <button onClick={() => setActiveTab('Create Post')} style={btnGold}>
            <Plus style={{ width: 16, height: 16 }} />
            New Post
          </button>
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
        {activeTab === 'Calendar' && <CalendarTab />}
        {activeTab === 'Create Post' && <CreatePostTab />}
        {activeTab === 'Analytics' && <AnalyticsTab />}
        {activeTab === 'Upcoming Posts' && <UpcomingPostsTab />}
      </div>
    </div>
  );
}
