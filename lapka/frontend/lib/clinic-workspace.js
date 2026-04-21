export const CLINIC_SIDEBAR_GROUPS = [
  {
    titleKey: 'clinic.workspaceUi.sidebarGroupToday',
    links: [
      { href: '/clinic/dashboard', labelKey: 'clinic.workspaceUi.sidebarOpsCenter', icon: 'home' },
      { href: '/clinic/inbox', labelKey: 'clinic.workspaceUi.sidebarInboxSignals', icon: 'notifications' },
      { href: '/clinic/schedule', labelKey: 'nav.schedule', icon: 'appointments' },
      { href: '/clinic/flowboard', labelKey: 'clinic.workspaceUi.sidebarDayFlow', icon: 'records' },
      { href: '/clinic/checkin', labelKey: 'clinic.workspaceUi.sidebarReceptionRegistration', icon: 'appointments' },
    ],
  },
  {
    titleKey: 'clinic.workspaceUi.sidebarGroupTeamPatients',
    links: [
      { href: '/clinic/doctors', labelKey: 'clinic.workspaceUi.sidebarDoctorsTeam', icon: 'profile' },
      { href: '/clinic/patients', labelKey: 'nav.patients', icon: 'pets' },
      { href: '/clinic/inpatient', labelKey: 'nav.inpatient', icon: 'inpatient' },
    ],
  },
  {
    titleKey: 'clinic.workspaceUi.sidebarGroupOperations',
    links: [
      { href: '/clinic/services', labelKey: 'nav.services', icon: 'knowledge' },
      { href: '/clinic/templates', labelKey: 'nav.templates', icon: 'documents' },
      { href: '/clinic/billing', labelKey: 'clinic.workspaceUi.sidebarBillingFinance', icon: 'finance' },
      { href: '/clinic/insurance', labelKey: 'clinic.workspaceUi.sidebarInsuranceCases', icon: 'finance' },
    ],
  },
  {
    titleKey: 'clinic.workspaceUi.sidebarGroupPharmacy',
    links: [{ href: '/clinic/pharmacy', labelKey: 'clinic.workspaceUi.sidebarPharmacyStock', icon: 'pharmacy' }],
  },
  {
    titleKey: 'clinic.workspaceUi.sidebarGroupControl',
    links: [
      { href: '/clinic/analytics', labelKey: 'nav.analytics', icon: 'records' },
      { href: '/clinic/audit', labelKey: 'nav.audit', icon: 'knowledge' },
      { href: '/clinic/invites', labelKey: 'nav.invites', icon: 'profile' },
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
