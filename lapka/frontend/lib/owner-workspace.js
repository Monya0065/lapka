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
      { href: '/owner/quick-triage', label: 'Срочность 1 мин', icon: 'health' },
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

/** Backend reminders use `due_at`; older UI code used `remind_at`. */
function reminderDueAt(row) {
  if (!row || typeof row !== 'object') return null;
  return row.due_at || row.remind_at || row.dueAt || null;
}

/** @param {'en' | 'ru'} [locale] — relative labels and date formatting */
export function formatDateTimeLabel(dateStr, locale = 'ru') {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  const isEn = locale === 'en';
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return isEn ? 'today' : 'сегодня';
  if (diffDays < 2) return isEn ? 'yesterday' : 'вчера';
  if (diffDays < 7) return isEn ? `${diffDays} days ago` : `${diffDays} дн. назад`;
  return date.toLocaleDateString(isEn ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
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
      const when = reminderDueAt(r);
      items.push({
        id: `rem-${r.id}`,
        title: r.title || 'Напоминание',
        subtitle: r.notes || r.description || '',
        when,
        href: `/owner/calendar`,
        type: 'reminder',
        petId: r.pet_id,
        tone: when && new Date(when) < now ? 'critical' : 'neutral',
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
      const isMed =
        r.reminder_type === 'medication' || r.type === 'medication' || r.category === 'medication';
      if (isMed) {
        meds.push({
          id: `rem-${r.id}`,
          title: r.title || 'Напоминание о лекарстве',
          due_at: reminderDueAt(r),
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
    dailyBoard: upcoming.map((m) => ({
      id: m.id,
      title: m.title,
      dueAt: m.due_at,
      notes: '',
    })),
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
      const raw = reminderDueAt(r);
      if (raw) {
        const d = new Date(raw);
        if (d >= today && d < tomorrow) {
          todayItems.push(r.title || 'Задача');
        }
      }
    });
  }

  return {
    today: todayItems,
    upcoming: reminders
      ? reminders.filter((r) => {
          const raw = reminderDueAt(r);
          return raw && new Date(raw) >= tomorrow;
        }).slice(0, 5)
      : [],
  };
}

export function buildServiceOverview({ clinics, appointments, invoices }) {
  const now = new Date();
  const futureAppts = appointments
    .filter((a) => a.scheduled_at && new Date(a.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const pendingInvoices = invoices
    ? invoices.filter((i) => i.status === 'issued' || i.status === 'draft')
    : [];

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
  const rows = invoices || [];
  return {
    invoices: rows,
    total: rows.reduce((s, i) => s + Number(i.total_cents || i.amount || 0), 0),
    pending: rows.filter((i) => i.status === 'issued' || i.status === 'draft'),
  };
}

export function buildBehaviorCenter({ reminders }) {
  return {
    reminders: reminders || [],
    tasks: (reminders || []).filter(
      (r) =>
        r.reminder_type === 'behavior' || r.category === 'behavior' || r.type === 'behavior'
    ),
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

export function buildPreventionCenter({ pet, reminders, vaccines, locale = 'ru' }) {
  const isEn = locale === 'en';
  const preventionReminders = reminders || [];
  const vacList = vaccines || [];
  const lastVaccine =
    [...vacList].sort(
      (a, b) =>
        new Date(b.administered_at || b.created_at || 0) - new Date(a.administered_at || a.created_at || 0)
    )[0] || null;
  const seasonal = isEn
    ? [
        'Keep flea, tick and deworming schedules aligned with your vet’s plan.',
        'Note vaccine due dates on the calendar before travel or kennel stays.',
        'Annual wellness visits catch issues early — book the next slot after a visit.',
      ]
    : [
        'Держите график от блох, клещей и гельминтов в согласовании с врачом.',
        'Зафиксируйте даты ревакцинации до поездок и перед передержками.',
        'Ежегодные осмотры помогают заметить проблемы раньше — запланируйте следующий визит сразу после приёма.',
      ];
  return {
    pet: pet || null,
    vaccines: vacList,
    reminders: preventionReminders,
    preventionReminders,
    lastVaccine,
    seasonal,
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

/**
 * Owner SOS / triage scenarios — shapes consumed by `app/owner/triage/page.jsx`.
 * Keep steps informational (when to call clinic, what to bring); no drug doses.
 */
export const EMERGENCY_SCENARIOS = [
  {
    id: 'poisoning',
    title: 'Отравление или подозрение на яд',
    level: 'RED',
    immediate: [
      'Сразу позвоните в ближайшую ветклинику и коротко опишите, что питомец мог съесть, лизнуть или укусить.',
      'Сохраните упаковку, остаток вещества или фото растения — это ускорит ориентацию врача.',
      'Не давайте питомцу лекарств, молока, масла и других «советов из интернета» без указания врача.',
    ],
    avoid: [
      'Не пытайтесь вызвать рвоту и не кормите насильно без рекомендации врача.',
      'Не откладывайте вызов при судорогах, потере сознания, сильной слабости или крови в рвоте/кале.',
    ],
    pack: ['Паспорт питомца или данные чипа', 'Список недавних лекарств', 'Телефон постоянного врача'],
  },
  {
    id: 'trauma',
    title: 'Травма после удара или падения',
    level: 'RED',
    immediate: [
      'Ограничьте движение: переносите питомца бережно, без рывков.',
      'Свяжитесь с клиникой и уточните приём при острой травме.',
      'При кровотечении накройте рану чистой тканью и едьте в клинику без задержек.',
    ],
    avoid: [
      'Не давайте человеческие обезболивающие без назначения врача.',
      'Не выпускайте на улицу при подозрении на перелом или сильной боли при шаге.',
    ],
    pack: ['Плед или твёрдая переноска', 'Документы и сведения о вакцинациях', 'Контакты клиники'],
  },
  {
    id: 'allergy',
    title: 'Сильная аллергическая реакция',
    level: 'YELLOW',
    immediate: [
      'Оцените дыхание и слизистые: сильный отёк морды, волдыри, зуд по всему телу — звоните в клинику.',
      'Уберите вероятный аллерген (корм, новое лакомство, укус насекомого), если это безопасно.',
    ],
    avoid: ['Не игнорируйте быстрое ухудшение — при вовлечении дыхания это срочный случай.'],
    pack: ['Корм и лакомства за сегодня', 'Фото сыпи, если есть'],
  },
  {
    id: 'breathing',
    title: 'Тяжёлое или шумное дыхание',
    level: 'RED',
    immediate: [
      'Уберите стрессоры, дайте спокойную обстановку и доступ к прохладному воздуху без переохлаждения.',
      'Немедленно свяжитесь с клиникой при вытягивании шеи, «хрипах», синюшности слизистых или вялости.',
    ],
    avoid: ['Не нагружайте физически; не оставляйте в закрытой тёплой машине.'],
    pack: ['Краткая история сердца/аллергии, если известна'],
  },
];

export function buildSmartIntentSuggestions() {
  return [];
}
