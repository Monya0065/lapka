'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import {
  buildSmartIntentSuggestions,
  CALCULATOR_STRIP,
  KNOWLEDGE_AREAS,
} from '@/lib/owner-workspace';
import { DANGEROUS_PRODUCTS } from '@/lib/owner-experience';

const OWNER_SECONDARY_CENTERS = [
  { id: 'owner-visits', category: 'Центр владельца', title: 'Центр визитов', description: 'Подготовка к визиту, будущие записи и история обращений.', href: '/owner/visits' },
  { id: 'owner-metrics', category: 'Центр владельца', title: 'Метрики состояния', description: 'Вес, аппетит, вода, активность и другие показатели в динамике.', href: '/owner/metrics' },
  { id: 'owner-prevention', category: 'Центр владельца', title: 'Профилактика', description: 'Вакцинации, обработки, сезонные задачи и контрольные осмотры.', href: '/owner/prevention' },
  { id: 'owner-routine', category: 'Центр владельца', title: 'Рутина дня', description: 'Ежедневные действия по уходу, воде, кормлению и наблюдению.', href: '/owner/routine' },
  { id: 'owner-recovery', category: 'Центр владельца', title: 'Режим восстановления', description: 'Контроль после процедуры, ограничения и повторные действия.', href: '/owner/recovery' },
  { id: 'owner-behavior', category: 'Центр владельца', title: 'Поведение и привычки', description: 'Стресс, сон, привычный ритм и изменения поведения питомца.', href: '/owner/behavior' },
  { id: 'owner-travel', category: 'Центр владельца', title: 'Поездка с питомцем', description: 'Документы, дорожный комплект, карта клиник и сводка перед дорогой.', href: '/owner/travel' },
  { id: 'owner-home-safety', category: 'Центр владельца', title: 'Домашняя безопасность', description: 'Бытовые риски, опасные продукты, химия и лекарства человека.', href: '/owner/home-safety' },
  { id: 'owner-export-pack', category: 'Центр владельца', title: 'Краткая сводка для врача', description: 'Короткий пакет данных для визита, дороги или второй клиники.', href: '/owner/export-pack' },
  { id: 'owner-passport-center', category: 'Центр владельца', title: 'Паспорт питомца', description: 'Чип, QR-паспорт, важные данные и экстренные контакты.', href: '/owner/passport-center' },
  { id: 'owner-expenses', category: 'Центр владельца', title: 'Расходы', description: 'Затраты на здоровье, сервисы, профилактику и будущие визиты.', href: '/owner/expenses' },
];

function normalizeQuery(value) {
  return String(value || '').trim().toLowerCase();
}

function localFilterDangerousProducts(query) {
  const q = normalizeQuery(query);
  if (!q) return [];
  return DANGEROUS_PRODUCTS.filter((item) => {
    return [item.name, item.category, item.why, item.safeAlternative].join(' ').toLowerCase().includes(q);
  }).slice(0, 4).map((item) => ({
    id: item.id,
    category: 'Опасные продукты',
    title: item.name,
    description: item.why,
    href: '/owner/care?tab=food-safety',
  }));
}

function localFilterCalculators(query) {
  const q = normalizeQuery(query);
  if (!q) return [];
  return CALCULATOR_STRIP.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(q)).map((item) => ({
    id: item.id,
    category: 'Калькуляторы',
    title: item.title,
    description: item.description,
    href: item.href,
  }));
}

function localFilterKnowledgeAreas(query) {
  const q = normalizeQuery(query);
  if (!q) return [];
  return KNOWLEDGE_AREAS.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(q)).map((item) => ({
    id: item.id,
    category: 'Центр знаний',
    title: item.title,
    description: item.description,
    href: '/owner/knowledge',
  }));
}

function localFilterOwnerCenters(query) {
  const q = normalizeQuery(query);
  if (!q) return [];
  return OWNER_SECONDARY_CENTERS.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(q)).slice(0, 8);
}

function ResultSection({ title, items, onSelect }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <p className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-lapka-500">{title}</p>
      <div className="grid gap-2">
        {items.map((item) => (
          <button
            key={`${title}-${item.id}`}
            type="button"
            className="palette-result-row"
            onClick={() => onSelect(item.href)}
          >
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-lapka-900">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-lapka-600">{item.description}</p>
            </div>
            <span className="palette-result-tag">{item.category}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function SmartCommandPalette({ open, onClose, links = [], role = 'owner' }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState({
    intents: [],
    pets: [],
    documents: [],
    diseases: [],
    symptoms: [],
    drugs: [],
    clinics: [],
    dangerousProducts: [],
    calculators: [],
    knowledge: [],
    ownerCenters: [],
  });

  const quickLinks = useMemo(
    () => [
      ...links.slice(0, 8).map((item) => ({
        id: item.href,
        category: 'Навигация',
        title: item.label,
        description: item.href,
        href: item.href,
      })),
      ...(role === 'owner' ? OWNER_SECONDARY_CENTERS.slice(0, 6) : []),
    ],
    [links, role]
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = overflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = normalizeQuery(query);
    let active = true;

    async function run() {
      if (!q) {
        setSections({
          intents: [],
          pets: [],
          documents: [],
          diseases: [],
          symptoms: [],
          drugs: [],
          clinics: [],
          dangerousProducts: [],
          calculators: [],
          knowledge: [],
          ownerCenters: [],
        });
        return;
      }

      setLoading(true);
      const [petsRes, docsRes, diseasesRes, symptomsRes, drugsRes, clinicsRes] = await Promise.allSettled([
        apiRequest('/api/v1/pets'),
        apiRequest('/api/v1/documents'),
        apiRequest(`/api/v1/diseases/search?q=${encodeURIComponent(q)}&limit=4`),
        apiRequest(`/api/v1/symptoms/search?q=${encodeURIComponent(q)}&limit=4`),
        apiRequest(`/api/v1/drugs?q=${encodeURIComponent(q)}&limit=4`),
        apiRequest(`/api/v1/market/clinics?q=${encodeURIComponent(q)}&limit=4`),
      ]);

      if (!active) return;

      const petsPayload = petsRes.status === 'fulfilled' && Array.isArray(petsRes.value) ? petsRes.value : [];
      const docsPayload = docsRes.status === 'fulfilled' && Array.isArray(docsRes.value) ? docsRes.value : [];
      const diseasesPayload = diseasesRes.status === 'fulfilled' ? diseasesRes.value?.items || [] : [];
      const symptomsPayload = symptomsRes.status === 'fulfilled' ? symptomsRes.value?.items || [] : [];
      const drugsPayload = drugsRes.status === 'fulfilled' ? drugsRes.value?.items || drugsRes.value || [] : [];
      const clinicsPayload = clinicsRes.status === 'fulfilled' ? clinicsRes.value?.items || clinicsRes.value || [] : [];

      const petItems = petsPayload
        .filter((item) => [item.name, item.breed, item.species, item.chip_id, item.passport_id].filter(Boolean).join(' ').toLowerCase().includes(q))
        .slice(0, 4)
        .map((item) => ({
          id: item.id,
          category: 'Питомцы',
          title: item.name,
          description: [item.species, item.breed, item.chip_id].filter(Boolean).join(' · '),
          href: `/owner/pet/${item.id}`,
        }));

      const documentItems = docsPayload
        .filter((item) => [item.title, item.doc_type, item.file_name].filter(Boolean).join(' ').toLowerCase().includes(q))
        .slice(0, 4)
        .map((item) => ({
          id: item.id,
          category: 'Документы',
          title: item.title || item.doc_type || 'Документ',
          description: item.doc_type || 'Архив питомца',
          href: `/owner/pet/${item.pet_id}/documents`,
        }));

      const diseaseItems = diseasesPayload.map((item) => ({
        id: item.id,
        category: 'Болезни',
        title: item.name,
        description: item.description,
        href: `/diseases/${item.id}`,
      }));

      const symptomItems = symptomsPayload.map((item) => ({
        id: item.id,
        category: 'Симптомы',
        title: item.name,
        description: item.description,
        href: `/owner/knowledge?tab=symptoms&query=${encodeURIComponent(item.name)}`,
      }));

      const drugItems = (Array.isArray(drugsPayload) ? drugsPayload : []).map((item) => ({
        id: item.id,
        category: 'Препараты',
        title: item.name,
        description: [item.active_substance, item.group, item.prescription_required ? 'Рецептурный' : 'OTC'].filter(Boolean).join(' · '),
        href: `/owner/drugs/${item.id}`,
      }));

      const clinicItems = (Array.isArray(clinicsPayload) ? clinicsPayload : []).map((item) => ({
        id: item.id,
        category: 'Клиники',
        title: item.name,
        description: [item.city, item.address].filter(Boolean).join(' · '),
        href: `/owner/clinic/${item.id}`,
      }));

      setSections({
        intents: buildSmartIntentSuggestions(q),
        pets: petItems,
        documents: documentItems,
        diseases: diseaseItems,
        symptoms: symptomItems,
        drugs: drugItems,
        clinics: clinicItems,
        dangerousProducts: localFilterDangerousProducts(q),
        calculators: localFilterCalculators(q),
        knowledge: localFilterKnowledgeAreas(q),
        ownerCenters: role === 'owner' ? localFilterOwnerCenters(q) : [],
      });
      setLoading(false);
    }

    const timer = window.setTimeout(run, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query, role]);

  if (!open) return null;

  const hasQuery = normalizeQuery(query).length > 0;
  const hasResults = Object.values(sections).some((items) => items.length > 0);

  function onSelect(href) {
    onClose();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-[rgba(7,18,33,0.38)] px-4 py-10 backdrop-blur-md md:px-6 md:py-14" onClick={onClose}>
      <div className="w-full max-w-[1080px] overflow-hidden rounded-[34px] border border-white/70 bg-white/96 shadow-[0_40px_120px_rgba(10,26,46,0.24)]" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-lapka-200 px-5 py-5 md:px-7 md:py-6">
          <div className="flex items-center gap-3 rounded-[26px] border border-lapka-200 bg-lapka-50/75 px-4 py-4 shadow-soft-sm">
            <span className="text-lapka-500">
              <svg viewBox="0 0 24 24" className="h-6 w-6">
                <path d="M10.5 4a6.5 6.5 0 1 0 4.24 11.43l4.41 4.41 1.41-1.41-4.41-4.41A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" fill="currentColor" />
              </svg>
            </span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[1.12rem] text-lapka-900 outline-none placeholder:text-lapka-500"
              placeholder={role === 'owner' ? 'Ищите питомцев, лекарства, симптомы, статьи, документы и клиники' : 'Ищите пациентов, документы, визиты и справочники'}
            />
            <span className="rounded-full border border-lapka-200 bg-white px-3 py-1 text-xs font-semibold text-lapka-500">Esc</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-lapka-600">
            <span className="pill !px-3 !py-1.5">Cmd/Ctrl + K</span>
            <span className="pill !px-3 !py-1.5">Умный поиск по продукту</span>
            <span className="pill !px-3 !py-1.5">Навигация и действия</span>
          </div>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-5 md:px-7 md:py-6">
          {!hasQuery ? (
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-lapka-500">Быстрые переходы</p>
                <div className="grid gap-2">
                  {quickLinks.map((item) => (
                    <button key={item.id} type="button" className="palette-result-row" onClick={() => onSelect(item.href)}>
                      <div>
                        <p className="text-base font-bold text-lapka-900">{item.title}</p>
                        <p className="mt-1 text-sm text-lapka-600">{item.description}</p>
                      </div>
                      <span className="palette-result-tag">Навигация</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-lapka-500">Что можно найти</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {[
                    { title: 'Питомцы', text: 'Карточка, паспорт, документы, медкарта', href: '/owner/pets' },
                    { title: 'Лекарства', text: 'Назначения, календарь приёма, аптека', href: '/owner/medications' },
                    { title: 'Знания', text: 'Симптомы, болезни, опасные продукты', href: '/owner/knowledge' },
                    { title: 'Сервисы', text: 'Клиники, карта, записи, счета', href: '/owner/services' },
                  ].map((item) => (
                    <button key={item.href} type="button" className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-card" onClick={() => onSelect(item.href)}>
                      <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-lapka-600">{item.text}</p>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : loading ? (
            <div className="space-y-3">
              <div className="skeleton h-20 w-full" />
              <div className="skeleton h-20 w-full" />
              <div className="skeleton h-20 w-full" />
            </div>
          ) : hasResults ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-5">
                <ResultSection title="Сценарии" items={sections.intents} onSelect={onSelect} />
                <ResultSection title="Питомцы" items={sections.pets} onSelect={onSelect} />
                <ResultSection title="Документы" items={sections.documents} onSelect={onSelect} />
                <ResultSection title="Клиники" items={sections.clinics} onSelect={onSelect} />
                <ResultSection title="Центры владельца" items={sections.ownerCenters} onSelect={onSelect} />
                <ResultSection title="Калькуляторы" items={sections.calculators} onSelect={onSelect} />
              </div>
              <div className="space-y-5">
                <ResultSection title="Лекарства" items={sections.drugs} onSelect={onSelect} />
                <ResultSection title="Симптомы" items={sections.symptoms} onSelect={onSelect} />
                <ResultSection title="Болезни" items={sections.diseases} onSelect={onSelect} />
                <ResultSection title="Опасные продукты" items={sections.dangerousProducts} onSelect={onSelect} />
                <ResultSection title="Знания" items={sections.knowledge} onSelect={onSelect} />
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-lapka-300 bg-lapka-50/80 px-6 py-10 text-center">
              <p className="text-2xl font-black tracking-tight text-lapka-900">Ничего подходящего не найдено</p>
              <p className="mt-2 text-base text-lapka-600">Попробуйте симптом, название препарата, документ, клинику или запрос вроде «собака съела шоколад».</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Link href="/owner/triage" className="btn-primary" onClick={onClose}>Открыть SOS</Link>
                <Link href="/owner/knowledge" className="btn-secondary" onClick={onClose}>Открыть центр знаний</Link>
                <Link href="/owner/care" className="btn-secondary" onClick={onClose}>Открыть уход и питание</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
