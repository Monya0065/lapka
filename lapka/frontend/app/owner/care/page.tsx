'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import { apiRequest } from '@/lib/api';
import { CARE_FAQ, CARE_GUIDES, DANGEROUS_PRODUCTS, MEAL_TYPES, VET_DISCUSSION_TOPICS, severityMeta } from '@/lib/owner-experience';
import { buildPersonalCarePlan } from '@/lib/owner-workspace';
import { localizePetSpecies } from '@/lib/pets';

const STORAGE_KEY = 'lapka.owner.nutrition.v1';
const TABS = [
  { id: 'overview', label: 'План ухода' },
  { id: 'nutrition', label: 'Рацион и вес' },
  { id: 'food-safety', label: 'Можно / нельзя' },
  { id: 'guides', label: 'Гайды и FAQ' },
];

function readEntries() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function OwnerCareHubPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'overview';
  const [tab, setTab] = useState(initialTab);
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [reminders, setReminders] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [foodQuery, setFoodQuery] = useState(searchParams.get('query') || '');
  const [guideFilter, setGuideFilter] = useState('все');
  const [nutritionForm, setNutritionForm] = useState({
    mealType: 'breakfast',
    foodName: '',
    portionGrams: '',
    weightKg: '',
    note: '',
    loggedAt: new Date().toISOString().slice(0, 16),
  });

  const loadHub = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [petsPayload, remindersPayload] = await Promise.all([
        apiRequest('/api/v1/pets'),
        apiRequest('/api/v1/reminders?upcoming_days=90&limit=200'),
      ]);
      const petRows = Array.isArray(petsPayload) ? petsPayload : [];
      setPets(petRows);
      setSelectedPetId((current) => current && petRows.some((item) => item.id === current) ? current : (petRows[0]?.id || ''));
      setReminders(Array.isArray(remindersPayload) ? remindersPayload : []);
      setEntries(readEntries());
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить центр ухода');
      setPets([]);
      setReminders([]);
      setEntries(readEntries());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const carePlan = useMemo(() => buildPersonalCarePlan({ pet: selectedPet, reminders: reminders.filter((item) => item.pet_id === selectedPetId), timeline: [] }), [reminders, selectedPet, selectedPetId]);

  const nutritionEntries = useMemo(
    () => entries.filter((entry) => !selectedPetId || entry.petId === selectedPetId).sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt)),
    [entries, selectedPetId]
  );

  const filteredGuides = useMemo(() => {
    if (guideFilter === 'все') return CARE_GUIDES;
    return CARE_GUIDES.filter((item) => item.category === guideFilter);
  }, [guideFilter]);

  const filteredFood = useMemo(() => {
    const q = foodQuery.trim().toLowerCase();
    return DANGEROUS_PRODUCTS.filter((item) => !q || [item.name, item.category, item.why, item.safeAlternative].join(' ').toLowerCase().includes(q));
  }, [foodQuery]);

  function switchTab(nextTab) {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    router.replace(`/owner/care?${params.toString()}`);
  }

  function updateNutritionForm(key, value) {
    setNutritionForm((current) => ({ ...current, [key]: value }));
  }

  function saveNutritionEntry(event) {
    event.preventDefault();
    if (!selectedPetId || !nutritionForm.foodName.trim()) {
      setError('Выберите питомца и укажите рацион.');
      return;
    }
    const next = [
      {
        id: `nutrition_${Date.now()}`,
        petId: selectedPetId,
        ...nutritionForm,
      },
      ...entries,
    ];
    setEntries(next);
    writeEntries(next);
    setNutritionForm((current) => ({ ...current, foodName: '', portionGrams: '', weightKg: '', note: '' }));
    setError('');
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Уход и питание</p>
          <h1 className="page-title">Уход и питание без разрозненных разделов</h1>
          <p className="page-subtitle">Рацион, нормы, опасные продукты, ежедневный уход, FAQ и подготовка вопросов врачу собраны в один логичный центр.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/owner/passport-center" className="btn-secondary">Паспорт питомца</Link>
          <Link href="/owner/recovery" className="btn-secondary">Режим восстановления</Link>
          <Link href="/owner/home-safety" className="btn-secondary">Домашняя безопасность</Link>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadHub} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[520px] w-full" />
        </section>
      ) : (
        <>
          <Card>
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Активный питомец</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pets.map((pet) => (
                    <button key={pet.id} type="button" className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId(pet.id)}>{pet.name}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {TABS.map((item) => (
                  <button key={item.id} type="button" className={tab === item.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => switchTab(item.id)}>{item.label}</button>
                ))}
              </div>
            </div>
          </Card>

          {tab === 'overview' ? (
            <>
              <section className="kpi-grid">
                <StatsCard label="Сегодня" value={carePlan.today.length.toString()} />
                <StatsCard label="Неделя" value={carePlan.week.length.toString()} />
                <StatsCard label="Рацион" value={`${nutritionEntries.length} записей`} />
                <StatsCard label="Опасные продукты" value={String(DANGEROUS_PRODUCTS.length)} />
              </section>
              <section className="grid items-start gap-5 2xl:grid-cols-[1.06fr_0.94fr]">
                <Card title="Персональный план ухода" subtitle="То, что стоит сделать сегодня, на неделе и в месяце именно для выбранного питомца.">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Сегодня</p>
                      <ul className="mt-3 space-y-2 text-base text-lapka-700">{carePlan.today.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                    <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Неделя</p>
                      <ul className="mt-3 space-y-2 text-base text-lapka-700">{carePlan.week.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                    <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Месяц</p>
                      <ul className="mt-3 space-y-2 text-base text-lapka-700">{carePlan.month.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                  </div>
                </Card>
                <Card title="Как теперь собран маршрут владельца" subtitle="Рацион, безопасные продукты и повседневный уход больше не разбросаны по разным разделам первого уровня.">
                  <div className="space-y-3 text-base text-lapka-700">
                    <p>• Рацион и вес</p>
                    <p>• Что можно / нельзя</p>
                    <p>• Опасные продукты</p>
                    <p>• Уход по возрасту, шерсти и сезону</p>
                    <p>• Вопросы, которые стоит обсудить с врачом</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href="/owner/breed-id" className="btn-secondary">Определить породу по фото</Link>
                    <Link href="/owner/timeline" className="btn-secondary">Открыть ленту здоровья</Link>
                  </div>
                </Card>
              </section>
              <section className="grid items-start gap-4 2xl:grid-cols-4">
                {[
                  { title: 'Режим восстановления', text: 'Отдельный сценарий после процедуры или операции.', href: '/owner/recovery' },
                  { title: 'Поведение и привычки', text: 'Привычный ритм, стрессовые триггеры и мягкие изменения.', href: '/owner/behavior' },
                  { title: 'Поездка с питомцем', text: 'Документы, дорога, переноска и клиники по маршруту.', href: '/owner/travel' },
                  { title: 'Домашняя безопасность', text: 'Токсичные продукты, бытовая химия и лекарства человека.', href: '/owner/home-safety' },
                ].map((item) => (
                  <Card key={item.href}>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Сценарий жизни</p>
                    <h3 className="mt-3 text-[1.55rem] font-black tracking-tight text-lapka-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-lapka-600">{item.text}</p>
                    <Link href={item.href} className="mt-4 btn-secondary">
                      {item.href === '/owner/recovery'
                        ? 'Открыть восстановление'
                        : item.href === '/owner/behavior'
                          ? 'Открыть поведение'
                          : item.href === '/owner/travel'
                            ? 'Открыть поездку'
                            : 'Открыть карту безопасности'}
                    </Link>
                  </Card>
                ))}
              </section>
            </>
          ) : null}

          {tab === 'nutrition' ? (
            <section className="grid items-start gap-5 2xl:grid-cols-[1fr_0.95fr]">
              <Card title="Дневник питания и веса" subtitle="Локальный журнал кормлений, массы и реакции на рацион — без скачков между разными разделами.">
                <form className="grid gap-3 md:grid-cols-2" onSubmit={saveNutritionEntry}>
                  <label className="block">
                    <span className="label">Тип кормления</span>
                    <select className="input" value={nutritionForm.mealType} onChange={(event) => updateNutritionForm('mealType', event.target.value)}>
                      {MEAL_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Дата и время</span>
                    <input className="input" type="datetime-local" value={nutritionForm.loggedAt} onChange={(event) => updateNutritionForm('loggedAt', event.target.value)} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="label">Рацион</span>
                    <input className="input" value={nutritionForm.foodName} onChange={(event) => updateNutritionForm('foodName', event.target.value)} placeholder="Корм, лечебная диета, домашний рацион…" />
                  </label>
                  <label className="block">
                    <span className="label">Порция, г</span>
                    <input className="input" type="number" min="0" value={nutritionForm.portionGrams} onChange={(event) => updateNutritionForm('portionGrams', event.target.value)} />
                  </label>
                  <label className="block">
                    <span className="label">Вес, кг</span>
                    <input className="input" type="number" step="0.1" min="0" value={nutritionForm.weightKg} onChange={(event) => updateNutritionForm('weightKg', event.target.value)} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="label">Наблюдение</span>
                    <textarea className="input min-h-[120px]" value={nutritionForm.note} onChange={(event) => updateNutritionForm('note', event.target.value)} placeholder="Аппетит, переносимость, жажда, реакция на новый корм…" />
                  </label>
                  <div className="md:col-span-2">
                    <button className="btn-primary" type="submit">Сохранить запись</button>
                  </div>
                </form>
              </Card>
              <Card title="Последние записи" subtitle="Один взгляд на рацион и динамику без отдельного приложения или заметок.">
                {nutritionEntries.length ? (
                  <div className="space-y-3">
                    {nutritionEntries.slice(0, 8).map((entry) => (
                      <div key={entry.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                        <p className="text-lg font-bold text-lapka-900">{entry.foodName}</p>
                        <p className="mt-1 text-sm text-lapka-600">{new Date(entry.loggedAt).toLocaleString('ru-RU')} · {entry.portionGrams ? `${entry.portionGrams} г` : 'порция не указана'}</p>
                        {entry.note ? <p className="mt-2 text-sm text-lapka-600">{entry.note}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Записей пока нет" text="После первой записи Lapka начнёт собирать историю рациона и веса." />
                )}
              </Card>
            </section>
          ) : null}

          {tab === 'food-safety' ? (
            <section className="space-y-5">
              <Card title="Можно / нельзя" subtitle="Проверка продукта до того, как он попадёт в миску или окажется на полу.">
                <SearchInput label="Поиск продукта" placeholder="шоколад, виноград, ксилит, лук…" value={foodQuery} onChange={(event) => setFoodQuery(event.target.value)} />
              </Card>
              {filteredFood.length ? (
                <section className="grid items-start gap-3 2xl:grid-cols-2">
                  {filteredFood.map((item) => {
                    const meta = severityMeta(item.severity);
                    return (
                      <Card key={item.id} title={item.name} subtitle={`${item.category} · ${item.species.map((entry) => localizePetSpecies(entry, 'ru')).join(', ')}`}>
                        <div className="flex flex-wrap gap-2">
                          <span className={meta.className}>{meta.label}</span>
                          <span className="pill !px-3 !py-1.5">Если съел — откройте SOS-режим</span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-lapka-600">{item.why}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">На что смотреть</p>
                            <ul className="mt-2 space-y-2 text-sm text-lapka-700">{item.symptoms.map((symptom) => <li key={symptom}>• {symptom}</li>)}</ul>
                          </div>
                          <div className="rounded-[22px] border border-lapka-200 bg-lapka-50/70 px-4 py-4">
                            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Безопасная альтернатива</p>
                            <p className="mt-2 text-sm text-lapka-700">{item.safeAlternative}</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </section>
              ) : <EmptyState title="Продукт не найден" text="Попробуйте другой запрос или откройте SOS-режим." />}
            </section>
          ) : null}

          {tab === 'guides' ? (
            <section className="grid items-start gap-5 2xl:grid-cols-[1.02fr_0.98fr]">
              <Card title="Гайды по уходу" subtitle="Короткие практические сценарии без назначения лечения.">
                <div className="mb-3 flex flex-wrap gap-2">
                  {['все', 'питание', 'прогулки', 'дом', 'поведение'].map((item) => (
                    <button key={item} type="button" className={guideFilter === item ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setGuideFilter(item)}>{item}</button>
                  ))}
                </div>
                <div className="space-y-3">
                  {filteredGuides.map((guide) => (
                    <article key={guide.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                      <p className="text-lg font-bold text-lapka-900">{guide.title}</p>
                      <p className="mt-1 text-sm text-lapka-600">{guide.summary}</p>
                      <ul className="mt-3 space-y-2 text-sm text-lapka-700">{guide.checklist.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </article>
                  ))}
                </div>
              </Card>
              <div className="space-y-4">
                <Card title="FAQ владельца" subtitle="Короткие ответы на повторяющиеся вопросы.">
                  <div className="space-y-2">
                    {CARE_FAQ.map((item) => (
                      <details key={item.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                        <summary className="cursor-pointer list-none text-base font-bold text-lapka-900">{item.question}</summary>
                        <p className="mt-2 text-sm leading-relaxed text-lapka-600">{item.answer}</p>
                      </details>
                    ))}
                  </div>
                </Card>
                <Card title="Что обсудить с врачом" subtitle="Список вопросов перед визитом или телемедициной.">
                  <ul className="space-y-2 text-sm text-lapka-700">{VET_DISCUSSION_TOPICS.map((item) => <li key={item} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-3">{item}</li>)}</ul>
                  <div className="mt-4 rounded-[24px] border border-cyan-200 bg-cyan-50 px-4 py-4 text-sm text-cyan-800">
                    Эти вопросы нужны, чтобы собрать наблюдения владельца. Решения по диагностике и лечению принимает ветеринарный врач.
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Link href="/owner/recovery" className="btn-secondary">После процедуры</Link>
                    <Link href="/owner/travel" className="btn-secondary">В дорогу</Link>
                  </div>
                </Card>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
