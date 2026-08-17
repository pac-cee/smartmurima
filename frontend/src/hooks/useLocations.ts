'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { locationListSchema, type LocationLevel } from '@/lib/schemas';

/**
 * Cascading administrative locations (province -> district -> sector).
 * The endpoint is a public read, so we skip auth to avoid a spurious
 * token refresh / login redirect on unauthenticated screens (e.g. Register).
 *
 * A level below province is only fetched once its parent is chosen (or a
 * free-text search is supplied), which keeps the cascade tidy.
 */
export function useLocations(level: LocationLevel, parent?: string, search?: string) {
  const needsParent = level !== 'province';
  return useQuery({
    queryKey: ['locations', level, parent ?? null, search ?? ''],
    queryFn: () =>
      api.get('/locations', locationListSchema, {
        query: { level, parent, search },
        auth: false,
      }),
    enabled: !needsParent || Boolean(parent) || Boolean(search),
    staleTime: 60 * 60 * 1000,
  });
}
