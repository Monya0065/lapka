import { ROLE_ROUTES } from '@/lib/constants';

export const STORAGE_KEYS = {
  role: 'lapka.role',
  email: 'lapka.email',
  access: 'lapka.access_token',
  refresh: 'lapka.refresh_token',
  user: 'lapka.user',
  csrf: 'lapka.csrf_token',
  clinicScope: 'lapka.selected_clinic_id',
};

export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

function safeStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function getOrCreateCsrfToken() {
  const storage = safeStorage();
  if (!storage || typeof window === 'undefined') return '';

  let token = storage.getItem(STORAGE_KEYS.csrf);
  if (token && token.length >= 16) return token;

  const random = new Uint8Array(24);
  window.crypto.getRandomValues(random);
  token = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
  storage.setItem(STORAGE_KEYS.csrf, token);
  return token;
}

export function broadcastAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lapka-auth-change'));
  }
}

export function getStoredSession() {
  const storage = safeStorage();
  if (!storage) return { role: null, email: null, accessToken: null, refreshToken: null, user: null };

  const userRaw = storage.getItem(STORAGE_KEYS.user);
  let user = null;
  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }

  return {
    role: storage.getItem(STORAGE_KEYS.role),
    email: storage.getItem(STORAGE_KEYS.email),
    accessToken: storage.getItem(STORAGE_KEYS.access),
    refreshToken: storage.getItem(STORAGE_KEYS.refresh),
    user,
  };
}

export function saveSession({ role, email, accessToken, refreshToken, user }) {
  const storage = safeStorage();
  if (!storage) return;
  if (role) storage.setItem(STORAGE_KEYS.role, role);
  if (email) storage.setItem(STORAGE_KEYS.email, email);
  if (accessToken) storage.setItem(STORAGE_KEYS.access, accessToken);
  if (refreshToken) storage.setItem(STORAGE_KEYS.refresh, refreshToken);
  if (user) storage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  broadcastAuthChange();
}

export function clearSession() {
  const storage = safeStorage();
  if (!storage) return;
  storage.removeItem(STORAGE_KEYS.role);
  storage.removeItem(STORAGE_KEYS.email);
  storage.removeItem(STORAGE_KEYS.access);
  storage.removeItem(STORAGE_KEYS.refresh);
  storage.removeItem(STORAGE_KEYS.user);
  storage.removeItem(STORAGE_KEYS.csrf);
  storage.removeItem(STORAGE_KEYS.clinicScope);
  broadcastAuthChange();
}

export function authHeaders(extra = {}) {
  const { accessToken } = getStoredSession();
  const headers = { ...extra };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function fetchCurrentUser(accessToken) {
  const token = accessToken || getStoredSession().accessToken;
  if (!token) return null;

  const response = await fetch(`${getApiBase()}/api/v1/auth/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;
  return response.json();
}

export async function loginWithPassword(email, password, clinicId) {
  const body = { email, password };
  if (clinicId) body.clinic_id = clinicId;
  const response = await fetch(`${getApiBase()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = 'Ошибка входа';
    try {
      const body = await response.json();
      message = body?.detail?.message || body?.message || message;
    } catch {
      // noop
    }
    throw new Error(message);
  }

  const tokens = await response.json();
  const user = await fetchCurrentUser(tokens.access_token);
  if (!user) throw new Error('Не удалось получить профиль пользователя после входа');

  const storage = safeStorage();
  if (storage) {
    // keep the chosen clinic id separately for UI purposes
    storage.setItem(STORAGE_KEYS.clinicScope, clinicId || '');
  }

  saveSession({
    role: user.role,
    email: user.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    user,
  });

  return { user, tokens };
}

export async function selectClinic(clinicId) {
  const { accessToken } = getStoredSession();
  if (!accessToken) throw new Error('Not logged in');
  const response = await fetch(`${getApiBase()}/api/v1/auth/select-clinic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ clinic_id: clinicId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.detail?.message || 'Failed to select clinic');
  }
  const tokens = await response.json();
  if (tokens.access_token) {
    const user = await fetchCurrentUser(tokens.access_token);
    saveSession({
      role: user.role,
      email: user.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || getStoredSession().refreshToken,
      user,
    });
    const storage = safeStorage();
    if (storage) storage.setItem(STORAGE_KEYS.clinicScope, clinicId);
  }
  return tokens.access_token;
}

export async function logoutUser() {
  const { refreshToken, accessToken } = getStoredSession();
  const csrfToken = getOrCreateCsrfToken();
  if (refreshToken && accessToken) {
    try {
      await fetch(`${getApiBase()}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Ignore network/logout errors and clear local session anyway.
    }
  }
  clearSession();
}

export async function validateStoredSession() {
  const session = getStoredSession();
  if (!session.accessToken) return null;
  const user = await fetchCurrentUser(session.accessToken);
  if (!user) {
    clearSession();
    return null;
  }
  saveSession({
    role: user.role,
    email: user.email,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user,
  });
  return user;
}

export function roleHome(role) {
  return ROLE_ROUTES[role] || '/login';
}
