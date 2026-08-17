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
  type NodeStatus,
  type SensorNode,
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

export function useUpdateField() {
  const qc = useQueryClient();
  return useMutation<Field, Error, { id: string; input: Partial<FieldInput> }>({
    mutationFn: ({ id, input }) => api.patch(`/fields/${id}`, input, fieldSchema),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['fields'] });
      void qc.invalidateQueries({ queryKey: ['fields', id] });
    },
  });
}

export function useDeleteField() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete(`/fields/${id}`),
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

export function useCreateNode() {
  const qc = useQueryClient();
  return useMutation<
    SensorNode,
    Error,
    { field: string; device_id: string; status?: NodeStatus; battery?: number }
  >({
    mutationFn: (input) => api.post('/sensor-nodes', input, sensorNodeSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
  });
}

export function useUpdateNode() {
  const qc = useQueryClient();
  return useMutation<
    SensorNode,
    Error,
    { id: string; input: Partial<{ status: NodeStatus; device_id: string; battery: number }> }
  >({
    mutationFn: ({ id, input }) => api.patch(`/sensor-nodes/${id}`, input, sensorNodeSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
  });
}

export function useDeleteNode() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete(`/sensor-nodes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
  });
}
