import MarketingPage from '@/components/blocks/MarketingPage';

export default function PricingPage() {
  return (
    <MarketingPage
      eyebrow="Тарифы"
      title="Гибкая модель для владельцев, клиник и сетей"
      subtitle="Выбирайте формат запуска: от личного кабинета владельца до сети клиник с расширенной аналитикой."
      bullets={[
        'Старт: кабинет владельца + оценка срочности + документы',
        'Клиника: CRM + расписание + шаблоны + аналитика',
        'Сеть: мультифилиальность + единая аналитика + единое управление'
      ]}
      ctaHref="/for-clinics"
      ctaLabel="Запросить демо клиники"
      sideImage="/assets/img/clinic.svg"
      cards={[
        { title: 'Старт', subtitle: 'Для владельцев и небольших команд.' },
        { title: 'Клиника', subtitle: 'Для клиники с ежедневным потоком приёмов.' },
        { title: 'Сеть', subtitle: 'Для сети филиалов и централизованного контроля.' }
      ]}
    />
  );
}
