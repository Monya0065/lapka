'use client';

import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  function setLanguage(next) {
    if (next === i18n.language) return;
    i18n.changeLanguage(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lapka_locale', next);
      localStorage.setItem('lapka_locale_explicit', '1');
      document.documentElement.lang = next;
    }
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-lapka-200 bg-white/90 p-1 shadow-sm"
      aria-label={t('language.ariaLabel')}
      title={i18n.language === 'ru' ? t('language.switchToEnglish') : t('language.switchToRussian')}
    >
      <button
        type="button"
        onClick={() => setLanguage('ru')}
        className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
          i18n.language === 'ru'
            ? 'bg-lapka-900 text-white'
            : 'text-lapka-600 hover:bg-lapka-100 hover:text-lapka-900'
        }`}
        aria-pressed={i18n.language === 'ru'}
      >
        RU
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
          i18n.language === 'en'
            ? 'bg-lapka-900 text-white'
            : 'text-lapka-600 hover:bg-lapka-100 hover:text-lapka-900'
        }`}
        aria-pressed={i18n.language === 'en'}
      >
        EN
      </button>
    </div>
  );
}
