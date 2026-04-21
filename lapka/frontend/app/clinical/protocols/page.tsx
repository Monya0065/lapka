'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

const topLinks = [
  { href: '/', label: 'Главная' },
  { href: '/owner/dashboard', label: 'Владелец' },
  { href: '/vet/dashboard', label: 'Врач' },
  { href: '/clinic/dashboard', label: 'Клиника' },
  { href: '/medical/diseases', label: 'Заболевания' },
  { href: '/clinical/protocols', label: 'Протоколы' },
  { href: '/security', label: 'Безопасность' },
];

const categoryTabs = [
  { id: 'all', label: 'Все' },
  { id: 'general', label: 'Общее' },
  { id: 'emergency', label: 'Экстренные' },
  { id: 'gastroenterology', label: 'ЖКТ' },
  { id: 'neurology', label: 'Неврология' },
  { id: 'trauma', label: 'Травмы' },
  { id: 'anesthesia', label: 'Анестезия' },
  { id: 'surgery', label: 'Хирургия' },
  { id: 'toxicology', label: 'Токсикология' },
  { id: 'inpatient', label: 'Стационар' },
  { id: 'diagnostics', label: 'Диагностика' },
];

const speciesOptions = [
  { value: 'all', label: 'Все виды' },
  { value: 'cat', label: 'Кошки' },
  { value: 'dog', label: 'Собаки' },
  { value: 'rabbit', label: 'Кролики' },
  { value: 'ferret', label: 'Хорьки' },
  { value: 'bird', label: 'Птицы' },
];

function speciesLabel(species = []) {
  if (!species.length) return 'все виды';
  const normalized = species.join(', ');
  return normalized;
}

export default function ClinicalProtocolsPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState('all');
  const [category, setCategory] = useState('all');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    const speciesParam = params.get('species');
    const categoryParam = params.get('category');
    if (qParam) setQuery(qParam);
    if (speciesParam) setSpecies(speciesParam);
    if (categoryParam) setCategory(categoryParam);
  }, []);

  const filteredCount = useMemo(() => items.length, [items]);

  const loadProtocols = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (species !== 'all') params.set('species', species);
      if (category !== 'all') params.set('category', category);
      if (emergencyOnly) params.set('emergency_flag', 'true');
      params.set('limit', '200');
      const payload = await apiRequest(`/api/v1/protocols?${params.toString()}`);
      const rows = Array.isArray(payload?.items) ? payload.items : [];
      setItems(rows);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить клинические протоколы');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category, emergencyOnly, query, species]);

  useEffect(() => {
    loadProtocols();
  }, [loadProtocols]);

  return (
    <RoleGate allowedRoles={['vet', 'clinic_admin']}>
      <>
        <TopNavigation links={topLinks} actions={<AuthDropdown mode="menu" />} />
        <main className="page-wrap space-y-4 py-6">
          <header className="page-header">
            <div>
              <h1 className="page-title">Библиотека клинических протоколов</h1>
              <p className="page-subtitle">
                Единый справочник клинических протоколов: поиск, фильтры по виду и категории, emergency-флаги.
              </p>
            </div>
          </header>

          {error ? <ErrorBanner message={error} onRetry={loadProtocols} /> : null}
          <section className="grid gap-4 2xl:grid-cols-[248px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-[96px] xl:self-start">
              <Card title="Навигация" subtitle="Связанные клинические разделы">
                <div className="grid gap-2">
                  <Link href="/vet/dashboard" className="sidebar-link">← В кабинет врача</Link>
                  <Link href="/clinical/protocols" className="sidebar-link">Протоколы</Link>
                  <Link href="/diseases" className="sidebar-link">Заболевания</Link>
                  <Link href="/tools/calculators" className="sidebar-link">Калькуляторы</Link>
                </div>
              </Card>
              <Card title="Как использовать" subtitle="Протоколы помогают структурировать визит">
                <ul className="space-y-2 text-sm text-lapka-700">
                  <li>• Фильтруйте по виду и категории</li>
                  <li>• Выделяйте emergency-протоколы</li>
                  <li>• Открывайте подходящий протокол прямо из визита</li>
                </ul>
              </Card>
            </aside>

            <div className="space-y-4">
              <Card>
                <div className="grid gap-3 lg:grid-cols-[1fr_220px_200px]">
                  <SearchInput
                    label="Поиск протокола"
                    placeholder="Название, описание или шаг..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <label className="block">
                    <span className="label">Вид животного</span>
                    <select className="input" value={species} onChange={(event) => setSpecies(event.target.value)}>
                      {speciesOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-end gap-2 rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm font-semibold text-lapka-700">
                    <input type="checkbox" checked={emergencyOnly} onChange={(event) => setEmergencyOnly(event.target.checked)} />
                    Только emergency
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {categoryTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                        category === tab.id
                          ? 'bg-lapka-gradient text-white shadow-soft'
                          : 'border border-lapka-200 bg-white text-lapka-700 hover:bg-lapka-100'
                      }`}
                      onClick={() => setCategory(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="Протоколы" subtitle={`Найдено: ${filteredCount}`}>
                {loading ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <Skeleton className="h-52 w-full" />
                    <Skeleton className="h-52 w-full" />
                    <Skeleton className="h-52 w-full" />
                    <Skeleton className="h-52 w-full" />
                  </div>
                ) : items.length === 0 ? (
                  <EmptyState title="Протоколы не найдены" text="Измените фильтры или запрос." />
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {items.map((row) => (
                      <article key={row.id} className="rounded-2xl border border-lapka-200 bg-white p-4 shadow-soft-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="text-lg font-extrabold text-lapka-900">{row.name}</h3>
                          {row.emergency_flag ? <Badge tone="danger">EMERGENCY</Badge> : <Badge tone="success">STANDARD</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-lapka-600">
                          {row.category} · {speciesLabel(row.species)}
                        </p>
                        <p className="mt-3 text-sm text-lapka-700">{row.description || '—'}</p>

                        <div className="mt-3 rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                          <p className="text-xs uppercase tracking-wide text-lapka-500">Шаги протокола</p>
                          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-lapka-700">
                            {(row.steps || []).slice(0, 4).map((step, index) => (
                              <li key={`${row.id}-step-${index}`}>{step}</li>
                            ))}
                          </ol>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/clinical/protocols/${row.id}`} className="btn-secondary !px-3 !py-1.5">
                            Подробнее
                          </Link>
                          <Link href={`/vet/visit/66666666-6666-6666-6666-666666666666`} className="btn-secondary !px-3 !py-1.5">
                            Открыть в визите
                          </Link>
                          <span className="pill text-xs">ID: {row.id}</span>
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
