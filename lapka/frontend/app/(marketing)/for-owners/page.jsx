import MarketingPage from '@/components/blocks/MarketingPage';

export default function ForOwnersPage() {
  return (
    <MarketingPage
      eyebrow="Для владельцев"
      title="Личный кабинет здоровья питомцев"
      subtitle="Дружелюбный интерфейс для всех животных семьи: медкарта, документы, календарь, стационар и карта рядом."
      bullets={[
        'Несколько питомцев в одном аккаунте',
        'Таймлайн визитов, анализов и вакцинаций',
        'AI-оценка срочности GREEN/YELLOW/RED без диагнозов',
        'Управление доступом клиникам и журнал просмотров'
      ]}
      ctaHref="/login?role=owner"
      ctaLabel="Открыть кабинет владельца"
      sideImage="/assets/img/owner-side.svg"
      cards={[
        { title: 'Питомцы', subtitle: 'Профили, фото, аллергии, чип и вес.' },
        { title: 'Документы', subtitle: 'Загрузка PDF/JPG/PNG и AI объяснение.' },
        { title: 'Стационар', subtitle: 'Фото-отчёты, план на сутки и камеры.' }
      ]}
    />
  );
}
