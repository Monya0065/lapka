'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildHealthTimeline, groupTimelineItems, formatDateTimeLabel } from '@/lib/owner-workspace';

const FILTERS = [
  { id: 'all', label: 'Все события' },
  { id: 'visit', label: 'Визиты' },
  { id: 'medication', label: 'Лекарства' },
  { id: 'document', label: 'Документы' },
  { id: 'appointment', label: 'Записи' },
  { id: 'vaccine', label: 'Вакцинации' },
  { id: 'reminder', label: 'Напоминания' },
];

export default function OwnerTimelinePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('all');
  const [timelineItems, setTimelineItems] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await loadOwnerBaseData();
      setPets(base.pets);
      const petIds = base.pets.map((item) => item.id);
      const bundles = await Promise.all(petIds.map((petId) => loadPetHealthBundle(petId)));
      const combined = bundles.flatMap((bundle, index) => buildHealthTimeline({
        petId: petIds[index],
        visits: bundle.visits,
        documents: bundle.documents,
        reminders: base.reminders,
        appointments: base.appointments,
        vaccines: bundle.vaccines,
        prescriptionsByVisit: bundle.prescriptionsByVisit,
      }).map((item) => ({ ...item, petId: petIds[index], petName: base.pets[index]?.name || 'Питомец' })));
      setTimelineItems(combined);
      setSelectedPetId(base.pets[0]?.id || 'all');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить ленту здоровья');
      setPets([]);
      setTimelineItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return timelineItems.filter((item) => {
      const petMatch = selectedPetId === 'all' || item.petId === selectedPetId;
      const typeMatch = activeFilter === 'all' || item.type === activeFilter;
      const queryMatch = !q || [item.title, item.subtitle, item.meta, item.petName].filter(Boolean).join(' ').toLowerCase().includes(q);
      return petMatch && typeMatch && queryMatch;
    });
  }, [activeFilter, query, selectedPetId, timelineItems]);

  const grouped = useMemo(() => groupTimelineItems(filtered), [filtered]);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Лента здоровья</p>
          <h1 className="page-title">Единая история здоровья по всем питомцам</h1>
          <p className="page-subtitle">Визиты, лекарства, анализы, документы, вакцинации и важные события ухода собраны в одну хронологию.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadTimeline} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[520px] w-full" />
        </section>
      ) : (
        <>
          <Card title="Фильтры" subtitle="Быстро соберите нужный срез истории без переходов по отдельным сущностям.">
            <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Питомец</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={selectedPetId === 'all' ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId('all')}>Все питомцы</button>
                  {pets.map((pet) => (
                    <button key={pet.id} type="button" className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId(pet.id)}>{pet.name}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <SearchInput label="Поиск по ленте здоровья" placeholder="Документ, симптом, лекарство, визит…" value={query} onChange={(event) => setQuery(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((filter) => (
                    <button key={filter.id} type="button" className={activeFilter === filter.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setActiveFilter(filter.id)}>{filter.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="История" subtitle="За 10 секунд можно понять, что происходило, какие были лекарства, когда появились документы и что было назначено.">
            {grouped.length ? (
              <div className="space-y-5">
                {grouped.map((group) => (
                  <section key={group.day} className="space-y-3">
                    <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-lapka-500">{group.day}</h2>
                    <div className="space-y-3">
                      {group.events.map((item) => (
                        <Link key={item.id} href={item.href} className="flex items-start gap-4 rounded-[26px] border border-lapka-200 bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                          <span className={`mt-1 h-3 w-3 rounded-full ${item.tone === 'warning' ? 'bg-amber-400' : item.tone === 'critical' ? 'bg-rose-500' : 'bg-cyan-500'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-xl font-bold text-lapka-950">{item.title}</p>
                                <p className="mt-1 text-base text-lapka-600">{item.subtitle}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-lapka-500">{item.petName}</p>
                                <p className="mt-1 text-sm text-lapka-500">{formatDateTimeLabel(item.when)}</p>
                              </div>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-lapka-500">{item.meta}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState title="Timeline пока пуст" text="Измените фильтр или подождите, пока появятся новые визиты, документы и назначения." />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
