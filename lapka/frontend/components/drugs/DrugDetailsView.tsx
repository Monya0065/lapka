'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';
import { getDrugPresentation } from '@/lib/drug-visuals';

function SectionAccordion({ title, items = [], emptyText }) {
  return (
    <details className="surface-card p-4" open>
      <summary className="cursor-pointer text-sm font-extrabold uppercase tracking-wide text-lapka-700">{title}</summary>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-lapka-700">
          {items.map((item) => (
            <li key={`${title}-${item}`} className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-lapka-500">{emptyText}</p>
      )}
    </details>
  );
}

function buildMentionRecord({ visitId, drug, note }) {
  const presentation = getDrugPresentation(drug);
  return {
    visit_id: visitId,
    drug_id: drug.id,
    drug_name: presentation.name || drug.name,
    note,
    created_at: new Date().toISOString()
  };
}

export default function DrugDetailsView({
  role = 'owner',
  drugId,
  listHref = '/owner/pharmacy',
  detailBasePath = '/owner/drugs',
  defaultVisitId = ''
}) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';
  const copy = lang === 'en'
    ? {
        noCatalogData: 'No data in the demo catalog.',
        mentionNote: 'Medication mentioned during consultation. No owner dosing provided.',
        loadDetailsError: 'Unable to load drug card',
        loadAvailabilityError: 'Unable to load availability',
        ownerListNote: 'Coordinate with veterinarian',
        addedToShopping: 'Added to shopping list.',
        failedShopping: 'Unable to add to shopping list.',
        missingVisit: 'Provide a visit ID before attaching the drug.',
        attachedToVisit: 'Drug saved as a medication mention in the visit draft.',
        failedVisitAttach: 'Unable to save medication mention.',
        title: 'All about the drug',
        subtitle: 'Discovery and safety facts. No dosing or treatment instructions for owners.',
        back: 'Back to catalog',
        notFoundTitle: 'Drug not found',
        notFoundText: 'Check the link or return to search.',
        drugCard: 'Drug card',
        rx: 'Prescription required (Rx)',
        otc: 'Over the counter (OTC)',
        activeSubstance: 'Active substance',
        group: 'Group',
        forms: 'Forms',
        ownerInfo: 'Reference only. This does not replace a veterinarian consultation.',
        vetInfo: 'Clinical reference. Verify your local clinic protocols before prescribing.',
        whereToBuy: 'Where to buy',
        addToShopping: 'Add to shopping list',
        attachToVisit: 'Attach to visit',
        visitId: 'Visit ID to attach',
        visitIdPlaceholder: 'For example: 66666666-6666-6666-6666-666666666666',
        contraindications: 'Contraindications',
        sideEffects: 'Side effects',
        interactions: 'Interactions',
        warnings: 'Warnings',
        analogs: 'Analogs',
        analogsSubtitle: 'Same class or active substance',
        noAnalogsTitle: 'No analogs',
        noAnalogsText: 'No analogs filled for this card.',
        variants: 'Variants',
        defaultStrength: 'per instruction',
        defaultPack: 'standard pack',
        noVariantsTitle: 'No variants',
        noVariantsText: 'Package variants are not filled.',
        clinicalNotes: 'Clinical notes',
        vetOnly: 'For veterinarian only',
        noClinicalNotes: 'Clinical notes are not filled for this drug.',
        close: 'Close',
        availabilitySubtitle: 'Online and nearby offline availability',
        online: 'Online',
        offline: 'Nearby offline',
        noOnlineTitle: 'No online offers',
        noOnlineText: 'Try another city or check the card later.',
        noOfflineTitle: 'Nothing found nearby',
        noOfflineText: 'Try another city or widen the search.',
        inStock: 'in stock',
        outOfStock: 'out of stock',
        call: 'Call',
        goToStore: 'Go to store'
      }
    : {
        noCatalogData: 'Нет данных в демо-каталоге.',
        mentionNote: 'Препарат отмечен на консультации. Без выдачи дозировок владельцу.',
        loadDetailsError: 'Не удалось загрузить карточку препарата',
        loadAvailabilityError: 'Не удалось загрузить доступность',
        ownerListNote: 'Согласовать с ветеринаром',
        addedToShopping: 'Добавлено в список покупок.',
        failedShopping: 'Не удалось добавить в список покупок.',
        missingVisit: 'Укажите ID визита для привязки.',
        attachedToVisit: 'Препарат добавлен как упоминание в черновик визита.',
        failedVisitAttach: 'Не удалось сохранить упоминание препарата.',
        title: 'Все о препарате',
        subtitle: 'Справка и безопасность. Без дозировок и схем лечения для владельца.',
        back: '← К каталогу',
        notFoundTitle: 'Препарат не найден',
        notFoundText: 'Проверьте ссылку или вернитесь к поиску.',
        drugCard: 'Карточка препарата',
        rx: 'Рецептурный (Rx)',
        otc: 'Без рецепта (OTC)',
        activeSubstance: 'Действующее вещество',
        group: 'Группа',
        forms: 'Формы',
        ownerInfo: 'Информация справочная. Не заменяет консультацию ветеринарного врача.',
        vetInfo: 'Клиническая справка. Проверяйте локальные протоколы клиники перед назначением.',
        whereToBuy: 'Где купить',
        addToShopping: 'Добавить в список покупок',
        attachToVisit: 'Добавить в визит',
        visitId: 'ID визита для привязки',
        visitIdPlaceholder: 'Например: 66666666-6666-6666-6666-666666666666',
        contraindications: 'Противопоказания',
        sideEffects: 'Побочные эффекты',
        interactions: 'Взаимодействия',
        warnings: 'Предупреждения',
        analogs: 'Аналоги',
        analogsSubtitle: 'Препараты того же класса или действующего вещества',
        noAnalogsTitle: 'Нет аналогов',
        noAnalogsText: 'Для этой карточки аналоги не заполнены.',
        variants: 'Варианты',
        defaultStrength: 'по инструкции',
        defaultPack: 'стандарт',
        noVariantsTitle: 'Нет вариантов',
        noVariantsText: 'Варианты упаковок не заполнены.',
        clinicalNotes: 'Клинические заметки',
        vetOnly: 'Только для врача',
        noClinicalNotes: 'Клинические заметки не заполнены для этой карточки.',
        close: 'Закрыть',
        availabilitySubtitle: 'Онлайн и офлайн-доступность рядом',
        online: 'Онлайн',
        offline: 'Рядом офлайн',
        noOnlineTitle: 'Нет онлайн-предложений',
        noOnlineText: 'Попробуйте изменить город или открыть карточку позже.',
        noOfflineTitle: 'Поблизости ничего не найдено',
        noOfflineText: 'Попробуйте другой город или увеличьте радиус поиска.',
        inStock: 'в наличии',
        outOfStock: 'нет в наличии',
        call: 'Позвонить',
        goToStore: 'Перейти'
      };

  const [drug, setDrug] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [visitId, setVisitId] = useState(defaultVisitId || '');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [availabilityTab, setAvailabilityTab] = useState('online');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availability, setAvailability] = useState({ online: [], offline: [], disclaimer: '' });
  const presentation = useMemo(() => getDrugPresentation(drug), [drug]);

  const loadDetails = useCallback(async () => {
    if (!drugId) return;
    setLoading(true);
    setError('');
    try {
      const drugPayload = await apiRequest(`/api/v1/drugs/${encodeURIComponent(drugId)}`);
      setDrug(drugPayload || null);
      setActiveImage(0);
    } catch (requestError) {
      setError(requestError.message || copy.loadDetailsError);
      setDrug(null);
    } finally {
      setLoading(false);
    }
  }, [copy.loadDetailsError, drugId]);

  const loadAvailability = useCallback(async () => {
    if (!drugId) return;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    try {
      const payload = await apiRequest(`/api/v1/drugs/${encodeURIComponent(drugId)}/availability?city=${encodeURIComponent(lang === 'en' ? 'Saint Petersburg' : 'Санкт-Петербург')}&radius_km=30`);
      setAvailability({
        online: Array.isArray(payload?.online) ? payload.online : [],
        offline: Array.isArray(payload?.offline) ? payload.offline : [],
        disclaimer: payload?.disclaimer || ''
      });
    } catch (requestError) {
      setAvailabilityError(requestError.message || copy.loadAvailabilityError);
      setAvailability({ online: [], offline: [], disclaimer: '' });
    } finally {
      setAvailabilityLoading(false);
    }
  }, [copy.loadAvailabilityError, drugId, lang]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    const timer = setTimeout(() => setStatusText(''), 2600);
    return () => clearTimeout(timer);
  }, [statusText]);

  const images = useMemo(() => {
    return presentation.images?.length ? presentation.images : ['/assets/img/drugs/pack-01.svg'];
  }, [presentation.images]);

  async function onAddToShopping() {
    if (!drug) return;
    try {
      await apiRequest('/api/v1/owner/shopping-list', {
        method: 'POST',
        body: {
          drug_id: drug.id,
          variant_id: drug.variants?.[0]?.id || null,
          quantity: 1,
          notes: copy.ownerListNote
        }
      });
      setStatusText(copy.addedToShopping);
    } catch (requestError) {
      setStatusText(requestError.message || copy.failedShopping);
    }
  }

  function onAttachToVisit() {
    if (!drug) return;
    if (!visitId.trim()) {
      setStatusText(copy.missingVisit);
      return;
    }
    try {
      const key = 'lapka.vet.medication_mentions';
      const raw = localStorage.getItem(key);
      const current = raw ? JSON.parse(raw) : [];
      current.push(buildMentionRecord({ visitId: visitId.trim(), drug, note: copy.mentionNote }));
      localStorage.setItem(key, JSON.stringify(current.slice(-100)));
      setStatusText(copy.attachedToVisit);
    } catch {
      setStatusText(copy.failedVisitAttach);
    }
  }

  async function openAvailabilityDrawer() {
    setDrawerOpen(true);
    setAvailabilityTab('online');
    await loadAvailability();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{copy.title}</h1>
          <p className="page-subtitle">{copy.subtitle}</p>
        </div>
        <Link className="btn-secondary" href={listHref}>
          {copy.back}
        </Link>
      </header>

      {statusText ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {statusText}
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} onRetry={loadDetails} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-[360px] w-full" />
          <Skeleton className="h-[220px] w-full" />
          <Skeleton className="h-[220px] w-full" />
        </section>
      ) : !drug ? (
        <EmptyState title={copy.notFoundTitle} text={copy.notFoundText} />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <AppImage
                src={images[activeImage] || '/assets/img/drugs/pack-01.svg'}
                alt={lang === 'en' ? `Drug image ${presentation.name}` : `Изображение препарата ${presentation.name}`}
                width={1600}
                height={1200}
                sizes="(max-width: 1024px) 100vw, 780px"
                className="h-[360px] w-full rounded-2xl border border-lapka-200 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.92),rgba(236,245,255,0.96)_72%)] object-contain p-6"
              />
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={`overflow-hidden rounded-xl border ${activeImage === index ? 'border-lapka-500' : 'border-lapka-200'}`}
                  >
                    <AppImage
                      src={image}
                      alt=""
                      width={240}
                      height={160}
                      sizes="96px"
                      className="h-16 w-24 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.92),rgba(236,245,255,0.96)_72%)] object-contain p-1.5"
                    />
                  </button>
                ))}
              </div>
            </Card>

            <Card title={presentation.name} subtitle={copy.drugCard}>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className={drug.prescription_required ? 'badge-red' : 'badge-green'}>
                  {drug.prescription_required ? copy.rx : copy.otc}
                </span>
                {(drug.species || []).map((sp) => (
                  <span key={`${drug.id}-${sp}`} className="pill">
                    {sp}
                  </span>
                ))}
                {(drug.tags || []).slice(0, 2).map((tag) => (
                  <span key={`${drug.id}-${tag}`} className="pill">
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-sm text-lapka-700">{drug.description}</p>
              <div className="mt-4 space-y-1 text-sm text-lapka-700">
                <p><span className="font-semibold">{copy.activeSubstance}:</span> {presentation.activeSubstance || '—'}</p>
                <p><span className="font-semibold">{copy.group}:</span> {presentation.group || '—'}</p>
                <p><span className="font-semibold">{copy.forms}:</span> {(drug.forms || []).join(', ') || '—'}</p>
              </div>

              <div className="mt-4 rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm text-lapka-700">
                {role === 'owner' ? copy.ownerInfo : copy.vetInfo}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button className="btn-primary" type="button" onClick={openAvailabilityDrawer}>
                  {copy.whereToBuy}
                </button>
                {role === 'owner' ? (
                  <button className="btn-secondary" type="button" onClick={onAddToShopping}>
                    {copy.addToShopping}
                  </button>
                ) : (
                  <button className="btn-secondary" type="button" onClick={onAttachToVisit}>
                    {copy.attachToVisit}
                  </button>
                )}
              </div>

              {role === 'vet' ? (
                <div className="mt-3">
                  <label className="label">{copy.visitId}</label>
                  <input
                    className="input"
                    value={visitId}
                    onChange={(event) => setVisitId(event.target.value)}
                    placeholder={copy.visitIdPlaceholder}
                  />
                </div>
              ) : null}
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <SectionAccordion title={copy.contraindications} items={drug.contraindications || []} emptyText={copy.noCatalogData} />
            <SectionAccordion title={copy.sideEffects} items={drug.side_effects || []} emptyText={copy.noCatalogData} />
            <SectionAccordion title={copy.interactions} items={drug.interactions || []} emptyText={copy.noCatalogData} />
            <SectionAccordion title={copy.warnings} items={drug.warnings || []} emptyText={copy.noCatalogData} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card title={copy.analogs} subtitle={copy.analogsSubtitle}>
              {drug.analogs?.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {drug.analogs.map((analog) => (
                    <Link
                      key={analog.id}
                      href={`${detailBasePath}/${analog.id}`}
                      className="flex items-center gap-3 rounded-xl border border-lapka-200 bg-white p-2 hover:bg-lapka-50"
                    >
                      <AppImage
                        src={getDrugPresentation(analog).thumbnailUrl}
                        alt=""
                        width={200}
                        height={140}
                        sizes="80px"
                        className="h-14 w-20 rounded-lg border border-lapka-200 object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold text-lapka-900">{getDrugPresentation(analog).name}</p>
                        <p className="text-xs text-lapka-600">{analog.prescription_required ? 'Rx' : 'OTC'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title={copy.noAnalogsTitle} text={copy.noAnalogsText} />
              )}
            </Card>

            <Card title={copy.variants}>
              {(drug.variants || []).length ? (
                <ul className="space-y-2 text-sm text-lapka-700">
                  {drug.variants.map((variant) => (
                    <li key={variant.id} className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                      <p className="font-semibold text-lapka-900">{variant.form}</p>
                      <p className="text-xs text-lapka-600">{variant.strength_text || copy.defaultStrength} · {variant.pack_size_text || copy.defaultPack}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={copy.noVariantsTitle} text={copy.noVariantsText} />
              )}
            </Card>
          </section>

          {role === 'vet' ? (
            <Card title={copy.clinicalNotes} subtitle={copy.vetOnly}>
              {(drug.clinical_notes || []).length ? (
                <ul className="space-y-2 text-sm text-lapka-700">
                  {drug.clinical_notes.map((item) => (
                    <li key={`clinical-note-${item}`} className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={copy.clinicalNotes} text={copy.noClinicalNotes} />
              )}
            </Card>
          ) : null}
        </>
      )}

      {drawerOpen ? (
        <div className="fixed inset-0 z-[80] bg-lapka-900/45 p-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setDrawerOpen(false)} />
          <div className="relative ml-auto h-full w-full max-w-2xl animate-fade-in-up overflow-auto">
            <Card
              title={`${copy.whereToBuy}: ${presentation.name || ''}`}
              subtitle={copy.availabilitySubtitle}
              action={
                <button className="btn-secondary" type="button" onClick={() => setDrawerOpen(false)}>
                  {copy.close}
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

              {availabilityError ? <ErrorBanner message={availabilityError} onRetry={loadAvailability} /> : null}

              {availabilityLoading ? (
                <div className="space-y-2">
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
