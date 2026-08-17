import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Prominent onboarding panel for the golden path — a brand-new farmer with no
 * farms/sections. Green + white, rounded-xl, one heading + one line + a single
 * primary action. Used on the dashboard and every section-scoped page.
 */
export function OnboardingPanel({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-5 rounded-card border border-green-200 bg-green-50 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="grid size-16 place-items-center rounded-pill bg-green-600 text-white shadow-sm">
        <Icon className="size-8" />
      </span>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-green-900">{title}</h2>
        <p className="mx-auto max-w-md text-sm text-green-800/80">{body}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}
