'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import CalculatorSuite from '@/components/features/CalculatorSuite';
import { loadOwnerBaseData } from '@/lib/owner-data';
import { buildPersonalCarePlan, CALCULATOR_STRIP } from '@/lib/owner-workspace';

const HUB_GROUPS = [
  {
    id: 'nutrition',
    title: 'Питание и вода',
    description: 'Калории, вода, возраст и базовые безопасные ориентиры для владельца.',
    tools: ['water', 'rer', 'age'],
  },
  {
    id: 'routine',
    title: 'Рутина и наблюдение',
    description: 'Вес, интервалы, контроль состояния и бытовые сценарии.',
    tools: ['age', 'water'],
  },
  {
    id: 'services',
    title: 'Подготовка к визиту',
    description: 'Перейти в ленту здоровья, лекарства и документы без ручного поиска по меню.',
    links: [
      { href: '/owner/timeline', label: 'Лента здоровья' },
      { href: '/owner/medications', label: 'Лекарства' },
      { href: '/owner/documents', label: 'Документы' },
    ],
  },
];

export default function OwnerCalculatorsPage() {
  const searchParams = useSearchParams();
  const preferredTool = searchParams.get('tool') || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [query, setQuery] = useState('');

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await loadOwnerBaseData();
      setPets(base.pets || []);
      setReminders(base.reminders || []);
      setSelectedPetId((current) => current && base.pets.some((item) => item.id === current) ? current : (base.pets[0]?.id || ''));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить центр калькуляторов');
      setPets([]);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  const selectedPet = useMemo(
    () => pets.find((item) => item.id === selectedPetId) || null,
    [pets, selectedPetId]
  );

  const petReminders = useMemo(
    () => reminders.filter((item) => !selectedPetId || item.pet_id === selectedPetId),
    [reminders, selectedPetId]
  );

  const carePlan = useMemo(
    () => buildPersonalCarePlan({ pet: selectedPet, reminders: petReminders, timeline: [] }),
    [petReminders, selectedPet]
  );

  const filteredQuickTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CALCULATOR_STRIP.filter((item) => !q || `${item.title} ${item.description}`.toLowerCase().includes(q));
  }, [query]);

  const dueToday = useMemo(
    () => petReminders.filter((item) => {
      const due = new Date(item.due_at || 0);
      return !Number.isNaN(due.getTime()) && due.toDateString() === new Date().toDateString();
    }),
    [petReminders]
  );

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Калькуляторы</p>
          <h1 className="page-title">Единый центр калькуляторов для владельца</h1>
          <p className="page-subtitle">Не россыпь инструментов, а один центр: вода, калории, возраст, ритм наблюдения и быстрые переходы к лекарствам, документам и ленте здоровья.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadHub} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[280px] w-full" />
          <Skeleton className="h-[520px] w-full" />
        </section>
      ) : !pets.length ? (
        <EmptyState
          title="Питомцев пока нет"
          text="Добавьте питомца, чтобы Lapka могла подсказывать релевантные безопасные расчёты и план ухода."
          action={<Link href="/owner/pets" className="btn-primary">Перейти к питомцам</Link>}
        />
      ) : (
        <>
          <Card>
            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Активный питомец</p>
                <div className="mt-3 flex flex-wrap gap-2">
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
              </div>
              <div className="w-full max-w-xl">
                <SearchInput
                  label="Быстрый поиск по калькуляторам"
                  placeholder="вода, калории, возраст, интервалы…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          </Card>

          <section className="kpi-grid">
            <StatsCard label="Безопасные инструменты" value={String(filteredQuickTools.length)} />
            <StatsCard label="Напоминания сегодня" value={String(dueToday.length)} />
            <StatsCard label="План на день" value={String(carePlan.today.length)} />
            <StatsCard label="Фокус питомца" value={selectedPet?.name || '—'} />
          </section>

          <section className="grid gap-5 2xl:grid-cols-[1.04fr_0.96fr]">
            <Card title="Что считать в первую очередь" subtitle="Калькуляторы привязаны к реальным сценариям владельца, а не спрятаны списком без контекста.">
              <div className="grid gap-3 md:grid-cols-3">
                {filteredQuickTools.length ? filteredQuickTools.map((item) => (
                  <Link key={item.id} href={item.href} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-lapka-600">{item.description}</p>
                  </Link>
                )) : (
                  <EmptyState title="Инструменты не найдены" text="Измените запрос или очистите поиск." />
                )}
              </div>
            </Card>

            <Card title="Контекст на сегодня" subtitle="Калькуляторы должны помогать действовать, а не просто показывать формулу.">
              <div className="space-y-3">
                {carePlan.today.map((item) => (
                  <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-base font-semibold text-lapka-900">{item}</p>
                  </div>
                ))}
                <div className="rounded-[24px] border border-lapka-200 bg-lapka-50/85 px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Где продолжить</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/owner/care" className="btn-secondary !min-h-[40px] !px-4 !py-2">Уход и питание</Link>
                    <Link href="/owner/medications" className="btn-secondary !min-h-[40px] !px-4 !py-2">Лекарства</Link>
                    <Link href="/owner/timeline" className="btn-secondary !min-h-[40px] !px-4 !py-2">Лента здоровья</Link>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section className="grid gap-5 2xl:grid-cols-3">
            {HUB_GROUPS.map((group) => (
              <Card key={group.id} title={group.title} subtitle={group.description}>
                {group.tools ? (
                  <div className="space-y-3">
                    {CALCULATOR_STRIP.filter((item) => group.tools.includes(item.id)).map((item) => (
                      <Link key={item.id} href={item.href} className="action-grid-link">
                        <div>
                          <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-lapka-600">{item.description}</p>
                        </div>
                        <span className="pill !px-3 !py-1.5">Инструмент</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {group.links.map((item) => (
                      <Link key={item.href} href={item.href} className="action-grid-link">
                        <div>
                          <p className="text-lg font-bold text-lapka-900">{item.label}</p>
                        </div>
                        <span className="pill !px-3 !py-1.5">Раздел</span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </section>

          <CalculatorSuite embedded preferredTool={preferredTool} title="Калькуляторы владельца" />
        </>
      )}
    </div>
  );
}
