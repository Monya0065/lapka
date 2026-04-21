'use client';

import { useTranslation } from 'react-i18next';

export default function Notification({ title, text }) {
  const { t } = useTranslation();

  return (
    <article className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-lapka-900">{title || t('notification.defaultTitle')}</h4>
          <p className="mt-1 text-sm text-lapka-600">{text || t('notification.defaultText')}</p>
        </div>
        <span className="pill">{t('notification.new')}</span>
      </div>
    </article>
  );
}
