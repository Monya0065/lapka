import MarketingPage from '@/components/blocks/MarketingPage';

export default function FaqPage() {
  return (
    <MarketingPage
      eyebrow="FAQ"
      title="Частые вопросы по платформе"
      subtitle="Короткие ответы по ролям, доступам, AI и стационару."
      bullets={[
        'Можно ли работать без backend? — Да, в демо режиме.',
        'Кто выдаёт доступ клинике? — Только владелец.',
        'Может ли администратор менять назначения врача? — Нет, доступ только для чтения.',
        'Работают ли камеры после выписки? — Нет, доступ отключается.'
      ]}
      ctaHref="/security"
      ctaLabel="Подробнее о безопасности"
      sideImage="/assets/img/public-rx-side.svg"
      cards={[
        { title: 'Вход по ролям', subtitle: 'Через выпадающий вход: owner / vet / clinic_admin.' },
        { title: 'Публичные назначения', subtitle: 'Только назначения по токену и со сроком действия ссылки.' },
        { title: 'AI-политика', subtitle: 'Безопасный режим без лечебных инструкций.' }
      ]}
    />
  );
}
