'use client';

const DB_NAME = 'lapka_offline';
const DB_VERSION = 1;
const KV_STORE = 'kv';
const QUEUE_STORE = 'queue';

function canUseIndexedDB(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb(): Promise<IDBDatabase | null> {
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

async function withStore<T>(storeName: string, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => T | Promise<T>): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let callbackResult: T | Promise<T>;
    try {
      callbackResult = callback(store);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => {
      Promise.resolve(callbackResult).then(resolve);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function setOfflineValue(key: string, value: unknown): Promise<void> {
  if (!canUseIndexedDB()) return;
  await withStore(KV_STORE, 'readwrite', (store) => {
    store.put(value, key);
  });
}

export async function getOfflineValue<T = unknown>(key: string): Promise<T | null> {
  if (!canUseIndexedDB()) return null;
  const db = await openDb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    const tx = db.transaction(KV_STORE, 'readonly');
    const store = tx.objectStore(KV_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result as T) ?? null);
    request.onerror = () => resolve(null);
  });
}

export async function removeOfflineValue(key: string): Promise<void> {
  if (!canUseIndexedDB()) return;
  await withStore(KV_STORE, 'readwrite', (store) => {
    store.delete(key);
  });
}

interface QueueItem {
  id?: number;
  path: string;
  method: string;
  body: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  createdAt?: string;
}

export async function enqueueOfflineRequest(payload: QueueItem): Promise<number | null> {
  if (!canUseIndexedDB()) return null;
  const db = await openDb();
  if (!db) return null;
  return new Promise<number | null>((resolve) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const request = store.add({
      ...payload,
      createdAt: payload.createdAt || new Date().toISOString(),
    });
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => resolve(null);
  });
}

export async function listOfflineQueue(): Promise<QueueItem[]> {
  if (!canUseIndexedDB()) return [];
  const db = await openDb();
  if (!db) return [];
  return new Promise<QueueItem[]>((resolve) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const store = tx.objectStore(QUEUE_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
}

export async function removeOfflineQueueItem(id: string | number): Promise<void> {
  if (!canUseIndexedDB()) return;
  await withStore(QUEUE_STORE, 'readwrite', (store) => {
    store.delete(id);
  });
}

export async function clearOfflineQueue(): Promise<void> {
  if (!canUseIndexedDB()) return;
  await withStore(QUEUE_STORE, 'readwrite', (store) => {
    store.clear();
  });
}