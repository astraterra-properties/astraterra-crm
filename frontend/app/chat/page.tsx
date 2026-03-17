'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { playNotificationSound } from '@/lib/notification-sound';
import {
  MessageSquare, Send, Video, Plus, Users, Search, X, Phone,
  MoreVertical, Hash, Circle, PhoneOff, Reply, Paperclip,
  Smile, Download, Trash2, FileText
} from 'lucide-react';
import JitsiEmbed from '@/components/JitsiEmbed';

interface Room {
  id: number;
  name?: string;
  display_name?: string;
  type: string;
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
  last_sender?: string;
  last_sender_id?: number;
  other_user?: { id: number; name: string; avatar_url?: string; role: string };
}

interface Message {
  id: number;
  room_id: number;
  sender_id: number;
  message: string;
  message_type: string; // 'text' | 'image' | 'file' | 'video_call'
  created_at: string;
  sender_name: string;
  sender_avatar?: string;
  sender_role: string;
  reply_to_id?: number;
  reply_to_message?: string;
  reply_to_sender_name?: string;
  deleted_at?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  reactions: Array<{ emoji: string; user_id: number; user_name: string }>;
}

interface StaffUser {
  id: number;
  name: string;
  avatar_url?: string;
  role: string;
  email: string;
}

const ROLE_COLOR: Record<string, string> = { owner: '#7C3AED', admin: '#1D4ED8', finance: '#065F46', agent: '#92400E' };
const initials = (name: string) => name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';

const COMMON_EMOJIS = [
  '😀','😂','😍','🥰','😎','🤔','😅','🤣','❤️','🔥',
  '👍','👎','🙏','💪','🎉','✅','⭐','💯','🚀','💰',
  '🏠','🔑','📋','📞','💼','🤝','👋','😊','🥳','😭',
  '😤','🤦','🤷','👀','💬','📱','💻','📊','🎯','⚡',
  '🌟','💎','🏆','📈','🎁','🔔','✨','💡','🛑','⚠️',
  '✔️','❌','🔒','📅','🗓️','🕐','💸','🏦','🙌','🫡'
];

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupedReactions(reactions: Message['reactions'], myId: number) {
  const map: Record<string, { emoji: string; count: number; users: string[]; iMine: boolean }> = {};
  (reactions || []).forEach(r => {
    if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, users: [], iMine: false };
    map[r.emoji].count++;
    map[r.emoji].users.push(r.user_name);
    if (r.user_id === myId) map[r.emoji].iMine = true;
  });
  return Object.values(map);
}

function Avatar({ name, url, size = 36 }: { name: string; url?: string; size?: number }) {
  return (
    <div className="flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center font-semibold text-white"
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#1e2a3d,#0a1628)', fontSize: size * 0.35, border: '1.5px solid rgba(201,169,110,0.3)' }}>
      {url ? <img src={url} className="w-full h-full object-cover" alt={name} /> : initials(name)}
    </div>
  );
}

function timeAgo(dt?: string) {
  if (!dt) return '';
  const diff = Date.now() - new Date(dt).getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [videoRoomId, setVideoRoomId] = useState('');
  const [callRoomId, setCallRoomId] = useState('');
  const [showChatDuringCall, setShowChatDuringCall] = useState(false);
  const [isAudioCall, setIsAudioCall] = useState(false);

  // WhatsApp features state
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typers, setTypers] = useState<string[]>([]);
  const [typingTimeout, setTypingTimeout] = useState<any>(null);
  const [roomSearch, setRoomSearch] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<any>(null);
  const roomPollRef = useRef<any>(null);
  const didAutoOpen = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(u);
    fetchRooms();
    fetchStaff();
    roomPollRef.current = setInterval(fetchRooms, 5000);
    return () => {
      clearInterval(pollRef.current);
      clearInterval(roomPollRef.current);
    };
  }, []);

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-open room from URL param
  useEffect(() => {
    if (didAutoOpen.current || rooms.length === 0) return;
    const roomParam = searchParams.get('room');
    if (!roomParam) return;
    const target = rooms.find(r => String(r.id) === roomParam);
    if (target) {
      didAutoOpen.current = true;
      openRoom(target);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  // Poll for new messages + typers
  useEffect(() => {
    clearInterval(pollRef.current);
    if (!activeRoom) return;
    const poll = async () => {
      const token = localStorage.getItem('token');
      const since = messages.length > 0
        ? messages[messages.length - 1].created_at
        : '1970-01-01';
      try {
        const [msgRes, typersRes] = await Promise.all([
          fetch(`/api/chat/rooms/${activeRoom.id}/messages?since=${encodeURIComponent(since)}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`/api/chat/rooms/${activeRoom.id}/typing`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (msgRes.ok) {
          const data = await msgRes.json();
          if (data.messages?.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = data.messages.filter((m: Message) => !existingIds.has(m.id));
              if (newMsgs.length > 0) {
                const currentUserId = JSON.parse(localStorage.getItem('user') || '{}')?.id;
                const fromOthers = newMsgs.filter((m: Message) => m.sender_id !== currentUserId);
                if (fromOthers.length > 0) playNotificationSound('message');
                return [...prev, ...newMsgs];
              }
              return prev;
            });
          }
        }

        if (typersRes.ok) {
          const td = await typersRes.json();
          setTypers(td.typing || []);
        }
      } catch {}
    };
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, [activeRoom, messages]);

  const fetchRooms = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/chat/rooms', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch {}
  };

  const fetchStaff = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/auth/team', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setStaff(data.team || []);
    } catch {}
  };

  const openRoom = async (room: Room) => {
    setActiveRoom(room);
    setMessages([]);
    setCallRoomId('');
    setShowChatDuringCall(false);
    setReplyTo(null);
    setTypers([]);
    clearInterval(pollRef.current);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/messages/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {}
    setRooms(prev => prev.map(r => r.id === room.id ? { ...r, unread_count: 0 } : r));
  };

  const openDM = async (targetId: number) => {
    const token = localStorage.getItem('token');
    setShowNewChat(false);
    try {
      const res = await fetch('/api/chat/rooms/direct', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetId })
      });
      const data = await res.json();
      await fetchRooms();
      setTimeout(() => {
        setRooms(prev => {
          const room = prev.find(r => r.id === data.room_id);
          if (room) openRoom(room);
          return prev;
        });
      }, 300);
    } catch {}
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    const token = localStorage.getItem('token');
    setShowNewGroup(false);
    try {
      const res = await fetch('/api/chat/rooms/group', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName.trim(), member_ids: selectedMembers })
      });
      const data = await res.json();
      setGroupName('');
      setSelectedMembers([]);
      await fetchRooms();
      setTimeout(() => {
        setRooms(prev => {
          const room = prev.find(r => r.id === data.room_id);
          if (room) openRoom(room);
          return prev;
        });
      }, 300);
    } catch {}
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    clearTimeout(typingTimeout);
    if (val.trim() && activeRoom) {
      const token = localStorage.getItem('token');
      fetch(`/api/chat/rooms/${activeRoom.id}/typing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
      setTypingTimeout(setTimeout(() => {}, 3000));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeRoom || sending) return;
    setSending(true);
    const token = localStorage.getItem('token');
    const text = input.trim();
    setInput('');
    const replyId = replyTo?.id || null;
    setReplyTo(null);
    try {
      const res = await fetch(`/api/chat/rooms/${activeRoom.id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, reply_to_id: replyId })
      });
      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, { ...data.message, reactions: data.message.reactions || [] }]);
        setRooms(prev => prev.map(r => r.id === activeRoom.id
          ? { ...r, last_message: text, last_message_at: new Date().toISOString(), last_sender_id: user?.id }
          : r));
      }
    } catch {}
    setSending(false);
  };

  const reactToMessage = async (msgId: number, emoji: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/chat/messages/${msgId}/react`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      });
      const data = await res.json();
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: data.reactions || [] } : m));
    } catch {}
  };

  const deleteMessage = async (msgId: number) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`/api/chat/messages/${msgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted_at: new Date().toISOString() } : m));
    } catch {}
  };

  const sendFile = async (file: File) => {
    if (!activeRoom) return;
    setUploading(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    if (replyTo) formData.append('reply_to_id', String(replyTo.id));
    try {
      const res = await fetch(`/api/chat/rooms/${activeRoom.id}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, { ...data.message, reactions: data.message.reactions || [] }]);
        setReplyTo(null);
        setPendingFile(null);
      }
    } catch {}
    setUploading(false);
  };

  const startVideoCall = (roomId?: string) => {
    const id = roomId || `astraterra-${Date.now()}`;
    setIsAudioCall(false);
    setVideoRoomId(id);
    setCallRoomId(id);
    setShowChatDuringCall(false);
    if (activeRoom && !roomId) {
      const token = localStorage.getItem('token');
      fetch(`/api/chat/rooms/${activeRoom.id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `📹 Video call started: https://meet.jit.si/${id}`, message_type: 'video_call' })
      });
    }
  };

  const startAudioCall = (roomId?: string) => {
    const id = roomId || `astraterra-audio-${Date.now()}`;
    setIsAudioCall(true);
    setVideoRoomId(id);
    setCallRoomId(id);
    setShowChatDuringCall(false);
    if (activeRoom && !roomId) {
      const token = localStorage.getItem('token');
      fetch(`/api/chat/rooms/${activeRoom.id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `📞 Voice call started: https://meet.jit.si/${id}`, message_type: 'audio_call' })
      });
    }
  };

  const endCall = () => { setCallRoomId(''); setShowChatDuringCall(false); setIsAudioCall(false); };

  const filteredStaff = staff.filter(s =>
    s.id !== user?.id &&
    (s.name?.toLowerCase().includes(staffSearch.toLowerCase()) || s.email?.toLowerCase().includes(staffSearch.toLowerCase()))
  );

  const filteredRooms = rooms.filter(r =>
    (r.display_name || r.name || '')?.toLowerCase().includes(roomSearch.toLowerCase())
  );

  const totalUnread = rooms.reduce((sum, r) => sum + (r.unread_count || 0), 0);

  return (
    <div className="h-screen flex" style={{ background: '#0f1623' }}>
      {/* Sidebar */}
      <div className="w-72 flex flex-col border-r flex-shrink-0" style={{ background: '#131B2B', borderColor: 'rgba(255,255,255,0.07)' }}>
        {/* Header */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" style={{ color: '#C9A96E' }} />
              <h2 className="text-base font-bold text-white">Team Chat</h2>
              {totalUnread > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#DC2626', color: 'white' }}>{totalUnread}</span>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setShowNewGroup(true); setShowNewChat(false); }}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="New Group">
                <Users className="w-4 h-4" style={{ color: '#C9A96E' }} />
              </button>
              <button onClick={() => { setShowNewChat(true); setShowNewGroup(false); }}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="New Chat">
                <Plus className="w-4 h-4" style={{ color: '#C9A96E' }} />
              </button>
            </div>
          </div>
          {/* Sidebar search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
            <input
              value={roomSearch}
              onChange={e => setRoomSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-2 rounded-lg text-xs focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>
        </div>

        {/* Rooms list */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 && (
            <div className="p-6 text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-white" />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>No conversations yet</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Click + to start chatting</p>
            </div>
          )}
          {filteredRooms.map(room => (
            <div key={room.id} onClick={() => openRoom(room)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all"
              style={{
                background: activeRoom?.id === room.id ? 'rgba(201,169,110,0.1)' : 'transparent',
                borderLeft: activeRoom?.id === room.id ? '3px solid #C9A96E' : '3px solid transparent'
              }}>
              <div className="relative">
                {room.type === 'direct' && room.other_user
                  ? <Avatar name={room.other_user.name} url={room.other_user.avatar_url} size={38} />
                  : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(201,169,110,0.15)' }}>
                      <Hash className="w-4 h-4" style={{ color: '#C9A96E' }} />
                    </div>
                  )
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white truncate">{room.display_name || room.name || 'Chat'}</span>
                  <span className="text-xs ml-1 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>{timeAgo(room.last_message_at)}</span>
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {room.last_message
                    ? (room.last_sender_id === user?.id
                      ? `You: ${room.last_message}`
                      : room.last_sender
                        ? `${room.last_sender.split(' ')[0]}: ${room.last_message}`
                        : room.last_message)
                    : 'No messages yet'}
                </p>
              </div>
              {(room.unread_count || 0) > 0 && (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#C9A96E', color: '#0a1628' }}>
                  {room.unread_count}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Current user */}
        <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <Avatar name={user?.name || 'Me'} url={user?.avatar_url} size={30} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.name}</p>
            <div className="flex items-center gap-1">
              <Circle className="w-2 h-2 fill-green-400" style={{ color: '#4ade80' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeRoom ? (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b flex items-center justify-between flex-shrink-0" style={{ background: '#131B2B', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-3">
                {activeRoom.type === 'direct' && activeRoom.other_user
                  ? <Avatar name={activeRoom.other_user.name} url={activeRoom.other_user.avatar_url} size={36} />
                  : <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.15)' }}><Hash className="w-4 h-4" style={{ color: '#C9A96E' }} /></div>
                }
                <div>
                  <h3 className="text-sm font-semibold text-white">{activeRoom.display_name || activeRoom.name}</h3>
                  {activeRoom.type === 'direct' && activeRoom.other_user && (
                    <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.4)' }}>{activeRoom.other_user.role}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {callRoomId ? (
                  <>
                    <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                      <button onClick={() => setShowChatDuringCall(false)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-all"
                        style={{ background: !showChatDuringCall ? 'rgba(74,222,128,0.2)' : 'transparent', color: '#4ade80' }}>
                        {isAudioCall ? <Phone className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                        {isAudioCall ? 'Voice' : 'Video'}
                      </button>
                      <button onClick={() => setShowChatDuringCall(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-all"
                        style={{ background: showChatDuringCall ? 'rgba(201,169,110,0.2)' : 'transparent', color: '#C9A96E' }}>
                        <MessageSquare className="w-3.5 h-3.5" />Chat
                      </button>
                    </div>
                    <button onClick={endCall}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <PhoneOff className="w-3.5 h-3.5" />End Call
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => startAudioCall()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                      style={{ background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)', color: '#C9A96E' }}
                      title="Voice Call">
                      <Phone className="w-3.5 h-3.5" />Voice
                    </button>
                    <button onClick={() => startVideoCall()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                      style={{ background: 'linear-gradient(135deg,#1a7a4a,#145c38)', color: '#4ade80' }}
                      title="Video Call">
                      <Video className="w-3.5 h-3.5" />Video
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Inline Jitsi */}
            {callRoomId && (
              <div style={{ flex: showChatDuringCall ? '0 0 0px' : '1 1 0', display: showChatDuringCall ? 'none' : 'flex', flexDirection: 'column', minHeight: 0 }}>
                <JitsiEmbed roomId={callRoomId} displayName={user?.name || 'Agent'} onClose={endCall} audioOnly={isAudioCall} />
              </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-5 py-4"
              style={{ display: callRoomId && !showChatDuringCall ? 'none' : undefined }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-50">
                  <MessageSquare className="w-10 h-10 text-white mb-2" />
                  <p className="text-sm text-white">No messages yet — say hello! 👋</p>
                </div>
              )}

              {messages.map((msg, i) => {
                const isMe = msg.sender_id === user?.id;
                const isVideoCall = msg.message_type === 'video_call';
                const isAudioCallMsg = msg.message_type === 'audio_call';
                const isCallMsg = isVideoCall || isAudioCallMsg;
                const showAvatar = !isMe && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);
                const showName = !isMe && showAvatar;
                const callRoomMatch = isCallMsg ? msg.message.match(/astraterra-[\w-]+/) : null;

                // Date separator
                const prevMsg = i > 0 ? messages[i - 1] : null;
                const dateChanged = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

                if (isCallMsg) {
                  return (
                    <div key={msg.id}>
                      {dateChanged && (
                        <div className="flex items-center justify-center my-3">
                          <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                            {getDateLabel(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-center mb-3">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs"
                          style={isAudioCallMsg
                            ? { background: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }
                            : { background: 'rgba(26,122,74,0.2)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                          {isAudioCallMsg ? <Phone className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                          <span>{msg.sender_name} started a {isAudioCallMsg ? 'voice' : 'video'} call</span>
                          <button
                            onClick={() => isAudioCallMsg ? startAudioCall(callRoomMatch?.[0]) : startVideoCall(callRoomMatch?.[0])}
                            className="px-2 py-0.5 rounded font-semibold"
                            style={isAudioCallMsg ? { background: '#C9A96E', color: '#0a1628' } : { background: '#4ade80', color: '#0a1628' }}>
                            Join
                          </button>
                          <span style={{ color: 'rgba(255,255,255,0.35)' }}>{formatTime(msg.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id}>
                    {dateChanged && (
                      <div className="flex items-center justify-center my-3">
                        <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                          {getDateLabel(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex gap-2.5 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}
                      onMouseEnter={() => setHoveredMsg(msg.id)}
                      onMouseLeave={() => setHoveredMsg(null)}
                    >
                      {!isMe && (
                        <div style={{ width: 32, height: 32, flexShrink: 0, visibility: showAvatar ? 'visible' : 'hidden' }}>
                          <Avatar name={msg.sender_name} url={msg.sender_avatar} size={32} />
                        </div>
                      )}

                      <div className={`relative max-w-xs lg:max-w-md xl:max-w-lg flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {showName && <p className="text-xs mb-1 px-1 font-medium" style={{ color: '#C9A96E' }}>{msg.sender_name}</p>}

                        {/* Hover toolbar */}
                        {hoveredMsg === msg.id && !msg.deleted_at && (
                          <div
                            className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} top-0 flex items-center gap-0.5 px-1.5 py-1 rounded-xl shadow-lg z-20`}
                            style={{ background: '#1e2d45', border: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
                            {['👍','❤️','😂','😮','😢','🎉'].map(e => (
                              <button key={e} onClick={() => reactToMessage(msg.id, e)}
                                className="text-sm w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
                                {e}
                              </button>
                            ))}
                            <div className="w-px h-5 mx-0.5" style={{ background: 'rgba(255,255,255,0.1)' }} />
                            <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                              title="Reply">
                              <Reply className="w-3.5 h-3.5 text-white/60" />
                            </button>
                            {(msg.sender_id === user?.id || ['admin','owner'].includes(user?.role)) && (
                              <button onClick={() => deleteMessage(msg.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-colors"
                                title="Delete">
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Message bubble */}
                        {msg.deleted_at ? (
                          <div className="px-3.5 py-2 rounded-2xl text-sm italic"
                            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}>
                            🚫 This message was deleted
                          </div>
                        ) : (
                          <div className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                            style={{
                              background: isMe ? 'linear-gradient(135deg,#C9A96E,#a8845a)' : 'rgba(255,255,255,0.08)',
                              color: isMe ? '#0a1628' : '#E5E7EB',
                              borderBottomRightRadius: isMe ? 4 : 16,
                              borderBottomLeftRadius: isMe ? 16 : 4,
                            }}>
                            {/* Reply quote */}
                            {msg.reply_to_message && (
                              <div className="mb-1.5 pl-2 border-l-2 rounded"
                                style={{
                                  borderColor: isMe ? 'rgba(10,22,40,0.4)' : '#C9A96E',
                                  background: isMe ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.05)',
                                  padding: '4px 8px',
                                  borderRadius: 6
                                }}>
                                <p className="text-xs font-semibold truncate" style={{ color: isMe ? 'rgba(10,22,40,0.8)' : '#C9A96E' }}>
                                  {msg.reply_to_sender_name}
                                </p>
                                <p className="text-xs truncate opacity-70">{msg.reply_to_message}</p>
                              </div>
                            )}

                            {/* Image */}
                            {msg.message_type === 'image' && msg.file_url && (
                              <img src={msg.file_url} alt={msg.file_name || 'image'}
                                className="rounded-xl max-w-xs max-h-64 object-cover cursor-pointer mt-1 block"
                                onClick={() => window.open(msg.file_url, '_blank')} />
                            )}

                            {/* File */}
                            {msg.message_type === 'file' && msg.file_url && (
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 mt-1 p-2 rounded-lg"
                                style={{ background: 'rgba(255,255,255,0.1)' }}>
                                <FileText className="w-4 h-4 flex-shrink-0" />
                                <span className="text-xs truncate max-w-40">{msg.file_name}</span>
                                <Download className="w-3.5 h-3.5 ml-auto opacity-60 flex-shrink-0" />
                              </a>
                            )}

                            {/* Text */}
                            {(msg.message_type === 'text' || (!msg.file_url && msg.message_type !== 'image' && msg.message_type !== 'file')) && (
                              <span>{msg.message}</span>
                            )}
                            {msg.message_type === 'image' && msg.message && msg.message !== msg.file_name && (
                              <p className="text-xs mt-1 opacity-70">{msg.message}</p>
                            )}
                          </div>
                        )}

                        {/* Reactions */}
                        {!msg.deleted_at && groupedReactions(msg.reactions, user?.id).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {groupedReactions(msg.reactions, user?.id).map(({ emoji, count, users, iMine }) => (
                              <button key={emoji} onClick={() => reactToMessage(msg.id, emoji)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all"
                                style={{
                                  background: iMine ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.07)',
                                  border: iMine ? '1px solid rgba(201,169,110,0.4)' : '1px solid rgba(255,255,255,0.1)',
                                  color: 'white'
                                }}
                                title={users.join(', ')}>
                                {emoji} {count > 1 ? count : ''}
                              </button>
                            ))}
                          </div>
                        )}

                        <p className="text-xs mt-1 px-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {typers.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 mt-1">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#C9A96E', animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#C9A96E', animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#C9A96E', animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {typers.join(', ')} {typers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="flex-shrink-0" style={{ background: '#131B2B', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              {/* Pending file preview */}
              {pendingFile && (
                <div className="px-4 py-2 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#0f1e35' }}>
                  <div className="flex-1 flex items-center gap-2">
                    {pendingFile.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(pendingFile)} alt="preview" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <FileText className="w-5 h-5" style={{ color: '#C9A96E' }} />
                    )}
                    <span className="text-xs text-white truncate">{pendingFile.name}</span>
                  </div>
                  <button onClick={() => setPendingFile(null)}>
                    <X className="w-4 h-4 text-white/40 hover:text-white/70" />
                  </button>
                </div>
              )}

              {/* Reply preview */}
              {replyTo && (
                <div className="px-4 py-2 border-t flex items-center gap-3" style={{ background: '#0f1e35', borderColor: 'rgba(201,169,110,0.2)' }}>
                  <div className="flex-1 pl-3 border-l-2" style={{ borderColor: '#C9A96E' }}>
                    <p className="text-xs font-semibold" style={{ color: '#C9A96E' }}>{replyTo.sender_name}</p>
                    <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {replyTo.message_type === 'image' ? '📷 Image' : replyTo.message_type === 'file' ? `📎 ${replyTo.file_name}` : replyTo.message}
                    </p>
                  </div>
                  <button onClick={() => setReplyTo(null)}>
                    <X className="w-4 h-4 text-white/40 hover:text-white/70" />
                  </button>
                </div>
              )}

              {/* Emoji picker */}
              {showEmojiPicker && (
                <div ref={emojiPickerRef} className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#0d1829' }}>
                  <div className="grid grid-cols-10 gap-1">
                    {COMMON_EMOJIS.map(e => (
                      <button key={e} onClick={() => { setInput(prev => prev + e); setShowEmojiPicker(false); inputRef.current?.focus(); }}
                        className="text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input row */}
              <div className="px-4 py-3 flex items-center gap-2">
                {/* File attachment */}
                <button onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"
                  title="Attach file">
                  <Paperclip className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>
                <input ref={fileInputRef} type="file" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) setPendingFile(e.target.files[0]); e.target.value = ''; }} />

                {/* Text input */}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (pendingFile) sendFile(pendingFile);
                      else sendMessage();
                    }
                  }}
                  placeholder={pendingFile ? 'Add a caption...' : 'Type a message...'}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)' }}
                />

                {/* Emoji toggle */}
                <button onClick={() => setShowEmojiPicker(p => !p)}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"
                  title="Emoji">
                  <Smile className="w-4 h-4" style={{ color: showEmojiPicker ? '#C9A96E' : 'rgba(255,255,255,0.4)' }} />
                </button>

                {/* Send */}
                <button
                  onClick={() => { if (pendingFile) sendFile(pendingFile); else sendMessage(); }}
                  disabled={(!input.trim() && !pendingFile) || sending || uploading}
                  className="p-2.5 rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
                  style={{ background: (input.trim() || pendingFile) ? '#C9A96E' : 'rgba(255,255,255,0.1)' }}>
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-current rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
                  ) : (
                    <Send className="w-4 h-4" style={{ color: (input.trim() || pendingFile) ? '#0a1628' : 'rgba(255,255,255,0.4)' }} />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <MessageSquare className="w-14 h-14 mb-4 opacity-30" />
            <h3 className="text-lg font-semibold text-white mb-2">Welcome to Team Chat</h3>
            <p className="text-sm text-center max-w-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Select a conversation or start a new one. You can also video call any team member directly from here.
            </p>
            <button onClick={() => setShowNewChat(true)}
              className="mt-5 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: '#C9A96E', color: '#0a1628' }}>
              + Start a Chat
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#131B2B', border: '1px solid rgba(201,169,110,0.3)' }}>
            <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <h3 className="text-base font-bold text-white">New Direct Message</h3>
              <button onClick={() => setShowNewChat(false)}><X className="w-5 h-5 text-white/50 hover:text-white" /></button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-2.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <input value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)' }}
                  placeholder="Search team..." />
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {filteredStaff.map(s => (
                  <div key={s.id} onClick={() => openDM(s.id)}
                    className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                    <Avatar name={s.name} url={s.avatar_url} size={36} />
                    <div>
                      <p className="text-sm font-medium text-white">{s.name}</p>
                      <p className="text-xs capitalize" style={{ color: ROLE_COLOR[s.role] || '#9CA3AF' }}>{s.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#131B2B', border: '1px solid rgba(201,169,110,0.3)' }}>
            <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <h3 className="text-base font-bold text-white">New Group Chat</h3>
              <button onClick={() => setShowNewGroup(false)}><X className="w-5 h-5 text-white/50 hover:text-white" /></button>
            </div>
            <div className="p-4 space-y-3">
              <input value={groupName} onChange={e => setGroupName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', color: '#E5E7EB', border: '1px solid rgba(255,255,255,0.1)' }}
                placeholder="Group name (e.g. Sales Team)" />
              <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Add members:</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {staff.filter(s => s.id !== user?.id).map(s => (
                  <div key={s.id}
                    onClick={() => setSelectedMembers(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                    className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors"
                    style={{ background: selectedMembers.includes(s.id) ? 'rgba(201,169,110,0.15)' : 'transparent' }}>
                    <Avatar name={s.name} url={s.avatar_url} size={32} />
                    <p className="text-sm text-white flex-1">{s.name}</p>
                    {selectedMembers.includes(s.id) && (
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs" style={{ background: '#C9A96E', color: '#0a1628' }}>✓</div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={createGroup} disabled={!groupName.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ background: '#C9A96E', color: '#0a1628' }}>
                Create Group ({selectedMembers.length} members)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-white">Loading Chat...</div>}>
      <ChatPageInner />
    </Suspense>
  );
}
