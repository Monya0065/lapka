'use client';

const DB_NAME = 'lapka_offline';
const DB_VERSION = 1;
const KV_STORE = 'kv';
const QUEUE_STORE = 'queue';

function canUseIndexedDB() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDB()) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let callbackResult;
    try {
      callbackResult = callback(store);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(callbackResult);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function setOfflineValue(key, value) {
  if (!canUseIndexedDB()) return;
  await withStore(KV_STORE, 'readwrite', (store) => {
    store.put(value, key);
  });
}

export async function getOfflineValue(key) {
  if (!canUseIndexedDB()) return null;
  return withStore(KV_STORE, 'readonly', (store) => {
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  });
}

export async function removeOfflineValue(key) {
  if (!canUseIndexedDB()) return;
  await withStore(KV_STORE, 'readwrite', (store) => {
    store.delete(key);
  });
}

export async function enqueueOfflineRequest(payload) {
  if (!canUseIndexedDB()) return null;
  return withStore(QUEUE_STORE, 'readwrite', (store) => {
    const request = store.add({
      ...payload,
      createdAt: payload.createdAt || new Date().toISOString(),
    });
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  });
}

export async function listOfflineQueue() {
  if (!canUseIndexedDB()) return [];
  return withStore(QUEUE_STORE, 'readonly', (store) => {
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  });
}

export async function removeOfflineQueueItem(id) {
  if (!canUseIndexedDB()) return;
  await withStore(QUEUE_STORE, 'readwrite', (store) => {
    store.delete(id);
  });
}

export async function clearOfflineQueue() {
  if (!canUseIndexedDB()) return;
  await withStore(QUEUE_STORE, 'readwrite', (store) => {
    store.clear();
  });
}

