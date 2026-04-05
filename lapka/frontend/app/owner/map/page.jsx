'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { resolveClinicPhoto } from '@/lib/pets';

function normalizePins(places) {
  if (!places.length) return [];
  const lats = places.map((row) => Number(row.coordinates?.lat || 0));
  const lngs = places.map((row) => Number(row.coordinates?.lng || 0));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lngRange = Math.max(maxLng - minLng, 0.0001);

  return places.map((place) => {
    const lat = Number(place.coordinates?.lat || minLat);
    const lng = Number(place.coordinates?.lng || minLng);
    const x = 12 + ((lng - minLng) / lngRange) * 76;
    const y = 12 + (1 - (lat - minLat) / latRange) * 66;
    return { ...place, pinX: x, pinY: y };
  });
}

export default function OwnerMapPage() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';
  const copy = useMemo(() => (
    lang === 'en'
      ? {
        title: 'Map nearby',
        subtitle: 'Clinics, pharmacies and parks nearby in a calm local map built on demo data.',
        error: 'Unable to load places on the map',
        searchLabel: 'Search by name or city',
        searchPlaceholder: 'For example: Vetus or Saint Petersburg',
        mapTitle: 'Ecosystem map',
        mapSubtitle: 'Static grid with interactive pins',
        mapCounter: 'Demo grid map',
        mapHint: 'Select a pin to open details',
        emptyTitle: 'No places found',
        emptyText: 'Change the filter or search query.',
        drawerEyebrow: 'Place details',
        drawerTitle: 'Location details',
        address: 'Address',
        hours: 'Hours',
        coordinates: 'Coordinates',
        drawerInfo: 'Choose a place and continue to clinic booking or pharmacy search linked to prescriptions.',
        drawerEmptyTitle: 'No place selected',
        drawerEmptyText: 'Click a pin or a list card.',
        clinic: 'Clinics',
        pharmacy: 'Pharmacies',
        park: 'Parks',
        type: {
          clinic: 'clinic',
          pharmacy: 'pharmacy',
          park: 'park'
        }
      }
      : {
        title: 'Карта рядом',
        subtitle: 'Клиники, ветаптеки и площадки рядом с вами в спокойном крупном интерфейсе на локальных демо-данных.',
        error: 'Не удалось загрузить точки на карте',
        searchLabel: 'Поиск по названию или городу',
        searchPlaceholder: 'Например: Ветус или Санкт-Петербург',
        mapTitle: 'Карта экосистемы',
        mapSubtitle: 'Статическая сетка + интерактивные пины',
        mapCounter: 'Демо-карта',
        mapHint: 'Выберите пин, чтобы открыть панель',
        emptyTitle: 'Точки не найдены',
        emptyText: 'Измените фильтр или строку поиска.',
        drawerEyebrow: 'Детали точки',
        drawerTitle: 'Детали точки',
        address: 'Адрес',
        hours: 'Часы работы',
        coordinates: 'Координаты',
        drawerInfo: 'Можно быстро выбрать место и сразу перейти к записи в клинику или проверке аптек рядом с назначениями.',
        drawerEmptyTitle: 'Точка не выбрана',
        drawerEmptyText: 'Нажмите на пин или карточку в списке.',
        clinic: 'Клиники',
        pharmacy: 'Аптеки',
        park: 'Площадки',
        type: {
          clinic: 'клиника',
          pharmacy: 'аптека',
          park: 'площадка'
        }
      }
  ), [lang]);

  const typeTabs = useMemo(
    () => [
      { id: 'clinic', label: copy.clinic, pill: 'bg-cyan-100 text-cyan-700' },
      { id: 'pharmacy', label: copy.pharmacy, pill: 'bg-emerald-100 text-emerald-700' },
      { id: 'park', label: copy.park, pill: 'bg-amber-100 text-amber-700' }
    ],
    [copy]
  );

  const [activeType, setActiveType] = useState('clinic');
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPlaces = useCallback(async (type) => {
    setLoading(true);
    setError('');
    try {
      let rows = [];
      if (type === 'clinic') {
        const payload = await apiRequest('/api/v1/market/clinics?limit=50');
        const clinics = Array.isArray(payload) ? payload : (payload?.items || []);
        rows = clinics.map((clinic) => ({
          id: clinic.id,
          clinic_id: clinic.id,
          name: clinic.name,
          type: 'clinic',
          city: clinic.city,
          coordinates: {
            lat: Number(clinic.lat ?? clinic.latitude ?? 0),
            lng: Number(clinic.lng ?? clinic.longitude ?? 0),
          },
          address: clinic.address,
          hours: clinic.hours,
          phone: clinic.phone,
          website: clinic.website,
          photo_url: resolveClinicPhoto(clinic),
        }));
      } else {
        const payload = await apiRequest(`/api/v1/places?type=${encodeURIComponent(type)}&limit=200`);
        rows = Array.isArray(payload) ? payload : [];
      }
      setPlaces(rows);
      setSelectedPlace(rows[0] || null);
    } catch (requestError) {
      setError(requestError.message || copy.error);
      setPlaces([]);
      setSelectedPlace(null);
    } finally {
      setLoading(false);
    }
  }, [copy.error]);

  useEffect(() => {
    loadPlaces(activeType);
  }, [activeType, loadPlaces]);

  const filteredPlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return places;
    return places.filter((row) =>
      [row.name, row.city, row.address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [places, query]);

  const placesWithPins = useMemo(() => normalizePins(filteredPlaces), [filteredPlaces]);

  function selectPlace(place) {
    setSelectedPlace(place);
    setDrawerOpen(true);
  }

  function localizePlaceType(type) {
    return copy.type[type] || type;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{copy.title}</h1>
          <p className="page-subtitle">{copy.subtitle}</p>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <ShowcasePanel
        eyebrow={lang === 'en' ? 'Ecosystem map' : 'Карта экосистемы'}
        title={lang === 'en' ? 'Clinics, pharmacies and parks in one calm view' : 'Клиники, аптеки и площадки в одном спокойном интерфейсе'}
        description={
          lang === 'en'
            ? 'Select a clinic for booking, compare pharmacies nearby and keep the route around your pet clear and compact.'
            : 'Выберите клинику для записи, сравните аптеки рядом и быстро поймите маршрут вокруг питомца без перегруженной карты.'
        }
        imageSrc="/assets/img/map-hero-v2.svg"
        imageAlt={lang === 'en' ? 'Map nearby' : 'Карта рядом'}
        badges={[
          `${places.length} ${lang === 'en' ? 'places' : 'точек'}`,
          activeType === 'clinic' ? copy.clinic : activeType === 'pharmacy' ? copy.pharmacy : copy.park,
          lang === 'en' ? 'Interactive pins' : 'Интерактивные пины',
        ]}
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-end">
          <div className="flex flex-wrap gap-2">
            {typeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeType === tab.id ? 'bg-lapka-gradient text-white shadow-soft' : 'bg-lapka-100 text-lapka-700 hover:bg-lapka-200'
                }`}
                onClick={() => setActiveType(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <SearchInput
            label={copy.searchLabel}
            placeholder={copy.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Card>

      <section className="relative">
        <Card title={copy.mapTitle} subtitle={copy.mapSubtitle}>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-72 w-full" />
            </div>
          ) : placesWithPins.length ? (
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
                      'linear-gradient(to right, rgba(58,107,173,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(58,107,173,.18) 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                  }}
                />
                {placesWithPins.map((place) => {
                  const tabTone = typeTabs.find((row) => row.id === place.type)?.pill || 'bg-cyan-100 text-cyan-700';
                  return (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => selectPlace(place)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white px-2 py-1 text-[11px] font-bold shadow-soft transition hover:scale-105 ${tabTone} ${
                        selectedPlace?.id === place.id ? 'ring-2 ring-lapka-500' : ''
                      }`}
                      style={{ left: `${place.pinX}%`, top: `${place.pinY}%` }}
                    >
                      {place.name}
                    </button>
                  );
                })}
                <div className="absolute bottom-3 left-3 rounded-xl border border-lapka-200 bg-white/90 px-3 py-2 text-xs text-lapka-700">
                  {copy.mapCounter} · {placesWithPins.length}
                </div>
                <div className="absolute bottom-3 right-3 rounded-xl border border-lapka-200 bg-white/90 px-3 py-2 text-xs text-lapka-700">
                  {copy.mapHint}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                {placesWithPins.slice(0, 6).map((place) => (
                  <button
                    key={`list-${place.id}`}
                    type="button"
                    className={`rounded-2xl border p-3 text-left transition ${
                      selectedPlace?.id === place.id
                        ? 'border-lapka-500 bg-lapka-100'
                        : 'border-lapka-200 bg-white hover:border-lapka-300'
                    }`}
                    onClick={() => selectPlace(place)}
                  >
                    {place.type === 'clinic' && place.photo_url ? (
                      <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded-xl border border-lapka-200 bg-lapka-100">
                        <AppImage
                          src={place.photo_url}
                          alt={place.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : null}
                    <p className="text-sm font-semibold text-lapka-900">{place.name}</p>
                    <p className="mt-1 text-xs text-lapka-600">{place.city} · {place.address}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title={copy.emptyTitle} text={copy.emptyText} />
          )}
        </Card>
      </section>

      <div
        className={`fixed inset-0 z-40 transition ${drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          aria-label={lang === 'en' ? 'Close drawer' : 'Закрыть панель'}
          className={`absolute inset-0 bg-lapka-900/25 transition ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={`absolute right-0 top-0 h-full w-full max-w-md border-l border-lapka-200 bg-lapka-surface p-5 shadow-card transition duration-300 ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-lapka-600">{copy.drawerEyebrow}</p>
              <h2 className="text-2xl font-black text-lapka-900">{copy.drawerTitle}</h2>
            </div>
            <button type="button" className="btn-secondary !px-3 !py-1.5" onClick={() => setDrawerOpen(false)}>
              {lang === 'en' ? 'Close' : 'Закрыть'}
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : selectedPlace ? (
            <div className="space-y-3">
              {selectedPlace.type === 'clinic' && selectedPlace.photo_url ? (
                <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-lapka-200 bg-lapka-100">
                  <AppImage
                    src={selectedPlace.photo_url}
                    alt={selectedPlace.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="rounded-2xl border border-lapka-200 bg-white p-3">
                <p className="text-xl font-bold text-lapka-900">{selectedPlace.name}</p>
                <p className="text-sm text-lapka-600">
                  {selectedPlace.city} · {localizePlaceType(selectedPlace.type)}
                </p>
              </div>
              <div className="rounded-2xl border border-lapka-200 bg-white p-3 text-sm text-lapka-700">
                <p><span className="font-semibold">{copy.address}:</span> {selectedPlace.address}</p>
                <p className="mt-1"><span className="font-semibold">{copy.hours}:</span> {selectedPlace.hours}</p>
                <p className="mt-1">
                  <span className="font-semibold">{copy.coordinates}:</span> {selectedPlace.coordinates?.lat}, {selectedPlace.coordinates?.lng}
                </p>
              </div>
              {selectedPlace.type === 'clinic' && selectedPlace.clinic_id ? (
                <div className="flex flex-wrap gap-2">
                  <Link href={`/owner/clinic/${selectedPlace.clinic_id}`} className="btn-primary">
                    Открыть профиль клиники
                  </Link>
                  <Link href={`/public-booking/${selectedPlace.clinic_id}`} className="btn-secondary">
                    Онлайн-запись 24/7
                  </Link>
                  <Link href="/owner/appointments" className="btn-secondary">
                    Перейти к записи
                  </Link>
                </div>
              ) : null}
              <div className="rounded-2xl border border-lapka-200 bg-lapka-100 p-3 text-sm text-lapka-800">
                {copy.drawerInfo}
              </div>
            </div>
          ) : (
            <EmptyState title={copy.drawerEmptyTitle} text={copy.drawerEmptyText} />
          )}
        </aside>
      </div>
    </>
  );
}
