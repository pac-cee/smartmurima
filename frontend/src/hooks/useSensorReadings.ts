'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { latestReadingSchema, paginated, sensorReadingSchema } from '@/lib/schemas';

export type Aggregation = 'hourly' | 'daily';

// Poll fast enough that simulator/ESP32 telemetry (published every ~5-60s)
// shows up on the dashboards without a manual refresh.
const LIVE_POLL_MS = 8_000;

export function useSensorReadings(fieldId: string | undefined, agg: Aggregation = 'hourly') {
  return useQuery({
    queryKey: ['sensor-readings', fieldId, agg],
    queryFn: () =>
      api.get('/sensor-readings', paginated(sensorReadingSchema), {
        query: { field: fieldId, agg },
      }),
    select: (d) => d.results,
    enabled: Boolean(fieldId),
    refetchInterval: LIVE_POLL_MS,
  });
}

export function useLatestReading(fieldId: string | undefined) {
  return useQuery({
    queryKey: ['sensor-readings', 'latest', fieldId],
    queryFn: () =>
      api.get('/sensor-readings/latest', latestReadingSchema, { query: { field: fieldId } }),
    enabled: Boolean(fieldId),
    refetchInterval: LIVE_POLL_MS,
  });
}
