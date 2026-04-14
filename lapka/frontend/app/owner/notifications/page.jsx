'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';
import { formatDateTimeLabel } from '@/lib/owner-workspace';

export default function OwnerNotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('latest');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = unreadOnly ? '?unread_only=true&limit=100' : '?limit=100';
      const payload = await apiRequest(`/api/v1/notifications${q}`);
      setRows(Array.isArray(payload) ? payload : []);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить уведомления');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = useMemo(() => rows.filter((r) => !r.is_read).length, [rows]);

  async function markOne(id) {
    setBusy(true);
    setError('');
    try {
      await apiRequest('/api/v1/notifications/mark-read', {
        method: 'POST',
        body: { notification_ids: [id], mark_all: false },
      });
      await load();
    } catch (e) {
      setError(e.message || 'Не удалось отметить прочитанным');
    } finally {
      setBusy(false);
    }
  }

  async function openNotification(notification) {
    const target = resolveLink(notification);
    if (!notification?.is_read) {
      try {
        await apiRequest('/api/v1/notifications/mark-read', {
          method: 'POST',
          body: { notification_ids: [notification.id], mark_all: false },
        });
        setRows((prev) =>
          prev.map((row) =>
            row.id === notification.id
              ? { ...row, is_read: true, read_at: new Date().toISOString() }
              : row
          )
        );
      } catch {
        // Non-blocking: still navigate to target screen.
      }
    }
    router.push(target);
  }

  async function markAll() {
    setBusy(true);
    setError('');
    try {
      await apiRequest('/api/v1/notifications/mark-read', {
        method: 'POST',
        body: { notification_ids: [], mark_all: true },
      });
      await load();
    } catch (e) {
      setError(e.message || 'Не удалось отметить все');
    } finally {
      setBusy(false);
    }
  }

  function resolveLink(n) {
    const meta = n?.metadata || {};
    if (meta.kind === 'consent_expiry' && n.pet_id) {
      const clinic = meta.clinic_id ? `&clinic_id=${encodeURIComponent(meta.clinic_id)}` : '';
      const scope = meta.scope_level ? `&scope=${encodeURIComponent(meta.scope_level)}` : '';
      return `/owner/pet/${n.pet_id}/consents?renew_consent=1&nid=${encodeURIComponent(n.id)}${clinic}${scope}`;
    }
    if (meta.kind === 'inpatient_digest') {
      return '/owner/inpatient?digest=1';
    }
    if (n.visit_id) return `/owner/visit/${n.visit_id}`;
    if (n.appointment_id) return `/owner/appointment/${n.appointment_id}`;
    if (n.notification_type === 'inpatient_update') return '/owner/inpatient';
    if (n.pet_id) return `/owner/pet/${n.pet_id}`;
    return '/owner/inbox';
  }

  function resolveTypeBadge(n) {
    const kind = n?.metadata?.kind;
    if (kind === 'consent_expiry') {
      return { label: 'Consent', cls: 'bg-amber-100 text-amber-800' };
    }
    if (kind === 'inpatient_digest') {
      return { label: 'Digest', cls: 'bg-teal-100 text-teal-800' };
    }
    if (n?.visit_id || n?.notification_type === 'visit_ready') {
      return { label: 'Визит', cls: 'bg-cyan-100 text-cyan-800' };
    }
    if (
      n?.appointment_id ||
      n?.notification_type === 'appointment_confirmed' ||
      n?.notification_type === 'appointment_reminder'
    ) {
      return { label: 'Запись', cls: 'bg-violet-100 text-violet-800' };
    }
    if (n?.notification_type === 'inpatient_update') {
      return { label: 'Стационар', cls: 'bg-emerald-100 text-emerald-800' };
    }
    return { label: 'Система', cls: 'bg-slate-100 text-slate-700' };
  }

  function resolveTypeKey(n) {
    const kind = n?.metadata?.kind;
    if (kind === 'consent_expiry') return 'consent';
    if (kind === 'inpatient_digest') return 'inpatient_digest';
    if (n?.visit_id || n?.notification_type === 'visit_ready') return 'visit';
    if (
      n?.appointment_id ||
      n?.notification_type === 'appointment_confirmed' ||
      n?.notification_type === 'appointment_reminder'
    ) {
      return 'appointment';
    }
    if (n?.notification_type === 'inpatient_update') return 'inpatient';
    return 'system';
  }

  const filteredRows = useMemo(() => {
    const base = typeFilter === 'all' ? rows : rows.filter((row) => resolveTypeKey(row) === typeFilter);
    const sorted = [...base].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return sortOrder === 'oldest' ? ta - tb : tb - ta;
    });
    return sorted;
  }, [rows, sortOrder, typeFilter]);

  const typeCounters = useMemo(() => {
    const counters = {
      all: rows.length,
      consent: 0,
      visit: 0,
      appointment: 0,
      inpatient_digest: 0,
      inpatient: 0,
      system: 0,
    };
    rows.forEach((row) => {
      const key = resolveTypeKey(row);
      if (counters[key] !== undefined) counters[key] += 1;
    });
    return counters;
  }, [rows]);

  useEffect(() => {
    const initialType = searchParams?.get('type') || 'all';
    const initialUnread = searchParams?.get('unread') === '1';
    const initialSort = searchParams?.get('sort') || 'latest';
    const allowed = new Set(['all', 'consent', 'visit', 'appointment', 'inpatient_digest', 'inpatient', 'system']);
    setTypeFilter(allowed.has(initialType) ? initialType : 'all');
    setUnreadOnly(initialUnread);
    setSortOrder(initialSort === 'oldest' ? 'oldest' : 'latest');
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams?.toString() || '');
    if (typeFilter === 'all') {
      next.delete('type');
    } else {
      next.set('type', typeFilter);
    }
    if (unreadOnly) {
      next.set('unread', '1');
    } else {
      next.delete('unread');
    }
    if (sortOrder === 'oldest') {
      next.set('sort', 'oldest');
    } else {
      next.delete('sort');
    }
    const qs = next.toString();
    const currentQs = searchParams?.toString() || '';
    if (qs === currentQs) return;
    router.replace(qs ? `/owner/notifications?${qs}` : '/owner/notifications');
  }, [router, searchParams, sortOrder, typeFilter, unreadOnly]);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">Уведомления</h1>
          <p className="page-subtitle">
            Сообщения от клиники и напоминания Lapka. Подробные диалоги — в разделе «Входящие».
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/owner/inbox" className="btn-secondary !min-h-[44px]">
            Входящие
          </Link>
          <button type="button" className="btn-primary !min-h-[44px]" disabled={busy || !unreadCount} onClick={markAll}>
            Прочитать все
          </button>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <Card
        title="Лента"
        subtitle={unreadCount ? `Непрочитанных: ${unreadCount}` : 'Все прочитаны'}
        action={
          <label className="flex cursor-pointer items-center gap-2 text-sm text-lapka-700">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Только непрочитанные
          </label>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            ['all', 'Все'],
            ['consent', 'Consent'],
            ['visit', 'Визиты'],
            ['appointment', 'Записи'],
            ['inpatient_digest', 'Digest'],
            ['inpatient', 'Стационар'],
            ['system', 'Система'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                typeFilter === key
                  ? 'border-teal-300 bg-teal-100 text-teal-800'
                  : 'border-lapka-200 bg-white text-lapka-700 hover:bg-lapka-50'
              }`}
            >
              {label} ({typeCounters[key] || 0})
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-lapka-600">Сортировка:</span>
          <button
            type="button"
            onClick={() => setSortOrder('latest')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              sortOrder === 'latest'
                ? 'border-teal-300 bg-teal-100 text-teal-800'
                : 'border-lapka-200 bg-white text-lapka-700 hover:bg-lapka-50'
            }`}
          >
            Сначала новые
          </button>
          <button
            type="button"
            onClick={() => setSortOrder('oldest')}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              sortOrder === 'oldest'
                ? 'border-teal-300 bg-teal-100 text-teal-800'
                : 'border-lapka-200 bg-white text-lapka-700 hover:bg-lapka-50'
            }`}
          >
            Сначала старые
          </button>
        </div>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filteredRows.length ? (
          <ul className="space-y-3">
            {filteredRows.map((n) => {
              const badge = resolveTypeBadge(n);
              return (
                <li
                  key={n.id}
                  className={`rounded-xl border p-4 transition ${n.is_read ? 'border-lapka-200 bg-white' : 'border-teal-200 bg-teal-50/40'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <p className="font-semibold text-lapka-900">{n.title || 'Уведомление'}</p>
                      </div>
                      {n.body ? <p className="mt-1 text-sm text-lapka-700 whitespace-pre-wrap">{n.body}</p> : null}
                      <p className="mt-2 text-xs text-lapka-500">
                        {formatDateTimeLabel(n.created_at)} · {n.notification_type || 'system'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      {!n.is_read ? (
                        <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => markOne(n.id)}>
                          Прочитано
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-primary !px-3 !py-1.5 text-center text-xs"
                        onClick={() => openNotification(n)}
                      >
                        Открыть
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="Пока пусто"
            text={
              typeFilter === 'all'
                ? 'Когда клиника отправит напоминание или обновление, оно появится здесь.'
                : 'Для выбранного типа уведомлений пока нет.'
            }
          />
        )}
      </Card>
    </div>
  );
}
