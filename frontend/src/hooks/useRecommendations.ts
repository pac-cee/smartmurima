'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  latestRecommendationsSchema,
  paginated,
  recommendationSchema,
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
// fertilizer, yield). There is no manual "request" trigger anymore — advice is
// produced automatically and simply re-fetched here.
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
