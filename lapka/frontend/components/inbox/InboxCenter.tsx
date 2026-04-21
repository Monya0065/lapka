'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';

const INBOX_CONFIG = {
  owner: {
    title: 'Входящие и сигналы',
    subtitle: 'Напоминания о визитах, готовые выписки, сигналы стационара и всё, что требует внимания владельца.',
    emptyTitle: 'Сигналов пока нет',
    emptyText: 'Новые напоминания, выписки и обновления стационара появятся здесь.',
    actions: [
      { href: '/owner/calendar', label: 'Календарь и напоминания' },
      { href: '/owner/records', label: 'Лента здоровья' },
      { href: '/owner/inpatient', label: 'Стационар' },
    ],
  },
  vet: {
    title: 'Входящие и сигналы врача',
    subtitle: 'Критические сигналы, новые документы, результаты лаборатории и всё, что влияет на поток смены.',
    emptyTitle: 'Новых сигналов нет',
    emptyText: 'Когда появятся документы, лабораторные результаты или сигналы стационара, они появятся здесь.',
    actions: [
      { href: '/vet/appointments', label: 'Поток приёма' },
      { href: '/vet/labs', label: 'Лаборатория' },
      { href: '/vet/patients', label: 'Поиск пациентов' },
    ],
  },
  clinic: {
    title: 'Входящие и сигналы клиники',
    subtitle: 'Операционные сигналы для ресепшн, очереди, стационара и административного контроля.',
    emptyTitle: 'Операционных сигналов нет',
    emptyText: 'Здесь появятся сигналы по регистрациям, стационару, записям и контролю качества.',
    actions: [
      { href: '/clinic/checkin', label: 'Ресепшн и регистрация' },
      { href: '/clinic/schedule', label: 'Расписание' },
      { href: '/clinic/inpatient', label: 'Стационар' },
    ],
  },
  platform: {
    title: 'Входящие платформы',
    subtitle: 'Системные сигналы, контроль AI, безопасность и сводка по клиникам сети.',
    emptyTitle: 'Системных сигналов нет',
    emptyText: 'Когда появятся системные события, они будут собраны здесь.',
    actions: [
      { href: '/platform/dashboard', label: 'Платформа' },
      { href: '/platform/security', label: 'Безопасность' },
      { href: '/platform/ai', label: 'Центр AI' },
    ],
  },
};

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function notificationKindLabel(type, metadata) {
  if (metadata?.kind === 'pharmacy_expiration_alert') {
    const within = metadata?.within_days;
    if (within) return `Склад: срок до ${within} дн.`;
    return 'Склад: срок годности';
  }

  switch (String(type || '')) {
    case 'appointment_confirmed':
      return 'Подтверждённая запись';
    case 'appointment_reminder':
      return 'Напоминание';
    case 'visit_ready':
      return 'Выписка готова';
    case 'inpatient_update':
      return 'Стационар';
    default:
      return 'Сигнал';
  }
}

function notificationTone(type, isRead, metadata) {
  if (isRead) return 'border-lapka-200 bg-white';
  if (metadata?.kind === 'pharmacy_expiration_alert') {
    const within = metadata?.within_days;
    return within === 7 ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/55';
  }
  if (type === 'visit_ready') return 'border-emerald-200 bg-emerald-50/60';
  if (type === 'inpatient_update') return 'border-cyan-200 bg-cyan-50/60';
  return 'border-amber-200 bg-amber-50/55';
}

function buildNotificationHref(role, row) {
  const metadata = row?.metadata || {};
  const petId = row?.pet_id;
  const visitId = row?.visit_id || metadata.visit_id;
  const appointmentId = row?.appointment_id || metadata.appointment_id;
  const stayId = metadata.stay_id || metadata.inpatient_stay_id;
  const type = String(row?.notification_type || '');

  if (role === 'clinic' && metadata?.kind === 'pharmacy_expiration_alert') {
    const within = metadata?.within_days || 7;
    return `/clinic/pharmacy?expires_within_days=${within}`;
  }

  if (role === 'owner') {
    if (type === 'visit_ready' && petId) return `/owner/pet/${petId}/records`;
    if ((type === 'appointment_confirmed' || type === 'appointment_reminder') && appointmentId) return `/owner/appointment/${appointmentId}`;
    if (type === 'inpatient_update' && stayId) return `/owner/inpatient/${stayId}`;
    return '/owner/dashboard';
  }

  if (role === 'vet') {
    if (visitId) return `/vet/visit/${visitId}`;
    if (type === 'inpatient_update' && stayId) return `/vet/inpatient/${stayId}`;
    if (petId) return `/vet/patient/${petId}`;
    return '/vet/dashboard';
  }

  if (role === 'clinic') {
    if (type === 'appointment_confirmed' || type === 'appointment_reminder') return '/clinic/checkin';
    if (type === 'inpatient_update' && stayId) return `/clinic/inpatient/${stayId}`;
    if (petId) return `/clinic/patients/${petId}`;
    return '/clinic/dashboard';
  }

  if (visitId) return '/platform/dashboard';
  return '/platform/dashboard';
}

export default function InboxCenter({ role = 'owner' }) {
  const config = INBOX_CONFIG[role] || INBOX_CONFIG.owner;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/api/v1/notifications?limit=100');
      setNotifications(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить входящие');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(() => notifications.filter((row) => !row.is_read).length, [notifications]);
  const grouped = useMemo(() => {
    const unread = notifications.filter((row) => !row.is_read);
    const read = notifications.filter((row) => row.is_read);
    return { unread, read };
  }, [notifications]);

  async function markRead(notificationIds, markAll = false) {
    if (!markAll && !notificationIds.length) return;
    try {
      await apiRequest('/api/v1/notifications/mark-read', {
        method: 'POST',
        body: markAll ? { mark_all: true } : { notification_ids: notificationIds },
      });
      setNotifications((prev) =>
        prev.map((row) =>
          markAll || notificationIds.includes(row.id)
            ? { ...row, is_read: true, read_at: row.read_at || new Date().toISOString() }
            : row
        )
      );
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отметить уведомление');
    }
  }

  async function onMarkAll() {
    setMarkingAll(true);
    await markRead([], true);
    setMarkingAll(false);
  }

  async function onMarkOne(id) {
    setMarkingId(id);
    await markRead([id], false);
    setMarkingId('');
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">{config.title}</h1>
          <p className="page-subtitle">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="pill !px-4 !py-2 text-sm font-semibold">{notifications.length} всего</span>
          <span className="pill !px-4 !py-2 text-sm font-semibold">{unreadCount} непрочитано</span>
          <button className="btn-secondary" type="button" onClick={loadNotifications}>
            Обновить
          </button>
          <button className="btn-primary" type="button" onClick={onMarkAll} disabled={!unreadCount || markingAll}>
            {markingAll ? 'Отмечаем...' : 'Прочитать всё'}
          </button>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadNotifications} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-80 w-full" />
        </section>
      ) : notifications.length ? (
        <>
          <section className="grid items-start gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
            <Card title="Новые сигналы" subtitle="То, что требует внимания в первую очередь.">
              {grouped.unread.length ? (
                <div className="space-y-3">
                  {grouped.unread.map((row) => (
                          <article
                      key={row.id}
                      className={`rounded-[24px] border px-4 py-4 ${notificationTone(row.notification_type, row.is_read, row.metadata)}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="pill !px-3 !py-1.5 text-xs font-semibold">{notificationKindLabel(row.notification_type, row.metadata)}</span>
                            <span className="text-sm text-lapka-500">{formatDateTime(row.created_at)}</span>
                          </div>
                          <h3 className="mt-3 text-xl font-black text-lapka-950">{row.title}</h3>
                          <p className="mt-2 text-base leading-7 text-lapka-700">{row.body || 'Откройте связанный сценарий для деталей.'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link href={buildNotificationHref(role, row)} className="btn-primary">
                            Перейти к сигналу
                          </Link>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => onMarkOne(row.id)}
                            disabled={markingId === row.id}
                          >
                            {markingId === row.id ? 'Сохраняем...' : 'Прочитано'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="Новых сигналов нет" text="Все входящие события уже просмотрены." />
              )}
            </Card>

            <Card title="Быстрые маршруты" subtitle="То, куда чаще всего нужно перейти после сигнала.">
              <div className="grid gap-3">
                {config.actions.map((action) => (
                  <Link key={action.href} href={action.href} className="action-grid-link">
                <div>
                  <p className="text-lg font-bold text-lapka-900">{action.label}</p>
                  <p className="mt-1 text-sm text-lapka-600">Перейти в связанный рабочий сценарий.</p>
                </div>
                    <span className="pill !px-3 !py-1.5">Перейти</span>
                  </Link>
                ))}
              </div>
            </Card>
          </section>

          <Card title="Архив сигналов" subtitle="История уже просмотренных событий.">
            {grouped.read.length ? (
              <div className="space-y-3">
                {grouped.read.map((row) => (
                  <article key={row.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="pill !px-3 !py-1.5 text-xs font-semibold">{notificationKindLabel(row.notification_type)}</span>
                          <span className="text-sm text-lapka-500">{formatDateTime(row.created_at)}</span>
                          <span className="text-sm text-lapka-500">Прочитано</span>
                        </div>
                        <h3 className="mt-3 text-lg font-bold text-lapka-950">{row.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-lapka-600">{row.body || 'Связанное событие уже просмотрено.'}</p>
                      </div>
                      <Link href={buildNotificationHref(role, row)} className="btn-secondary">
                        Перейти к событию
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title={config.emptyTitle} text={config.emptyText} />
            )}
          </Card>
        </>
      ) : (
        <Card title={config.emptyTitle} subtitle={config.emptyText}>
          <div className="grid gap-3 md:grid-cols-3">
            {config.actions.map((action) => (
              <Link key={action.href} href={action.href} className="action-grid-link">
                <div>
                  <p className="text-lg font-bold text-lapka-900">{action.label}</p>
                  <p className="mt-1 text-sm text-lapka-600">Перейти в связанный рабочий контур.</p>
                </div>
                <span className="pill !px-3 !py-1.5">Перейти</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
