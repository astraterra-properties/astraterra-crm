'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Link, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

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

const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none transition-all";
const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

const portalColors: Record<string, { primary: string; light: string }> = {
  'Bayut': { primary: '#E84118', light: '#FEF2F2' },
  'Dubizzle': { primary: '#E84118', light: '#FFF7ED' },
  'Property Finder': { primary: '#1A6634', light: '#ECFDF5' },
};

export default function PortalsPage() {
  const router = useRouter();
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentPortal, setCurrentPortal] = useState<Portal | null>(null);
  const [credentials, setCredentials] = useState({ api_key: '', api_secret: '', account_id: '' });
  const [syncing, setSyncing] = useState<string | null>(null);
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
        setSaveMsg('Connected successfully!');
        setTimeout(() => { setShowModal(false); setSaveMsg(''); }, 1500);
        fetchPortals();
      }
    } catch (e) { console.error(e); }
  };

  const handleSync = async (portal: Portal) => {
    setSyncing(portal.portal_name);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/portals/${encodeURIComponent(portal.portal_name)}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchPortals();
      }
    } catch (e) { console.error(e); }
    finally { setSyncing(null); }
  };

  const handleDisconnect = async (portal: Portal) => {
    if (!confirm(`Disconnect ${portal.portal_name}?`)) return;
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/portals/${encodeURIComponent(portal.portal_name)}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchPortals();
    } catch (e) { console.error(e); }
  };

  const openConnect = (portal: Portal) => {
    setCurrentPortal(portal);
    setCredentials({ api_key: portal.api_key || '', api_secret: portal.api_secret || '', account_id: portal.account_id || '' });
    setShowModal(true);
  };

  const portalOrder = ['Bayut', 'Property Finder', 'Dubizzle'];
  const sortedPortals = [...portals].sort((a, b) => {
    return portalOrder.indexOf(a.portal_name) - portalOrder.indexOf(b.portal_name);
  });

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
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Connect your property portals to sync leads and listings</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Globe className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#1D4ED8' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1D4ED8' }}>API Integration Ready</p>
            <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>
              Connect your Bayut, Property Finder, and Dubizzle accounts to automatically sync leads and listings. 
              Enter your API credentials from each portal&apos;s developer dashboard.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sortedPortals.map(portal => {
              const colors = portalColors[portal.portal_name] || { primary: '#C9A96E', light: '#FEF9F0' };
              const isConnected = portal.status === 'connected';
              const isSyncing = syncing === portal.portal_name;

              return (
                <div key={portal.id} className="bg-white rounded-2xl border overflow-hidden"
                  style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  {/* Portal Header */}
                  <div className="p-6 border-b" style={{ borderColor: '#F3F4F6', background: colors.light }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ background: colors.primary }}>
                        {portal.portal_name.charAt(0)}
                      </div>
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold`}
                        style={{
                          background: isConnected ? '#ECFDF5' : '#FEF2F2',
                          color: isConnected ? '#065F46' : '#DC2626',
                        }}>
                        {isConnected ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: '#131B2B' }}>{portal.portal_name}</h3>
                    <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                      {portal.last_sync ? `Last synced: ${new Date(portal.last_sync).toLocaleDateString()}` : 'Never synced'}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 divide-x" style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <div className="px-5 py-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: '#131B2B' }}>{portal.leads_synced}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>Leads Synced</p>
                    </div>
                    <div className="px-5 py-4 text-center">
                      <p className="text-2xl font-bold" style={{ color: '#131B2B' }}>{portal.listings_synced}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>Listings Synced</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-5 space-y-3">
                    <button
                      onClick={() => openConnect(portal)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg"
                      style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white' }}
                    >
                      <Link className="w-4 h-4" />
                      {isConnected ? 'Update Credentials' : 'Connect Portal'}
                    </button>
                    {isConnected && (
                      <>
                        <button
                          onClick={() => handleSync(portal)}
                          disabled={isSyncing}
                          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg border"
                          style={{ borderColor: '#E5E7EB', color: '#374151', background: isSyncing ? '#F9FAFB' : 'white' }}
                        >
                          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                          {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                        <button
                          onClick={() => handleDisconnect(portal)}
                          className="w-full py-2 text-xs font-medium rounded-lg"
                          style={{ color: '#DC2626', background: '#FEF2F2' }}
                        >
                          Disconnect
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Webhook info */}
        <div className="mt-6 bg-white rounded-xl border p-5" style={{ borderColor: '#E5E7EB' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: '#131B2B' }}>Inbound Lead Webhook</h3>
          <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
            Use this webhook URL to receive leads from any source automatically:
          </p>
          <div className="flex items-center gap-2 p-3 rounded-lg font-mono text-xs" style={{ background: '#F4F6F9', color: '#374151' }}>
            <Globe className="w-4 h-4 flex-shrink-0" style={{ color: '#C9A96E' }} />
            <span>POST https://crm.astraterra.ae/api/leads/inbound</span>
          </div>
          <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
            Required fields: name, phone or email. Optional: source, message, property_type, budget, location
          </p>
        </div>
      </div>

      {/* Connect Modal */}
      {showModal && currentPortal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ background: portalColors[currentPortal.portal_name]?.primary || '#C9A96E' }}>
                  {currentPortal.portal_name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#131B2B' }}>Connect {currentPortal.portal_name}</h2>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>Enter your API credentials</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleConnect} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>API Key</label>
                  <input type="text" value={credentials.api_key} onChange={e => setCredentials({ ...credentials, api_key: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="Enter your API key" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>API Secret</label>
                  <input type="password" value={credentials.api_secret} onChange={e => setCredentials({ ...credentials, api_secret: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="Enter your API secret" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Account ID</label>
                  <input type="text" value={credentials.account_id} onChange={e => setCredentials({ ...credentials, account_id: e.target.value })}
                    className={inputCls} style={inputStyle} placeholder="Enter your account ID" />
                </div>
              </div>
              {saveMsg && (
                <div className="mt-3 p-3 rounded-lg text-sm font-medium text-center" style={{ background: '#ECFDF5', color: '#065F46' }}>
                  {saveMsg}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                  Save & Connect
                </button>
                <button type="button" onClick={() => { setShowModal(false); setCurrentPortal(null); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg" style={{ background: '#F3F4F6', color: '#374151' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
