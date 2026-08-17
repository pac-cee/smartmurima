'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LocationPicker } from '@/components/LocationPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegister } from '@/hooks/useAuth';
import { registerInput, type RegisterInput } from '@/lib/schemas';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const tl = useTranslations('location');
  const locale = useLocale() as 'rw' | 'en';
  const router = useRouter();
  const signup = useRegister();
  const [location, setLocation] = useState<string | undefined>(undefined);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerInput),
    defaultValues: { language: locale },
  });

  const onSubmit = (values: RegisterInput) => {
    // Send only the fields the user actually filled in. Blank email/phone are
    // omitted so the backend doesn't reject an empty string.
    const payload: RegisterInput = {
      full_name: values.full_name,
      password: values.password,
      language: values.language ?? locale,
      ...(values.email ? { email: values.email } : {}),
      ...(values.phone_number ? { phone_number: values.phone_number } : {}),
      ...(location ? { location } : {}),
    };
    signup.mutate(payload, {
      // Registration returns { user, tokens } and the hook stores the session,
      // so we go straight to the dashboard — there is no OTP step.
      onSuccess: () => router.push('/dashboard'),
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
            {errors.phone_number && (
              <p className="text-xs text-ink-700">{errors.phone_number.message}</p>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t('password')}</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          {errors.password && <p className="text-xs text-ink-700">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>
            {tl('label')} <span className="text-ink-500">({tc('optional')})</span>
          </Label>
          <LocationPicker value={location} onChange={setLocation} />
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
