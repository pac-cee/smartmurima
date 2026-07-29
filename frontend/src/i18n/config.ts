export const locales = ['rw', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'rw';
export const LOCALE_COOKIE = 'sm_locale';

export const localeNames: Record<Locale, string> = {
  rw: 'Kinyarwanda',
  en: 'English',
};
