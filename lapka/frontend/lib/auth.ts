import { ROLE_ROUTES } from './constants';
import type { Role, StoredSession, User, LoginTokens } from './types';

export const STORAGE_KEYS = {
  role: 'lapka.role',
  email: 'lapka.email',
  access: 'lapka.access_token',
  refresh: 'lapka.refresh_token',
  user: 'lapka.user',
  csrf: 'lapka.csrf_token',
  clinicScope: 'lapka.selected_clinic_id',
} as const;

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function getOrCreateCsrfToken(): string {
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

export function broadcastAuthChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lapka-auth-change'));
  }
}

export function getStoredSession(): StoredSession {
  const storage = safeStorage();
  if (!storage) return { role: null, email: null, accessToken: null, refreshToken: null, user: null };

  const userRaw = storage.getItem(STORAGE_KEYS.user);
  let user: User | null = null;
  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }

  return {
    role: storage.getItem(STORAGE_KEYS.role) as Role,
    email: storage.getItem(STORAGE_KEYS.email),
    accessToken: storage.getItem(STORAGE_KEYS.access),
    refreshToken: storage.getItem(STORAGE_KEYS.refresh),
    user,
  };
}

export function saveSession({ role, email, accessToken, refreshToken, user }: StoredSession): void {
  const storage = safeStorage();
  if (!storage) return;
  if (role) storage.setItem(STORAGE_KEYS.role, role);
  if (email) storage.setItem(STORAGE_KEYS.email, email);
  if (accessToken) storage.setItem(STORAGE_KEYS.access, accessToken);
  if (refreshToken) storage.setItem(STORAGE_KEYS.refresh, refreshToken);
  if (user) storage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  broadcastAuthChange();
}

export function clearSession(): void {
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

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const { accessToken } = getStoredSession();
  const headers: Record<string, string> = { ...extra };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function fetchCurrentUser(accessToken?: string): Promise<User | null> {
  const token = accessToken || getStoredSession().accessToken;
  if (!token) return null;

  const response = await fetch(`${getApiBase()}/api/v1/auth/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;
  return response.json();
}

export async function loginWithPassword(email: string, password: string, clinicId?: string): Promise<{ user: User; tokens: LoginTokens }> {
  const body: Record<string, string> = { email, password };
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

  const tokens: LoginTokens = await response.json();
  const user = await fetchCurrentUser(tokens.access_token);
  if (!user) throw new Error('Не удалось получить профиль пользователя после входа');

  const storage = safeStorage();
  if (storage) {
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

export async function selectClinic(clinicId: string): Promise<string> {
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
  const tokens: LoginTokens = await response.json();
  if (tokens.access_token) {
    const user = await fetchCurrentUser(tokens.access_token);
    saveSession({
      role: user?.role || getStoredSession().role,
      email: user?.email || getStoredSession().email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || getStoredSession().refreshToken,
      user: user || null,
    });
    const storage = safeStorage();
    if (storage) storage.setItem(STORAGE_KEYS.clinicScope, clinicId);
  }
  return tokens.access_token;
}

export async function logoutUser(): Promise<void> {
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

export async function validateStoredSession(): Promise<User | null> {
  const session = getStoredSession();
  if (!session.accessToken) return null;
  try {
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
  } catch {
    // Network / fetch failures: treat session as invalid to avoid RoleGate "checking" loops.
    clearSession();
    return null;
  }
}

export function roleHome(role: Role): string {
  return ROLE_ROUTES[role || ''] || '/login';
}