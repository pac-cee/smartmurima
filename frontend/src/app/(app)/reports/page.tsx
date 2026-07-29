'use client';

import { useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Droplets, FileText, Sprout, Thermometer } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useSelection } from '@/components/selection-context';
import { ChartSkeleton, StatRowSkeleton } from '@/components/Skeletons';
import { StatTile } from '@/components/StatTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { reportExportUrl, useReportSummary } from '@/hooks/useReports';

const axisTick = { fill: 'var(--ink-500)', fontSize: 11 };

export default function ReportsPage() {
  const t = useTranslations('reports');
  const { farmId } = useSelection();
  const { data, isLoading } = useReportSummary(farmId ?? undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          farmId && (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={reportExportUrl('csv', farmId)} download>
                  <Download className="size-4" /> {t('exportCsv')}
                </a>
              </Button>
              <Button size="sm" asChild>
                <a href={reportExportUrl('pdf', farmId)} download>
                  <FileText className="size-4" /> {t('exportPdf')}
                </a>
              </Button>
            </>
          )
        }
      />

      {isLoading || !data ? (
        <>
          <StatRowSkeleton />
          <ChartSkeleton />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              icon={Droplets}
              label="Avg soil moisture"
              value={data.avg_soil_moisture}
              unit="%"
              decimals={1}
            />
            <StatTile
              icon={Thermometer}
              label="Avg temperature"
              value={data.avg_temperature}
              unit="°C"
              decimals={1}
            />
            <StatTile
              icon={Droplets}
              label="Total rainfall"
              value={data.total_rainfall}
              unit="mm"
              decimals={1}
            />
            <StatTile
              icon={Sprout}
              label="Yield estimate"
              value={data.yield_estimate}
              unit="t/ha"
              decimals={1}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Soil moisture &amp; temperature</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="date" tick={axisTick} tickLine={false} minTickGap={30} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid var(--line)',
                          background: 'var(--surface)',
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="soil_moisture"
                        stroke="var(--green-600)"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="temperature"
                        stroke="var(--green-800)"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rainfall</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="var(--line)" vertical={false} />
                      <XAxis dataKey="date" tick={axisTick} tickLine={false} minTickGap={30} />
                      <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
                      <Tooltip
                        cursor={{ fill: 'var(--green-50)' }}
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid var(--line)',
                          background: 'var(--surface)',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="rainfall" fill="var(--green-500)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('summary')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ['Recommendations', data.recommendations_count],
                  ['Disease scans', data.disease_scans],
                  ['Alerts', data.alerts_count],
                  ['Avg humidity', `${data.avg_humidity}%`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-tile bg-[var(--surface-muted)] p-4">
                    <dt className="text-xs text-ink-500">{label}</dt>
                    <dd className="tabular mt-1 text-xl font-bold text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
