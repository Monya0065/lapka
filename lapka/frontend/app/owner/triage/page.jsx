'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import AIWidget from '@/components/ui/AIWidget';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadOwnerServicesData, loadPetHealthBundle } from '@/lib/owner-data';
import { DANGEROUS_PRODUCTS } from '@/lib/owner-experience';
import { EMERGENCY_SCENARIOS, formatDateTimeLabel } from '@/lib/owner-workspace';
import { localizeDocumentType, localizePetBreed, localizePetSpecies, resolvePetPhoto } from '@/lib/pets';

const RED_FLAGS = [
  'Судороги или потеря сознания',
  'Тяжёлое дыхание или синюшность',
  'Сильное кровотечение',
  'Подозрение на отравление',
  'Температура выше 41°C',
  'Сильная боль или травма',
];

function levelMeta(level) {
  if (level === 'RED') {
    return {
      label: 'RED · срочно в клинику',
      badgeClass: 'badge-red',
      cardClass: 'border-rose-200 bg-[linear-gradient(180deg,#fff9f9_0%,#fff1f1_100%)]',
    };
  }
  if (level === 'YELLOW') {
    return {
      label: 'YELLOW · нужен осмотр',
      badgeClass: 'badge-yellow',
      cardClass: 'border-amber-200 bg-[linear-gradient(180deg,#fffdf8_0%,#fff8eb_100%)]',
    };
  }
  return {
    label: 'GREEN · наблюдение дома',
    badgeClass: 'pill',
    cardClass: 'border-emerald-200 bg-[linear-gradient(180deg,#f8fffb_0%,#f1fff7_100%)]',
  };
}

export default function OwnerEmergencyFlowPage() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || '';
  const requestedPetId = searchParams.get('pet') || '';
  const requestedScenario = searchParams.get('scenario') || (mode === 'sos' ? 'poison' : 'vomit');

  const [loading, setLoading] = useState(true);
  const [petLoading, setPetLoading] = useState(false);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [scenarioId, setScenarioId] = useState(requestedScenario);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [dangerQuery, setDangerQuery] = useState('');

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [base, services] = await Promise.all([loadOwnerBaseData(), loadOwnerServicesData()]);
      setPets(base.pets || []);
      setAppointments(base.appointments || []);
      setReminders(base.reminders || []);
      setClinics(services.clinics || []);
      const fallbackPet = base.pets.find((item) => item.id === requestedPetId)?.id || base.pets[0]?.id || '';
      setSelectedPetId((current) => current || fallbackPet);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось открыть SOS-режим');
      setPets([]);
      setAppointments([]);
      setReminders([]);
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }, [requestedPetId]);

  const loadPetBundle = useCallback(async (petId) => {
    if (!petId) {
      setVisits([]);
      setDocuments([]);
      setPrescriptions([]);
      setVaccines([]);
      return;
    }
    setPetLoading(true);
    try {
      const bundle = await loadPetHealthBundle(petId);
      setVisits(bundle.visits || []);
      setDocuments(bundle.documents || []);
      setPrescriptions(bundle.prescriptions || []);
      setVaccines(bundle.vaccines || []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить карту питомца для SOS-сценария');
      setVisits([]);
      setDocuments([]);
      setPrescriptions([]);
      setVaccines([]);
    } finally {
      setPetLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (selectedPetId) {
      loadPetBundle(selectedPetId);
    }
  }, [loadPetBundle, selectedPetId]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const selectedScenario = useMemo(() => EMERGENCY_SCENARIOS.find((item) => item.id === scenarioId) || EMERGENCY_SCENARIOS[0], [scenarioId]);
  const scenarioMeta = useMemo(() => levelMeta(selectedScenario?.level), [selectedScenario]);

  const nearbyClinics = useMemo(() => {
    return [...clinics]
      .sort((a, b) => Number(Boolean(b.emergency_available)) - Number(Boolean(a.emergency_available)))
      .slice(0, 4);
  }, [clinics]);

  const petAppointments = useMemo(() => appointments.filter((item) => item.pet_id === selectedPetId), [appointments, selectedPetId]);
  const nextAppointment = useMemo(
    () => [...petAppointments].filter((item) => new Date(item.scheduled_at).getTime() >= Date.now()).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0] || null,
    [petAppointments]
  );

  const medicationReminders = useMemo(
    () => reminders.filter((item) => item.pet_id === selectedPetId && String(item.reminder_type || '').toLowerCase() === 'medication'),
    [reminders, selectedPetId]
  );

  const nextMedication = useMemo(
    () => [...medicationReminders].sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0] || null,
    [medicationReminders]
  );

  const dangerMatches = useMemo(() => {
    const q = String(dangerQuery || '').trim().toLowerCase();
    const base = DANGEROUS_PRODUCTS.filter((item) => !q || [item.name, item.category, item.why, item.safeAlternative].join(' ').toLowerCase().includes(q));
    if (selectedScenario.id === 'poison' && !q) {
      return [...base].sort((a, b) => {
        const rank = { critical: 0, high: 1, moderate: 2 };
        return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
      }).slice(0, 6);
    }
    return base.slice(0, 6);
  }, [dangerQuery, selectedScenario.id]);

  const emergencyBag = useMemo(() => {
    const items = [...(selectedScenario?.pack || [])];
    if (selectedPet?.chip_id) items.push(`Чип: ${selectedPet.chip_id}`);
    if (selectedPet?.passport_id) items.push(`Паспорт: ${selectedPet.passport_id}`);
    if (prescriptions.length) items.push('Список активных лекарств и назначений');
    if (documents.length) items.push('Последние анализы, выписки и изображения');
    if (visits.length) items.push('Краткая история последних визитов');
    return Array.from(new Set(items));
  }, [documents.length, prescriptions.length, selectedPet?.chip_id, selectedPet?.passport_id, selectedScenario, visits.length]);

  const petSnapshot = useMemo(() => {
    return [
      selectedPet?.chip_id ? `Чип: ${selectedPet.chip_id}` : 'Чип не указан',
      selectedPet?.passport_id ? `Паспорт: ${selectedPet.passport_id}` : 'Паспорт не указан',
      nextMedication ? `Следующее лекарство: ${nextMedication.title || nextMedication.notes || 'по графику'} · ${formatDateTimeLabel(nextMedication.due_at)}` : 'Активные лекарственные напоминания не найдены',
      documents[0] ? `Последний документ: ${localizeDocumentType(documents[0].doc_type, 'ru')} · ${formatDateTimeLabel(documents[0].created_at)}` : 'Последние документы не найдены',
      nextAppointment ? `Следующий визит: ${formatDateTimeLabel(nextAppointment.scheduled_at)}` : 'Следующий визит не назначен',
      vaccines[0]?.vaccine_name ? `Последняя вакцинация: ${vaccines[0].vaccine_name}` : 'Вакцинации в этой выборке не найдены',
    ];
  }, [documents, nextAppointment, nextMedication, selectedPet?.chip_id, selectedPet?.passport_id, vaccines]);

  return (
    <div className="space-y-7">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-500">SOS и срочные сценарии</p>
          <h1 className="page-title">Пошаговый SOS-режим для владельца</h1>
          <p className="page-subtitle">Не просто триаж, а готовый режим: признаки срочности, что сделать сразу, чего не делать, что взять с собой и куда ехать.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadBase} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-[360px] w-full" />
          <div className="grid gap-4 lg:grid-cols-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-[620px] w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState title="Сначала добавьте питомца" text="SOS-сценарий опирается на активного питомца, его карту, лекарства и документы." />
      ) : (
        <>
          <Card className={`overflow-hidden ${scenarioMeta.cardClass}`}>
            <div className="grid gap-5 lg:grid-cols-[1.06fr_340px] lg:items-center">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      type="button"
                      className={pet.id === selectedPetId ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'}
                      onClick={() => setSelectedPetId(pet.id)}
                    >
                      {pet.name}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={scenarioMeta.badgeClass}>{scenarioMeta.label}</span>
                    <span className="pill !px-3 !py-1.5">{localizePetSpecies(selectedPet.species, 'ru')} · {localizePetBreed(selectedPet.breed, 'ru')}</span>
                  </div>
                  <h2 className="mt-4 text-[2.7rem] font-black tracking-tight text-lapka-950 md:text-[3.45rem]">{selectedPet.name}</h2>
                  <p className="mt-3 max-w-3xl text-xl leading-relaxed text-lapka-700">
                    Сценарий «{selectedScenario.title.toLowerCase()}» собран вокруг активного питомца: сразу видны критические шаги, ближайшие клиники, документы и активные лекарства.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/owner/pet/${selectedPet.id}/passport`} className="btn-primary">Открыть паспорт питомца</Link>
                  <Link href={`/owner/medications?pet=${selectedPet.id}`} className="btn-secondary">Лекарства и назначения</Link>
                  <Link href="/owner/services" className="btn-secondary">Клиники и карта</Link>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[34px] border border-white/70 bg-white/88 p-4 shadow-soft backdrop-blur">
                <AppImage
                  src={resolvePetPhoto(selectedPet)}
                  alt={selectedPet.name}
                  width={900}
                  height={900}
                  sizes="340px"
                  className="h-[280px] w-full object-cover drop-shadow-[0_28px_44px_rgba(18,63,111,0.16)]"
                />
                <div className="rounded-[22px] border border-lapka-200 bg-lapka-50/80 px-4 py-3">
                  <p className="text-lg font-bold text-lapka-950">Карточка для выезда</p>
                  <p className="mt-1 text-sm text-lapka-600">Чип, документы, лекарства и ближайшие действия собраны рядом, чтобы не искать их в отдельных разделах.</p>
                </div>
              </div>
            </div>
          </Card>

          <section className="grid gap-4 lg:grid-cols-4">
            <Card dense title="Сценарий" subtitle="Текущий уровень срочности">
              <p className="text-[2rem] font-black tracking-tight text-lapka-950">{selectedScenario.level}</p>
              <p className="mt-2 text-sm text-lapka-600">{selectedScenario.title}</p>
            </Card>
            <Card dense title="Клиники рядом" subtitle="Что доступно сейчас">
              <p className="text-[2rem] font-black tracking-tight text-lapka-950">{nearbyClinics.length}</p>
              <p className="mt-2 text-sm text-lapka-600">{nearbyClinics.filter((item) => item.emergency_available).length} с экстренным приёмом</p>
            </Card>
            <Card dense title="Активные лекарства" subtitle="Что важно не забыть">
              <p className="text-[2rem] font-black tracking-tight text-lapka-950">{prescriptions.length}</p>
              <p className="mt-2 text-sm text-lapka-600">{nextMedication ? formatDateTimeLabel(nextMedication.due_at) : 'Следующая доза не найдена'}</p>
            </Card>
            <Card dense title="Документы" subtitle="Что уже есть в архиве">
              <p className="text-[2rem] font-black tracking-tight text-lapka-950">{documents.length}</p>
              <p className="mt-2 text-sm text-lapka-600">{documents[0] ? localizeDocumentType(documents[0].doc_type, 'ru') : 'Пока пусто'}</p>
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.04fr_0.96fr]">
            <div className="space-y-5">
              <Card title="Выберите сценарий" subtitle="Не ищите нужную страницу: SOS-режим начинается с реального вопроса владельца.">
                <div className="grid gap-3 md:grid-cols-2">
                  {EMERGENCY_SCENARIOS.map((scenario) => {
                    const meta = levelMeta(scenario.level);
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        className={`rounded-[26px] border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft ${scenario.id === selectedScenario.id ? `${meta.cardClass} border-lapka-300` : 'border-lapka-200 bg-white'}`}
                        onClick={() => setScenarioId(scenario.id)}
                      >
                        <span className={meta.badgeClass}>{meta.label}</span>
                        <p className="mt-3 text-xl font-black tracking-tight text-lapka-950">{scenario.title}</p>
                        <p className="mt-2 text-sm leading-relaxed text-lapka-600">
                          {scenario.level === 'RED' ? 'Сразу включите режим выезда и подготовьте документы.' : 'Соберите наблюдения и определите, нужен ли срочный осмотр.'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card title="Что сделать прямо сейчас" subtitle="Actionable flow на 30–60 секунд без самолечения и без потери важных деталей.">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Сделать сразу</p>
                    <ul className="mt-3 space-y-2 text-base text-lapka-700">
                      {selectedScenario.immediate.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-[24px] border border-rose-200 bg-rose-50/80 px-4 py-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-600">Чего не делать</p>
                    <ul className="mt-3 space-y-2 text-base text-rose-800">
                      {selectedScenario.avoid.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-[24px] border border-lapka-200 bg-lapka-50/80 px-4 py-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Что взять с собой</p>
                    <ul className="mt-3 space-y-2 text-base text-lapka-700">
                      {emergencyBag.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                </div>
              </Card>

              <Card title="Оценка срочности по симптомам" subtitle="Если сценарий неочевиден, используйте оценку срочности по симптомам. AI выдаёт только уровень срочности и безопасный следующий шаг.">
                <AIWidget title="Опишите симптомы или выберите их из списка" subtitle="Система вернёт только GREEN / YELLOW / RED, красные флаги и безопасные дальнейшие действия." mode="owner" />
              </Card>
            </div>

            <div className="space-y-5">
              <Card title="Карта питомца для выезда" subtitle="То, что пригодится в клинике, без переходов по десяти разным разделам.">
                {petLoading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : (
                  <div className="space-y-3">
                    {petSnapshot.map((item) => (
                      <div key={item} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-relaxed text-lapka-700">
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Ближайшие клиники" subtitle="Если нужен срочный выезд, здесь уже собраны ближайшие точки и быстрые переходы.">
                {nearbyClinics.length ? (
                  <div className="space-y-3">
                    {nearbyClinics.map((clinic) => (
                      <Link key={clinic.id} href={`/owner/clinic/${clinic.id}`} className="block rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-bold text-lapka-900">{clinic.name}</p>
                            <p className="mt-1 text-sm text-lapka-600">{[clinic.city, clinic.address].filter(Boolean).join(' · ')}</p>
                          </div>
                          {clinic.emergency_available ? <span className="badge-red">Экстренный приём</span> : <span className="pill !px-3 !py-1.5">Плановый приём</span>}
                        </div>
                      </Link>
                    ))}
                    <Link href="/owner/map" className="btn-secondary w-full">Открыть карту и все точки рядом</Link>
                  </div>
                ) : (
                  <EmptyState title="Клиники не найдены" text="Проверьте карту или попробуйте открыть сервисный центр позже." />
                )}
              </Card>

              <Card title="Если питомец что-то съел" subtitle="Проверка опасных продуктов встроена прямо в SOS-сценарий, а не вынесена в отдельный крупный раздел.">
                <SearchInput label="Поиск по продуктам" placeholder="шоколад, ксилит, виноград, лук…" value={dangerQuery} onChange={(event) => setDangerQuery(event.target.value)} />
                {dangerMatches.length ? (
                  <div className="mt-4 space-y-3">
                    {dangerMatches.map((item) => (
                      <div key={item.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={item.severity === 'critical' ? 'badge-red' : item.severity === 'high' ? 'badge-yellow' : 'pill !px-3 !py-1.5'}>
                            {item.severity === 'critical' ? 'Критично' : item.severity === 'high' ? 'Высокий риск' : 'Умеренный риск'}
                          </span>
                          <span className="pill !px-3 !py-1.5">{item.category}</span>
                        </div>
                        <p className="mt-3 text-lg font-bold text-lapka-900">{item.name}</p>
                        <p className="mt-1 text-sm leading-relaxed text-lapka-600">{item.why}</p>
                        <p className="mt-3 text-sm font-semibold text-lapka-500">На что смотреть: {item.symptoms.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-lapka-600">По этому запросу продукт не найден. Если ситуация кажется опасной, открывайте карту клиник и берите последние документы с собой.</p>
                )}
              </Card>
            </div>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.04fr_0.96fr]">
            <Card title="Красные флаги, при которых нельзя ждать" subtitle="Эти сценарии сразу переводят владельца из справочного режима в срочный.">
              <div className="flex flex-wrap gap-2">
                {RED_FLAGS.map((item) => (
                  <span key={item} className="badge-red">{item}</span>
                ))}
              </div>
            </Card>
            <Card title="Куда идти дальше после SOS-сценария" subtitle="После острой ситуации рабочее пространство не распадается на хаотичные страницы. Оно ведёт в нужный следующий раздел.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/owner/timeline" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Лента здоровья</p>
                    <p className="mt-1 text-sm text-lapka-600">Посмотреть историю визитов, лекарств, документов и симптомов.</p>
                  </div>
                </Link>
                <Link href="/owner/medications" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Центр лекарств</p>
                    <p className="mt-1 text-sm text-lapka-600">Отследить курс, следующую дозу и что нужно докупить.</p>
                  </div>
                </Link>
                <Link href="/owner/documents" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Документы</p>
                    <p className="mt-1 text-sm text-lapka-600">Открыть выписки, анализы и изображения питомца.</p>
                  </div>
                </Link>
                <Link href="/owner/services" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Клиники и сервисы</p>
                    <p className="mt-1 text-sm text-lapka-600">Карта, запись, счета и страхование в одном контуре.</p>
                  </div>
                </Link>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
