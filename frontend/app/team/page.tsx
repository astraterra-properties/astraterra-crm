'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Star, Award, FileText } from 'lucide-react';

const SPECIALTY_LABEL: Record<string, string> = {
  secondary: 'Secondary Market',
  offplan: 'Off-Plan',
  both: 'Secondary & Off-Plan',
  rental: 'Rental',
  commercial: 'Commercial',
};

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: '#7C3AED' },
  admin: { label: 'Admin', color: '#1D4ED8' },
  finance: { label: 'Finance', color: '#065F46' },
  agent: { label: 'Agent', color: '#92400E' },
};

interface TeamMember {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar_url?: string;
  rera_number?: string;
  specialty?: string;
  transactions_count?: number;
  about?: string;
  profile_complete: number;
  created_at: string;
}

export default function TeamPage() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TeamMember | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetch('/api/auth/team', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setTeam(d.team || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.15)' }}>
          <Users className="w-5 h-5" style={{ color: '#C9A96E' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Team Directory</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{team.length} team members</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {team.map(member => {
            const badge = ROLE_BADGE[member.role] || { label: member.role, color: '#374151' };
            return (
              <div
                key={member.id}
                onClick={() => setSelected(member)}
                className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02]"
                style={{ background: '#131B2B', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-lg flex-shrink-0 overflow-hidden" style={{ background: 'linear-gradient(135deg,#0a1628,#1e2a3d)', border: '2px solid #C9A96E' }}>
                    {member.avatar_url
                      ? <img src={member.avatar_url} className="w-full h-full object-cover" alt={member.name} />
                      : initials(member.name || '?')
                    }
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{member.name}</div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: badge.color + '22', color: badge.color }}>{badge.label}</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {member.rera_number && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(201,169,110,0.1)', color: '#C9A96E' }}>
                      <Award className="w-3 h-3" />
                      RERA {member.rera_number}
                    </span>
                  )}
                  {member.specialty && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
                      <Star className="w-3 h-3" />
                      {SPECIALTY_LABEL[member.specialty] || member.specialty}
                    </span>
                  )}
                </div>

                {/* Transactions */}
                {(member.transactions_count ?? 0) > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C9A96E' }} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      <span className="font-semibold text-white">{member.transactions_count}</span> transactions
                    </span>
                  </div>
                )}

                {/* About snippet */}
                {member.about && (
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {member.about}
                  </p>
                )}

                {!member.profile_complete && (
                  <div className="mt-3 text-xs px-2 py-1 rounded-lg text-center" style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
                    Profile incomplete
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#131B2B', border: '1px solid rgba(201,169,110,0.3)' }}>
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#0a1628,#131B2B)', borderBottom: '1px solid rgba(201,169,110,0.2)' }}>
              <h2 className="text-base font-bold text-white">Profile</h2>
              <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white transition-colors text-lg">✕</button>
            </div>

            <div className="p-6">
              {/* Avatar + Name */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-white text-2xl flex-shrink-0 overflow-hidden" style={{ background: 'linear-gradient(135deg,#0a1628,#1e2a3d)', border: '3px solid #C9A96E' }}>
                  {selected.avatar_url
                    ? <img src={selected.avatar_url} className="w-full h-full object-cover" alt={selected.name} />
                    : initials(selected.name || '?')
                  }
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selected.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: (ROLE_BADGE[selected.role]?.color || '#374151') + '22', color: ROLE_BADGE[selected.role]?.color || '#fff' }}>
                    {ROLE_BADGE[selected.role]?.label || selected.role}
                  </span>
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                {[
                  { label: 'Email', value: selected.email },
                  { label: 'Phone', value: selected.phone },
                  { label: 'RERA Number', value: selected.rera_number },
                  { label: 'Specialty', value: selected.specialty ? SPECIALTY_LABEL[selected.specialty] || selected.specialty : null },
                  { label: 'Transactions', value: (selected.transactions_count ?? 0) > 0 ? `${selected.transactions_count} deals closed` : null },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="flex justify-between items-start gap-2">
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>{f.label}</span>
                    <span className="text-sm text-right text-white">{f.value}</span>
                  </div>
                ))}

                {selected.about && (
                  <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>About</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{selected.about}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
