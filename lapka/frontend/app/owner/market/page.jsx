'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EntityVisualGallery from '@/components/ui/EntityVisualGallery';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { buildClinicVisualGallery, resolveClinicGallery, resolveClinicPhoto } from '@/lib/pets';

function stars(avg) {
  const value = Math.round(Number(avg || 0));
  return `${'★'.repeat(value)}${'☆'.repeat(Math.max(0, 5 - value))}`;
}

function withPins(rows) {
  if (!rows.length) return [];
  const lats = rows.map((row) => Number(row.lat || 0));
  const lngs = rows.map((row) => Number(row.lng || 0));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(maxLat - minLat, 0.001);
  const lngRange = Math.max(maxLng - minLng, 0.001);

  return rows.map((row) => ({
    ...row,
    pinX: 10 + ((Number(row.lng) - minLng) / lngRange) * 80,
    pinY: 10 + (1 - (Number(row.lat) - minLat) / latRange) * 72,
  }));
}

export default function OwnerMarketPage() {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('Санкт-Петербург');
  const [service, setService] = useState('');
  const [openNow, setOpenNow] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [minRating, setMinRating] = useState('');
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const loadClinics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (city.trim()) params.set('city', city.trim());
      if (service.trim()) params.set('service', service.trim());
      if (openNow) params.set('open_now', 'true');
      if (emergency) params.set('emergency', 'true');
      if (minRating) params.set('min_rating', minRating);
      params.set('lat', '59.9386');
      params.set('lng', '30.3141');
      params.set('radius_km', '25');
      params.set('limit', '120');

      const payload = await apiRequest(`/api/v1/market/clinics?${params.toString()}`);
      const rows = Array.isArray(payload) ? payload : [];
      setClinics(rows);
      setSelectedId(rows[0]?.id || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить каталог клиник');
      setClinics([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [city, emergency, minRating, openNow, query, service]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClinics();
    }, 220);
    return () => clearTimeout(timer);
  }, [loadClinics]);

  const rowsWithPins = useMemo(() => withPins(clinics.filter((row) => row.lat && row.lng)), [clinics]);
  const selectedClinic = useMemo(() => clinics.find((row) => row.id === selectedId) || null, [clinics, selectedId]);
  const selectedClinicGallery = useMemo(() => resolveClinicGallery(selectedClinic), [selectedClinic]);
  const selectedClinicVisualGallery = useMemo(() => buildClinicVisualGallery(selectedClinic), [selectedClinic]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Каталог клиник</h1>
          <p className="page-subtitle">Найдите клинику и врача рядом, сравните рейтинг и запишитесь за пару кликов.</p>
        </div>
        <Link className="btn-primary" href="/owner/appointments">
          Открыть запись
        </Link>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadClinics} /> : null}

      <ShowcasePanel
        eyebrow="Подбор клиники"
        title="Сравните клиники и врачей без перегруженного каталога"
        description="Открывайте профили, смотрите рейтинг, расстояние и ближайшие услуги, а затем переходите к записи в пару кликов. Блок построен как спокойный витринный слой поверх единой базы."
        imageSrc="/assets/img/rating-team.svg"
        imageAlt="Подбор клиники и врача"
        badges={[
          `${clinics.length} клиник в выдаче`,
          openNow ? 'Открыто сейчас' : 'Любой график',
          emergency ? 'Есть экстренный приём' : 'Плановые клиники',
        ]}
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-6">
          <SearchInput
            label="Поиск клиники"
            placeholder="Название или описание"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="block">
            <span className="label">Город</span>
            <input className="input" value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Услуга</span>
            <input className="input" value={service} onChange={(event) => setService(event.target.value)} placeholder="УЗИ, вакцинация..." />
          </label>
          <label className="block">
            <span className="label">Минимальный рейтинг</span>
            <select className="input" value={minRating} onChange={(event) => setMinRating(event.target.value)}>
              <option value="">Любой</option>
              <option value="3">От 3.0</option>
              <option value="4">От 4.0</option>
              <option value="4.5">От 4.5</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-lapka-200 bg-white px-3 py-2.5">
            <input type="checkbox" checked={openNow} onChange={(event) => setOpenNow(event.target.checked)} />
            <span className="text-sm font-semibold text-lapka-700">Открыто сейчас</span>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-lapka-200 bg-white px-3 py-2.5">
            <input type="checkbox" checked={emergency} onChange={(event) => setEmergency(event.target.checked)} />
            <span className="text-sm font-semibold text-lapka-700">Есть экстренный приём</span>
          </label>
        </div>
      </Card>

      <section className="grid gap-4 2xl:grid-cols-[1.2fr_1fr]">
        <Card title="Клиники рядом" subtitle={`${clinics.length} вариантов в выдаче`}>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : clinics.length ? (
            <div className="space-y-2">
              {clinics.map((clinic) => (
                <article
                  key={clinic.id}
                  className={`rounded-2xl border p-3 transition ${
                    selectedId === clinic.id ? 'border-lapka-500 bg-lapka-100' : 'border-lapka-200 bg-white hover:border-lapka-300'
                  }`}
                >
                  <div className="grid gap-3 sm:grid-cols-[84px_minmax(0,1fr)_auto] sm:items-start">
                    <AppImage
                      src={resolveClinicPhoto(clinic)}
                      alt={clinic.name}
                      width={320}
                      height={320}
                      sizes="84px"
                      className="h-20 w-20 rounded-2xl border border-lapka-200 object-cover"
                    />
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="text-left text-lg font-extrabold text-lapka-900 hover:text-sky-700"
                        onClick={() => setSelectedId(clinic.id)}
                      >
                        {clinic.name}
                      </button>
                      <p className="text-sm text-lapka-600">{clinic.city} · {clinic.address}</p>
                      <p className="text-xs text-lapka-600">{clinic.hours || 'График уточняется'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-600">{stars(clinic.rating_summary?.avg_rating)} {clinic.rating_summary?.avg_rating?.toFixed?.(1) || '0.0'}</p>
                      <p className="text-xs text-lapka-600">{clinic.rating_summary?.count || 0} отзывов</p>
                      {clinic.distance_km ? <p className="text-xs text-lapka-600">{clinic.distance_km} км</p> : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(clinic.services || []).slice(0, 4).map((item) => (
                      <span key={`${clinic.id}-${item}`} className="pill !text-[11px]">{item}</span>
                    ))}
                      {clinic.emergency_available ? <span className="badge-red">Экстренный приём</span> : <span className="badge-green">Плановый приём</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link className="btn-secondary !px-3 !py-1.5" href={`/owner/clinic/${clinic.id}`}>
                      Профиль клиники
                    </Link>
                    <Link className="btn-secondary !px-3 !py-1.5" href={`/public-booking/${clinic.id}`}>
                      Онлайн-запись 24/7
                    </Link>
                    <Link className="btn-primary !px-3 !py-1.5" href={`/owner/appointments?clinic_id=${clinic.id}`}>
                      Записаться
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Клиники не найдены" text="Измените фильтры поиска или радиус." />
          )}
        </Card>

        <Card title="Карта клиник" subtitle="Демо-панель без внешних картографических сервисов">
          {rowsWithPins.length ? (
            <div className="space-y-3">
              <div
                className="relative h-80 overflow-hidden rounded-2xl border border-lapka-200"
                style={{
                  background:
                    'radial-gradient(circle at 20% 20%, rgba(73,175,233,.22), transparent 40%), radial-gradient(circle at 80% 30%, rgba(70,201,179,.20), transparent 38%), linear-gradient(180deg, rgba(255,255,255,.95), rgba(229,239,255,.9))',
                }}
              >
                <div
                  className="absolute inset-0 opacity-35"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, rgba(58,107,173,.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(58,107,173,.16) 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                  }}
                />
                {rowsWithPins.map((clinic) => (
                  <button
                    key={`pin-${clinic.id}`}
                    type="button"
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[11px] font-bold shadow-soft ${
                      selectedId === clinic.id ? 'bg-lapka-gradient text-white' : 'bg-white text-lapka-700'
                    }`}
                    style={{ left: `${clinic.pinX}%`, top: `${clinic.pinY}%` }}
                    onClick={() => setSelectedId(clinic.id)}
                  >
                    {clinic.name}
                  </button>
                ))}
              </div>
              {selectedClinic ? (
                <div className="space-y-3 rounded-xl border border-lapka-200 bg-white p-3">
                  <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-center">
                    <AppImage
                      src={resolveClinicPhoto(selectedClinic)}
                      alt={selectedClinic.name}
                      width={360}
                      height={360}
                      sizes="96px"
                      className="h-24 w-24 rounded-2xl border border-lapka-200 object-cover"
                    />
                    <div>
                      <p className="text-lg font-bold text-lapka-900">{selectedClinic.name}</p>
                      <p className="text-sm text-lapka-600">{selectedClinic.address}</p>
                      <p className="text-sm text-lapka-600">
                        Рейтинг: {selectedClinic.rating_summary?.avg_rating?.toFixed?.(1) || '0.0'} · {selectedClinic.rating_summary?.count || 0} отзывов
                      </p>
                    </div>
                  </div>
                  {selectedClinicGallery.length > 0 ? (
                    <EntityVisualGallery
                      items={selectedClinicVisualGallery}
                      title="Фотослой клиники"
                      subtitle="Фасад, интерьер и входная зона рядом с картой помогают понять формат клиники до записи."
                      compact
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState title="Нет геоданных" text="Выберите фильтры, чтобы увидеть клиники на карте." />
          )}
        </Card>
      </section>

      <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-4 py-3 text-sm text-lapka-700">
        Оценки отражают пользовательский опыт и не являются медицинской гарантией.
      </div>
    </>
  );
}
