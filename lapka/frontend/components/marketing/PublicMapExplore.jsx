'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { getApiBase } from '@/lib/auth';
import YandexPlacesMap from '@/components/maps/YandexPlacesMap';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';

const TYPE_PRESETS = {
  clinic: 'islands#blueCircleDotIcon',
  pharmacy: 'islands#darkGreenCircleDotIcon',
  park: 'islands#yellowCircleDotIcon',
};

async function fetchJson(path) {
  const response = await fetch(`${getApiBase()}${path}`, { credentials: 'omit' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = typeof body?.detail === 'string' ? body.detail : body?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return response.json();
}

export default function PublicMapExplore() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ru';
  const tr = (ru, en) => (lang === 'en' ? en : ru);
  const [tab, setTab] = useState('clinic');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (type) => {
    setLoading(true);
    setError('');
    try {
      let list = [];
      if (type === 'clinic') {
        const payload = await fetchJson('/api/v1/market/clinics?limit=80');
        const clinics = Array.isArray(payload) ? payload : payload?.items || [];
        list = clinics.map((c) => ({
          id: c.id,
          type: 'clinic',
          name: c.name,
          city: c.city,
          address: c.address,
          hours: c.hours,
          phone: c.phone,
          coordinates: {
            lat: Number(c.lat ?? c.latitude),
            lng: Number(c.lng ?? c.longitude),
          },
        }));
      } else {
        const payload = await fetchJson(`/api/v1/places?type=${encodeURIComponent(type)}&limit=200`);
        list = Array.isArray(payload) ? payload : [];
      }
      setRows(list);
    } catch (e) {
      setError(e?.message || (lang === 'en' ? 'Failed to load map points' : 'Не удалось загрузить точки'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const markers = useMemo(
    () =>
      rows
        .filter((r) => Number.isFinite(Number(r.coordinates?.lat)) && Number.isFinite(Number(r.coordinates?.lng)))
        .map((r) => ({
          id: r.id,
          lat: Number(r.coordinates.lat),
          lng: Number(r.coordinates.lng),
          title: r.name,
          subtitle: [r.city, r.address].filter(Boolean).join(' · '),
          preset: TYPE_PRESETS[r.type] || TYPE_PRESETS.clinic,
          place: r,
        })),
    [rows]
  );

  const tabLabel = tab === 'clinic' ? tr('Клиники', 'Clinics') : tab === 'pharmacy' ? tr('Аптеки', 'Pharmacies') : tr('Площадки', 'Places');
  const apiTile = error ? tr('Сбой', 'Error') : loading ? '…' : tr('Живое API', 'Live API');

  return (
    <div className="space-y-6">
      <section className="page-wrap !px-0">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-sky-400/16 via-surface-muted to-emerald-400/14 p-6 shadow-card md:p-8 dark:from-sky-500/12 dark:to-emerald-600/10">
          <div className="relative grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{tr('Публичная карта', 'Public map')}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">{tr('Клиники и точки рядом', 'Clinics and nearby locations')}</h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-theme-muted">
                {tr('Живые Яндекс.Карты и данные из API Lapka: каталог клиник, аптеки и площадки из справочника мест — не только название на витрине.', 'Live Yandex Maps and Lapka API data: clinic catalog, pharmacies, and places from the location directory.')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: tr('На карте', 'On map'), value: markers.length, tone: '' },
                { label: tr('Загружено', 'Loaded'), value: rows.length, tone: 'text-sky-700 dark:text-sky-300' },
                { label: tr('Слой', 'Layer'), value: tabLabel, tone: 'text-violet-700 dark:text-violet-300' },
                { label: tr('Статус', 'Status'), value: apiTile, tone: error ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300' },
                { label: tr('Клиники', 'Clinics'), value: rows.filter((r) => r.type === 'clinic').length, tone: 'text-amber-700 dark:text-amber-300' },
                { label: tr('В API', 'In API'), value: loading ? '…' : 'Live', tone: 'text-emerald-700 dark:text-emerald-300' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums sm:text-3xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="page-wrap space-y-4 !px-0">
        {error ? (
          <div className="callout-danger">{error}</div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          {[
            {
              title: tr('Публичная запись', 'Public booking'),
              text: tr('Маршрут от карты до выбора слота в клинике.', 'Route from map to slot selection in clinic.'),
              href: '/public-booking',
              tone: 'text-sky-700 dark:text-sky-300',
            },
            {
              title: tr('Потерянные питомцы', 'Lost pets'),
              text: tr('Объявления и география по локациям.', 'Listings and geography by locations.'),
              href: '/lost-pets',
              tone: 'text-amber-700 dark:text-amber-300',
            },
            {
              title: tr('Публичный паспорт', 'Public passport'),
              text: tr('Безопасный профиль питомца по токену.', 'Safe pet profile by token.'),
              href: '/pet-passport/demo-token',
              tone: 'text-violet-700 dark:text-violet-300',
            },
          ].map((item) => (
            <Link key={item.title} href={item.href} className="rounded-2xl border border-border bg-surface-muted/70 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
              <p className={`text-base font-black ${item.tone}`}>{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-theme">{item.text}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">{tr('Открыть', 'Open')}</p>
            </Link>
          ))}
        </section>

        <Card title={tr('Фильтр', 'Filter')} subtitle={tr('Публичные эндпоинты: /market/clinics и /places', 'Public endpoints: /market/clinics and /places')}>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'clinic', label: tr('Клиники', 'Clinics') },
              { id: 'pharmacy', label: tr('Аптеки', 'Pharmacies') },
              { id: 'park', label: tr('Площадки', 'Places') },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  tab === t.id ? 'bg-lapka-gradient text-on-lapka-gradient shadow-soft' : 'bg-surface-muted text-theme hover:bg-surface-muted'
                }`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
            <Link href="/public-booking" className="btn-secondary ml-auto">
              {tr('Онлайн-запись', 'Online booking')}
            </Link>
          </div>
        </Card>

        {loading ? (
          <Skeleton className="h-[440px] w-full rounded-2xl" />
        ) : (
          <YandexPlacesMap markers={markers} height={480} />
        )}

        <Card title={tr('Список', 'List')} subtitle={lang === 'en' ? `${rows.length} points loaded` : `${rows.length} точек загружено`}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {rows.slice(0, 18).map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-surface-muted/70 px-4 py-3 text-sm">
                <p className="font-bold text-theme">{r.name}</p>
                <p className="mt-1 text-theme-muted">
                  {r.city} · {r.address}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-surface/80 px-2.5 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{tr('Тип', 'Type')}</p>
                    <p className="mt-1 text-xs font-black text-theme">{r.type || 'place'}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-surface/80 px-2.5 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{tr('Статус', 'Status')}</p>
                    <p className={`mt-1 text-xs font-black ${r.type === 'clinic' ? 'text-emerald-700 dark:text-emerald-300' : 'text-sky-700 dark:text-sky-300'}`}>
                      {r.type === 'clinic' ? tr('Доступна запись', 'Booking available') : tr('Публичная точка', 'Public location')}
                    </p>
                  </div>
                </div>
                {r.type === 'clinic' ? (
                  <Link href={`/public-booking/${r.id}`} className="link-accent mt-2 inline-block text-xs">
                    {tr('Запись в клинику', 'Book clinic')}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
