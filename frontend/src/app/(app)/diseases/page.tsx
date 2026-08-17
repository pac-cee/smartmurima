'use client';

import { useTranslations } from 'next-intl';
import { MapPinned, Stethoscope } from 'lucide-react';
import { DiseaseUploadCard } from '@/components/DiseaseUploadCard';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { useSelection } from '@/components/selection-context';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDiseaseReports } from '@/hooks/useDiseaseDetect';
import { relativeTime } from '@/lib/utils';

export default function DiseasesPage() {
  const t = useTranslations('diseases');
  const ts = useTranslations('sections');
  // Section to scan against comes from the global top-bar switcher.
  const { fieldId } = useSelection();
  const { data: reports } = useDiseaseReports();

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {!fieldId ? (
            <EmptyState
              icon={MapPinned}
              title={ts('selectPrompt')}
              description={ts('selectPromptBody')}
            />
          ) : (
            <DiseaseUploadCard fieldId={fieldId} />
          )}
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('reports')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reports && reports.length > 0 ? (
              reports.map((r) => (
                <div key={r.id} className="flex gap-3 rounded-tile border border-line p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.image_url ?? undefined}
                    alt={r.disease}
                    className="size-14 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-ink-900">{r.disease}</p>
                      <Badge variant={r.is_healthy ? 'soft' : 'attention'}>
                        {Math.round(r.confidence * 100)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-500">
                      {r.field_name} · {relativeTime(r.created_at)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={Stethoscope} title={t('reports')} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
