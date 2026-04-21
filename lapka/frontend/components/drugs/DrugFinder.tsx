'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import AppImage from '@/components/ui/AppImage';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';
import { getDrugPresentation } from '@/lib/drug-visuals';

const FORM_OPTIONS = ['таблетки', 'капсулы', 'суспензия', 'инъекция', 'раствор', 'капли', 'мазь'];

const FORM_LABELS = {
  ru: {
    таблетки: 'таблетки',
    капсулы: 'капсулы',
    суспензия: 'суспензия',
    инъекция: 'инъекция',
    раствор: 'раствор',
    капли: 'капли',
    мазь: 'мазь'
  },
  en: {
    таблетки: 'tablets',
    капсулы: 'capsules',
    суспензия: 'suspension',
    инъекция: 'injection',
    раствор: 'solution',
    капли: 'drops',
    мазь: 'ointment'
  }
};

const SPECIES_LABELS = {
  ru: {
    кошки: 'Кошки',
    собаки: 'Собаки'
  },
  en: {
    кошки: 'Cats',
    собаки: 'Dogs'
  }
};

function DrugCard({ drug, detailBasePath, onOpenAvailability, onAddToShopping, role, copy, lang }) {
  const presentation = getDrugPresentation(drug);

  return (
    <article className="surface-card overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-float">
      <AppImage
        src={presentation.thumbnailUrl}
        alt={lang === 'en' ? `Drug package ${presentation.name}` : `Упаковка препарата ${presentation.name}`}
        width={960}
        height={720}
        sizes="(max-width: 768px) 100vw, 420px"
        className="h-56 w-full bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.92),rgba(236,245,255,0.96)_72%)] object-contain p-5"
      />
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[1.15rem] font-extrabold tracking-tight text-lapka-900">{presentation.name}</h3>
          <span className={drug.prescription_required ? 'badge-red' : 'badge-green'}>
            {drug.prescription_required ? 'Rx' : 'OTC'}
          </span>
        </div>
        <p className="text-sm text-lapka-600">{presentation.activeSubstance || copy.pendingSubstance}</p>
        <div className="flex flex-wrap gap-1.5">
          {(drug.forms || []).slice(0, 3).map((form) => (
            <span key={`${drug.id}-${form}`} className="pill !text-xs">
              {FORM_LABELS[lang][form] || form}
            </span>
          ))}
          {(drug.species || []).slice(0, 2).map((sp) => (
            <span key={`${drug.id}-${sp}`} className="pill !text-xs">
              {SPECIES_LABELS[lang][sp] || sp}
            </span>
          ))}
        </div>
        <p className="text-base leading-7 text-lapka-600">
          {role === 'owner' ? copy.ownerCardNote : copy.vetCardNote}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn-secondary" type="button" onClick={() => onOpenAvailability(drug)}>
            {copy.whereToBuy}
          </button>
          <Link className="btn-primary" href={`${detailBasePath}/${drug.id}`}>
            {copy.aboutDrug}
          </Link>
          {role === 'owner' ? (
            <button className="btn-secondary sm:col-span-2" type="button" onClick={() => onAddToShopping(drug)}>
              {copy.addToShopping}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function DrugFinder({
  role = 'owner',
  detailBasePath = '/owner/drugs',
  title,
  subtitle
}) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';
  const copy = useMemo(
    () => (lang === 'en'
    ? {
        defaultTitle: role === 'vet' ? 'Medication Finder' : 'Pharmacy and medications',
        defaultSubtitle:
          role === 'vet'
            ? 'Reference drug library, availability and clinical notes for veterinarians.'
            : 'Drug search, availability and safe reference for owners.',
        pendingSubstance: 'Active substance pending',
        ownerCardNote: 'Reference and availability only. No treatment plans or dosing.',
        vetCardNote: 'Reference data for clinical workflow. Final prescription decision stays with the veterinarian.',
        whereToBuy: 'Where to buy',
        aboutDrug: 'All about the drug',
        addToShopping: 'Add to shopping list',
        loadCatalogError: 'Unable to load drug catalog',
        loadShoppingError: 'Unable to load shopping list',
        addShoppingSuccess: 'Added to shopping list',
        addShoppingError: 'Unable to add drug to shopping list',
        loadAvailabilityError: 'Unable to load availability',
        suggestAccepted: 'Request accepted: the team will review the drug before adding it.',
        searchLabel: 'Find a drug',
        searchPlaceholder: 'Name or active substance...',
        species: 'Species',
        all: 'All',
        cats: 'Cats',
        dogs: 'Dogs',
        form: 'Form',
        city: 'City',
        rxOnly: 'Only Rx',
        popularTitle: 'Popular drugs',
        popularSubtitle: 'Quick access',
        shoppingTitle: 'Shopping list',
        shoppingSubtitle: 'No dosing, just a safe list of medications',
        shoppingEmptyTitle: 'Shopping list is empty',
        shoppingEmptyText: 'Add medications from the catalog cards.',
        shown: 'Shown',
        of: 'of',
        drugs: 'drugs',
        previous: 'Previous',
        next: 'Next',
        notFoundTitle: 'Drug not found?',
        notFoundText: 'Change filters or suggest adding it to the catalog.',
        resetFilters: 'Reset filters',
        suggestAdd: 'Suggest a drug',
        drawerTitle: 'Where to buy',
        drawerSubtitle: 'Online and nearby offline availability',
        online: 'Online',
        offline: 'Nearby offline',
        goToStore: 'Go to store',
        noOnlineTitle: 'No online offers',
        noOnlineText: 'Try another city or check again later.',
        noOfflineTitle: 'Nothing found nearby',
        noOfflineText: 'Try another city or broaden the search.',
        inStock: 'in stock',
        outOfStock: 'out of stock',
        call: 'Call',
        variantQty: 'qty'
      }
    : {
        defaultTitle: role === 'vet' ? 'Аптека и препараты' : 'Аптека и препараты',
        defaultSubtitle:
          role === 'vet'
            ? 'Справочник препаратов, доступность и клинические заметки для врача.'
            : 'Поиск препаратов, доступность и безопасная справка для владельца.',
        pendingSubstance: 'Действующее вещество уточняется',
        ownerCardNote: 'Только справка и доступность. Без схем лечения и дозировок.',
        vetCardNote: 'Справочные данные для клинической работы. Назначение принимает врач.',
        whereToBuy: 'Где купить',
        aboutDrug: 'Все о препарате',
        addToShopping: 'В список покупок',
        loadCatalogError: 'Не удалось загрузить каталог препаратов',
        loadShoppingError: 'Не удалось загрузить список покупок',
        addShoppingSuccess: 'Добавлено в список покупок',
        addShoppingError: 'Не удалось добавить препарат в список',
        loadAvailabilityError: 'Не удалось загрузить доступность препарата',
        suggestAccepted: 'Запрос принят: команда добавит препарат после проверки источников.',
        searchLabel: 'Найти препарат',
        searchPlaceholder: 'Название, действующее вещество...',
        species: 'Вид',
        all: 'Все',
        cats: 'Кошки',
        dogs: 'Собаки',
        form: 'Форма',
        city: 'Город',
        rxOnly: 'Только Rx',
        popularTitle: 'Популярные препараты',
        popularSubtitle: 'Быстрый доступ',
        shoppingTitle: 'Список покупок',
        shoppingSubtitle: 'Без дозировок, только список препаратов',
        shoppingEmptyTitle: 'Список пока пуст',
        shoppingEmptyText: 'Добавьте препараты из карточек каталога.',
        shown: 'Показано',
        of: 'из',
        drugs: 'препаратов',
        previous: 'Назад',
        next: 'Дальше',
        notFoundTitle: 'Не нашли препарат?',
        notFoundText: 'Попробуйте изменить фильтры или предложите добавить препарат в каталог.',
        resetFilters: 'Сбросить фильтры',
        suggestAdd: 'Предложить добавить',
        drawerTitle: 'Где купить',
        drawerSubtitle: 'Онлайн и офлайн-доступность рядом',
        online: 'Онлайн',
        offline: 'Рядом офлайн',
        goToStore: 'Перейти',
        noOnlineTitle: 'Нет онлайн-предложений',
        noOnlineText: 'Попробуйте изменить город или открыть карточку позже.',
        noOfflineTitle: 'Поблизости ничего не найдено',
        noOfflineText: 'Попробуйте другой город или увеличьте радиус поиска.',
        inStock: 'в наличии',
        outOfStock: 'нет в наличии',
        call: 'Позвонить',
        variantQty: 'x'
      }),
    [lang, role]
  );

  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState('');
  const [form, setForm] = useState('');
  const [rxOnly, setRxOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drugs, setDrugs] = useState([]);
  const [popular, setPopular] = useState([]);
  const [total, setTotal] = useState(0);
  const [city, setCity] = useState(lang === 'en' ? 'Saint Petersburg' : 'Санкт-Петербург');
  const [statusText, setStatusText] = useState('');

  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [shoppingItems, setShoppingItems] = useState([]);
  const [shoppingError, setShoppingError] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [availabilityTab, setAvailabilityTab] = useState('online');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availability, setAvailability] = useState({ online: [], offline: [], disclaimer: '' });

  const totalPages = Math.max(1, Math.ceil((total || 0) / 24));

  useEffect(() => {
    const timer = setTimeout(() => setStatusText(''), 2400);
    return () => clearTimeout(timer);
  }, [statusText]);

  useEffect(() => {
    setPage(1);
  }, [query, species, form, rxOnly]);

  const loadDrugs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (species) params.set('species', species);
      if (form) params.set('form', form);
      if (rxOnly) params.set('prescription_required', 'true');
      params.set('page', String(page));
      params.set('limit', '24');
      const payload = await apiRequest(`/api/v1/drugs?${params.toString()}`);
      setDrugs(Array.isArray(payload?.items) ? payload.items : []);
      setPopular(Array.isArray(payload?.popular) ? payload.popular : []);
      setTotal(Number(payload?.total || 0));
    } catch (requestError) {
      setError(requestError.message || copy.loadCatalogError);
      setDrugs([]);
      setPopular([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [copy.loadCatalogError, form, page, query, rxOnly, species]);

  const loadShoppingList = useCallback(async () => {
    if (role !== 'owner') return;
    setShoppingLoading(true);
    setShoppingError('');
    try {
      const payload = await apiRequest('/api/v1/owner/shopping-list');
      setShoppingItems(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setShoppingError(requestError.message || copy.loadShoppingError);
      setShoppingItems([]);
    } finally {
      setShoppingLoading(false);
    }
  }, [copy.loadShoppingError, role]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadDrugs();
    }, 180);
    return () => clearTimeout(timeout);
  }, [loadDrugs]);

  useEffect(() => {
    loadShoppingList();
  }, [loadShoppingList]);

  async function addToShoppingList(drug) {
    if (role !== 'owner') return;
    const presentation = getDrugPresentation(drug);
    try {
      await apiRequest('/api/v1/owner/shopping-list', {
        method: 'POST',
        body: { drug_id: drug.id, quantity: 1, notes: lang === 'en' ? 'Coordinate with veterinarian' : 'Согласовать с ветеринаром' }
      });
      setStatusText(`${copy.addShoppingSuccess}: ${presentation.name}`);
      await loadShoppingList();
    } catch (requestError) {
      setStatusText(requestError.message || copy.addShoppingError);
    }
  }

  const loadAvailability = useCallback(async (drug) => {
    setAvailabilityLoading(true);
    setAvailabilityError('');
    try {
      const params = new URLSearchParams();
      if (city.trim()) params.set('city', city.trim());
      params.set('radius_km', '30');
      const payload = await apiRequest(`/api/v1/drugs/${encodeURIComponent(drug.id)}/availability?${params.toString()}`);
      setAvailability({
        online: Array.isArray(payload?.online) ? payload.online : [],
        offline: Array.isArray(payload?.offline) ? payload.offline : [],
        disclaimer: payload?.disclaimer || ''
      });
      try {
        await apiRequest('/api/v1/availability/track', {
          method: 'POST',
          body: { drug_id: drug.id, city: city.trim() || null, radius_km: 30 }
        });
      } catch {
        // non-critical tracking
      }
    } catch (requestError) {
      setAvailabilityError(requestError.message || copy.loadAvailabilityError);
      setAvailability({ online: [], offline: [], disclaimer: '' });
    } finally {
      setAvailabilityLoading(false);
    }
  }, [city, copy.loadAvailabilityError]);

  function openAvailability(drug) {
    setSelectedDrug(drug);
    setAvailabilityTab('online');
    setDrawerOpen(true);
    loadAvailability(drug);
  }

  const ctaBlock = useMemo(
    () => (
      <div className="flex flex-wrap justify-center gap-2">
        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            setQuery('');
            setSpecies('');
            setForm('');
            setRxOnly(false);
          }}
        >
          {copy.resetFilters}
        </button>
        <button className="btn-primary" type="button" onClick={() => setStatusText(copy.suggestAccepted)}>
          {copy.suggestAdd}
        </button>
      </div>
    ),
    [copy]
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{title || copy.defaultTitle}</h1>
          <p className="page-subtitle">{subtitle || copy.defaultSubtitle}</p>
        </div>
      </header>

      {statusText ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {statusText}
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} onRetry={loadDrugs} /> : null}

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_180px_170px] md:items-end">
          <SearchInput
            label={copy.searchLabel}
            placeholder={copy.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="block">
            <span className="label">{copy.species}</span>
            <select className="input" value={species} onChange={(event) => setSpecies(event.target.value)}>
              <option value="">{copy.all}</option>
              <option value="кошки">{copy.cats}</option>
              <option value="собаки">{copy.dogs}</option>
            </select>
          </label>
          <label className="block">
            <span className="label">{copy.form}</span>
            <select className="input" value={form} onChange={(event) => setForm(event.target.value)}>
              <option value="">{copy.all}</option>
              {FORM_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {FORM_LABELS[lang][item] || item}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">{copy.city}</span>
            <input className="input" value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-lapka-200 bg-white px-3 py-2.5">
            <input type="checkbox" checked={rxOnly} onChange={(event) => setRxOnly(event.target.checked)} />
            <span className="text-sm font-semibold text-lapka-700">{copy.rxOnly}</span>
          </label>
        </div>
      </Card>

      {popular.length ? (
        <Card title={copy.popularTitle} subtitle={copy.popularSubtitle}>
          <div className="grid gap-3 md:grid-cols-3">
            {popular.slice(0, 3).map((item) => {
              const presentation = getDrugPresentation(item);
              return (
                <button
                  key={`featured-${item.id}`}
                  type="button"
                  onClick={() => setQuery(presentation.name)}
                  className="overflow-hidden rounded-2xl border border-lapka-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-card"
                >
                  <AppImage
                    src={presentation.thumbnailUrl}
                    alt={presentation.name}
                    width={960}
                    height={640}
                    sizes="(max-width: 768px) 100vw, 320px"
                    className="h-36 w-full bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.92),rgba(236,245,255,0.96)_72%)] object-contain p-4"
                  />
                  <div className="space-y-1 p-3">
                    <p className="text-base font-extrabold text-lapka-900">{presentation.name}</p>
                    <p className="text-xs text-lapka-600">{presentation.activeSubstance || copy.pendingSubstance}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="pill !px-3 !py-1 !text-[11px]">{presentation.group || 'Reference'}</span>
                      <span className={item.prescription_required ? 'badge-red !px-2.5 !py-1 !text-xs' : 'badge-green !px-2.5 !py-1 !text-xs'}>
                        {item.prescription_required ? 'Rx' : 'OTC'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {popular.map((item) => (
                <button
                  key={item.id}
                  className="pill transition hover:bg-lapka-100"
                  type="button"
                  onClick={() => setQuery(item.name)}
                  title={getDrugPresentation(item).name}
                >
                  {getDrugPresentation(item).name}
                </button>
            ))}
          </div>
        </Card>
      ) : null}

      {role === 'owner' ? (
        <Card title={copy.shoppingTitle} subtitle={copy.shoppingSubtitle}>
          {shoppingError ? <ErrorBanner message={shoppingError} onRetry={loadShoppingList} /> : null}
          {shoppingLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : shoppingItems.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {shoppingItems.map((item) => {
                const presentation = getDrugPresentation({
                  name: item.drug_name,
                  thumbnail_url: item.thumbnail_url,
                });
                return (
                <div key={item.id} className="rounded-xl border border-lapka-200 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <AppImage
                      src={presentation.thumbnailUrl}
                      alt=""
                      width={160}
                      height={120}
                      sizes="64px"
                      className="h-12 w-16 rounded-lg border border-lapka-200 object-cover"
                    />
                    <div>
                      <p className="text-sm font-semibold text-lapka-900">{presentation.name}</p>
                      <p className="text-xs text-lapka-600">{item.variant_label} · {copy.variantQty}{item.quantity}</p>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title={copy.shoppingEmptyTitle} text={copy.shoppingEmptyText} />
          )}
        </Card>
      ) : null}

      {loading ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`drug-skeleton-${index}`} className="h-[28rem] w-full" />
          ))}
        </section>
      ) : drugs.length ? (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {drugs.map((drug) => (
              <DrugCard
                key={drug.id}
                drug={drug}
                detailBasePath={detailBasePath}
                onOpenAvailability={openAvailability}
                onAddToShopping={addToShoppingList}
                role={role}
                copy={copy}
                lang={lang}
              />
            ))}
          </section>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-lapka-700">
              <p>
                {copy.shown} {drugs.length} {copy.of} {total} {copy.drugs}
              </p>
              <div className="flex items-center gap-2">
                <button className="btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                  {copy.previous}
                </button>
                <span className="pill">
                  {page} / {totalPages}
                </span>
                <button className="btn-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((prev) => prev + 1)}>
                  {copy.next}
                </button>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <EmptyState title={copy.notFoundTitle} text={copy.notFoundText} action={ctaBlock} />
      )}

      {drawerOpen ? (
        <div className="fixed inset-0 z-[80] bg-lapka-900/45 p-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setDrawerOpen(false)} />
          <div className="relative ml-auto h-full w-full max-w-2xl animate-fade-in-up overflow-auto">
            <Card
              title={`${copy.drawerTitle}: ${selectedDrug ? getDrugPresentation(selectedDrug).name : ''}`}
              subtitle={copy.drawerSubtitle}
              action={
                <button className="btn-secondary" type="button" onClick={() => setDrawerOpen(false)}>
                  {lang === 'en' ? 'Close' : 'Закрыть'}
                </button>
              }
            >
              <div className="mb-3 flex gap-2 overflow-x-auto">
                <button className={availabilityTab === 'online' ? 'btn-primary' : 'btn-secondary'} type="button" onClick={() => setAvailabilityTab('online')}>
                  {copy.online}
                </button>
                <button className={availabilityTab === 'offline' ? 'btn-primary' : 'btn-secondary'} type="button" onClick={() => setAvailabilityTab('offline')}>
                  {copy.offline}
                </button>
              </div>

              {availabilityError ? (
                <ErrorBanner message={availabilityError} onRetry={() => selectedDrug && loadAvailability(selectedDrug)} />
              ) : null}

              {availabilityLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : availabilityTab === 'online' ? (
                availability.online.length ? (
                  <div className="space-y-2">
                    {availability.online.map((row) => (
                      <div key={`${row.store}-${row.url}`} className="rounded-xl border border-lapka-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-lapka-900">{row.store}</p>
                          <p className="text-sm font-semibold text-lapka-700">{row.price_text}</p>
                        </div>
                        <p className="text-xs text-lapka-600">{row.delivery_text}</p>
                        <a className="mt-2 inline-flex text-sm font-semibold text-sky-700 hover:underline" href={row.url} target="_blank" rel="noreferrer">
                          {copy.goToStore}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title={copy.noOnlineTitle} text={copy.noOnlineText} />
                )
              ) : availability.offline.length ? (
                <div className="space-y-2">
                  {availability.offline.map((row) => (
                    <div key={`${row.pharmacy}-${row.address}`} className="rounded-xl border border-lapka-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-lapka-900">{row.pharmacy}</p>
                        <span className="pill !text-[11px]">{row.distance_km} км</span>
                      </div>
                      <p className="text-sm text-lapka-700">{row.address}</p>
                      <p className="text-xs text-lapka-600">
                        {row.hours} · {row.price_text} · {row.in_stock ? copy.inStock : copy.outOfStock}
                      </p>
                      <a className="mt-1 inline-flex text-xs font-semibold text-sky-700 hover:underline" href={`tel:${row.phone}`}>
                        {copy.call}: {row.phone}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title={copy.noOfflineTitle} text={copy.noOfflineText} />
              )}

              {availability.disclaimer ? (
                <p className="mt-3 rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-xs text-lapka-700">
                  {availability.disclaimer}
                </p>
              ) : null}
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
