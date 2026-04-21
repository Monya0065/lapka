import { clearSession, getApiBase, getStoredSession } from '@/lib/auth';
import {
  enqueueOfflineRequest,
  getOfflineValue,
  listOfflineQueue,
  removeOfflineQueueItem,
  setOfflineValue,
} from '@/lib/offlineStore';

const memoryCache = new Map();
const inFlightGetRequests = new Map();
let syncInProgress = false;

const OFFLINE_CACHE_PREFIX = 'api-cache:v1:';
const CSRF_STORAGE_KEY = 'lapka.csrf_token';

function isBrowser() {
  return typeof window !== 'undefined';
}

function cacheKey(path, method, auth, token) {
  return `${method}|${auth ? token || 'anon' : 'public'}|${path}`;
}

function offlineCacheKey(path, method, auth) {
  return `${OFFLINE_CACHE_PREFIX}${cacheKey(path, method, auth, null)}`;
}

function isOfflineNetworkError(error) {
  if (!error) return false;
  if (error?.name === 'TypeError') return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('network');
}

function resolveDefaultTtl(path) {
  const endpoint = String(path || '');
  const rules = [
    { pattern: /^\/api\/v1\/vpn\//i, ttl: 0 },
    { pattern: /^\/api\/v1\/(pets|clinics|clinic\/services|diseases|drugs|catalog|symptoms)/i, ttl: 60_000 },
    { pattern: /^\/api\/v1\/(appointments|visits|documents|owner\/invoices|clinic\/invoices|notifications)/i, ttl: 20_000 },
    { pattern: /^\/api\/v1\/(inpatient|clinic\/analytics|clinic\/search\/patients|owner\/search\/pets)/i, ttl: 12_000 },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(endpoint)) return rule.ttl;
  }
  return 8_000;
}

function getOrCreateCsrfToken() {
  if (!isBrowser()) return '';
  const storage = window.localStorage;
  let token = storage.getItem(CSRF_STORAGE_KEY);
  if (token && token.length >= 16) return token;

  const random = new Uint8Array(24);
  window.crypto.getRandomValues(random);
  token = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
  storage.setItem(CSRF_STORAGE_KEY, token);
  return token;
}

async function requestDirect(path, { method = 'GET', body = null, auth = true, headers = {} } = {}) {
  const session = getStoredSession();
  const finalHeaders = { ...headers };
  if (!body?.__formData) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (auth && session.accessToken) {
    finalHeaders.Authorization = `Bearer ${session.accessToken}`;
  }
  if (String(method || 'GET').toUpperCase() !== 'GET') {
    const csrfToken = getOrCreateCsrfToken();
    if (csrfToken) {
      finalHeaders['X-CSRF-Token'] = csrfToken;
    }
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: finalHeaders,
    body: body?.__formData ? body.__formData : body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearSession();
    }
    const message = payload?.detail?.message || payload?.message || 'Ошибка API';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function syncQueuedRequests() {
  if (!isBrowser()) return { synced: 0, failed: 0 };
  if (syncInProgress) return { synced: 0, failed: 0 };
  if (!window.navigator.onLine) return { synced: 0, failed: 0 };

  syncInProgress = true;
  let synced = 0;
  let failed = 0;

  try {
    const queue = await listOfflineQueue();
    const ordered = [...queue].sort((a, b) => Number(a.id) - Number(b.id));

    for (const item of ordered) {
      try {
        await requestDirect(item.path, {
          method: item.method || 'POST',
          body: item.body || null,
          auth: item.auth !== false,
          headers: item.headers || {},
        });
        await removeOfflineQueueItem(item.id);
        synced += 1;
      } catch {
        failed += 1;
      }
    }
  } finally {
    syncInProgress = false;
  }

  return { synced, failed };
}

if (isBrowser() && !window.__LAPKA_OFFLINE_SYNC_BOUND__) {
  window.__LAPKA_OFFLINE_SYNC_BOUND__ = true;
  window.addEventListener('online', () => {
    syncQueuedRequests();
  });
}

export async function apiRequest(
  path,
  {
    method = 'GET',
    body = null,
    auth = true,
    headers = {},
    cacheTtlMs = null,
    noCache = false,
    queueOnOffline = false,
  } = {}
) {
  const session = getStoredSession();
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const effectiveCacheTtlMs = cacheTtlMs == null ? resolveDefaultTtl(path) : cacheTtlMs;
  const isCacheable = normalizedMethod === 'GET' && !body?.__formData && !noCache && effectiveCacheTtlMs > 0;
  const key = isCacheable ? cacheKey(path, normalizedMethod, auth, session.accessToken) : null;
  const offlineKey = isCacheable ? offlineCacheKey(path, normalizedMethod, auth) : null;
  let staleValue = null;

  if (key && memoryCache.has(key)) {
    const cached = memoryCache.get(key);
    if (cached.expiresAt > Date.now()) {
      return cached.value;
    }
    staleValue = cached.value;
    memoryCache.delete(key);
  }

  if (isCacheable && isBrowser() && !window.navigator.onLine && offlineKey) {
    const offlineCached = await getOfflineValue(offlineKey);
    if (offlineCached) {
      return offlineCached;
    }
  }

  if (key && inFlightGetRequests.has(key)) {
    return inFlightGetRequests.get(key);
  }

  let payload = null;
  const executeRequest = async () => {
    try {
      payload = await requestDirect(path, {
        method: normalizedMethod,
        body,
        auth,
        headers,
      });
    } catch (error) {
      const networkFailure = isOfflineNetworkError(error);

      if (isCacheable && offlineKey) {
        const offlineCached = await getOfflineValue(offlineKey);
        if (offlineCached) {
          return offlineCached;
        }
      }

      // Graceful degradation: serve stale memory value on transient network failure.
      if (networkFailure && staleValue !== null) {
        return staleValue;
      }

      if (queueOnOffline && normalizedMethod !== 'GET' && !body?.__formData && networkFailure) {
        await enqueueOfflineRequest({
          path,
          method: normalizedMethod,
          body,
          auth,
          headers,
        });
        return {
          queued: true,
          offline: true,
          message: 'Изменения сохранены локально и будут отправлены после восстановления сети.',
        };
      }

      throw error;
    }

    if (key) {
      memoryCache.set(key, {
        expiresAt: Date.now() + effectiveCacheTtlMs,
        value: payload,
      });
    } else if (normalizedMethod !== 'GET') {
      memoryCache.clear();
    }

    if (offlineKey && payload !== null) {
      await setOfflineValue(offlineKey, payload);
    }

    return payload;
  };

  const requestPromise = executeRequest();
  if (key) {
    inFlightGetRequests.set(key, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (key) {
      inFlightGetRequests.delete(key);
    }
  }
}

export function clearApiMemoryCache() {
  memoryCache.clear();
}

export async function getOfflineCacheStats() {
  const queue = await listOfflineQueue();
  try {
    const keys = isBrowser() ? Object.keys(window.localStorage || {}).length : 0;
    return { queuedRequests: queue.length, localStorageKeys: keys };
  } catch {
    return { queuedRequests: queue.length, localStorageKeys: 0 };
  }
}
