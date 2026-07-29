'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegister } from '@/hooks/useAuth';
import { registerInput, roleSchema, type RegisterInput, type Role } from '@/lib/schemas';

const roles = roleSchema.options;

export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale() as 'rw' | 'en';
  const router = useRouter();
  const signup = useRegister();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerInput),
    defaultValues: { role: 'farmer', language: locale },
  });

  const role = watch('role');

  const onSubmit = (values: RegisterInput) => {
    signup.mutate(values, {
      onSuccess: (data) => {
        const params = new URLSearchParams({
          identifier: data.identifier ?? values.phone_number ?? values.email,
          purpose: 'register',
        });
        // In development the backend returns the OTP (console SMS gateway) so we
        // can surface it on the verify screen instead of reading server logs.
        if (data.dev_code) params.set('dev_code', data.dev_code);
        router.push(`/verify-otp?${params.toString()}`);
      },
      onError: () => toast.error('Could not create your account. Try again.'),
    });
  };

  return (
    <div className="animate-slide-up">
      <h2 className="text-2xl font-bold text-ink-900">{t('registerTitle')}</h2>
      <p className="mt-1 text-sm text-ink-500">{t('registerSubtitle')}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="full_name">{t('fullName')}</Label>
          <Input id="full_name" autoComplete="name" {...register('full_name')} />
          {errors.full_name && <p className="text-xs text-ink-700">{errors.full_name.message}</p>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('email')}</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-xs text-ink-700">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone_number">{t('phone')}</Label>
            <Input id="phone_number" autoComplete="tel" placeholder="+250…" {...register('phone_number')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t('password')}</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          {errors.password && <p className="text-xs text-ink-700">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>{t('role')}</Label>
          <Select value={role} onValueChange={(v) => setValue('role', v as Role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`roles.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={signup.isPending}>
          {signup.isPending && <Loader2 className="size-4 animate-spin" />}
          {t('signUp')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-green-700 hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
