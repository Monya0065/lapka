'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import TopNavigation from '@/components/ui/TopNavigation';
import AuthDropdown from '@/components/auth/AuthDropdown';
import RoleGate from '@/components/auth/RoleGate';
import Card from '@/components/ui/Card';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Badge from '@/components/ui/Badge';
import { apiRequest } from '@/lib/api';

function emergencyBadge(level) {
  const value = String(level || '').toUpperCase();
  if (value === 'RED') return <Badge tone="danger">RED</Badge>;
  if (value === 'YELLOW') return <Badge tone="warning">YELLOW</Badge>;
  return <Badge tone="success">GREEN</Badge>;
}

export default function DiseasesLibraryPage() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';

  const copy = lang === 'en'
    ? {
        topLinks: [
          { href: '/', labelKey: 'nav.home' },
          { href: '/owner/dashboard', labelKey: 'roles.owner' },
          { href: '/vet/dashboard', labelKey: 'roles.vet' },
          { href: '/clinic/dashboard', labelKey: 'roles.clinicAdmin' },
          { href: '/diseases', labelKey: 'nav.diseases' },
          { href: '/security', labelKey: 'nav.security' }
        ],
        categories: [
          { value: 'all', label: 'All categories' },
          { value: 'dermatology', label: 'Dermatology' },
          { value: 'gastroenterology', label: 'Gastroenterology' },
          { value: 'neurology', label: 'Neurology' },
          { value: 'cardiology', label: 'Cardiology' },
          { value: 'infectious', label: 'Infectious' },
          { value: 'trauma', label: 'Trauma' },
          { value: 'toxicology', label: 'Toxicology' },
          { value: 'respiratory', label: 'Respiratory' },
          { value: 'urinary', label: 'Urinary' },
          { value: 'endocrine', label: 'Endocrine' },
          { value: 'ophthalmology', label: 'Ophthalmology' }
        ],
        species: [
          { value: 'all', label: 'All species' },
          { value: 'cat', label: 'Cats' },
          { value: 'dog', label: 'Dogs' },
          { value: 'rabbit', label: 'Rabbits' },
          { value: 'ferret', label: 'Ferrets' },
          { value: 'bird', label: 'Birds' }
        ],
        title: 'Veterinary Disease Reference',
        subtitle: 'Reference library of conditions: search, filters and urgency level. No treatment instructions for owners.',
        searchLabel: 'Search diseases',
        searchPlaceholder: 'Name, description or symptom...',
        animalLabel: 'Species',
        categoryLabel: 'Category',
        symptomFilter: 'Symptom filter',
        resetFilter: 'Reset filter',
        loadError: 'Unable to load disease library',
        foundTitle: 'Diseases found',
        foundSubtitle: 'Total',
        notFoundTitle: 'Nothing found',
        notFoundText: 'Change filters or search query.',
        allSpecies: 'all species',
        prevalence: 'prevalence',
        prevalenceLabels: {
          common: 'common',
          uncommon: 'uncommon',
          rare: 'rare'
        },
        symptoms: 'Symptoms',
        filterBySymptom: 'Filter by this symptom',
        triage: 'Triage',
        details: 'Details'
      }
    : {
        topLinks: [
          { href: '/', labelKey: 'nav.home' },
          { href: '/owner/dashboard', labelKey: 'roles.owner' },
          { href: '/vet/dashboard', labelKey: 'roles.vet' },
          { href: '/clinic/dashboard', labelKey: 'roles.clinicAdmin' },
          { href: '/diseases', labelKey: 'nav.diseases' },
          { href: '/security', labelKey: 'nav.security' }
        ],
        categories: [
          { value: 'all', label: 'Все категории' },
          { value: 'dermatology', label: 'Дерматология' },
          { value: 'gastroenterology', label: 'Гастроэнтерология' },
          { value: 'neurology', label: 'Неврология' },
          { value: 'cardiology', label: 'Кардиология' },
          { value: 'infectious', label: 'Инфекционные' },
          { value: 'trauma', label: 'Травмы' },
          { value: 'toxicology', label: 'Токсикология' },
          { value: 'respiratory', label: 'Респираторные' },
          { value: 'urinary', label: 'Мочевыделительная система' },
          { value: 'endocrine', label: 'Эндокринология' },
          { value: 'ophthalmology', label: 'Офтальмология' }
        ],
        species: [
          { value: 'all', label: 'Все виды' },
          { value: 'cat', label: 'Кошки' },
          { value: 'dog', label: 'Собаки' },
          { value: 'rabbit', label: 'Кролики' },
          { value: 'ferret', label: 'Хорьки' },
          { value: 'bird', label: 'Птицы' }
        ],
        title: 'Справочник ветеринарных заболеваний',
        subtitle: 'Справочная библиотека заболеваний: поиск, фильтры и уровень срочности. Без схем лечения для владельца.',
        searchLabel: 'Поиск заболевания',
        searchPlaceholder: 'Название, описание или симптом...',
        animalLabel: 'Вид животного',
        categoryLabel: 'Категория',
        symptomFilter: 'Фильтр по симптому',
        resetFilter: 'Сбросить фильтр',
        loadError: 'Не удалось загрузить справочник заболеваний',
        foundTitle: 'Найдено заболеваний',
        foundSubtitle: 'Всего',
        notFoundTitle: 'Ничего не найдено',
        notFoundText: 'Измените фильтры или поисковый запрос.',
        allSpecies: 'все виды',
        prevalence: 'распространённость',
        prevalenceLabels: {
          common: 'часто',
          uncommon: 'нечасто',
          rare: 'редко'
        },
        symptoms: 'Симптомы',
        filterBySymptom: 'Фильтровать по этому симптому',
        triage: 'Оценка срочности',
        details: 'Подробнее'
      };

  function prevalenceLabel(value) {
    const normalized = String(value || '').toLowerCase();
    return copy.prevalenceLabels[normalized] || '—';
  }

  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState('all');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSymptomFilter, setActiveSymptomFilter] = useState('');

  const effectiveQuery = useMemo(() => {
    if (activeSymptomFilter) return activeSymptomFilter;
    return query;
  }, [activeSymptomFilter, query]);

  const filteredCount = useMemo(() => items.length, [items]);

  const loadDiseases = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (effectiveQuery.trim()) params.set('q', effectiveQuery.trim());
      if (species !== 'all') params.set('species', species);
      if (category !== 'all') params.set('category', category);
      params.set('limit', '200');
      const payload = await apiRequest(`/api/v1/diseases?${params.toString()}`);
      const rows = Array.isArray(payload?.items) ? payload.items : [];
      setItems(rows);
    } catch (requestError) {
      setError(requestError.message || copy.loadError);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveQuery, species, category, copy.loadError]);

  useEffect(() => {
    loadDiseases();
  }, [loadDiseases]);

  return (
    <RoleGate allowedRoles={['owner', 'vet', 'clinic_admin']}>
      <>
        <TopNavigation links={copy.topLinks} actions={<AuthDropdown mode="menu" />} />
        <main className="page-wrap space-y-4 py-6">
          <header className="page-header">
            <div>
              <h1 className="page-title">{copy.title}</h1>
              <p className="page-subtitle">{copy.subtitle}</p>
            </div>
          </header>

          {error ? <ErrorBanner message={error} onRetry={loadDiseases} /> : null}

          <section className="grid gap-4 2xl:grid-cols-[248px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-[96px] xl:self-start">
              <Card title="Навигация" subtitle="Ключевые разделы медицинской библиотеки">
                <div className="grid gap-2">
                  <Link href="/" className="sidebar-link">← На главную</Link>
                  <Link href="/diseases" className="sidebar-link">Заболевания</Link>
                  <Link href="/clinical/protocols" className="sidebar-link">Протоколы</Link>
                  <Link href="/tools/calculators" className="sidebar-link">Калькуляторы</Link>
                </div>
              </Card>
              <Card title="Подсказка" subtitle="Справочник не заменяет врача">
                <ul className="space-y-2 text-sm text-lapka-700">
                  <li>• Ищите по названию, категории и симптомам</li>
                  <li>• Смотрите уровень срочности</li>
                  <li>• Используйте триаж и протоколы как соседние разделы</li>
                </ul>
              </Card>
            </aside>

            <div className="space-y-4">
              <Card>
                <div className="grid gap-3 lg:grid-cols-[1fr_220px_260px]">
                  <SearchInput
                    label={copy.searchLabel}
                    placeholder={copy.searchPlaceholder}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      if (activeSymptomFilter) setActiveSymptomFilter('');
                    }}
                  />
                  <label className="block">
                    <span className="label">{copy.animalLabel}</span>
                    <select className="input" value={species} onChange={(event) => setSpecies(event.target.value)}>
                      {copy.species.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">{copy.categoryLabel}</span>
                    <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
                      {copy.categories.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {activeSymptomFilter ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="pill">{copy.symptomFilter}: {activeSymptomFilter}</span>
                    <button className="btn-secondary !px-3 !py-1" type="button" onClick={() => setActiveSymptomFilter('')}>
                      {copy.resetFilter}
                    </button>
                  </div>
                ) : null}
              </Card>

              <Card title={copy.foundTitle} subtitle={`${copy.foundSubtitle}: ${filteredCount}`}>
                {loading ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <Skeleton className="h-44 w-full" />
                    <Skeleton className="h-44 w-full" />
                    <Skeleton className="h-44 w-full" />
                    <Skeleton className="h-44 w-full" />
                  </div>
                ) : items.length === 0 ? (
                  <EmptyState title={copy.notFoundTitle} text={copy.notFoundText} />
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {items.map((disease) => (
                      <article key={disease.id} className="rounded-2xl border border-lapka-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-xl font-extrabold text-lapka-900">{disease.name}</h3>
                          {emergencyBadge(disease.emergency_level)}
                        </div>

                        <p className="mt-1 text-sm text-lapka-600">
                          {disease.category} · {(disease.species || []).join(', ') || copy.allSpecies}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-lapka-100 px-2 py-1 font-semibold text-lapka-700">
                            {copy.prevalence}: {prevalenceLabel(disease.prevalence)}
                          </span>
                          <span className="rounded-full bg-lapka-100 px-2 py-1 font-semibold text-lapka-700">
                            id: {disease.id}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-lapka-700">{disease.description || '—'}</p>

                        <div className="mt-3 rounded-xl border border-lapka-200 bg-lapka-50 p-3">
                          <p className="text-xs uppercase tracking-wide text-lapka-500">{copy.symptoms}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(disease.symptoms || []).slice(0, 8).map((symptom) => (
                              <button
                                key={`${disease.id}-${symptom}`}
                                type="button"
                                className="rounded-full border border-lapka-200 bg-white px-2 py-1 text-xs font-semibold text-lapka-700 transition hover:bg-lapka-100"
                                onClick={() => setActiveSymptomFilter(symptom)}
                                title={copy.filterBySymptom}
                              >
                                {symptom}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2 text-xs">
                          <Link href="/owner/triage" className="btn-secondary !px-3 !py-1">
                            {copy.triage}
                          </Link>
                          <Link href={`/diseases/${disease.id}`} className="btn-secondary !px-3 !py-1">
                            {copy.details}
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </section>
        </main>
      </>
    </RoleGate>
  );
}
