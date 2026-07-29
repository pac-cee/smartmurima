'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  cropSchema,
  fieldSchema,
  paginated,
  sensorNodeSchema,
  type Field,
  type FieldInput,
} from '@/lib/schemas';

export function useFields(farmId?: string) {
  return useQuery({
    queryKey: ['fields', { farm: farmId ?? null }],
    queryFn: () => api.get('/fields', paginated(fieldSchema), { query: { farm: farmId } }),
    select: (d) => d.results,
  });
}

export function useField(id: string | undefined) {
  return useQuery({
    queryKey: ['fields', id],
    queryFn: () => api.get(`/fields/${id}`, fieldSchema),
    enabled: Boolean(id),
  });
}

export function useCreateField() {
  const qc = useQueryClient();
  return useMutation<Field, Error, FieldInput>({
    mutationFn: (input) => api.post('/fields', input, fieldSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fields'] }),
  });
}

export function useCrops() {
  return useQuery({
    queryKey: ['crops'],
    queryFn: () => api.get('/crops', paginated(cropSchema)),
    select: (d) => d.results,
    staleTime: Infinity,
  });
}

export function useNodes(fieldId?: string) {
  return useQuery({
    queryKey: ['nodes', { field: fieldId ?? null }],
    queryFn: () => api.get('/sensor-nodes', paginated(sensorNodeSchema), { query: { field: fieldId } }),
    select: (d) => d.results,
  });
}
