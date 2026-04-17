'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildMedicationCenter, formatDateTimeLabel } from '@/lib/owner-workspace';

function reminderBadge(reminder, isEn) {
  const dueAt = reminder.due_at || reminder.dueAt;
  const overdue = dueAt && new Date(dueAt).getTime() < Date.now();
  return <span className={overdue ? 'badge-red' : 'badge-yellow'}>{overdue ? (isEn ? 'Overdue' : 'Просрочено') : (isEn ? 'Soon' : 'Скоро')}</span>;
}

export default function OwnerMedicationCenterPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const dtLocale = isEn ? 'en' : 'ru';
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
      setError(requestError.message || (isEn ? 'Failed to load medication center' : 'Не удалось загрузить центр лекарств'));
      setPets([]);
      setReminders([]);
      setVisits([]);
      setPrescriptions([]);
      setCenter(null);
    } finally {
      setLoading(false);
    }
  }, [initialPetId, isEn]);

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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">{isEn ? 'Medication center' : 'Центр лекарств'}</p>
          <h1 className="page-title">{isEn ? 'Medications and prescriptions' : 'Лекарства и назначения'}</h1>
          <p className="page-subtitle">{isEn ? 'One hub for treatment courses, next dose, stock, dosing calendar and home kit.' : 'Единый центр курсов лечения, следующей дозы, запасов, календаря приёма и домашней аптечки владельца.'}</p>
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
        <EmptyState title={isEn ? 'No active pet' : 'Нет активного питомца'} text={isEn ? 'Add a pet or return after the medical record is created.' : 'Добавьте питомца или откройте страницу после создания медкарты.'} />
      ) : (
        <>
          <Card title={isEn ? 'Which pet to show' : 'Кому показываем назначения'} subtitle={isEn ? 'The center is always tied to one pet so courses do not mix.' : 'Центр всегда привязан к одному питомцу, чтобы владелец не путался между курсами.'}>
            <div className="flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button key={pet.id} type="button" className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId(pet.id)}>
                  {pet.name}
                </button>
              ))}
            </div>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
            <Card title={isEn ? 'Active prescriptions' : 'Активные назначения'} subtitle={isEn ? 'Courses and current meds' : 'Курсы и текущие препараты'}>
              <p className="text-[2.4rem] font-black tracking-tight text-lapka-950">{center.activeCourseCount}</p>
            </Card>
            <Card title={isEn ? 'Next dose' : 'Следующая доза'} subtitle={isEn ? 'Next calendar action' : 'Ближайшее действие по календарю'}>
              <p className="text-[1.7rem] font-black tracking-tight text-lapka-950">{center.nextMedication ? center.nextMedication.title : '—'}</p>
              <p className="mt-1 text-sm text-lapka-600">{center.nextMedication ? formatDateTimeLabel(center.nextMedication.due_at, dtLocale) : (isEn ? 'No active medications' : 'Нет активных лекарств')}</p>
            </Card>
            <Card title={isEn ? 'Missed' : 'Пропуски'} subtitle={isEn ? 'Tasks already in the past' : 'Сколько задач уже в прошлом'}>
              <p className="text-[2.4rem] font-black tracking-tight text-lapka-950">{center.missed}</p>
            </Card>
            <Card title={isEn ? 'Running low' : 'Заканчивается'} subtitle={isEn ? 'Needs check or refill' : 'Требует проверки или повторной покупки'}>
              <p className="text-[2.4rem] font-black tracking-tight text-lapka-950">{center.lowStockCount}</p>
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.12fr_0.88fr]">
            <Card title={isEn ? 'Today board' : 'Режим на сегодня'} subtitle={isEn ? 'What to give today and upcoming doses.' : 'Что нужно дать сегодня, и какие приёмы уже приближаются по времени.'}>
              {center.dailyBoard.length ? (
                <div className="space-y-3">
                  {center.dailyBoard.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-4 rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <div>
                        <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                        <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(item.dueAt || item.due_at, dtLocale)}</p>
                        {item.notes ? <p className="mt-2 text-sm text-lapka-600">{item.notes}</p> : null}
                      </div>
                      {reminderBadge(item, isEn)}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title={isEn ? 'No medication reminders yet' : 'Напоминаний по лекарствам пока нет'} text={isEn ? 'When discharge notes include prescriptions or you add home reminders, they appear here.' : 'Как только в выписке появятся назначения или домашние напоминания, они будут собраны здесь.'} />
              )}
            </Card>

            <Card title={isEn ? 'Linked to visits' : 'Связь с визитами'} subtitle={isEn ? 'Meds are tied to visits and digital history, not isolated.' : 'Лекарства не висят отдельно — они связаны с визитом и цифровой историей питомца.'}>
              {center.visitBridge.length ? (
                <div className="space-y-3">
                  {center.visitBridge.map((visit) => (
                    <Link key={visit.id} href={visit.href} className="block rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                      <p className="text-lg font-bold text-lapka-900">{visit.title}</p>
                      <p className="mt-1 text-sm text-lapka-600">{formatDateTimeLabel(visit.when, dtLocale)}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title={isEn ? 'No linked visits' : 'Нет привязанных визитов'} text={isEn ? 'When the clinic adds prescriptions, they show up next to the visit.' : 'Когда клиника добавит назначения, они автоматически появятся рядом с визитом.'} />
              )}
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.12fr_0.88fr]">
            <Card title={isEn ? 'Medication history' : 'История препаратов'} subtitle={isEn ? 'Form, prescription status and safe owner notes.' : 'Форма выпуска, статус рецептурности и безопасная памятка для владельца.'}>
              {center.prescribed.length ? (
                <div className="space-y-3">
                  {center.prescribed.map((item) => (
                    <div key={item.id} className="rounded-[26px] border border-lapka-200 bg-white px-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xl font-bold text-lapka-950">{item.name}</p>
                          <p className="mt-1 text-base leading-relaxed text-lapka-600">{item.instruction || (isEn ? 'Details are in the clinic discharge note and should be discussed with your vet.' : 'Подробности доступны в выписке клиники и обсуждаются с врачом.')}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={item.prescriptionRequired ? 'badge-yellow' : 'pill'}>{item.prescriptionRequired ? (isEn ? 'Prescription' : 'Рецептурное') : (isEn ? 'OTC' : 'Нерецептурное')}</span>
                          {item.lowStock ? <span className="badge-red">{isEn ? 'Running low' : 'Заканчивается'}</span> : <span className="badge-green">{isEn ? 'In stock' : 'Запас есть'}</span>}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-sm text-lapka-600">
                        <span className="pill !px-3 !py-1.5">{isEn ? `Stock ~ ${item.stockDays} d` : `Запаса ~ ${item.stockDays} дн.`}</span>
                        <span className="pill !px-3 !py-1.5">{isEn ? 'Refill via pharmacy' : 'Повторная покупка — через аптеку'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title={isEn ? 'Medication history is empty' : 'История препаратов пока пуста'} text={isEn ? 'After the vet prescribes meds, they are collected here instead of random notes.' : 'После назначения врачом препараты будут собраны в отдельный центр, а не в случайные заметки.'} />
              )}
            </Card>

            <Card title={isEn ? 'Home kit' : 'Домашняя аптечка'} subtitle={isEn ? 'What you have at home, where it is stored and what to check early.' : 'P1-сценарий из roadmap: что есть дома, где лежит и что нужно проверить заранее.'}>
              <div className="space-y-3">
                {center.kit.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-lapka-900">{item.name}</p>
                        <p className="mt-1 text-sm text-lapka-600">{item.category} · {item.storage}</p>
                      </div>
                      <span className={item.status === 'review' ? 'badge-yellow' : 'badge-green'}>{item.status === 'review' ? (isEn ? 'Review' : 'Проверить') : (isEn ? 'Ready' : 'Готово')}</span>
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
