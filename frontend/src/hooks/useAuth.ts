'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useSyncExternalStore } from 'react';
import { api } from '@/lib/api';
import {
  authResultSchema,
  otpChallengeSchema,
  userSchema,
  type AuthResult,
  type LoginInput,
  type OtpChallenge,
  type OtpVerifyInput,
  type PasswordResetConfirmInput,
  type RegisterInput,
  type User,
} from '@/lib/schemas';
import { tokenStore } from '@/lib/token-store';

/**
 * The OTP endpoints accept either `email` (validated as an email) or
 * `phone_number`. Sending a phone number in the `email` field would fail
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

export function useLogin() {
  return useMutation<AuthResult, Error, LoginInput>({
    mutationFn: (input) => api.post('/auth/login', input, authResultSchema, { auth: false }),
    onSuccess: (data) => {
      tokenStore.setSession(data.tokens.access, data.tokens.refresh, data.user);
    },
  });
}

export function useRegister() {
  return useMutation<OtpChallenge, Error, RegisterInput>({
    mutationFn: (input) => api.post('/auth/register', input, otpChallengeSchema, { auth: false }),
  });
}

export function useVerifyOtp() {
  return useMutation<AuthResult, Error, OtpVerifyInput>({
    mutationFn: ({ identifier, code }) =>
      api.post(
        '/auth/otp/verify',
        { ...identifierBody(identifier), code },
        authResultSchema,
        { auth: false },
      ),
    onSuccess: (data) => {
      tokenStore.setSession(data.tokens.access, data.tokens.refresh, data.user);
    },
  });
}

export function useResendOtp() {
  return useMutation<OtpChallenge, Error, { identifier: string; purpose: 'register' | 'login' | 'reset' }>({
    mutationFn: (input) =>
      api.post(
        '/auth/otp/resend',
        { ...identifierBody(input.identifier), purpose: input.purpose },
        otpChallengeSchema,
        { auth: false },
      ),
  });
}

export function useRequestReset() {
  return useMutation<OtpChallenge, Error, string>({
    mutationFn: (identifier) =>
      api.post(
        '/auth/password/reset/request',
        identifierBody(identifier),
        otpChallengeSchema,
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

export function useLogout() {
  const router = useRouter();
  const qc = useQueryClient();
  return useCallback(() => {
    tokenStore.clear();
    qc.clear();
    router.push('/login');
  }, [qc, router]);
}
