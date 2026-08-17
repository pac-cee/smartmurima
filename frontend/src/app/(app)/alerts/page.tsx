'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BellOff, CheckCheck } from 'lucide-react';
import { AlertItem } from '@/components/AlertItem';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { ListSkeleton } from '@/components/Skeletons';
import { Button } from '@/components/ui/button';
import { useAlerts, useMarkAlertRead } from '@/hooks/useAlerts';
import { cn } from '@/lib/utils';

export default function AlertsPage() {
  const t = useTranslations('alerts');
  const tc = useTranslations('common');
  const te = useTranslations('empty');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data: alerts, isLoading } = useAlerts(unreadOnly);
  const markRead = useMarkAlertRead();

  const unread = alerts?.filter((a) => !a.is_read) ?? [];
  const markAllRead = () => {
    unread.forEach((a) => markRead.mutate(a.id));
  };

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <div className="flex items-center gap-2">
            {unread.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                disabled={markRead.isPending}
              >
                <CheckCheck className="size-4" /> {t('markAllRead')}
              </Button>
            )}
            <div className="inline-flex rounded-control border border-line p-0.5">
            <button
              onClick={() => setUnreadOnly(false)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                !unreadOnly ? 'bg-green-50 text-green-800' : 'text-ink-500',
              )}
            >
              {tc('all')}
            </button>
            <button
              onClick={() => setUnreadOnly(true)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                unreadOnly ? 'bg-green-50 text-green-800' : 'text-ink-500',
              )}
            >
              {t('unread')}
            </button>
            </div>
          </div>
        }
      />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : alerts && alerts.length > 0 ? (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      ) : (
        <EmptyState icon={BellOff} title={te('alerts')} description={te('alertsBody')} />
      )}
    </div>
  );
}
