'use client';

import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { reportSummarySchema, weatherForecastSchema } from '@/lib/schemas';

export function useReportSummary(farmId: string | undefined, from?: string, to?: string) {
  return useQuery({
    queryKey: ['reports', 'summary', farmId, from, to],
    queryFn: () =>
      api.get('/reports/summary', reportSummarySchema, { query: { farm: farmId, from, to } }),
    enabled: Boolean(farmId),
  });
}

export function useWeatherForecast(farmId: string | undefined) {
  return useQuery({
    queryKey: ['weather', farmId],
    queryFn: () => api.get('/weather/forecast', weatherForecastSchema, { query: { farm: farmId } }),
    enabled: Boolean(farmId),
    staleTime: 30 * 60_000,
  });
}

/**
 * The export endpoint requires a JWT, so a plain `<a download>` (no auth header)
 * would 401. Fetch it through the api client — which attaches the bearer token
 * and handles a 401->refresh retry — then trigger a client-side download of the
 * returned Blob.
 */
export async function downloadReportExport(format: 'pdf' | 'csv', farmId: string) {
  const res = await api.raw('/reports/export', { query: { format, farm: farmId } });
  if (!res.ok) {
    throw new ApiError(res.status, `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `report-${farmId}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
