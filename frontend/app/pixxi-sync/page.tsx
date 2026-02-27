'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Key,
  CheckCircle,
  AlertTriangle,
  Building2,
  Users,
  User,
  Layers,
  Zap,
  XCircle,
  Clock,
  Database,
  Wifi,
  WifiOff,
  Play,
  Settings,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PixxiConfig {
  id?: number;
  last_properties_sync?: string;
  last_leads_sync?: string;
  last_developers_sync?: string;
  last_agents_sync?: string;
  webhook_subscribed?: number;
}

interface SyncLogEntry {
  id: number;
  sync_type: string;
  records_synced: number;
  total_records?: number;
  errors: number;
  status: string;
  error_message?: string;
  created_at: string;
}

interface SyncState {
  loading: boolean;
  result?: { synced: number; errors: number; duration?: number; error?: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const navyBg = '#131B2B';
const gold = '#C9A96E';
const goldDark = '#8A6F2F';

function formatDate(d?: string | null) {
  if (!d) return 'Never';
  try {
    return new Intl.DateTimeFormat('en-AE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(d));
  } catch { return d; }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PixxiSyncPage() {
  const router = useRouter();
  const [config, setConfig] = useState<PixxiConfig>({});
  const [hasToken, setHasToken] = useState(false);
  const [counts, setCounts] = useState({ properties: 0, leads: 0 });
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Token form
  const [tokenInput, setTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [tokenMsg, setTokenMsg] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Sync states
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({
    properties: { loading: false },
    leads: { loading: false },
    developers: { loading: false },
    agents: { loading: false },
    all: { loading: false },
  });

  // Webhook
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookSubs, setWebhookSubs] = useState<any[]>([]);
  const [webhookMsg, setWebhookMsg] = useState('');

  const token = useCallback(() => localStorage.getItem('token') || '', []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/pixxi/config', {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const d = await res.json();
        setConfig(d.config || {});
        setHasToken(d.hasToken);
        setCounts(d.counts || { properties: 0, leads: 0 });
        setSyncLog(d.syncLog || []);
      } else if (res.status === 401) {
        router.push('/login');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { router.push('/login'); return; }
    fetchConfig();
  }, [fetchConfig, router]);

  // ─── Token Save ─────────────────────────────────────────────────────────────
  const saveToken = async () => {
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    setTokenMsg('');
    try {
      const res = await fetch('/api/pixxi/config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        setTokenMsg('✅ Token saved successfully');
        setHasToken(true);
        setTokenInput('');
        await fetchConfig();
      } else {
        setTokenMsg(`❌ ${d.error || 'Failed to save'}`);
      }
    } catch (e) {
      setTokenMsg('❌ Network error');
    } finally {
      setSavingToken(false);
    }
  };

  // ─── Test Connection ────────────────────────────────────────────────────────
  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/pixxi/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setTestResult(`✅ Connected! Found ${d.agents || 0} agents in Pixxi.`);
      } else {
        setTestResult(`❌ ${d.error || 'Connection failed'}`);
      }
    } catch {
      setTestResult('❌ Network error — check console');
    } finally {
      setTesting(false);
    }
  };

  // ─── Sync ───────────────────────────────────────────────────────────────────
  const doSync = async (type: string) => {
    setSyncStates(s => ({ ...s, [type]: { loading: true, result: null } }));
    try {
      const res = await fetch(`/api/pixxi/sync/${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      });
      const d = await res.json();
      setSyncStates(s => ({ ...s, [type]: { loading: false, result: d } }));
      await fetchConfig();
    } catch (e: any) {
      setSyncStates(s => ({ ...s, [type]: { loading: false, result: { synced: 0, errors: 1, error: e.message } } }));
    }
  };

  // ─── Webhook Setup ──────────────────────────────────────────────────────────
  const setupWebhooks = async () => {
    setWebhookLoading(true);
    setWebhookMsg('');
    try {
      const res = await fetch('/api/pixxi/webhook/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      });
      const d = await res.json();
      if (d.success) {
        setWebhookMsg('✅ All 4 webhook events subscribed!');
        await fetchConfig();
      } else {
        const failed = d.results?.filter((r: any) => !r.success).map((r: any) => r.event).join(', ');
        setWebhookMsg(`⚠️ Partial: ${failed || 'some failed'}`);
      }
    } catch {
      setWebhookMsg('❌ Failed to setup webhooks');
    } finally {
      setWebhookLoading(false);
    }
  };

  const fetchWebhookSubs = async () => {
    try {
      const res = await fetch('/api/pixxi/webhook/subscriptions', {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await res.json();
      setWebhookSubs(Array.isArray(d.subscriptions) ? d.subscriptions : []);
    } catch {
      setWebhookSubs([]);
    }
  };

  const removeWebhooks = async (event?: string) => {
    setWebhookLoading(true);
    setWebhookMsg('');
    const events = event ? [event] : ['ADD_LEADS', 'UPDATE_LEADS', 'ADD_LISTINGS', 'UPDATE_LISTINGS'];
    try {
      for (const ev of events) {
        await fetch('/api/pixxi/webhook/unsubscribe', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: ev }),
        });
      }
      setWebhookMsg('✅ Webhooks removed');
      await fetchConfig();
    } catch {
      setWebhookMsg('❌ Failed to remove webhooks');
    } finally {
      setWebhookLoading(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#F8F9FA' }}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: gold }} />
          <p className="text-gray-500 text-sm">Loading Pixxi integration…</p>
        </div>
      </div>
    );
  }

  const syncCards = [
    {
      key: 'properties',
      icon: Building2,
      label: 'Properties',
      desc: 'Sync NEW, SELL & RENT listings',
      lastSync: config.last_properties_sync,
      btnLabel: 'Sync All Listings',
      color: '#3B82F6',
      lightColor: '#EFF6FF',
    },
    {
      key: 'leads',
      icon: Users,
      label: 'Leads',
      desc: 'Pull all lead contacts from Pixxi',
      lastSync: config.last_leads_sync,
      btnLabel: 'Sync Leads',
      color: '#10B981',
      lightColor: '#ECFDF5',
    },
    {
      key: 'developers',
      icon: Layers,
      label: 'Developers',
      desc: 'Import property developers',
      lastSync: config.last_developers_sync,
      btnLabel: 'Sync Developers',
      color: '#8B5CF6',
      lightColor: '#F5F3FF',
    },
    {
      key: 'agents',
      icon: User,
      label: 'Agents',
      desc: 'Pull agent profiles from Pixxi',
      lastSync: config.last_agents_sync,
      btnLabel: 'Sync Agents',
      color: '#F59E0B',
      lightColor: '#FFFBEB',
    },
  ];

  const webhookEvents = ['ADD_LEADS', 'UPDATE_LEADS', 'ADD_LISTINGS', 'UPDATE_LISTINGS'];
  const isWebhookSubscribed = config.webhook_subscribed === 1;

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FA' }}>
      {/* Header */}
      <div className="px-6 py-6" style={{ background: navyBg }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.2)' }}>
              <RefreshCw className="w-5 h-5" style={{ color: gold }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Pixxi Sync</h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Sync properties, leads & agents from Pixxi CRM
              </p>
            </div>
          </div>

          {/* Live count strip */}
          <div className="flex gap-6 mt-4">
            {[
              { label: 'Properties Synced', value: counts.properties, icon: Building2 },
              { label: 'Leads Synced', value: counts.leads, icon: Users },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: gold }} />
                <span className="text-white font-bold">{value.toLocaleString()}</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              {hasToken ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400 font-medium">Token configured</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-yellow-400 font-medium">No token set</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* ─── Token Card ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `rgba(201,169,110,0.12)` }}>
              <Key className="w-4 h-4" style={{ color: gold }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">API Token Configuration</h2>
              <p className="text-xs text-gray-500">Find your token in Pixxi CRM → Admin → Integrations → Pixxi Forms</p>
            </div>
            <div className="ml-auto">
              {hasToken ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" /> Token configured ✅
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" /> No token set ⚠️
                </span>
              )}
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="flex gap-3">
              <input
                type="password"
                placeholder={hasToken ? '••••••••••••••••• (token is set — paste new one to update)' : 'Paste your X-PIXXI-TOKEN here'}
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{ borderColor: '#E5E7EB' }}
                onFocus={e => { e.currentTarget.style.borderColor = gold; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(201,169,110,0.15)`; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <button
                onClick={saveToken}
                disabled={savingToken || !tokenInput.trim()}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
                style={{ background: `linear-gradient(135deg, ${gold}, ${goldDark})` }}
              >
                {savingToken ? 'Saving…' : 'Save Token'}
              </button>
              {hasToken && (
                <button
                  onClick={testConnection}
                  disabled={testing}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg border transition-all"
                  style={{ borderColor: gold, color: goldDark, background: 'transparent' }}
                >
                  {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                  {testing ? 'Testing…' : 'Test Connection'}
                </button>
              )}
            </div>
            {tokenMsg && <p className="mt-2 text-sm text-gray-700">{tokenMsg}</p>}
            {testResult && (
              <div className={`mt-3 px-4 py-3 rounded-lg text-sm font-medium ${testResult.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {testResult}
              </div>
            )}
          </div>
        </div>

        {/* ─── Sync All Banner ─────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-6 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${navyBg} 60%, #1E2D47)` }}
        >
          <div>
            <h2 className="text-lg font-bold text-white mb-1">🔄 Sync Everything</h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Pull all properties, leads, developers & agents from Pixxi in one click
            </p>
            {syncStates.all.result && (
              <p className="text-xs mt-1 text-green-400">
                {syncStates.all.result.error
                  ? `❌ ${syncStates.all.result.error}`
                  : `✅ Sync complete in ${((syncStates.all.result.duration || 0) / 1000).toFixed(1)}s`}
              </p>
            )}
          </div>
          <button
            onClick={() => doSync('all')}
            disabled={syncStates.all.loading || !hasToken}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: hasToken ? `linear-gradient(135deg, ${gold}, ${goldDark})` : '#6B7280',
              color: 'white',
            }}
          >
            {syncStates.all.loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            {syncStates.all.loading ? 'Syncing all…' : 'Sync Everything'}
          </button>
        </div>

        {/* ─── Individual Sync Cards ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {syncCards.map(({ key, icon: Icon, label, desc, lastSync, btnLabel, color, lightColor }) => {
            const state = syncStates[key];
            return (
              <div key={key} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: lightColor }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  {state.result && !state.loading && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${state.result.error ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                      {state.result.error ? 'Error' : `+${state.result.synced}`}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{formatDate(lastSync)}</span>
                </div>

                {state.result && !state.loading && state.result.error && (
                  <p className="text-xs text-red-500 truncate">{state.result.error}</p>
                )}

                <button
                  onClick={() => doSync(key)}
                  disabled={state.loading || !hasToken}
                  className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white"
                  style={{ background: hasToken ? color : '#9CA3AF' }}
                >
                  {state.loading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Syncing…</>
                  ) : (
                    <><Play className="w-4 h-4" /> {btnLabel}</>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* ─── Webhooks Card ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-50">
              <Zap className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Real-Time Webhooks</h2>
              <p className="text-xs text-gray-500">Auto-sync when Pixxi adds or updates data</p>
            </div>
            <div className="ml-auto">
              {isWebhookSubscribed ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
                  <Wifi className="w-3.5 h-3.5" /> Subscribed
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                  <WifiOff className="w-3.5 h-3.5" /> Not subscribed
                </span>
              )}
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-gray-600 mb-4">
              Webhooks allow Pixxi to instantly notify this CRM when leads or listings change — no manual sync needed.
              Callback URL: <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">https://crm.astraterra.ae/api/pixxi/webhook/receive</code>
            </p>

            {/* Event badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {webhookEvents.map(ev => (
                <div key={ev} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${isWebhookSubscribed ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                  {isWebhookSubscribed ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span className="truncate">{ev.replace('_', ' ')}</span>
                </div>
              ))}
            </div>

            {webhookMsg && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${webhookMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : webhookMsg.startsWith('⚠️') ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                {webhookMsg}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={setupWebhooks}
                disabled={webhookLoading || !hasToken}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: hasToken ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' : '#9CA3AF' }}
              >
                {webhookLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Setup Webhooks
              </button>
              <button
                onClick={() => fetchWebhookSubs()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                style={{ borderColor: '#E5E7EB', color: '#374151' }}
              >
                <Settings className="w-4 h-4" />
                Check Subscriptions
              </button>
              {isWebhookSubscribed && (
                <button
                  onClick={() => removeWebhooks()}
                  disabled={webhookLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                >
                  <XCircle className="w-4 h-4" />
                  Remove All Webhooks
                </button>
              )}
            </div>

            {webhookSubs.length > 0 && (
              <div className="mt-4 border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Event</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Callback URL</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhookSubs.map((sub: any, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{sub.event || sub.eventType}</td>
                        <td className="px-4 py-2.5 text-gray-500 truncate max-w-xs">{sub.callbackUrl || sub.url}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs">active</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ─── Sync Log ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50">
              <Database className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Recent Sync Log</h2>
            <button
              onClick={fetchConfig}
              className="ml-auto text-xs flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          {syncLog.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No syncs yet. Run your first sync above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Records Synced</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Errors</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLog.map(entry => (
                    <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3">
                        <span className="capitalize font-medium text-gray-900">{entry.sync_type}</span>
                      </td>
                      <td className="px-6 py-3 text-gray-700">{entry.records_synced.toLocaleString()}</td>
                      <td className="px-6 py-3">
                        {entry.errors > 0 ? (
                          <span className="text-red-600">{entry.errors}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{formatDate(entry.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── Info Footer ─────────────────────────────────────────────── */}
        <div className="rounded-2xl px-6 py-5 text-sm" style={{ background: 'rgba(201,169,110,0.08)', border: `1px solid rgba(201,169,110,0.2)` }}>
          <h3 className="font-semibold mb-2" style={{ color: goldDark }}>About Pixxi CRM Integration</h3>
          <ul className="space-y-1 text-gray-600 text-xs list-disc list-inside">
            <li>Synced properties also appear in <strong>Sale Listings</strong> &amp; <strong>Rent Listings</strong></li>
            <li>Synced leads are added to your <strong>Contacts</strong> — no duplicates by phone</li>
            <li>Webhooks trigger instant updates without manual syncing</li>
            <li>Data is stored in Pixxi-specific tables AND merged into main CRM tables</li>
            <li>All photos are stored as JSON arrays and displayed in property cards</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
