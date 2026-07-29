'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { OtpInput } from '@/components/OtpInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmReset, useRequestReset, useResendOtp } from '@/hooks/useAuth';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const request = useRequestReset();
  const confirm = useConfirmReset();
  const resend = useResendOtp();

  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const sendCode = () => {
    if (!identifier) return;
    request.mutate(identifier, {
      onSuccess: (data) => {
        setStep('confirm');
        setSeconds(30);
        // Dev console gateway returns the OTP so we can prefill it.
        if (data.dev_code) setCode(data.dev_code);
        toast.success('Reset code sent');
      },
      onError: () => toast.error('Could not send a code. Check your details.'),
    });
  };

  const setNewPassword = () => {
    if (code.length !== 6 || password.length < 8) return;
    confirm.mutate(
      { identifier, code, new_password: password },
      {
        onSuccess: () => {
          toast.success('Password updated. Sign in with your new password.');
          router.push('/login');
        },
        onError: () => toast.error('Could not reset password. Check the code.'),
      },
    );
  };

  return (
    <div className="animate-slide-up">
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700"
      >
        <ArrowLeft className="size-4" /> {tc('back')}
      </Link>
      <h2 className="text-2xl font-bold text-ink-900">{t('resetTitle')}</h2>
      <p className="mt-1 text-sm text-ink-500">{t('resetSubtitle')}</p>

      {step === 'request' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
          className="mt-8 space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="identifier">{t('identifier')}</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.rw"
              autoComplete="username"
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={request.isPending || !identifier}>
            {request.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('sendCode')}
          </Button>
        </form>
      ) : (
        <div className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label>{t('otpTitle')}</Label>
            <OtpInput value={code} onChange={setCode} autoFocus />
            {request.data?.dev_code && (
              <p className="rounded-control bg-green-50 p-2 text-center text-xs text-green-800">
                Dev mode: your reset code is{' '}
                <span className="tabular font-bold tracking-widest">{request.data.dev_code}</span>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new_password">{t('newPassword')}</Label>
            <Input
              id="new_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <Button
            onClick={setNewPassword}
            size="lg"
            className="w-full"
            disabled={confirm.isPending || code.length !== 6 || password.length < 8}
          >
            {confirm.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('setPassword')}
          </Button>
          <div className="text-center text-sm">
            {seconds > 0 ? (
              <span className="tabular text-ink-500">{t('resendIn', { seconds })}</span>
            ) : (
              <button
                className="font-semibold text-green-700 hover:underline"
                onClick={() =>
                  resend.mutate(
                    { identifier, purpose: 'reset' },
                    {
                      onSuccess: () => {
                        toast.success(t('resent'));
                        setSeconds(30);
                      },
                    },
                  )
                }
              >
                {t('resend')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
