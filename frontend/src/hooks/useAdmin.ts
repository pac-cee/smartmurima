'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { knowledgeDocSchema, paginated, sensorNodeSchema, userSchema } from '@/lib/schemas';

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get('/admin-api/users', paginated(userSchema)),
    select: (d) => d.results,
  });
}

export function useAdminNodes() {
  return useQuery({
    queryKey: ['admin', 'nodes'],
    queryFn: () => api.get('/admin-api/sensor-nodes', paginated(sensorNodeSchema)),
    select: (d) => d.results,
  });
}

export function useKnowledgeDocs() {
  return useQuery({
    queryKey: ['admin', 'documents'],
    queryFn: () => api.get('/admin-api/documents', paginated(knowledgeDocSchema)),
    select: (d) => d.results,
  });
}
