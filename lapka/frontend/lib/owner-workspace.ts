interface SidebarLink {
  href: string;
  labelKey: string;
  icon: string;
}

interface SidebarGroup {
  titleKey: string;
  links: SidebarLink[];
}

export const OWNER_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    titleKey: 'owner.workspaceUi.sidebarGroupHome',
    links: [
      { href: '/owner/dashboard', labelKey: 'nav.dashboard', icon: 'home' },
      { href: '/owner/inbox', labelKey: 'owner.workspaceUi.sidebarInbox', icon: 'notifications' },
      { href: '/owner/calendar', labelKey: 'pet.calendar', icon: 'calendar' },
    ],
  },
  {
    titleKey: 'owner.workspaceUi.sidebarGroupPets',
    links: [
      { href: '/owner/pets', labelKey: 'owner.workspaceUi.sidebarAllPets', icon: 'pets' },
      { href: '/owner/records', labelKey: 'nav.medicalRecords', icon: 'records' },
      { href: '/owner/documents', labelKey: 'nav.documents', icon: 'documents' },
      { href: '/owner/passport-center', labelKey: 'owner.workspaceUi.sidebarPassport', icon: 'profile' },
    ],
  },
  {
    titleKey: 'owner.workspaceUi.sidebarGroupHealth',
    links: [
      { href: '/owner/visits', labelKey: 'owner.workspaceUi.sidebarVisits', icon: 'appointments' },
      { href: '/owner/medications', labelKey: 'owner.workspaceUi.sidebarMedications', icon: 'pharmacy' },
      { href: '/owner/prevention', labelKey: 'owner.workspaceUi.sidebarPrevention', icon: 'timeline' },
      { href: '/owner/quick-triage', labelKey: 'owner.workspaceUi.sidebarUrgencySos', icon: 'sos' },
      { href: '/owner/inpatient', labelKey: 'nav.inpatient', icon: 'inpatient' },
    ],
  },
  {
    titleKey: 'owner.workspaceUi.sidebarGroupServices',
    links: [
      { href: '/owner/appointments', labelKey: 'nav.appointments', icon: 'appointments' },
      { href: '/owner/map', labelKey: 'owner.workspaceUi.sidebarClinicsMap', icon: 'map' },
      { href: '/owner/billing', labelKey: 'nav.billing', icon: 'finance' },
    ],
  },
];

function reminderDueAt(row?: Record<string, unknown> | null): string | null {
  if (!row || typeof row !== 'object') return null;
  return (row.due_at as string) || (row.remind_at as string) || (row.dueAt as string) || null;
}

export function formatDateTimeLabel(dateStr?: string | null, locale = 'ru'): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  const isEn = locale === 'en';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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

interface TimelineItem {
  id: string;
  title: string;
  subtitle: string;
  when?: string | null;
  href: string;
  type: string;
  petId?: string;
  tone?: string;
  [key: string]: unknown;
}

export function buildHealthTimeline({
  petId,
  visits,
  documents,
  reminders,
  appointments,
  vaccines,
  prescriptionsByVisit,
}: {
  petId?: string;
  visits?: Record<string, unknown>[];
  documents?: Record<string, unknown>[];
  reminders?: Record<string, unknown>[];
  appointments?: Record<string, unknown>[];
  vaccines?: Record<string, unknown>[];
  prescriptionsByVisit?: Record<string, unknown>[];
}): TimelineItem[] {
  const items: TimelineItem[] = [];
  const now = new Date();

  if (visits) {
    visits.forEach((v) => {
      items.push({
        id: `visit-${v.id}`,
        title: (v.complaints as string) || 'Визит',
        subtitle: (v.assessment_note as string) || '',
        when: v.created_at as string,
        href: `/owner/visit/${v.id}`,
        type: 'visit',
        petId: v.pet_id as string,
        tone: v.status === 'draft' ? 'warning' : 'neutral',
      });
    });
  }

  if (documents) {
    documents.forEach((d) => {
      items.push({
        id: `doc-${d.id}`,
        title: (d.title as string) || 'Документ',
        subtitle: (d.doc_type as string) || '',
        when: d.created_at as string,
        href: `/owner/documents`,
        type: 'document',
        petId: d.pet_id as string,
        tone: 'neutral',
      });
    });
  }

  if (vaccines) {
    vaccines.forEach((v) => {
      items.push({
        id: `vac-${v.id}`,
        title: (v.vaccine_name as string) || 'Вакцинация',
        subtitle: '',
        when: v.administered_at as string,
        href: `/owner/pet/${v.pet_id}`,
        type: 'vaccine',
        petId: v.pet_id as string,
        tone: 'neutral',
      });
    });
  }

  if (reminders) {
    reminders.forEach((r) => {
      const when = reminderDueAt(r);
      items.push({
        id: `rem-${r.id}`,
        title: (r.title as string) || 'Напоминание',
        subtitle: (r.notes as string) || (r.description as string) || '',
        when,
        href: `/owner/calendar`,
        type: 'reminder',
        petId: r.pet_id as string,
        tone: when && new Date(when) < now ? 'critical' : 'neutral',
      });
    });
  }

  if (appointments) {
    appointments.forEach((a) => {
      items.push({
        id: `appt-${a.id}`,
        title: (a.service_type as string) || 'Запись',
        subtitle: '',
        when: a.scheduled_at as string,
        href: `/owner/appointments`,
        type: 'appointment',
        petId: a.pet_id as string,
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

export function buildMedicationCenter({
  pet,
  reminders,
  prescriptions,
  visits,
}: {
  pet?: Record<string, unknown>;
  reminders?: Record<string, unknown>[];
  prescriptions?: Record<string, unknown>[];
  visits?: Record<string, unknown>[];
}): {
  medications: { id: string; title: string; due_at?: string; pet_id?: string }[];
  nextMedication: { id: string; title: string; due_at?: string; pet_id?: string } | null;
  dailyBoard: { id: string; title: string; dueAt?: string; notes: string }[];
} {
  const now = new Date();
  const meds: { id: string; title: string; due_at?: string; pet_id?: string }[] = [];

  if (prescriptions) {
    prescriptions.forEach((p) => {
      meds.push({
        id: `presc-${p.id}`,
        title: (p.drug_name as string) || (p.name as string) || 'Лекарство',
        due_at: (p.start_date as string) || (p.created_at as string),
        pet_id: p.pet_id as string,
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
          title: (r.title as string) || 'Напоминание о лекарстве',
          due_at: reminderDueAt(r) || undefined,
          pet_id: r.pet_id as string,
        });
      }
    });
  }

  const upcoming = meds
    .filter((m) => m.due_at && new Date(m.due_at) >= now)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());

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

export function buildPersonalCarePlan({
  pet,
  reminders,
  timeline,
}: {
  pet?: Record<string, unknown>;
  reminders?: Record<string, unknown>[];
  timeline?: unknown[];
}): {
  today: string[];
  upcoming: Record<string, unknown>[];
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayItems: string[] = [];
  if (reminders) {
    reminders.forEach((r) => {
      const raw = reminderDueAt(r);
      if (raw) {
        const d = new Date(raw);
        if (d >= today && d < tomorrow) {
          todayItems.push((r.title as string) || 'Задача');
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
        }).slice(0, 5) as Record<string, unknown>[]
      : [],
  };
}

export function buildServiceOverview({
  clinics,
  appointments,
  invoices,
}: {
  clinics?: Record<string, unknown>[];
  appointments?: Record<string, unknown>[];
  invoices?: Record<string, unknown>[];
}): {
  clinics: Record<string, unknown>[];
  appointments: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  nextAppointment: Record<string, unknown> | null;
  pendingInvoiceCount: number;
} {
  const now = new Date();
  const futureAppts = (appointments || [])
    .filter((a) => a.scheduled_at && new Date(a.scheduled_at as string) >= now)
    .sort((a, b) => new Date(a.scheduled_at as string).getTime() - new Date(b.scheduled_at as string).getTime());

  const pendingInvoices = (invoices || []).filter(
    (i) => i.status === 'issued' || i.status === 'draft'
  );

  return {
    clinics: clinics || [],
    appointments: appointments || [],
    invoices: invoices || [],
    nextAppointment: futureAppts[0] || null,
    pendingInvoiceCount: pendingInvoices.length,
  };
}

export function groupTimelineItems(
  items: { when?: string; created_at?: string; [key: string]: unknown }[]
): { date: string; items: { when?: string; created_at?: string; [key: string]: unknown }[] }[] {
  const groups: Record<string, { when?: string; created_at?: string; [key: string]: unknown }[]> = {};
  (items || []).forEach((item) => {
    const d = new Date(item.when || item.created_at || '');
    const key = isNaN(d.getTime()) ? 'other' : d.toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups).map(([date, groupItems]) => ({ date, items: groupItems }));
}

export function buildExpenseCenter({
  invoices,
}: {
  invoices?: Record<string, unknown>[];
}): {
  invoices: Record<string, unknown>[];
  total: number;
  pending: Record<string, unknown>[];
} {
  const rows = invoices || [];
  return {
    invoices: rows,
    total: rows.reduce((s, i) => s + Number(i.total_cents || i.amount || 0), 0),
    pending: rows.filter((i) => i.status === 'issued' || i.status === 'draft'),
  };
}

export function buildBehaviorCenter({
  reminders,
}: {
  reminders?: Record<string, unknown>[];
}): {
  reminders: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
} {
  return {
    reminders: reminders || [],
    tasks: (reminders || []).filter(
      (r) =>
        r.reminder_type === 'behavior' || r.category === 'behavior' || r.type === 'behavior'
    ),
  };
}

export function buildVitalMetricsCenter({
  pet,
  visits,
}: {
  pet?: Record<string, unknown>;
  visits?: Record<string, unknown>[];
}): {
  visits: Record<string, unknown>[];
  latest: Record<string, unknown> | null;
} {
  return {
    visits: visits || [],
    latest: (visits || [])[0] || null,
  };
}

export function buildPassportCenter({
  pet,
}: {
  pet?: Record<string, unknown>;
}): { pet: Record<string, unknown> | null } {
  return { pet: pet || null };
}

export function buildPreventionCenter({
  pet,
  reminders,
  vaccines,
  locale = 'ru',
}: {
  pet?: Record<string, unknown>;
  reminders?: Record<string, unknown>[];
  vaccines?: Record<string, unknown>[];
  locale?: string;
}): {
  pet: Record<string, unknown> | null;
  vaccines: Record<string, unknown>[];
  reminders: Record<string, unknown>[];
  preventionReminders: Record<string, unknown>[];
  lastVaccine: Record<string, unknown> | null;
  seasonal: string[];
} {
  const isEn = locale === 'en';
  const preventionReminders = reminders || [];
  const vacList = vaccines || [];
  const lastVaccine =
    ([...vacList].sort(
      (a, b) =>
        new Date((b.administered_at as string) || (b.created_at as string) || '0').getTime() -
        new Date((a.administered_at as string) || (a.created_at as string) || '0').getTime()
    )[0] as Record<string, unknown>) || null;
  const seasonal = isEn
    ? [
        'Keep flea, tick and deworming schedules aligned with your vet\'s plan.',
        'Note vaccine due dates on the calendar before travel or kennel stays.',
        'Annual wellness visits catch issues early - book the next slot after a visit.',
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

export function buildVisitCenter({
  visits,
}: {
  visits?: Record<string, unknown>[];
}): { visits: Record<string, unknown>[] } {
  return { visits: visits || [] };
}

export function buildRoutineCenter({
  reminders,
}: {
  reminders?: Record<string, unknown>[];
}): { reminders: Record<string, unknown>[] } {
  return { reminders: reminders || [] };
}

export function buildHomeSafetyMap(): { items: unknown[] } {
  return { items: [] };
}

export function buildTravelMode(): { items: unknown[] } {
  return { items: [] };
}

export function buildRecoveryMode(): { items: unknown[] } {
  return { items: [] };
}

export function buildVetExportPack(): { items: unknown[] } {
  return { items: [] };
}

export function buildKnowledgeFeed(): { items: unknown[] } {
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
    pack: ['Паспо��т питомца или данные чипа', 'Список недавних лекарств', 'Телефон постоянного врача'],
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

export function buildSmartIntentSuggestions(): unknown[] {
  return [];
}