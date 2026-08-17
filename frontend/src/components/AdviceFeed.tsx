'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Droplets, FlaskConical, RefreshCw, Sprout } from 'lucide-react';
import { ConfidenceBar } from '@/components/ConfidenceBar';
import { EmptyState } from '@/components/EmptyState';
import { CardSkeleton } from '@/components/Skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLatestRecommendations } from '@/hooks/useRecommendations';
import type { AdviceItem, RecommendationType } from '@/lib/schemas';
import { cn, relativeTime } from '@/lib/utils';

const typeIcon: Record<RecommendationType, typeof Droplets> = {
  irrigation: Droplets,
  fertilizer: FlaskConical,
  yield: Sprout,
};

function formatDetails(details: AdviceItem['details']): string {
  if (details == null) return '';
  if (typeof details === 'string') return details;
  return Object.entries(details)
    .map(
      ([k, v]) =>
        `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`,
    )
    .join(' · ');
}

export function AdviceItemCard({ item }: { item: AdviceItem }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const Icon = typeIcon[item.type];
  const detailsText = formatDetails(item.details);

  return (
    <div className="rounded-card border border-line bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-tile bg-green-50 text-green-700">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Badge variant="soft">{t(`recommendations.types.${item.type}`)}</Badge>
          <p className="mt-2 text-base font-semibold text-ink-900">{item.decision}</p>
          {item.value != null && item.value > 0 && (
            <p className="mt-0.5 flex items-baseline gap-1">
              <span className="tabular text-2xl font-bold text-green-700">{item.value}</span>
              <span className="text-sm text-ink-500">{item.unit}</span>
            </p>
          )}
          <div className="mt-3">
            <ConfidenceBar value={item.confidence} label={t('common.confidence')} />
          </div>

          {detailsText && (
            <>
              <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800"
              >
                {t('recommendations.details')}
                <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
              </button>
              {open && (
                <p className="mt-2 animate-slide-up text-sm leading-relaxed text-ink-700">
                  {detailsText}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Auto-advice feed for a single section (field). Fetches the latest bundle and
 * renders one card per advice type. There is no manual "request" trigger — the
 * only control is an optional Refresh (re-fetch).
 */
export function AdviceFeed({
  fieldId,
  limit,
  showRefresh = false,
  showTimestamp = true,
  stacked = false,
}: {
  fieldId?: string;
  limit?: number;
  showRefresh?: boolean;
  showTimestamp?: boolean;
  stacked?: boolean;
}) {
  const t = useTranslations('recommendations');
  const tc = useTranslations('common');
  const query = useLatestRecommendations(fieldId);

  if (!fieldId) {
    return <EmptyState icon={Sprout} title={t('selectSection')} />;
  }

  const gridClass = stacked ? 'space-y-4' : 'grid gap-4 lg:grid-cols-2';

  if (query.isLoading) {
    return (
      <div className={gridClass}>
        <CardSkeleton lines={4} />
        {!stacked && <CardSkeleton lines={4} />}
      </div>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        icon={Sprout}
        title={tc('retry')}
        action={
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            <RefreshCw className="size-4" /> {t('refresh')}
          </Button>
        }
      />
    );
  }

  const bundle = query.data;
  const items = limit ? (bundle?.items ?? []).slice(0, limit) : (bundle?.items ?? []);

  if (items.length === 0) {
    return <EmptyState icon={Sprout} title={t('noAdvice')} description={t('noAdviceBody')} />;
  }

  return (
    <div className="space-y-4">
      {(showTimestamp || showRefresh) && (
        <div className="flex items-center justify-between gap-3">
          {showTimestamp && bundle?.generated_at ? (
            <p className="text-xs text-ink-500">
              {t('generatedAt')} {relativeTime(bundle.generated_at)}
            </p>
          ) : (
            <span />
          )}
          {showRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={cn('size-4', query.isFetching && 'animate-spin')} />
              {t('refresh')}
            </Button>
          )}
        </div>
      )}
      <div className={gridClass}>
        {items.map((item) => (
          <AdviceItemCard key={item.type} item={item} />
        ))}
      </div>
    </div>
  );
}
