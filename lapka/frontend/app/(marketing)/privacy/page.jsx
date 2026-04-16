import MarketingPage from '@/components/blocks/MarketingPage';

export default function PrivacyPage() {
  return (
    <MarketingPage
      eyebrow={{ ru: 'Конфиденциальность данных', en: 'Data privacy' }}
      title={{ ru: 'Политика конфиденциальности', en: 'Privacy policy' }}
      subtitle={{ ru: 'Мы обрабатываем только необходимые данные, применяем разграничение прав и ведём аудит доступа к медицинской информации.', en: 'We process only required data, enforce role boundaries, and keep audit trails for medical access.' }}
      bullets={[
        { ru: 'Минимизация данных: только необходимые поля для сценария', en: 'Data minimization: only required fields for each flow' },
        { ru: 'Ролевой доступ и согласие владельца перед просмотром медицинских разделов', en: 'Role-based access and owner consent before medical record view' },
        { ru: 'Журнал ключевых действий для расследования инцидентов', en: 'Key action logs for incident investigation' },
        { ru: 'Запрос на удаление/экспорт данных через privacy@lapka.local', en: 'Request deletion/export via privacy@lapka.local' },
      ]}
      ctaHref="/terms"
      ctaLabel={{ ru: 'Пользовательское соглашение', en: 'Terms of use' }}
      sideImage="/assets/img/security-side.svg"
      cards={[
        { title: { ru: 'Хранение', en: 'Storage' }, subtitle: { ru: 'Шифрование, сроки хранения и контроль доступа по ролям.', en: 'Encryption, retention windows, and role-based access control.' } },
        { title: { ru: 'Передача', en: 'Transfer' }, subtitle: { ru: 'Обмен данными только в рамках продуктовых сценариев и согласия.', en: 'Data exchange only within product flows and explicit consent.' } },
        { title: { ru: 'Права пользователя', en: 'User rights' }, subtitle: { ru: 'Доступ, исправление, экспорт и удаление персональных данных.', en: 'Access, correction, export, and deletion of personal data.' } },
      ]}
    />
  );
}

