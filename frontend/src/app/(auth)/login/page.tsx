'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/hooks/useAuth';
import { loginInput, type LoginInput } from '@/lib/schemas';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInput) });

  const onSubmit = (values: LoginInput) => {
    login.mutate(values, {
      onSuccess: () => {
        toast.success(t('loginTitle'));
        router.push('/dashboard');
      },
      onError: () => toast.error('Sign in failed. Check your details and try again.'),
    });
  };

  return (
    <div className="animate-slide-up">
      <h2 className="text-2xl font-bold text-ink-900">{t('loginTitle')}</h2>
      <p className="mt-1 text-sm text-ink-500">{t('loginSubtitle')}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="identifier">{t('identifier')}</Label>
          <Input
            id="identifier"
            autoComplete="username"
            placeholder="you@example.rw"
            {...register('identifier')}
          />
          {errors.identifier && (
            <p className="text-xs text-ink-700">{errors.identifier.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t('password')}</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-green-700 hover:underline">
              {t('forgot')}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register('password')}
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('signIn')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-semibold text-green-700 hover:underline">
          {t('createOne')}
        </Link>
      </p>
      <p className="mt-4 rounded-control bg-green-50 p-3 text-center text-xs text-green-800">
        Sign in with your registered email or phone number and password.
      </p>
    </div>
  );
}
