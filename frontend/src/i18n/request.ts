import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { locales, defaultLocale, type Locale } from './config';

export default getRequestConfig(async () => {
  // Try to get locale from cookie first
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value;
  
  let locale: Locale = defaultLocale;
  
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale;
  } else {
    // Fall back to Accept-Language header
    const headerStore = await headers();
    const acceptLanguage = headerStore.get('accept-language');
    
    if (acceptLanguage) {
      // Parse Accept-Language header and find best match
      const browserLocales = acceptLanguage
        .split(',')
        .map(lang => lang.split(';')[0].trim());
      
      for (const browserLocale of browserLocales) {
        // Check for exact match
        if (locales.includes(browserLocale as Locale)) {
          locale = browserLocale as Locale;
          break;
        }
        // Check for language-only match (e.g., 'pt' matches 'pt-BR')
        const langOnly = browserLocale.split('-')[0];
        const match = locales.find(l => l.startsWith(langOnly));
        if (match) {
          locale = match;
          break;
        }
      }
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
