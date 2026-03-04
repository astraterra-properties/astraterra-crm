'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import Image from 'next/image';
import Sidebar from './Sidebar';
import ProfileGate from './ProfileGate';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Don't show sidebar on login page or root
  const showSidebar = pathname !== '/login' && pathname !== '/';

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F4F6F9' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0f1623' }}>
        {/* Mobile top bar — hamburger + brand; hidden on lg+ */}
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b"
          style={{ background: '#131B2B', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg flex-shrink-0"
            style={{ color: '#C9A96E' }}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Image
            src="/astraterra-logo-transparent.png"
            alt="Astra Terra Properties"
            width={120}
            height={36}
            style={{ height: '30px', width: 'auto', objectFit: 'contain' }}
            priority
          />
        </div>
        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto">
          <ProfileGate>
            {children}
          </ProfileGate>
        </main>
      </div>
    </div>
  );
}
