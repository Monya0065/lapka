'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildMedicationCenter, formatDateTimeLabel } from '@/lib/owner-workspace';

function reminderBadge(reminder) {
  const overdue = new Date(reminder.dueAt).getTime() < Date.now();
  return <span className={overdue ? 'badge-red' : 'badge-yellow'}>{overdue ? 'Просрочено' : 'Скоро'}</span>;
}

export default function OwnerMedicationCenterPage() {
  const searchParams = useSearchParams();
  const initialPetId = searchParams.get('pet') || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [reminders, setReminders] = useState([]);
  const [visits, setVisits] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [center, setCenter] = useState(null);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);

  const loadCenter = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await loadOwnerBaseData();
      const targetPetId = initialPetId && base.pets.some((item) => item.id === initialPetId) ? initialPetId : (base.pets[0]?.id || '');
      setPets(base.pets);
      setSelectedPetId(targetPetId);
      setReminders(base.reminders.filter((item) => item.pet_id === targetPetId));
      const bundle = await loadPetHealthBundle(targetPetId);
      setVisits(bundle.visits);
      setPrescriptions(bundle.prescriptions);
      setCenter(buildMedicationCenter({
        pet: base.pets.find((item) => item.id === targetPetId),
        reminders: base.reminders.filter((item) => item.pet_id === targetPetId),
        prescriptions: bundle.prescriptions,
        visits: bundle.visits,
      }));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить центр лекарств');
      setPets([]);
      setReminders([]);
      setVisits([]);
      setPrescriptions([]);
      setCenter(null);
    } finally {
      setLoading(false);
    }
  }, [initialPetId]);

  useEffect(() => {
    loadCenter();
  }, [loadCenter]);

  useEffect(() => {
    if (!selectedPetId || loading) return;
    let active = true;
    async function reloadForPet() {
      try {
        const base = await loadOwnerBaseData();
        const bundle = await loadPetHealthBundle(selectedPetId);
        if (!active) return;
        const pet = base.pets.find((item) => item.id === selectedPetId) || null;
        setReminders(base.reminders.filter((item) => item.pet_id === selectedPetId));
        setVisits(bundle.visits);
        setPrescriptions(bundle.prescriptions);
        setCenter(buildMedicationCenter({ pet, reminders: base.reminders.filter((item) => item.pet_id === selectedPetId), prescriptions: bundle.prescriptions, visits: bundle.visits }));
      } catch {
        // ignore secondary refresh errors; top-level error already handled
      }
    }
    reloadForPet();
    return () => {
      active = false;
    };
  }, [loading, selectedPetId]);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Центр лекарств</p>
          <h1 className="page-title">Лекарства и назначения</h1>
          <p className="page-subtitle">Единый центр курсов лечения, следующей дозы, запасов, календаря приёма и домашней аптечки владельца.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadCenter} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-[460px] w-full" />
        </section>
      ) : !selectedPet || !center ? (
        <EmptyState title="Нет активного питомца" text="Добавьте питомца или откройте страницу после создания медкарты." />
      ) : (
        <>
          <Card title="Кому показываем назначения" subtitle="Центр всегда привязан к одному питомцу, чтобы владелец не путался между курсами.">
            <div className="flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button key={pet.id} type="button" className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId(pet.id)}>
                  {pet.name}
                </button>
              ))}
            </div>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
            <Card title="Активные назначения" subtitle="Курсы и текущие препараты">
              <p className="text-[2.4rem] font-black tracking-tight text-lapka-950">{center.activeCourseCount}</p>
            </Card>
            <Card title="Следующая доза" subtitle="Ближайшее действие по календарю">
              <p className="text-[1.7rem] font-black tracking-tight text-lapka-950">{center.nextMedication ? center.nextMedication.title : '—'}</p>
              <p className="mt-1 text-sm text-lapka-600">{center.nextMedication ? formatDateTimeLabel(center.nextMedication.due_at) : 'Нет активных лекарств'}</p>
            </Card>
            <Card title="Пропуски" subtitle="Сколько задач уже в прошлом">
              <p className="text-[2.4rem] font-black tracking-tight text-lapka-950">{center.missed}</p>
            </Card>
            <Card title="Заканчивается" subtitle="Требует проверки или повторной покупки">
              <p className="text-[2.4rem] font-black tracking-tight text-lapka-950">{center.lowStockCount}</p>
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.12fr_0.88fr]">
            <Card title="Режим на сегодня" subtitle="Что нужно дать сегодня, и какие приёмы уже приближаются по времени.">
              {center.dailyBoard.length ? (
                <div className="space-y-3">
                  {center.dailyBoard.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-4 rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <div>
                        <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                        <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(item.dueAt)}</p>
                        {item.notes ? <p className="mt-2 text-sm text-lapka-600">{item.notes}</p> : null}
                      </div>
                      {reminderBadge(item)}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Напоминаний по лекарствам пока нет" text="Как только в выписке появятся назначения или домашние напоминания, они будут собраны здесь." />
              )}
            </Card>

            <Card title="Связь с визитами" subtitle="Лекарства не висят отдельно — они связаны с визитом и цифровой историей питомца.">
              {center.visitBridge.length ? (
                <div className="space-y-3">
                  {center.visitBridge.map((visit) => (
                    <Link key={visit.id} href={visit.href} className="block rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                      <p className="text-lg font-bold text-lapka-900">{visit.title}</p>
                      <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(visit.when)}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="Нет привязанных визитов" text="Когда клиника добавит назначения, они автоматически появятся рядом с визитом." />
              )}
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.12fr_0.88fr]">
            <Card title="История препаратов" subtitle="Форма выпуска, статус рецептурности и безопасная памятка для владельца.">
              {center.prescribed.length ? (
                <div className="space-y-3">
                  {center.prescribed.map((item) => (
                    <div key={item.id} className="rounded-[26px] border border-lapka-200 bg-white px-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xl font-bold text-lapka-950">{item.name}</p>
                          <p className="mt-1 text-base leading-relaxed text-lapka-600">{item.instruction || 'Подробности доступны в выписке клиники и обсуждаются с врачом.'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={item.prescriptionRequired ? 'badge-yellow' : 'pill'}>{item.prescriptionRequired ? 'Рецептурное' : 'Нерецептурное'}</span>
                          {item.lowStock ? <span className="badge-red">Заканчивается</span> : <span className="badge-green">Запас есть</span>}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-sm text-lapka-600">
                        <span className="pill !px-3 !py-1.5">Запаса ~ {item.stockDays} дн.</span>
                        <span className="pill !px-3 !py-1.5">Повторная покупка — через аптеку</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="История препаратов пока пуста" text="После назначения врачом препараты будут собраны в отдельный центр, а не в случайные заметки." />
              )}
            </Card>

            <Card title="Домашняя аптечка" subtitle="P1-сценарий из roadmap: что есть дома, где лежит и что нужно проверить заранее.">
              <div className="space-y-3">
                {center.kit.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-lapka-900">{item.name}</p>
                        <p className="mt-1 text-sm text-lapka-600">{item.category} · {item.storage}</p>
                      </div>
                      <span className={item.status === 'review' ? 'badge-yellow' : 'badge-green'}>{item.status === 'review' ? 'Проверить' : 'Готово'}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-lapka-600">{item.note}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
