'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import Timeline from '@/components/ui/Timeline';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';

const STATUS_TEXT = {
  scheduled: 'Запланирован',
  confirmed: 'Подтверждён',
  in_progress: 'Идёт приём',
  completed: 'Завершён',
  cancelled: 'Отменён',
  no_show: 'Неявка',
  new: 'Новая',
  waiting: 'Ожидание',
};

export default function OwnerAppointmentDetailsPage() {
  const params = useParams();
  const appointmentId = useMemo(() => params?.id || '', [params]);

  const [appointment, setAppointment] = useState(null);
  const [pet, setPet] = useState(null);
  const [vetName, setVetName] = useState('');
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAppointment = useCallback(async () => {
    if (!appointmentId) return;
    setLoading(true);
    setError('');
    try {
      const appointmentPayload = await apiRequest(`/api/v1/appointments/${appointmentId}`);
      setAppointment(appointmentPayload || null);

      const tasks = [apiRequest(`/api/v1/pets/${appointmentPayload.pet_id}`)];
      if (appointmentPayload.clinic_id) {
        tasks.push(apiRequest(`/api/v1/clinics/${appointmentPayload.clinic_id}/vets`));
      } else {
        tasks.push(Promise.resolve([]));
      }
      tasks.push(apiRequest(`/api/v1/reminders?appointment_id=${encodeURIComponent(appointmentId)}&include_done=true&upcoming_days=365`));

      const [petPayload, vetsPayload, remindersPayload] = await Promise.all(tasks);
      setPet(petPayload || null);

      const vetsRows = Array.isArray(vetsPayload) ? vetsPayload : [];
      const selectedVet = vetsRows.find((row) => row.id === appointmentPayload.vet_id);
      setVetName(selectedVet?.full_name || appointmentPayload.vet_id);
      setReminders(Array.isArray(remindersPayload) ? remindersPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить детали записи');
      setAppointment(null);
      setPet(null);
      setVetName('');
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    loadAppointment();
  }, [loadAppointment]);

  async function onCancel() {
    if (!appointment) return;
    setCancelConfirmOpen(false);
    setCanceling(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/appointments/${appointment.id}/cancel`, {
        method: 'POST',
        body: { notes: 'Отменено владельцем из карточки записи' },
      });
      setSuccess('Запись отменена.');
      await loadAppointment();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отменить запись');
    } finally {
      setCanceling(false);
    }
  }

  const reminderRows = reminders.map((row) => [
    row.remind_before_minutes ? `За ${Math.round(row.remind_before_minutes / 60)} ч` : row.reminder_type,
    new Date(row.due_at).toLocaleString('ru-RU'),
    row.channel || 'in_app',
    row.is_done ? 'Закрыто' : 'Ожидает',
  ]);

  const timelineItems = appointment
    ? [
        { time: 'Создано', text: new Date(appointment.created_at).toLocaleString('ru-RU') },
        { time: 'Запланировано', text: new Date(appointment.scheduled_at).toLocaleString('ru-RU') },
        { time: 'Статус', text: STATUS_TEXT[appointment.status] || appointment.status },
        {
          time: 'Формат',
          text:
            appointment.visit_type === 'video_consultation'
              ? 'Видеоконсультация'
              : 'Очный приём в клинике',
        },
      ]
    : [];

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Карточка записи</h1>
          <p className="page-subtitle">Статус записи, ссылка на консультацию и напоминания владельца.</p>
        </div>
        <Link href="/owner/appointments" className="btn-secondary">
          К списку записей
        </Link>
      </header>

      <ShowcasePanel
        eyebrow="Запись и напоминания"
        title="Все детали приёма собраны в одной карточке"
        description="Проверьте врача, формат визита, напоминания и ссылку на консультацию без лишних переходов между экранами."
        imageSrc="/assets/img/owner-banner.svg"
        imageAlt="Карточка записи владельца"
      />

      {error ? <ErrorBanner message={error} onRetry={loadAppointment} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      {loading ? (
        <section className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </section>
      ) : !appointment ? (
        <EmptyState title="Запись не найдена" text="Проверьте ссылку или откройте запись из общего списка." />
      ) : (
        <>
          <section className="grid-soft-2">
            <Card title="Основные данные">
              <div className="grid gap-2 text-sm text-lapka-700 md:grid-cols-2">
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                  <span className="font-semibold">Питомец:</span> {pet?.name || appointment.pet_id}
                </div>
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                  <span className="font-semibold">Врач:</span> {vetName}
                </div>
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                  <span className="font-semibold">Услуга:</span> {appointment.service_type || appointment.service_name}
                </div>
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                  <span className="font-semibold">Статус:</span> {STATUS_TEXT[appointment.status] || appointment.status}
                </div>
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 md:col-span-2">
                  <span className="font-semibold">Дата и время:</span>{' '}
                  {new Date(appointment.scheduled_at).toLocaleString('ru-RU')} · {appointment.duration_minutes} минут
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {['scheduled', 'confirmed', 'new', 'waiting'].includes(appointment.status) ? (
                  <button className="btn-secondary" type="button" onClick={() => setCancelConfirmOpen(true)} disabled={canceling}>
                    {canceling ? 'Отменяем...' : 'Отменить запись'}
                  </button>
                ) : null}

                {appointment.visit_type === 'video_consultation' && appointment.video_link ? (
                  <a className="btn-primary" href={appointment.video_link} target="_blank" rel="noreferrer">
                    Подключиться к консультации
                  </a>
                ) : null}
              </div>
            </Card>

            <Card title="Видеоконсультация">
              {appointment.visit_type !== 'video_consultation' ? (
                <EmptyState title="Очный визит" text="Для этой записи видеоссылка не требуется." />
              ) : (
                <div className="space-y-3 text-sm text-lapka-700">
                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                    <span className="font-semibold">Ссылка:</span> {appointment.video_link || 'Будет сформирована при подтверждении'}
                  </div>
                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                    <span className="font-semibold">Токен встречи:</span> {appointment.meeting_token || '—'}
                  </div>
                  <p className="text-xs text-lapka-600">
                    Ссылка действует в рамках текущей записи и не открывает доступ к полной медкарте.
                  </p>
                </div>
              )}
            </Card>
          </section>

          <section className="grid-soft-2">
            <Card title="Таймлайн записи">
              <Timeline items={timelineItems} />
            </Card>

            <Card title="Напоминания">
              {reminderRows.length ? (
                <Table columns={['Период', 'Когда', 'Канал', 'Статус']} rows={reminderRows} />
              ) : (
                <EmptyState title="Напоминаний нет" text="Система создаёт напоминания автоматически за 24 часа и 2 часа." />
              )}
            </Card>
          </section>
        </>
      )}
      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Отменить запись?"
        message="Запись будет переведена в статус «Отменена», напоминания закроются."
        confirmLabel="Да, отменить"
        cancelLabel="Оставить"
        danger
        loading={canceling}
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={onCancel}
      />
    </>
  );
}
