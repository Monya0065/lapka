'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import { DANGEROUS_PRODUCTS } from '@/lib/owner-experience';
import { loadKnowledgeData, loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildHealthTimeline, buildKnowledgeFeed, KNOWLEDGE_AREAS, TRUST_META } from '@/lib/owner-workspace';

const TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'symptoms', label: 'Симптомы' },
  { id: 'diseases', label: 'Болезни' },
  { id: 'danger', label: 'Опасные продукты' },
];

function normalizeKnowledgeText(text) {
  return String(text || '')
    .replace(/\btriage\b/gi, 'оценки срочности')
    .replace(/\bhistory\b/gi, 'историю');
}

function formatTrustDate(value) {
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function OwnerKnowledgePage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const initialQuery = searchParams.get('query') || '';
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [diseases, setDiseases] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [reminders, setReminders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [petBundle, setPetBundle] = useState({
    visits: [],
    documents: [],
    vaccines: [],
    prescriptions: [],
    prescriptionsByVisit: {},
  });

  const loadPetContext = useCallback(async () => {
    try {
      const base = await loadOwnerBaseData();
      setPets(base.pets || []);
      setReminders(base.reminders || []);
      setAppointments(base.appointments || []);
      setSelectedPetId((current) => current && base.pets.some((item) => item.id === current) ? current : (base.pets[0]?.id || ''));
    } catch {
      setPets([]);
      setReminders([]);
      setAppointments([]);
    }
  }, []);

  const loadKnowledge = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await loadKnowledgeData(query);
      setDiseases(payload.diseases || []);
      setSymptoms(payload.symptoms || []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить центр знаний');
      setDiseases([]);
      setSymptoms([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadKnowledge();
  }, [loadKnowledge]);

  useEffect(() => {
    loadPetContext();
  }, [loadPetContext]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!selectedPetId) {
        setPetBundle({
          visits: [],
          documents: [],
          vaccines: [],
          prescriptions: [],
          prescriptionsByVisit: {},
        });
        return;
      }
      try {
        const payload = await loadPetHealthBundle(selectedPetId);
        if (!cancelled) {
          setPetBundle(payload);
        }
      } catch {
        if (!cancelled) {
          setPetBundle({
            visits: [],
            documents: [],
            vaccines: [],
            prescriptions: [],
            prescriptionsByVisit: {},
          });
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedPetId]);

  const selectedPet = useMemo(
    () => pets.find((item) => item.id === selectedPetId) || null,
    [pets, selectedPetId]
  );

  const timeline = useMemo(
    () => buildHealthTimeline({
      petId: selectedPetId,
      visits: petBundle.visits,
      documents: petBundle.documents,
      reminders,
      appointments,
      vaccines: petBundle.vaccines,
      prescriptionsByVisit: petBundle.prescriptionsByVisit,
    }),
    [appointments, petBundle.documents, petBundle.prescriptionsByVisit, petBundle.vaccines, petBundle.visits, reminders, selectedPetId]
  );

  const personalizedFeed = useMemo(
    () => buildKnowledgeFeed({ pet: selectedPet, medications: petBundle.prescriptions, timeline }),
    [petBundle.prescriptions, selectedPet, timeline]
  );

  const filteredDangerous = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DANGEROUS_PRODUCTS.filter((item) => !q || [item.name, item.category, item.why].join(' ').toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Центр знаний</p>
          <h1 className="page-title">Навигатор по симптомам, болезням и бытовым рискам</h1>
          <p className="page-subtitle">База знаний теперь работает как доверительный слой продукта: по симптомам, срочности, видам питомца и бытовым сценариям.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadKnowledge} /> : null}

      <Card title="Доверительный слой" subtitle="Пользователь должен понимать, насколько информация свежая, применимая и когда точно ехать в клинику.">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Проверено</p>
            <p className="mt-2 text-lg font-bold text-lapka-950">{TRUST_META.verifiedBy}</p>
          </div>
          <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Обновлено</p>
            <p className="mt-2 text-lg font-bold text-lapka-950">{formatTrustDate(TRUST_META.updatedAt)}</p>
          </div>
          <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Актуальность</p>
            <p className="mt-2 text-lg font-bold text-lapka-950">Для владельца питомца</p>
          </div>
          <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Когда срочно</p>
            <p className="mt-2 text-lg font-bold text-lapka-950">RED = сразу в клинику</p>
          </div>
        </div>
      </Card>

      {pets.length ? (
        <Card title={`Персонально для ${selectedPet?.name || 'питомца'}`} subtitle="База знаний привязана к выбранному питомцу, его возрасту, назначениям и недавним событиям.">
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
            <div>
              <div className="flex flex-wrap gap-2">
                {pets.map((pet) => (
                  <button
                    key={pet.id}
                    type="button"
                    className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'}
                    onClick={() => setSelectedPetId(pet.id)}
                  >
                    {pet.name}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {personalizedFeed.personalSignals.map((item) => (
                  <Link key={item.id} href={item.href} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-lapka-600">{item.description}</p>
                  </Link>
                ))}
              </div>
            </div>
            <div className="min-w-[280px] rounded-[28px] border border-lapka-200 bg-lapka-50/75 px-4 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Сезонные сигналы</p>
              <div className="mt-3 space-y-3">
                {personalizedFeed.seasonalAlerts.length ? personalizedFeed.seasonalAlerts.map((item) => (
                  <Link key={item.id} href={item.href} className="block rounded-[22px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <p className="text-base font-bold text-lapka-900">{item.title}</p>
                    <p className="mt-1 text-sm text-lapka-600">{item.description}</p>
                  </Link>
                )) : (
                  <p className="text-sm text-lapka-600">Сезонных предупреждений сейчас нет, но history и symptoms всё равно влияют на рекомендации.</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <SearchInput label="Умный поиск" placeholder="рвота, собака съела шоколад, понос, кашель, хромота…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            {TABS.map((item) => (
              <button key={item.id} type="button" className={tab === item.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setTab(item.id)}>{item.label}</button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-[440px] w-full" />
        </section>
      ) : tab === 'overview' ? (
        <section className="space-y-5">
          <div className="grid-soft-3">
            {KNOWLEDGE_AREAS.map((area) => (
              <Card key={area.id} title={area.title} subtitle={area.description} className={`bg-gradient-to-br ${area.accent}`}>
                <p className="text-sm text-lapka-700">Сначала сценарии и срочность, затем глубина и детализация.</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-5 2xl:grid-cols-[1.02fr_0.98fr]">
            <Card title="Популярные симптомы" subtitle="Быстрый вход в знания через симптом, а не через название болезни.">
              <div className="grid gap-3 md:grid-cols-2">
                {symptoms.slice(0, 8).map((item) => (
                  <Link key={item.id} href={`/owner/knowledge?tab=symptoms&query=${encodeURIComponent(item.name)}`} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <div className="flex items-center gap-2">
                      {item.emergency_flag ? <span className="badge-red">RED</span> : item.severity >= 4 ? <span className="badge-yellow">Важно</span> : <span className="pill !px-3 !py-1.5">Наблюдение</span>}
                    </div>
                    <p className="mt-3 text-lg font-bold text-lapka-900">{item.name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-lapka-600">{normalizeKnowledgeText(item.description)}</p>
                  </Link>
                ))}
              </div>
            </Card>
            <Card title="Когда срочно в клинику" subtitle="Короткая логика для владельца без диагноза и без самолечения.">
              <div className="space-y-3">
                {['Судороги или потеря сознания', 'Тяжёлое дыхание', 'Сильное кровотечение', 'Подозрение на отравление', 'Сильная боль или травма'].map((item) => (
                  <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-lg font-bold text-lapka-900">{item}</p>
                    <p className="mt-1 text-sm text-lapka-600">RED-сценарий. Откройте SOS-режим и готовьтесь ехать в клинику.</p>
                  </div>
                ))}
                <Link href="/owner/quick-triage" className="btn-primary">Открыть SOS-сценарий</Link>
              </div>
            </Card>
          </div>
          <div className="grid gap-4 2xl:grid-cols-3">
              {[
              { title: 'Карта домашних рисков', text: 'Растения, химия, провода и лекарства человека в одной понятной карте рисков.', href: '/owner/home-safety' },
              { title: 'Режим восстановления', text: 'После процедуры: как наблюдать за состоянием и что считать тревожным сигналом.', href: '/owner/recovery' },
              { title: 'Краткая сводка для врача', text: 'Подготовить краткую сводку перед дорогой или новым визитом.', href: '/owner/export-pack' },
            ].map((item) => (
              <Card key={item.href}>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Сценарий</p>
                <h3 className="mt-3 text-[1.55rem] font-black tracking-tight text-lapka-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-lapka-600">{item.text}</p>
                <Link href={item.href} className="mt-4 btn-secondary">
                  {item.href === '/owner/home-safety'
                    ? 'Открыть карту рисков'
                    : item.href === '/owner/recovery'
                      ? 'Открыть восстановление'
                      : 'Открыть сводку'}
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ) : tab === 'symptoms' ? (
        <Card title="Навигатор по симптомам" subtitle="Найденные симптомы и степень срочности.">
          {symptoms.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {symptoms.map((item) => (
                <article key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <div className="flex items-center gap-2">
                    {item.emergency_flag ? <span className="badge-red">RED</span> : item.severity >= 4 ? <span className="badge-yellow">Важно</span> : <span className="pill !px-3 !py-1.5">Наблюдение</span>}
                    <span className="pill !px-3 !py-1.5">{item.category}</span>
                  </div>
                  <p className="mt-3 text-lg font-bold text-lapka-900">{item.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-lapka-600">{normalizeKnowledgeText(item.description)}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Симптомы не найдены" text="Уточните запрос или используйте SOS-режим." />
          )}
        </Card>
      ) : tab === 'diseases' ? (
        <Card title="Болезни и уровни срочности" subtitle="Справочный слой с переходом в детальную карточку заболевания.">
          {diseases.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {diseases.map((item) => (
                <Link key={item.id} href={`/diseases/${item.id}`} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                  <div className="flex items-center gap-2">
                    {item.emergency_level === 'RED' ? <span className="badge-red">RED</span> : item.emergency_level === 'YELLOW' ? <span className="badge-yellow">YELLOW</span> : <span className="pill !px-3 !py-1.5">GREEN</span>}
                    <span className="pill !px-3 !py-1.5">{item.category}</span>
                  </div>
                  <p className="mt-3 text-lg font-bold text-lapka-900">{item.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-lapka-600">{normalizeKnowledgeText(item.description)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="Болезни не найдены" text="Измените запрос или откройте полный справочник." />
          )}
        </Card>
      ) : (
        <Card title="Опасные продукты и домашние риски" subtitle="Домашняя база можно/нельзя и быстрый сценарий, если питомец что-то съел.">
          {filteredDangerous.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredDangerous.map((item) => (
                <article key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <div className="flex items-center gap-2">
                    {item.severity === 'critical' ? <span className="badge-red">Критично</span> : item.severity === 'high' ? <span className="badge-yellow">Высокий риск</span> : <span className="pill !px-3 !py-1.5">Умеренный риск</span>}
                  </div>
                  <p className="mt-3 text-lg font-bold text-lapka-900">{item.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-lapka-600">{item.why}</p>
                  <p className="mt-3 text-sm font-semibold text-lapka-500">На что смотреть: {item.symptoms.join(', ')}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Продукты не найдены" text="Уточните запрос или перейдите в центр ухода." />
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/owner/home-safety" className="btn-secondary">Открыть карту рисков</Link>
            <Link href="/owner/quick-triage" className="btn-secondary">Открыть SOS-сценарий</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
