'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildVisitCenter, formatDateTimeLabel } from '@/lib/owner-workspace';

export default function OwnerVisitCenterPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [reminders, setReminders] = useState([]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const center = useMemo(
    () => buildVisitCenter({ pets, appointments: appointments.filter((row) => row.pet_id === selectedPetId), visits, documents, reminders: reminders.filter((row) => row.pet_id === selectedPetId) }),
    [appointments, documents, pets, reminders, selectedPetId, visits]
  );

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await loadOwnerBaseData();
      const petId = base.pets[0]?.id || '';
      setPets(base.pets);
      setSelectedPetId(petId);
      setAppointments(base.appointments);
      setReminders(base.reminders);
      if (petId) {
        const bundle = await loadPetHealthBundle(petId);
        setVisits(bundle.visits);
        setDocuments(bundle.documents);
      } else {
        setVisits([]);
        setDocuments([]);
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить центр визитов');
      setPets([]);
      setAppointments([]);
      setReminders([]);
      setVisits([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!selectedPetId || loading) return;
    let active = true;
    async function loadPet() {
      try {
        const bundle = await loadPetHealthBundle(selectedPetId);
        if (!active) return;
        setVisits(bundle.visits);
        setDocuments(bundle.documents);
      } catch {
        // ignore secondary pet switch failures
      }
    }
    loadPet();
    return () => {
      active = false;
    };
  }, [loading, selectedPetId]);

  return (
    <div className="space-y-7">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Центр визитов</p>
          <h1 className="page-title">Визиты и подготовка к ним</h1>
          <p className="page-subtitle">Единый центр прошедших приёмов, будущих записей, повторных действий, документов и подготовки к следующему контакту с клиникой.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState title="Нет активного питомца" text="Добавьте питомца, чтобы Lapka собрала центр визитов и подготовки к ним." />
      ) : (
        <>
          <Card title="Для какого питомца открываем центр" subtitle="Визиты всегда показываются в контексте одного активного питомца.">
            <div className="flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button key={pet.id} type="button" className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId(pet.id)}>
                  {pet.name}
                </button>
              ))}
            </div>
          </Card>

          <section className="kpi-grid">
            <Card title="Будущие записи"><p className="text-4xl font-black text-lapka-900">{center.upcoming.length}</p></Card>
            <Card title="История визитов"><p className="text-4xl font-black text-lapka-900">{center.recentVisits.length}</p></Card>
            <Card title="Повторные действия"><p className="text-4xl font-black text-lapka-900">{center.followUp.length}</p></Card>
            <Card title="Документы к визиту"><p className="text-4xl font-black text-lapka-900">{center.exportPack.documents.length}</p></Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
            <Card title="Ближайшие записи" subtitle="Что уже запланировано и к чему стоит подготовиться">
              {center.upcoming.length ? (
                <div className="space-y-3">
                  {center.upcoming.map((row) => (
                    <Link key={row.id} href={`/owner/appointment/${row.id}`} className="block rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                      <p className="text-lg font-bold text-lapka-900">{row.service_type || 'Визит'}</p>
                      <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(row.scheduled_at)} · {row.visit_type === 'video_consultation' ? 'онлайн' : 'в клинике'}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="Будущих записей пока нет" text="Откройте запись в клинику и выберите слот." />
              )}
            </Card>

            <Card title="Как подготовиться" subtitle="Практичный чек-лист до следующего визита">
              <div className="space-y-2">
                {center.preparation.map((item) => (
                  <div key={item} className="rounded-xl border border-lapka-200 bg-white px-4 py-3 text-sm text-lapka-700">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.1fr_0.9fr]">
            <Card title="Последние визиты" subtitle="История визитов и основные причины обращения">
              {center.recentVisits.length ? (
                <div className="space-y-3">
                  {center.recentVisits.map((visit) => (
                    <Link key={visit.id} href={`/owner/pet/${visit.pet_id}/records`} className="block rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                      <p className="text-lg font-bold text-lapka-900">{visit.chief_complaint || 'Визит в клинику'}</p>
                      <p className="mt-1 text-sm text-lapka-600">{visit.pet_name} · {formatDateTimeLabel(visit.finalized_at || visit.created_at)}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="История визитов пока пуста" text="После первого визита здесь появится короткая понятная лента." />
              )}
            </Card>

            <Card title="Повторные действия и вопросы врачу" subtitle="Что ещё может потребоваться после визита">
              <div className="space-y-3">
                {center.followUp.length ? center.followUp.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-base font-bold text-lapka-900">{item.title || 'Следующее действие'}</p>
                    <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(item.due_at)}</p>
                  </div>
                )) : <EmptyState title="Повторных действий пока нет" text="Напоминания по следующим шагам появятся автоматически." />}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
