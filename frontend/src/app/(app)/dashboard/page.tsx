'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Droplets,
  Gauge,
  MessageCircle,
  Sprout,
  Thermometer,
  Waves,
} from 'lucide-react';
import { AlertItem } from '@/components/AlertItem';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RecommendationCard } from '@/components/RecommendationCard';
import { SensorStatus } from '@/components/SensorStatus';
import { SensorTrendChart } from '@/components/SensorTrendChart';
import { useSelection } from '@/components/selection-context';
import { CardSkeleton, ListSkeleton, StatRowSkeleton } from '@/components/Skeletons';
import { StatTile } from '@/components/StatTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAlerts } from '@/hooks/useAlerts';
import { useDiseaseReports } from '@/hooks/useDiseaseDetect';
import { useFields } from '@/hooks/useFields';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useLatestReading } from '@/hooks/useSensorReadings';
import { useSession } from '@/hooks/useAuth';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const ta = useTranslations('alerts');
  const { user } = useSession();
  const { farmId, fieldId } = useSelection();
  const { data: fields } = useFields(farmId ?? undefined);
  const effectiveField = fieldId ?? fields?.[0]?.id;

  const { data: latest, isLoading: latestLoading } = useLatestReading(effectiveField);
  const { data: recs, isLoading: recsLoading } = useRecommendations(
    fieldId ? { field: fieldId } : undefined,
  );
  const { data: alerts, isLoading: alertsLoading } = useAlerts();
  const { data: scans } = useDiseaseReports();
  const unread = alerts?.filter((a) => !a.is_read).length ?? 0;

  const firstName = user?.full_name?.split(' ')[0] ?? 'Umuhinzi';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            {t('greeting', { name: firstName })}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{t('subtitle')}</p>
        </div>
        {effectiveField && <SensorStatus lastSeen={latest?.recorded_at ?? null} />}
      </div>

      {/* KPI row */}
      {latestLoading || !latest ? (
        <StatRowSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            icon={Droplets}
            label={t('kpi.soilMoisture')}
            value={latest.soil_moisture}
            unit="%"
            decimals={1}
            delta={2}
            deltaLabel="%"
          />
          <StatTile
            icon={Thermometer}
            label={t('kpi.temperature')}
            value={latest.temperature ?? 0}
            unit="°C"
            decimals={1}
            delta={1}
            deltaLabel="°"
          />
          <StatTile
            icon={Waves}
            label={t('kpi.humidity')}
            value={latest.humidity ?? 0}
            unit="%"
            decimals={0}
            delta={-3}
            deltaLabel="%"
          />
          <StatTile icon={Bell} label={t('kpi.activeAlerts')} value={unread} />
        </div>
      )}

      {/* Two-column: trend + recommendations */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-5 text-green-600" /> {t('trend')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ErrorBoundary>
              <SensorTrendChart fieldId={effectiveField} />
            </ErrorBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t('recFeed')}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/recommendations">
                {tc('viewAll')} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recsLoading ? (
              <CardSkeleton lines={4} />
            ) : recs && recs.length > 0 ? (
              recs.slice(0, 2).map((rec) => <RecommendationCard key={rec.id} rec={rec} />)
            ) : (
              <EmptyState icon={Sprout} title={t('recFeed')} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Disease strip */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('diseaseStrip')}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/diseases">
              {tc('viewAll')} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {(scans ?? []).map((scan) => (
              <div
                key={scan.id}
                className="w-56 shrink-0 overflow-hidden rounded-tile border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scan.image_url ?? undefined}
                  alt={scan.disease}
                  className="h-28 w-full object-cover"
                />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-ink-900">{scan.disease}</p>
                  <p className="text-xs text-ink-500">{scan.field_name}</p>
                  <p className="mt-1 tabular text-xs font-medium text-green-700">
                    {Math.round(scan.confidence * 100)}% {tc('confidence').toLowerCase()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Assistant launcher */}
      <Card className="overflow-hidden border-green-200 bg-green-50">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-tile bg-green-600 text-white">
              <MessageCircle className="size-6" />
            </span>
            <div>
              <p className="text-lg font-semibold text-green-900">{t('askTitle')}</p>
              <p className="text-sm text-green-800/80">{t('askBody')}</p>
            </div>
          </div>
          <Button asChild size="lg">
            <Link href="/assistant">{t('openAssistant')}</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Alerts preview */}
      <Card>
        <CardHeader>
          <CardTitle>{ta('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertsLoading ? (
            <ListSkeleton rows={2} />
          ) : alerts && alerts.length > 0 ? (
            alerts.slice(0, 3).map((alert) => <AlertItem key={alert.id} alert={alert} />)
          ) : (
            <EmptyState icon={Bell} title="You're all caught up" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
