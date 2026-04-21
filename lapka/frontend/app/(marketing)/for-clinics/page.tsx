import MarketingPage from '@/components/blocks/MarketingPage';

export default function ForClinicsPage() {
  return (
    <MarketingPage
      eyebrow={{ ru: 'Для клиник', en: 'For clinics' }}
      title={{ ru: 'CRM-контур для операций, качества и роста', en: 'CRM layer for operations, quality, and growth' }}
      subtitle={{
        ru: 'CRM Лапка помогает управлять записями, расписанием, врачами, услугами и аналитикой на уровне клиники и сети.',
        en: 'Lapka CRM helps manage appointments, schedules, teams, services, and analytics for clinics and multi-branch networks.',
      }}
      bullets={[
        { ru: 'Управление слотами и конфликтами расписания', en: 'Slot management and schedule conflict prevention' },
        { ru: 'Контроль качества протоколов и полнота данных', en: 'Protocol quality checks and data completeness' },
        { ru: 'Шаблоны и стандарты клинической документации', en: 'Templates and standards for clinical documentation' },
        { ru: 'Аудит действий и безопасность доступа', en: 'Action audit and secure access controls' },
      ]}
      ctaHref="/login?role=clinic_admin"
      ctaLabel={{ ru: 'Открыть CRM клиники', en: 'Open clinic CRM' }}
      sideImage="/assets/img/clinic-ops.svg"
      cards={[
        { title: { ru: 'Записи', en: 'Appointments' }, subtitle: { ru: 'Создание, перенос и отмена в 1 экран.', en: 'Create, reschedule, and cancel in one view.' } },
        { title: { ru: 'Аналитика', en: 'Analytics' }, subtitle: { ru: 'Доход, визиты, NPS и загрузка врачей.', en: 'Revenue, visits, NPS, and staff utilization.' } },
        { title: { ru: 'Стационар', en: 'Inpatient' }, subtitle: { ru: 'SLA отчётов, занятость и реестр камер.', en: 'Report SLA, occupancy, and camera registry.' } },
      ]}
    />
  );
}
