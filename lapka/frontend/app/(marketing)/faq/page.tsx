import MarketingPage from '@/components/blocks/MarketingPage';

export default function FaqPage() {
  return (
    <MarketingPage
      eyebrow="FAQ"
      title={{ ru: 'Частые вопросы по платформе', en: 'Frequently asked questions' }}
      subtitle={{ ru: 'Короткие ответы по ролям, доступам, AI и стационару.', en: 'Short answers about roles, access, AI, and inpatient workflows.' }}
      bullets={[
        { ru: 'Можно ли работать без backend? — Да, в демо режиме.', en: 'Can it run without backend? — Yes, in demo mode.' },
        { ru: 'Кто выдаёт доступ клинике? — Только владелец.', en: 'Who grants clinic access? — Owner only.' },
        { ru: 'Может ли администратор менять назначения врача? — Нет, доступ только для чтения.', en: 'Can clinic admin change prescriptions? — No, read-only medical access.' },
        { ru: 'Работают ли камеры после выписки? — Нет, доступ отключается.', en: 'Do cameras stay available after discharge? — No, access is revoked.' },
      ]}
      ctaHref="/security"
      ctaLabel={{ ru: 'Подробнее о безопасности', en: 'Learn more about security' }}
      sideImage="/assets/img/public-rx-side.svg"
      cards={[
        { title: { ru: 'Вход по ролям', en: 'Role-based login' }, subtitle: { ru: 'Через выпадающий вход: owner / vet / clinic_admin.', en: 'Use role selector: owner / vet / clinic_admin.' } },
        { title: { ru: 'Публичные назначения', en: 'Public prescriptions' }, subtitle: { ru: 'Только назначения по токену и со сроком действия ссылки.', en: 'Prescriptions are available only via secure token with expiration.' } },
        { title: { ru: 'AI-политика', en: 'AI policy' }, subtitle: { ru: 'Безопасный режим без лечебных инструкций.', en: 'Safety-first mode without treatment instructions.' } },
      ]}
    />
  );
}
