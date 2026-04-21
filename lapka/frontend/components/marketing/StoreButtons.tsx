'use client';

import { useTranslation } from 'react-i18next';

const STORE_LINKS = [
  {
    id: 'ios',
    label: 'App Store',
    subtitle: { ru: 'iPhone и iPad', en: 'iPhone / iPad' },
    href: 'https://www.apple.com/app-store/',
  },
  {
    id: 'android',
    label: 'Google Play',
    subtitle: { ru: 'Android', en: 'Android' },
    href: 'https://play.google.com/store/apps',
  },
];

export default function StoreButtons({ compact = false, className = '' }) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'en';

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {STORE_LINKS.map((item) => (
        <a
          key={item.id}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className={`rounded-2xl border border-lapka-200 bg-white text-lapka-900 shadow-sm transition hover:-translate-y-0.5 hover:border-lapka-300 hover:shadow-soft ${
            compact ? 'px-4 py-3' : 'px-5 py-4'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center justify-center rounded-2xl bg-lapka-gradient text-white ${
                compact ? 'h-10 w-10 text-lg' : 'h-12 w-12 text-xl'
              }`}
              aria-hidden
            >
              {item.id === 'ios' ? '' : '▶'}
            </span>
            <div>
              <p className={`font-black leading-none ${compact ? 'text-base' : 'text-lg'}`}>{item.label}</p>
              <p className={`mt-1 text-lapka-600 ${compact ? 'text-xs' : 'text-sm'}`}>{item.subtitle[lang]}</p>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
