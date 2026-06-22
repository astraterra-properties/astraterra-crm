'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, Send, Users, Plus, RefreshCw, Trash2, BarChart3, Gauge, Clock, AlertTriangle,
} from 'lucide-react';

const TABS = ['Overview', 'Segments', 'Campaigns', 'Automations'] as const;
type Tab = typeof TABS[number];

interface Stats { sent: number; failed: number; opens: number; clicks: number; unsubscribes: number; pending: number; openRate: number; clickRate: number; live: boolean; }
interface SenderInfo { live: boolean; remainingToday: number; senders: { email: string; dailyLimit: number; active: boolean }[]; }
interface Segment { id: number; name: string; description: string; rules: string; }
interface Campaign { id: number; name: string; subject: string; status: string; total: number; sent_count: number; fail_count: number; segment_id: number; created_at: string; }
interface Automation { id: number; name: string; trigger_type: string; conditions: string; subject: string; delay_minutes: number; active: number; }

const TRIGGERS = ['lead_created', 'status_changed', 'score_threshold', 'source_match', 'inactivity'];

const card = { background: '#0f1e34', border: '1px solid rgba(197,162,101,0.15)' };
const gold = '#C5A265';
const inputCls = 'w-full px-3 py-2 text-sm rounded-lg focus:outline-none';
const inputSt = { background: '#0d1e38', border: '1px solid rgba(197,162,101,0.22)', color: '#e8d9be' } as const;

export default function EmailAutomationPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [token, setToken] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [senders, setSenders] = useState<SenderInfo | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [msg, setMsg] = useState('');

  const hdrs = (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
  const api = '/api/email-marketing';

  const loadAll = useCallback(async (t: string) => {
    try {
      const [s, sd, sg, cp, au] = await Promise.all([
        fetch(`${api}/stats`, { headers: hdrs(t) }).then((r) => r.json()),
        fetch(`${api}/senders`, { headers: hdrs(t) }).then((r) => r.json()),
        fetch(`${api}/segments`, { headers: hdrs(t) }).then((r) => r.json()),
        fetch(`${api}/campaigns`, { headers: hdrs(t) }).then((r) => r.json()),
        fetch(`${api}/automations`, { headers: hdrs(t) }).then((r) => r.json()),
      ]);
      setStats(s); setSenders(sd);
      setSegments(Array.isArray(sg) ? sg : []);
      setCampaigns(Array.isArray(cp) ? cp : []);
      setAutomations(Array.isArray(au) ? au : []);
    } catch { setMsg('Failed to load — check you are logged in as admin.'); }
  }, []);

  useEffect(() => {
    const t = localStorage.getItem('token') || '';
    setToken(t);
    if (t) loadAll(t);
  }, [loadAll]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  return (
    <div className="min-h-screen p-6" style={{ background: '#0a1628', color: '#e8d9be' }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap size={26} style={{ color: gold }} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: gold }}>Email Automation</h1>
            <p className="text-xs opacity-60">In-house engine · Gmail transport · no Brevo</p>
          </div>
        </div>
        <button onClick={() => loadAll(token)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={card}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {!senders?.live && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-lg text-sm"
          style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308' }}>
          <AlertTriangle size={16} /> DRY-RUN mode — emails are logged but not actually sent. Set <code className="mx-1">EMAIL_LIVE=true</code> to go live.
        </div>
      )}
      {msg && <div className="mb-4 px-4 py-2.5 rounded-lg text-sm" style={{ background: 'rgba(197,162,101,0.12)', color: gold }}>{msg}</div>}

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={tab === t ? { background: gold, color: '#0a1628' } : card}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && <Overview stats={stats} senders={senders} />}
      {tab === 'Segments' && <Segments token={token} segments={segments} reload={() => loadAll(token)} flash={flash} hdrs={hdrs} api={api} />}
      {tab === 'Campaigns' && <Campaigns token={token} campaigns={campaigns} segments={segments} reload={() => loadAll(token)} flash={flash} hdrs={hdrs} api={api} />}
      {tab === 'Automations' && <Automations token={token} automations={automations} reload={() => loadAll(token)} flash={flash} hdrs={hdrs} api={api} />}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl" style={card}>
      <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">{icon}{label}</div>
      <div className="text-2xl font-bold" style={{ color: '#C5A265' }}>{value}</div>
    </div>
  );
}

function Overview({ stats, senders }: { stats: Stats | null; senders: SenderInfo | null }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={<Send size={14} />} label="Sent" value={stats?.sent ?? '—'} />
        <Stat icon={<BarChart3 size={14} />} label="Open rate" value={`${stats?.openRate ?? 0}%`} />
        <Stat icon={<BarChart3 size={14} />} label="Click rate" value={`${stats?.clickRate ?? 0}%`} />
        <Stat icon={<Clock size={14} />} label="Queued" value={stats?.pending ?? '—'} />
        <Stat icon={<BarChart3 size={14} />} label="Opens" value={stats?.opens ?? '—'} />
        <Stat icon={<BarChart3 size={14} />} label="Clicks" value={stats?.clicks ?? '—'} />
        <Stat icon={<Users size={14} />} label="Unsubscribes" value={stats?.unsubscribes ?? '—'} />
        <Stat icon={<AlertTriangle size={14} />} label="Failed" value={stats?.failed ?? '—'} />
      </div>
      <div className="p-5 rounded-xl" style={card}>
        <div className="flex items-center gap-2 mb-3" style={{ color: '#C5A265' }}><Gauge size={18} /> Sending capacity (today)</div>
        <div className="text-3xl font-bold mb-2" style={{ color: '#C5A265' }}>{senders?.remainingToday ?? '—'} <span className="text-sm opacity-60 font-normal">emails left today</span></div>
        <div className="space-y-1 text-sm opacity-80">
          {senders?.senders?.map((s) => (
            <div key={s.email} className="flex justify-between border-b py-1" style={{ borderColor: 'rgba(197,162,101,0.1)' }}>
              <span>{s.email}</span><span>{s.dailyLimit}/day {s.active ? '' : '(inactive)'}</span>
            </div>
          ))}
        </div>
        <p className="text-xs opacity-50 mt-3">Need more than {senders?.senders?.reduce((a, s) => a + s.dailyLimit, 0) ?? 2000}/day? Add senders to EMAIL_SENDERS — each adds ~2k/day free.</p>
      </div>
    </div>
  );
}

function Segments({ token, segments, reload, flash, hdrs, api }: any) {
  const [name, setName] = useState('');
  const [base, setBase] = useState('leads');
  const [status, setStatus] = useState('');
  const [sources, setSources] = useState('');
  const [scoreMin, setScoreMin] = useState('');
  const [preview, setPreview] = useState<Record<number, number>>({});

  const rules = () => ({
    base,
    status: status ? status.split(',').map((s) => s.trim()) : undefined,
    sources: sources ? sources.split(',').map((s) => s.trim()) : undefined,
    scoreMin: scoreMin ? Number(scoreMin) : undefined,
  });

  const create = async () => {
    if (!name) return flash('Name required');
    await fetch(`${api}/segments`, { method: 'POST', headers: hdrs(token), body: JSON.stringify({ name, rules: rules() }) });
    setName(''); flash('Segment created'); reload();
  };
  const previewSeg = async (id: number) => {
    const r = await fetch(`${api}/segments/${id}/preview`, { headers: hdrs(token) }).then((r) => r.json());
    setPreview((p) => ({ ...p, [id]: r.count }));
  };
  const del = async (id: number) => { await fetch(`${api}/segments/${id}`, { method: 'DELETE', headers: hdrs(token) }); reload(); };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="p-5 rounded-xl space-y-3" style={card}>
        <div className="font-semibold" style={{ color: '#C5A265' }}>New segment</div>
        <input className={inputCls} style={inputSt} placeholder="Segment name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inputCls} style={inputSt} value={base} onChange={(e) => setBase(e.target.value)}>
          <option value="leads">Leads</option><option value="contacts">Contacts</option><option value="subscribers">Subscribers</option>
        </select>
        <input className={inputCls} style={inputSt} placeholder="status (comma sep, e.g. new,active)" value={status} onChange={(e) => setStatus(e.target.value)} />
        <input className={inputCls} style={inputSt} placeholder="sources (e.g. website,referral)" value={sources} onChange={(e) => setSources(e.target.value)} />
        {base === 'leads' && <input className={inputCls} style={inputSt} placeholder="min score (0-100)" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} />}
        <button onClick={create} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: gold, color: '#0a1628' }}><Plus size={15} /> Create</button>
      </div>
      <div className="space-y-2">
        {segments.length === 0 && <div className="opacity-50 text-sm">No segments yet.</div>}
        {segments.map((s: Segment) => (
          <div key={s.id} className="p-4 rounded-xl flex items-center justify-between" style={card}>
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs opacity-60">{s.rules}</div>
              {preview[s.id] !== undefined && <div className="text-xs mt-1" style={{ color: gold }}>{preview[s.id]} recipients</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => previewSeg(s.id)} className="px-2 py-1 rounded text-xs" style={inputSt as any}>Preview</button>
              <button onClick={() => del(s.id)} className="p-1.5 rounded" style={{ color: '#ef4444' }}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Campaigns({ token, campaigns, segments, reload, flash, hdrs, api }: any) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('<html><body><p>Hi {{first_name}},</p><p>...</p></body></html>');
  const [segmentId, setSegmentId] = useState('');

  const create = async () => {
    if (!name || !subject || !segmentId) return flash('Name, subject and segment required');
    await fetch(`${api}/campaigns`, { method: 'POST', headers: hdrs(token), body: JSON.stringify({ name, subject, html, segment_id: Number(segmentId) }) });
    setName(''); setSubject(''); flash('Campaign created (draft)'); reload();
  };
  const send = async (id: number) => {
    if (!confirm('Queue this campaign for sending?')) return;
    const r = await fetch(`${api}/campaigns/${id}/send`, { method: 'POST', headers: hdrs(token) }).then((r) => r.json());
    flash(r.error ? r.error : `Queued ${r.queued} recipients${r.live ? '' : ' (dry-run)'}`); reload();
  };
  const del = async (id: number) => { await fetch(`${api}/campaigns/${id}`, { method: 'DELETE', headers: hdrs(token) }); reload(); };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="p-5 rounded-xl space-y-3" style={card}>
        <div className="font-semibold" style={{ color: '#C5A265' }}>New campaign</div>
        <input className={inputCls} style={inputSt} placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} style={inputSt} placeholder="Subject ({{first_name}} supported)" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <select className={inputCls} style={inputSt} value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
          <option value="">Select segment…</option>
          {segments.map((s: Segment) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <textarea className={inputCls} style={{ ...inputSt, height: 140, fontFamily: 'monospace' }} value={html} onChange={(e) => setHtml(e.target.value)} />
        <button onClick={create} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: gold, color: '#0a1628' }}><Plus size={15} /> Create draft</button>
      </div>
      <div className="space-y-2">
        {campaigns.length === 0 && <div className="opacity-50 text-sm">No campaigns yet.</div>}
        {campaigns.map((c: Campaign) => (
          <div key={c.id} className="p-4 rounded-xl" style={card}>
            <div className="flex items-center justify-between">
              <div className="font-medium">{c.name}</div>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(197,162,101,0.15)', color: gold }}>{c.status}</span>
            </div>
            <div className="text-xs opacity-60 mt-1">{c.subject}</div>
            <div className="text-xs opacity-60 mt-1">sent {c.sent_count}/{c.total} · failed {c.fail_count}</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => send(c.id)} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium" style={{ background: gold, color: '#0a1628' }}><Send size={13} /> Send</button>
              <button onClick={() => del(c.id)} className="p-1.5 rounded" style={{ color: '#ef4444' }}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Automations({ token, automations, reload, flash, hdrs, api }: any) {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('lead_created');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('<html><body><p>Hi {{first_name}},</p></body></html>');
  const [scoreMin, setScoreMin] = useState('');
  const [sources, setSources] = useState('');
  const [inactiveDays, setInactiveDays] = useState('');
  const [delay, setDelay] = useState('');

  const create = async () => {
    if (!name || !subject) return flash('Name and subject required');
    const conditions: any = {};
    if (scoreMin) conditions.scoreMin = Number(scoreMin);
    if (sources) conditions.sources = sources.split(',').map((s) => s.trim());
    if (inactiveDays) conditions.inactiveDays = Number(inactiveDays);
    await fetch(`${api}/automations`, {
      method: 'POST', headers: hdrs(token),
      body: JSON.stringify({ name, trigger_type: trigger, conditions, subject, html, delay_minutes: delay ? Number(delay) : 0 }),
    });
    setName(''); setSubject(''); flash('Automation created'); reload();
  };
  const toggle = async (a: Automation) => {
    await fetch(`${api}/automations/${a.id}`, {
      method: 'PUT', headers: hdrs(token),
      body: JSON.stringify({ ...a, conditions: JSON.parse(a.conditions || '{}'), active: !a.active }),
    });
    reload();
  };
  const del = async (id: number) => { await fetch(`${api}/automations/${id}`, { method: 'DELETE', headers: hdrs(token) }); reload(); };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="p-5 rounded-xl space-y-3" style={card}>
        <div className="font-semibold" style={{ color: '#C5A265' }}>New automation</div>
        <input className={inputCls} style={inputSt} placeholder="Automation name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inputCls} style={inputSt} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          {TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className={inputCls} style={inputSt} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} style={inputSt} placeholder="min score" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} />
          <input className={inputCls} style={inputSt} placeholder="delay (min)" value={delay} onChange={(e) => setDelay(e.target.value)} />
        </div>
        <input className={inputCls} style={inputSt} placeholder="sources (website,referral)" value={sources} onChange={(e) => setSources(e.target.value)} />
        {trigger === 'inactivity' && <input className={inputCls} style={inputSt} placeholder="inactive days (e.g. 30)" value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} />}
        <textarea className={inputCls} style={{ ...inputSt, height: 120, fontFamily: 'monospace' }} value={html} onChange={(e) => setHtml(e.target.value)} />
        <button onClick={create} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: gold, color: '#0a1628' }}><Plus size={15} /> Create</button>
      </div>
      <div className="space-y-2">
        {automations.length === 0 && <div className="opacity-50 text-sm">No automations yet.</div>}
        {automations.map((a: Automation) => (
          <div key={a.id} className="p-4 rounded-xl" style={card}>
            <div className="flex items-center justify-between">
              <div className="font-medium">{a.name}</div>
              <button onClick={() => toggle(a)} className="text-xs px-2 py-0.5 rounded"
                style={{ background: a.active ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)', color: a.active ? '#22c55e' : '#94a3b8' }}>
                {a.active ? 'Active' : 'Paused'}
              </button>
            </div>
            <div className="text-xs opacity-60 mt-1">{a.trigger_type} · {a.subject}</div>
            <div className="text-xs opacity-50 mt-0.5">{a.conditions}{a.delay_minutes ? ` · +${a.delay_minutes}min` : ''}</div>
            <button onClick={() => del(a.id)} className="p-1.5 rounded mt-2" style={{ color: '#ef4444' }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
