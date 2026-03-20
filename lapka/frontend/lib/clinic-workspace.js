export const CLINIC_SIDEBAR_GROUPS = [
  {
    title: 'Сегодня',
    links: [
      { href: '/clinic/dashboard', label: 'Операционный центр', icon: 'home' },
      { href: '/clinic/inbox', label: 'Входящие и сигналы', icon: 'notifications' },
      { href: '/clinic/schedule', label: 'Расписание', icon: 'appointments' },
      { href: '/clinic/flowboard', label: 'Поток дня', icon: 'records' },
      { href: '/clinic/checkin', label: 'Ресепшн и регистрация', icon: 'appointments' },
    ],
  },
  {
    title: 'Команда и пациенты',
    links: [
      { href: '/clinic/doctors', label: 'Врачи и команда', icon: 'profile' },
      { href: '/clinic/patients', label: 'Пациенты', icon: 'pets' },
      { href: '/clinic/inpatient', label: 'Стационар', icon: 'inpatient' },
    ],
  },
  {
    title: 'Операции',
    links: [
      { href: '/clinic/services', label: 'Услуги', icon: 'knowledge' },
      { href: '/clinic/templates', label: 'Шаблоны', icon: 'documents' },
      { href: '/clinic/billing', label: 'Счета и финансы', icon: 'finance' },
      { href: '/clinic/insurance', label: 'Страховые кейсы', icon: 'finance' },
    ],
  },
  {
    title: 'Контроль',
    links: [
      { href: '/clinic/analytics', label: 'Аналитика', icon: 'records' },
      { href: '/clinic/audit', label: 'Аудит', icon: 'knowledge' },
      { href: '/clinic/invites', label: 'Приглашения', icon: 'profile' },
    ],
  },
];

export function summarizeClinicOperations({
  members = [],
  patients = [],
  appointments = [],
  auditRows = [],
}) {
  const staff = Array.isArray(members) ? members : [];
  const patientRows = Array.isArray(patients) ? patients : [];
  const appointmentRows = Array.isArray(appointments) ? appointments : [];
  const audit = Array.isArray(auditRows) ? auditRows : [];

  return {
    staff: staff.length,
    vets: staff.filter((item) => item.role_in_clinic === 'vet').length,
    patients: patientRows.length,
    upcoming: appointmentRows.filter((item) => ['new', 'waiting', 'scheduled', 'confirmed'].includes(item.status)).length,
    inProgress: appointmentRows.filter((item) => item.status === 'in_progress').length,
    completed: appointmentRows.filter((item) => item.status === 'completed').length,
    audit: audit.length,
  };
}
