'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { playNotificationSound } from '@/lib/notification-sound';
import DashboardCharts from '@/components/DashboardCharts';
import RecentActivity from '@/components/RecentActivity';
import QuickActions from '@/components/QuickActions';
import {
  Users, Building2, TrendingUp, CheckSquare,
  Bell, Search, ArrowUpRight, RefreshCw, Star, X,
  Mail, Share2, Send, Plus, Eye, MousePointerClick, Calendar,
  Target, Clock, AlertCircle, Percent,
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    total_leads: 0,
    active_leads: 0,
    new_leads_week: 0,
    total_contacts: 0,
    new_contacts_month: 0,
    total_properties: 0,
    available_properties: 0,
    total_deals: 0,
    active_deals: 0,
    total_revenue: 0,
    revenue_this_month: 0,
    tasks_due_today: 0,
    tasks_overdue: 0,
    viewings_today: 0,
    viewings_upcoming: 0,
    conversion_rate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<Record<string,number>>({});
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; icon: string; text: string; sub: string; color: string }>>([]);
  const [dbNotifications, setDbNotifications] = useState<Array<{ id: number; type: string; icon: string; title: string; body: string; link: string; is_read: number; created_at: string }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [emailStats, setEmailStats] = useState<any>(null);
  const [socialPosts, setSocialPosts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '', rera_number: '', specialty: 'secondary', transactions_count: '0', about: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  // Track previous unread count to detect new notifications and play sound
  const prevUnreadRef = useRef<number>(-1);
  const notifPollRef = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    setProfileForm({ name: parsedUser.name || '', phone: parsedUser.phone || '', email: parsedUser.email || '', rera_number: parsedUser.rera_number || '', specialty: parsedUser.specialty || 'secondary', transactions_count: String(parsedUser.transactions_count ?? 0), about: parsedUser.about || '' });
    setProfileAvatarUrl(parsedUser.avatar_url || '');
    fetchStats();
    fetchDbNotifications(token);
    // Fetch marketing widgets
    fetch('/api/email/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setEmailStats(d.stats)).catch(() => {});
    fetch('/api/social/upcoming', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setSocialPosts(d.posts || [])).catch(() => {});

    // Poll for new notifications every 30s — plays sound when new ones arrive
    notifPollRef.current = setInterval(() => {
      fetchDbNotifications();
    }, 30000);
    return () => clearInterval(notifPollRef.current);
  }, []);

  const fetchDbNotifications = async (token?: string | null) => {
    const t = token || localStorage.getItem('token');
    try {
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const data = await res.json();
        const newCount = data.unread_count || 0;
        // Play sound if unread count increased (new notification arrived)
        if (prevUnreadRef.current >= 0 && newCount > prevUnreadRef.current) {
          playNotificationSound('alert');
        }
        prevUnreadRef.current = newCount;
        setDbNotifications(data.notifications || []);
        setUnreadCount(newCount);
      }
    } catch {}
  };

  const markAllRead = async () => {
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      setDbNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch {}
  };

  const fetchStats = async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const newStats = {
          total_leads: data.leads?.total_leads || 0,
          active_leads: data.leads?.hot_leads || 0,
          new_leads_week: data.leads?.new_this_week || 0,
          total_contacts: data.contacts?.total_contacts || 0,
          new_contacts_month: data.contacts?.new_this_month || 0,
          total_properties: data.properties?.total_properties || 0,
          available_properties: data.properties?.available || 0,
          total_deals: data.deals?.total_deals || 0,
          active_deals: data.deals?.active_deals || 0,
          total_revenue: data.deals?.total_revenue || 0,
          revenue_this_month: data.deals?.revenue_this_month || 0,
          tasks_due_today: data.tasks?.due_today || 0,
          tasks_overdue: data.tasks?.overdue || 0,
          viewings_today: data.viewings?.today || 0,
          viewings_upcoming: data.viewings?.upcoming || 0,
          conversion_rate: parseFloat(data.conversion?.conversion_rate || '0'),
        };

        // Build notification items from live data
        const notifs: Array<{ id: string; icon: string; text: string; sub: string; color: string }> = [];
        if (newStats.tasks_overdue > 0) notifs.push({ id: 'overdue', icon: '🔴', text: `${newStats.tasks_overdue} overdue task${newStats.tasks_overdue > 1 ? 's' : ''}`, sub: 'Needs immediate attention', color: '#EF4444' });
        if (newStats.tasks_due_today > 0) notifs.push({ id: 'today', icon: '🟡', text: `${newStats.tasks_due_today} task${newStats.tasks_due_today > 1 ? 's' : ''} due today`, sub: 'Check your task list', color: '#F59E0B' });
        if (newStats.viewings_today > 0) notifs.push({ id: 'viewings', icon: '🏠', text: `${newStats.viewings_today} viewing${newStats.viewings_today > 1 ? 's' : ''} today`, sub: 'Scheduled property viewings', color: '#8B5CF6' });
        if (newStats.active_leads > 0) notifs.push({ id: 'leads', icon: '🔥', text: `${newStats.active_leads} hot lead${newStats.active_leads > 1 ? 's' : ''} active`, sub: 'Follow up now', color: '#EF4444' });
        if (newStats.new_leads_week > 0) notifs.push({ id: 'newleads', icon: '📥', text: `${newStats.new_leads_week} new lead${newStats.new_leads_week > 1 ? 's' : ''} this week`, sub: 'Added to your pipeline', color: '#3B82F6' });
        if (newStats.new_contacts_month > 0) notifs.push({ id: 'contacts', icon: '👥', text: `${newStats.new_contacts_month} new contacts this month`, sub: 'Imported or added manually', color: '#10B981' });
        if (notifs.length === 0) notifs.push({ id: 'ok', icon: '✅', text: 'All caught up!', sub: 'No pending items', color: '#10B981' });
        setNotifications(notifs);

        setStats(newStats);
      }
      // Fetch pipeline stage breakdown
      try {
        const token = localStorage.getItem('token');
        const lr = await fetch('/api/leads?view=kanban', { headers: { Authorization: `Bearer ${token}` } });
        if (lr.ok) {
          const ld = await lr.json();
          const kanban: Record<string, any[]> = ld.kanban || {};
          const stageCounts: Record<string, number> = {};
          Object.entries(kanban).forEach(([stage, leads]) => { stageCounts[stage] = (leads as any[]).length; });
          setPipelineStages(stageCounts);
        }
      } catch {}
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `AED ${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `AED ${(amount / 1000).toFixed(0)}K`;
    return `AED ${amount.toLocaleString()}`;
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const userName = user?.name?.split(' ')[0] || 'Joseph';
  const initials = (user?.name || 'JT').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  const statCards = [
    {
      label: 'Total Leads',
      value: stats.total_leads,
      sub: `+${stats.new_leads_week} this week`,
      icon: Users,
      color: '#3B82F6',
      bg: '#EFF6FF',
      path: '/leads',
      badge: stats.active_leads > 0 ? `${stats.active_leads} hot` : null,
      badgeColor: '#EF4444',
    },
    {
      label: 'Active Properties',
      value: stats.total_properties,
      sub: `${stats.available_properties} available`,
      icon: Building2,
      color: '#8A6F2F',
      bg: '#FEF3C7',
      path: '/properties',
      badge: null,
      badgeColor: null,
    },
    {
      label: 'Revenue (Total)',
      value: formatCurrency(stats.total_revenue),
      sub: `${formatCurrency(stats.revenue_this_month)} this month`,
      icon: TrendingUp,
      color: '#10B981',
      bg: '#ECFDF5',
      path: '/deals',
      badge: `${stats.active_deals} active`,
      badgeColor: '#10B981',
    },
    {
      label: 'Contacts',
      value: stats.total_contacts.toLocaleString(),
      sub: `+${stats.new_contacts_month} this month`,
      icon: Users,
      color: '#8B5CF6',
      bg: '#F5F3FF',
      path: '/contacts',
      badge: null,
      badgeColor: null,
    },
    {
      label: 'Tasks Due Today',
      value: stats.tasks_due_today,
      sub: stats.tasks_overdue > 0 ? `⚠️ ${stats.tasks_overdue} overdue` : 'all on track',
      icon: CheckSquare,
      color: stats.tasks_overdue > 0 ? '#EF4444' : '#C9A96E',
      bg: stats.tasks_overdue > 0 ? '#FEF2F2' : '#FFFBEB',
      path: '/tasks',
      badge: null,
      badgeColor: null,
    },
    {
      label: "Today's Viewings",
      value: stats.viewings_today,
      sub: `${stats.viewings_upcoming} upcoming total`,
      icon: Eye,
      color: '#F97316',
      bg: '#FFF7ED',
      path: '/viewings',
      badge: null,
      badgeColor: null,
    },
    {
      label: 'Conversion Rate',
      value: `${stats.conversion_rate || 0}%`,
      sub: 'leads → deals (90d)',
      icon: Percent,
      color: '#14B8A6',
      bg: '#F0FDFA',
      path: '/reports',
      badge: null,
      badgeColor: null,
    },
    {
      label: 'Active Deals',
      value: stats.active_deals,
      sub: `${stats.total_deals} total`,
      icon: Target,
      color: '#EC4899',
      bg: '#FDF2F8',
      path: '/deals',
      badge: null,
      badgeColor: null,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F4F6F9' }}>
        <div className="text-center">
          <div
            className="inline-block h-10 w-10 animate-spin rounded-full border-4 mb-3"
            style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: '#6B7280' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F4F6F9' }}>

      {/* Top Header */}
      <header className="bg-white border-b sticky top-0 z-10" style={{ borderColor: '#E5E7EB' }}>
        <div className="px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Left: title */}
          <div className="hidden md:block">
            <h1 className="text-lg font-bold" style={{ color: '#131B2B' }}>Dashboard</h1>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>{today}</p>
          </div>

          {/* Center: search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
              <input
                type="text"
                placeholder="Search leads, properties, deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) router.push(`/leads?search=${encodeURIComponent(searchQuery.trim())}`); }}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border focus:outline-none"
                style={{ borderColor: '#E5E7EB', background: '#F9FAFB', color: '#374151' }}
                onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.background = 'white'; }}
                onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.background = '#F9FAFB'; }}
              />
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-3">
            {/* Refresh button */}
            <button
              onClick={() => { fetchStats(); }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh dashboard"
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                style={{ color: isRefreshing ? '#C9A96E' : '#6B7280' }}
              />
            </button>

            {/* Bell / Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(v => !v); fetchDbNotifications(); }}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Notifications"
              >
                <Bell style={{ width: '18px', height: '18px', color: showNotifications ? '#C9A96E' : '#6B7280' }} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold px-0.5"
                    style={{ background: '#EF4444' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  className="absolute right-0 mt-2 w-80 rounded-xl shadow-2xl border z-50 overflow-hidden"
                  style={{ background: '#fff', borderColor: '#E5E7EB', top: '100%' }}
                >
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: '#F3F4F6' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: '#131B2B' }}>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#EF4444' }}>{unreadCount}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs hover:underline" style={{ color: '#C9A96E' }}>Mark all read</button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50" style={{ maxHeight: 380, overflowY: 'auto' }}>
                    {/* DB notifications (real-time leads, events) */}
                    {dbNotifications.length > 0 && dbNotifications.slice(0, 15).map(n => (
                      <div key={n.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        style={{ background: n.is_read ? 'transparent' : '#FFFBF2' }}
                        onClick={() => {
                          if (!n.is_read) {
                            const token = localStorage.getItem('token');
                            fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
                              .then(() => { setDbNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x)); setUnreadCount(prev => Math.max(0, prev - 1)); });
                          }
                          setShowNotifications(false);
                          if (n.link) { router.push(n.link); }
                        }}>
                        <div className="flex-shrink-0 mt-0.5">
                          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full inline-block mr-1" style={{ background: '#C9A96E', verticalAlign: 'middle' }} />}
                          <span className="text-base">{n.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#131B2B' }}>{n.title}</p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#9CA3AF' }}>{n.body}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#D1D5DB' }}>
                            {new Date(n.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {/* Stat-based notifications (tasks, viewings) */}
                    {notifications.filter(n => n.id !== 'ok').map(n => {
                      const statRoutes: Record<string, string> = {
                        overdue: '/tasks', today: '/tasks',
                        viewings: '/viewings',
                        leads: '/leads', newleads: '/leads',
                        contacts: '/contacts',
                      };
                      const dest = statRoutes[n.id] || '/dashboard';
                      return (
                        <div key={n.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => { setShowNotifications(false); router.push(dest); }}
                        >
                          <span className="text-lg mt-0.5 flex-shrink-0">{n.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: '#131B2B' }}>{n.text}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{n.sub}</p>
                            <p className="text-xs mt-0.5 font-medium" style={{ color: '#C9A96E' }}>Tap to view →</p>
                          </div>
                        </div>
                      );
                    })}
                    {dbNotifications.length === 0 && notifications.every(n => n.id === 'ok') && (
                      <div className="flex items-center gap-3 px-4 py-5">
                        <span className="text-lg">✅</span>
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#131B2B' }}>All caught up!</p>
                          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>No new notifications</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-2.5 border-t flex items-center justify-between" style={{ borderColor: '#F3F4F6' }}>
                    <button
                      onClick={() => { setShowNotifications(false); fetchStats(); fetchDbNotifications(); }}
                      className="text-xs font-medium hover:underline flex items-center gap-1"
                      style={{ color: '#C9A96E' }}
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                    <span className="text-xs" style={{ color: '#D1D5DB' }}>{dbNotifications.length} total</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5 pl-2 border-l" style={{ borderColor: '#E5E7EB' }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 cursor-pointer overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}
                onClick={() => setShowProfileModal(true)}
                title="Edit profile"
              >
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} className="w-8 h-8 rounded-full object-cover" alt="avatar" />
                ) : (
                  initials
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{userName}</p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>{{ owner: 'Owner', admin: 'Admin', finance: 'Finance', agent: 'Agent' }[user?.role as string] || (user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Staff')}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 lg:px-6 lg:py-6 max-w-screen-2xl mx-auto">

        {/* Welcome Banner */}
        <div
          className="rounded-2xl p-6 mb-6 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #131B2B 0%, #1e2a3d 60%, #243050 100%)' }}
        >
          <div
            className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10 hidden md:block"
            style={{ fontSize: '80px' }}
          >
            🏙️
          </div>
          <div className="absolute top-0 right-0 w-64 h-full opacity-10 hidden md:block">
            <div className="w-full h-full" style={{ background: 'radial-gradient(circle at 80% 50%, #C9A96E, transparent)' }} />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 fill-current" style={{ color: '#C9A96E' }} />
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: '#C9A96E' }}>
                Astraterra Properties
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {greeting()}, {userName}!
            </h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Here's what's happening at Astra Terra Properties today.
            </p>

          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                onClick={() => router.push(card.path)}
                className="bg-white rounded-xl p-5 cursor-pointer border relative overflow-hidden group"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
                style={{
                  borderColor: '#E5E7EB',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s',
                  borderLeft: `4px solid ${card.color}`,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: card.bg }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {card.badge && (
                      <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full text-white"
                        style={{ background: card.badgeColor || card.color, fontSize: '10px' }}>
                        {card.badge}
                      </span>
                    )}
                    <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: card.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold mb-0.5" style={{ color: '#131B2B' }}>{card.value}</p>
                <p className="text-sm font-medium mb-1" style={{ color: '#374151' }}>{card.label}</p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>{card.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ color: '#131B2B' }}>Analytics Overview</h2>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }}>
              Last 6 months
            </span>
          </div>
          <DashboardCharts />
        </div>

        {/* Bottom Row: Recent Activity + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          <div className="lg:col-span-3">
            <RecentActivity />
          </div>
          <div className="lg:col-span-2">
            <QuickActions />
          </div>
        </div>

        {/* Marketing Widgets Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Email Marketing Widget */}
          <div className="rounded-xl p-6 border" style={{ background: '#131B2B', borderColor: 'rgba(201,169,110,0.25)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.15)' }}>
                  <Mail className="w-5 h-5" style={{ color: '#C9A96E' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Email Marketing</h3>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Brevo — 2,628+ contacts</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/email-marketing?tab=send')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                style={{ background: 'linear-gradient(135deg,#C9A96E,#8A6F2F)', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                <Send className="w-3 h-3" /> Send Campaign
              </button>
            </div>
            {emailStats ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Send className="w-4 h-4 mx-auto mb-1" style={{ color: '#C9A96E' }} />
                  <p className="font-bold text-white text-lg">{emailStats.totalSent?.toLocaleString() || 0}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Emails Sent</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <Eye className="w-4 h-4 mx-auto mb-1" style={{ color: '#60a5fa' }} />
                  <p className="font-bold text-white text-lg">{emailStats.openRate || 0}%</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Open Rate</p>
                </div>
                <div className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <MousePointerClick className="w-4 h-4 mx-auto mb-1" style={{ color: '#a78bfa' }} />
                  <p className="font-bold text-white text-lg">{emailStats.clickRate || 0}%</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Click Rate</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Loading email stats...
              </div>
            )}
            {emailStats?.lastCampaign && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Last: <span style={{ color: '#C9A96E' }}>{emailStats.lastCampaign}</span>
                  {emailStats.lastCampaignDate && ` · ${new Date(emailStats.lastCampaignDate).toLocaleDateString()}`}
                </p>
              </div>
            )}
          </div>

          {/* Social Media Widget */}
          <div className="rounded-xl p-6 border" style={{ background: '#131B2B', borderColor: 'rgba(201,169,110,0.25)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.15)' }}>
                  <Share2 className="w-5 h-5" style={{ color: '#C9A96E' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Social Media</h3>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Metricool scheduled posts</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/social-media?tab=create')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: 'linear-gradient(135deg,#C9A96E,#8A6F2F)', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                <Plus className="w-3 h-3" /> New Post
              </button>
            </div>
            {socialPosts.length > 0 ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Calendar className="w-4 h-4 mx-auto mb-1" style={{ color: '#C9A96E' }} />
                    <p className="font-bold text-white text-lg">
                      {socialPosts.filter(p => {
                        const d = new Date(p.scheduledAt);
                        const t = new Date();
                        return d.toDateString() === t.toDateString();
                      }).length}
                    </p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Today</p>
                  </div>
                  <div className="flex-1 text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Calendar className="w-4 h-4 mx-auto mb-1" style={{ color: '#60a5fa' }} />
                    <p className="font-bold text-white text-lg">
                      {socialPosts.filter(p => {
                        const d = new Date(p.scheduledAt);
                        const t = new Date();
                        t.setDate(t.getDate() + 1);
                        return d.toDateString() === t.toDateString();
                      }).length}
                    </p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Tomorrow</p>
                  </div>
                  <div className="flex-1 text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <Share2 className="w-4 h-4 mx-auto mb-1" style={{ color: '#a78bfa' }} />
                    <p className="font-bold text-white text-lg">{socialPosts.length}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>This Week</p>
                  </div>
                </div>
                {socialPosts.slice(0, 2).map((p: any, i) => {
                  const net = p.networks?.[0] || 'facebook';
                  const colors: Record<string, string> = { facebook: '#1877f2', instagram: '#e1306c', twitter: '#000', linkedin: '#0a66c2', tiktok: '#00f2ea' };
                  const emojis: Record<string, string> = { facebook: '📘', instagram: '📷', twitter: '🐦', linkedin: '💼', tiktok: '🎵' };
                  return (
                    <div key={i} className="flex items-start gap-2 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="text-sm flex-shrink-0">{emojis[net] || '📱'}</span>
                      <p className="text-xs text-white flex-1 leading-relaxed truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{p.content?.substring(0, 60)}...</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                <Share2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No upcoming scheduled posts
              </div>
            )}
          </div>
        </div>

        {/* Deals Overview */}
        {/* Pipeline Overview */}
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold" style={{ color: '#131B2B' }}>Pipeline Overview</h3>
            <button onClick={() => router.push('/pipeline')} className="text-xs font-medium flex items-center gap-1 transition-colors" style={{ color: '#C9A96E' }}>
              Open Pipeline <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {(() => {
            const STAGES = [
              { key: 'new_lead',    label: 'New Lead',     color: '#3B82F6' },
              { key: 'contacted',   label: 'Contacted',    color: '#F59E0B' },
              { key: 'qualified',   label: 'Qualified',    color: '#10B981' },
              { key: 'site_visit',  label: 'Site Visit',   color: '#8B5CF6' },
              { key: 'offer_made',  label: 'Offer Made',   color: '#F97316' },
              { key: 'negotiation', label: 'Negotiation',  color: '#EF4444' },
              { key: 'deal_closed', label: 'Deal Closed',  color: '#065F46' },
              { key: 'lost',        label: 'Lost',         color: '#9CA3AF' },
            ];
            const total = STAGES.reduce((s, st) => s + (pipelineStages[st.key] || 0), 0);
            return (
              <div className="space-y-2.5">
                {STAGES.map(st => {
                  const count = pipelineStages[st.key] || 0;
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={st.key} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-24 shrink-0" style={{ color: st.color }}>{st.label}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: '#F3F4F6' }}>
                        <div className="h-full rounded-full transition-all" style={{ background: st.color, width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold w-6 text-right" style={{ color: '#374151' }}>{count}</span>
                    </div>
                  );
                })}
                <p className="text-xs pt-1" style={{ color: '#9CA3AF' }}>{total} total active leads in pipeline</p>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="text-center text-xs pb-4" style={{ color: '#D1D5DB' }}>
          Astra Terra Properties · Oxford Tower, Office 502, Business Bay, Dubai
        </div>
      </div>

      {/* ── Profile Modal ── */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(201,169,110,0.2)' }}>
                  <span className="text-lg">👤</span>
                </div>
                <h2 className="text-lg font-bold text-white">My Profile</h2>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <span className="text-white text-lg">✕</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {/* Avatar Section */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 rounded-full overflow-hidden mb-3 flex items-center justify-center text-2xl font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}>
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} className="w-20 h-20 object-cover" alt="avatar" />
                  ) : (
                    (profileForm.name || user?.name || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                  )}
                </div>
                <label className="cursor-pointer px-4 py-2 text-sm font-medium rounded-lg transition-all"
                  style={{ background: 'rgba(201,169,110,0.12)', color: '#8A6F2F', border: '1px solid rgba(201,169,110,0.3)' }}>
                  📷 Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('upload_preset', 'ml_default');
                        formData.append('folder', 'crm-avatars');
                        const res = await fetch('https://api.cloudinary.com/v1_1/dumt7udjd/image/upload', {
                          method: 'POST',
                          body: formData,
                        });
                        const data = await res.json();
                        if (data.secure_url) {
                          setProfileAvatarUrl(data.secure_url);
                        }
                      } catch (err) {
                        console.error('Avatar upload failed', err);
                        alert('Photo upload failed. Please try again.');
                      }
                    }}
                  />
                </label>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Full Name</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
                    style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Phone</label>
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
                    style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
                    style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                {/* Divider */}
                <div className="border-t pt-4 mt-2" style={{ borderColor: '#F3F4F6' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: '#9CA3AF', letterSpacing: '0.05em' }}>PROFESSIONAL DETAILS</p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>RERA Broker Number</label>
                  <input
                    type="text"
                    value={profileForm.rera_number}
                    onChange={(e) => setProfileForm(p => ({ ...p, rera_number: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
                    style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                    placeholder="e.g. 54738"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Specialty</label>
                  <select
                    value={profileForm.specialty}
                    onChange={(e) => setProfileForm(p => ({ ...p, specialty: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
                    style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
                    onFocus={(e) => { (e.target as HTMLSelectElement).style.borderColor = '#C9A96E'; (e.target as HTMLSelectElement).style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                    onBlur={(e) => { (e.target as HTMLSelectElement).style.borderColor = '#E5E7EB'; (e.target as HTMLSelectElement).style.boxShadow = 'none'; }}
                  >
                    <option value="secondary">Secondary Market</option>
                    <option value="offplan">Off-Plan</option>
                    <option value="both">Both (Secondary & Off-Plan)</option>
                    <option value="rental">Rental</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Transactions Completed</label>
                  <input
                    type="number"
                    min="0"
                    value={profileForm.transactions_count}
                    onChange={(e) => setProfileForm(p => ({ ...p, transactions_count: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
                    style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white' }}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                    placeholder="0"
                  />
                  <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Total deals closed in your career</p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>About You</label>
                  <textarea
                    rows={3}
                    value={profileForm.about}
                    onChange={(e) => setProfileForm(p => ({ ...p, about: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none"
                    style={{ borderColor: '#E5E7EB', color: '#374151', background: 'white', resize: 'none' }}
                    onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.boxShadow = '0 0 0 3px rgba(201,169,110,0.12)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                    placeholder="Tell your team about your background, areas of expertise..."
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={async () => {
                    setProfileSaving(true);
                    try {
                      const token = localStorage.getItem('token');
                      const res = await fetch('/api/auth/profile', {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...profileForm, transactions_count: Number(profileForm.transactions_count) || 0, avatar_url: profileAvatarUrl }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const updatedUser = data.user || { ...user, ...profileForm, avatar_url: profileAvatarUrl };
                        // Update localStorage
                        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                        const newUser = { ...storedUser, ...updatedUser };
                        localStorage.setItem('user', JSON.stringify(newUser));
                        setUser(newUser);
                        setShowProfileModal(false);
                      } else {
                        const err = await res.json();
                        alert(err.error || 'Failed to save profile');
                      }
                    } catch (err) {
                      console.error(err);
                      alert('Failed to save profile');
                    } finally {
                      setProfileSaving(false);
                    }
                  }}
                  disabled={profileSaving}
                  className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}
                >
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                  style={{ background: '#F3F4F6', color: '#374151' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
