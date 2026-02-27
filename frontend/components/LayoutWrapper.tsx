'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't show sidebar on login page or root
  const showSidebar = pathname !== '/login' && pathname !== '/';

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F4F6F9' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: '#F4F6F9' }}>
        {children}
      </main>
    </div>
  );
}
