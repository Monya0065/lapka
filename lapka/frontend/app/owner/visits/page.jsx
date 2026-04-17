'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildVisitCenter, formatDateTimeLabel } from '@/lib/owner-workspace';

export default function OwnerVisitCenterPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const dtLocale = isEn ? 'en' : 'ru';
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
      setError(requestError.message || (isEn ? 'Failed to load visit center' : 'Не удалось загрузить центр визитов'));
      setPets([]);
      setAppointments([]);
      setReminders([]);
      setVisits([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [isEn]);

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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">{isEn ? 'Visit center' : 'Центр визитов'}</p>
          <h1 className="page-title">{isEn ? 'Visits and preparation' : 'Визиты и подготовка к ним'}</h1>
          <p className="page-subtitle">{isEn ? 'Unified center for past visits, upcoming appointments, follow-up actions and documents.' : 'Единый центр прошедших приёмов, будущих записей, повторных действий, документов и подготовки к следующему контакту с клиникой.'}</p>
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
        <EmptyState title={isEn ? 'No active pet' : 'Нет активного питомца'} text={isEn ? 'Add a pet to build visit and preparation center.' : 'Добавьте питомца, чтобы Lapka собрала центр визитов и подготовки к ним.'} />
      ) : (
        <>
          <Card title={isEn ? 'Pick pet for this center' : 'Для какого питомца открываем центр'} subtitle={isEn ? 'Visits are shown in context of one active pet.' : 'Визиты всегда показываются в контексте одного активного питомца.'}>
            <div className="flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button key={pet.id} type="button" className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId(pet.id)}>
                  {pet.name}
                </button>
              ))}
            </div>
          </Card>

          <section className="kpi-grid">
            <Card title={isEn ? 'Upcoming appointments' : 'Будущие записи'}><p className="text-4xl font-black text-lapka-900">{center.upcoming.length}</p></Card>
            <Card title={isEn ? 'Visit history' : 'История визитов'}><p className="text-4xl font-black text-lapka-900">{center.recentVisits.length}</p></Card>
            <Card title={isEn ? 'Follow-up actions' : 'Повторные действия'}><p className="text-4xl font-black text-lapka-900">{center.followUp.length}</p></Card>
            <Card title={isEn ? 'Visit documents' : 'Документы к визиту'}><p className="text-4xl font-black text-lapka-900">{center.exportPack.documents.length}</p></Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
            <Card title={isEn ? 'Upcoming appointments' : 'Ближайшие записи'} subtitle={isEn ? 'What is already scheduled and what to prepare for' : 'Что уже запланировано и к чему стоит подготовиться'}>
              {center.upcoming.length ? (
                <div className="space-y-3">
                  {center.upcoming.map((row) => (
                    <Link key={row.id} href={`/owner/appointment/${row.id}`} className="block rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                      <p className="text-lg font-bold text-lapka-900">{row.service_type || (isEn ? 'Visit' : 'Визит')}</p>
                      <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(row.scheduled_at, dtLocale)} · {row.visit_type === 'video_consultation' ? (isEn ? 'online' : 'онлайн') : (isEn ? 'in clinic' : 'в клинике')}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title={isEn ? 'No upcoming appointments yet' : 'Будущих записей пока нет'} text={isEn ? 'Open booking and choose a slot.' : 'Откройте запись в клинику и выберите слот.'} />
              )}
            </Card>

            <Card title={isEn ? 'How to prepare' : 'Как подготовиться'} subtitle={isEn ? 'Practical checklist before next visit' : 'Практичный чек-лист до следующего визита'}>
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
            <Card title={isEn ? 'Recent visits' : 'Последние визиты'} subtitle={isEn ? 'Visit history and main complaint reasons' : 'История визитов и основные причины обращения'}>
              {center.recentVisits.length ? (
                <div className="space-y-3">
                  {center.recentVisits.map((visit) => (
                    <Link key={visit.id} href={`/owner/pet/${visit.pet_id}/records`} className="block rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                      <p className="text-lg font-bold text-lapka-900">{visit.chief_complaint || (isEn ? 'Clinic visit' : 'Визит в клинику')}</p>
                      <p className="mt-1 text-sm text-lapka-600">{visit.pet_name} · {formatDateTimeLabel(visit.finalized_at || visit.created_at, dtLocale)}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title={isEn ? 'Visit history is empty' : 'История визитов пока пуста'} text={isEn ? 'After the first visit, a short timeline will appear here.' : 'После первого визита здесь появится короткая понятная лента.'} />
              )}
            </Card>

            <Card title={isEn ? 'Follow-up actions and vet questions' : 'Повторные действия и вопросы врачу'} subtitle={isEn ? 'What may still be needed after the visit' : 'Что ещё может потребоваться после визита'}>
              <div className="space-y-3">
                {center.followUp.length ? center.followUp.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-base font-bold text-lapka-900">{item.title || (isEn ? 'Next action' : 'Следующее действие')}</p>
                    <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(item.due_at, dtLocale)}</p>
                  </div>
                )) : <EmptyState title={isEn ? 'No follow-up actions yet' : 'Повторных действий пока нет'} text={isEn ? 'Next-step reminders will appear automatically.' : 'Напоминания по следующим шагам появятся автоматически.'} />}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
