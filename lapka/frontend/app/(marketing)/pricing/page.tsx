import MarketingPage from '@/components/blocks/MarketingPage';

export default function PricingPage() {
  return (
    <MarketingPage
      eyebrow={{ ru: 'Тарифы', en: 'Pricing' }}
      title={{ ru: 'Гибкая модель для владельцев, клиник и сетей', en: 'Flexible plans for owners, clinics, and networks' }}
      subtitle={{
        ru: 'Выбирайте формат запуска: от личного кабинета владельца до сети клиник с расширенной аналитикой.',
        en: 'Choose your rollout format: from owner workspace to a multi-clinic network with advanced analytics.',
      }}
      bullets={[
        { ru: 'Старт: кабинет владельца + оценка срочности + документы', en: 'Starter: owner workspace + urgency triage + documents' },
        { ru: 'Клиника: CRM + расписание + шаблоны + аналитика', en: 'Clinic: CRM + scheduling + templates + analytics' },
        { ru: 'Сеть: мультифилиальность + единая аналитика + единое управление', en: 'Network: multi-branch management + unified analytics + centralized control' },
      ]}
      ctaHref="/for-clinics"
      ctaLabel={{ ru: 'Запросить демо клиники', en: 'Request clinic demo' }}
      sideImage="/assets/img/clinic.svg"
      cards={[
        { title: { ru: 'Старт', en: 'Starter' }, subtitle: { ru: 'Для владельцев и небольших команд.', en: 'For owners and small teams.' } },
        { title: { ru: 'Клиника', en: 'Clinic' }, subtitle: { ru: 'Для клиники с ежедневным потоком приёмов.', en: 'For clinics with a steady daily visit flow.' } },
        { title: { ru: 'Сеть', en: 'Network' }, subtitle: { ru: 'Для сети филиалов и централизованного контроля.', en: 'For branch networks with centralized operations.' } },
      ]}
    />
  );
}
