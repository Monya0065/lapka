'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildBehaviorCenter, buildHealthTimeline } from '@/lib/owner-workspace';
import { resolvePetPhoto } from '@/lib/pets';

export default function OwnerBehaviorPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [reminders, setReminders] = useState([]);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const timeline = useMemo(() => buildHealthTimeline({ petId: selectedPetId, visits, documents, reminders }), [documents, reminders, selectedPetId, visits]);
  const behavior = useMemo(() => buildBehaviorCenter({ pet: selectedPet, timeline, reminders: reminders.filter((item) => item.pet_id === selectedPetId) }), [reminders, selectedPet, selectedPetId, timeline]);

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
      setError(requestError.message || 'Не удалось загрузить центр поведения');
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Поведение</p>
          <h1 className="page-title">Поведение и привычки</h1>
          <p className="page-subtitle">Изменения поведения часто видны раньше других сигналов. Этот центр помогает фиксировать привычный ритм, триггеры и мягкие изменения без перегруза медициной.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-[340px] w-full" />
          <Skeleton className="h-[380px] w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState title="Нет активного питомца" text="Добавьте питомца, чтобы открыть центр поведения." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Поведение"
            title={`${selectedPet.name}: привычный ритм поведения и привычек`}
            description="Здесь собраны сигналы по настроению, стрессу, сну и триггерам. Это помогает понять, что меняется, ещё до следующего визита."
            imageSrc={resolvePetPhoto(selectedPet)}
            imageAlt={selectedPet.name}
            badges={['Привычный ритм', 'Триггеры', 'Сон и стресс']}
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

          <section className="grid gap-4 md:grid-cols-3">
            {behavior.observations.map((item) => (
              <Card key={item.id} title={item.title} subtitle={item.hint}>
                <p className="text-[2.6rem] font-black tracking-tight text-lapka-950">{item.value}</p>
              </Card>
            ))}
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1fr_1fr]">
            <Card title="Что наблюдать" subtitle="Практика ежедневного наблюдения без перегрузки таблицами">
              <div className="space-y-3">
                {behavior.routines.map((item) => (
                  <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-relaxed text-lapka-700">{item}</div>
                ))}
              </div>
            </Card>
            <Card title="Частые триггеры" subtitle="То, что полезно сверять перед выводами и визитом">
              <div className="grid gap-3 sm:grid-cols-2">
                {behavior.triggers.map((item) => (
                  <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 text-sm font-semibold text-lapka-700">{item}</div>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
            <Card title="Недавние сигналы" subtitle="Связь поведения с лентой здоровья и событиями">
              {behavior.recentSignals.length ? (
                <div className="space-y-3">
                  {behavior.recentSignals.map((item) => (
                    <Link key={item.id} href={item.href} className="block rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                      <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                      <p className="mt-1 text-sm text-lapka-600">{item.subtitle}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="Сигналов пока мало" text="После визитов и заметок здесь появятся события, которые помогают понять динамику поведения." />
              )}
            </Card>
            <Card title="Куда идти дальше" subtitle="Поведение связано с уходом, симптомами и знаниями">
              <div className="grid gap-3">
                <Link href="/owner/care" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Уход и рутина</p>
                    <p className="mt-1 text-sm text-lapka-600">Проверить, не менялся ли привычный режим дня и ухода.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Уход</span>
                </Link>
                <Link href="/owner/knowledge?tab=symptoms" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Симптомы и срочность</p>
                    <p className="mt-1 text-sm text-lapka-600">Сравнить поведение с другими сигналами.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Знания</span>
                </Link>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
