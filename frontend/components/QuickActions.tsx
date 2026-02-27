'use client';

import { useRouter } from 'next/navigation';
import {
  Users, Building2, Handshake, Calendar, CheckSquare, Contact, MessageCircle, ArrowRight,
} from 'lucide-react';

interface QuickActionsProps {
  onNewLead?: () => void;
  onAddDeal?: () => void;
  onAddTask?: () => void;
  onScheduleViewing?: () => void;
}

export default function QuickActions({
  onNewLead,
  onAddDeal,
  onAddTask,
  onScheduleViewing,
}: QuickActionsProps) {
  const router = useRouter();

  const actions = [
    {
      label: 'New Lead',
      desc: 'Add a prospect',
      icon: Users,
      color: '#3B82F6',
      bg: '#EFF6FF',
      action: () => { if (onNewLead) onNewLead(); else router.push('/leads'); },
    },
    {
      label: 'Schedule Viewing',
      desc: 'Book property visit',
      icon: Calendar,
      color: '#8B5CF6',
      bg: '#F5F3FF',
      action: () => { if (onScheduleViewing) onScheduleViewing(); else router.push('/viewings'); },
    },
    {
      label: 'Add Task',
      desc: 'Create a task',
      icon: CheckSquare,
      color: '#C9A96E',
      bg: '#FFFBEB',
      action: () => { if (onAddTask) onAddTask(); else router.push('/tasks'); },
    },
    {
      label: 'Add Deal',
      desc: 'Start a new deal',
      icon: Handshake,
      color: '#10B981',
      bg: '#ECFDF5',
      action: () => { if (onAddDeal) onAddDeal(); else router.push('/deals'); },
    },
    {
      label: 'Add Property',
      desc: 'List a property',
      icon: Building2,
      color: '#8A6F2F',
      bg: '#FEF3C7',
      action: () => router.push('/properties'),
    },
    {
      label: 'Add Contact',
      desc: 'New client contact',
      icon: Contact,
      color: '#EC4899',
      bg: '#FDF2F8',
      action: () => router.push('/contacts'),
    },
  ];

  return (
    <div
      className="rounded-xl p-6 h-full"
      style={{ background: '#131B2B', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Common tasks at a glance</p>
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)' }}
        >
          <span style={{ fontSize: '14px' }}>⚡</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.action}
              className="flex flex-col items-center gap-2 p-3.5 rounded-xl text-center transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(201,169,110,0.12)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,169,110,0.35)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: action.bg }}
              >
                <Icon className="w-4.5 h-4.5" style={{ width: '18px', height: '18px', color: action.color }} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">{action.label}</p>
                <p className="text-xs hidden sm:block" style={{ color: 'rgba(255,255,255,0.4)' }}>{action.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* WhatsApp */}
      <a
        href="https://wa.me/971585580053"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3.5 rounded-xl transition-all group"
        style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(37,211,102,0.18)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(37,211,102,0.1)';
        }}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#25D366' }}>
          <MessageCircle className="w-4.5 h-4.5 text-white" style={{ width: '18px', height: '18px' }} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-white">WhatsApp Business</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>+971 58 558 0053</p>
        </div>
        <ArrowRight className="w-4 h-4 opacity-40 group-hover:opacity-80 transition-opacity" style={{ color: '#25D366' }} />
      </a>
    </div>
  );
}
