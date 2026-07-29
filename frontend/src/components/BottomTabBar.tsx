'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { bottomNavItems } from '@/components/nav-items';
import { cn } from '@/lib/utils';

export function BottomTabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      {bottomNavItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
              active ? 'text-green-700' : 'text-ink-500',
            )}
          >
            <Icon className={cn('size-5', active && 'text-green-600')} />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
