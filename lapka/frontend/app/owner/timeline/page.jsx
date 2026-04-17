'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildHealthTimeline, groupTimelineItems, formatDateTimeLabel } from '@/lib/owner-workspace';

function getFilters(isEn) {
  return [
    { id: 'all', label: isEn ? 'All events' : 'Все события' },
    { id: 'visit', label: isEn ? 'Visits' : 'Визиты' },
    { id: 'medication', label: isEn ? 'Medications' : 'Лекарства' },
    { id: 'document', label: isEn ? 'Documents' : 'Документы' },
    { id: 'appointment', label: isEn ? 'Appointments' : 'Записи' },
    { id: 'vaccine', label: isEn ? 'Vaccinations' : 'Вакцинации' },
    { id: 'reminder', label: isEn ? 'Reminders' : 'Напоминания' },
  ];
}

function formatGroupDayHeader(dateKey, dateLocale) {
  if (!dateKey || dateKey === 'other') return dateKey === 'other' ? '—' : '';
  const d = new Date(`${dateKey}T12:00:00`);
  if (isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function OwnerTimelinePage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const dateLocale = isEn ? 'en-US' : 'ru-RU';
  const dtLocale = isEn ? 'en' : 'ru';
  const filters = getFilters(isEn);

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
      const petFallback = isEn ? 'Pet' : 'Питомец';
      const combined = bundles.flatMap((bundle, index) =>
        buildHealthTimeline({
          petId: petIds[index],
          visits: bundle.visits,
          documents: bundle.documents,
          reminders: base.reminders,
          appointments: base.appointments,
          vaccines: bundle.vaccines,
          prescriptionsByVisit: bundle.prescriptionsByVisit,
        }).map((item) => ({ ...item, petId: petIds[index], petName: base.pets[index]?.name || petFallback }))
      );
      setTimelineItems(combined);
      setSelectedPetId(base.pets[0]?.id || 'all');
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to load health timeline' : 'Не удалось загрузить ленту здоровья'));
      setPets([]);
      setTimelineItems([]);
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return timelineItems.filter((item) => {
      const petMatch = selectedPetId === 'all' || item.petId === selectedPetId;
      const typeMatch = activeFilter === 'all' || item.type === activeFilter;
      const queryMatch =
        !q || [item.title, item.subtitle, item.meta, item.petName].filter(Boolean).join(' ').toLowerCase().includes(q);
      return petMatch && typeMatch && queryMatch;
    });
  }, [activeFilter, query, selectedPetId, timelineItems]);

  const grouped = useMemo(() => groupTimelineItems(filtered), [filtered]);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">
            {isEn ? 'Health timeline' : 'Лента здоровья'}
          </p>
          <h1 className="page-title">
            {isEn ? 'Unified health history across all pets' : 'Единая история здоровья по всем питомцам'}
          </h1>
          <p className="page-subtitle">
            {isEn
              ? 'Visits, medications, labs, documents, vaccinations and care events in one chronological view.'
              : 'Визиты, лекарства, анализы, документы, вакцинации и важные события ухода собраны в одну хронологию.'}
          </p>
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
          <Card
            title={isEn ? 'Filters' : 'Фильтры'}
            subtitle={
              isEn
                ? 'Slice the history you need without jumping across separate screens.'
                : 'Быстро соберите нужный срез истории без переходов по отдельным сущностям.'
            }
          >
            <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">
                  {isEn ? 'Pet' : 'Питомец'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={
                      selectedPetId === 'all'
                        ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm'
                        : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'
                    }
                    onClick={() => setSelectedPetId('all')}
                  >
                    {isEn ? 'All pets' : 'Все питомцы'}
                  </button>
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      type="button"
                      className={
                        selectedPetId === pet.id
                          ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm'
                          : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'
                      }
                      onClick={() => setSelectedPetId(pet.id)}
                    >
                      {pet.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <SearchInput
                  label={isEn ? 'Search timeline' : 'Поиск по ленте здоровья'}
                  placeholder={isEn ? 'Document, symptom, medication, visit…' : 'Документ, симптом, лекарство, визит…'}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      className={
                        activeFilter === filter.id
                          ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm'
                          : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'
                      }
                      onClick={() => setActiveFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card
            title={isEn ? 'History' : 'История'}
            subtitle={
              isEn
                ? 'See medications, documents and what was prescribed at a glance.'
                : 'За 10 секунд можно понять, что происходило, какие были лекарства, когда появились документы и что было назначено.'
            }
          >
            {grouped.length ? (
              <div className="space-y-5">
                {grouped.map((group) => (
                  <section key={group.date} className="space-y-3">
                    <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-lapka-500">
                      {formatGroupDayHeader(group.date, dateLocale)}
                    </h2>
                    <div className="space-y-3">
                      {group.items.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="flex items-start gap-4 rounded-[26px] border border-lapka-200 bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-soft"
                        >
                          <span
                            className={`mt-1 h-3 w-3 rounded-full ${
                              item.tone === 'warning'
                                ? 'bg-amber-400'
                                : item.tone === 'critical'
                                  ? 'bg-rose-500'
                                  : 'bg-cyan-500'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-xl font-bold text-lapka-950">{item.title}</p>
                                <p className="mt-1 text-base text-lapka-600">{item.subtitle}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-lapka-500">{item.petName}</p>
                                <p className="mt-1 text-sm text-lapka-500">{formatDateTimeLabel(item.when, dtLocale)}</p>
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
              <EmptyState
                title={isEn ? 'Timeline is empty' : 'Timeline пока пуст'}
                text={
                  isEn
                    ? 'Change filters or wait for new visits, documents and prescriptions.'
                    : 'Измените фильтр или подождите, пока появятся новые визиты, документы и назначения.'
                }
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
