'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildPreventionCenter, formatDateTimeLabel } from '@/lib/owner-workspace';
import { localizeReminderType } from '@/lib/pets';

export default function OwnerPreventionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [reminders, setReminders] = useState([]);
  const [vaccines, setVaccines] = useState([]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const center = useMemo(() => buildPreventionCenter({ pet: selectedPet, vaccines, reminders: reminders.filter((item) => item.pet_id === selectedPetId) }), [reminders, selectedPet, selectedPetId, vaccines]);

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
        setVaccines(bundle.vaccines);
      } else {
        setVaccines([]);
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить центр профилактики');
      setPets([]);
      setReminders([]);
      setVaccines([]);
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
        setVaccines(bundle.vaccines);
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Центр профилактики</p>
          <h1 className="page-title">Профилактика и вакцинация</h1>
          <p className="page-subtitle">Единый профилактический центр: прививки, ревакцинации, сезонные задачи, дегельминтизация и профилактические осмотры.</p>
        </div>
      </header>
      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}
      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState title="Нет активного питомца" text="Добавьте питомца, чтобы Lapka собрала центр профилактики." />
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

          <section className="grid items-start gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
            <Card title="Ближайшие профилактические задачи" subtitle="Напоминания по прививкам, осмотрам и регулярным процедурам">
              {center.preventionReminders.length ? (
                <div className="space-y-3">
                  {center.preventionReminders.map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-lg font-bold text-lapka-900">{item.title || 'Профилактическая задача'}</p>
                      <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(item.due_at)} · {localizeReminderType(item.reminder_type, 'ru')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Ближайших задач пока нет" text="Как только появятся профилактические reminders, они будут собраны здесь." />
              )}
            </Card>

            <Card title="Последняя вакцинация" subtitle="Что уже внесено в карту питомца">
              {center.lastVaccine ? (
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-xl font-black text-lapka-900">{center.lastVaccine.vaccine_name || 'Вакцинация'}</p>
                  <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(center.lastVaccine.administered_at || center.lastVaccine.created_at)}</p>
                </div>
              ) : (
                <EmptyState title="Записей о вакцинации пока нет" text="После добавления профилактических записей они появятся здесь." />
              )}
            </Card>
          </section>

          <Card title="Сезонные подсказки" subtitle="Практичные задачи, которые помогают не упустить регулярную профилактику">
            <div className="grid gap-3 md:grid-cols-2">
              {center.seasonal.map((item) => (
                <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-7 text-lapka-700">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
