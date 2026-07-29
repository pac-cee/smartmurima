import {
  Bell,
  FileBarChart,
  LayoutDashboard,
  Leaf,
  MapPinned,
  MessageCircle,
  Settings,
  ShieldCheck,
  Sprout,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/schemas';

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  section: 'overview' | 'grow' | 'manage';
  roles?: Role[];
};

export const navItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, section: 'overview' },
  { href: '/farms', labelKey: 'farms', icon: MapPinned, section: 'overview' },
  { href: '/recommendations', labelKey: 'recommendations', icon: Sprout, section: 'grow' },
  { href: '/diseases', labelKey: 'diseases', icon: Stethoscope, section: 'grow' },
  { href: '/assistant', labelKey: 'assistant', icon: MessageCircle, section: 'grow' },
  { href: '/alerts', labelKey: 'alerts', icon: Bell, section: 'manage' },
  { href: '/reports', labelKey: 'reports', icon: FileBarChart, section: 'manage' },
  {
    href: '/admin',
    labelKey: 'admin',
    icon: ShieldCheck,
    section: 'manage',
    roles: ['admin', 'coop_admin'],
  },
  { href: '/settings', labelKey: 'settings', icon: Settings, section: 'manage' },
];

// Primary items surfaced on the mobile bottom tab bar.
export const bottomNavItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, section: 'overview' },
  { href: '/farms', labelKey: 'farms', icon: MapPinned, section: 'overview' },
  { href: '/assistant', labelKey: 'assistant', icon: MessageCircle, section: 'grow' },
  { href: '/diseases', labelKey: 'diseases', icon: Leaf, section: 'grow' },
  { href: '/alerts', labelKey: 'alerts', icon: Bell, section: 'manage' },
];

export function visibleItems(items: NavItem[], role: Role | undefined): NavItem[] {
  return items.filter((i) => !i.roles || (role && i.roles.includes(role)));
}
