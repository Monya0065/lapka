'use client';

import { useEffect, useState } from 'react';
import { listOfflineQueue } from '@/lib/offlineStore';
import { syncQueuedRequests } from '@/lib/api';

export default function OfflineModeBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState('');

  async function refreshQueueCount() {
    try {
      const queue = await listOfflineQueue();
      setQueueCount(Array.isArray(queue) ? queue.length : 0);
    } catch {
      setQueueCount(0);
    }
  }

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    refreshQueueCount();

    const onOnline = async () => {
      setIsOnline(true);
      await refreshQueueCount();
      const result = await syncQueuedRequests();
      if (result.synced > 0 || result.failed > 0) {
        setLastSyncInfo(`Синхронизировано: ${result.synced}, ошибок: ${result.failed}`);
      }
      await refreshQueueCount();
    };

    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const timer = window.setInterval(refreshQueueCount, 15000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(timer);
    };
  }, []);

  async function onManualSync() {
    setIsSyncing(true);
    const result = await syncQueuedRequests();
    setLastSyncInfo(`Синхронизировано: ${result.synced}, ошибок: ${result.failed}`);
    await refreshQueueCount();
    setIsSyncing(false);
  }

  if (isOnline && queueCount === 0 && !lastSyncInfo) return null;

  return (
    <div
      className={`rounded-2xl border px-3 py-2 text-sm ${
        isOnline
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {isOnline ? 'Сеть доступна' : 'Offline mode активен'}
        </span>
        <span>Локальная очередь: {queueCount}</span>
        {isOnline && queueCount > 0 ? (
          <button type="button" className="btn-secondary !px-3 !py-1 text-xs" onClick={onManualSync} disabled={isSyncing}>
            {isSyncing ? 'Синхронизация...' : 'Синхронизировать'}
          </button>
        ) : null}
      </div>
      {lastSyncInfo ? <p className="mt-1 text-xs">{lastSyncInfo}</p> : null}
    </div>
  );
}
