'use client';

const LEGAL_PATH_BY_ROLE = {
  owner: '/owner/legal',
  vet: '/vet/legal',
  clinic_admin: '/clinic/legal',
  network_admin: '/platform/legal',
};

function formatMissingDocuments(missingDocuments) {
  if (!Array.isArray(missingDocuments) || !missingDocuments.length) return '';
  return missingDocuments
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(', ');
}

export default function LegalAckBanner({ role, missingDocuments = [], onDismiss }) {
  const legalPath = LEGAL_PATH_BY_ROLE[role] || '/owner/legal';
  const missingText = formatMissingDocuments(missingDocuments);

  return (
    <div className="callout-warning !px-4 !py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Требуется подтверждение юридических документов</p>
          <p className="text-theme-muted">
            Доступ к части разделов ограничен, пока не подтверждены актуальные версии.
            {missingText ? ` Не подтверждено: ${missingText}.` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={legalPath} className="btn-secondary !min-h-[36px] !px-3 !py-1.5 text-xs">
            Открыть юрцентр
          </a>
          {onDismiss ? (
            <button type="button" onClick={onDismiss} className="btn-secondary !min-h-[36px] !px-3 !py-1.5 text-xs">
              Скрыть
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
