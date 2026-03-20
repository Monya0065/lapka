'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import StatsCard from '@/components/ui/StatsCard';
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

  const waitingAppointments = useMemo(
    () => appointments.filter((row) => ['scheduled', 'confirmed', 'new', 'waiting'].includes(row.status)),
    [appointments]
  );

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

  const appointmentRows = waitingAppointments.map((row) => [
    new Date(row.scheduled_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    row.pet_id,
    row.service_type || row.service_name,
    STATUS_LABELS[row.status] || row.status,
    <div key={row.id} className="flex flex-wrap gap-2">
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
    </div>,
  ]);

  return (
    <div className="space-y-7 overflow-x-clip">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Ресепшн</p>
          <h1 className="page-title">Регистрация пациента и запуск визита</h1>
          <p className="page-subtitle">Сначала очередь и поиск, затем QR-подтверждение и перевод записи в рабочий визит без лишних шагов.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/clinic/flowboard" className="btn-secondary">Поток дня</Link>
          <Link href="/clinic/schedule" className="btn-primary">Расписание</Link>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadCheckinData} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

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

          <section className="kpi-grid">
            <StatsCard label="Ожидают" value={String(waitingAppointments.length)} />
            <StatsCard label="Найдено" value={String(searchRows.length)} />
            <StatsCard label="QR" value={qrPayload ? 'Готов' : 'Ожидает'} />
            <StatsCard label="Клиника" value={selectedClinic?.name || 'Клиника Санкт-Петербурга'} />
            <StatsCard label="Филиал" value={selectedBranch?.address || 'Главный филиал'} />
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
                    <article key={row.pet_id} className="rounded-2xl border border-lapka-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-lapka-900">{row.pet_name}</h3>
                          <p className="text-sm text-lapka-600">
                            {row.species || '—'} · {row.lapka_id || 'Lapka ID не указан'}
                          </p>
                          <p className="text-sm text-lapka-700">
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
                <div className="mt-4 space-y-2 rounded-2xl border border-lapka-200 bg-white p-3 text-sm text-lapka-700">
                  <p className="font-semibold text-lapka-900">{qrPayload.pet.pet_name}</p>
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
                      <article key={row.id} className="rounded-2xl border border-lapka-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-bold text-lapka-900">{row.service_type || row.service_name || 'Запись'}</h3>
                            <p className="mt-1 text-sm text-lapka-600">
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
                    <Table columns={['Время', 'ID питомца', 'Услуга', 'Статус', 'Действия']} rows={appointmentRows} />
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
                  <div key={item} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-7 text-lapka-700">
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
