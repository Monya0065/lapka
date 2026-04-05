/* eslint-disable react/no-unescaped-entities */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import EmptyState from '@/components/ui/EmptyState';
import { apiRequest } from '@/lib/api';

function formatSlotLabel(slot) {
  try {
    const d = new Date(slot.start_at);
    return d.toLocaleString('ru-RU', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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
      setError(e.message || 'Не удалось загрузить доступные услуги/врачей');
      setServices([]);
      setVets([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

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
      setError(e.message || 'Не удалось загрузить доступные слоты');
    } finally {
      setSlotsLoading(false);
    }
  }, [clinicId, selectedVetId, targetDate]);

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
      setError(e.message || 'Не удалось создать запись');
    } finally {
      setBookingLoading(false);
    }
  }, [clinicId, selectedSlot, canBook, owner, pet, notes, selectedServiceId, selectedVetId]);

  if (loading) {
    return (
      <main className="page-wrap py-6">
        <section className="mx-auto w-full max-w-3xl space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap py-6">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <header className="page-header">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Онлайн-запись 24/7</p>
            <h1 className="page-title">Запись на приём</h1>
            <p className="page-subtitle">Выберите услугу, врача, дату и оставьте контакты. Мы создадим запись в вашей клинике.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login?role=owner" className="btn-secondary !px-4 !py-2">Вход для владельца</Link>
          </div>
        </header>

        {error ? <ErrorBanner message={error} onRetry={loadPublicMeta} /> : null}

        {(!services.length && !vets.length) ? (
          <EmptyState title="Нет доступных опций" text="Эта клиника пока не настроила расписание и услуги для онлайн-записи." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
            <section className="space-y-6">
              <Card title="Шаг 1: услуга и врач" subtitle="Можно записаться по умолчанию и сменить выбор позже.">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="label">Услуга</span>
                    <select className="input" value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}>
                      {services.length ? (
                        services.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))
                      ) : (
                        <option value="">Консультация</option>
                      )}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Врач</span>
                    <select className="input" value={selectedVetId} onChange={(e) => setSelectedVetId(e.target.value)}>
                      {vets.length ? vets.map((v) => (
                        <option key={v.id} value={v.id}>{v.full_name}</option>
                      )) : <option value="">Любой врач</option>}
                    </select>
                  </label>
                </div>
              </Card>

              <Card title="Шаг 2: дата и слоты" subtitle="Слоты подтягиваются из расписания клиники.">
                <div className="grid gap-4 md:grid-cols-[240px_1fr] md:items-start">
                  <label className="block">
                    <span className="label">Дата</span>
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
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            <div className="truncate">{formatSlotLabel(slot)}</div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">{slot.vet_name}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="Нет доступных слотов" text="Выберите другую дату или врача." />
                    )}
                  </div>
                </div>
              </Card>
            </section>

            <aside className="space-y-6">
              <Card title="Шаг 3: контакты и питомец" subtitle="После подтверждения запись появится в вашей клинике.">
                <div className="space-y-4">
                  <label className="block">
                    <span className="label">Имя и фамилия</span>
                    <input className="input" value={owner.full_name} onChange={(e) => setOwner((cur) => ({ ...cur, full_name: e.target.value }))} placeholder="Напр.: Анна Орлова" />
                  </label>
                  <label className="block">
                    <span className="label">Email</span>
                    <input className="input" value={owner.email} onChange={(e) => setOwner((cur) => ({ ...cur, email: e.target.value }))} placeholder="name@example.com" />
                  </label>
                  <label className="block">
                    <span className="label">Телефон</span>
                    <input className="input" value={owner.phone} onChange={(e) => setOwner((cur) => ({ ...cur, phone: e.target.value }))} placeholder="+7 9xx xxx-xx-xx" />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="label">Имя питомца</span>
                      <input className="input" value={pet.name} onChange={(e) => setPet((cur) => ({ ...cur, name: e.target.value }))} placeholder="Напр.: Барсик" />
                    </label>
                    <label className="block">
                      <span className="label">Вид</span>
                      <select className="input" value={pet.species} onChange={(e) => setPet((cur) => ({ ...cur, species: e.target.value }))}>
                        <option value="dog">Собака</option>
                        <option value="cat">Кошка</option>
                        <option value="dog">Пёс</option>
                        <option value="cat">Кот</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="label">Порода (опционально)</span>
                    <input className="input" value={pet.breed} onChange={(e) => setPet((cur) => ({ ...cur, breed: e.target.value }))} placeholder="Напр.: британская" />
                  </label>

                  <label className="block">
                    <span className="label">Заметки (опционально)</span>
                    <textarea className="input min-h-[96px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Коротко опишите вопрос/цель визита" />
                  </label>
                </div>
              </Card>

              {selectedSlot ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Вы выбрали слот</p>
                  <p className="mt-1 text-sm text-slate-600">{formatSlotLabel(selectedSlot)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{selectedSlot.vet_name}</p>
                </div>
              ) : null}

              {bookingSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-800">Запись создана</p>
                  <p className="mt-2 text-sm text-emerald-700">Клиника: {bookingSuccess.clinic_name}</p>
                  <p className="mt-1 text-sm text-emerald-700">Врач: {bookingSuccess.vet_name}</p>
                  <p className="mt-1 text-sm text-emerald-700">Когда: {new Date(bookingSuccess.start_at).toLocaleString('ru-RU')}</p>
                  <p className="mt-3 text-xs font-semibold text-emerald-700">ID записи: {bookingSuccess.appointment_id}</p>
                  <div className="mt-4">
                    <Link href="/login?role=owner" className="btn-primary w-full">Вернуться на сайт</Link>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={!canBook || bookingLoading}
                  onClick={book}
                >
                  {bookingLoading ? 'Создаём запись…' : 'Подтвердить запись'}
                </button>
              )}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

