'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardCharts from '@/components/DashboardCharts';
import RecentActivity from '@/components/RecentActivity';
import QuickActions from '@/components/QuickActions';
import {
  Users, Building2, TrendingUp, CheckSquare,
  Bell, Search, ArrowUpRight, RefreshCw, Star,
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
  const [emailStats, setEmailStats] = useState<any>(null);
  const [socialPosts, setSocialPosts] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(userData));
    fetchStats();
    // Fetch marketing widgets
    fetch('/api/email/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setEmailStats(d.stats)).catch(() => {});
    fetch('/api/social/upcoming', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setSocialPosts(d.posts || [])).catch(() => {});
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats({
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
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
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
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border focus:outline-none"
                style={{ borderColor: '#E5E7EB', background: '#F9FAFB', color: '#374151' }}
                onFocus={(e) => { e.target.style.borderColor = '#C9A96E'; e.target.style.background = 'white'; }}
                onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.background = '#F9FAFB'; }}
              />
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={fetchStats}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" style={{ color: '#6B7280' }} />
            </button>
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-4.5 h-4.5" style={{ width: '18px', height: '18px', color: '#6B7280' }} />
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ background: '#C9A96E' }}
              />
            </button>
            <div className="flex items-center gap-2.5 pl-2 border-l" style={{ borderColor: '#E5E7EB' }}>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #131B2B, #1e2a3d)' }}
              >
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold" style={{ color: '#131B2B' }}>{userName}</p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>Admin</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 max-w-screen-2xl mx-auto">

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
            <div className="flex gap-4 mt-4">
              <a
                href="tel:+97145703846"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
              >
                📞 +971 4 570 3846
              </a>
              <a
                href="https://wa.me/971585580053"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(37,211,102,0.15)', color: '#4ADE80' }}
              >
                💬 WhatsApp Business
              </a>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
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
        <div className="bg-white rounded-xl border p-6 mb-6" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold" style={{ color: '#131B2B' }}>Deals Overview</h3>
            <button
              onClick={() => router.push('/deals')}
              className="text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: '#C9A96E' }}
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="text-center p-5 rounded-xl"
              style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
            >
              <p className="text-4xl font-bold mb-1" style={{ color: '#131B2B' }}>{stats.total_deals}</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>Total Deals</p>
            </div>
            <div
              className="text-center p-5 rounded-xl"
              style={{ background: '#ECFDF5', border: '1px solid #D1FAE5' }}
            >
              <p className="text-4xl font-bold mb-1" style={{ color: '#059669' }}>{stats.active_deals}</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>Active Deals</p>
            </div>
            <div
              className="text-center p-5 rounded-xl"
              style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.1), rgba(138,111,47,0.1))', border: '1px solid rgba(201,169,110,0.3)' }}
            >
              <p className="text-4xl font-bold mb-1" style={{ color: '#8A6F2F' }}>
                {Math.max(0, stats.total_deals - stats.active_deals)}
              </p>
              <p className="text-sm" style={{ color: '#6B7280' }}>Closed Deals</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs pb-4" style={{ color: '#D1D5DB' }}>
          Astra Terra Properties · Oxford Tower, Office 502, Business Bay, Dubai · 📞 +971 4 570 3846 · admin@astraterra.ae
        </div>
      </div>
    </div>
  );
}
