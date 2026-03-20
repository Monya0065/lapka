export const DEFAULT_CLINIC_ID = process.env.NEXT_PUBLIC_DEMO_CLINIC_ID || '11111111-1111-1111-1111-111111111111';
export const BARSIK_PET_ID = process.env.NEXT_PUBLIC_DEMO_BARSIK_PET_ID || '55555555-5555-5555-5555-555555555555';
export const BARSIK_VISIT_ID = process.env.NEXT_PUBLIC_DEMO_BARSIK_VISIT_ID || '66666666-6666-6666-6666-666666666666';
export const BARSIK_STAY_ID = process.env.NEXT_PUBLIC_DEMO_BARSIK_STAY_ID || '77777777-7777-7777-7777-777777777777';

export const ROLE_ROUTES = {
  owner: '/owner/dashboard',
  vet: '/vet/dashboard',
  clinic_admin: '/clinic/dashboard',
  network_admin: '/platform/dashboard',
};

export const ROLE_PRESETS = {
  owner: { email: 'owner@lapka.local', password: 'demo12345', label: 'Владелец' },
  vet: { email: 'vet@lapka.local', password: 'demo12345', label: 'Врач' },
  clinic_admin: { email: 'admin@lapka.local', password: 'demo12345', label: 'Администратор клиники' },
  network_admin: { email: 'platform@lapka.local', password: 'demo12345', label: 'Суперпользователь' },
};
