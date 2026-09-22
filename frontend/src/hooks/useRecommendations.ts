'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  latestRecommendationsSchema,
  paginated,
  recommendationSchema,
  type Recommendation,
  type RecommendationType,
} from '@/lib/schemas';

// History feed (all past auto-generated recommendations). Kept for reference
// views; the primary surface is now the latest auto bundle below.
export function useRecommendations(filters?: { field?: string; type?: RecommendationType }) {
  return useQuery({
    queryKey: ['recommendations', filters ?? {}],
    queryFn: () =>
      api.get('/recommendations', paginated(recommendationSchema), {
        query: { field: filters?.field, type: filters?.type },
      }),
    select: (d) => d.results,
  });
}

// Latest auto-generated advice bundle for a single field (irrigation,
// fertilizer, yield). Advice is produced automatically; `useRunAdvice` below
// lets the farmer force a fresh run against the newest telemetry.
export function useLatestRecommendations(fieldId?: string) {
  return useQuery({
    queryKey: ['recommendations', 'latest', fieldId ?? null],
    queryFn: () =>
      api.get('/recommendations/latest', latestRecommendationsSchema, {
        query: { field: fieldId },
      }),
    enabled: Boolean(fieldId),
  });
}

// Endpoint per advice type. Each POST runs the corresponding model against the
// field's current readings and stores a new Recommendation row.
const ADVICE_ENDPOINT: Record<RecommendationType, string> = {
  irrigation: '/recommendations/irrigation',
  fertilizer: '/recommendations/fertilizer',
  yield: '/recommendations/yield',
};

/**
 * Re-run the models for a field right now.
 *
 * `type` omitted runs all three. Any that fail are reported, but one model
 * failing never discards the advice the others produced.
 */
export function useRunAdvice() {
  const qc = useQueryClient();
  return useMutation<Recommendation[], Error, { field: string; type?: RecommendationType }>({
    mutationFn: async ({ field, type }) => {
      const types: RecommendationType[] = type ? [type] : ['irrigation', 'fertilizer', 'yield'];
      const results = await Promise.allSettled(
        types.map((t) => api.post(ADVICE_ENDPOINT[t], { field }, recommendationSchema)),
      );
      const produced = results
        .filter((r): r is PromiseFulfilledResult<Recommendation> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (produced.length === 0) {
        const firstError = results.find((r) => r.status === 'rejected');
        throw firstError && firstError.status === 'rejected'
          ? (firstError.reason as Error)
          : new Error('Could not generate advice.');
      }
      return produced;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}
