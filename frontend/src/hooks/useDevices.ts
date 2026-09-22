'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { paginated, sensorNodeSchema, type PumpMode, type SensorNode } from '@/lib/schemas';

// Devices report every few seconds; poll often enough that the online dot and
// pump state track reality without the farmer hitting refresh.
const DEVICE_POLL_MS = 6_000;

/**
 * All devices this account can see.
 *
 * `claimed: false` is the discovery list -- boards that have announced
 * themselves to `POST /iot/announce/` but are not yet paired to a section.
 */
export function useDevices(opts: { claimed?: boolean; fieldId?: string } = {}) {
  const { claimed, fieldId } = opts;
  return useQuery({
    queryKey: ['nodes', { claimed: claimed ?? null, field: fieldId ?? null }],
    queryFn: () =>
      api.get('/sensor-nodes', paginated(sensorNodeSchema), {
        query: {
          claimed: claimed === undefined ? undefined : String(claimed),
          field: fieldId,
        },
      }),
    select: (d) => d.results,
    refetchInterval: DEVICE_POLL_MS,
  });
}

/** Everything that changes a device invalidates the same cache key. */
function useDeviceMutation<TVars>(
  fn: (vars: TVars) => Promise<SensorNode>,
) {
  const qc = useQueryClient();
  return useMutation<SensorNode, Error, TVars>({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['nodes'] });
      void qc.invalidateQueries({ queryKey: ['sensor-readings'] });
    },
  });
}

/** Pair a discovered board with one of my sections. Mints its token. */
export function useClaimDevice() {
  return useDeviceMutation<{ id: string; field: string }>(({ id, field }) =>
    api.post(`/sensor-nodes/${id}/claim`, { field }, sensorNodeSchema),
  );
}

/** Unpair a device: it drops back into discovery and its token is revoked. */
export function useReleaseDevice() {
  return useDeviceMutation<string>((id) =>
    api.post(`/sensor-nodes/${id}/release`, {}, sensorNodeSchema),
  );
}

/**
 * Set the irrigation override. The device picks this up in the command block
 * of its next telemetry response, so the change lands within one interval --
 * `pump_state` (what the pump is actually doing) catches up a moment later.
 */
export function usePumpControl() {
  return useDeviceMutation<{ id: string; pump_mode: PumpMode; pump_on?: boolean }>(
    ({ id, pump_mode, pump_on }) =>
      api.post(
        `/sensor-nodes/${id}/pump`,
        pump_mode === 'manual' ? { pump_mode, pump_on } : { pump_mode },
        sensorNodeSchema,
      ),
  );
}

/** Re-tune the dry/wet soil-moisture band the pump runs on. */
export function useThresholds() {
  return useDeviceMutation<{ id: string; dry_level: number; wet_level: number }>(
    ({ id, dry_level, wet_level }) =>
      api.post(`/sensor-nodes/${id}/thresholds`, { dry_level, wet_level }, sensorNodeSchema),
  );
}
