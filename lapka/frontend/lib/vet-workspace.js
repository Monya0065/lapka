export const VET_SIDEBAR_GROUPS = [
  {
    titleKey: 'vet.workspaceUi.sidebarGroupToday',
    links: [
      { href: '/vet/dashboard', labelKey: 'vet.workspaceUi.sidebarShiftOverview', icon: 'home' },
      { href: '/vet/inbox', labelKey: 'vet.workspaceUi.sidebarInboxSignals', icon: 'notifications' },
      { href: '/vet/appointments', labelKey: 'vet.workspaceUi.sidebarCheckinFlow', icon: 'appointments' },
    ],
  },
  {
    titleKey: 'vet.workspaceUi.sidebarGroupPatients',
    links: [
      { href: '/vet/patients', labelKey: 'vet.workspaceUi.sidebarPatientSearch', icon: 'pets' },
      { href: '/vet/documents', labelKey: 'nav.documents', icon: 'documents' },
      { href: '/vet/labs', labelKey: 'nav.labs', icon: 'records' },
    ],
  },
  {
    titleKey: 'vet.workspaceUi.sidebarGroupClinical',
    links: [
      { href: '/vet/inpatient', labelKey: 'nav.inpatient', icon: 'inpatient' },
      { href: '/clinical/protocols', labelKey: 'nav.protocols', icon: 'knowledge' },
      { href: '/vet/drugs', labelKey: 'nav.drugs', icon: 'pharmacy' },
    ],
  },
  {
    titleKey: 'vet.workspaceUi.sidebarGroupTools',
    links: [
      { href: '/vet/tools', labelKey: 'vet.workspaceUi.sidebarCalculatorsTools', icon: 'tools' },
      { href: '/vet/assistant', labelKey: 'nav.aiAssistant', icon: 'sos' },
    ],
  },
];

/** Keys under `vet.workspaceUi` for the shift checklist in `VetLayout`. */
export const VET_SHIFT_TASK_KEYS = [
  'vet.workspaceUi.shiftTask1',
  'vet.workspaceUi.shiftTask2',
  'vet.workspaceUi.shiftTask3',
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
