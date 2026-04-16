'use client';

import { useMemo } from 'react';

const PRIVACY_DOC_PATHS = {
  owner: '/owner/legal',
  vet: '/vet/legal',
  clinic_admin: '/clinic/legal',
  network_admin: '/platform/legal',
};

export default function PrivacySecurityBanner({ role, onDismiss }) {
  const legalPath = useMemo(() => PRIVACY_DOC_PATHS[role] || '/owner/legal', [role]);

  return (
    <div className="rounded-xl border border-border-hover bg-surface-highlight px-4 py-3 text-sm text-theme">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Конфиденциальность и безопасность</p>
          <p className="text-theme">
            Проверяйте версии юридических документов и настройки доступа в профиле. Это не блокирует навигацию.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={legalPath} className="btn-secondary !min-h-[36px] !px-3 !py-1.5 text-xs">
            Юрцентр
          </a>
          {onDismiss ? (
            <button type="button" className="btn-secondary !min-h-[36px] !px-3 !py-1.5 text-xs" onClick={onDismiss}>
              Скрыть
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
