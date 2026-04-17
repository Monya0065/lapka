'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import Timeline from '@/components/ui/Timeline';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';

function statusText(isEn) {
  return {
    scheduled: isEn ? 'Scheduled' : 'Запланирован',
    confirmed: isEn ? 'Confirmed' : 'Подтверждён',
    in_progress: isEn ? 'In progress' : 'Идёт приём',
    completed: isEn ? 'Completed' : 'Завершён',
    cancelled: isEn ? 'Cancelled' : 'Отменён',
    no_show: isEn ? 'No-show' : 'Неявка',
    new: isEn ? 'New' : 'Новая',
    waiting: isEn ? 'Waiting' : 'Ожидание',
  };
}

export default function OwnerAppointmentDetailsPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const locale = isEn ? 'en-US' : 'ru-RU';
  const STATUS_TEXT = useMemo(() => statusText(isEn), [isEn]);
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
      setError(requestError.message || (isEn ? 'Failed to load appointment details' : 'Не удалось загрузить детали записи'));
      setAppointment(null);
      setPet(null);
      setVetName('');
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, isEn]);

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
        body: { notes: isEn ? 'Canceled by owner from appointment card' : 'Отменено владельцем из карточки записи' },
      });
      setSuccess(isEn ? 'Appointment canceled.' : 'Запись отменена.');
      await loadAppointment();
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to cancel appointment' : 'Не удалось отменить запись'));
    } finally {
      setCanceling(false);
    }
  }

  const reminderRows = reminders.map((row) => [
    row.remind_before_minutes ? (isEn ? `${Math.round(row.remind_before_minutes / 60)}h before` : `За ${Math.round(row.remind_before_minutes / 60)} ч`) : row.reminder_type,
    new Date(row.due_at).toLocaleString(locale),
    row.channel || 'in_app',
    row.is_done ? (isEn ? 'Closed' : 'Закрыто') : (isEn ? 'Pending' : 'Ожидает'),
  ]);

  const timelineItems = appointment
    ? [
        { time: isEn ? 'Created' : 'Создано', text: new Date(appointment.created_at).toLocaleString(locale) },
        { time: isEn ? 'Scheduled for' : 'Запланировано', text: new Date(appointment.scheduled_at).toLocaleString(locale) },
        { time: isEn ? 'Status' : 'Статус', text: STATUS_TEXT[appointment.status] || appointment.status },
        {
          time: isEn ? 'Format' : 'Формат',
          text:
            appointment.visit_type === 'video_consultation'
              ? (isEn ? 'Video consultation' : 'Видеоконсультация')
              : (isEn ? 'In-clinic visit' : 'Очный приём в клинике'),
        },
      ]
    : [];

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{isEn ? 'Appointment card' : 'Карточка записи'}</h1>
          <p className="page-subtitle">{isEn ? 'Appointment status, consultation link and owner reminders.' : 'Статус записи, ссылка на консультацию и напоминания владельца.'}</p>
        </div>
        <Link href="/owner/appointments" className="btn-secondary">
          {isEn ? 'Back to appointments' : 'К списку записей'}
        </Link>
      </header>

      <ShowcasePanel
        eyebrow={isEn ? 'Appointment and reminders' : 'Запись и напоминания'}
        title={isEn ? 'All visit details in one card' : 'Все детали приёма собраны в одной карточке'}
        description={isEn ? 'Check vet, visit format, reminders and consultation link without extra navigation.' : 'Проверьте врача, формат визита, напоминания и ссылку на консультацию без лишних переходов между экранами.'}
        imageSrc="/assets/img/owner-banner.svg"
        imageAlt={isEn ? 'Owner appointment card' : 'Карточка записи владельца'}
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
        <EmptyState title={isEn ? 'Appointment not found' : 'Запись не найдена'} text={isEn ? 'Check the link or open appointment from the list.' : 'Проверьте ссылку или откройте запись из общего списка.'} />
      ) : (
        <>
          <section className="grid-soft-2">
            <Card title={isEn ? 'Core details' : 'Основные данные'}>
              <div className="grid gap-2 text-sm text-lapka-700 md:grid-cols-2">
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                  <span className="font-semibold">{isEn ? 'Pet:' : 'Питомец:'}</span> {pet?.name || appointment.pet_id}
                </div>
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                  <span className="font-semibold">{isEn ? 'Vet:' : 'Врач:'}</span> {vetName}
                </div>
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                  <span className="font-semibold">{isEn ? 'Service:' : 'Услуга:'}</span> {appointment.service_type || appointment.service_name}
                </div>
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                  <span className="font-semibold">{isEn ? 'Status:' : 'Статус:'}</span> {STATUS_TEXT[appointment.status] || appointment.status}
                </div>
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 md:col-span-2">
                  <span className="font-semibold">{isEn ? 'Date and time:' : 'Дата и время:'}</span>{' '}
                  {new Date(appointment.scheduled_at).toLocaleString(locale)} · {appointment.duration_minutes} {isEn ? 'minutes' : 'минут'}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {['scheduled', 'confirmed', 'new', 'waiting'].includes(appointment.status) ? (
                  <button className="btn-secondary" type="button" onClick={() => setCancelConfirmOpen(true)} disabled={canceling}>
                    {canceling ? (isEn ? 'Canceling...' : 'Отменяем...') : (isEn ? 'Cancel appointment' : 'Отменить запись')}
                  </button>
                ) : null}

                {appointment.visit_type === 'video_consultation' && appointment.video_link ? (
                  <a className="btn-primary" href={appointment.video_link} target="_blank" rel="noreferrer">
                    {isEn ? 'Join consultation' : 'Подключиться к консультации'}
                  </a>
                ) : null}
              </div>
            </Card>

            <Card title={isEn ? 'Video consultation' : 'Видеоконсультация'}>
              {appointment.visit_type !== 'video_consultation' ? (
                <EmptyState title={isEn ? 'In-clinic visit' : 'Очный визит'} text={isEn ? 'No video link required for this appointment.' : 'Для этой записи видеоссылка не требуется.'} />
              ) : (
                <div className="space-y-3 text-sm text-lapka-700">
                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                    <span className="font-semibold">{isEn ? 'Link:' : 'Ссылка:'}</span> {appointment.video_link || (isEn ? 'Will be generated on confirmation' : 'Будет сформирована при подтверждении')}
                  </div>
                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                    <span className="font-semibold">{isEn ? 'Meeting token:' : 'Токен встречи:'}</span> {appointment.meeting_token || '—'}
                  </div>
                  <p className="text-xs text-lapka-600">
                    {isEn ? 'The link is valid for this appointment only and does not grant full medical record access.' : 'Ссылка действует в рамках текущей записи и не открывает доступ к полной медкарте.'}
                  </p>
                </div>
              )}
            </Card>
          </section>

          <section className="grid-soft-2">
            <Card title={isEn ? 'Appointment timeline' : 'Таймлайн записи'}>
              <Timeline items={timelineItems} />
            </Card>

            <Card title={isEn ? 'Reminders' : 'Напоминания'}>
              {reminderRows.length ? (
                <Table columns={isEn ? ['Period', 'When', 'Channel', 'Status'] : ['Период', 'Когда', 'Канал', 'Статус']} rows={reminderRows} />
              ) : (
                <EmptyState title={isEn ? 'No reminders' : 'Напоминаний нет'} text={isEn ? 'System creates reminders automatically at 24h and 2h before visit.' : 'Система создаёт напоминания автоматически за 24 часа и 2 часа.'} />
              )}
            </Card>
          </section>
        </>
      )}
      <ConfirmDialog
        open={cancelConfirmOpen}
        title={isEn ? 'Cancel appointment?' : 'Отменить запись?'}
        message={isEn ? 'Appointment status will be changed to Cancelled and reminders will be closed.' : 'Запись будет переведена в статус «Отменена», напоминания закроются.'}
        confirmLabel={isEn ? 'Yes, cancel' : 'Да, отменить'}
        cancelLabel={isEn ? 'Keep appointment' : 'Оставить'}
        danger
        loading={canceling}
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={onCancel}
      />
    </>
  );
}
