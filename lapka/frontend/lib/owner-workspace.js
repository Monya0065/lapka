/**
 * Owner workspace — consolidated sidebar groups for minimalism.
 * Reduces 6 groups / 24 links → 4 groups / 12 primary links.
 * Secondary items (care, calculators, knowledge) moved to dashboard or footer.
 */
export const OWNER_SIDEBAR_GROUPS = [
  {
    title: 'Главная',
    links: [
      { href: '/owner/dashboard', label: 'Дашборд', icon: 'home' },
      { href: '/owner/inbox', label: 'Входящие', icon: 'notifications' },
      { href: '/owner/calendar', label: 'Календарь', icon: 'notifications' },
    ],
  },
  {
    title: 'Питомцы',
    links: [
      { href: '/owner/pets', label: 'Все питомцы', icon: 'pets' },
      { href: '/owner/records', label: 'Медкарта', icon: 'records' },
      { href: '/owner/documents', label: 'Документы', icon: 'documents' },
      { href: '/owner/passport-center', label: 'Паспорт', icon: 'profile' },
    ],
  },
  {
    title: 'Здоровье',
    links: [
      { href: '/owner/visits', label: 'Визиты', icon: 'appointments' },
      { href: '/owner/medications', label: 'Лекарства', icon: 'pharmacy' },
      { href: '/owner/prevention', label: 'Профилактика', icon: 'timeline' },
      { href: '/owner/triage', label: 'Симптомы · SOS', icon: 'health' },
      { href: '/owner/inpatient', label: 'Стационар', icon: 'inpatient' },
    ],
  },
  {
    title: 'Сервисы',
    links: [
      { href: '/owner/appointments', label: 'Записи', icon: 'appointments' },
      { href: '/owner/services', label: 'Клиники и карта', icon: 'map' },
      { href: '/owner/billing', label: 'Счета', icon: 'finance' },
    ],
  },
];

export function formatDateTimeLabel(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return 'сегодня';
  if (diffDays < 2) return 'вчера';
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export function buildHealthTimeline({ petId, visits, documents, reminders, appointments, vaccines, prescriptionsByVisit }) {
  const items = [];
  const now = new Date();

  if (visits) {
    visits.forEach((v) => {
      items.push({
        id: `visit-${v.id}`,
        title: v.complaints || 'Визит',
        subtitle: v.assessment_note || '',
        when: v.created_at,
        href: `/owner/visit/${v.id}`,
        type: 'visit',
        petId: v.pet_id,
        tone: v.status === 'draft' ? 'warning' : 'neutral',
      });
    });
  }

  if (documents) {
    documents.forEach((d) => {
      items.push({
        id: `doc-${d.id}`,
        title: d.title || 'Документ',
        subtitle: d.doc_type || '',
        when: d.created_at,
        href: `/owner/documents`,
        type: 'document',
        petId: d.pet_id,
        tone: 'neutral',
      });
    });
  }

  if (vaccines) {
    vaccines.forEach((v) => {
      items.push({
        id: `vac-${v.id}`,
        title: v.vaccine_name || 'Вакцинация',
        subtitle: '',
        when: v.administered_at,
        href: `/owner/pet/${v.pet_id}`,
        type: 'vaccine',
        petId: v.pet_id,
        tone: 'neutral',
      });
    });
  }

  if (reminders) {
    reminders.forEach((r) => {
      items.push({
        id: `rem-${r.id}`,
        title: r.title || 'Напоминание',
        subtitle: r.description || '',
        when: r.remind_at,
        href: `/owner/reminders`,
        type: 'reminder',
        petId: r.pet_id,
        tone: r.remind_at && new Date(r.remind_at) < now ? 'critical' : 'neutral',
      });
    });
  }

  if (appointments) {
    appointments.forEach((a) => {
      items.push({
        id: `appt-${a.id}`,
        title: a.service_type || 'Запись',
        subtitle: '',
        when: a.scheduled_at,
        href: `/owner/appointments`,
        type: 'appointment',
        petId: a.pet_id,
        tone: 'neutral',
      });
    });
  }

  items.sort((a, b) => {
    const ta = a.when ? new Date(a.when).getTime() : 0;
    const tb = b.when ? new Date(b.when).getTime() : 0;
    return tb - ta;
  });

  return petId ? items.filter((i) => !petId || i.petId === petId) : items;
}

export function buildMedicationCenter({ pet, reminders, prescriptions, visits }) {
  const now = new Date();
  const meds = [];

  if (prescriptions) {
    prescriptions.forEach((p) => {
      meds.push({
        id: `presc-${p.id}`,
        title: p.drug_name || p.name || 'Лекарство',
        due_at: p.start_date || p.created_at,
        pet_id: p.pet_id,
      });
    });
  }

  if (reminders) {
    reminders.forEach((r) => {
      if (r.type === 'medication' || r.category === 'medication') {
        meds.push({
          id: `rem-${r.id}`,
          title: r.title || 'Напоминание о лекарстве',
          due_at: r.remind_at,
          pet_id: r.pet_id,
        });
      }
    });
  }

  const upcoming = meds
    .filter((m) => m.due_at && new Date(m.due_at) >= now)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));

  return {
    medications: meds,
    nextMedication: upcoming[0] || null,
  };
}

export function buildPersonalCarePlan({ pet, reminders, timeline }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayItems = [];
  if (reminders) {
    reminders.forEach((r) => {
      if (r.remind_at) {
        const d = new Date(r.remind_at);
        if (d >= today && d < tomorrow) {
          todayItems.push(r.title || 'Задача');
        }
      }
    });
  }

  return {
    today: todayItems,
    upcoming: reminders ? reminders.filter((r) => r.remind_at && new Date(r.remind_at) >= tomorrow).slice(0, 5) : [],
  };
}

export function buildServiceOverview({ clinics, appointments, invoices }) {
  const now = new Date();
  const futureAppts = appointments
    .filter((a) => a.scheduled_at && new Date(a.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const pendingInvoices = invoices ? invoices.filter((i) => i.status === 'pending' || i.status === 'unpaid') : [];

  return {
    clinics: clinics || [],
    appointments: appointments || [],
    invoices: invoices || [],
    nextAppointment: futureAppts[0] || null,
    pendingInvoiceCount: pendingInvoices.length,
  };
}

export function groupTimelineItems(items) {
  const groups = {};
  (items || []).forEach((item) => {
    const d = new Date(item.when || item.created_at);
    const key = isNaN(d.getTime()) ? 'other' : d.toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups).map(([date, groupItems]) => ({ date, items: groupItems }));
}

export function buildExpenseCenter({ invoices }) {
  return {
    invoices: invoices || [],
    total: (invoices || []).reduce((s, i) => s + (i.amount || 0), 0),
    pending: (invoices || []).filter((i) => i.status === 'pending' || i.status === 'unpaid'),
  };
}

export function buildBehaviorCenter({ reminders }) {
  return {
    reminders: reminders || [],
    tasks: (reminders || []).filter((r) => r.category === 'behavior' || r.type === 'behavior'),
  };
}

export function buildVitalMetricsCenter({ pet, visits }) {
  return {
    visits: visits || [],
    latest: (visits || [])[0] || null,
  };
}

export function buildPassportCenter({ pet }) {
  return { pet: pet || null };
}

export function buildPreventionCenter({ pet, reminders, vaccines }) {
  return {
    vaccines: vaccines || [],
    reminders: reminders || [],
  };
}

export function buildVisitCenter({ visits }) {
  return { visits: visits || [] };
}

export function buildRoutineCenter({ reminders }) {
  return { reminders: reminders || [] };
}

export function buildHomeSafetyMap() {
  return { items: [] };
}

export function buildTravelMode() {
  return { items: [] };
}

export function buildRecoveryMode() {
  return { items: [] };
}

export function buildVetExportPack() {
  return { items: [] };
}

export function buildKnowledgeFeed() {
  return { items: [] };
}

export const TRUST_META = { title: 'Lapka', description: 'Ветеринарная цифровая экосистема' };

export const KNOWLEDGE_AREAS = [
  { id: 'health', label: 'Здоровье' },
  { id: 'nutrition', label: 'Питание' },
  { id: 'behavior', label: 'Поведение' },
  { id: 'prevention', label: 'Профилактика' },
];

export const SERVICE_ACTIONS = [
  { id: 'appointments', label: 'Записи' },
  { id: 'clinics', label: 'Клиники' },
  { id: 'billing', label: 'Счета' },
];

export const CALCULATOR_STRIP = [
  { id: 'bmi', label: 'ИМТ' },
  { id: 'calories', label: 'Калории' },
  { id: 'medication', label: 'Лекарства' },
];

export const EMERGENCY_SCENARIOS = [
  { id: 'poisoning', label: 'Отравление', severity: 'critical' },
  { id: 'trauma', label: 'Травма', severity: 'critical' },
  { id: 'allergy', label: 'Аллергия', severity: 'warning' },
  { id: 'breathing', label: 'Проблемы с дыханием', severity: 'critical' },
];

export function buildSmartIntentSuggestions() {
  return [];
}
