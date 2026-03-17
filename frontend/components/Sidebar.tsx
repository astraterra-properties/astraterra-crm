'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  Contact,
  Building2,
  Calendar,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  Search,
  X,
  Menu,
  ChevronRight,
  MessageCircle,
  MessageSquare,
  Video,
  MapPin,
  Home,
  Key,
  Globe,
  Building,
  KanbanSquare,
  Mail,
  Share2,
  Users2,
  UserCircle,
  Calculator,
  AlertCircle,
  FileText,
  FolderOpen,
  Eye,
  Download,
} from 'lucide-react';

interface SearchResult {
  id: number;
  type: string;
  title: string;
  subtitle: string;
  badge: string;
  url: string;
}

// Role levels matching backend
// owner(4) > admin(3) > finance(2) > agent(1)
const ROLE_LEVELS: Record<string, number> = { owner: 4, admin: 3, finance: 2, agent: 1 };

function hasMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[minRole] ?? 99);
}

// All menu groups — minRole controls visibility per role
const allMenuGroups = [
  {
    label: 'Main',
    minRole: 'agent',
    items: [
      { name: 'Dashboard',  path: '/dashboard', icon: LayoutDashboard, minRole: 'agent' },
      { name: 'Pipeline',   path: '/pipeline',  icon: KanbanSquare,    minRole: 'agent' },
      { name: 'Lead Pool',  path: '/leads',     icon: Users,           minRole: 'agent' },
      { name: 'Contacts',   path: '/contacts',  icon: Contact,         minRole: 'agent' },
      { name: 'Viewings',   path: '/viewings',  icon: Calendar,        minRole: 'agent' },
      { name: 'Tasks',      path: '/tasks',     icon: CheckSquare,     minRole: 'agent' },
    ]
  },
  {
    // Operations — visible to ALL staff (agents, finance, admin, owner)
    label: 'Operations',
    minRole: 'agent',
    items: [
      { name: 'Team',       path: '/team',       icon: UserCircle,  minRole: 'agent' },
      { name: 'Chat',       path: '/chat',       icon: MessageSquare, minRole: 'agent' },
      { name: 'Meetings',   path: '/meetings',   icon: Video,       minRole: 'agent' },
      { name: 'Complaints', path: '/complaints', icon: AlertCircle, minRole: 'agent' },
    ]
  },
  {
    label: 'Properties',
    minRole: 'agent',
    items: [
      { name: 'Off-Plan Projects',    path: '/offplan',        icon: Building,  minRole: 'agent' },
      { name: 'Sale Listings',        path: '/sale-listings',  icon: Home,      minRole: 'agent' },
      { name: 'Rent Listings',        path: '/rent-listings',  icon: Key,       minRole: 'agent' },
      { name: 'Developers',           path: '/developers',     icon: Building2, minRole: 'agent' },
      { name: 'Areas & Communities',  path: '/communities',    icon: MapPin,    minRole: 'agent' },
      { name: 'Owner Database',       path: '/owner-database', icon: Users2,    minRole: 'admin' },
    ]
  },
  {
    label: 'Marketing',
    minRole: 'admin',
    items: [
      { name: 'Email Marketing', path: '/email-marketing', icon: Mail,   minRole: 'admin' },
      { name: 'Social Media',    path: '/social-media',    icon: Share2, minRole: 'admin' },
    ]
  },
  {
    label: 'Integrations',
    minRole: 'admin',
    items: [
      { name: 'Portal Integrations', path: '/portals', icon: Globe, minRole: 'admin' },
    ]
  },
  {
    label: 'Content Manager',
    minRole: 'admin',
    items: [
      { name: 'Blog Posts',        path: '/content/blogs',   icon: FileText, minRole: 'admin' },
      { name: 'Off-Plan Projects', path: '/content/offplan', icon: Building, minRole: 'admin' },
    ]
  },
  {
    label: 'Documents',
    minRole: 'admin',
    items: [
      { name: 'Document Manager', path: '/documents', icon: FolderOpen, minRole: 'admin' },
    ]
  },

  {
    label: 'Analytics',
    minRole: 'agent',
    items: [
      { name: 'Reports',           path: '/reports',    icon: BarChart3, minRole: 'finance' },
      { name: 'Agent Oversight',   path: '/oversight',  icon: Eye,       minRole: 'admin'   },
      { name: 'Settings',          path: '/settings',   icon: Settings,  minRole: 'agent'   },
    ]
  },
  {
    // Administration — finance+ for accounting, admin+ for HR
    label: 'Administration',
    minRole: 'finance',
    items: [
      { name: 'HR Management', path: '/hr',         icon: Users2,     minRole: 'admin'   },
      { name: 'Accounting',    path: '/accounting', icon: Calculator, minRole: 'finance' },
    ]
  },
];

// Finance role — all allowed paths
const FINANCE_PATHS = new Set(['/dashboard', '/pipeline', '/leads', '/contacts', '/accounting', '/hr', '/reports', '/settings', '/team', '/chat', '/meetings', '/complaints', '/documents']);

function getFilteredMenuGroups(userRole: string) {
  // Finance: curated sidebar — leads/pipeline + operations + accounting/HR/reports
  if (userRole === 'finance') {
    return [
      {
        label: 'Main',
        items: [
          { name: 'Dashboard',  path: '/dashboard', icon: LayoutDashboard },
          { name: 'Pipeline',   path: '/pipeline',  icon: KanbanSquare    },
          { name: 'Lead Pool',  path: '/leads',     icon: Users           },
          { name: 'Contacts',   path: '/contacts',  icon: Contact         },
        ],
      },
      {
        label: 'Operations',
        items: [
          { name: 'Team',       path: '/team',       icon: UserCircle    },
          { name: 'Chat',       path: '/chat',       icon: MessageSquare },
          { name: 'Meetings',   path: '/meetings',   icon: Video         },
          { name: 'Complaints', path: '/complaints', icon: AlertCircle   },
        ],
      },
      {
        label: 'Documents',
        items: [
          { name: 'My Documents', path: '/documents', icon: FolderOpen },
        ],
      },
      {
        label: 'Analytics',
        items: [
          { name: 'Reports',  path: '/reports',  icon: BarChart3 },
          { name: 'Settings', path: '/settings', icon: Settings  },
        ],
      },
      {
        label: 'Administration',
        items: [
          { name: 'HR Management', path: '/hr',         icon: Users2     },
          { name: 'Accounting',    path: '/accounting', icon: Calculator },
        ],
      },
    ];
  }

  return allMenuGroups
    .filter(group => hasMinRole(userRole, group.minRole))
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasMinRole(userRole, item.minRole)),
    }))
    .filter(group => group.items.length > 0);
}

// Flat list for backward compat
const menuItems = allMenuGroups.flatMap(g => g.items);

const typeColors: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-700',
  contact: 'bg-yellow-100 text-yellow-700',
  property: 'bg-indigo-100 text-indigo-700',
  deal: 'bg-green-100 text-green-700',
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Keep internal state for backward-compat but prefer external props
  const [mobileOpenInternal, setMobileOpenInternal] = useState(false);
  const mobileOpen = isOpen || mobileOpenInternal;
  const closeMobile = () => { onClose?.(); setMobileOpenInternal(false); };
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('agent');
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    const role = localStorage.getItem('userRole') || 'agent';
    setUserRole(role);
  }, []);

  // Close mobile sidebar on route change (e.g. browser back button)
  useEffect(() => {
    closeMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    router.push('/login');
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.all || []);
          setShowResults(true);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleResultClick = (result: SearchResult) => {
    setSearchQuery('');
    setShowResults(false);
    closeMobile();
    router.push(result.url);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const userName = user?.name || 'Joseph Talaat';
  const userEmail = user?.email || 'joseph@astraterra.ae';
  const initials = userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: '#131B2B' }}>
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <Image
          src="/astraterra-logo-transparent.png"
          alt="Astra Terra Properties"
          width={180}
          height={80}
          style={{ width: '170px', height: 'auto', objectFit: 'contain', filter: 'brightness(1.05)' }}
          priority
        />
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }} ref={searchRef}>
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            {searching ? (
              <div className="h-3.5 w-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#C9A96E', borderTopColor: 'transparent' }} />
            ) : (
              <Search className="h-3.5 w-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
            )}
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            className="w-full pl-9 pr-3 py-2 text-sm text-white placeholder-gray-400 rounded-lg border focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.07)',
              borderColor: 'rgba(255,255,255,0.12)',
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = '#C9A96E';
              if (searchResults.length > 0) setShowResults(true);
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            }}
          />
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-72 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeColors[result.type] || 'bg-gray-100 text-gray-600'}`}>
                        {result.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 px-4 py-3">
              <p className="text-sm text-gray-500 text-center">No results for "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {getFilteredMenuGroups(userRole).map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => { if (item.path.startsWith('http')) { window.open(item.path, '_blank'); } else { router.push(item.path); closeMobile(); } }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left group relative"
                    style={{
                      background: isActive ? 'linear-gradient(135deg, #C9A96E, #8A6F2F)' : 'transparent',
                      color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                        e.currentTarget.style.color = 'white';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                      }
                    }}
                  >
                    <Icon
                      className="flex-shrink-0"
                      style={{ width: '16px', height: '16px', color: isActive ? 'white' : 'inherit' }}
                    />
                    <span className="text-sm font-medium">{item.name}</span>
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* WhatsApp */}
      <div className="px-3 pb-2 flex-shrink-0">
        <a
          href="https://wa.me/971585580053"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all"
          style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25D366' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(37, 211, 102, 0.25)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(37, 211, 102, 0.15)'; }}
        >
          <MessageCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-medium text-white">WhatsApp Business</span>
        </a>
      </div>

      {/* User Footer */}
      <div className="px-3 pb-4 pt-3 flex-shrink-0 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #C9A96E, #8A6F2F)', color: 'white' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{userName.split(' ')[0]}</p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-all"
          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 h-screen sticky top-0" style={{ background: '#131B2B' }}>
        {SidebarContent()}
      </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-60"
            onClick={() => closeMobile()}
          />
          <aside
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col shadow-2xl overflow-y-auto"
            style={{ background: '#131B2B' }}
          >
            {SidebarContent()}
          </aside>
        </>
      )}
    </>
  );
}
