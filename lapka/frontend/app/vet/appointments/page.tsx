'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import Table from '@/components/ui/Table';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';

const STATUS_LABEL = {
  scheduled: 'Запланирован',
  confirmed: 'Подтверждён',
  in_progress: 'На приёме',
  completed: 'Завершён',
  cancelled: 'Отменён',
  no_show: 'Неявка',
  new: 'Новая',
  waiting: 'Ожидание',
};

function dayRange(dateValue) {
  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(`${dateValue}T23:59:59`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export default function VetAppointmentsPage() {
  const [dateValue, setDateValue] = useState(todayInput());
  const [appointments, setAppointments] = useState([]);
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { start, end } = dayRange(dateValue);
      const [appointmentsPayload, petsPayload] = await Promise.all([
        apiRequest(`/api/v1/appointments?mine=true&date_from=${encodeURIComponent(start)}&date_to=${encodeURIComponent(end)}`),
        apiRequest('/api/v1/pets'),
      ]);
      setAppointments(Array.isArray(appointmentsPayload) ? appointmentsPayload : []);
      setPets(Array.isArray(petsPayload) ? petsPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить записи врача');
      setAppointments([]);
      setPets([]);
    } finally {
      setLoading(false);
    }
  }, [dateValue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function changeStatus(id, endpoint, successText) {
    setActionLoadingId(id);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/appointments/${id}/${endpoint}`, {
        method: 'POST',
        body: { notes: `Действие врача: ${endpoint}` },
      });
      setSuccess(successText);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обновить статус записи');
    } finally {
      setActionLoadingId('');
    }
  }

  const petNameById = useMemo(
    () =>
      pets.reduce((acc, item) => {
        acc[item.id] = item.name;
        return acc;
      }, {}),
    [pets]
  );

  const todayStats = {
    total: appointments.length,
    scheduled: appointments.filter((row) => ['scheduled', 'confirmed', 'new', 'waiting'].includes(row.status)).length,
    inProgress: appointments.filter((row) => row.status === 'in_progress').length,
    done: appointments.filter((row) => row.status === 'completed').length,
  };

  const rows = appointments.map((row) => {
    const status = row.status;
    const isPending = ['scheduled', 'confirmed', 'new', 'waiting'].includes(status);
    const canStart = ['scheduled', 'confirmed', 'new', 'waiting'].includes(status);
    const canComplete = status === 'in_progress';
    const isBusy = actionLoadingId === row.id;

    return [
      new Date(row.scheduled_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      petNameById[row.pet_id] || row.pet_id,
      row.service_type || row.service_name,
      row.visit_type === 'video_consultation' ? 'Видео' : 'Очный',
      STATUS_LABEL[status] || status,
      <div key={row.id} className="flex flex-wrap gap-2">
        {isPending ? (
          <button className="btn-secondary !px-3 !py-1" type="button" disabled={isBusy} onClick={() => changeStatus(row.id, 'confirm', 'Запись подтверждена')}>
            Подтвердить
          </button>
        ) : null}
        {canStart ? (
          <button className="btn-primary !px-3 !py-1" type="button" disabled={isBusy} onClick={() => changeStatus(row.id, 'start', 'Приём начат')}>
            Начать
          </button>
        ) : null}
        {canComplete ? (
          <button className="btn-primary !px-3 !py-1" type="button" disabled={isBusy} onClick={() => changeStatus(row.id, 'complete', 'Приём завершён')}>
            Завершить
          </button>
        ) : null}
        {isPending || status === 'in_progress' ? (
          <button className="btn-secondary !px-3 !py-1" type="button" disabled={isBusy} onClick={() => changeStatus(row.id, 'cancel', 'Запись отменена')}>
            Отмена
          </button>
        ) : null}
        <Link className="btn-secondary !px-3 !py-1" href={`/vet/patient/${row.pet_id}`}>
          Пациент
        </Link>
      </div>,
    ];
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Мои записи на сегодня</h1>
          <p className="page-subtitle">Поток приёма: подтверждение, старт, завершение и телемедицина.</p>
        </div>
        <label className="block min-w-[200px]">
          <span className="label">Дата</span>
          <input className="input" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
        </label>
      </header>

      <ShowcasePanel
        eyebrow="Приём и расписание"
        title="Рабочий день врача в одной панели"
        description="Отслеживайте поток записей, быстро переводите пациента в приём и открывайте карточку без лишних переходов."
        imageSrc="/assets/img/vet-doctor.svg"
        imageAlt="Рабочий день ветеринарного врача"
      />

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      {loading ? (
        <section className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-56 w-full" />
        </section>
      ) : (
        <>
          <section className="kpi-grid">
            <StatsCard label="Всего записей" value={String(todayStats.total)} />
            <StatsCard label="Ожидают/подтверждены" value={String(todayStats.scheduled)} />
            <StatsCard label="На приёме" value={String(todayStats.inProgress)} />
            <StatsCard label="Завершено" value={String(todayStats.done)} />
          </section>

          <Card title="Список записей" subtitle={`Дата: ${new Date(`${dateValue}T00:00:00`).toLocaleDateString('ru-RU')}`}>
            {rows.length ? (
              <Table columns={['Время', 'Питомец', 'Услуга', 'Формат', 'Статус', 'Действия']} rows={rows} />
            ) : (
              <EmptyState title="Записей нет" text="На выбранную дату пока нет записей по вашему расписанию." />
            )}
          </Card>
        </>
      )}
    </>
  );
}
