'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildHealthTimeline, buildVitalMetricsCenter } from '@/lib/owner-workspace';

export default function OwnerMetricsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [reminders, setReminders] = useState([]);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const timeline = useMemo(() => buildHealthTimeline({ petId: selectedPetId, visits, documents, reminders }), [documents, reminders, selectedPetId, visits]);
  const center = useMemo(() => buildVitalMetricsCenter({ pet: selectedPet, reminders: reminders.filter((item) => item.pet_id === selectedPetId), timeline, visits }), [reminders, selectedPet, selectedPetId, timeline, visits]);

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
      } else {
        setVisits([]);
        setDocuments([]);
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить метрики питомца');
      setPets([]);
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Метрики</p>
          <h1 className="page-title">Метрики состояния питомца</h1>
          <p className="page-subtitle">Вес, аппетит, вода, активность и сон собраны в один спокойный экран наблюдения, связанный с timeline и визитами.</p>
        </div>
      </header>
      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}
      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-80 w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState title="Нет активного питомца" text="Добавьте питомца, чтобы Lapka собрала метрики состояния." />
      ) : (
        <>
          <Card title="Для какого питомца смотрим метрики">
            <div className="flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button key={pet.id} type="button" className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId(pet.id)}>
                  {pet.name}
                </button>
              ))}
            </div>
          </Card>

          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-5">
            {center.charts.map((metric) => (
              <Card key={metric.id} title={metric.title} subtitle={metric.trend}>
                <p className="text-4xl font-black text-lapka-900">
                  {metric.value}
                  <span className="ml-1 text-lg font-bold text-lapka-500">{metric.unit}</span>
                </p>
              </Card>
            ))}
          </section>

          <section className="grid gap-5 2xl:grid-cols-[1.1fr_0.9fr]">
            <Card title="Что стоит проверить" subtitle="Сигналы для владельца без медицинских назначений">
              <div className="space-y-2">
                {center.alerts.map((item) => (
                  <div key={item} className="rounded-xl border border-lapka-200 bg-white px-4 py-3 text-sm text-lapka-700">
                    {item}
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Наблюдений в базе" subtitle="Связь метрик с reminders, timeline и визитами">
              <p className="text-5xl font-black text-lapka-900">{center.observationCount}</p>
              <p className="mt-3 text-sm leading-7 text-lapka-700">Метрики не живут отдельно от истории питомца: они опираются на визиты, документы, напоминания и события ленты здоровья.</p>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
