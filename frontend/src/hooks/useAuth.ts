'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useSyncExternalStore } from 'react';
import { api } from '@/lib/api';
import {
  authResultSchema,
  resetChallengeSchema,
  userSchema,
  type AuthResult,
  type ChangePasswordInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type RegisterInput,
  type ResetChallenge,
  type User,
} from '@/lib/schemas';
import { tokenStore } from '@/lib/token-store';

/**
 * The password-reset endpoint accepts either `email` (validated as an email)
 * or `phone_number`. Sending a phone number in the `email` field would fail
 * validation, so route the identifier to the correct field.
 */
function identifierBody(identifier: string): { email: string } | { phone_number: string } {
  return identifier.includes('@') ? { email: identifier } : { phone_number: identifier };
}

export function useSession() {
  const user = useSyncExternalStore(
    tokenStore.subscribe,
    () => tokenStore.getUser(),
    () => null,
  );
  const isAuthenticated = useSyncExternalStore(
    tokenStore.subscribe,
    () => tokenStore.isAuthenticated(),
    () => false,
  );
  return { user, isAuthenticated };
}

/**
 * The authoritative current user, re-read from the API.
 *
 * `useSession()` returns whatever was cached at sign-in, which goes stale the
 * moment anything changes the account elsewhere (an admin edit, a second tab).
 * Screens that *edit* the profile should read this and let it refresh the
 * cached session, so they never render a stale value.
 */
export function useMe() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await api.get('/auth/me', userSchema);
      tokenStore.setUser(user);
      return user;
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

export function useLogin() {
  return useMutation<AuthResult, Error, LoginInput>({
    mutationFn: (input) => api.post('/auth/login', input, authResultSchema, { auth: false }),
    onSuccess: (data) => {
      tokenStore.setSession(data.tokens.access, data.tokens.refresh, data.user);
    },
  });
}

// Sign-up is one step: `POST /auth/register` returns the same { user, tokens }
// shape as login, so the session is established right here and the caller can
// go straight to the dashboard. There is no verification screen.
export function useRegister() {
  return useMutation<AuthResult, Error, RegisterInput>({
    mutationFn: (input) => api.post('/auth/register', input, authResultSchema, { auth: false }),
    onSuccess: (data) => {
      tokenStore.setSession(data.tokens.access, data.tokens.refresh, data.user);
    },
  });
}

export function useRequestReset() {
  return useMutation<ResetChallenge, Error, string>({
    mutationFn: (identifier) =>
      api.post(
        '/auth/password/reset/request',
        identifierBody(identifier),
        resetChallengeSchema,
        { auth: false },
      ),
  });
}

export function useConfirmReset() {
  return useMutation({
    mutationFn: (input: PasswordResetConfirmInput) =>
      api.post('/auth/password/reset/confirm', input, undefined, { auth: false }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation<User, Error, Partial<User>>({
    mutationFn: (patch) => api.patch('/auth/me', patch, userSchema),
    onSuccess: (user) => {
      tokenStore.setUser(user);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useChangePassword() {
  return useMutation<unknown, Error, ChangePasswordInput>({
    mutationFn: (input) => api.post('/auth/password/change', input),
  });
}

export function useLogout() {
  const router = useRouter();
  const qc = useQueryClient();
  return useCallback(() => {
    tokenStore.clear();
    qc.clear();
    router.push('/login');
  }, [qc, router]);
}
