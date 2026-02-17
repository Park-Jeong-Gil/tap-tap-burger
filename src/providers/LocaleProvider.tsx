'use client';

import { createContext, useContext } from 'react';
import { translations, type Locale, type Translations } from '@/lib/translations';

interface LocaleContextValue {
  locale: Locale;
  t: Translations;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  t: translations.en,
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, t: translations[locale] as Translations }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
