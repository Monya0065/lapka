import MarketingPage from '@/components/blocks/MarketingPage';

export default function ForVetsPage() {
  return (
    <MarketingPage
      eyebrow={{ ru: 'Для врачей', en: 'For veterinarians' }}
      title={{ ru: 'Клинический интерфейс, который ускоряет приём', en: 'Clinical workspace that speeds up every visit' }}
      subtitle={{
        ru: 'Пациенты, визиты, протоколы, документы, стационар и клинические инструменты в одном рабочем пространстве врача.',
        en: 'Patients, visits, protocols, documents, inpatient care, and clinical tools in one veterinarian workspace.',
      }}
      bullets={[
        { ru: 'Карточка приёма: жалобы, анамнез, осмотр, план, назначения', en: 'Visit card: complaints, history, exam, plan, and prescriptions' },
        { ru: 'Чек-лист красных флагов и urgent-маркировка', en: 'Red-flag checklist with urgent markers' },
        { ru: 'Генерация протокола и печать PDF', en: 'Protocol generation and PDF print' },
        { ru: 'AI для структуры заметок и проверки полноты', en: 'AI for structured notes and completeness checks' },
      ]}
      ctaHref="/login?role=vet"
      ctaLabel={{ ru: 'Открыть кабинет врача', en: 'Open vet workspace' }}
      sideImage="/assets/img/vet-side.svg"
      cards={[
        { title: { ru: 'Пациенты', en: 'Patients' }, subtitle: { ru: 'Поиск по владельцу/телефону/симптомам.', en: 'Search by owner, phone, or symptoms.' } },
        { title: { ru: 'Документы', en: 'Documents' }, subtitle: { ru: 'Лабораторные результаты и изображения.', en: 'Lab results and imaging records.' } },
        { title: { ru: 'Клинические инструменты', en: 'Clinical calculators' }, subtitle: { ru: 'RER, DER, fluid, shock, transfusion и др.', en: 'RER, DER, fluid, shock, transfusion, and more.' } },
      ]}
    />
  );
}
