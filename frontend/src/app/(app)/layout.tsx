'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { BottomTabBar } from '@/components/BottomTabBar';
import { SelectionProvider } from '@/components/selection-context';
import { TopBar } from '@/components/TopBar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { tokenStore } from '@/lib/token-store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!tokenStore.isAuthenticated()) {
      router.replace('/login');
    } else {
      setChecked(true);
    }
    setCollapsed(window.localStorage.getItem('sm_sidebar') === 'collapsed');
  }, [router]);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem('sm_sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  };

  if (!checked) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <div className="size-8 animate-spin rounded-full border-2 border-green-200 border-t-green-600" />
      </div>
    );
  }

  return (
    <SelectionProvider>
      <TooltipProvider delayDuration={200}>
        <div className="flex min-h-screen bg-paper">
          <AppSidebar collapsed={collapsed} onToggle={toggle} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-8">
              {children}
            </main>
          </div>
          <BottomTabBar />
        </div>
      </TooltipProvider>
    </SelectionProvider>
  );
}
