'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, Calendar, Plus, Users, Clock, X, Trash2, ExternalLink, User } from 'lucide-react';

interface Meeting {
  id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  created_by: number;
  creator_name?: string;
  attendees: number[];
  video_room_id: string;
  status: string;
  meeting_type: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  created_at: string;
}

interface StaffUser {
  id: number;
  name: string;
  avatar_url?: string;
  role: string;
  email: string;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  in_progress: { label: 'Live', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  completed: { label: 'Done', color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
  cancelled: { label: 'Cancelled', color: '#DC2626', bg: 'rgba(220,38,38,0.1)' },
};

function initials(name: string) { return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?'; }

function Avatar({ name, url, size = 28 }: { name: string; url?: string; size?: number }) {
  return (
    <div className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-semibold text-white"
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#1e2a3d,#0a1628)', fontSize: size * 0.38, border: '1.5px solid rgba(201,169,110,0.25)' }}>
      {url ? <img src={url} className="w-full h-full object-cover" alt={name} /> : initials(name)}
    </div>
  );
}

function formatDt(dt: string) {
  return new Date(dt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isUpcoming(start: string) { return new Date(start) > new Date(); }
function isLive(start: string, end?: string) {
  const now = new Date();
  return new Date(start) <= now && (!end || new Date(end) >= now);
}

export default function MeetingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  // video calls open in new tab (Jitsi blocks iframe embedding)
  const [tab, setTab] = useState<'upcoming' | 'all'>('upcoming');

  const [form, setForm] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    meeting_type: 'internal',
    attendees: [] as number[],
    client_name: '',
    client_email: '',
    client_phone: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    setUser(JSON.parse(localStorage.getItem('user') || '{}'));
    fetchMeetings();
    fetchStaff();
  }, []);

  const fetchMeetings = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const res = await fetch('/api/meetings', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMeetings(data.meetings || []);
    } catch {}
    setLoading(false);
  };

  const fetchStaff = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/auth/team', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setStaff(data.team || []);
    } catch {}
  };

  const createMeeting = async () => {
    if (!form.title || !form.start_time) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setForm({ title: '', description: '', start_time: '', end_time: '', meeting_type: 'internal', attendees: [], client_name: '', client_email: '', client_phone: '' });
        fetchMeetings();
      }
    } catch {}
  };

  const cancelMeeting = async (id: number) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/meetings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchMeetings();
  };

  const joinCall = (meeting: Meeting) => {
    const displayName = encodeURIComponent(user?.name || 'Agent');
    const url = `https://meet.jit.si/${meeting.video_room_id}#userInfo.displayName=${displayName}&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=true`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const startInstantCall = () => {
    const id = `astraterra-instant-${Date.now()}`;
    const displayName = encodeURIComponent(user?.name || 'Agent');
    const url = `https://meet.jit.si/${id}#userInfo.displayName=${displayName}&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=true`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const staffMap = Object.fromEntries(staff.map(s => [s.id, s]));

  const filteredMeetings = meetings.filter(m => {
    if (tab === 'upcoming') return m.status !== 'cancelled' && isUpcoming(m.start_time);
    return true;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(74,222,128,0.12)' }}>
            <Video className="w-5 h-5" style={{ color: '#4ade80' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Meetings & Video Calls</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Schedule meetings and start video calls</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={startInstantCall}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#1a7a4a,#145c38)', color: '#4ade80' }}>
            <Video className="w-4 h-4" />
            Instant Call
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#C9A96E', color: '#0a1628' }}>
            <Plus className="w-4 h-4" />
            Schedule Meeting
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {(['upcoming', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize"
            style={{ background: tab === t ? '#C9A96E' : 'transparent', color: tab === t ? '#0a1628' : 'rgba(255,255,255,0.5)' }}>
            {t === 'upcoming' ? 'Upcoming' : 'All Meetings'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <Calendar className="w-12 h-12 text-white mb-3" />
          <p className="text-white text-base">No {tab === 'upcoming' ? 'upcoming' : ''} meetings</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Schedule a meeting or start an instant call</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredMeetings.map(meeting => {
            const live = isLive(meeting.start_time, meeting.end_time);
            const s = STATUS_BADGE[live ? 'in_progress' : meeting.status] || STATUS_BADGE.scheduled;
            const attendeeUsers = (meeting.attendees || []).map((id: number) => staffMap[id]).filter(Boolean);
            return (
              <div key={meeting.id} className="rounded-2xl p-5" style={{ background: '#131B2B', border: `1px solid ${live ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.07)'}`, boxShadow: live ? '0 0 20px rgba(74,222,128,0.06)' : 'none' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-base font-semibold text-white">{meeting.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>{live ? '🔴 Live Now' : s.label}</span>
                      {meeting.meeting_type === 'client' && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}>Client Meeting</span>
                      )}
                    </div>
                    {meeting.description && <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{meeting.description}</p>}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" style={{ color: '#C9A96E' }} />
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{formatDt(meeting.start_time)}</span>
                      </div>
                      {meeting.client_name && (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" style={{ color: '#C9A96E' }} />
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{meeting.client_name}</span>
                        </div>
                      )}
                    </div>
                    {attendeeUsers.length > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Attendees:</span>
                        <div className="flex -space-x-2">
                          {attendeeUsers.slice(0, 5).map(u => u && (
                            <div key={u.id} title={u.name}>
                              <Avatar name={u.name} url={u.avatar_url} size={26} />
                            </div>
                          ))}
                          {attendeeUsers.length > 5 && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: 'rgba(201,169,110,0.2)', color: '#C9A96E', border: '1.5px solid rgba(201,169,110,0.3)' }}>
                              +{attendeeUsers.length - 5}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {meeting.status !== 'cancelled' && (
                      <>
                        <button onClick={() => joinCall(meeting)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                          style={{ background: live ? 'linear-gradient(135deg,#1a7a4a,#145c38)' : 'rgba(74,222,128,0.1)', color: '#4ade80', border: `1px solid ${live ? 'transparent' : 'rgba(74,222,128,0.2)'}` }}>
                          <Video className="w-3.5 h-3.5" />
                          {live ? 'Join Now' : 'Start Call'}
                        </button>
                        <a href={`https://meet.jit.si/${meeting.video_room_id}#config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=true`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-center"
                          style={{ background: 'rgba(201,169,110,0.08)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.15)' }}>
                          <ExternalLink className="w-3 h-3" />
                          Client Link
                        </a>
                        {meeting.created_by === user?.id && (
                          <button onClick={() => cancelMeeting(meeting.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
                            style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.15)' }}>
                            <Trash2 className="w-3 h-3" />
                            Cancel
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Meeting Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#131B2B', border: '1px solid rgba(201,169,110,0.3)' }}>
            <div className="px-6 py-4 flex items-center justify-between border-b" style={{ background: 'linear-gradient(135deg,#0a1628,#131B2B)', borderColor: 'rgba(201,169,110,0.2)' }}>
              <h2 className="text-base font-bold text-white">Schedule a Meeting</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Meeting Title *</label>
                <input className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none" style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)' }}
                  value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Property Viewing - JVC Unit 504" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Description</label>
                <textarea rows={2} className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none" style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)', resize: 'none' }}
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional notes..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Start Time *</label>
                  <input type="datetime-local" className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none" style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)' }}
                    value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>End Time</label>
                  <input type="datetime-local" className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none" style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)' }}
                    value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Meeting Type</label>
                <select className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none" style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)' }}
                  value={form.meeting_type} onChange={e => setForm(p => ({ ...p, meeting_type: e.target.value }))}>
                  <option value="internal">Internal (Team Only)</option>
                  <option value="client">Client Meeting</option>
                  <option value="viewing">Property Viewing</option>
                  <option value="negotiation">Negotiation Call</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Invite Team Members</label>
                <div className="space-y-1 max-h-36 overflow-y-auto rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {staff.filter(s => s.id !== user?.id).map(s => (
                    <div key={s.id} onClick={() => setForm(p => ({ ...p, attendees: p.attendees.includes(s.id) ? p.attendees.filter(id => id !== s.id) : [...p.attendees, s.id] }))}
                      className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors"
                      style={{ background: form.attendees.includes(s.id) ? 'rgba(201,169,110,0.12)' : 'transparent' }}>
                      <Avatar name={s.name} url={s.avatar_url} size={28} />
                      <span className="text-sm text-white flex-1">{s.name}</span>
                      {form.attendees.includes(s.id) && <span className="text-xs" style={{ color: '#C9A96E' }}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>
              {(form.meeting_type === 'client' || form.meeting_type === 'viewing' || form.meeting_type === 'negotiation') && (
                <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>CLIENT DETAILS</p>
                  <input className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none" style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)' }}
                    value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="Client name" />
                  <input className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none" style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)' }}
                    value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} placeholder="Client email" />
                  <input className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none" style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)' }}
                    value={form.client_phone} onChange={e => setForm(p => ({ ...p, client_phone: e.target.value }))} placeholder="Client phone" />
                  <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(201,169,110,0.08)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.15)' }}>
                    💡 A unique video call link will be auto-generated. You can share it with the client via WhatsApp or email.
                  </div>
                </div>
              )}
              <button onClick={createMeeting} disabled={!form.title || !form.start_time}
                className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40"
                style={{ background: '#C9A96E', color: '#0a1628' }}>
                ✓ Schedule Meeting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video calls open in new tab — Jitsi blocks iframe embedding */}
    </div>
  );
}
