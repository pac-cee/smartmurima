'use server';

import { cookies } from 'next/headers';
import { defaultLocale, LOCALE_COOKIE, locales, type Locale } from './config';

export async function getUserLocale(): Promise<Locale> {
  const stored = cookies().get(LOCALE_COOKIE)?.value;
  if (stored && locales.includes(stored as Locale)) {
    return stored as Locale;
  }
  return defaultLocale;
}

export async function setUserLocale(locale: Locale): Promise<void> {
  cookies().set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
