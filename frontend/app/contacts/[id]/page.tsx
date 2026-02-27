'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, User, Phone, Mail, MapPin, Home, DollarSign, Edit2, MessageCircle, Send, X, Clock, Plus, Activity } from 'lucide-react';

interface Contact {
  id: number; name: string; phone: string; email: string;
  type: string; status: string; location_preference: string;
  budget_min: number; budget_max: number; property_type: string;
  bedrooms: number; purpose: string; notes: string; created_at: string;
}

const typeColors: Record<string, { bg: string; text: string }> = {
  buyer:    { bg: '#ECFDF5', text: '#065F46' },
  seller:   { bg: '#EFF6FF', text: '#1D4ED8' },
  tenant:   { bg: '#FFFBEB', text: '#92400E' },
  landlord: { bg: '#F5F3FF', text: '#5B21B6' },
};

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [newActivity, setNewActivity] = useState({ activity_type: 'call', description: '', channel: 'phone' });
  const [savingActivity, setSavingActivity] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchContact();
    fetchActivities();
  }, [id]);

  const fetchActivities = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/lead-activity/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch { }
  };

  const handleLogActivity = async () => {
    if (!newActivity.description.trim()) return;
    setSavingActivity(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/lead-activity', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: parseInt(id), ...newActivity }),
      });
      setNewActivity({ activity_type: 'call', description: '', channel: 'phone' });
      setShowActivityForm(false);
      fetchActivities();
    } catch { }
    finally { setSavingActivity(false); }
  };

  const fetchContact = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/contacts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setContact(data);
        setForm(data);
      } else {
        router.push('/contacts');
      }
    } catch { router.push('/contacts'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { const data = await res.json(); setContact(data); setForm(data); setEditing(false); }
    } catch { }
    finally { setSaving(false); }
  };

  const handleSendEmail = async () => {
    if (!contact?.email || !emailForm.subject || !emailForm.body) return;
    setSendingEmail(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/email/transactional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          to: contact.email, toName: contact.name, subject: emailForm.subject,
          htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#131B2B;color:#fff;border-radius:12px;overflow:hidden;"><div style="background:linear-gradient(135deg,#C9A96E,#8A6F2F);padding:28px;"><h2 style="margin:0;color:white;">Astraterra Properties</h2></div><div style="padding:28px;">${emailForm.body.replace(/\n/g, '<br/>')}</div></div>`,
        }),
      });
      const data = await res.json();
      setEmailResult(data.success ? 'Email sent!' : `Error: ${data.error}`);
      if (data.success) setTimeout(() => { setEmailModal(false); setEmailResult(null); setEmailForm({ subject: '', body: '' }); }, 2000);
    } catch (e: any) { setEmailResult(`Error: ${e.message}`); }
    finally { setSendingEmail(false); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none";
  const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };
  const tc = typeColors[contact?.type || ''] || { bg: '#F9FAFB', text: '#6B7280' };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#F4F6F9' }}>
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
    </div>
  );

  if (!contact) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/contacts')}
              className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
              style={{ color: '#6B7280', background: '#F3F4F6' }}>
              <ArrowLeft className="w-4 h-4" /> Contacts
            </button>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              {(contact.name || contact.phone || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>{contact.name || 'No name'}</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: tc.bg, color: tc.text }}>{contact.type}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {contact.phone && (
              <a href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg"
                style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}
            {contact.email && (
              <button onClick={() => setEmailModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg"
                style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                <Mail className="w-4 h-4" /> Email
              </button>
            )}
            <button onClick={() => setEditing(!editing)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
              <Edit2 className="w-4 h-4" /> {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Contact Info */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 className="text-sm font-bold mb-4 pb-2 border-b" style={{ color: '#131B2B', borderColor: '#F3F4F6' }}>Contact Information</h2>
          {editing ? (
            <div className="space-y-3">
              {[
                { label: 'Name', key: 'name', type: 'text' },
                { label: 'Phone', key: 'phone', type: 'text' },
                { label: 'Email', key: 'email', type: 'email' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className={inputCls} style={inputStyle} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Type</label>
                <select value={form.type || ''} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls} style={inputStyle}>
                  {['buyer','seller','tenant','landlord'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Status</label>
                <select value={form.status || ''} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls} style={inputStyle}>
                  {['active','inactive','archived'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { icon: <User className="w-4 h-4" />, label: 'Name', value: contact.name },
                { icon: <Phone className="w-4 h-4" />, label: 'Phone', value: contact.phone },
                { icon: <Mail className="w-4 h-4" />, label: 'Email', value: contact.email },
              ].map(f => f.value ? (
                <div key={f.label} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F' }}>
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{f.label}</p>
                    <p className="text-sm font-medium" style={{ color: '#131B2B' }}>{f.value}</p>
                  </div>
                </div>
              ) : null)}
              <div className="pt-2 flex items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: tc.bg, color: tc.text }}>{contact.type}</span>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>{contact.status}</span>
              </div>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>Added {new Date(contact.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          )}
        </div>

        {/* Requirements */}
        <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 className="text-sm font-bold mb-4 pb-2 border-b" style={{ color: '#131B2B', borderColor: '#F3F4F6' }}>Requirements</h2>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Location Preference</label>
                <input type="text" value={form.location_preference || ''} onChange={e => setForm({ ...form, location_preference: e.target.value })} className={inputCls} style={inputStyle} placeholder="e.g. Dubai Marina" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Property Type</label>
                <select value={form.property_type || ''} onChange={e => setForm({ ...form, property_type: e.target.value })} className={inputCls} style={inputStyle}>
                  {['','apartment','villa','townhouse','penthouse','commercial','office','retail','studio'].map(t => <option key={t} value={t}>{t || 'Select...'}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Budget Min (AED)</label>
                  <input type="number" value={form.budget_min || ''} onChange={e => setForm({ ...form, budget_min: parseInt(e.target.value) })} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Budget Max (AED)</label>
                  <input type="number" value={form.budget_max || ''} onChange={e => setForm({ ...form, budget_max: parseInt(e.target.value) })} className={inputCls} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Bedrooms</label>
                <select value={form.bedrooms ?? ''} onChange={e => setForm({ ...form, bedrooms: parseInt(e.target.value) })} className={inputCls} style={inputStyle}>
                  {['','0','1','2','3','4','5+'].map(b => <option key={b} value={b}>{b || 'Any'}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { icon: <MapPin className="w-4 h-4" />, label: 'Location', value: contact.location_preference },
                { icon: <Home className="w-4 h-4" />, label: 'Property Type', value: contact.property_type ? `${contact.property_type}${contact.bedrooms ? ` · ${contact.bedrooms} BR` : ''}` : null },
                { icon: <DollarSign className="w-4 h-4" />, label: 'Budget', value: contact.budget_min ? `AED ${contact.budget_min.toLocaleString()} – ${contact.budget_max?.toLocaleString()}` : null },
              ].map(f => f.value ? (
                <div key={f.label} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F' }}>
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{f.label}</p>
                    <p className="text-sm font-medium" style={{ color: '#131B2B' }}>{f.value}</p>
                  </div>
                </div>
              ) : null)}
              {!contact.location_preference && !contact.property_type && !contact.budget_min && (
                <p className="text-sm" style={{ color: '#9CA3AF' }}>No requirements specified</p>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border p-5 md:col-span-2" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 className="text-sm font-bold mb-4 pb-2 border-b" style={{ color: '#131B2B', borderColor: '#F3F4F6' }}>Notes</h2>
          {editing ? (
            <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}
              className={inputCls} style={inputStyle} rows={4} placeholder="Add notes about this contact..." />
          ) : (
            <p className="text-sm whitespace-pre-wrap" style={{ color: contact.notes ? '#374151' : '#9CA3AF' }}>
              {contact.notes || 'No notes yet'}
            </p>
          )}
        </div>

        {/* Save button */}
        {editing && (
          <div className="md:col-span-2 flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => { setEditing(false); setForm(contact); }}
              className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
              style={{ background: '#F3F4F6', color: '#374151' }}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Activity Timeline */}
      <div className="mt-6 bg-white rounded-xl border p-5" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: '#F3F4F6' }}>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: '#C9A96E' }} />
            <h2 className="text-sm font-bold" style={{ color: '#131B2B' }}>Activity Timeline</h2>
            <span className="px-1.5 py-0.5 text-xs rounded-full font-semibold" style={{ background: '#F3F4F6', color: '#6B7280' }}>
              {activities.length}
            </span>
          </div>
          <button
            onClick={() => setShowActivityForm(!showActivityForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
            style={{ background: 'rgba(201,169,110,0.1)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}
          >
            <Plus className="w-3 h-3" /> Log Activity
          </button>
        </div>

        {showActivityForm && (
          <div className="mb-4 p-4 rounded-xl border" style={{ background: '#F9FAFB', borderColor: '#E5E7EB' }}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Activity Type</label>
                <select value={newActivity.activity_type} onChange={e => setNewActivity({ ...newActivity, activity_type: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                  <option value="call">📞 Call</option>
                  <option value="email">✉️ Email</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="meeting">🤝 Meeting</option>
                  <option value="viewing">🏠 Property Viewing</option>
                  <option value="follow_up">🔔 Follow Up</option>
                  <option value="note">📝 Note</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#374151' }}>Channel</label>
                <select value={newActivity.channel} onChange={e => setNewActivity({ ...newActivity, channel: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg" style={{ borderColor: '#E5E7EB', color: '#374151' }}>
                  <option value="phone">Phone</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="in_person">In Person</option>
                  <option value="video_call">Video Call</option>
                </select>
              </div>
            </div>
            <textarea
              value={newActivity.description}
              onChange={e => setNewActivity({ ...newActivity, description: e.target.value })}
              placeholder="Describe the activity (e.g. 'Called client, interested in 2BR in Marina. Will send listings.')"
              rows={3}
              className="w-full px-3 py-2 text-sm border rounded-lg resize-none mb-3"
              style={{ borderColor: '#E5E7EB', color: '#374151' }}
            />
            <div className="flex gap-2">
              <button onClick={handleLogActivity} disabled={savingActivity || !newActivity.description.trim()}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}>
                {savingActivity ? 'Saving...' : 'Log Activity'}
              </button>
              <button onClick={() => setShowActivityForm(false)}
                className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </div>
        )}

        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: '#9CA3AF' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>No activities logged yet</p>
            <p className="text-xs mt-1" style={{ color: '#D1D5DB' }}>Log calls, emails, viewings and more</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((act, i) => {
              const typeEmojis: Record<string, string> = {
                call: '📞', email: '✉️', whatsapp: '💬', meeting: '🤝',
                viewing: '🏠', follow_up: '🔔', note: '📝', inbound_lead: '🎯',
              };
              const typeColors2: Record<string, { bg: string; text: string }> = {
                call: { bg: '#EFF6FF', text: '#1D4ED8' },
                email: { bg: '#F5F3FF', text: '#5B21B6' },
                whatsapp: { bg: '#ECFDF5', text: '#065F46' },
                meeting: { bg: '#FFFBEB', text: '#92400E' },
                viewing: { bg: '#FFF7ED', text: '#C2410C' },
                follow_up: { bg: '#FEF2F2', text: '#DC2626' },
                note: { bg: '#F9FAFB', text: '#374151' },
                inbound_lead: { bg: '#ECFDF5', text: '#059669' },
              };
              const col = typeColors2[act.activity_type] || { bg: '#F9FAFB', text: '#374151' };
              return (
                <div key={act.id} className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    style={{ background: col.bg }}>
                    {typeEmojis[act.activity_type] || '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold capitalize" style={{ color: col.text }}>
                        {(act.activity_type || '').replace('_', ' ')}
                      </span>
                      {act.channel && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', color: '#6B7280' }}>
                          {act.channel}
                        </span>
                      )}
                      <span className="text-xs ml-auto" style={{ color: '#9CA3AF' }}>
                        {new Date(act.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: '#374151' }}>{act.description}</p>
                    {act.created_by_name && (
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>by {act.created_by_name}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Email Modal */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#131B2B', border: '1px solid rgba(201,169,110,0.3)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <h3 className="font-semibold text-white text-sm">Send Email</h3>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>To: {contact.name} ({contact.email})</p>
              </div>
              <button onClick={() => { setEmailModal(false); setEmailResult(null); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {emailResult && (
                <div className={`p-3 rounded-lg text-sm ${emailResult.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}
                  style={{ background: emailResult.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)' }}>
                  {emailResult}
                </div>
              )}
              <input type="text" value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                placeholder="Subject" className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,169,110,0.3)', color: 'white' }} />
              <textarea value={emailForm.body} onChange={e => setEmailForm({ ...emailForm, body: e.target.value })}
                placeholder={`Dear ${contact.name},\n\nI wanted to reach out regarding...`} rows={5}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(201,169,110,0.3)', color: 'white' }} />
              <div className="flex gap-3">
                <button onClick={handleSendEmail} disabled={sendingEmail || !emailForm.subject || !emailForm.body}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', opacity: sendingEmail ? 0.7 : 1 }}>
                  <Send className="w-4 h-4" /> {sendingEmail ? 'Sending...' : 'Send Email'}
                </button>
                <button onClick={() => { setEmailModal(false); setEmailResult(null); }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
