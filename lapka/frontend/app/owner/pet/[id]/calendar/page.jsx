'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Timeline from '@/components/ui/Timeline';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';

const REMINDER_TYPES = ['vaccine', 'checkup', 'medication'];

function monthLabel(date, locale) {
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function dayKey(dateValue) {
  return dateValue.toISOString().slice(0, 10);
}

function toDateTimeLocal(date) {
  if (!date) return '';
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value, locale) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(locale);
}

export default function OwnerPetCalendarPage() {
  const { i18n } = useTranslation();
  const params = useParams();
  const petId = useMemo(() => String(params?.id || ''), [params]);
  const locale = i18n.language.startsWith('ru') ? 'ru-RU' : 'en-US';
  const copy = i18n.language.startsWith('ru')
    ? {
        title: 'Календарь питомца',
        subtitle: 'Визиты, вакцинации и напоминания по одному питомцу.',
        calendarTitle: 'События месяца',
        monthLabel: 'Календарь',
        remindersTitle: 'Ближайшие напоминания',
        remindersSubtitle: 'Понятные напоминания по уходу и приёмам.',
        vaccinesTitle: 'Ближайшие вакцинации',
        vaccinesSubtitle: 'Даты ревакцинации и сделанные записи.',
        todayPlan: 'План владельца',
        todayPlanSubtitle: 'Что важно не пропустить по этому питомцу.',
        createReminder: 'Добавить напоминание',
        createReminderTitle: 'Новое напоминание',
        createReminderSubtitle: 'Создаётся только для выбранного питомца.',
        type: 'Тип',
        titleField: 'Название',
        dueAt: 'Когда напомнить',
        notes: 'Заметка',
        save: 'Сохранить',
        saving: 'Сохраняем...',
        cancel: 'Отмена',
        error: 'Не удалось загрузить календарь питомца',
        createError: 'Проверьте обязательные поля напоминания',
        createSuccess: 'Напоминание добавлено.',
        noEventsTitle: 'В этом месяце пока пусто',
        noEventsText: 'Создайте напоминание или дождитесь следующей вакцинации.',
        noRemindersTitle: 'Напоминаний нет',
        noRemindersText: 'Добавьте личное напоминание с датой и заметкой.',
        noVaccinesTitle: 'Нет предстоящих вакцинаций',
        noVaccinesText: 'Как только врач или владелец добавят запись, она появится здесь.',
        noPlanTitle: 'План пока пуст',
        noPlanText: 'После новых событий здесь появятся следующие шаги.',
        reminderTypes: {
          vaccine: 'Вакцинация',
          checkup: 'Контрольный визит',
          medication: 'Домашний уход',
        },
        channels: 'Канал',
        nextDue: 'Следующая дата',
      }
    : {
        title: 'Pet calendar',
        subtitle: 'Visits, vaccines and reminders for one pet.',
        calendarTitle: 'Month events',
        monthLabel: 'Calendar',
        remindersTitle: 'Upcoming reminders',
        remindersSubtitle: 'Clear reminders for care and visits.',
        vaccinesTitle: 'Upcoming vaccines',
        vaccinesSubtitle: 'Booster dates and completed records.',
        todayPlan: 'Owner plan',
        todayPlanSubtitle: 'What not to miss for this pet.',
        createReminder: 'Add reminder',
        createReminderTitle: 'New reminder',
        createReminderSubtitle: 'Created only for the selected pet.',
        type: 'Type',
        titleField: 'Title',
        dueAt: 'Remind at',
        notes: 'Notes',
        save: 'Save',
        saving: 'Saving...',
        cancel: 'Cancel',
        error: 'Failed to load pet calendar',
        createError: 'Check required reminder fields',
        createSuccess: 'Reminder created.',
        noEventsTitle: 'No events this month',
        noEventsText: 'Create a reminder or wait for the next vaccine due date.',
        noRemindersTitle: 'No reminders',
        noRemindersText: 'Add an owner reminder with date and note.',
        noVaccinesTitle: 'No upcoming vaccines',
        noVaccinesText: 'As soon as the vet or owner adds an entry, it will appear here.',
        noPlanTitle: 'Plan is empty',
        noPlanText: 'The next steps will appear here after new events.',
        reminderTypes: {
          vaccine: 'Vaccination',
          checkup: 'Checkup',
          medication: 'Home care',
        },
        channels: 'Channel',
        nextDue: 'Next due',
      };

  const [pet, setPet] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [showModal, setShowModal] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [form, setForm] = useState({
    reminder_type: 'vaccine',
    title: '',
    due_at: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    if (!petId) return;
    setLoading(true);
    setError('');
    try {
      const [petPayload, remindersPayload, vaccinesPayload] = await Promise.all([
        apiRequest(`/api/v1/pets/${petId}`),
        apiRequest(`/api/v1/reminders?pet_id=${encodeURIComponent(petId)}&upcoming_days=365&limit=100`),
        apiRequest(`/api/v1/pets/${petId}/vaccines`),
      ]);
      setPet(petPayload || null);
      setReminders(Array.isArray(remindersPayload) ? remindersPayload : []);
      setVaccines(Array.isArray(vaccinesPayload) ? vaccinesPayload : []);
    } catch (requestError) {
      setError(requestError.message || copy.error);
      setPet(null);
      setReminders([]);
      setVaccines([]);
    } finally {
      setLoading(false);
    }
  }, [copy.error, petId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allEvents = useMemo(() => {
    const reminderEvents = reminders.map((row) => ({
      id: row.id,
      type: row.reminder_type,
      title: row.title,
      dueAt: new Date(row.due_at),
      notes: row.notes || '',
      channel: row.channel || 'push',
      source: 'reminder',
    }));

    const vaccineEvents = vaccines
      .filter((row) => row.next_due_date)
      .map((row) => ({
        id: `vaccine-due-${row.id}`,
        type: 'vaccine',
        title: `${copy.reminderTypes.vaccine}: ${row.vaccine_name}`,
        dueAt: new Date(row.next_due_date),
        notes: '',
        channel: 'clinic',
        source: 'vaccine_due',
      }));

    return [...reminderEvents, ...vaccineEvents].sort((a, b) => a.dueAt - b.dueAt);
  }, [copy.reminderTypes.vaccine, reminders, vaccines]);

  const eventsByDay = useMemo(() => {
    const map = {};
    allEvents.forEach((event) => {
      const key = dayKey(event.dueAt);
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [allEvents]);

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekDay = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekDay; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(year, month, day));
    }
    return cells;
  }, [currentMonth]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return allEvents.filter((row) => row.dueAt >= now).slice(0, 10);
  }, [allEvents]);

  const vaccineTimeline = useMemo(
    () =>
      vaccines.slice(0, 6).map((row) => ({
        time: formatDateTime(row.administered_at, locale),
        text: `${row.vaccine_name} · ${copy.nextDue}: ${formatDateTime(row.next_due_date, locale)}`,
      })),
    [copy.nextDue, locale, vaccines]
  );

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreateModal(clickedDate = null) {
    setForm((prev) => ({
      ...prev,
      due_at: clickedDate ? toDateTimeLocal(clickedDate) : prev.due_at,
    }));
    setShowModal(true);
  }

  async function onCreateReminder(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.reminder_type || !form.title.trim() || !form.due_at) {
      setError(copy.createError);
      return;
    }

    setSavingReminder(true);
    try {
      await apiRequest('/api/v1/reminders', {
        method: 'POST',
        body: {
          pet_id: petId,
          reminder_type: form.reminder_type,
          title: form.title.trim(),
          due_at: new Date(form.due_at).toISOString(),
          notes: form.notes.trim() || null,
        },
      });
      setSuccess(copy.createSuccess);
      setShowModal(false);
      setForm({
        reminder_type: 'vaccine',
        title: '',
        due_at: '',
        notes: '',
      });
      await loadData();
    } catch (requestError) {
      setError(requestError.message || copy.createError);
    } finally {
      setSavingReminder(false);
    }
  }

  const weekdays = i18n.language.startsWith('ru')
    ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{copy.title}</h1>
          <p className="page-subtitle">{copy.subtitle}</p>
        </div>
        <button className="btn-primary shrink-0" type="button" onClick={() => openCreateModal()}>
          + {copy.createReminder}
        </button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-[320px] w-full" />
          <Skeleton className="h-[240px] w-full" />
        </section>
      ) : (
        <>
          <ShowcasePanel
            eyebrow={copy.monthLabel}
            title={
              i18n.language.startsWith('ru')
                ? `${pet?.name || copy.title}: напоминания, контроль и вакцинации`
                : `${pet?.name || copy.title}: reminders, checkups and vaccines`
            }
            description={
              i18n.language.startsWith('ru')
                ? 'Календарь собирает личные напоминания, контрольные визиты и ближайшие даты вакцинации в одном спокойном и крупном интерфейсе.'
                : 'The calendar brings together personal reminders, checkup visits and vaccine due dates in one clear place.'
            }
            imageSrc="/assets/img/owner-banner.svg"
            imageAlt={i18n.language.startsWith('ru') ? 'Календарь питомца' : 'Pet calendar'}
            badges={[
              `${upcomingEvents.length} ${i18n.language.startsWith('ru') ? 'ближайших событий' : 'upcoming events'}`,
              `${vaccines.length} ${i18n.language.startsWith('ru') ? 'записей вакцинации' : 'vaccine entries'}`,
              `${reminders.length} ${i18n.language.startsWith('ru') ? 'напоминаний' : 'reminders'}`,
            ]}
          />

          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_360px]">
            <Card
              title={`${copy.calendarTitle}${pet?.name ? ` · ${pet.name}` : ''}`}
              subtitle={`${copy.monthLabel}: ${monthLabel(currentMonth, locale)}`}
              action={
                <div className="flex gap-2">
                  <button
                    className="btn-secondary !px-3 !py-1"
                    type="button"
                    onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  >
                    ←
                  </button>
                  <button
                    className="btn-secondary !px-3 !py-1"
                    type="button"
                    onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  >
                    →
                  </button>
                </div>
              }
            >
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-lapka-500">
                {weekdays.map((weekday) => (
                  <div key={weekday} className="rounded-xl border border-transparent px-2 py-2">
                    {weekday}
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2">
                {calendarCells.map((cell, index) => {
                  if (!cell) {
                    return <div key={`empty-${index}`} className="aspect-square rounded-2xl border border-transparent bg-transparent" />;
                  }
                  const key = dayKey(cell);
                  const events = eventsByDay[key] || [];
                  const isToday = dayKey(new Date()) === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => openCreateModal(cell)}
                      className={`group flex aspect-square flex-col rounded-2xl border p-2 text-left transition ${
                        isToday ? 'border-cyan-300 bg-cyan-50' : 'border-lapka-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/60'
                      }`}
                    >
                      <span className="text-sm font-bold text-lapka-900">{cell.getDate()}</span>
                      <div className="mt-auto flex flex-wrap gap-1">
                        {events.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            className={`h-2.5 w-2.5 rounded-full ${
                              event.type === 'vaccine'
                                ? 'bg-emerald-400'
                                : event.type === 'medication'
                                  ? 'bg-amber-400'
                                  : 'bg-cyan-400'
                            }`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              {!allEvents.length ? (
                <div className="mt-4">
                  <EmptyState title={copy.noEventsTitle} text={copy.noEventsText} />
                </div>
              ) : null}
            </Card>

            <div className="space-y-4">
              <Card title={copy.remindersTitle} subtitle={copy.remindersSubtitle}>
                {upcomingEvents.length ? (
                  <div className="space-y-3">
                    {upcomingEvents.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                        <p className="font-semibold text-lapka-900">{event.title}</p>
                        <p className="mt-1 text-xs text-lapka-600">{formatDateTime(event.dueAt, locale)}</p>
                        <p className="mt-1 text-xs text-lapka-500">
                          {copy.channels}: {event.channel}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title={copy.noRemindersTitle} text={copy.noRemindersText} />
                )}
              </Card>

              <Card title={copy.todayPlan} subtitle={copy.todayPlanSubtitle}>
                {upcomingEvents.length ? (
                  <Timeline
                    items={upcomingEvents.slice(0, 5).map((event) => ({
                      time: formatDateTime(event.dueAt, locale),
                      text: `${event.title}${event.notes ? ` · ${event.notes}` : ''}`,
                    }))}
                  />
                ) : (
                  <EmptyState title={copy.noPlanTitle} text={copy.noPlanText} />
                )}
              </Card>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card title={copy.vaccinesTitle} subtitle={copy.vaccinesSubtitle}>
              {vaccineTimeline.length ? (
                <Timeline items={vaccineTimeline} />
              ) : (
                <EmptyState title={copy.noVaccinesTitle} text={copy.noVaccinesText} />
              )}
            </Card>

            <Card title={copy.createReminderTitle} subtitle={copy.createReminderSubtitle}>
              <div className="grid gap-2 sm:grid-cols-3">
                {REMINDER_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      form.reminder_type === type ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-lapka-200 bg-white text-lapka-700 hover:border-cyan-300'
                    }`}
                    onClick={() => setForm((prev) => ({ ...prev, reminder_type: type, title: prev.title || copy.reminderTypes[type] }))}
                  >
                    <p className="text-sm font-semibold">{copy.reminderTypes[type]}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="label">{copy.titleField}</span>
                  <input className="input" value={form.title} onChange={(event) => updateForm('title', event.target.value)} />
                </label>
                <label className="block">
                  <span className="label">{copy.dueAt}</span>
                  <input className="input" type="datetime-local" value={form.due_at} onChange={(event) => updateForm('due_at', event.target.value)} />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="label">{copy.notes}</span>
                <textarea className="input min-h-[120px]" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
              </label>
              <button className="btn-primary mt-4" type="button" onClick={() => setShowModal(true)}>
                + {copy.createReminder}
              </button>
            </Card>
          </section>
        </>
      )}

      {showModal ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel max-w-xl">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-lapka-900">{copy.createReminderTitle}</h2>
                <p className="mt-1 text-sm text-lapka-600">{copy.createReminderSubtitle}</p>
              </div>
              <button className="btn-secondary !px-3 !py-1.5" type="button" onClick={() => setShowModal(false)}>
                {copy.cancel}
              </button>
            </header>

            <form className="mt-5 space-y-4" onSubmit={onCreateReminder}>
              <label className="block">
                <span className="label">{copy.type}</span>
                <select className="input" value={form.reminder_type} onChange={(event) => updateForm('reminder_type', event.target.value)}>
                  {REMINDER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {copy.reminderTypes[type]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">{copy.titleField}</span>
                <input className="input" value={form.title} onChange={(event) => updateForm('title', event.target.value)} required />
              </label>

              <label className="block">
                <span className="label">{copy.dueAt}</span>
                <input className="input" type="datetime-local" value={form.due_at} onChange={(event) => updateForm('due_at', event.target.value)} required />
              </label>

              <label className="block">
                <span className="label">{copy.notes}</span>
                <textarea className="input min-h-[120px]" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
              </label>

              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" type="submit" disabled={savingReminder}>
                  {savingReminder ? copy.saving : copy.save}
                </button>
                <button className="btn-secondary" type="button" onClick={() => setShowModal(false)}>
                  {copy.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
