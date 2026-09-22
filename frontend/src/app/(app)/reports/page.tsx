'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Download,
  Droplets,
  FileBarChart,
  FileText,
  Sprout,
  Stethoscope,
  Thermometer,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { useSelection } from '@/components/selection-context';
import { ChartSkeleton, StatRowSkeleton } from '@/components/Skeletons';
import { StatTile } from '@/components/StatTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadReportExport, useReportSummary } from '@/hooks/useReports';
import type { ReportSlice } from '@/lib/schemas';

const axisTick = { fill: 'var(--ink-500)', fontSize: 11 };

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  fontSize: 12,
} as const;

// The design language is green/white/black only, so categorical slices are
// separated by lightness rather than hue. Ordered dark -> light so adjacent
// slices always differ enough to read.
const SLICE_COLORS = [
  'var(--green-800)',
  'var(--green-600)',
  'var(--green-400)',
  'var(--green-200)',
];

/** Short axis label: "2026-09-22" -> "22 Sep". */
function shortDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

export default function ReportsPage() {
  const t = useTranslations('reports');
  const { farmId } = useSelection();
  const { data, isLoading, isError, error } = useReportSummary(farmId ?? undefined);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!farmId) return;
    setExporting(format);
    try {
      await downloadReportExport(format, farmId);
    } catch {
      toast.error(t('exportFailed'));
    } finally {
      setExporting(null);
    }
  };

  // Recharts wants display-ready values; do the formatting once here rather
  // than in every axis and tooltip.
  const series = useMemo(
    () => (data?.series ?? []).map((p) => ({ ...p, label: shortDate(p.date) })),
    [data?.series],
  );

  const moisturePie = useMemo(
    () => (data?.moisture_distribution ?? []).filter((s) => s.count > 0),
    [data?.moisture_distribution],
  );
  const healthPie = useMemo(
    () => (data?.health_breakdown ?? []).filter((s) => s.count > 0),
    [data?.health_breakdown],
  );
  const advice = useMemo(
    () => (data?.advice_breakdown ?? []).map((a) => ({ ...a, label: titleCase(a.type) })),
    [data?.advice_breakdown],
  );
  const perField = useMemo(
    () => (data?.per_field ?? []).filter((f) => f.reading_count > 0),
    [data?.per_field],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          farmId && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                disabled={exporting !== null}
              >
                <Download className="size-4" /> {t('exportCsv')}
              </Button>
              <Button size="sm" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
                <FileText className="size-4" /> {t('exportPdf')}
              </Button>
            </>
          )
        }
      />

      {!farmId ? (
        <EmptyState icon={FileBarChart} title={t('selectFarm')} description={t('selectFarmBody')} />
      ) : isLoading ? (
        <>
          <StatRowSkeleton />
          <ChartSkeleton />
        </>
      ) : isError || !data ? (
        <EmptyState
          icon={FileBarChart}
          title="Could not build this report"
          description={error?.message ?? 'Try again in a moment.'}
        />
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              icon={Droplets}
              label="Avg soil moisture"
              value={data.readings.avg_soil_moisture}
              unit="%"
              decimals={1}
            />
            <StatTile
              icon={Thermometer}
              label="Avg temperature"
              value={data.readings.avg_temperature}
              unit="°C"
              decimals={1}
            />
            <StatTile
              icon={Activity}
              label="Readings"
              value={data.readings.reading_count}
            />
            <StatTile
              icon={Sprout}
              label="Yield estimate"
              value={data.yield?.value ?? null}
              unit={data.yield?.unit ?? 't/ha'}
              decimals={2}
            />
          </div>

          {data.empty && (
            <EmptyState
              icon={FileBarChart}
              title="Nothing recorded in this period yet"
              description="Once a device reports, or advice is generated, the charts below fill in."
            />
          )}

          {/* Trend: moisture + temperature over time */}
          {series.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Soil moisture &amp; temperature</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="moistureFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--green-600)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--green-600)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--line)" vertical={false} />
                        <XAxis dataKey="label" tick={axisTick} tickLine={false} minTickGap={24} />
                        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area
                          type="monotone"
                          name="Soil moisture (%)"
                          dataKey="soil_moisture"
                          stroke="var(--green-600)"
                          strokeWidth={2.5}
                          fill="url(#moistureFill)"
                        />
                        <Line
                          type="monotone"
                          name="Temperature (°C)"
                          dataKey="temperature"
                          stroke="var(--green-900)"
                          strokeWidth={2}
                          strokeDasharray="4 3"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rainfall &amp; humidity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid stroke="var(--line)" vertical={false} />
                        <XAxis dataKey="label" tick={axisTick} tickLine={false} minTickGap={24} />
                        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
                        <Tooltip cursor={{ fill: 'var(--green-50)' }} contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          name="Rainfall (mm)"
                          dataKey="rainfall"
                          fill="var(--green-600)"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          name="Humidity (%)"
                          dataKey="humidity"
                          fill="var(--green-300)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Distributions */}
          <div className="grid gap-6 lg:grid-cols-3">
            <SlicePie
              title="Time in each moisture band"
              hint="How often the soil sat dry, low, optimal or wet."
              slices={moisturePie}
            />
            <SlicePie
              title="Crop health scans"
              hint="Healthy vs. diseased leaf scans in this period."
              slices={healthPie}
            />

            <Card>
              <CardHeader>
                <CardTitle>Advice generated</CardTitle>
              </CardHeader>
              <CardContent>
                {advice.length === 0 ? (
                  <p className="py-12 text-center text-sm text-ink-500">No advice yet.</p>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={advice}
                        layout="vertical"
                        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid stroke="var(--line)" horizontal={false} />
                        <XAxis type="number" tick={axisTick} tickLine={false} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tick={axisTick}
                          tickLine={false}
                          axisLine={false}
                          width={80}
                        />
                        <Tooltip cursor={{ fill: 'var(--green-50)' }} contentStyle={tooltipStyle} />
                        <Bar dataKey="count" fill="var(--green-600)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Section comparison */}
          {perField.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Average soil moisture by section</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={perField} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="name" tick={axisTick} tickLine={false} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
                      <Tooltip cursor={{ fill: 'var(--green-50)' }} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        name="Avg soil moisture (%)"
                        dataKey="avg_soil_moisture"
                        fill="var(--green-600)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        name="Avg temperature (°C)"
                        dataKey="avg_temperature"
                        fill="var(--green-300)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* The numbers behind the charts */}
          <Card>
            <CardHeader>
              <CardTitle>{t('summary')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ['Sections', data.field_count],
                  ['Recommendations', data.recommendation_count],
                  ['Disease scans', data.disease_reports.total],
                  ['Diseased scans', data.disease_reports.unhealthy],
                  ['Avg humidity', fmt(data.readings.avg_humidity, '%')],
                  ['Lowest moisture', fmt(data.readings.min_soil_moisture, '%')],
                  ['Highest moisture', fmt(data.readings.max_soil_moisture, '%')],
                  ['Readings', data.readings.reading_count],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-tile bg-[var(--surface-muted)] p-4">
                    <dt className="text-xs text-ink-500">{label}</dt>
                    <dd className="tabular mt-1 text-xl font-bold text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-ink-500">
                Generated {new Date(data.generated_at).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function fmt(value: number | null, unit = ''): string {
  return typeof value === 'number' ? `${value}${unit}` : '—';
}

/** A labelled donut over {label,count} slices, with a graceful empty state. */
function SlicePie({
  title,
  hint,
  slices,
}: {
  title: string;
  hint: string;
  slices: ReportSlice[];
}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
            <Stethoscope className="size-6 text-ink-500" />
            <p className="text-sm text-ink-500">Nothing recorded yet.</p>
          </div>
        ) : (
          <>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="count"
                    nameKey="label"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {slices.map((slice, i) => (
                      <Cell key={slice.label} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name: string) => [
                      `${value} (${Math.round((value / total) * 100)}%)`,
                      titleCase(name),
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) => titleCase(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-ink-500">{hint}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
