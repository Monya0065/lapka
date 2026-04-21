'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
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
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const lang = langCode.startsWith('en') ? 'en' : 'ru';
  const tr = (ru, en) => (lang === 'en' ? en : ru);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState(lang === 'en' ? 'Saint Petersburg' : 'Санкт-Петербург');
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
      setError(requestError.message || (lang === 'en' ? 'Failed to load clinics' : 'Не удалось загрузить клиники'));
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }, [query, city, lang]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadClinics();
    }, 220);
    return () => clearTimeout(t);
  }, [loadClinics]);

  const filteredClinics = useMemo(() => clinics, [clinics]);
  const catalogPressure = useMemo(() => {
    if (!filteredClinics.length) return 'HIGH';
    const rated = filteredClinics.filter((clinic) => Number(clinic.rating_summary?.avg_rating || 0) >= 4).length;
    if (rated === 0 || filteredClinics.length < 3) return 'MED';
    return 'OK';
  }, [filteredClinics]);
  const bookingCoverage = useMemo(() => {
    if (!filteredClinics.length) return 0;
    const withAddress = filteredClinics.filter((clinic) => String(clinic.address || '').trim().length > 0).length;
    const withHours = filteredClinics.filter((clinic) => String(clinic.hours || '').trim().length > 0).length;
    const withRating = filteredClinics.filter((clinic) => Number(clinic.rating_summary?.avg_rating || 0) > 0).length;
    const checkpoints = withAddress + withHours + withRating;
    const max = filteredClinics.length * 3;
    return Math.round((checkpoints / max) * 100);
  }, [filteredClinics]);
  const shortlistReadiness = useMemo(() => {
    if (!filteredClinics.length) return 0;
    const emergencyReady = filteredClinics.filter((clinic) => {
      const hours = String(clinic.hours || '').toLowerCase();
      return hours.includes('24') || hours.includes('круглосуточ') || hours.includes('around the clock');
    }).length;
    return Math.round((emergencyReady / filteredClinics.length) * 100);
  }, [filteredClinics]);

  return (
    <main className="page-wrap py-6">
      <section className="mx-auto w-full max-w-6xl space-y-5">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-400/10 via-surface-muted to-emerald-400/12 p-5 shadow-card md:p-8 dark:from-slate-500/10 dark:to-emerald-500/10">
          <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{tr('Онлайн-запись 24/7', 'Online booking 24/7')}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">{tr('Выберите клинику', 'Choose a clinic')}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
                {tr(
                  'Выход без логина: найдите клинику и откройте форму записи. Каталог и карточки загружаются из маркет-API, а не из статичной демо-страницы.',
                  'No-login flow: find a clinic and open booking form. Catalog and cards come from market API, not static demo page.',
                )}
              </p>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: tr('В выдаче', 'In results'), value: filteredClinics.length, tone: '' },
                  { label: tr('Город', 'City'), value: city.trim() || '—', tone: 'text-sky-700 dark:text-sky-300' },
                  { label: tr('Поиск', 'Search'), value: query.trim() ? tr('Активен', 'Active') : tr('Все', 'All'), tone: 'text-violet-700 dark:text-violet-300' },
                  { label: tr('Лимит', 'Limit'), value: 24, tone: 'text-amber-700 dark:text-amber-300' },
                  {
                    label: '24/7',
                    value: filteredClinics.filter((c) => String(c.hours || '').includes('24')).length,
                    tone: 'text-emerald-700 dark:text-emerald-300',
                  },
                  {
                    label: tr('С рейтингом', 'With rating'),
                    value: filteredClinics.filter((c) => Number(c.rating_summary?.avg_rating || 0) > 0).length,
                    tone: 'text-rose-700 dark:text-rose-300',
                  },
                ].map((cell) => (
                  <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                    <p className={`mt-1 break-words text-2xl font-black tabular-nums sm:text-3xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {error ? <ErrorBanner message={error} onRetry={loadClinics} /> : null}

        <ShowcasePanel
          eyebrow={tr('Как это работает', 'How it works')}
          title={tr('Витрина клиник + быстрые слоты', 'Clinic showcase + quick slots')}
          description={tr('Демо-режим: слоты формируются из расписаний врачей, а запись создаётся через public booking без авторизации.', 'Demo mode: slots are built from vet schedules, booking is created via public booking without authorization.')}
          imageSrc="/assets/img/rating-team.svg"
          imageAlt={tr('Онлайн-запись', 'Online booking')}
          badges={[tr('Без логина', 'No login'), tr('Слоты из расписания', 'Slots from schedules'), tr('Создание записи', 'Booking creation')]}
          compact
        />

        <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{tr('Операционный срез', 'Operational slice')}</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">{tr('Сигналы витрины клиник', 'Clinic showcase signals')}</h2>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
              public booking ops
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: tr('Давление каталога', 'Catalog pressure'),
                value: catalogPressure,
                text: tr('Плотность качественной выдачи по доступным клиникам в текущем фильтре.', 'Density of high-quality results for available clinics in current filter.'),
                href: '/owner/market',
                tone: catalogPressure === 'HIGH'
                  ? 'text-rose-700 dark:text-rose-300'
                  : catalogPressure === 'MED'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-emerald-700 dark:text-emerald-300',
              },
              {
                title: tr('Покрытие бронирования', 'Booking coverage'),
                value: `${bookingCoverage}%`,
                text: tr('Насколько карточки клиник готовы к быстрой записи без уточнений.', 'How ready clinic cards are for fast booking without extra clarification.'),
                href: '/public-booking',
                tone: 'text-violet-700 dark:text-violet-300',
              },
              {
                title: tr('Готовность shortlist', 'Shortlist readiness'),
                value: `${shortlistReadiness}%`,
                text: tr('Доля клиник с режимом, подходящим для срочного выбора и маршрута.', 'Share of clinics with mode suitable for urgent selection and routing.'),
                href: '/owner/map',
                tone: 'text-sky-700 dark:text-sky-300',
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-2xl border border-border bg-surface/85 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <p className={`text-base font-black ${item.tone}`}>{item.title}</p>
                <p className="mt-2 text-3xl font-black tabular-nums text-theme">{item.value}</p>
                <p className="mt-2 text-sm leading-relaxed text-theme">{item.text}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">{tr('Открыть контур', 'Open flow')}</p>
              </Link>
            ))}
          </div>
        </section>

        <Card>
          <div className="grid gap-3 md:grid-cols-[1fr_260px] lg:grid-cols-[1fr_220px_220px_auto] lg:items-end">
            <SearchInput
              label={tr('Поиск по названию/описанию', 'Search by name/description')}
              placeholder={tr('Например: ВетСеть, Барсик...', 'Example: VetSet, Barsik...')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label className="block">
              <span className="label">{tr('Город', 'City')}</span>
              <input className="input" value={city} onChange={(event) => setCity(event.target.value)} />
            </label>
            <div className="hidden lg:block" />
            <button type="button" className="btn-primary" onClick={loadClinics}>
              {tr('Обновить', 'Refresh')}
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
                className="overflow-hidden rounded-[24px] border border-border bg-surface-muted/70 transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-surface-muted">
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
                      <p className="text-lg font-extrabold text-theme line-clamp-2">{clinic.name}</p>
                      <p className="mt-1 text-sm text-theme-muted">
                        {clinic.city} · {clinic.address || tr('Адрес уточняется', 'Address pending')}
                      </p>
                      <p className="mt-1 text-xs text-theme-muted">{clinic.hours || tr('График уточняется', 'Hours pending')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-warning">
                        {stars(clinic.rating_summary?.avg_rating)} {clinic.rating_summary?.avg_rating?.toFixed?.(1) || '0.0'}
                      </p>
                      <p className="text-xs text-theme-muted">
                        {clinic.rating_summary?.count || 0} {tr('отзывов', 'reviews')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/public-booking/${clinic.id}`} className="btn-primary !px-3 !py-2">
                      {tr('Записаться 24/7', 'Book 24/7')}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={tr('Клиники не найдены', 'No clinics found')}
            text={tr('Измените фильтры поиска или город.', 'Change search filters or city.')}
          />
        )}
      </section>
    </main>
  );
}

