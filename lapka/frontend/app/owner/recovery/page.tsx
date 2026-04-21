'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildHealthTimeline, buildMedicationCenter, buildRecoveryMode } from '@/lib/owner-workspace';
import { resolvePetPhoto } from '@/lib/pets';

export default function OwnerRecoveryPage() {
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
  const recovery = useMemo(() => buildRecoveryMode({ pet: selectedPet, reminders: reminders.filter((row) => row.pet_id === selectedPetId), medications, timeline }), [medications, reminders, selectedPet, selectedPetId, timeline]);

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
      setError(requestError.message || 'Не удалось загрузить режим восстановления');
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Восстановление</p>
          <h1 className="page-title">Восстановление после процедуры</h1>
          <p className="page-subtitle">Отдельный сценарий для периода после операции или сложной процедуры: спокойный режим, контроль, повторные действия и готовность быстро связаться с клиникой.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-[340px] w-full" />
          <Skeleton className="h-[420px] w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState title="Нет активного питомца" text="Добавьте питомца, чтобы открыть режим восстановления." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Восстановление"
            title={`${selectedPet.name}: режим спокойного восстановления`}
            description="Здесь собраны задачи на день, ограничения, контрольные сигналы, лекарства и повторные действия. Это не медицинское назначение, а понятный маршрут для владельца без хаоса."
            imageSrc={resolvePetPhoto(selectedPet)}
            imageAlt={selectedPet.name}
            badges={[recovery.phaseLabel, 'Контроль по дням', 'Напоминания']}
            compact
          />

          <Card title="Питомец">
            <div className="flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button key={pet.id} type="button" className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId(pet.id)}>
                  {pet.name}
                </button>
              ))}
            </div>
          </Card>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
            <Card title="План на сегодня" subtitle="Что стоит проверить без перегрузки и без самолечения">
              <div className="space-y-3">
                {recovery.dayPlan.map((item) => (
                  <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 text-base leading-relaxed text-lapka-700">{item}</div>
                ))}
              </div>
            </Card>
            <Card title="Ограничения и красные сигналы" subtitle="Две разные вещи: что ограничить и когда уже нужно ехать в клинику">
              <div className="grid gap-3">
                <div className="rounded-[24px] border border-lapka-200 bg-lapka-50 px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Ограничить</p>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-lapka-700">
                    {recovery.restrictions.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-600">Срочно обсудить с клиникой</p>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-rose-700">
                    {recovery.warningSigns.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              </div>
            </Card>
          </section>

          <section className="grid items-start gap-5 xl:grid-cols-2 2xl:grid-cols-[1.08fr_0.92fr]">
            <Card title="Контроль и следующие шаги" subtitle="Ближайшие действия по восстановлению и повторным осмотрам">
              {recovery.followUps.length ? (
                <div className="space-y-3">
                  {recovery.followUps.map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-lg font-bold text-lapka-900">{item.title || 'Контроль'}</p>
                      <p className="mt-1 text-sm text-lapka-600">{new Date(item.due_at).toLocaleString('ru-RU')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Следующих шагов пока нет" text="Новые задачи появятся после следующего визита или назначения." />
              )}
            </Card>
            <Card title="Следующие шаги" subtitle="Спокойный маршрут без переключений между разделами">
              <div className="grid gap-3">
                <Link href={`/owner/medications?pet=${selectedPet.id}`} className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Лекарства и остатки</p>
                    <p className="mt-1 text-sm text-lapka-600">Открыть назначения и проверить следующий препарат.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Лекарства</span>
                </Link>
                <Link href={`/owner/pet/${selectedPet.id}/documents`} className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Документы и фото</p>
                    <p className="mt-1 text-sm text-lapka-600">Подготовить материалы для контроля у врача.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">{recovery.mediaHints.length}</span>
                </Link>
                <Link href="/owner/visits" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Подготовить повторный визит</p>
                    <p className="mt-1 text-sm text-lapka-600">Собрать вопросы и открыть центр визитов.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Визит</span>
                </Link>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
