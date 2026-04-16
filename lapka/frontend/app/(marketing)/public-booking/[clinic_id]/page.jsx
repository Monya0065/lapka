/* eslint-disable react/no-unescaped-entities */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import EmptyState from '@/components/ui/EmptyState';
import { apiRequest } from '@/lib/api';

function formatSlotLabel(slot, locale = 'ru-RU') {
  try {
    const d = new Date(slot.start_at);
    return d.toLocaleString(locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(slot.start_at || '—');
  }
}

function isoDate(d) {
  const dd = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dd.getTime())) return '';
  return dd.toISOString().slice(0, 10);
}

export default function PublicBookingPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const lang = langCode.startsWith('en') ? 'en' : 'ru';
  const tr = (ru, en) => (lang === 'en' ? en : ru);
  const params = useParams();
  const clinicId = useMemo(() => params?.clinic_id || '', [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [services, setServices] = useState([]);
  const [vets, setVets] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedVetId, setSelectedVetId] = useState('');

  const today = useMemo(() => isoDate(new Date()), []);
  const [targetDate, setTargetDate] = useState(today);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [owner, setOwner] = useState({ full_name: '', email: '', phone: '' });
  const [pet, setPet] = useState({ name: '', species: 'dog', breed: '' });
  const [notes, setNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const loadPublicMeta = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError('');
    setBookingSuccess(null);
    try {
      const [servicesPayload, vetsPayload] = await Promise.all([
        apiRequest(`/api/v1/public/booking/${clinicId}/services`, { auth: false }),
        apiRequest(`/api/v1/public/booking/${clinicId}/vets`, { auth: false }),
      ]);
      setServices(Array.isArray(servicesPayload) ? servicesPayload : []);
      setVets(Array.isArray(vetsPayload) ? vetsPayload : []);
      setSelectedServiceId((cur) => cur || (Array.isArray(servicesPayload) && servicesPayload[0]?.id ? servicesPayload[0].id : ''));
      setSelectedVetId((cur) => cur || (Array.isArray(vetsPayload) && vetsPayload[0]?.id ? vetsPayload[0].id : ''));
    } catch (e) {
      setError(e.message || (lang === 'en' ? 'Failed to load available services/vets' : 'Не удалось загрузить доступные услуги/врачей'));
      setServices([]);
      setVets([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, lang]);

  const loadSlots = useCallback(async () => {
    if (!clinicId || !targetDate) return;
    setSlotsLoading(true);
    setError('');
    setSelectedSlot(null);
    setSlots([]);
    try {
      const query = new URLSearchParams({ target_date: targetDate });
      if (selectedVetId) query.set('vet_id', selectedVetId);
      // We keep UI minimal: we pass only vet + date and let backend fall back service duration defaults.
      const payload = await apiRequest(`/api/v1/public/booking/${clinicId}/slots?${query.toString()}`, { auth: false });
      setSlots(Array.isArray(payload) ? payload : []);
    } catch (e) {
      setError(e.message || (lang === 'en' ? 'Failed to load available slots' : 'Не удалось загрузить доступные слоты'));
    } finally {
      setSlotsLoading(false);
    }
  }, [clinicId, selectedVetId, targetDate, lang]);

  useEffect(() => {
    loadPublicMeta();
  }, [loadPublicMeta]);

  useEffect(() => {
    if (!loading) loadSlots();
  }, [loading, loadSlots]);

  const canBook = useMemo(() => {
    if (!selectedSlot) return false;
    if (!owner.full_name.trim()) return false;
    if (!owner.email.trim()) return false;
    if (!owner.phone.trim()) return false;
    if (!pet.name.trim()) return false;
    return true;
  }, [owner, pet.name, selectedSlot]);
  const bookingPressure = useMemo(() => {
    if (!services.length && !vets.length) return 'HIGH';
    if (!selectedSlot || slots.length === 0) return 'MED';
    if (canBook) return 'OK';
    return 'LOW';
  }, [canBook, selectedSlot, services.length, slots.length, vets.length]);
  const slotCoverage = useMemo(() => {
    const capacity = Math.max(1, vets.length * 4);
    return Math.min(100, Math.round((slots.length / capacity) * 100));
  }, [slots.length, vets.length]);
  const leadReadiness = useMemo(() => {
    const checks = [
      owner.full_name.trim().length > 0,
      owner.email.trim().length > 0,
      owner.phone.trim().length > 0,
      pet.name.trim().length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [owner.email, owner.full_name, owner.phone, pet.name]);

  const book = useCallback(async () => {
    if (!clinicId || !selectedSlot || !canBook) return;
    setBookingLoading(true);
    setError('');
    setBookingSuccess(null);
    try {
      const payload = await apiRequest(`/api/v1/public/booking/${clinicId}/book`, {
        auth: false,
        method: 'POST',
        body: {
          owner,
          pet: { name: pet.name.trim(), species: pet.species || 'dog', breed: pet.breed.trim() || null },
          service_id: selectedServiceId || null,
          vet_id: selectedSlot.vet_id || selectedVetId || null,
          start_at: selectedSlot.start_at,
          notes: notes.trim() || null,
        },
      });
      setBookingSuccess(payload || null);
    } catch (e) {
      // Keep user-facing error generic (no medical advice; just booking errors).
      setError(e.message || (lang === 'en' ? 'Failed to create booking' : 'Не удалось создать запись'));
    } finally {
      setBookingLoading(false);
    }
  }, [clinicId, selectedSlot, canBook, owner, pet, notes, selectedServiceId, selectedVetId, lang]);

  if (loading) {
    return (
      <main className="page-wrap py-6">
        <section className="mx-auto w-full max-w-5xl space-y-4">
          <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-400/14 via-surface-muted to-cyan-400/12 p-5 shadow-card md:p-8 dark:from-emerald-500/10 dark:to-cyan-500/10">
            <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full max-w-lg" />
                <Skeleton className="h-4 w-full max-w-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            </div>
          </section>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap py-6">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-400/14 via-surface-muted to-cyan-400/12 p-5 shadow-card md:p-8 dark:from-emerald-500/10 dark:to-cyan-500/10">
          <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{tr('Публичная запись', 'Public booking')}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">{tr('Запись на прием 24/7', 'Book an appointment 24/7')}</h1>
              <p className="mt-3 text-sm leading-relaxed text-theme-muted">
                {tr('Клиника ID', 'Clinic ID')} <span className="font-mono text-theme">{String(clinicId).slice(0, 8)}…</span> {tr('— услуги и слоты подгружаются из живого API.', '— services and slots are loaded from live API.')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/login?role=owner" className="btn-secondary !px-4 !py-2">{tr('Вход для владельца', 'Owner sign in')}</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: tr('Услуг', 'Services'), value: services.length, tone: '' },
                { label: tr('Врачей', 'Vets'), value: vets.length, tone: 'text-sky-700 dark:text-sky-300' },
                {
                  label: tr('Слотов', 'Slots'),
                  value: slotsLoading ? '…' : slots.length,
                  tone: 'text-emerald-700 dark:text-emerald-300',
                },
                {
                  label: tr('Дата', 'Date'),
                  value: targetDate ? targetDate.slice(5) : '—',
                  tone: 'text-violet-700 dark:text-violet-300',
                },
                { label: tr('Выбран слот', 'Selected slot'), value: selectedSlot ? 1 : 0, tone: selectedSlot ? 'text-amber-700 dark:text-amber-300' : '' },
                { label: tr('Готово к брони', 'Ready to book'), value: canBook ? 1 : 0, tone: canBook ? 'text-rose-700 dark:text-rose-300' : '' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-3xl font-black tabular-nums ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{tr('Операционный срез', 'Operational slice')}</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">{tr('Сигналы публичной записи', 'Public booking signals')}</h2>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
              public booking ops
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: tr('Давление бронирования', 'Booking pressure'),
                value: bookingPressure,
                text: tr('Сигнал по доступности услуг, врачей и фактических слотов для записи.', 'Signal based on service/vet availability and actual slots.'),
                href: '/public-booking',
                tone: bookingPressure === 'HIGH'
                  ? 'text-rose-700 dark:text-rose-300'
                  : bookingPressure === 'MED'
                    ? 'text-amber-700 dark:text-amber-300'
                    : bookingPressure === 'OK'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-sky-700 dark:text-sky-300',
              },
              {
                title: tr('Покрытие слотами', 'Slot coverage'),
                value: `${slotCoverage}%`,
                text: tr('Насыщенность доступными слотами относительно текущего пула врачей клиники.', 'Density of available slots relative to current vet pool.'),
                href: '/owner/appointments',
                tone: 'text-violet-700 dark:text-violet-300',
              },
              {
                title: tr('Готовность лида', 'Lead readiness'),
                value: `${leadReadiness}%`,
                text: tr('Полнота контактных полей владельца и данных питомца перед подтверждением.', 'Completeness of owner contacts and pet data before confirmation.'),
                href: '/login?role=owner',
                tone: 'text-sky-700 dark:text-sky-300',
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
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">{tr('Открыть контур', 'Open flow')}</p>
              </Link>
            ))}
          </div>
        </section>

        {error ? <ErrorBanner message={error} onRetry={loadPublicMeta} /> : null}

        {(!services.length && !vets.length) ? (
          <EmptyState title={tr('Нет доступных опций', 'No available options')} text={tr('Эта клиника пока не настроила расписание и услуги для онлайн-записи.', 'This clinic has not configured schedule/services for online booking yet.')} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
            <section className="space-y-6">
              <Card title={tr('Шаг 1: услуга и врач', 'Step 1: service and vet')} subtitle={tr('Можно записаться по умолчанию и сменить выбор позже.', 'You can book with defaults and change selection later.')}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="label">{tr('Услуга', 'Service')}</span>
                    <select className="input" value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}>
                      {services.length ? (
                        services.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))
                      ) : (
                        <option value="">{tr('Консультация', 'Consultation')}</option>
                      )}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">{tr('Врач', 'Vet')}</span>
                    <select className="input" value={selectedVetId} onChange={(e) => setSelectedVetId(e.target.value)}>
                      {vets.length ? vets.map((v) => (
                        <option key={v.id} value={v.id}>{v.full_name}</option>
                      )) : <option value="">{tr('Любой врач', 'Any vet')}</option>}
                    </select>
                  </label>
                </div>
              </Card>

              <Card title={tr('Шаг 2: дата и слоты', 'Step 2: date and slots')} subtitle={tr('Слоты подтягиваются из расписания клиники.', 'Slots are loaded from clinic schedule.')}>
                <div className="grid gap-4 md:grid-cols-[240px_1fr] md:items-start">
                  <label className="block">
                    <span className="label">{tr('Дата', 'Date')}</span>
                    <input className="input" type="date" value={targetDate} min={today} onChange={(e) => setTargetDate(e.target.value)} />
                  </label>

                  <div>
                    {slotsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                      </div>
                    ) : slots.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {slots.slice(0, 12).map((slot) => (
                          <button
                            key={slot.start_at}
                            type="button"
                            className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                              selectedSlot?.start_at === slot.start_at
                                ? 'border-text bg-text text-on-text-fill dark:border-border-hover dark:bg-surface-highlight dark:text-theme'
                                : 'border-border bg-surface-muted/70 text-theme hover:bg-surface-muted dark:text-theme'
                            }`}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            <div className="truncate">{formatSlotLabel(slot, lang === 'en' ? 'en-US' : 'ru-RU')}</div>
                            <div className="mt-1 text-xs font-semibold text-theme-muted">{slot.vet_name}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title={tr('Нет доступных слотов', 'No available slots')} text={tr('Выберите другую дату или врача.', 'Choose another date or vet.')} />
                    )}
                  </div>
                </div>
              </Card>
            </section>

            <aside className="space-y-6">
              <Card title={tr('Шаг 3: контакты и питомец', 'Step 3: contacts and pet')} subtitle={tr('После подтверждения запись появится в вашей клинике.', 'After confirmation, booking appears in your clinic flow.')}>
                <div className="space-y-4">
                  <label className="block">
                    <span className="label">{tr('Имя и фамилия', 'Full name')}</span>
                    <input className="input" value={owner.full_name} onChange={(e) => setOwner((cur) => ({ ...cur, full_name: e.target.value }))} placeholder={tr('Напр.: Анна Орлова', 'Example: Anna Orlova')} />
                  </label>
                  <label className="block">
                    <span className="label">Email</span>
                    <input className="input" value={owner.email} onChange={(e) => setOwner((cur) => ({ ...cur, email: e.target.value }))} placeholder="name@example.com" />
                  </label>
                  <label className="block">
                    <span className="label">{tr('Телефон', 'Phone')}</span>
                    <input
                      className="input"
                      value={owner.phone}
                      onChange={(e) => setOwner((cur) => ({ ...cur, phone: e.target.value }))}
                      placeholder={tr('+7 9xx xxx-xx-xx', '+1 555 123 4567')}
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="label">{tr('Имя питомца', 'Pet name')}</span>
                      <input className="input" value={pet.name} onChange={(e) => setPet((cur) => ({ ...cur, name: e.target.value }))} placeholder={tr('Напр.: Барсик', 'Example: Barsik')} />
                    </label>
                    <label className="block">
                      <span className="label">{tr('Вид', 'Species')}</span>
                      <select className="input" value={pet.species} onChange={(e) => setPet((cur) => ({ ...cur, species: e.target.value }))}>
                        <option value="dog">{tr('Собака', 'Dog')}</option>
                        <option value="cat">{tr('Кошка', 'Cat')}</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="label">{tr('Порода (опционально)', 'Breed (optional)')}</span>
                    <input className="input" value={pet.breed} onChange={(e) => setPet((cur) => ({ ...cur, breed: e.target.value }))} placeholder={tr('Напр.: британская', 'Example: British Shorthair')} />
                  </label>

                  <label className="block">
                    <span className="label">{tr('Заметки (опционально)', 'Notes (optional)')}</span>
                    <textarea className="input min-h-[96px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tr('Коротко опишите вопрос/цель визита', 'Briefly describe your question/visit goal')} />
                  </label>
                </div>
              </Card>

              {selectedSlot ? (
                <div className="rounded-2xl border border-border bg-surface-muted/70 p-4">
                  <p className="text-sm font-semibold text-theme">{tr('Вы выбрали слот', 'You selected slot')}</p>
                  <p className="mt-1 text-sm text-theme-muted">{formatSlotLabel(selectedSlot, lang === 'en' ? 'en-US' : 'ru-RU')}</p>
                  <p className="mt-1 text-xs font-semibold text-theme-muted">{selectedSlot.vet_name}</p>
                </div>
              ) : null}

              {bookingSuccess ? (
                <div className="callout-success !rounded-2xl p-4">
                  <p className="text-sm font-semibold text-theme">{tr('Запись создана', 'Booking created')}</p>
                  <p className="mt-2 text-sm text-theme-muted">{tr('Клиника', 'Clinic')}: {bookingSuccess.clinic_name}</p>
                  <p className="mt-1 text-sm text-theme-muted">{tr('Врач', 'Vet')}: {bookingSuccess.vet_name}</p>
                  <p className="mt-1 text-sm text-theme-muted">{tr('Когда', 'When')}: {new Date(bookingSuccess.start_at).toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')}</p>
                  <p className="mt-3 text-xs font-semibold text-theme">{tr('ID записи', 'Booking ID')}: {bookingSuccess.appointment_id}</p>
                  <div className="mt-4">
                    <Link href="/login?role=owner" className="btn-primary w-full">{tr('Вернуться на сайт', 'Back to site')}</Link>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={!canBook || bookingLoading}
                  onClick={book}
                >
                  {bookingLoading ? tr('Создаём запись…', 'Creating booking...') : tr('Подтвердить запись', 'Confirm booking')}
                </button>
              )}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

