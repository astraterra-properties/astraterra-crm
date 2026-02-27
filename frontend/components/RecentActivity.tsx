'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface Activity {
  id: number;
  type: 'lead' | 'deal' | 'viewing' | 'task' | 'contact' | 'property';
  title: string;
  description: string;
  time: string;
  icon: string;
}

const typeConfig: Record<string, { dot: string; bg: string; text: string }> = {
  lead: { dot: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8' },
  deal: { dot: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  viewing: { dot: '#8B5CF6', bg: '#F5F3FF', text: '#5B21B6' },
  task: { dot: '#C9A96E', bg: '#FFFBEB', text: '#92400E' },
  contact: { dot: '#EC4899', bg: '#FDF2F8', text: '#9D174D' },
  property: { dot: '#8A6F2F', bg: '#FEF3C7', text: '#78350F' },
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const staticActivities: Activity[] = [
  { id: 1, type: 'deal', title: 'Deal Won', description: 'Palm Jumeirah villa closed — AED 8.2M', time: new Date(Date.now() - 1 * 3600000).toISOString(), icon: '🤝' },
  { id: 2, type: 'lead', title: 'New Lead Added', description: 'Ahmed Al-Rashidi — 3BR in Downtown Dubai', time: new Date(Date.now() - 2 * 3600000).toISOString(), icon: '👤' },
  { id: 3, type: 'viewing', title: 'Viewing Scheduled', description: 'Business Bay penthouse — Tomorrow 2:00 PM', time: new Date(Date.now() - 3 * 3600000).toISOString(), icon: '🏠' },
  { id: 4, type: 'task', title: 'Task Completed', description: 'Send NOC documents to Emaar for Marina project', time: new Date(Date.now() - 5 * 3600000).toISOString(), icon: '✅' },
  { id: 5, type: 'property', title: 'Property Listed', description: 'New listing: 2BR in JBR — AED 2.1M', time: new Date(Date.now() - 8 * 3600000).toISOString(), icon: '🏢' },
  { id: 6, type: 'contact', title: 'Contact Updated', description: 'Sarah Mitchell contact info refreshed', time: new Date(Date.now() - 12 * 3600000).toISOString(), icon: '👥' },
  { id: 7, type: 'lead', title: 'Lead Qualified', description: 'Mohammed Al-Farsi moved to Qualified stage', time: new Date(Date.now() - 24 * 3600000).toISOString(), icon: '📋' },
  { id: 8, type: 'deal', title: 'Proposal Sent', description: 'AED 5.5M Emaar deal proposal sent to client', time: new Date(Date.now() - 36 * 3600000).toISOString(), icon: '📄' },
  { id: 9, type: 'viewing', title: 'Viewing Completed', description: 'Damac Hills villa — Client interested, follow-up needed', time: new Date(Date.now() - 48 * 3600000).toISOString(), icon: '🔑' },
  { id: 10, type: 'task', title: 'New Task Created', description: 'Follow up with investors re: off-plan units', time: new Date(Date.now() - 60 * 3600000).toISOString(), icon: '📝' },
];

export default function RecentActivity() {
  const [activities] = useState<Activity[]>(staticActivities);

  return (
    <div
      className="bg-white rounded-xl border p-6 h-full"
      style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#131B2B' }}>Recent Activity</h3>
          <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Latest actions across all modules</p>
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(201,169,110,0.1)' }}
        >
          <span style={{ fontSize: '16px' }}>🕐</span>
        </div>
      </div>

      <div className="space-y-0">
        {activities.map((activity, index) => {
          const cfg = typeConfig[activity.type] || { dot: '#9CA3AF', bg: '#F9FAFB', text: '#6B7280' };
          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 py-3"
              style={{ borderBottom: index < activities.length - 1 ? '1px solid #F9FAFB' : 'none' }}
            >
              {/* Left dot + line */}
              <div className="flex flex-col items-center flex-shrink-0 mt-1">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: cfg.dot }}
                />
                {index < activities.length - 1 && (
                  <div className="w-px flex-1 mt-1.5" style={{ background: '#F3F4F6', minHeight: '20px' }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold" style={{ color: '#131B2B' }}>{activity.title}</p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        {activity.type}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#6B7280' }}>{activity.description}</p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: '#D1D5DB' }}>{timeAgo(activity.time)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t" style={{ borderColor: '#F3F4F6' }}>
        <button
          className="flex items-center gap-1 text-xs font-medium transition-colors"
          style={{ color: '#C9A96E' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#8A6F2F'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#C9A96E'; }}
        >
          View all activity <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
