'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import StatusBadge from '@/components/ui/StatusBadge';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';
import { localizeAccessScope } from '@/lib/access';

const SEARCH_MODES = [
  { value: 'name', label: 'Имя питомца' },
  { value: 'owner_phone', label: 'Телефон владельца' },
  { value: 'owner_email', label: 'Эл. почта владельца' },
  { value: 'chip_id', label: 'ID чипа' },
  { value: 'lapka_id', label: 'Lapka ID' },
];

const STATUS_LABELS = {
  scheduled: 'Запланирован',
  confirmed: 'Подтверждён',
  waiting: 'Ожидает в клинике',
  in_progress: 'На приёме',
  completed: 'Завершён',
  cancelled: 'Отменён',
  no_show: 'Неявка',
  new: 'Черновик',
};

function getSlaState(waitMinutes) {
  if (waitMinutes >= 30) return { label: 'Критично', tone: 'critical' };
  if (waitMinutes >= 15) return { label: 'Риск', tone: 'warning' };
  return { label: 'В норме', tone: 'success' };
}

export default function ClinicCheckinPage() {
  const { clinicId, selectedClinic, selectedBranch } = useClinicScope();
  const [appointments, setAppointments] = useState([]);
  const [searchMode, setSearchMode] = useState('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRows, setSearchRows] = useState([]);
  const [qrToken, setQrToken] = useState('');
  const [qrPayload, setQrPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tickNow, setTickNow] = useState(Date.now());

  const computeWaitMinutes = useCallback(
    (appointment) => {
      const start = new Date(appointment.scheduled_at).getTime();
      const now = tickNow;
      if (!Number.isFinite(start) || now <= start) return 0;
      return Math.floor((now - start) / (1000 * 60));
    },
    [tickNow]
  );

  const waitingAppointments = useMemo(
    () => appointments.filter((row) => ['scheduled', 'confirmed', 'new', 'waiting'].includes(row.status)),
    [appointments]
  );

  const inProgressToday = useMemo(
    () => appointments.filter((row) => row.status === 'in_progress'),
    [appointments]
  );
  const completedToday = useMemo(
    () => appointments.filter((row) => row.status === 'completed'),
    [appointments]
  );
  const slaRiskCount = useMemo(
    () => waitingAppointments.filter((row) => computeWaitMinutes(row) >= 15).length,
    [computeWaitMinutes, waitingAppointments]
  );
  const criticalQueueCount = useMemo(
    () => waitingAppointments.filter((row) => computeWaitMinutes(row) >= 30).length,
    [computeWaitMinutes, waitingAppointments]
  );
  const checkinPressure = useMemo(() => {
    if (criticalQueueCount > 0 || waitingAppointments.length >= 10) return 'HIGH';
    if (slaRiskCount > 0 || waitingAppointments.length >= 5) return 'MED';
    if (waitingAppointments.length > 0) return 'OK';
    return 'LOW';
  }, [criticalQueueCount, slaRiskCount, waitingAppointments.length]);

  const dayCaption = useMemo(
    () =>
      new Date().toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  useEffect(() => {
    const timer = setInterval(() => setTickNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadCheckinData = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError('');
    try {
      const clinic = await apiRequest(`/api/v1/clinics/me?clinic_id=${encodeURIComponent(clinicId)}`);
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);

      const appointmentsPayload = await apiRequest(
        `/api/v1/appointments?clinic_id=${encodeURIComponent(clinic.id)}&mine=false&date_from=${encodeURIComponent(start.toISOString())}&date_to=${encodeURIComponent(end.toISOString())}`
      );
      setAppointments(Array.isArray(appointmentsPayload) ? appointmentsPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить дашборд ресепшн');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    loadCheckinData();
  }, [loadCheckinData]);

  async function runPatientSearch() {
    const q = searchQuery.trim();
    if (!q || !clinicId) {
      setSearchRows([]);
      return;
    }
    setSearchLoading(true);
    setError('');
    try {
      const payload = await apiRequest(
        `/api/v1/clinic/search/patients?clinic_id=${encodeURIComponent(clinicId)}&mode=${encodeURIComponent(searchMode)}&q=${encodeURIComponent(q)}&limit=40`
      );
      setSearchRows(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось выполнить поиск');
      setSearchRows([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function checkinAppointment(appointmentId) {
    setActionLoadingId(appointmentId);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(`/api/v1/appointments/${appointmentId}/checkin`, { method: 'POST' });
      setSuccess(`Пациент отмечен на ресепшн. Черновик визита: ${payload.visit.id}`);
      await loadCheckinData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отметить пациента');
    } finally {
      setActionLoadingId('');
    }
  }

  async function runQrCheckin() {
    if (!qrToken.trim() || !clinicId) return;
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/api/v1/clinic/checkin/qr', {
        method: 'POST',
        body: { token: qrToken.trim(), clinic_id: clinicId },
      });
      setQrPayload(payload);
      setSuccess('QR-токен подтверждён. Можно создать черновик записи или запросить доступ к карте.');
    } catch (requestError) {
      setQrPayload(null);
      setError(requestError.message || 'QR-проверка не выполнена');
    }
  }

  async function createDraftFromQr() {
    if (!qrPayload?.pet?.pet_id || !clinicId) return;
    setActionLoadingId('qr-draft');
    setError('');
    try {
      const slot = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      await apiRequest('/api/v1/appointments', {
        method: 'POST',
        body: {
          clinic_id: clinicId,
          pet_id: qrPayload.pet.pet_id,
          owner_user_id: qrPayload.owner_user_id || null,
          vet_id: appointments[0]?.vet_id || qrPayload.vet_id || null,
          service_type: 'Консультация',
          scheduled_at: slot,
          status: 'new',
          notes: 'Черновик записи после QR-регистрации на ресепшн.',
        },
      });
      setSuccess('Черновик записи создан из QR-проверки.');
      await loadCheckinData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать черновик записи');
    } finally {
      setActionLoadingId('');
    }
  }

  async function escalateWaiting(appointment) {
    setActionLoadingId(`escalate-${appointment.id}`);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/appointments/${appointment.id}`, {
        method: 'PATCH',
        body: {
          notes: `SLA escalation: ожидание ${computeWaitMinutes(appointment)} мин`,
          urgency_level: 'urgent',
        },
      });
      setSuccess(`Эскалация отправлена для записи ${appointment.id}.`);
      await loadCheckinData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось эскалировать запись');
    } finally {
      setActionLoadingId('');
    }
  }

  const appointmentRows = waitingAppointments.map((row) => [
    new Date(row.scheduled_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    <span key={`pet-${row.id}`} className="block min-w-0">
      <span className="font-semibold text-theme">{row.pet_name || 'Питомец'}</span>
      {row.owner_name ? <span className="mt-0.5 block text-xs text-theme-muted">{row.owner_name}</span> : null}
    </span>,
    row.service_type || row.service_name,
    `${computeWaitMinutes(row)} мин`,
    STATUS_LABELS[row.status] || row.status,
    <div key={row.id} className="flex flex-wrap gap-2">
      <StatusBadge status={getSlaState(computeWaitMinutes(row)).tone}>{getSlaState(computeWaitMinutes(row)).label}</StatusBadge>
      <button
        className="btn-primary !px-3 !py-1.5"
        type="button"
        disabled={actionLoadingId === row.id}
        onClick={() => checkinAppointment(row.id)}
      >
        {actionLoadingId === row.id ? 'Отмечаем...' : 'Отметить пациента'}
      </button>
      <button
        className="btn-secondary !px-3 !py-1.5"
        type="button"
        disabled={actionLoadingId === `escalate-${row.id}`}
        onClick={() => escalateWaiting(row)}
      >
        {actionLoadingId === `escalate-${row.id}` ? 'Эскалируем...' : 'Эскалация'}
      </button>
      <Link className="btn-secondary !px-3 !py-1.5" href="/clinic/schedule">
        Расписание
      </Link>
    </div>,
  ]);

  return (
    <div className="space-y-7 overflow-x-clip">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-cyan-500/14 via-surface-muted to-emerald-500/12 p-6 shadow-card md:p-8 dark:from-cyan-500/08 dark:to-emerald-600/10">
        <div className="pointer-events-none absolute right-0 top-1/2 h-40 w-64 -translate-y-1/2 translate-x-1/4 rounded-full bg-lapka-gradient opacity-[0.12] blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">
              Ресепшн · {loading ? 'загрузка…' : dayCaption}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">Регистрация и запуск визита</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
              Очередь дня, поиск пациента и QR — затем перевод записи в рабочий визит без лишних шагов. Цифры справа из того же дня, что и таблица ниже.
            </p>
            <p className="mt-2 text-base font-bold text-theme">{selectedClinic?.name || 'Клиника'}</p>
            <p className="mt-1 text-sm text-theme-muted">
              {loading
                ? 'Подтягиваем записи на сегодня…'
                : selectedBranch
                  ? `Филиал: ${[selectedBranch.city, selectedBranch.address].filter(Boolean).join(', ') || selectedBranch.address}`
                  : selectedClinic?.address || selectedClinic?.city
                    ? [selectedClinic?.city, selectedClinic?.address].filter(Boolean).join(' · ')
                    : 'Точка ресепшн привязана к клинике в Lapka.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/clinic/flowboard" className="btn-secondary">
                Поток дня
              </Link>
              <Link href="/clinic/schedule" className="btn-primary">
                Расписание
              </Link>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
              {[
                { label: 'В очереди', value: waitingAppointments.length, tone: 'border-amber-500/35 bg-amber-500/08' },
                { label: 'На приёме', value: inProgressToday.length, tone: 'border-sky-500/35 bg-sky-500/10' },
                { label: 'Завершено', value: completedToday.length, tone: 'border-emerald-500/35 bg-emerald-500/08' },
                { label: 'Всего слотов', value: appointments.length, tone: 'border-border bg-surface/80' },
                {
                  label: 'SLA ≥15 мин',
                  value: waitingAppointments.filter((row) => computeWaitMinutes(row) >= 15).length,
                  tone: 'border-rose-500/35 bg-rose-500/08',
                },
                { label: 'Найдено в поиске', value: searchRows.length, tone: 'border-violet-500/35 bg-violet-500/08' },
              ].map((cell) => (
                <div key={cell.label} className={`rounded-2xl border px-3 py-4 ${cell.tone}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-theme sm:text-3xl">{cell.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {error ? <ErrorBanner message={error} onRetry={loadCheckinData} /> : null}
      {success ? <div className="callout-success">{success}</div> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
        </section>
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Ресепшн клиники"
            title="Быстрая отметка пациента: поиск, QR и старт визита без хаоса"
            description="Администратор клиники видит ожидающие записи, может найти пациента по нескольким идентификаторам и быстро перевести запись в рабочий визит."
            imageSrc="/assets/img/clinic-ops.svg"
            imageAlt="Ресепшн клиники"
            badges={[
              `${waitingAppointments.length} ожидающих записей`,
              `${searchRows.length} найдено`,
              qrPayload ? 'QR подтверждён' : `${selectedClinic?.name || 'Клиника'}${selectedBranch ? ` · ${selectedBranch.address}` : ''} · QR готов`,
            ]}
          />

          <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">Диспетчерские сигналы ресепшн</h2>
              </div>
              <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
                checkin ops
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'Давление стойки',
                  value: checkinPressure,
                  text: 'Сигнал по текущей очереди и SLA-рискам для быстрого усиления смены.',
                  href: '/clinic/flowboard',
                  tone: checkinPressure === 'HIGH'
                    ? 'text-rose-700 dark:text-rose-300'
                    : checkinPressure === 'MED'
                      ? 'text-amber-700 dark:text-amber-300'
                      : checkinPressure === 'OK'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-sky-700 dark:text-sky-300',
                },
                {
                  title: 'Критичные ожидания',
                  value: criticalQueueCount,
                  text: 'Записи с ожиданием 30+ минут, требующие немедленной эскалации в поток.',
                  href: '/clinic/flowboard',
                  tone: criticalQueueCount > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300',
                },
                {
                  title: 'SLA под риском',
                  value: slaRiskCount,
                  text: 'Количество пациентов с ожиданием 15+ минут на текущей стойке регистрации.',
                  href: '/clinic/schedule',
                  tone: slaRiskCount > 0 ? 'text-violet-700 dark:text-violet-300' : 'text-sky-700 dark:text-sky-300',
                },
              ].map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="rounded-2xl border border-border bg-surface/85 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <p className={`text-base font-black ${item.tone}`}>{item.title}</p>
                  <p className="mt-2 text-3xl font-black tabular-nums text-theme">{item.value}</p>
                  <p className="mt-2 text-sm leading-relaxed text-theme">{item.text}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">Открыть контур</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
            <Card title="Поиск пациента" subtitle="Поиск нужен для ресепшн, а не для раскрытия лишних данных без согласия владельца.">
              <div className="grid gap-3 xl:grid-cols-[220px_1fr_auto] xl:items-end">
                <label className="block">
                  <span className="label">Поиск по</span>
                  <select className="input" value={searchMode} onChange={(event) => setSearchMode(event.target.value)}>
                    {SEARCH_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
                <SearchInput
                  label="Запрос"
                  placeholder="Имя питомца / телефон / email / ID чипа / Lapka ID"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      runPatientSearch();
                    }
                  }}
                />
                <button className="btn-primary" type="button" onClick={runPatientSearch}>
                  Найти
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {searchLoading ? (
                  <>
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </>
                ) : searchRows.length ? (
                  searchRows.map((row) => (
                    <article key={row.pet_id} className="rounded-2xl border border-border bg-surface-muted/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-theme">{row.pet_name}</h3>
                          <p className="text-sm text-theme-muted">
                            {row.species || '—'} · {row.lapka_id || 'Lapka ID не указан'}
                          </p>
                          <p className="text-sm text-theme">
                            {row.consent_status === 'none' ? 'Владелец скрыт до подтверждения доступа' : `${row.owner_name || '—'} · ${row.owner_email || '—'}`}
                          </p>
                        </div>
                        {row.consent_status === 'none' ? (
                          <span className="badge-yellow">Нужен доступ</span>
                        ) : (
                          <span className="badge-green">{localizeAccessScope(row.consent_scope)}</span>
                        )}
                      </div>
                      {row.consent_status !== 'none' ? (
                        <div className="mt-3 flex justify-end">
                          <Link href={`/clinic/patients/${row.pet_id}`} className="btn-secondary !min-h-[44px] !px-4 !py-2">
                            Карточка пациента
                          </Link>
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <EmptyState title="Нет результатов" text="Введите запрос и выберите режим поиска." />
                )}
              </div>
            </Card>

            <Card title="QR-подтверждение" subtitle="MVP: ручной ввод токена вместо сканера, но тот же безопасный маршрут регистрации.">
              <label className="block">
                <span className="label">QR-токен (ввод для MVP)</span>
                <input
                  className="input"
                  value={qrToken}
                  onChange={(event) => setQrToken(event.target.value)}
                  placeholder="QR-LPK-..."
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-primary" type="button" onClick={runQrCheckin}>
                  Сканировать QR
                </button>
                <button className="btn-secondary" type="button" onClick={() => setQrToken('')}>
                  Очистить
                </button>
              </div>

              {qrPayload ? (
                <div className="mt-4 space-y-2 rounded-2xl border border-border bg-surface-muted/70 p-3 text-sm text-theme">
                  <p className="font-semibold text-theme">{qrPayload.pet.pet_name}</p>
                  <p>{qrPayload.pet.species} · {qrPayload.pet.lapka_id}</p>
                  <p>Доступ к карте: {qrPayload.consent_status === 'active' ? localizeAccessScope(qrPayload.consent_scope) : 'не выдан'}</p>
                  <button className="btn-secondary" type="button" onClick={createDraftFromQr} disabled={actionLoadingId === 'qr-draft'}>
                    {actionLoadingId === 'qr-draft' ? 'Создаём...' : 'Создать черновик записи'}
                  </button>
                </div>
              ) : null}
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.02fr_0.98fr]">
            <Card title="Ожидающие записи" subtitle="Нажмите «Отметить пациента», чтобы создать черновик визита">
              {appointmentRows.length ? (
                <>
                  <div className="space-y-3 xl:hidden">
                    {waitingAppointments.map((row) => (
                      <article key={row.id} className="rounded-2xl border border-border bg-surface-muted/70 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-bold text-theme">{row.service_type || row.service_name || 'Запись'}</h3>
                            <p className="mt-1 text-sm text-theme-muted">
                              {new Date(row.scheduled_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · {row.pet_id}
                            </p>
                          </div>
                          <span className="badge-green">{STATUS_LABELS[row.status] || row.status}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="btn-primary !px-3 !py-1.5"
                            type="button"
                            disabled={actionLoadingId === row.id}
                            onClick={() => checkinAppointment(row.id)}
                          >
                            {actionLoadingId === row.id ? 'Отмечаем...' : 'Отметить пациента'}
                          </button>
                          <Link className="btn-secondary !px-3 !py-1.5" href="/clinic/schedule">
                            Расписание
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="hidden xl:block">
                    <Table columns={['Время', 'Питомец', 'Услуга', 'Ожидание', 'Статус', 'Действия']} rows={appointmentRows} />
                  </div>
                </>
              ) : (
                <EmptyState title="Сегодня нет ожидающих записей" text="Создайте запись из сервисного контура клиники или обновите календарь." />
              )}
            </Card>

            <Card title="Что важно на ресепшн" subtitle="Сценарий регистрации должен быть быстрым, но приватность данных — жёсткой.">
              <div className="grid gap-3">
                {[
                  'Поиск и QR живут в одном экране, чтобы не гонять администратора между разделами.',
                  'Если согласия нет, ресепшн видит только безопасный минимум и отправляет запрос владельцу.',
                  'После подтверждения можно сразу создать черновик визита и передать пациента врачу.',
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-border bg-surface-muted/70 px-4 py-4 text-sm leading-7 text-theme">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
