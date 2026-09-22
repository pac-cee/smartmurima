'use client';

import { CloudRain, CloudSun, Droplets } from 'lucide-react';
import { CardSkeleton } from '@/components/Skeletons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWeatherForecast } from '@/hooks/useReports';

const DAY_LABEL = new Intl.DateTimeFormat('en', { weekday: 'short' });

function dayLabel(iso: string, index: number): string {
  if (index === 0) return 'Today';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : DAY_LABEL.format(parsed);
}

function show(value: number | null, suffix: string): string {
  return typeof value === 'number' ? `${Math.round(value)}${suffix}` : '—';
}

/**
 * Short-range outlook for a farm.
 *
 * When no weather provider is configured the backend still answers, with a
 * neutral estimate flagged `stale` -- badged here as "Estimated" so nobody
 * plans irrigation around a number we made up.
 */
export function WeatherCard({ farmId }: { farmId: string | undefined }) {
  const { data, isLoading, isError } = useWeatherForecast(farmId);

  if (!farmId) return null;
  if (isLoading) return <CardSkeleton lines={3} />;
  if (isError || !data || data.days.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <CloudSun className="size-5 text-green-700" /> Weather outlook
        </CardTitle>
        {data.stale && <Badge variant="muted">Estimated</Badge>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.days.map((day, index) => (
            <div key={day.date} className="rounded-tile border border-line p-3">
              <p className="text-xs font-semibold text-ink-900">{dayLabel(day.date, index)}</p>
              <p className="mt-1 tabular text-lg font-bold text-ink-900">
                {show(day.temp_max, '°')}
                <span className="ml-1 text-sm font-medium text-ink-500">
                  / {show(day.temp_min, '°')}
                </span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                <span className="flex items-center gap-1">
                  <CloudRain className="size-3.5" /> {show(day.rainfall_mm, 'mm')}
                </span>
                <span className="flex items-center gap-1">
                  <Droplets className="size-3.5" /> {show(day.humidity, '%')}
                </span>
              </div>
              {day.summary && (
                <p className="mt-1 truncate text-xs text-ink-500" title={day.summary}>
                  {day.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
