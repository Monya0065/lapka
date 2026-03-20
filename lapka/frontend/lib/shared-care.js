const STORAGE_KEY = 'lapka.owner.shared-care.v1';

export const SHARED_CARE_SCOPES = [
  { id: 'timeline', label: 'Лента здоровья' },
  { id: 'medications', label: 'Лекарства и назначения' },
  { id: 'documents', label: 'Документы и выписки' },
  { id: 'appointments', label: 'Записи и визиты' },
  { id: 'care', label: 'Уход и routines' },
];

function isBrowser() {
  return typeof window !== 'undefined';
}

function parseStoredValue(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadSharedCareTeam() {
  if (!isBrowser()) return [];
  return parseStoredValue(window.localStorage.getItem(STORAGE_KEY));
}

export function saveSharedCareTeam(rows) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function addSharedCareMember(payload) {
  const current = loadSharedCareTeam();
  const row = {
    id: `care-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    full_name: String(payload.full_name || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    relation: String(payload.relation || '').trim() || 'Член семьи',
    pet_ids: Array.isArray(payload.pet_ids) ? payload.pet_ids : [],
    scopes: Array.isArray(payload.scopes) ? payload.scopes : [],
    note: String(payload.note || '').trim(),
    created_at: new Date().toISOString(),
  };
  const next = [row, ...current];
  saveSharedCareTeam(next);
  return row;
}

export function removeSharedCareMember(memberId) {
  const next = loadSharedCareTeam().filter((row) => row.id !== memberId);
  saveSharedCareTeam(next);
  return next;
}

export function summarizeSharedCare(rows = [], referrals = []) {
  const family = rows.filter((row) => /сем|family|род/i.test(row.relation || '')).length;
  const caregivers = rows.length;
  const activeInvites = referrals.filter((row) => row.status === 'sent').length;
  const connected = referrals.filter((row) => row.status === 'registered').length;
  return {
    family,
    caregivers,
    activeInvites,
    connected,
  };
}
