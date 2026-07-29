'use client';

import { useTranslations } from 'next-intl';
import { CloudRain, Cpu, Droplets, ShieldAlert, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMarkAlertRead } from '@/hooks/useAlerts';
import type { Alert, AlertType } from '@/lib/schemas';
import { cn, relativeTime } from '@/lib/utils';

const typeIcon: Record<AlertType, LucideIcon> = {
  low_moisture: Droplets,
  disease_risk: ShieldAlert,
  weather: CloudRain,
  system: Cpu,
};

export function AlertItem({ alert }: { alert: Alert }) {
  const t = useTranslations();
  const markRead = useMarkAlertRead();
  const Icon = typeIcon[alert.type];
  // Critical alerts (disease/low moisture) use deeper green + black text, never red.
  const critical = alert.type === 'disease_risk' || alert.type === 'low_moisture';

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-card border p-4 transition-colors',
        alert.is_read ? 'border-line bg-card' : 'border-green-200 bg-green-50/60',
      )}
    >
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-tile',
          critical ? 'bg-green-100 text-green-900' : 'bg-green-50 text-green-700',
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
            {t(`alerts.types.${alert.type}`)}
          </span>
          {!alert.is_read && <span className="size-1.5 rounded-pill bg-green-600" />}
          <span className="ml-auto text-xs text-ink-500">{relativeTime(alert.created_at)}</span>
        </div>
        <p className="mt-1 text-sm font-medium text-ink-900">{alert.message}</p>
        {alert.severity && alert.severity !== 'info' && (
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-500">
            {alert.severity}
          </p>
        )}
      </div>
      {!alert.is_read && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => markRead.mutate(alert.id)}
          disabled={markRead.isPending}
          className="shrink-0"
        >
          {t('alerts.markRead')}
        </Button>
      )}
    </div>
  );
}
