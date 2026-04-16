'use client';

const LEGAL_PATH_BY_ROLE = {
  owner: '/owner/legal',
  vet: '/vet/legal',
  clinic_admin: '/clinic/legal',
  network_admin: '/platform/legal',
};

export default function PolicyNoticeBanner({ role, kind = 'forbidden', missingDocuments = [], message = '', onDismiss }) {
  const legalPath = LEGAL_PATH_BY_ROLE[role] || '/owner/legal';
  const missing = Array.isArray(missingDocuments) ? missingDocuments.filter(Boolean) : [];
  const missingText = missing.length ? ` Не подтверждено: ${missing.join(', ')}.` : '';

  const content = kind === 'legal'
    ? {
        title: 'Требуется подтверждение юридических документов',
        body: `Некоторые разделы временно ограничены до подтверждения актуальных версий.${missingText}`,
        panelClass: 'callout-warning',
      }
    : {
        title: 'Ограничение доступа по политике безопасности',
        body: message || 'Для этого действия не хватает прав роли или согласия владельца на доступ к данным.',
        panelClass: 'callout-danger',
      };

  return (
    <div className={`${content.panelClass} !px-4 !py-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{content.title}</p>
          <p>{content.body}</p>
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
