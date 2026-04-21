import MarketingPage from '@/components/blocks/MarketingPage';

export default function TermsPage() {
  return (
    <MarketingPage
      eyebrow={{ ru: 'Юридические условия', en: 'Legal terms' }}
      title={{ ru: 'Пользовательское соглашение', en: 'Terms of use' }}
      subtitle={{ ru: 'Условия использования платформы Лапка для владельцев, врачей и клиник с отдельным фокусом на безопасность и ограничения AI.', en: 'Terms for using Lapka by owners, veterinarians, and clinics with focus on security and AI limits.' }}
      bullets={[
        { ru: 'Платформа не заменяет очную консультацию ветеринарного врача', en: 'Platform does not replace in-person veterinary consultation' },
        { ru: 'AI не выдаёт назначения и дозировки владельцу', en: 'AI does not provide treatment or dosage to owners' },
        { ru: 'Доступ к данным ограничен ролью, клиникой и активным согласием', en: 'Data access is limited by role, clinic, and active consent' },
        { ru: 'Нарушения условий могут приводить к ограничению доступа', en: 'Terms violations may lead to access restriction' },
      ]}
      ctaHref="/security"
      ctaLabel={{ ru: 'Раздел безопасности', en: 'Security section' }}
      sideImage="/assets/img/hero-family.svg"
      cards={[
        { title: { ru: 'Ответственность', en: 'Responsibility' }, subtitle: { ru: 'Медицинские решения принимаются только врачом.', en: 'Medical decisions are made by licensed veterinarians only.' } },
        { title: { ru: 'Доступ', en: 'Access' }, subtitle: { ru: 'Обязанность пользователя хранить данные входа в безопасности.', en: 'Users must keep login credentials secure.' } },
        { title: { ru: 'Изменения условий', en: 'Terms updates' }, subtitle: { ru: 'Новые версии документов публикуются в юридическом центре.', en: 'New document versions are published in legal center pages.' } },
      ]}
    />
  );
}

