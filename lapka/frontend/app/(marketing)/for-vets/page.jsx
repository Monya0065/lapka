import MarketingPage from '@/components/blocks/MarketingPage';

export default function ForVetsPage() {
  return (
    <MarketingPage
      eyebrow="Для врачей"
      title="Клинический интерфейс, который ускоряет приём"
      subtitle="Пациенты, визиты, протоколы, документы, стационар и клинические инструменты в одном рабочем пространстве врача."
      bullets={[
        'Карточка приёма: жалобы, анамнез, осмотр, план, назначения',
        'Чек-лист красных флагов и urgent-маркировка',
        'Генерация протокола и печать PDF',
        'AI для структуры заметок и проверки полноты'
      ]}
      ctaHref="/login?role=vet"
      ctaLabel="Открыть кабинет врача"
      sideImage="/assets/img/vet-side.svg"
      cards={[
        { title: 'Пациенты', subtitle: 'Поиск по владельцу/телефону/симптомам.' },
        { title: 'Документы', subtitle: 'Лабораторные результаты и изображения.' },
        { title: 'Клинические инструменты', subtitle: 'RER, DER, fluid, shock, transfusion и др.' }
      ]}
    />
  );
}
