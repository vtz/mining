'use client';

import { useLocale as useNextIntlLocale, useTranslations } from 'next-intl';
import { locales, type Locale } from './config';

export { useTranslations };

export function useLocale(): Locale {
  return useNextIntlLocale() as Locale;
}

export function setLocale(locale: Locale) {
  // Set cookie with locale preference
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`; // 1 year
  // Reload to apply new locale
  window.location.reload();
}

export function getLocaleFromCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  
  const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
  if (match && locales.includes(match[1] as Locale)) {
    return match[1] as Locale;
  }
  return null;
}
