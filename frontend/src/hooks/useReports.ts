'use client';

import { useQuery } from '@tanstack/react-query';
import { api, API_URL } from '@/lib/api';
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

export function reportExportUrl(format: 'pdf' | 'csv', farmId: string) {
  return `${API_URL}/reports/export?format=${format}&farm=${farmId}`;
}
