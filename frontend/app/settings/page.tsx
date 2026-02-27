'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Building2, Plug, Shield, Info, CheckCircle, XCircle, Loader, ExternalLink } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [emailTestStatus, setEmailTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [driveStatus, setDriveStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [syncResult, setSyncResult] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
  }, []);

  const testEmail = async () => {
    setEmailTestStatus('testing');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/email/test', { headers: { Authorization: `Bearer ${token}` } });
      setEmailTestStatus(res.ok ? 'ok' : 'error');
    } catch { setEmailTestStatus('error'); }
  };

  const testDrive = async () => {
    setDriveStatus('testing');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/drive/status', { headers: { Authorization: `Bearer ${token}` } });
      setDriveStatus(res.ok ? 'ok' : 'error');
    } catch { setDriveStatus('error'); }
  };

  const syncInbox = async () => {
    setSyncStatus('syncing');
    setSyncResult('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/email/inbox/sync?limit=50', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setSyncStatus('ok');
        setSyncResult(`✅ ${data.leads_added} new lead${data.leads_added !== 1 ? 's' : ''} added from ${data.processed} emails`);
      } else {
        setSyncStatus('error');
        setSyncResult(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setSyncStatus('error');
      setSyncResult('Connection failed');
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { bg: string; text: string; label: string; icon: any }> = {
      idle:    { bg: '#F9FAFB', text: '#6B7280', label: 'Not tested', icon: null },
      testing: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Testing...', icon: Loader },
      ok:      { bg: '#ECFDF5', text: '#065F46', label: 'Connected', icon: CheckCircle },
      error:   { bg: '#FEF2F2', text: '#DC2626', label: 'Error', icon: XCircle },
    };
    const cfg = map[status] || map.idle;
    const Icon = cfg.icon;
    return (
      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.text }}>
        {Icon && <Icon className={`w-3 h-3 ${status === 'testing' ? 'animate-spin' : ''}`} />}
        {cfg.label}
      </span>
    );
  };

  const SectionHeader = ({ icon, title }: { icon: string; title: string }) => (
    <div className="px-6 py-4 border-b flex items-center gap-2" style={{ background: '#FAFAFA', borderColor: '#F3F4F6' }}>
      <span className="text-base">{icon}</span>
      <h2 className="text-sm font-semibold" style={{ color: '#131B2B' }}>{title}</h2>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Settings</h1>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Configure Astraterra CRM for your business</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 max-w-4xl mx-auto space-y-5">

        {/* Company Info */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <SectionHeader icon="🏢" title="Company Information" />
          <div className="p-6 grid md:grid-cols-2 gap-4">
            {[
              { label: 'Company Name', value: 'Astra Terra Properties' },
              { label: 'Email', value: 'admin@astraterra.ae' },
              { label: 'Phone', value: '+971 4 570 3846' },
              { label: 'WhatsApp', value: '+971 58 558 0053' },
              { label: 'Address', value: 'Oxford Tower, Office 502, Business Bay, Dubai' },
              { label: 'Country', value: 'United Arab Emirates' },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B7280' }}>{field.label}</label>
                <input
                  type="text"
                  defaultValue={field.value}
                  readOnly
                  className="w-full px-3.5 py-2.5 text-sm border rounded-lg"
                  style={{ borderColor: '#E5E7EB', background: '#F9FAFB', color: '#374151' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <SectionHeader icon="🔌" title="Integration Status" />
          <div className="p-6 space-y-3">
            {[
              {
                icon: '📧', title: 'Email (Gmail API)', desc: 'admin@astraterra.ae via OAuth2',
                bg: '#EFF6FF', status: emailTestStatus,
                action: () => testEmail(), actionLabel: 'Test',
                actionStyle: { background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white' },
              },
              {
                icon: '📁', title: 'Google Drive', desc: 'Service account — Astraterra Properties folder',
                bg: '#FFFBEB', status: driveStatus,
                action: () => testDrive(), actionLabel: 'Test',
                actionStyle: { background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white' },
              },
              {
                icon: '💬', title: 'WhatsApp Business', desc: '+971 58 558 0053 — Click-to-chat',
                bg: '#ECFDF5', status: 'ok',
                action: () => window.open('https://wa.me/971585580053', '_blank'), actionLabel: 'Open',
                actionStyle: { background: '#25D366', color: 'white' },
              },
              {
                icon: '🗄️', title: 'Database (SQLite)', desc: '/data/astraterra-crm.db',
                bg: '#EFF6FF', status: 'ok',
                action: null, actionLabel: null,
                actionStyle: {},
              },
            ].map((item) => (
              <div key={item.title}
                className="flex items-center justify-between p-4 rounded-xl border"
                style={{ background: item.bg + '40', borderColor: '#F3F4F6' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: item.bg }}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{item.title}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{item.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.status} />
                  {item.action && item.actionLabel && (
                    <button
                      onClick={item.action}
                      disabled={item.status === 'testing'}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                      style={item.actionStyle}
                    >
                      {item.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gmail Inbox → Auto Lead Sync */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <SectionHeader icon="📥" title="Gmail Inbox → Auto Lead Import" />
          <div className="p-6">
            <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
              Scan unread emails in <strong>admin@astraterra.ae</strong> inbox and automatically add new senders as leads in the CRM.
              Automated emails (newsletters, notifications) are filtered out.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={syncInbox}
                disabled={syncStatus === 'syncing'}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white' }}
              >
                {syncStatus === 'syncing' ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Syncing...</>
                ) : '📥 Sync Inbox Now'}
              </button>
              {syncResult && (
                <span className="text-sm font-medium" style={{ color: syncStatus === 'ok' ? '#065F46' : '#DC2626' }}>
                  {syncResult}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <SectionHeader icon="⚙️" title="CRM Preferences" />
          <div className="p-6 divide-y" style={{ borderColor: '#F9FAFB' }}>
            {[
              { label: 'Currency', value: 'AED (UAE Dirham)', desc: 'Default currency for deals' },
              { label: 'Date Format', value: 'DD/MM/YYYY', desc: 'Display format for all dates' },
              { label: 'Time Zone', value: 'Asia/Dubai (UTC+4)', desc: 'Business time zone' },
              { label: 'Language', value: 'English', desc: 'Interface language' },
            ].map((pref) => (
              <div key={pref.label} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#131B2B' }}>{pref.label}</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>{pref.desc}</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB' }}>{pref.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <SectionHeader icon="🔐" title="Access & Security" />
          <div className="p-6 divide-y" style={{ borderColor: '#F9FAFB' }}>
            {[
              { label: 'Authentication', desc: 'JWT Bearer tokens — 24h expiry' },
              { label: 'Password Hashing', desc: 'bcrypt with salt rounds' },
              { label: 'CORS Protection', desc: 'Cross-origin request filtering' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#131B2B' }}>{item.label}</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>{item.desc}</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#ECFDF5', color: '#065F46' }}>
                  <CheckCircle className="w-3 h-3" /> Active
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div
          className="rounded-xl border p-6"
          style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4" style={{ color: '#C9A96E' }} />
            <h3 className="text-sm font-semibold text-white">System Information</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { label: 'CRM Version', value: 'v1.0.0' },
              { label: 'Backend', value: 'Node.js + Express' },
              { label: 'Frontend', value: 'Next.js 14 + TypeScript' },
              { label: 'Database', value: 'SQLite (local)' },
              { label: 'Authentication', value: 'JWT Bearer Tokens' },
              { label: 'File Storage', value: 'Local + Google Drive' },
              { label: 'Charts', value: 'Recharts' },
              { label: 'UI Framework', value: 'Tailwind CSS' },
            ].map((info) => (
              <div key={info.label} className="flex justify-between gap-2">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{info.label}:</span>
                <span className="text-xs font-semibold" style={{ color: '#C9A96E' }}>{info.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Astra Terra Properties · Oxford Tower, Office 502, Business Bay, Dubai
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
