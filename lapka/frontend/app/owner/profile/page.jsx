'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { validateStoredSession } from '@/lib/auth';

export default function OwnerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const sessionUser = await validateStoredSession();
        if (cancelled) return;
        setUser(sessionUser || null);
      } catch (e) {
        if (cancelled) return;
        setError(e.message || 'Не удалось загрузить профиль');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Профиль</h1>
          <p className="page-subtitle">Настройки владельца и роль доступа.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !user ? (
        <EmptyState title="Профиль недоступен" text="Выполните вход заново, чтобы открыть настройки." />
      ) : (
        <Card title="Аккаунт владельца" subtitle="Текущая сессия">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-lapka-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-lapka-500">Email</p>
              <p className="mt-1 text-sm font-semibold text-lapka-800">{user.email || '—'}</p>
            </div>
            <div className="rounded-xl border border-lapka-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-lapka-500">Роль</p>
              <p className="mt-1 text-sm font-semibold text-lapka-800">{user.role || 'owner'}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-lapka-600">
            Для изменения контактных данных в MVP используйте профиль администратора или seed-конфигурацию.
          </p>
        </Card>
      )}
    </>
  );
}
