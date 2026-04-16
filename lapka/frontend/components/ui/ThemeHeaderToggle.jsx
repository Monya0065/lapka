'use client';

import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/providers/ThemeProvider';

export default function ThemeHeaderToggle() {
  const { t } = useTranslation();
  const [theme, setTheme] = useTheme();

  function cycle() {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  }

  const label = theme === 'light' ? t('theme.light') : theme === 'dark' ? t('theme.dark') : t('theme.system');
  const icon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️';

  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex h-12 max-w-[11rem] shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-theme-muted shadow-soft transition hover:border-border-hover hover:bg-surface-muted hover:text-theme sm:min-w-[7.25rem]"
      title={t('theme.ariaCycle')}
      aria-label={t('theme.ariaCycle')}
      data-testid="theme-header-toggle"
    >
      <span className="text-base leading-none" aria-hidden>
        {icon}
      </span>
      <span className="hidden text-xs font-semibold sm:inline">{label}</span>
    </button>
  );
}
