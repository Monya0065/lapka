'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import AuthDropdown from '@/components/auth/AuthDropdown';
import SmartCommandPalette from '@/components/ui/SmartCommandPalette';
import { getStoredSession } from '@/lib/auth';

function normalizeLinks(links = [], t) {
  const unique = new Map();
  links.forEach((item) => {
    const label = item?.labelKey ? t(item.labelKey) : item?.label;
    if (!item?.href || !label) return;
    if (!unique.has(item.href)) {
      unique.set(item.href, { href: item.href, label });
    }
  });
  return Array.from(unique.values());
}

export default function WorkspaceHeader({ links = [], primaryAction = null, contextControls = null, workspaceTitle = '' }) {
  const { t } = useTranslation();
  const session = getStoredSession();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const notificationsHref = session.role === 'owner'
    ? '/owner/inbox'
    : session.role === 'vet'
      ? '/vet/inbox'
      : session.role === 'network_admin'
        ? '/platform/inbox'
        : '/clinic/inbox';

  const normalizedLinks = useMemo(() => normalizeLinks(links, t), [links, t]);

  useEffect(() => {
    function onKeyDown(event) {
      const key = String(event.key || '').toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <header className="workspace-topbar">
        <div className="workspace-topbar-inner">
          <button type="button" className="workspace-search-trigger" onClick={() => setPaletteOpen(true)}>
            <span className="workspace-search-icon" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  d="M10.5 4a6.5 6.5 0 1 0 4.24 11.43l4.41 4.41 1.41-1.41-4.41-4.41A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="workspace-search-copy">
              <span className="workspace-search-title">{t('quickAccess.searchPlaceholderShort', { defaultValue: 'Поиск...' })}</span>
              <span className="workspace-search-description">
                {workspaceTitle
                  ? workspaceTitle
                  : session.role === 'owner'
                    ? 'Питомцы, лекарства, симптомы, документы и сервисы'
                    : session.role === 'vet'
                      ? 'Пациенты, визиты, лаборатория и клинические инструменты'
                      : session.role === 'network_admin'
                        ? 'Клиники, пользователи, AI и контроль платформы'
                        : 'Расписание, пациенты, финансы и контроль клиники'}
              </span>
            </span>
            <span className="workspace-search-shortcut">Ctrl/Cmd + K</span>
          </button>

          <div className="workspace-topbar-actions">
            {contextControls ? <div className="hidden xl:flex items-center gap-2">{contextControls}</div> : null}
            <Link
              href={notificationsHref}
              prefetch={false}
              className="workspace-utility-button"
              title={t('nav.notifications', { defaultValue: 'Уведомления' })}
              aria-label={t('nav.notifications', { defaultValue: 'Уведомления' })}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  d="M12 4a4 4 0 0 0-4 4v1.2c0 .78-.2 1.55-.58 2.24L6 14.5V16h12v-1.5l-1.42-3.06A5.2 5.2 0 0 1 16 9.2V8a4 4 0 0 0-4-4Zm0 16a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 20Z"
                  fill="currentColor"
                />
              </svg>
            </Link>
            <LanguageSwitcher />
            {primaryAction ? primaryAction : null}
            <AuthDropdown mode="menu" />
          </div>
        </div>
      </header>

      <SmartCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        links={normalizedLinks}
        role={session.role || 'owner'}
      />
    </>
  );
}
