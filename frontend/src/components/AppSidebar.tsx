'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { navItems, visibleItems, type NavItem } from '@/components/nav-items';
import { useSession } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const sections: NavItem['section'][] = ['overview', 'grow', 'manage'];

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { user } = useSession();
  const items = visibleItems(navItems, user?.role);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col bg-green-800 text-green-100 transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[72px]' : 'w-[264px]',
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-white/10 px-4',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {collapsed ? (
          <span className="grid size-9 place-items-center rounded-[10px] bg-green-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 21V11" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 12C12 8 15 5 20 5C20 9 17 12 12 12Z" fill="#D1FADF" />
              <path d="M12 14C12 11 9.5 8.5 5 9C5 12.5 7.5 14.5 12 14Z" fill="#A6F4C5" />
            </svg>
          </span>
        ) : (
          <Logo onDark />
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        {sections.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section}>
              {!collapsed && (
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-green-300/80">
                  {t(`sections.${section}`)}
                </p>
              )}
              <ul className="space-y-1">
                {sectionItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? t(item.labelKey) : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                          collapsed && 'justify-center',
                          active
                            ? 'bg-green-600 text-white shadow-sm'
                            : 'text-green-100/90 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        <Icon className="size-5 shrink-0" />
                        {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <button
        onClick={onToggle}
        className={cn(
          'flex h-14 items-center gap-3 border-t border-white/10 px-4 text-sm text-green-100/80 transition-colors hover:bg-white/10 hover:text-white',
          collapsed && 'justify-center',
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-5" />
        ) : (
          <>
            <PanelLeftClose className="size-5" /> <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
}
