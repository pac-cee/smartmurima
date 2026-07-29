'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { setUserLocale } from '@/i18n/locale';
import { locales, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export function LanguageToggle({ className }: { className?: string }) {
  const active = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (locale: Locale) => {
    if (locale === active) return;
    startTransition(async () => {
      await setUserLocale(locale);
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-pill border border-line bg-card p-0.5',
        pending && 'opacity-70',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => change(locale)}
          aria-pressed={active === locale}
          className={cn(
            'rounded-pill px-3 py-1 text-xs font-semibold uppercase transition-colors',
            active === locale
              ? 'bg-green-600 text-white'
              : 'text-ink-500 hover:text-ink-700',
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
