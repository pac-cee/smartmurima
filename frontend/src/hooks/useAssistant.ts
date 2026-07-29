'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  chatMessageSchema,
  chatResponseSchema,
  chatSessionSchema,
  paginated,
  type ChatResponse,
} from '@/lib/schemas';

export function useSessions() {
  return useQuery({
    queryKey: ['assistant', 'sessions'],
    queryFn: () => api.get('/assistant/sessions', paginated(chatSessionSchema)),
    select: (d) => d.results,
  });
}

export function useSessionMessages(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['assistant', 'messages', sessionId],
    queryFn: () =>
      api.get(`/assistant/sessions/${sessionId}/messages`, paginated(chatMessageSchema)),
    select: (d) => d.results,
    enabled: Boolean(sessionId),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation<
    ChatResponse,
    Error,
    { question: string; language: 'rw' | 'en'; session?: string }
  >({
    mutationFn: (input) => api.post('/assistant/chat', input, chatResponseSchema),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['assistant', 'messages', vars.session] });
      void qc.invalidateQueries({ queryKey: ['assistant', 'sessions'] });
    },
  });
}
