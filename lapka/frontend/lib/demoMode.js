import { BARSIK_PET_ID, BARSIK_VISIT_ID, BARSIK_STAY_ID, ROLE_PRESETS, ROLE_ROUTES } from '@/lib/constants';

export const DEMO_SCENARIOS = {
  owner: {
    role: 'owner',
    startHref: ROLE_ROUTES.owner,
    steps: [
      { key: 'pets', href: '/owner/pets' },
      { key: 'barsik', href: `/owner/pet/${BARSIK_PET_ID}` },
      { key: 'documents', href: `/owner/pet/${BARSIK_PET_ID}/documents` },
      { key: 'inpatient', href: `/owner/inpatient/${BARSIK_STAY_ID}` },
      { key: 'pharmacy', href: '/owner/pharmacy' },
    ],
  },
  vet: {
    role: 'vet',
    startHref: ROLE_ROUTES.vet,
    steps: [
      { key: 'search', href: '/vet/patients' },
      { key: 'barsik', href: `/vet/patient/${BARSIK_PET_ID}` },
      { key: 'visit', href: `/vet/visit/${BARSIK_VISIT_ID}` },
      { key: 'pdf', href: `/vet/visit/${BARSIK_VISIT_ID}` },
      { key: 'inpatient', href: `/vet/inpatient/${BARSIK_STAY_ID}` },
    ],
  },
  clinic_admin: {
    role: 'clinic_admin',
    startHref: ROLE_ROUTES.clinic_admin,
    steps: [
      { key: 'schedule', href: '/clinic/schedule' },
      { key: 'patients', href: '/clinic/patients' },
      { key: 'service', href: '/clinic/services' },
      { key: 'invoice', href: '/clinic/billing' },
      { key: 'audit', href: '/clinic/audit' },
    ],
  },
};

export const DEMO_ROLE_ORDER = ['owner', 'vet', 'clinic_admin'];

export function resolveDemoRoleFromPath(pathname = '') {
  if (pathname.startsWith('/vet')) return 'vet';
  if (pathname.startsWith('/clinic')) return 'clinic_admin';
  return 'owner';
}

export function demoCredentialsRows() {
  return DEMO_ROLE_ORDER.map((role) => ({
    role,
    email: ROLE_PRESETS[role].email,
    password: ROLE_PRESETS[role].password,
  }));
}
