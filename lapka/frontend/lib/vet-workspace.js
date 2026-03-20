export const VET_SIDEBAR_GROUPS = [
  {
    title: 'Сегодня',
    links: [
      { href: '/vet/dashboard', label: 'Обзор смены', icon: 'home' },
      { href: '/vet/inbox', label: 'Входящие и сигналы', icon: 'notifications' },
      { href: '/vet/appointments', label: 'Поток приёма', icon: 'appointments' },
    ],
  },
  {
    title: 'Пациенты',
    links: [
      { href: '/vet/patients', label: 'Поиск и пациенты', icon: 'pets' },
      { href: '/vet/documents', label: 'Документы', icon: 'documents' },
      { href: '/vet/labs', label: 'Лаборатория', icon: 'records' },
    ],
  },
  {
    title: 'Клиническая работа',
    links: [
      { href: '/vet/inpatient', label: 'Стационар', icon: 'inpatient' },
      { href: '/clinical/protocols', label: 'Протоколы', icon: 'knowledge' },
      { href: '/vet/drugs', label: 'Препараты', icon: 'pharmacy' },
    ],
  },
  {
    title: 'Инструменты',
    links: [
      { href: '/vet/tools', label: 'Калькуляторы и инструменты', icon: 'tools' },
      { href: '/vet/assistant', label: 'AI-ассистент', icon: 'sos' },
    ],
  },
];

export const VET_TASKS = [
  'Закрыть текущие протоколы и проверить полноту записей.',
  'Отметить срочные сигналы у пациентов с неотложными жалобами.',
  'Проверить лабораторные результаты и входящие документы.',
];

export function summarizeVetFlow(appointments = []) {
  const rows = Array.isArray(appointments) ? appointments : [];
  const waiting = rows.filter((item) => ['new', 'waiting', 'scheduled', 'confirmed'].includes(item.status)).length;
  const active = rows.filter((item) => item.status === 'in_progress').length;
  const done = rows.filter((item) => item.status === 'completed').length;
  const telemedicine = rows.filter((item) => item.visit_type === 'video_consultation').length;

  return {
    total: rows.length,
    waiting,
    active,
    done,
    telemedicine,
  };
}
