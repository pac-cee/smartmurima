'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { farmSchema, paginated, type Farm, type FarmInput } from '@/lib/schemas';

export function useFarms() {
  return useQuery({
    queryKey: ['farms'],
    queryFn: () => api.get('/farms', paginated(farmSchema)),
    select: (d) => d.results,
  });
}

export function useFarm(id: string | undefined) {
  return useQuery({
    queryKey: ['farms', id],
    queryFn: () => api.get(`/farms/${id}`, farmSchema),
    enabled: Boolean(id),
  });
}

export function useCreateFarm() {
  const qc = useQueryClient();
  return useMutation<Farm, Error, FarmInput>({
    mutationFn: (input) => api.post('/farms', input, farmSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farms'] }),
  });
}

export function useDeleteFarm() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete(`/farms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farms'] }),
  });
}
