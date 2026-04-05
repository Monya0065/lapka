'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import AppImage from '@/components/ui/AppImage';
import { apiRequest } from '@/lib/api';
import { resolveClinicPhoto } from '@/lib/pets';

function stars(avg) {
  const value = Math.round(Number(avg || 0));
  return `${'★'.repeat(value)}${'☆'.repeat(Math.max(0, 5 - value))}`;
}

export default function PublicBookingChooseClinicPage() {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('Санкт-Петербург');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clinics, setClinics] = useState([]);

  const loadClinics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (city.trim()) params.set('city', city.trim());
      params.set('limit', '24');

      const payload = await apiRequest(`/api/v1/market/clinics?${params.toString()}`, { auth: false });
      setClinics(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить клиники');
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }, [query, city]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadClinics();
    }, 220);
    return () => clearTimeout(t);
  }, [loadClinics]);

  const filteredClinics = useMemo(() => clinics, [clinics]);

  return (
    <main className="page-wrap py-6">
      <section className="mx-auto w-full max-w-6xl space-y-5">
        <header className="page-header">
          <div>
            <p className="page-eyebrow">Онлайн-запись 24/7</p>
            <h1 className="page-title">Выберите клинику</h1>
            <p className="page-subtitle">Выход без логина: найдите клинику и откройте форму записи.</p>
          </div>
        </header>

        {error ? <ErrorBanner message={error} onRetry={loadClinics} /> : null}

        <ShowcasePanel
          eyebrow="Как это работает"
          title="Витрина клиник + быстрые слоты"
          description="Демо-режим: слоты формируются из расписаний врачей, а запись создаётся через public booking без авторизации."
          imageSrc="/assets/img/rating-team.svg"
          imageAlt="Онлайн-запись"
          badges={['Без логина', 'Слоты из расписания', 'Создание записи']}
          compact
        />

        <Card>
          <div className="grid gap-3 md:grid-cols-[1fr_260px] lg:grid-cols-[1fr_220px_220px_auto] lg:items-end">
            <SearchInput
              label="Поиск по названию/описанию"
              placeholder="Например: ВетСеть, Барсик..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label className="block">
              <span className="label">Город</span>
              <input className="input" value={city} onChange={(event) => setCity(event.target.value)} />
            </label>
            <div className="hidden lg:block" />
            <button type="button" className="btn-primary" onClick={loadClinics}>
              Обновить
            </button>
          </div>
        </Card>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Card key={idx} className="p-0 overflow-hidden">
                <div className="skeleton h-32 w-full" />
                <div className="p-4">
                  <Skeleton className="h-5 w-2/3" />
                  <div className="mt-2">
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredClinics.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClinics.map((clinic) => (
              <article
                key={clinic.id}
                className="overflow-hidden rounded-[24px] border border-lapka-200 bg-white transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="relative aspect-[16/10] overflow-hidden border-b border-lapka-200 bg-lapka-100">
                  <AppImage
                    src={resolveClinicPhoto(clinic)}
                    alt={clinic.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-extrabold text-lapka-900 line-clamp-2">{clinic.name}</p>
                      <p className="mt-1 text-sm text-lapka-600">
                        {clinic.city} · {clinic.address || 'Адрес уточняется'}
                      </p>
                      <p className="mt-1 text-xs text-lapka-600">{clinic.hours || 'График уточняется'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-amber-600">
                        {stars(clinic.rating_summary?.avg_rating)} {clinic.rating_summary?.avg_rating?.toFixed?.(1) || '0.0'}
                      </p>
                      <p className="text-xs text-lapka-600">{clinic.rating_summary?.count || 0} отзывов</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/public-booking/${clinic.id}`} className="btn-primary !px-3 !py-2">
                      Записаться 24/7
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Клиники не найдены" text="Измените фильтры поиска или город." />
        )}
      </section>
    </main>
  );
}

