import MarketingPage from '@/components/blocks/MarketingPage';

export default function AboutPage() {
  return (
    <MarketingPage
      eyebrow="О платформе"
      title="Лапка объединяет владельцев, врачей и клиники в единой медэкосистеме"
      subtitle="Мы строим спокойный, безопасный и профессиональный цифровой опыт, где история питомца доступна по согласию владельца, а AI работает только в безопасных сценариях."
      bullets={[
        'MasterPetID и единая история лечения между клиниками',
        'RBAC + согласие владельца + аудит доступа к карте',
        'Стационар с фото-отчётами и камерами только для владельца',
        'CRM клиники с расписанием, шаблонами и аналитикой'
      ]}
      ctaHref="/pricing"
      ctaLabel="Смотреть тарифы"
      sideImage="/assets/img/owner-banner.svg"
      cards={[
        { title: 'Кабинет владельца', subtitle: 'Питомцы, документы, календарь, оценка срочности, доступ клиникам.', href: '/for-owners' },
        { title: 'Кабинет врача', subtitle: 'Карточка приёма, протоколы, инструменты, AI ассистент.', href: '/for-vets' },
        { title: 'CRM клиники', subtitle: 'Записи, врачи, услуги, аудит, аналитика.', href: '/for-clinics' }
      ]}
    />
  );
}
