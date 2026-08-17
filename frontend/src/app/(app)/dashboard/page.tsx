'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Droplets,
  Gauge,
  Layers,
  MapPinned,
  MessageCircle,
  Stethoscope,
  Thermometer,
  Waves,
} from 'lucide-react';
import { AdviceFeed } from '@/components/AdviceFeed';
import { AlertItem } from '@/components/AlertItem';
import { CreateFarmDialog } from '@/components/CreateFarmDialog';
import { CreateFieldDialog } from '@/components/CreateFieldDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OnboardingPanel } from '@/components/OnboardingPanel';
import { SensorStatus } from '@/components/SensorStatus';
import { SensorTrendChart } from '@/components/SensorTrendChart';
import { useSelection } from '@/components/selection-context';
import { ListSkeleton, StatRowSkeleton } from '@/components/Skeletons';
import { StatTile } from '@/components/StatTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAlerts } from '@/hooks/useAlerts';
import { useDiseaseReports } from '@/hooks/useDiseaseDetect';
import { useFarms } from '@/hooks/useFarms';
import { useFields } from '@/hooks/useFields';
import { useLatestReading } from '@/hooks/useSensorReadings';
import { useSession } from '@/hooks/useAuth';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const ta = useTranslations('alerts');
  const te = useTranslations('empty');
  const to = useTranslations('onboarding');
  const { user } = useSession();
  const { farmId, fieldId } = useSelection();
  const { data: farms, isLoading: farmsLoading } = useFarms();
  const activeFarm = farmId ?? farms?.[0]?.id;
  const { data: fields, isLoading: fieldsLoading } = useFields(activeFarm ?? undefined);
  const effectiveField = fieldId ?? fields?.[0]?.id;

  const { data: latest, isLoading: latestLoading } = useLatestReading(effectiveField);
  const { data: alerts, isLoading: alertsLoading } = useAlerts();
  const { data: scans, isLoading: scansLoading } = useDiseaseReports();
  const unread = alerts?.filter((a) => !a.is_read).length ?? 0;

  const firstName = user?.full_name?.split(' ')[0] ?? 'Umuhinzi';

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          {t('greeting', { name: firstName })}
        </h1>
        <p className="mt-1 text-sm text-ink-500">{t('subtitle')}</p>
      </div>
      {effectiveField && <SensorStatus lastSeen={latest?.recorded_at ?? null} />}
    </div>
  );

  // Golden path for a brand-new farmer: no farms -> create a farm; a farm but no
  // sections -> create the first section. Only once a section exists do the
  // data cards render.
  const noFarms = !farmsLoading && (!farms || farms.length === 0);
  const noSections = !noFarms && !fieldsLoading && Boolean(activeFarm) && (!fields || fields.length === 0);

  if (noFarms) {
    return (
      <div className="space-y-6">
        {header}
        <OnboardingPanel
          icon={MapPinned}
          title={to('farmTitle')}
          body={to('farmBody')}
          action={
            <CreateFarmDialog
              trigger={
                <Button size="lg">
                  <MapPinned className="size-4" /> {to('farmCta')}
                </Button>
              }
            />
          }
        />
      </div>
    );
  }

  if (noSections && activeFarm) {
    return (
      <div className="space-y-6">
        {header}
        <OnboardingPanel
          icon={Layers}
          title={to('sectionTitle')}
          body={to('sectionBody')}
          action={
            <CreateFieldDialog
              farmId={activeFarm}
              trigger={
                <Button size="lg">
                  <Layers className="size-4" /> {to('sectionCta')}
                </Button>
              }
            />
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* KPI row */}
      {latestLoading ? (
        <StatRowSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            icon={Droplets}
            label={t('kpi.soilMoisture')}
            value={latest?.soil_moisture ?? null}
            unit="%"
            decimals={1}
          />
          <StatTile
            icon={Thermometer}
            label={t('kpi.temperature')}
            value={latest?.temperature ?? null}
            unit="°C"
            decimals={1}
          />
          <StatTile
            icon={Waves}
            label={t('kpi.humidity')}
            value={latest?.humidity ?? null}
            unit="%"
            decimals={0}
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
          <CardContent>
            <AdviceFeed
              fieldId={effectiveField}
              limit={2}
              stacked
              showTimestamp={false}
            />
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
          {scansLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-56 shrink-0 overflow-hidden rounded-tile border border-line"
                >
                  <Skeleton className="h-28 w-full rounded-none" />
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : scans && scans.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-1">
              {scans.map((scan) => (
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
          ) : (
            <EmptyState icon={Stethoscope} title={te('diseases')} description={te('diseasesBody')} />
          )}
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
