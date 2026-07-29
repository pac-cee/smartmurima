'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useSensorReadings } from '@/hooks/useSensorReadings';
import { cn } from '@/lib/utils';

type MetricKey = 'soil_moisture' | 'temperature' | 'humidity' | 'rainfall';
type Range = '24h' | '7d' | '30d';

const metricRamp: Record<MetricKey, string> = {
  soil_moisture: 'var(--green-600)',
  temperature: 'var(--green-800)',
  humidity: 'var(--green-500)',
  rainfall: 'var(--green-400)',
};

export function SensorTrendChart({ fieldId }: { fieldId: string | undefined }) {
  const t = useTranslations();
  const [range, setRange] = useState<Range>('24h');
  const [metric, setMetric] = useState<MetricKey>('soil_moisture');
  const agg = range === '24h' ? 'hourly' : 'daily';
  const { data, isLoading } = useSensorReadings(fieldId, agg);

  const rows = useMemo(() => {
    if (!data) return [];
    const sliced = range === '7d' ? data.slice(-7) : data;
    return sliced.map((r) => ({
      ...r,
      label:
        agg === 'hourly'
          ? new Date(r.recorded_at).toLocaleTimeString('en-GB', { hour: '2-digit' })
          : new Date(r.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    }));
  }, [data, range, agg]);

  const metrics: MetricKey[] = ['soil_moisture', 'temperature', 'humidity', 'rainfall'];
  const ranges: Range[] = ['24h', '7d', '30d'];
  const color = metricRamp[metric];

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Metric">
          {metrics.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={metric === m}
              onClick={() => setMetric(m)}
              className={cn(
                'rounded-pill px-3 py-1.5 text-xs font-medium transition-colors',
                metric === m
                  ? 'bg-green-600 text-white'
                  : 'bg-[var(--surface-muted)] text-ink-500 hover:text-ink-700',
              )}
            >
              {t(`sensors.${m}`)}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-control border border-line p-0.5" role="tablist">
          {ranges.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                range === r ? 'bg-green-50 text-green-800' : 'text-ink-500 hover:text-ink-700',
              )}
            >
              {t(`range.${r}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64 w-full">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id={`ramp-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--ink-500)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--line)' }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: 'var(--ink-500)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: 'var(--green-300)', strokeWidth: 1 }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  color: 'var(--ink-900)',
                  boxShadow: 'var(--shadow-md)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--ink-500)' }}
                formatter={(v: number) => [v, t(`sensors.${metric}`)]}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#ramp-${metric})`}
                animationDuration={700}
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
