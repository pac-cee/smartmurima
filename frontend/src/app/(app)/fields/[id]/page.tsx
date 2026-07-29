'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Sprout, Stethoscope } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RecommendationCard } from '@/components/RecommendationCard';
import { SensorGauge } from '@/components/SensorGauge';
import { SensorStatus } from '@/components/SensorStatus';
import { SensorTrendChart } from '@/components/SensorTrendChart';
import { CardSkeleton } from '@/components/Skeletons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDiseaseReports } from '@/hooks/useDiseaseDetect';
import { useField } from '@/hooks/useFields';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useLatestReading } from '@/hooks/useSensorReadings';
import { formatDate } from '@/lib/utils';

export default function FieldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('fields');
  const ts = useTranslations('sensors');
  const tr = useTranslations('recommendations');
  const td = useTranslations('diseases');
  const { data: field } = useField(id);
  const { data: latest, isLoading: latestLoading } = useLatestReading(id);
  const { data: recs } = useRecommendations({ field: id });
  const { data: scans } = useDiseaseReports(id);

  return (
    <div className="space-y-6">
      <Link
        href={field ? `/farms/${field.farm}` : '/farms'}
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700"
      >
        <ArrowLeft className="size-4" /> {field?.farm_name ?? 'Farm'}
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{field?.name ?? '—'}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {field?.crop_name ?? 'No crop'}
            {field?.planting_date ? ` · ${formatDate(field.planting_date)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SensorStatus lastSeen={latest?.recorded_at ?? null} />
          {field && <Badge variant="soft">{field.growth_stage}</Badge>}
        </div>
      </div>

      {/* live gauges */}
      <Card>
        <CardHeader>
          <CardTitle>{t('gauges')}</CardTitle>
        </CardHeader>
        <CardContent>
          {latestLoading || !latest ? (
            <div className="flex flex-wrap justify-around gap-6">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="size-40 rounded-pill" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-around gap-8">
              <SensorGauge
                value={latest.soil_moisture}
                min={0}
                max={100}
                unit="%"
                decimals={1}
                label={ts('soil_moisture')}
                optimalMin={30}
                optimalMax={55}
              />
              <SensorGauge
                value={latest.temperature ?? 0}
                min={0}
                max={45}
                unit="°C"
                decimals={1}
                label={ts('temperature')}
                optimalMin={18}
                optimalMax={30}
              />
              <SensorGauge
                value={latest.humidity ?? 0}
                min={0}
                max={100}
                unit="%"
                label={ts('humidity')}
                optimalMin={40}
                optimalMax={75}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* history */}
      <Card>
        <CardHeader>
          <CardTitle>{ts('history')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary>
            <SensorTrendChart fieldId={id} />
          </ErrorBoundary>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>{tr('title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!recs ? (
              <CardSkeleton />
            ) : recs.length > 0 ? (
              recs.map((rec) => <RecommendationCard key={rec.id} rec={rec} />)
            ) : (
              <EmptyState icon={Sprout} title={tr('title')} />
            )}
          </CardContent>
        </Card>

        {/* disease reports */}
        <Card>
          <CardHeader>
            <CardTitle>{t('reports')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scans && scans.length > 0 ? (
              scans.map((scan) => (
                <div key={scan.id} className="flex gap-3 rounded-tile border border-line p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scan.image_url ?? undefined}
                    alt={scan.disease}
                    className="size-16 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{scan.disease}</p>
                    <p className="tabular text-xs text-green-700">
                      {Math.round(scan.confidence * 100)}%
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-500">{scan.treatment}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={Stethoscope} title={td('reports')} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
