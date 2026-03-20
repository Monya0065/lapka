import MarketingPage from '@/components/blocks/MarketingPage';

export default function ForClinicsPage() {
  return (
    <MarketingPage
      eyebrow="Для клиник"
      title="CRM-контур для операций, качества и роста"
      subtitle="CRM Лапка помогает управлять записями, расписанием, врачами, услугами и аналитикой на уровне клиники и сети."
      bullets={[
        'Управление слотами и конфликтами расписания',
        'Контроль качества протоколов и полнота данных',
        'Шаблоны и стандарты клинической документации',
        'Аудит действий и безопасность доступа'
      ]}
      ctaHref="/login?role=clinic_admin"
      ctaLabel="Открыть CRM клиники"
      sideImage="/assets/img/clinic-ops.svg"
      cards={[
        { title: 'Записи', subtitle: 'Создание, перенос и отмена в 1 экран.' },
        { title: 'Аналитика', subtitle: 'Доход, визиты, NPS и загрузка врачей.' },
        { title: 'Стационар', subtitle: 'SLA отчётов, занятость и реестр камер.' }
      ]}
    />
  );
}
