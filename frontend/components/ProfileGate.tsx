'use client';

import { useEffect, useState } from 'react';
import { Shield, User } from 'lucide-react';
import Image from 'next/image';

interface ProfileForm {
  name: string;
  phone: string;
  rera_number: string;
  specialty: string;
  transactions_count: string;
  about: string;
}

// Roles that require RERA card
const RERA_REQUIRED_ROLES = ['agent', 'sales_manager'];

export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [userRole, setUserRole] = useState<string>('agent');
  const [form, setForm] = useState<ProfileForm>({
    name: '', phone: '', rera_number: '', specialty: 'secondary', transactions_count: '0', about: ''
  });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<ProfileForm>>({});

  const reraRequired = RERA_REQUIRED_ROLES.includes(userRole);

  useEffect(() => {
    const verify = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { setChecking(false); return; }

        // Always verify against server — stale localStorage can have missing profile_complete
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) { setChecking(false); return; }

        const data = await res.json();
        const user = data.user || data;

        // Refresh localStorage with up-to-date user data
        const existing = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...existing, ...user }));

        setUserRole(user.role || 'agent');

        if (!user.profile_complete) {
          setNeedsProfile(true);
          setForm({
            name: user.name || '',
            phone: user.phone || '',
            rera_number: user.rera_number || '',
            specialty: user.specialty || 'secondary',
            transactions_count: String(user.transactions_count ?? 0),
            about: user.about || '',
          });
          setAvatarUrl(user.avatar_url || '');
        }
      } catch {
        // Fallback: read localStorage only
        try {
          const stored = localStorage.getItem('user');
          if (stored) {
            const user = JSON.parse(stored);
            setUserRole(user.role || 'agent');
            if (!user.profile_complete) {
              setNeedsProfile(true);
              setForm({
                name: user.name || '',
                phone: user.phone || '',
                rera_number: user.rera_number || '',
                specialty: user.specialty || 'secondary',
                transactions_count: String(user.transactions_count ?? 0),
                about: user.about || '',
              });
              setAvatarUrl(user.avatar_url || '');
            }
          }
        } catch {}
      }
      setChecking(false);
    };
    verify();
  }, []);

  const validate = () => {
    const e: Partial<ProfileForm> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.phone.trim()) e.phone = 'Required';
    if (reraRequired && !form.rera_number.trim()) e.rera_number = 'Required';
    if (!form.about.trim()) e.about = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, transactions_count: Number(form.transactions_count) || 0, avatar_url: avatarUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        const updated = { ...stored, ...data.user };
        localStorage.setItem('user', JSON.stringify(updated));
        setNeedsProfile(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save. Please try again.');
      }
    } catch {
      alert('Failed to save. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none bg-white";
  const inputStyle = { borderColor: '#E5E7EB', color: '#374151' };
  const focusStyle = { borderColor: '#C9A96E', boxShadow: '0 0 0 3px rgba(201,169,110,0.12)' };

  // Render children immediately while checking — don't block on auth
  if (!needsProfile || checking) return <>{children}</>;

  // Only show modal if profile is definitely incomplete (checked=done AND needsProfile=true)

  const initials = form.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ME';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(10,22,40,0.96)' }}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#0a1628 0%,#131B2B 100%)', borderBottom: '2px solid #C9A96E' }}>
          <div className="p-2 rounded-lg" style={{ background: 'rgba(201,169,110,0.15)' }}>
            <Shield className="w-5 h-5" style={{ color: '#C9A96E' }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Complete Your Profile</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Required before accessing the CRM</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Image src="/astraterra-logo-transparent.png" alt="Astraterra" width={100} height={30} style={{ height: '26px', width: 'auto' }} />
            <button
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
              }}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
            Your profile is visible to all team members. Please fill in all required fields to get started.
          </p>

          {/* Avatar */}
          <div className="flex justify-center mb-5">
            <label className="cursor-pointer group">
              <div className="w-20 h-20 rounded-full flex items-center justify-center relative overflow-hidden border-4" style={{ borderColor: '#C9A96E', background: '#131B2B' }}>
                {avatarUrl
                  ? <img src={avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                  : <span className="text-2xl font-bold text-white">{initials}</span>
                }
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-xs text-center mt-1.5" style={{ color: '#C9A96E' }}>Upload Photo</p>
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append('file', file);
                fd.append('upload_preset', 'ml_default');
                fd.append('folder', 'crm-avatars');
                try {
                  const r = await fetch('https://api.cloudinary.com/v1_1/dumt7udjd/image/upload', { method: 'POST', body: fd });
                  const d = await r.json();
                  if (d.secure_url) setAvatarUrl(d.secure_url);
                } catch { alert('Photo upload failed'); }
              }} />
            </label>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>Full Name <span style={{ color: '#DC2626' }}>*</span></label>
              <input
                className={inputClass}
                style={{ ...inputStyle, ...(errors.name ? { borderColor: '#DC2626' } : {}) }}
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = errors.name ? '#DC2626' : '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                placeholder="e.g. Joseph Toubia"
              />
              {errors.name && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.name}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>Phone <span style={{ color: '#DC2626' }}>*</span></label>
              <input
                className={inputClass}
                style={{ ...inputStyle, ...(errors.phone ? { borderColor: '#DC2626' } : {}) }}
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = errors.phone ? '#DC2626' : '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                placeholder="+971 50 000 0000"
              />
              {errors.phone && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.phone}</p>}
            </div>

            {/* RERA Number */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>
                RERA Broker Number {reraRequired && <span style={{ color: '#DC2626' }}>*</span>}
                {!reraRequired && <span className="font-normal ml-1" style={{ color: '#9CA3AF' }}>(optional)</span>}
              </label>
              <input
                className={inputClass}
                style={{ ...inputStyle, ...(errors.rera_number ? { borderColor: '#DC2626' } : {}) }}
                value={form.rera_number}
                onChange={e => setForm(p => ({ ...p, rera_number: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = errors.rera_number ? '#DC2626' : '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                placeholder="e.g. 54738"
              />
              {errors.rera_number && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.rera_number}</p>}
            </div>

            {/* Specialty */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>Specialty <span style={{ color: '#DC2626' }}>*</span></label>
              <select
                className={inputClass}
                style={inputStyle}
                value={form.specialty}
                onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))}
                onFocus={e => { (e.target as HTMLSelectElement).style.borderColor = '#C9A96E'; (e.target as HTMLSelectElement).style.boxShadow = focusStyle.boxShadow; }}
                onBlur={e => { (e.target as HTMLSelectElement).style.borderColor = '#E5E7EB'; (e.target as HTMLSelectElement).style.boxShadow = 'none'; }}
              >
                <option value="secondary">Secondary Market</option>
                <option value="offplan">Off-Plan</option>
                <option value="both">Both (Secondary & Off-Plan)</option>
                <option value="rental">Rental</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            {/* Transactions */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>Transactions Completed</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                style={inputStyle}
                value={form.transactions_count}
                onChange={e => setForm(p => ({ ...p, transactions_count: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                placeholder="0"
              />
              <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Total number of deals you have closed in your career</p>
            </div>

            {/* About */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#374151' }}>About You <span style={{ color: '#DC2626' }}>*</span></label>
              <textarea
                rows={3}
                className={inputClass}
                style={{ ...inputStyle, resize: 'none', ...(errors.about ? { borderColor: '#DC2626' } : {}) }}
                value={form.about}
                onChange={e => setForm(p => ({ ...p, about: e.target.value }))}
                onFocus={e => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = errors.about ? '#DC2626' : '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                placeholder="Tell your team a bit about yourself, your background, and what you specialise in..."
              />
              {errors.about && <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{errors.about}</p>}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-6 py-3 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-all"
            style={{ background: saving ? '#9CA3AF' : 'linear-gradient(135deg,#C9A96E,#a8845a)' }}
          >
            {saving ? 'Saving...' : '✓ Complete Profile & Enter CRM'}
          </button>
        </div>
      </div>
    </div>
  );
}
