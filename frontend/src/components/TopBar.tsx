'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Menu, User as UserIcon } from 'lucide-react';
import { FarmFieldSwitcher } from '@/components/FarmFieldSwitcher';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { navItems, visibleItems } from '@/components/nav-items';
import { useUnreadCount } from '@/hooks/useAlerts';
import { useLogout, useSession } from '@/hooks/useAuth';
import { initials } from '@/lib/utils';

export function TopBar() {
  const t = useTranslations();
  const tn = useTranslations('nav');
  const router = useRouter();
  const { user } = useSession();
  const logout = useLogout();
  const unread = useUnreadCount();
  const items = visibleItems(navItems, user?.role);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-card/90 px-4 backdrop-blur sm:px-6">
      {/* mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-green-800 p-0 text-green-100">
          <div className="flex h-16 items-center border-b border-white/10 px-4">
            <Logo onDark />
          </div>
          <nav className="space-y-1 p-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-green-100/90 hover:bg-white/10 hover:text-white"
                >
                  <Icon className="size-5" /> {tn(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="rounded-control border border-line px-1 sm:border-0">
        <FarmFieldSwitcher />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <LanguageToggle className="hidden sm:inline-flex" />
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t('alerts.title')}
          onClick={() => router.push('/alerts')}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-pill bg-green-600 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
              <Avatar>
                <AvatarFallback>{initials(user?.full_name ?? 'SM')}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-semibold text-ink-900">
                {user?.full_name ?? 'SmartMurima'}
              </p>
              <p className="truncate text-xs font-normal text-ink-500">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <UserIcon /> {t('settings.profile')}
            </DropdownMenuItem>
            <div className="px-2.5 py-1 sm:hidden">
              <LanguageToggle />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut /> {t('common.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
