'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  paginated,
  recommendationSchema,
  type Recommendation,
  type RecommendationType,
} from '@/lib/schemas';

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

export function useRequestRecommendation() {
  const qc = useQueryClient();
  return useMutation<Recommendation, Error, { field: string; type: RecommendationType }>({
    mutationFn: ({ field, type }) =>
      api.post(`/recommendations/${type}`, { field }, recommendationSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });
}
