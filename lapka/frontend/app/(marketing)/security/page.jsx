import MarketingPage from '@/components/blocks/MarketingPage';

export default function SecurityPage() {
  return (
    <MarketingPage
      eyebrow={{ ru: 'Безопасность и приватность', en: 'Security and privacy' }}
      title={{ ru: 'Безопасность данных в центре платформы', en: 'Data security at the core of the platform' }}
      subtitle={{
        ru: 'Доступ к медкарте строится на RBAC и согласии владельца, все ключевые действия фиксируются в аудит-журнале.',
        en: 'Medical record access is based on RBAC and owner consent, while key actions are recorded in the audit log.',
      }}
      bullets={[
        { ru: 'RBAC: владелец / врач / администратор клиники', en: 'RBAC: owner / veterinarian / clinic admin' },
        { ru: 'Уровни согласия: назначения / базовая карта / полная карта / стационар / камеры', en: 'Consent scopes: prescriptions / basic record / full record / inpatient / cameras' },
        { ru: 'Журнал действий: просмотры карты, документов и камер', en: 'Action log: record, document, and camera views' },
        { ru: 'Публичные ссылки: срок действия, отзыв и noindex', en: 'Public links: expiration, revocation, and noindex protection' },
      ]}
      ctaHref="/faq"
      ctaLabel={{ ru: 'Прочитать FAQ', en: 'Read FAQ' }}
      sideImage="/assets/img/security-side.svg"
      cards={[
        { title: 'AI safety', subtitle: { ru: 'Без дозировок и назначения лечения владельцу.', en: 'No dosage or treatment instructions for owners.' } },
        { title: { ru: 'Публичные ссылки', en: 'Public links' }, subtitle: { ru: 'Публичный доступ только по безопасному токену и сроку действия.', en: 'Public access only via secure token with expiration.' } },
        { title: { ru: 'Приватность камер', en: 'Camera privacy' }, subtitle: { ru: 'Доступ к камерам только для владельца и только при активном стационаре.', en: 'Camera access is owner-only and available only during active inpatient stay.' } },
      ]}
    />
  );
}
