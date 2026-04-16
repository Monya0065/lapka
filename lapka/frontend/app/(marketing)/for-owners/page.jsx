import MarketingPage from '@/components/blocks/MarketingPage';

export default function ForOwnersPage() {
  return (
    <MarketingPage
      eyebrow={{ ru: 'Для владельцев', en: 'For owners' }}
      title={{ ru: 'Личный кабинет здоровья питомцев', en: 'Personal pet health workspace' }}
      subtitle={{
        ru: 'Дружелюбный интерфейс для всех животных семьи: медкарта, документы, календарь, стационар и карта рядом.',
        en: 'A friendly interface for all family pets: medical record, documents, calendar, inpatient care, and nearby map.',
      }}
      bullets={[
        { ru: 'Несколько питомцев в одном аккаунте', en: 'Multiple pets in one account' },
        { ru: 'Таймлайн визитов, анализов и вакцинаций', en: 'Timeline of visits, labs, and vaccinations' },
        { ru: 'AI-оценка срочности GREEN/YELLOW/RED без диагнозов', en: 'AI urgency triage GREEN/YELLOW/RED with no diagnoses' },
        { ru: 'Управление доступом клиникам и журнал просмотров', en: 'Clinic access management and record-view journal' },
      ]}
      ctaHref="/login?role=owner"
      ctaLabel={{ ru: 'Открыть кабинет владельца', en: 'Open owner workspace' }}
      sideImage="/assets/img/owner-side.svg"
      cards={[
        { title: { ru: 'Питомцы', en: 'Pets' }, subtitle: { ru: 'Профили, фото, аллергии, чип и вес.', en: 'Profiles, photos, allergies, chip ID, and weight.' } },
        { title: { ru: 'Документы', en: 'Documents' }, subtitle: { ru: 'Загрузка PDF/JPG/PNG и AI объяснение.', en: 'Upload PDF/JPG/PNG and get AI explanation.' } },
        { title: { ru: 'Стационар', en: 'Inpatient' }, subtitle: { ru: 'Фото-отчёты, план на сутки и камеры.', en: 'Photo reports, daily plan, and cameras.' } },
      ]}
    />
  );
}
