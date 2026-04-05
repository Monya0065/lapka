'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
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

export default function OwnerCalendarPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'en-US';

  const [pets, setPets] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [vaccinesByPet, setVaccinesByPet] = useState({});
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
    pet_id: '',
    reminder_type: 'vaccine',
    title: '',
    due_at: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const petsPayload = await apiRequest('/api/v1/pets');
      const petsRows = Array.isArray(petsPayload) ? petsPayload : [];
      setPets(petsRows);

      const remindersPayload = await apiRequest('/api/v1/reminders?upcoming_days=180&limit=500');
      setReminders(Array.isArray(remindersPayload) ? remindersPayload : []);

      const vaccineEntries = await Promise.all(
        petsRows.map(async (pet) => {
          try {
            const rows = await apiRequest(`/api/v1/pets/${pet.id}/vaccines`);
            return [pet.id, Array.isArray(rows) ? rows : []];
          } catch {
            return [pet.id, []];
          }
        })
      );
      const byPet = {};
      vaccineEntries.forEach(([petId, rows]) => {
        byPet[petId] = rows;
      });
      setVaccinesByPet(byPet);

      if (!form.pet_id && petsRows.length) {
        setForm((prev) => ({ ...prev, pet_id: petsRows[0].id }));
      }
    } catch (requestError) {
      setError(requestError.message || t('calendar.errorCreate'));
      setPets([]);
      setReminders([]);
      setVaccinesByPet({});
    } finally {
      setLoading(false);
    }
  }, [form.pet_id, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const petNameById = useMemo(
    () =>
      pets.reduce((acc, pet) => {
        acc[pet.id] = pet.name;
        return acc;
      }, {}),
    [pets]
  );

  const allEvents = useMemo(() => {
    const reminderEvents = reminders.map((row) => ({
      id: row.id,
      type: row.reminder_type,
      title: row.title,
      dueAt: row.due_at ? new Date(row.due_at) : null,
      petId: row.pet_id,
      source: 'reminder',
      notes: row.notes || '',
    }));

    const vaccineEvents = Object.entries(vaccinesByPet).flatMap(([petId, rows]) =>
      rows
        .filter((row) => row.next_due_date)
        .map((row) => ({
          id: `vaccine-due-${row.id}`,
          type: 'vaccine',
          title: `${t('calendar.types.vaccine')}: ${row.vaccine_name}`,
          dueAt: row.next_due_date ? new Date(row.next_due_date) : null,
          petId,
          source: 'vaccine_due',
          notes: '',
        }))
    );

    return [...reminderEvents, ...vaccineEvents].sort((a, b) => a.dueAt - b.dueAt);
  }, [reminders, vaccinesByPet, t]);

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
    return allEvents.filter((e) => e.dueAt >= now).slice(0, 20);
  }, [allEvents]);

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

    if (!form.pet_id || !form.reminder_type || !form.title.trim() || !form.due_at) {
      setError(t('calendar.errorCreate'));
      return;
    }

    setSavingReminder(true);
    try {
      await apiRequest('/api/v1/reminders', {
        method: 'POST',
        body: {
          pet_id: form.pet_id,
          reminder_type: form.reminder_type,
          title: form.title.trim(),
          due_at: new Date(form.due_at).toISOString(),
          notes: form.notes.trim() || null,
        },
      });
      setSuccess(t('calendar.successCreate'));
      setShowModal(false);
      setForm((prev) => ({ ...prev, title: '', due_at: '', notes: '' }));
      await loadData();
    } catch (requestError) {
      setError(requestError.message || t('calendar.errorCreate'));
    } finally {
      setSavingReminder(false);
    }
  }

  const weekdays = t('calendar.weekdays', { returnObjects: true });
  const weekdaysArr = Array.isArray(weekdays) ? weekdays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('calendar.title')}</h1>
          <p className="page-subtitle">{t('calendar.subtitle')}</p>
        </div>
        <button className="btn-primary shrink-0" type="button" onClick={() => openCreateModal()}>
          + {t('calendar.newReminder')}
        </button>
      </header>

      <ShowcasePanel
        eyebrow={t('calendar.title')}
        title="Напоминания, вакцинации и важные даты в одном календаре"
        description="Следите за профилактикой, повторными визитами и собственными напоминаниями по каждому питомцу без перегруженного интерфейса."
        imageSrc="/assets/img/owner-banner.svg"
        imageAlt="Календарь владельца"
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      <section className="grid-soft-2">
        <Card
          title={t('calendar.month')}
          subtitle=""
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
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="capitalize text-sm font-semibold text-lapka-700">{monthLabel(currentMonth, locale)}</p>
              <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-lapka-600">
                {weekdaysArr.map((dayName) => (
                  <div key={dayName} className="px-1 py-1">
                    {dayName}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((dateValue, index) => {
                  if (!dateValue) {
                    return <div key={`empty-${index}`} className="h-20 rounded-xl border border-transparent" />;
                  }
                  const key = dayKey(dateValue);
                  const dayEvents = eventsByDay[key] || [];
                  return (
                    <button
                      key={key}
                      type="button"
                      className="h-20 rounded-xl border border-lapka-200 bg-white p-2 text-left text-xs transition hover:bg-lapka-50"
                      onClick={() => openCreateModal(dateValue)}
                    >
                      <p className="font-semibold text-lapka-800">{dateValue.getDate()}</p>
                      {dayEvents.slice(0, 2).map((event) => (
                        <span
                          key={event.id}
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            event.type === 'vaccine'
                              ? 'bg-emerald-100 text-emerald-700'
                              : event.type === 'checkup'
                                ? 'bg-cyan-100 text-cyan-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {t(`calendar.types.${event.type}`, event.type)}
                        </span>
                      ))}
                      {dayEvents.length > 2 ? (
                        <p className="mt-1 text-[10px] text-lapka-500">+{dayEvents.length - 2}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        <Card title={t('calendar.upcoming')} subtitle="">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : upcomingEvents.length ? (
            <ul className="space-y-2">
              {upcomingEvents.map((event) => (
                <li key={event.id} className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                  <p className="text-sm font-semibold text-lapka-800">{event.title}</p>
                  <p className="text-xs text-lapka-600">
                    {event.dueAt.toLocaleString(locale)} · {petNameById[event.petId] || event.petId}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t('calendar.empty')} text={t('calendar.emptyDesc')} />
          )}
        </Card>
      </section>

      {showModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-lapka-900/35 px-4">
          <div className="surface-card w-full max-w-lg p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xl font-bold tracking-tight text-lapka-900">{t('calendar.createReminder')}</h3>
              <button className="btn-secondary !px-3 !py-1" type="button" onClick={() => setShowModal(false)}>
                {t('common.close')}
              </button>
            </div>
            <form className="space-y-3" onSubmit={onCreateReminder}>
              <label className="block">
                <span className="label">{t('calendar.petLabel')}</span>
                <select
                  className="input"
                  value={form.pet_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, pet_id: e.target.value }))}
                >
                  {pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">{t('calendar.typeLabel')}</span>
                <select
                  className="input"
                  value={form.reminder_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, reminder_type: e.target.value }))}
                >
                  {REMINDER_TYPES.map((key) => (
                    <option key={key} value={key}>
                      {t(`calendar.types.${key}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">{t('calendar.titleLabel')}</span>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={t('calendar.titleLabel')}
                />
              </label>

              <label className="block">
                <span className="label">{t('calendar.dateLabel')}</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_at: e.target.value }))}
                />
              </label>

              <label className="block">
                <span className="label">{t('calendar.notesLabel')}</span>
                <textarea
                  className="input min-h-[90px]"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </label>

              <button className="btn-primary" type="submit" disabled={savingReminder}>
                {savingReminder ? t('common.saving') : t('common.save')}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
