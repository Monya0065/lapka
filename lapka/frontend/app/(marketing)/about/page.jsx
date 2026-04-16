import MarketingPage from '@/components/blocks/MarketingPage';

export default function AboutPage() {
  return (
    <MarketingPage
      eyebrow={{ ru: 'О платформе', en: 'About platform' }}
      title={{
        ru: 'Лапка объединяет владельцев, врачей и клиники в единой медэкосистеме',
        en: 'Lapka unites owners, veterinarians, and clinics in one medical ecosystem',
      }}
      subtitle={{
        ru: 'Мы строим спокойный, безопасный и профессиональный цифровой опыт, где история питомца доступна по согласию владельца, а AI работает только в безопасных сценариях.',
        en: 'We build a calm, secure, and professional digital experience where pet history is available by owner consent and AI works only in safe scenarios.',
      }}
      bullets={[
        { ru: 'MasterPetID и единая история лечения между клиниками', en: 'MasterPetID and unified treatment history across clinics' },
        { ru: 'RBAC + согласие владельца + аудит доступа к карте', en: 'RBAC + owner consent + medical record access audit' },
        { ru: 'Стационар с фото-отчётами и камерами только для владельца', en: 'Inpatient module with photo reports and owner-only camera access' },
        { ru: 'CRM клиники с расписанием, шаблонами и аналитикой', en: 'Clinic CRM with scheduling, templates, and analytics' },
      ]}
      ctaHref="/pricing"
      ctaLabel={{ ru: 'Смотреть тарифы', en: 'View pricing' }}
      sideImage="/assets/img/owner-banner.svg"
      cards={[
        {
          title: { ru: 'Кабинет владельца', en: 'Owner workspace' },
          subtitle: { ru: 'Питомцы, документы, календарь, оценка срочности, доступ клиникам.', en: 'Pets, documents, calendar, urgency assessment, and clinic access controls.' },
          href: '/for-owners',
        },
        {
          title: { ru: 'Кабинет врача', en: 'Vet workspace' },
          subtitle: { ru: 'Карточка приёма, протоколы, инструменты, AI ассистент.', en: 'Visit card, protocols, tools, and AI assistant.' },
          href: '/for-vets',
        },
        {
          title: { ru: 'CRM клиники', en: 'Clinic CRM' },
          subtitle: { ru: 'Записи, врачи, услуги, аудит, аналитика.', en: 'Appointments, staff, services, audit, and analytics.' },
          href: '/for-clinics',
        },
      ]}
    />
  );
}
