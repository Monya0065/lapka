'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildPreventionCenter, formatDateTimeLabel } from '@/lib/owner-workspace';
import { localizeReminderType } from '@/lib/pets';

export default function OwnerPreventionPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const dtLocale = isEn ? 'en' : 'ru';
  const docLocale = isEn ? 'en' : 'ru';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [reminders, setReminders] = useState([]);
  const [vaccines, setVaccines] = useState([]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const center = useMemo(
    () =>
      buildPreventionCenter({
        pet: selectedPet,
        vaccines,
        reminders: reminders.filter((item) => item.pet_id === selectedPetId),
        locale: docLocale,
      }),
    [docLocale, reminders, selectedPet, selectedPetId, vaccines]
  );

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
      setError(requestError.message || (isEn ? 'Failed to load prevention center' : 'Не удалось загрузить центр профилактики'));
      setPets([]);
      setReminders([]);
      setVaccines([]);
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
        setVaccines(bundle.vaccines);
      } catch {
        // ignore per-pet load errors
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">
            {isEn ? 'Prevention center' : 'Центр профилактики'}
          </p>
          <h1 className="page-title">{isEn ? 'Prevention and vaccination' : 'Профилактика и вакцинация'}</h1>
          <p className="page-subtitle">
            {isEn
              ? 'Vaccines, boosters, seasonal tasks, deworming and wellness checks in one place.'
              : 'Единый профилактический центр: прививки, ревакцинации, сезонные задачи, дегельминтизация и профилактические осмотры.'}
          </p>
        </div>
      </header>
      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}
      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState
          title={isEn ? 'No active pet' : 'Нет активного питомца'}
          text={isEn ? 'Add a pet so Lapka can build your prevention center.' : 'Добавьте питомца, чтобы Lapka собрала центр профилактики.'}
        />
      ) : (
        <>
          <Card title={isEn ? 'Pet' : 'Питомец'}>
            <div className="flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'}
                  onClick={() => setSelectedPetId(pet.id)}
                >
                  {pet.name}
                </button>
              ))}
            </div>
          </Card>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
            <Card
              title={isEn ? 'Upcoming prevention tasks' : 'Ближайшие профилактические задачи'}
              subtitle={isEn ? 'Vaccination, exam and routine procedure reminders' : 'Напоминания по прививкам, осмотрам и регулярным процедурам'}
            >
              {center.preventionReminders.length ? (
                <div className="space-y-3">
                  {center.preventionReminders.map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-lg font-bold text-lapka-900">
                        {item.title || (isEn ? 'Prevention task' : 'Профилактическая задача')}
                      </p>
                      <p className="mt-1 text-sm text-lapka-600">
                        {formatDateTimeLabel(item.due_at, dtLocale)} · {localizeReminderType(item.reminder_type, docLocale)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={isEn ? 'No upcoming tasks' : 'Ближайших задач пока нет'}
                  text={
                    isEn
                      ? 'When prevention reminders appear, they will show up here.'
                      : 'Как только появятся профилактические reminders, они будут собраны здесь.'
                  }
                />
              )}
            </Card>

            <Card
              title={isEn ? 'Latest vaccination' : 'Последняя вакцинация'}
              subtitle={isEn ? 'Already recorded in the pet chart' : 'Что уже внесено в карту питомца'}
            >
              {center.lastVaccine ? (
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-xl font-black text-lapka-900">{center.lastVaccine.vaccine_name || (isEn ? 'Vaccination' : 'Вакцинация')}</p>
                  <p className="mt-1 text-sm text-lapka-600">
                    {formatDateTimeLabel(center.lastVaccine.administered_at || center.lastVaccine.created_at, dtLocale)}
                  </p>
                </div>
              ) : (
                <EmptyState
                  title={isEn ? 'No vaccination records yet' : 'Записей о вакцинации пока нет'}
                  text={
                    isEn
                      ? 'After you add preventive records, they will appear here.'
                      : 'После добавления профилактических записей они появятся здесь.'
                  }
                />
              )}
            </Card>
          </section>

          <Card
            title={isEn ? 'Seasonal tips' : 'Сезонные подсказки'}
            subtitle={isEn ? 'Practical tasks so routine prevention does not slip' : 'Практичные задачи, которые помогают не упустить регулярную профилактику'}
          >
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
