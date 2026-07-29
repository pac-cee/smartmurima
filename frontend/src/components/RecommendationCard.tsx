'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Droplets, FlaskConical, Sprout } from 'lucide-react';
import { ConfidenceBar } from '@/components/ConfidenceBar';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';
import type { Recommendation, RecommendationType } from '@/lib/schemas';
import { cn } from '@/lib/utils';

const typeIcon: Record<RecommendationType, typeof Droplets> = {
  irrigation: Droplets,
  fertilizer: FlaskConical,
  yield: Sprout,
};

function formatDetails(details: Recommendation['details']): string {
  if (details == null) return '';
  if (typeof details === 'string') return details;
  // JSON detail object from the ML service: render its key/value pairs.
  return Object.entries(details)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const Icon = typeIcon[rec.type];
  const detailsText = formatDetails(rec.details);

  return (
    <div className="rounded-card border border-line bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-tile bg-green-50 text-green-700">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="soft">{t(`recommendations.types.${rec.type}`)}</Badge>
            {rec.field_name && <span className="text-xs text-ink-500">{rec.field_name}</span>}
            <span className="ml-auto text-xs text-ink-500">{relativeTime(rec.created_at)}</span>
          </div>
          <p className="mt-2 text-base font-semibold text-ink-900">{rec.decision}</p>
          {rec.value != null && rec.value > 0 && (
            <p className="mt-0.5 flex items-baseline gap-1">
              <span className="tabular text-2xl font-bold text-green-700">{rec.value}</span>
              <span className="text-sm text-ink-500">{rec.unit}</span>
            </p>
          )}
          <div className="mt-3">
            <ConfidenceBar value={rec.confidence} label={t('common.confidence')} />
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
