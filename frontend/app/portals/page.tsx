'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Link, RefreshCw, CheckCircle, XCircle, Zap, Copy, ExternalLink, Info } from 'lucide-react';

interface Portal {
  id: number;
  portal_name: string;
  api_key?: string;
  api_secret?: string;
  account_id?: string;
  status: string;
  last_sync?: string;
  leads_synced: number;
  listings_synced: number;
}

const CRM_BASE = 'https://crm.astraterra.ae';

const PORTAL_META: Record<string, {
  color: string;
  bg: string;
  borderColor: string;
  emoji: string;
  webhookPath: string;
  settingsUrl: string;
  settingsLabel: string;
  instructions: string[];
}> = {
  'Bayut': {
    color: '#E84118',
    bg: '#FEF2F2',
    borderColor: '#FECACA',
    emoji: '🏠',
    webhookPath: '/api/portals/bayut/webhook',
    settingsUrl: 'https://leads.bayut.com',
    settingsLabel: 'Bayut Leads Dashboard',
    instructions: [
      'Log in to your Bayut Leads Dashboard',
      'Go to Settings → Lead Delivery → CRM Webhook',
      'Paste the webhook URL below and save',
      'All Bayut leads will appear here automatically',
    ],
  },
  'Dubizzle': {
    color: '#F97316',
    bg: '#FFF7ED',
    borderColor: '#FED7AA',
    emoji: '🔑',
    webhookPath: '/api/portals/dubizzle/webhook',
    settingsUrl: 'https://business.dubizzle.com',
    settingsLabel: 'Dubizzle Business Portal',
    instructions: [
      'Log in to Dubizzle Business Portal',
      'Go to Account Settings → Lead Notifications → CRM Integration',
      'Paste the webhook URL below and save',
      'All Dubizzle leads will flow into your pipeline',
    ],
  },
  'Property Finder': {
    color: '#1A6634',
    bg: '#ECFDF5',
    borderColor: '#A7F3D0',
    emoji: '🌿',
    webhookPath: '/api/portals/property-finder/webhook',
    settingsUrl: 'https://propertyfinder.ae/en/pfc',
    settingsLabel: 'Property Finder Control',
    instructions: [
      'Log in to Property Finder Control (PFC)',
      'Go to Settings → CRM Integration → Webhook URL',
      'Paste the webhook URL below and save',
      'New PF leads will instantly appear in your pipeline',
    ],
  },
};

export default function PortalsPage() {
  const router = useRouter();
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [copiedPortal, setCopiedPortal] = useState<string | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentPortal, setCurrentPortal] = useState<Portal | null>(null);
  const [credentials, setCredentials] = useState({ api_key: '', api_secret: '', account_id: '' });
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchPortals();
  }, []);

  const fetchPortals = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/portals', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setPortals(d.portals || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSync = async (portal: Portal) => {
    setSyncing(portal.portal_name);
    const token = localStorage.getItem('token');
    try {
      const path = portal.portal_name === 'Website' ? '/api/portals/website/sync' : `/api/portals/${encodeURIComponent(portal.portal_name)}/sync`;
      await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      await fetchPortals();
    } catch (e) { console.error(e); }
    finally { setSyncing(null); }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPortal) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/portals/${encodeURIComponent(currentPortal.portal_name)}/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (res.ok) {
        setSaveMsg('Saved!');
        setTimeout(() => { setShowModal(false); setSaveMsg(''); }, 1400);
        fetchPortals();
      }
    } catch (e) { console.error(e); }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedPortal(key);
      setTimeout(() => setCopiedPortal(null), 2000);
    });
  };

  const WEBSITE_WEBHOOK = `${CRM_BASE}/api/leads/inbound`;
  const websitePortal = portals.find(p => p.portal_name === 'Website');
  const portalOrder = ['Bayut', 'Property Finder', 'Dubizzle'];
  const sortedPortals = portals
    .filter(p => p.portal_name !== 'Website')
    .sort((a, b) => portalOrder.indexOf(a.portal_name) - portalOrder.indexOf(b.portal_name));

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Portal Integrations</h1>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Connect Bayut, Dubizzle & Property Finder — leads flow straight into your pipeline</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 max-w-5xl mx-auto">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
          {/* ── Website Card ── */}
          {websitePortal && (
            <div className="bg-white rounded-2xl border overflow-hidden mb-6"
              style={{ borderColor: '#D1FAE5', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div className="p-6" style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)' }}>
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
                      <Globe className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold" style={{ color: '#131B2B' }}>Astraterra Website</h3>
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                          style={{ background: '#ECFDF5', color: '#065F46' }}>
                          <Zap className="w-3 h-3" /> Live
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: '#6B7280' }}>
                        Auto-captures newsletter signups, contact forms, valuation tool & rent enquiries
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleSync(websitePortal)} disabled={syncing === 'Website'}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border"
                    style={{ borderColor: '#D1FAE5', color: '#065F46', background: 'white' }}>
                    <RefreshCw className={`w-4 h-4 ${syncing === 'Website' ? 'animate-spin' : ''}`} />
                    Refresh Count
                  </button>
                </div>
                <div className="flex gap-6 mt-5 pt-5 flex-wrap" style={{ borderTop: '1px solid #D1FAE5' }}>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: '#131B2B' }}>{websitePortal.leads_synced}</p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>Leads Captured</p>
                  </div>
                  <div style={{ borderLeft: '1px solid #D1FAE5', paddingLeft: '24px' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>Sources tracked:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Newsletter', 'Contact Form', 'AstraEstimate', 'List Property', 'Rent Enquiry'].map(s => (
                        <span key={s} className="px-2 py-0.5 rounded-full text-xs"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#065F46', border: '1px solid #A7F3D0' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 p-3 rounded-lg" style={{ background: 'white', border: '1px solid #D1FAE5' }}>
                  <Globe className="w-4 h-4 flex-shrink-0" style={{ color: '#10B981' }} />
                  <span className="font-mono text-xs flex-1 truncate" style={{ color: '#374151' }}>POST {WEBSITE_WEBHOOK}</span>
                  <button onClick={() => copyText(WEBSITE_WEBHOOK, 'website')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                    style={{ background: copiedPortal === 'website' ? '#ECFDF5' : '#F4F6F9', color: copiedPortal === 'website' ? '#065F46' : '#374151' }}>
                    <Copy className="w-3.5 h-3.5" />
                    {copiedPortal === 'website' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Portal Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {sortedPortals.map(portal => {
              const meta = PORTAL_META[portal.portal_name];
              if (!meta) return null;
              const webhookUrl = `${CRM_BASE}${meta.webhookPath}`;
              const copyKey = portal.portal_name;
              const isCopied = copiedPortal === copyKey;
              const isActive = portal.leads_synced > 0 || portal.status === 'connected';

              return (
                <div key={portal.id} className="bg-white rounded-2xl border overflow-hidden flex flex-col"
                  style={{ borderColor: isActive ? meta.borderColor : '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

                  {/* Header */}
                  <div className="p-5" style={{ background: meta.bg }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ background: meta.color, fontSize: '22px' }}>
                        {meta.emoji}
                      </div>
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: isActive ? '#ECFDF5' : '#F3F4F6',
                          color: isActive ? '#065F46' : '#6B7280',
                        }}>
                        {isActive
                          ? <><CheckCircle className="w-3 h-3" /> Active</>
                          : <><Info className="w-3 h-3" /> Setup Required</>
                        }
                      </span>
                    </div>
                    <h3 className="text-base font-bold" style={{ color: '#131B2B' }}>{portal.portal_name}</h3>
                    <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                      {isActive
                        ? `${portal.leads_synced} lead${portal.leads_synced !== 1 ? 's' : ''} received${portal.last_sync ? ' · Last: ' + new Date(portal.last_sync).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}`
                        : 'Paste webhook URL in portal settings to activate'
                      }
                    </p>
                  </div>

                  {/* Leads count */}
                  <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: '#F3F4F6' }}>
                    <div>
                      <span className="text-xl font-bold" style={{ color: '#131B2B' }}>{portal.leads_synced}</span>
                      <span className="text-xs ml-1.5" style={{ color: '#9CA3AF' }}>leads in pipeline</span>
                    </div>
                    <button onClick={() => handleSync(portal)} disabled={syncing === portal.portal_name}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                      title="Refresh count">
                      <RefreshCw className={`w-4 h-4 ${syncing === portal.portal_name ? 'animate-spin' : ''}`}
                        style={{ color: '#9CA3AF' }} />
                    </button>
                  </div>

                  {/* Webhook URL */}
                  <div className="px-5 py-4 flex-1">
                    <p className="text-xs font-semibold mb-2" style={{ color: '#374151' }}>Your Webhook URL</p>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg mb-3"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                      <span className="font-mono text-xs flex-1 truncate" style={{ color: '#374151' }}>
                        {webhookUrl}
                      </span>
                      <button onClick={() => copyText(webhookUrl, copyKey)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                        style={{ background: isCopied ? '#ECFDF5' : '#131B2B', color: isCopied ? '#065F46' : 'white' }}>
                        <Copy className="w-3 h-3" />
                        {isCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-1.5 mb-4">
                      {meta.instructions.map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold mt-0.5"
                            style={{ background: meta.color, minWidth: '16px' }}>
                            {i + 1}
                          </span>
                          <p className="text-xs" style={{ color: '#6B7280' }}>{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 pb-5">
                    <a href={meta.settingsUrl} target="_blank" rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg"
                      style={{ background: meta.color, color: 'white' }}>
                      Open {meta.settingsLabel}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* How it works */}
          <div className="mt-6 bg-white rounded-2xl border p-5" style={{ borderColor: '#E5E7EB' }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#131B2B' }}>
              <Zap className="w-4 h-4" style={{ color: '#C9A96E' }} />
              How the integration works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { icon: '📋', title: 'Copy webhook URL', desc: 'Each portal gets a unique URL — copy it from the card above' },
                { icon: '⚙️', title: 'Paste in portal settings', desc: 'Add it to your CRM Integration settings in Bayut, Dubizzle, or PF Control' },
                { icon: '📥', title: 'Lead arrives', desc: 'Customer enquiry triggers the portal to POST to your webhook' },
                { icon: '🔔', title: 'Instant CRM entry', desc: 'Lead lands in your pipeline under New Lead + you get a notification' },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#F9FAFB' }}>
                  <span className="text-xl flex-shrink-0">{s.icon}</span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#131B2B' }}>{s.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
