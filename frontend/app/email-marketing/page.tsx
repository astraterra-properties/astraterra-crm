'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mail, Send, Users, Plus, RefreshCw, X, CheckCircle,
  Clock, AlertCircle, Trash2, Eye, Code, ChevronUp, ChevronDown,
  GripVertical, BarChart3
} from 'lucide-react';

const TABS = ['Subscribers', 'Campaign Builder', 'Send Campaign', 'Campaigns', 'Stats'] as const;
type Tab = typeof TABS[number];

interface Subscriber { id: number; email: string; first_name: string; source?: string; status: string; welcome_sent: number; subscribed_at: string; }
interface Campaign { id: number; subject: string; preview_text: string; status: string; recipients_count: number; sent_count: number; created_at: string; sent_at?: string; }
interface Stats { active_subscribers: number; total_subscribers: number; total_campaigns: number; sent_campaigns: number; }
interface ProjectCard { id: string; developer: string; projectName: string; location: string; startingPrice: string; bedrooms: string; handover: string; waLink: string; }

const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
const inputSt = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };
const labelCls = "block text-xs font-semibold mb-1.5";
const labelSt = { color: '#374151' };

// Campaign Builder dark-navy theme
const bInputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all placeholder-[#4a6080]";
const bInputSt = { borderColor: 'rgba(197,162,101,0.22)', color: '#e8d9be', background: '#0d1e38' };
const bLabelCls = "block text-xs font-semibold mb-1.5 tracking-wide uppercase";
const bLabelSt = { color: '#C5A265' };
const bCardSt = { background: '#0f1e34', border: '1px solid rgba(197,162,101,0.15)' };
const bHeadSt = { color: '#C5A265' };

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function EmailMarketingPage() {
  const [tab, setTab] = useState<Tab>('Campaign Builder');
  const [token, setToken] = useState('');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // ── Campaign Builder State ─────────────────────────────────────────
  const [builderMode, setBuilderMode] = useState<'form' | 'html'>('form');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [rawHtml, setRawHtml] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Template fields
  const [tmpl, setTmpl] = useState({
    editionLabel: 'New Launches',
    editionDate: '',
    eyebrow: 'Exclusive Client Briefing',
    headlineWhite: '',
    headlineGold: '',
    subtitle: '',
    introText: '',
    ctaText: 'Interested in any of these projects?',
    ctaSubtext: "Message us directly — we'll provide floor plans, payment schedules and ROI projections within the hour.",
  });
  const [projects, setProjects] = useState<ProjectCard[]>([
    { id: uid(), developer: '', projectName: '', location: '', startingPrice: '', bedrooms: '', handover: '', waLink: '' },
  ]);

  // Send campaign
  const [campaignSubject, setCampaignSubject] = useState('');
  const [sendMsg, setSendMsg] = useState('');
  const [sendError, setSendError] = useState('');
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);

  // Simple send tab state
  const [simpleSubject, setSimpleSubject] = useState('');
  const [simplePreview, setSimplePreview] = useState('');
  const [simpleBody, setSimpleBody] = useState('');
  const [simpleSending, setSimpleSending] = useState(false);
  const [simpleMsg, setSimpleMsg] = useState('');
  const [simpleError, setSimpleError] = useState('');
  const [simpleConfirm, setSimpleConfirm] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('token') || '';
    setToken(t);
    fetchAll(t);
  }, []);

  const hdrs = (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

  const fetchAll = async (t: string) => {
    setLoading(true);
    try {
      const [subRes, campRes, statRes] = await Promise.all([
        fetch('/api/email-own/subscribers?limit=500', { headers: hdrs(t) }),
        fetch('/api/email-own/campaigns', { headers: hdrs(t) }),
        fetch('/api/email-own/stats', { headers: hdrs(t) }),
      ]);
      if (subRes.ok) { const d = await subRes.json(); setSubscribers(d.subscribers || []); }
      if (campRes.ok) { const d = await campRes.json(); setCampaigns(d.campaigns || []); }
      if (statRes.ok) { const d = await statRes.json(); setStats(d); }
    } catch {}
    setLoading(false);
  };

  // ── Project card helpers ───────────────────────────────────────────
  const addProject = () => setProjects(p => [...p, { id: uid(), developer: '', projectName: '', location: '', startingPrice: '', bedrooms: '', handover: '', waLink: '' }]);
  const removeProject = (id: string) => setProjects(p => p.filter(x => x.id !== id));
  const updateProject = (id: string, field: keyof ProjectCard, value: string) =>
    setProjects(p => p.map(x => x.id === id ? { ...x, [field]: value } : x));
  const moveProject = (id: string, dir: -1 | 1) => {
    const idx = projects.findIndex(x => x.id === id);
    const next = idx + dir;
    if (next < 0 || next >= projects.length) return;
    const arr = [...projects];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setProjects(arr);
  };

  // ── Generate HTML from template state ────────────────────────────
  const generateHtml = (): string => {
    const today = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dateStr = tmpl.editionDate || `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;

    const projectCardsHtml = projects.filter(p => p.projectName || p.developer).map(p => {
      const waLink = p.waLink ||
        `https://wa.me/971585580053?text=I'm%20interested%20in%20${encodeURIComponent(p.projectName)}`;
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid rgba(196,168,108,0.15);border-radius:6px;overflow:hidden;">
  <tr>
    <td style="background:rgba(196,168,108,0.05);padding:26px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom:12px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:linear-gradient(135deg,#C9A96E,#8A6F2F);border-radius:2px;padding:4px 10px;">
                        <span style="font-family:'Montserrat',sans-serif;font-size:8px;font-weight:700;color:#0d1625;letter-spacing:2px;text-transform:uppercase;">${p.developer}</span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="text-align:right;">
                  <span style="font-family:'Montserrat',sans-serif;font-size:9px;color:rgba(196,168,108,0.6);letter-spacing:1px;">Handover: ${p.handover}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td>
            <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:#ffffff;line-height:1.3;margin-bottom:10px;">${p.projectName}</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td style="width:33%;vertical-align:top;">
                  <div style="font-family:'Montserrat',sans-serif;font-size:8px;color:rgba(196,168,108,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Location</div>
                  <div style="font-family:'Montserrat',sans-serif;font-size:11px;color:rgba(255,255,255,0.7);">${p.location}</div>
                </td>
                <td style="width:33%;vertical-align:top;">
                  <div style="font-family:'Montserrat',sans-serif;font-size:8px;color:rgba(196,168,108,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">From</div>
                  <div style="font-family:'Playfair Display',serif;font-size:13px;font-weight:600;color:#C9A96E;">${p.startingPrice}</div>
                </td>
                <td style="width:34%;vertical-align:top;">
                  <div style="font-family:'Montserrat',sans-serif;font-size:8px;color:rgba(196,168,108,0.5);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Bedrooms</div>
                  <div style="font-family:'Montserrat',sans-serif;font-size:11px;color:rgba(255,255,255,0.7);">${p.bedrooms}</div>
                </td>
              </tr>
            </table>
            <a href="${waLink}" style="display:inline-block;padding:10px 28px;background:linear-gradient(135deg,#C9A96E 0%,#B8943D 50%,#8A6F2F 100%);color:#131B2B;font-family:'Montserrat',sans-serif;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:30px;">Enquire Now</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
    }).join('\n');

    const introSection = tmpl.introText
      ? `<p style="margin:0 0 36px;font-family:'Cormorant Garamond',serif;font-size:16px;color:rgba(255,255,255,0.45);line-height:1.85;font-weight:300;">${tmpl.introText}</p>`
      : `<p style="margin:0 0 36px;font-family:'Cormorant Garamond',serif;font-size:16px;color:rgba(255,255,255,0.45);line-height:1.85;font-weight:300;">This week's curated selection spans Dubai, Abu Dhabi and Ras Al Khaimah — from studios to ultra-luxury residences. Enquire early; allocation windows close fast.</p>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${tmpl.headlineWhite} ${tmpl.headlineGold} — Astraterra Properties</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background-color:#0c1220;font-family:'Montserrat',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c1220;padding:0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;">
          <!-- TOP SPACER -->
          <tr><td style="height:32px;"></td></tr>
          <!-- HEADER BAND -->
          <tr>
            <td style="background:#131B2B;border-radius:6px 6px 0 0;padding:28px 44px;border-bottom:1px solid rgba(196,168,108,0.18);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://res.cloudinary.com/dumt7udjd/image/upload/v1771688053/astraterra-logo-email.png" alt="Astraterra Properties" width="160" style="display:block;border:0;max-width:160px;"/>
                  </td>
                  <td style="vertical-align:middle;text-align:right;">
                    <div style="font-family:'Montserrat',sans-serif;font-size:9px;color:rgba(196,168,108,0.55);letter-spacing:3px;text-transform:uppercase;">${dateStr}</div>
                    <div style="font-family:'Montserrat',sans-serif;font-size:9px;color:rgba(196,168,108,0.35);letter-spacing:2px;text-transform:uppercase;margin-top:4px;">${tmpl.editionLabel}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- HERO SECTION -->
          <tr>
            <td style="background:linear-gradient(175deg,#16223A 0%,#131B2B 45%,#0e1827 100%);padding:48px 44px 40px;">
              <div style="font-family:'Montserrat',sans-serif;font-size:9px;color:#C9A96E;letter-spacing:5px;text-transform:uppercase;margin-bottom:18px;opacity:0.9;">${tmpl.eyebrow}</div>
              <h1 style="margin:0 0 6px;font-family:'Playfair Display',serif;font-size:36px;font-weight:600;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">${tmpl.headlineWhite}</h1>
              <h1 style="margin:0 0 22px;font-family:'Playfair Display',serif;font-size:36px;font-weight:400;color:#C9A96E;line-height:1.2;letter-spacing:-0.5px;font-style:italic;">${tmpl.headlineGold}</h1>
              <p style="margin:0 0 32px;font-family:'Cormorant Garamond',serif;font-size:17px;color:rgba(255,255,255,0.5);line-height:1.8;font-weight:300;max-width:440px;">${tmpl.subtitle}</p>
              <div style="width:48px;height:1px;background:linear-gradient(to right,#C9A96E,#8A6F2F);"></div>
            </td>
          </tr>
          <!-- THIN GOLD LINE -->
          <tr>
            <td style="height:2px;background:linear-gradient(to right,#8A6F2F,#C9A96E 50%,#8A6F2F);"></td>
          </tr>
          <!-- PROJECTS SECTION -->
          <tr>
            <td style="background:#131B2B;padding:40px 44px 16px;">
              <p style="margin:0 0 8px;font-family:'Cormorant Garamond',serif;font-size:17px;color:rgba(255,255,255,0.85);line-height:1.8;">Dear {{ contact.FIRSTNAME | default:"Valued Investor" }},</p>
              ${introSection}
              ${projectCardsHtml}
            </td>
          </tr>
          <!-- DIVIDER + SIGNATURE -->
          <tr>
            <td style="background:#131B2B;padding:0 44px 40px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(196,168,108,0.2),transparent);margin-bottom:32px;"></div>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;width:48px;height:48px;background:linear-gradient(145deg,rgba(201,169,110,0.15),rgba(138,111,47,0.08));border-radius:50%;border:1px solid rgba(196,168,108,0.25);text-align:center;line-height:48px;">
                    <span style="font-family:'Playfair Display',serif;font-size:15px;color:#C9A96E;font-weight:700;">JT</span>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <div style="font-family:'Montserrat',sans-serif;font-size:13px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">Joseph Toubia</div>
                    <div style="font-family:'Montserrat',sans-serif;font-size:10px;color:rgba(255,255,255,0.35);margin-top:3px;letter-spacing:0.5px;">Founder — Astraterra Properties</div>
                    <div style="font-family:'Montserrat',sans-serif;font-size:10px;color:#C9A96E;margin-top:5px;opacity:0.8;">+971 58 558 0053</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA BANNER -->
          <tr>
            <td style="background:linear-gradient(135deg,#1c2e4a 0%,#162240 100%);padding:36px 44px;text-align:center;border-top:1px solid rgba(196,168,108,0.12);border-bottom:1px solid rgba(196,168,108,0.12);">
              <div style="font-family:'Playfair Display',serif;font-size:22px;color:#ffffff;margin-bottom:8px;font-weight:400;">${tmpl.ctaText}</div>
              <p style="margin:0 0 24px;font-family:'Cormorant Garamond',serif;font-size:15px;color:rgba(255,255,255,0.4);font-weight:300;">${tmpl.ctaSubtext}</p>
              <a href="https://wa.me/971585580053" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#C9A96E 0%,#B8943D 50%,#8A6F2F 100%);color:#131B2B;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;text-decoration:none;border-radius:30px;">WhatsApp Us Now</a>
              &nbsp;&nbsp;
              <a href="https://astraterra.ae" style="display:inline-block;margin-top:12px;padding:13px 32px;background:transparent;color:#C9A96E;font-family:'Montserrat',sans-serif;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:30px;border:1px solid rgba(196,168,108,0.4);">Visit Website</a>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background:#0e1520;border-radius:0 0 6px 6px;padding:24px 44px;text-align:center;">
              <img src="https://res.cloudinary.com/dumt7udjd/image/upload/v1771688053/astraterra-logo-email.png" alt="Astraterra" width="100" style="display:block;margin:0 auto 16px;opacity:0.4;"/>
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(196,168,108,0.1),transparent);margin-bottom:16px;"></div>
              <p style="margin:0 0 6px;font-family:'Montserrat',sans-serif;font-size:10px;color:rgba(255,255,255,0.18);letter-spacing:0.5px;">
                &copy; 2026 Astraterra Properties L.L.C &nbsp;&middot;&nbsp; Dubai, UAE &nbsp;&middot;&nbsp; RERA Licensed &nbsp;&middot;&nbsp; Trade License 1384302
              </p>
              <p style="margin:0;font-family:'Montserrat',sans-serif;font-size:10px;color:rgba(255,255,255,0.12);">
                You received this as a valued client of Astraterra Properties.&nbsp;&nbsp;<a href="{{ unsubscribe }}" style="color:rgba(201,169,110,0.3);text-decoration:none;">Unsubscribe</a>
              </p>
            </td>
          </tr>
          <!-- BOTTOM SPACER -->
          <tr><td style="height:32px;"></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  // ── Copy HTML to clipboard ────────────────────────────────────────
  const [copyMsg, setCopyMsg] = useState('');
  const copyHtml = () => {
    const html = builderMode === 'html' ? rawHtml : generateHtml();
    navigator.clipboard.writeText(html).then(() => {
      setCopyMsg('Copied!');
      setTimeout(() => setCopyMsg(''), 2000);
    });
  };

  // ── Preview ───────────────────────────────────────────────────────
  const generatePreview = async () => {
    setLoadingPreview(true);
    try {
      if (builderMode === 'html') {
        setPreviewHtml(rawHtml);
      } else {
        const html = generateHtml();
        setPreviewHtml(html);
        setRawHtml(html); // sync raw HTML editor
      }
      setPreviewOpen(true);
    } catch {}
    setLoadingPreview(false);
  };

  // ── Send campaign ─────────────────────────────────────────────────
  const handleSend = async () => {
    if (!campaignSubject) { setSendError('Please enter a subject line'); return; }
    setSending(true); setSendMsg(''); setSendError(''); setConfirmSend(false);
    try {
      const htmlToSend = builderMode === 'html' ? rawHtml : generateHtml();
      const body = { subject: campaignSubject, html_override: htmlToSend };
      const res = await fetch('/api/email-own/campaigns/send-template', {
        method: 'POST',
        headers: hdrs(token),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setSendMsg(`✅ Campaign is sending to ${data.recipients} subscribers!`);
        setCampaignSubject('');
        setTimeout(() => fetchAll(token), 3000);
      } else {
        setSendError(data.error || 'Failed to send');
      }
    } catch { setSendError('Network error'); }
    setSending(false);
  };

  const handleSimpleSend = async () => {
    if (!simpleSubject || !simpleBody) return;
    setSimpleSending(true); setSimpleMsg(''); setSimpleError(''); setSimpleConfirm(false);
    try {
      const res = await fetch('/api/email-own/campaigns', {
        method: 'POST',
        headers: hdrs(token),
        body: JSON.stringify({ subject: simpleSubject, preview_text: simplePreview, html_body: simpleBody, send_now: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setSimpleMsg(`✅ Sending "${simpleSubject}" to ${stats?.active_subscribers || 0} subscribers!`);
        setSimpleSubject(''); setSimplePreview(''); setSimpleBody('');
        setTimeout(() => fetchAll(token), 3000);
      } else {
        setSimpleError(data.error || 'Failed');
      }
    } catch { setSimpleError('Network error'); }
    setSimpleSending(false);
  };

  const removeSubscriber = async (id: number) => {
    await fetch(`/api/email-own/subscribers/${id}`, { method: 'DELETE', headers: hdrs(token) });
    setSubscribers(prev => prev.filter(s => s.id !== id));
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, { color: string; bg: string }> = {
      sent: { color: '#065F46', bg: '#ECFDF5' }, sending: { color: '#1D4ED8', bg: '#EFF6FF' },
      draft: { color: '#92400E', bg: '#FEF3C7' }, failed: { color: '#DC2626', bg: '#FEF2F2' },
    };
    const icons: Record<string, React.ReactNode> = {
      sent: <CheckCircle className="w-3 h-3" />, sending: <RefreshCw className="w-3 h-3 animate-spin" />,
      draft: <Clock className="w-3 h-3" />, failed: <AlertCircle className="w-3 h-3" />,
    };
    const c = colors[status] || colors.draft;
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: c.color, background: c.bg }}>
        {icons[status] || icons.draft} {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filtered = subscribers.filter(s =>
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.first_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Email Marketing</h1>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Powered by Gmail — admin@astraterra.ae · {stats?.active_subscribers || 0} active subscribers</p>
          </div>
        </div>
        <button onClick={() => fetchAll(token)} className="p-2 rounded-lg hover:bg-gray-100">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: '#9CA3AF' }} />
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6 overflow-x-auto" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex gap-0 min-w-max">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
              style={{ borderColor: tab === t ? '#C9A96E' : 'transparent', color: tab === t ? '#C9A96E' : '#6B7280' }}>
              {t}
              {t === 'Subscribers' && stats && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: '#FEF9F0', color: '#C9A96E' }}>
                  {stats.active_subscribers}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-5 max-w-6xl mx-auto">

        {/* ══════════════════════════════════════════════════════════════════
            CAMPAIGN BUILDER TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'Campaign Builder' && (
          <div className="flex gap-5 flex-col xl:flex-row" style={{ background: '#0a1628', borderRadius: 16, padding: 20 }}>

            {/* LEFT: Form / HTML editor */}
            <div className="flex-1 min-w-0">
              {/* Mode toggle */}
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setBuilderMode('form')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-all"
                  style={{ background: builderMode === 'form' ? 'linear-gradient(135deg,#C9A96E,#8A6F2F)' : 'rgba(197,162,101,0.08)', color: builderMode === 'form' ? '#0d1625' : '#C5A265', borderColor: builderMode === 'form' ? 'transparent' : 'rgba(197,162,101,0.25)' }}>
                  <BarChart3 className="w-4 h-4" /> Form Builder
                </button>
                <button onClick={() => setBuilderMode('html')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-all"
                  style={{ background: builderMode === 'html' ? 'linear-gradient(135deg,#C9A96E,#8A6F2F)' : 'rgba(197,162,101,0.08)', color: builderMode === 'html' ? '#0d1625' : '#C5A265', borderColor: builderMode === 'html' ? 'transparent' : 'rgba(197,162,101,0.25)' }}>
                  <Code className="w-4 h-4" /> Raw HTML
                </button>
                <span className="text-xs ml-2" style={{ color: 'rgba(197,162,101,0.5)' }}>
                  {builderMode === 'form' ? 'Fill in the fields — HTML is auto-generated' : 'Edit raw HTML directly (designer mode)'}
                </span>
              </div>

              {builderMode === 'form' ? (
                <div className="space-y-4">
                  {/* Header info */}
                  <div className="rounded-2xl p-5" style={bCardSt}>
                    <h3 className="text-sm font-bold mb-4" style={bHeadSt}>Header &amp; Edition</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={bLabelCls} style={bLabelSt}>Edition Label</label>
                        <input className={bInputCls} style={bInputSt} placeholder="e.g. New Launches" value={tmpl.editionLabel} onChange={e => setTmpl(t => ({ ...t, editionLabel: e.target.value }))} />
                      </div>
                      <div>
                        <label className={bLabelCls} style={bLabelSt}>Date (blank = today)</label>
                        <input className={bInputCls} style={bInputSt} placeholder="e.g. 1 March 2026" value={tmpl.editionDate} onChange={e => setTmpl(t => ({ ...t, editionDate: e.target.value }))} />
                      </div>
                    </div>
                  </div>

                  {/* Hero section */}
                  <div className="rounded-2xl p-5" style={bCardSt}>
                    <h3 className="text-sm font-bold mb-4" style={bHeadSt}>Hero Section</h3>
                    <div className="space-y-3">
                      <div>
                        <label className={bLabelCls} style={bLabelSt}>Eyebrow</label>
                        <input className={bInputCls} style={bInputSt} placeholder="e.g. Exclusive Client Briefing" value={tmpl.eyebrow} onChange={e => setTmpl(t => ({ ...t, eyebrow: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={bLabelCls} style={bLabelSt}>Headline — White</label>
                          <input className={bInputCls} style={bInputSt} placeholder="e.g. 8 New Projects" value={tmpl.headlineWhite} onChange={e => setTmpl(t => ({ ...t, headlineWhite: e.target.value }))} />
                        </div>
                        <div>
                          <label className={bLabelCls} style={bLabelSt}>Headline — Gold Italic</label>
                          <input className={bInputCls} style={bInputSt} placeholder="e.g. Launching This Week" value={tmpl.headlineGold} onChange={e => setTmpl(t => ({ ...t, headlineGold: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className={bLabelCls} style={bLabelSt}>Subtitle</label>
                        <textarea className={bInputCls} style={{ ...bInputSt, minHeight: 70, resize: 'vertical' }} placeholder="Hand-selected from Dubai's latest developer releases..." value={tmpl.subtitle} onChange={e => setTmpl(t => ({ ...t, subtitle: e.target.value }))} />
                      </div>
                    </div>
                  </div>

                  {/* Intro text */}
                  <div className="rounded-2xl p-5" style={bCardSt}>
                    <h3 className="text-sm font-bold mb-4" style={bHeadSt}>Intro Paragraph</h3>
                    <textarea className={bInputCls} style={{ ...bInputSt, minHeight: 80, resize: 'vertical' }} placeholder="This week's curated selection spans Dubai, Abu Dhabi and Ras Al Khaimah..." value={tmpl.introText} onChange={e => setTmpl(t => ({ ...t, introText: e.target.value }))} />
                    <p className="text-xs mt-1.5" style={{ color: 'rgba(197,162,101,0.5)' }}>Greeting "Dear [subscriber name]," is added automatically above this.</p>
                  </div>

                  {/* Project Cards */}
                  <div className="rounded-2xl p-5" style={bCardSt}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold" style={bHeadSt}>Project Cards ({projects.length})</h3>
                      <button onClick={addProject}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ background: 'linear-gradient(135deg,#C9A96E,#8A6F2F)', color: '#0d1625' }}>
                        <Plus className="w-3.5 h-3.5" /> Add Project
                      </button>
                    </div>

                    <div className="space-y-3">
                      {projects.map((p, idx) => (
                        <div key={p.id} className="rounded-xl p-4" style={{ background: '#0a1628', border: '1px solid rgba(197,162,101,0.2)' }}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <GripVertical className="w-4 h-4" style={{ color: 'rgba(197,162,101,0.4)' }} />
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: '#0d1625' }}>
                                {idx + 1}
                              </span>
                              <span className="text-sm font-semibold" style={{ color: '#e8d9be' }}>
                                {p.projectName || 'Project ' + (idx + 1)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => moveProject(p.id, -1)} disabled={idx === 0} className="p-1 rounded disabled:opacity-30" style={{ color: 'rgba(197,162,101,0.6)' }}>
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => moveProject(p.id, 1)} disabled={idx === projects.length - 1} className="p-1 rounded disabled:opacity-30" style={{ color: 'rgba(197,162,101,0.6)' }}>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeProject(p.id)} className="p-1 rounded ml-1" style={{ color: '#f87171' }}>
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <div>
                              <label className={bLabelCls} style={bLabelSt}>Developer *</label>
                              <input className={bInputCls} style={bInputSt} placeholder="Emaar" value={p.developer} onChange={e => updateProject(p.id, 'developer', e.target.value)} />
                            </div>
                            <div>
                              <label className={bLabelCls} style={bLabelSt}>Project Name *</label>
                              <input className={bInputCls} style={bInputSt} placeholder="Fior 1" value={p.projectName} onChange={e => updateProject(p.id, 'projectName', e.target.value)} />
                            </div>
                            <div>
                              <label className={bLabelCls} style={bLabelSt}>Location</label>
                              <input className={bInputCls} style={bInputSt} placeholder="Mina Rashid, Dubai" value={p.location} onChange={e => updateProject(p.id, 'location', e.target.value)} />
                            </div>
                            <div>
                              <label className={bLabelCls} style={bLabelSt}>Starting Price</label>
                              <input className={bInputCls} style={bInputSt} placeholder="AED 2,210,000" value={p.startingPrice} onChange={e => updateProject(p.id, 'startingPrice', e.target.value)} />
                            </div>
                            <div>
                              <label className={bLabelCls} style={bLabelSt}>Bedrooms</label>
                              <input className={bInputCls} style={bInputSt} placeholder="1 - 3 BR" value={p.bedrooms} onChange={e => updateProject(p.id, 'bedrooms', e.target.value)} />
                            </div>
                            <div>
                              <label className={bLabelCls} style={bLabelSt}>Handover</label>
                              <input className={bInputCls} style={bInputSt} placeholder="Jun 2030" value={p.handover} onChange={e => updateProject(p.id, 'handover', e.target.value)} />
                            </div>
                            <div className="col-span-2 sm:col-span-3">
                              <label className={bLabelCls} style={bLabelSt}>WhatsApp Link (optional — auto-generated if blank)</label>
                              <input className={bInputCls} style={bInputSt} placeholder="https://wa.me/971585580053?text=..." value={p.waLink} onChange={e => updateProject(p.id, 'waLink', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA section */}
                  <div className="rounded-2xl p-5" style={bCardSt}>
                    <h3 className="text-sm font-bold mb-4" style={bHeadSt}>CTA Banner</h3>
                    <div className="space-y-3">
                      <div>
                        <label className={bLabelCls} style={bLabelSt}>CTA Heading</label>
                        <input className={bInputCls} style={bInputSt} value={tmpl.ctaText} onChange={e => setTmpl(t => ({ ...t, ctaText: e.target.value }))} />
                      </div>
                      <div>
                        <label className={bLabelCls} style={bLabelSt}>CTA Subtext</label>
                        <textarea className={bInputCls} style={{ ...bInputSt, minHeight: 60, resize: 'vertical' }} value={tmpl.ctaSubtext} onChange={e => setTmpl(t => ({ ...t, ctaSubtext: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Raw HTML editor */
                <div className="rounded-2xl p-5" style={bCardSt}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold" style={bHeadSt}>Raw HTML Editor (Designer Mode)</h3>
                    <button onClick={generatePreview} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: 'rgba(197,162,101,0.3)', color: '#C5A265' }}>
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                  </div>
                  <p className="text-xs mb-3" style={{ color: 'rgba(197,162,101,0.5)' }}>
                    Paste or edit the full email HTML here. Click "Generate from Form" to start from the template, then customize freely.
                  </p>
                  <button onClick={() => { const html = generateHtml(); setRawHtml(html); }}
                    className="mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'linear-gradient(135deg,#C9A96E,#8A6F2F)', color: '#0d1625' }}>
                    Generate from Form
                  </button>
                  <textarea
                    className="w-full text-xs border rounded-lg p-3"
                    style={{ minHeight: 500, resize: 'vertical', fontFamily: 'monospace', borderColor: 'rgba(197,162,101,0.2)', color: '#c8d8e8', background: '#080f1d' }}
                    value={rawHtml}
                    onChange={e => setRawHtml(e.target.value)}
                    placeholder="Paste your HTML here, or click 'Generate from Form' above to start from the Astraterra template..."
                  />
                </div>
              )}

              {/* Subject + Send bar */}
              <div className="rounded-2xl mt-4 p-5" style={{ background: '#0f1e34', border: '1px solid rgba(201,169,110,0.35)', boxShadow: '0 0 0 1px rgba(201,169,110,0.15)' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: '#C5A265' }}>Send Campaign</h3>
                {sendMsg && <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.2)' }}>{sendMsg}</div>}
                {sendError && <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>{sendError}</div>}
                <div className="flex gap-2 mb-3">
                  <input className={`${bInputCls} flex-1`} style={bInputSt} placeholder="Email subject line *" value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} />
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <button onClick={generatePreview} disabled={loadingPreview}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border"
                    style={{ borderColor: 'rgba(197,162,101,0.3)', color: '#C5A265', background: 'rgba(197,162,101,0.08)' }}>
                    <Eye className="w-4 h-4" /> {loadingPreview ? 'Loading...' : 'Preview'}
                  </button>
                  <button onClick={copyHtml}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border"
                    style={{ borderColor: 'rgba(197,162,101,0.3)', color: '#C5A265', background: 'rgba(197,162,101,0.08)' }}>
                    <Code className="w-4 h-4" /> {copyMsg || 'Copy HTML'}
                  </button>
                  {!confirmSend ? (
                    <button onClick={() => setConfirmSend(true)} disabled={!campaignSubject || sending}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: campaignSubject ? 'linear-gradient(135deg,#C9A96E,#8A6F2F)' : 'rgba(197,162,101,0.15)', color: campaignSubject ? '#0d1625' : 'rgba(197,162,101,0.4)' }}>
                      <Send className="w-4 h-4" /> Send to {stats?.active_subscribers || 0} Subscribers
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={handleSend} disabled={sending}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold"
                        style={{ background: 'linear-gradient(135deg,#C9A96E,#8A6F2F)', color: '#0d1625' }}>
                        {sending ? 'Sending...' : 'Confirm Send'}
                      </button>
                      <button onClick={() => setConfirmSend(false)} className="px-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: 'rgba(197,162,101,0.3)', color: '#C5A265' }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Preview pane */}
            {previewOpen && (
              <div className="xl:w-[640px] flex-shrink-0">
                <div className="rounded-2xl overflow-hidden sticky top-4" style={{ border: '1px solid rgba(197,162,101,0.25)', background: '#0c1220' }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(197,162,101,0.15)', background: '#0f1e34' }}>
                    <span className="text-sm font-semibold" style={{ color: '#C5A265' }}>Email Preview</span>
                    <div className="flex items-center gap-2">
                      <button onClick={copyHtml} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border" style={{ borderColor: 'rgba(197,162,101,0.3)', color: '#C5A265', background: 'rgba(197,162,101,0.08)' }}>
                        <Code className="w-3 h-3" /> {copyMsg || 'Copy HTML'}
                      </button>
                      <button onClick={() => setPreviewOpen(false)} className="p-1 rounded" style={{ color: 'rgba(197,162,101,0.5)' }}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div style={{ height: 700, overflowY: 'auto', background: '#0c1220' }}>
                    <iframe
                      ref={previewRef}
                      srcDoc={previewHtml}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      title="Email Preview"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SUBSCRIBERS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'Subscribers' && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <input className={inputCls} style={{ ...inputSt, maxWidth: 300 }} placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} />
              <button onClick={async () => { setLoading(true); await fetch('/api/email-own/subscribers/import', { method: 'POST', headers: hdrs(token) }); await fetchAll(token); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#131B2B', color: 'white' }}>
                <Plus className="w-4 h-4" /> Import from CRM Contacts
              </button>
            </div>
            <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: '#F3F4F6' }}>
                <span className="text-sm font-semibold" style={{ color: '#131B2B' }}>{filtered.length} subscriber{filtered.length !== 1 ? 's' : ''}</span>
                <span className="text-xs" style={{ color: '#9CA3AF' }}>Sending via admin@astraterra.ae Gmail</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['Email', 'Name', 'Source', 'Welcome', 'Subscribed', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#6B7280' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm" style={{ color: '#131B2B' }}>{s.email}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#374151' }}>{s.first_name || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#9CA3AF' }}>{s.source || 'website'}</td>
                        <td className="px-4 py-3">{s.welcome_sent ? <span className="text-xs text-green-600 font-medium">✅</span> : <span className="text-xs text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#9CA3AF' }}>{new Date(s.subscribed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-3"><button onClick={() => removeSubscriber(s.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" style={{ color: '#EF4444' }} /></button></td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: '#9CA3AF' }}>No subscribers yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SEND CAMPAIGN TAB (simple plain email)
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'Send Campaign' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-base font-bold mb-1" style={{ color: '#131B2B' }}>Plain HTML Campaign</h2>
              <p className="text-xs mb-5" style={{ color: '#9CA3AF' }}>For plain text or custom HTML — use Campaign Builder for the luxury branded template</p>
              <div className="space-y-4">
                <div><label className={labelCls} style={labelSt}>Subject *</label><input className={inputCls} style={inputSt} placeholder="Your subject line" value={simpleSubject} onChange={e => setSimpleSubject(e.target.value)} /></div>
                <div><label className={labelCls} style={labelSt}>Preview Text</label><input className={inputCls} style={inputSt} placeholder="Short preview shown under subject..." value={simplePreview} onChange={e => setSimplePreview(e.target.value)} /></div>
                <div>
                  <label className={labelCls} style={labelSt}>Body (HTML) *</label>
                  <textarea className={inputCls} style={{ ...inputSt, minHeight: 200, resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }} value={simpleBody} onChange={e => setSimpleBody(e.target.value)} placeholder="<p>Your email content...</p>" />
                </div>
                {simpleMsg && <div className="p-3 rounded-lg text-sm" style={{ background: '#ECFDF5', color: '#065F46' }}>{simpleMsg}</div>}
                {simpleError && <div className="p-3 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#DC2626' }}>{simpleError}</div>}
                {!simpleConfirm ? (
                  <button onClick={() => setSimpleConfirm(true)} disabled={!simpleSubject || !simpleBody}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                    style={{ background: simpleSubject && simpleBody ? 'linear-gradient(135deg, #C9A96E, #8A6F2F)' : '#E5E7EB', color: simpleSubject && simpleBody ? 'white' : '#9CA3AF' }}>
                    <Send className="w-4 h-4" /> Send to {stats?.active_subscribers || 0} Subscribers
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleSimpleSend} disabled={simpleSending} className="flex-1 py-2.5 rounded-lg text-sm font-bold" style={{ background: '#C9A96E', color: 'white' }}>
                      {simpleSending ? '⏳ Sending...' : '✅ Confirm Send'}
                    </button>
                    <button onClick={() => setSimpleConfirm(false)} className="flex-1 py-2.5 rounded-lg text-sm border" style={{ borderColor: '#E5E7EB', color: '#374151' }}>Cancel</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            CAMPAIGNS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'Campaigns' && (
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: '#F3F4F6' }}>
              <span className="text-sm font-semibold" style={{ color: '#131B2B' }}>{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</span>
            </div>
            {campaigns.length === 0 ? (
              <div className="py-16 text-center"><Mail className="w-8 h-8 mx-auto mb-3" style={{ color: '#E5E7EB' }} /><p className="text-sm" style={{ color: '#9CA3AF' }}>No campaigns yet.</p></div>
            ) : (
              <table className="w-full">
                <thead><tr style={{ background: '#F9FAFB' }}>
                  {['Subject', 'Status', 'Recipients', 'Sent', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#6B7280' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {campaigns.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="text-sm font-medium" style={{ color: '#131B2B' }}>{c.subject}</p></td>
                      <td className="px-4 py-3">{statusBadge(c.status)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#374151' }}>{c.recipients_count}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#374151' }}>{c.status === 'sent' ? `${c.sent_count} / ${c.recipients_count}` : '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#9CA3AF' }}>
                        {new Date(c.sent_at || c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STATS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === 'Stats' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Active Subscribers', value: stats.active_subscribers, icon: '👥', color: '#10B981' },
              { label: 'Total Subscribers', value: stats.total_subscribers, icon: '📋', color: '#3B82F6' },
              { label: 'Campaigns Sent', value: stats.sent_campaigns, icon: '✅', color: '#C9A96E' },
              { label: 'Total Campaigns', value: stats.total_campaigns, icon: '📧', color: '#8B5CF6' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
                <div className="text-2xl mb-2">{s.icon}</div>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{s.label}</p>
              </div>
            ))}
            <div className="col-span-2 md:col-span-4 bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#131B2B' }}>📤 Infrastructure</p>
              <div className="flex flex-wrap gap-4 text-sm" style={{ color: '#374151' }}>
                <span>✅ Gmail OAuth — admin@astraterra.ae</span>
                <span>✅ 2,000 emails/day (Google Workspace)</span>
                <span>✅ Luxury dark navy + gold template</span>
                <span>✅ No Brevo dependency</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
