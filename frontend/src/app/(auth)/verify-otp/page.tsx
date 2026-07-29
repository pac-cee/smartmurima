'use client';

import { Suspense, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { OtpInput } from '@/components/OtpInput';
import { Button } from '@/components/ui/button';
import { useResendOtp, useVerifyOtp } from '@/hooks/useAuth';

const RESEND_SECONDS = 30;

function VerifyOtpInner() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useSearchParams();
  const identifier = params.get('identifier') ?? '';
  const purpose = (params.get('purpose') ?? 'register') as 'register' | 'login' | 'reset';
  // Development only: the backend's console SMS gateway returns the OTP so we can
  // show it here instead of digging through server logs.
  const devCode = params.get('dev_code') ?? '';

  const verify = useVerifyOtp();
  const resend = useResendOtp();
  const [code, setCode] = useState(devCode);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const submit = () => {
    if (code.length !== 6) return;
    verify.mutate(
      { identifier, code },
      {
        onSuccess: () => {
          toast.success('Verified');
          router.push('/dashboard');
        },
        onError: () => toast.error('That code did not match. Try again.'),
      },
    );
  };

  useEffect(() => {
    if (code.length === 6) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="animate-slide-up">
      <Link
        href={purpose === 'register' ? '/register' : '/login'}
        className="mb-6 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700"
      >
        <ArrowLeft className="size-4" /> {tc('back')}
      </Link>
      <h2 className="text-2xl font-bold text-ink-900">{t('otpTitle')}</h2>
      <p className="mt-1 text-sm text-ink-500">
        {t('otpSubtitle', { target: identifier || 'your device' })}
      </p>

      <div className="mt-8">
        <OtpInput value={code} onChange={setCode} disabled={verify.isPending} autoFocus />
      </div>

      <Button
        onClick={submit}
        size="lg"
        className="mt-6 w-full"
        disabled={code.length !== 6 || verify.isPending}
      >
        {verify.isPending && <Loader2 className="size-4 animate-spin" />}
        {t('verify')}
      </Button>

      <div className="mt-6 text-center text-sm">
        {seconds > 0 ? (
          <span className="text-ink-500 tabular">{t('resendIn', { seconds })}</span>
        ) : (
          <button
            className="font-semibold text-green-700 hover:underline"
            onClick={() =>
              resend.mutate(
                { identifier, purpose },
                {
                  onSuccess: () => {
                    toast.success(t('resent'));
                    setSeconds(RESEND_SECONDS);
                  },
                },
              )
            }
          >
            {t('resend')}
          </button>
        )}
      </div>
      {devCode && (
        <p className="mt-6 rounded-control bg-green-50 p-3 text-center text-xs text-green-800">
          Dev mode: your verification code is{' '}
          <span className="tabular font-bold tracking-widest">{devCode}</span>
        </p>
      )}
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpInner />
    </Suspense>
  );
}
