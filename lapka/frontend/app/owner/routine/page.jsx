'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildHealthTimeline, buildMedicationCenter, buildPersonalCarePlan, buildRoutineCenter } from '@/lib/owner-workspace';

export default function OwnerRoutinePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [reminders, setReminders] = useState([]);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const timeline = useMemo(() => buildHealthTimeline({ petId: selectedPetId, visits, documents, reminders }), [documents, reminders, selectedPetId, visits]);
  const medications = useMemo(() => buildMedicationCenter({ pet: selectedPet, reminders: reminders.filter((row) => row.pet_id === selectedPetId), prescriptions, visits }), [prescriptions, reminders, selectedPet, selectedPetId, visits]);
  const carePlan = useMemo(() => buildPersonalCarePlan({ pet: selectedPet, reminders: reminders.filter((row) => row.pet_id === selectedPetId), timeline }), [reminders, selectedPet, selectedPetId, timeline]);
  const routine = useMemo(() => buildRoutineCenter({ pet: selectedPet, reminders: reminders.filter((row) => row.pet_id === selectedPetId), medications, carePlan }), [carePlan, medications, reminders, selectedPet, selectedPetId]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await loadOwnerBaseData();
      const petId = base.pets[0]?.id || '';
      setPets(base.pets);
      setSelectedPetId(petId);
      setReminders(base.reminders);
      if (petId) {
        const bundle = await loadPetHealthBundle(petId);
        setVisits(bundle.visits);
        setDocuments(bundle.documents);
        setPrescriptions(bundle.prescriptions);
      } else {
        setVisits([]);
        setDocuments([]);
        setPrescriptions([]);
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить центр рутины');
      setPets([]);
      setReminders([]);
      setVisits([]);
      setDocuments([]);
      setPrescriptions([]);
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
        setPrescriptions(bundle.prescriptions);
      } catch {}
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Рутина</p>
          <h1 className="page-title">Ежедневная рутина питомца</h1>
          <p className="page-subtitle">Кормление, вода, прогулки, лекарства, уход и короткие наблюдения собраны в один ежедневный центр.</p>
        </div>
      </header>
      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}
      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState title="Нет активного питомца" text="Добавьте питомца, чтобы Lapka собрала ежедневную рутину." />
      ) : (
        <>
          <Card title="Питомец">
            <div className="flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button key={pet.id} type="button" className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId(pet.id)}>
                  {pet.name}
                </button>
              ))}
            </div>
          </Card>
          <section className="grid gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
            <Card title="Ежедневные задачи" subtitle="Простая рутина без потери контекста между уходом и здоровьем">
              <div className="space-y-3">
                {routine.dailyTasks.map((task) => (
                  <div key={task.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-lg font-bold text-lapka-900">{task.title}</p>
                    <p className="mt-2 text-sm leading-7 text-lapka-700">{task.description}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Периоды наблюдения" subtitle="Короткие интервалы, когда полезно сравнивать состояние по дням">
              <div className="space-y-3">
                {routine.observationSessions.map((item) => (
                  <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-7 text-lapka-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[24px] border border-lapka-200 bg-lapka-50 px-4 py-4 text-sm leading-7 text-lapka-700">
                {routine.note}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
