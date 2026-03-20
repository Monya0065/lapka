'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';

export default function I18nProvider({ children }) {
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('lapka_locale') : null;
    const explicit = typeof window !== 'undefined' ? localStorage.getItem('lapka_locale_explicit') : null;
    let nextLang = 'ru';

    if (explicit && (saved === 'ru' || saved === 'en')) {
      nextLang = saved;
    }

    if (nextLang !== i18n.language) {
      i18n.changeLanguage(nextLang);
    }
    document.documentElement.lang = nextLang;
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
