'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { alertSchema, paginated } from '@/lib/schemas';

export function useAlerts(unreadOnly = false) {
  return useQuery({
    queryKey: ['alerts', { unread: unreadOnly }],
    queryFn: () =>
      api.get('/alerts', paginated(alertSchema), {
        query: { unread: unreadOnly ? 'true' : undefined },
      }),
    select: (d) => d.results,
    refetchInterval: 60_000,
  });
}

export function useUnreadCount() {
  const { data } = useAlerts(true);
  return data?.length ?? 0;
}

export function useMarkAlertRead() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => api.post(`/alerts/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
