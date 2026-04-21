'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import AppImage from '@/components/ui/AppImage';
import AIWidget from '@/components/ui/AIWidget';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData, loadOwnerServicesData, loadPetHealthBundle } from '@/lib/owner-data';
import { DANGEROUS_PRODUCTS } from '@/lib/owner-experience';
import { trackOwnerFunnelStep } from '@/lib/owner-funnel';
import { EMERGENCY_SCENARIOS, formatDateTimeLabel } from '@/lib/owner-workspace';
import { localizeDocumentType, localizePetBreed, localizePetSpecies, resolvePetPhoto } from '@/lib/pets';

function levelMeta(level, isEn) {
  if (level === 'RED') {
    return {
      label: isEn ? 'RED · go to clinic now' : 'RED · срочно в клинику',
      badgeClass: 'badge-red',
      cardClass: 'border-rose-200 bg-[linear-gradient(180deg,#fff9f9_0%,#fff1f1_100%)]',
    };
  }
  if (level === 'YELLOW') {
    return {
      label: isEn ? 'YELLOW · exam needed' : 'YELLOW · нужен осмотр',
      badgeClass: 'badge-yellow',
      cardClass: 'border-amber-200 bg-[linear-gradient(180deg,#fffdf8_0%,#fff8eb_100%)]',
    };
  }
  return {
    label: isEn ? 'GREEN · monitor at home' : 'GREEN · наблюдение дома',
    badgeClass: 'pill',
    cardClass: 'border-emerald-200 bg-[linear-gradient(180deg,#f8fffb_0%,#f1fff7_100%)]',
  };
}

export default function OwnerEmergencyFlowPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const dtLocale = isEn ? 'en' : 'ru';
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') || '';
  const requestedPetId = searchParams.get('pet') || '';
  const requestedScenario = searchParams.get('scenario') || (mode === 'sos' ? 'poisoning' : 'poisoning');

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

  useEffect(() => {
    trackOwnerFunnelStep('triage_open', { source: mode === 'sos' ? 'sos_button' : 'triage_page' });
  }, [mode]);

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
      setError(requestError.message || (isEn ? 'Failed to open SOS mode' : 'Не удалось открыть SOS-режим'));
      setPets([]);
      setAppointments([]);
      setReminders([]);
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }, [isEn, requestedPetId]);

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
      setError(requestError.message || (isEn ? 'Failed to load pet card for SOS scenario' : 'Не удалось загрузить карту питомца для SOS-сценария'));
      setVisits([]);
      setDocuments([]);
      setPrescriptions([]);
      setVaccines([]);
    } finally {
      setPetLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    const fromUrl = searchParams.get('scenario');
    if (!fromUrl) return;
    if (EMERGENCY_SCENARIOS.some((s) => s.id === fromUrl)) {
      setScenarioId(fromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedPetId) {
      loadPetBundle(selectedPetId);
    }
  }, [loadPetBundle, selectedPetId]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const selectedScenario = useMemo(() => EMERGENCY_SCENARIOS.find((item) => item.id === scenarioId) || EMERGENCY_SCENARIOS[0], [scenarioId]);
  const scenarioMeta = useMemo(() => levelMeta(selectedScenario?.level, isEn), [isEn, selectedScenario]);

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
    if (selectedScenario.id === 'poisoning' && !q) {
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
      selectedPet?.chip_id ? `${isEn ? 'Chip' : 'Чип'}: ${selectedPet.chip_id}` : (isEn ? 'Chip is not set' : 'Чип не указан'),
      selectedPet?.passport_id ? `${isEn ? 'Passport' : 'Паспорт'}: ${selectedPet.passport_id}` : (isEn ? 'Passport is not set' : 'Паспорт не указан'),
      nextMedication ? `${isEn ? 'Next medication' : 'Следующее лекарство'}: ${nextMedication.title || nextMedication.notes || (isEn ? 'on schedule' : 'по графику')} · ${formatDateTimeLabel(nextMedication.due_at, dtLocale)}` : (isEn ? 'No active medication reminders found' : 'Активные лекарственные напоминания не найдены'),
      documents[0] ? `${isEn ? 'Latest document' : 'Последний документ'}: ${localizeDocumentType(documents[0].doc_type, isEn ? 'en' : 'ru')} · ${formatDateTimeLabel(documents[0].created_at, dtLocale)}` : (isEn ? 'No recent documents found' : 'Последние документы не найдены'),
      nextAppointment ? `${isEn ? 'Next visit' : 'Следующий визит'}: ${formatDateTimeLabel(nextAppointment.scheduled_at, dtLocale)}` : (isEn ? 'No next visit scheduled' : 'Следующий визит не назначен'),
      vaccines[0]?.vaccine_name ? `${isEn ? 'Latest vaccination' : 'Последняя вакцинация'}: ${vaccines[0].vaccine_name}` : (isEn ? 'No vaccinations found in this selection' : 'Вакцинации в этой выборке не найдены'),
    ];
  }, [documents, dtLocale, isEn, nextAppointment, nextMedication, selectedPet?.chip_id, selectedPet?.passport_id, vaccines]);

  return (
    <div className="min-w-0 space-y-6 md:space-y-7">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">{isEn ? 'SOS and urgent scenarios' : 'SOS и срочные сценарии'}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
            {isEn ? 'Step-by-step SOS mode for owners' : 'Пошаговый SOS-режим для владельца'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            {isEn
              ? 'Not just triage, but a ready flow: urgency signs, immediate actions, what not to do, what to pack, and where to go.'
              : 'Не просто триаж, а готовый режим: признаки срочности, что сделать сразу, чего не делать, что взять с собой и куда ехать.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/owner/quick-triage"
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {isEn ? 'Quick hub' : 'Быстрый центр'}
          </Link>
          <Link href="/owner/dashboard" className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {isEn ? 'Dashboard' : 'Дашборд'}
          </Link>
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
        <EmptyState title={isEn ? 'Add a pet first' : 'Сначала добавьте питомца'} text={isEn ? 'SOS scenario uses the active pet profile, medications and documents.' : 'SOS-сценарий опирается на активного питомца, его карту, лекарства и документы.'} />
      ) : (
        <>
          <section
            className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${
              selectedScenario.level === 'RED'
                ? 'border-l-4 border-l-rose-500'
                : selectedScenario.level === 'YELLOW'
                  ? 'border-l-4 border-l-amber-400'
                  : 'border-l-4 border-l-emerald-500'
            }`}
          >
            <div className="grid min-w-0 gap-0 border-b border-slate-100 lg:grid-cols-[1fr_min(340px,100%)]">
              <div className="space-y-5 p-6 sm:p-8">
                <div className="flex flex-wrap gap-2">
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      type="button"
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        pet.id === selectedPetId ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      onClick={() => setSelectedPetId(pet.id)}
                    >
                      {pet.name}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={scenarioMeta.badgeClass}>{scenarioMeta.label}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                      {localizePetSpecies(selectedPet.species, isEn ? 'en' : 'ru')} · {localizePetBreed(selectedPet.breed, isEn ? 'en' : 'ru')}
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-slate-900 sm:text-2xl">{selectedPet.name}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                    {isEn
                      ? `Scenario “${selectedScenario.title}” is built around this pet: urgent steps, clinics, documents and medications in one view.`
                      : `Сценарий «${selectedScenario.title.toLowerCase()}» собран вокруг этого питомца: шаги, клиники, документы и лекарства в одном экране.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/owner/pet/${selectedPet.id}/passport`}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    {isEn ? 'Pet passport' : 'Паспорт питомца'}
                  </Link>
                  <Link
                    href={`/owner/medications?pet=${selectedPet.id}`}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {isEn ? 'Medications' : 'Лекарства'}
                  </Link>
                  <Link href="/owner/map" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {isEn ? 'Clinics & map' : 'Клиники и карта'}
                  </Link>
                </div>
              </div>
              <div className="border-t border-slate-200 bg-slate-50/60 p-6 sm:p-8 lg:border-l lg:border-t-0">
                <AppImage
                  src={resolvePetPhoto(selectedPet)}
                  alt={selectedPet.name}
                  width={900}
                  height={900}
                  sizes="340px"
                  className="h-[240px] w-full rounded-xl border border-slate-200 object-cover sm:h-[280px]"
                />
                <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{isEn ? 'Trip card' : 'Карточка для выезда'}</p>
                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    {isEn
                      ? 'Chip, documents, meds and next steps stay visible so you do not jump between tabs.'
                      : 'Чип, документы, лекарства и шаги рядом — без прыжков по разделам.'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: isEn ? 'Scenario' : 'Сценарий',
                sub: isEn ? 'Urgency level' : 'Уровень срочности',
                val: selectedScenario.level,
                hint: selectedScenario.title,
              },
              {
                title: isEn ? 'Clinics' : 'Клиники',
                sub: isEn ? 'In your list' : 'В списке',
                val: String(nearbyClinics.length),
                hint: `${nearbyClinics.filter((item) => item.emergency_available).length} ${isEn ? 'with emergency' : 'с экстренным приёмом'}`,
              },
              {
                title: isEn ? 'Medications' : 'Лекарства',
                sub: isEn ? 'Active in profile' : 'Активные в профиле',
                val: String(prescriptions.length),
                hint: nextMedication ? formatDateTimeLabel(nextMedication.due_at, dtLocale) : isEn ? 'No next dose' : 'Доза не найдена',
              },
              {
                title: isEn ? 'Documents' : 'Документы',
                sub: isEn ? 'In archive' : 'В архиве',
                val: String(documents.length),
                hint: documents[0] ? localizeDocumentType(documents[0].doc_type, isEn ? 'en' : 'ru') : isEn ? 'Empty' : 'Пусто',
              },
            ].map((box) => (
              <div key={box.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{box.title}</p>
                <p className="mt-1 text-xs text-slate-500">{box.sub}</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">{box.val}</p>
                <p className="mt-2 text-sm text-slate-600">{box.hint}</p>
              </div>
            ))}
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.04fr_0.96fr]">
            <div className="space-y-5">
              <Card
                className="border-slate-200"
                title={isEn ? 'Choose scenario' : 'Выберите сценарий'}
                subtitle={isEn ? 'Pick what matches the situation — you can switch anytime.' : 'Выберите то, что ближе к ситуации — можно переключить в любой момент.'}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {EMERGENCY_SCENARIOS.map((scenario) => {
                    const meta = levelMeta(scenario.level, isEn);
                    const active = scenario.id === selectedScenario.id;
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          active ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900 ring-offset-2' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                        }`}
                        onClick={() => setScenarioId(scenario.id)}
                      >
                        <span className={meta.badgeClass}>{meta.label}</span>
                        <p className="mt-3 text-base font-semibold text-slate-900 sm:text-lg">{scenario.title}</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                          {scenario.level === 'RED'
                            ? (isEn ? 'Prepare for clinic visit and gather documents.' : 'Готовьтесь к визиту в клинику и соберите документы.')
                            : (isEn ? 'Collect observations and decide if an urgent exam is needed.' : 'Соберите наблюдения и решите, нужен ли срочный осмотр.')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card
                className="border-slate-200"
                title={isEn ? 'What to do right now' : 'Что сделать прямо сейчас'}
                subtitle={isEn ? 'Short checklist — no self-medication; call your clinic when in doubt.' : 'Короткий чеклист — без самолечения; при сомнениях звоните в клинику.'}
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{isEn ? 'Do now' : 'Сделать сразу'}</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700 sm:text-base">
                      {selectedScenario.immediate.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">{isEn ? "Don't" : 'Чего не делать'}</p>
                    <ul className="mt-3 space-y-2 text-sm text-rose-900 sm:text-base">
                      {selectedScenario.avoid.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{isEn ? 'Bring with you' : 'Взять с собой'}</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700 sm:text-base">
                      {emergencyBag.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>

              <Card
                className="border-slate-200"
                title={isEn ? 'Symptom urgency check' : 'Оценка срочности по симптомам'}
                subtitle={isEn ? 'AI returns only urgency level and safe next steps.' : 'AI возвращает только уровень срочности и безопасные шаги.'}
              >
                <AIWidget title={isEn ? 'Describe symptoms or pick from list' : 'Опишите симптомы или выберите их из списка'} subtitle={isEn ? 'System returns only GREEN / YELLOW / RED, red flags, and safe follow-up actions.' : 'Система вернёт только GREEN / YELLOW / RED, красные флаги и безопасные дальнейшие действия.'} mode="owner" />
              </Card>
            </div>

            <div className="space-y-5">
              <Card
                className="border-slate-200"
                title={isEn ? 'Pet card for the visit' : 'Карта питомца для визита'}
                subtitle={isEn ? 'Snapshot before you leave — no tab switching.' : 'Сводка перед выездом — без переключения вкладок.'}
              >
                {petLoading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : (
                  <div className="space-y-3">
                    {petSnapshot.map((item) => (
                      <div key={item} className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card
                className="border-slate-200"
                title={isEn ? 'Nearest clinics' : 'Ближайшие клиники'}
                subtitle={isEn ? 'Quick links to your saved clinics.' : 'Быстрые ссылки на ваши клиники.'}
              >
                {nearbyClinics.length ? (
                  <div className="space-y-3">
                    {nearbyClinics.map((clinic) => (
                      <Link
                        key={clinic.id}
                        href={`/owner/clinic/${clinic.id}`}
                        className="block rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 sm:text-base">{clinic.name}</p>
                            <p className="mt-1 text-xs text-slate-500 sm:text-sm">{[clinic.city, clinic.address].filter(Boolean).join(' · ')}</p>
                          </div>
                          {clinic.emergency_available ? (
                            <span className="badge-red">{isEn ? 'Emergency' : 'Экстренно'}</span>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {isEn ? 'Planned' : 'Планово'}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                    <Link href="/owner/map" className="flex w-full items-center justify-center rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      {isEn ? 'Open map' : 'Открыть карту'}
                    </Link>
                  </div>
                ) : (
                  <EmptyState title={isEn ? 'No clinics found' : 'Клиники не найдены'} text={isEn ? 'Check the map or try service hub again later.' : 'Проверьте карту или попробуйте открыть сервисный центр позже.'} />
                )}
              </Card>

              <Card
                className="border-slate-200"
                title={isEn ? 'If your pet ate something' : 'Если питомец что-то съел'}
                subtitle={isEn ? 'Search common risky products (reference only).' : 'Поиск по типичным опасным продуктам (справочно).'}
              >
                <SearchInput label={isEn ? 'Search products' : 'Поиск по продуктам'} placeholder={isEn ? 'chocolate, xylitol, grapes, onion...' : 'шоколад, ксилит, виноград, лук…'} value={dangerQuery} onChange={(event) => setDangerQuery(event.target.value)} />
                {dangerMatches.length ? (
                  <div className="mt-4 space-y-3">
                    {dangerMatches.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={item.severity === 'critical' ? 'badge-red' : item.severity === 'high' ? 'badge-yellow' : 'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600'}>
                            {item.severity === 'critical' ? (isEn ? 'Critical' : 'Критично') : item.severity === 'high' ? (isEn ? 'High risk' : 'Высокий риск') : (isEn ? 'Moderate' : 'Умеренно')}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">{item.category}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900 sm:text-base">{item.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{item.why}</p>
                        <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                          {isEn ? 'Watch for:' : 'На что смотреть:'} {item.symptoms.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">{isEn ? 'No product found for this query. If situation seems dangerous, open clinic map and bring latest documents.' : 'По этому запросу продукт не найден. Если ситуация кажется опасной, открывайте карту клиник и берите последние документы с собой.'}</p>
                )}
              </Card>
            </div>
          </section>

          <section className="grid items-start gap-5 lg:grid-cols-2">
            <Card
              className="border-slate-200"
              title={isEn ? 'Red flags — do not wait' : 'Красные флаги — не ждать'}
              subtitle={isEn ? 'Go to a clinic or emergency service immediately.' : 'Сразу обращайтесь в клинику или экстренную службу.'}
            >
              <div className="flex flex-wrap gap-2">
                {(isEn
                  ? [
                    'Seizures or loss of consciousness',
                    'Severe breathing issues or cyanosis',
                    'Heavy bleeding',
                    'Suspected poisoning',
                    'Temperature above 41°C',
                    'Severe pain or trauma',
                  ]
                  : [
                    'Судороги или потеря сознания',
                    'Тяжёлое дыхание или синюшность',
                    'Сильное кровотечение',
                    'Подозрение на отравление',
                    'Температура выше 41°C',
                    'Сильная боль или травма',
                  ]).map((item) => (
                  <span key={item} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-900 sm:text-sm">
                    {item}
                  </span>
                ))}
              </div>
            </Card>
            <Card
              className="border-slate-200"
              title={isEn ? 'Next steps in Lapka' : 'Дальше в Lapka'}
              subtitle={isEn ? 'After you stabilise the situation.' : 'Когда ситуация под контролем.'}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <Link
                  href="/owner/timeline"
                  className="flex min-h-[72px] flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{isEn ? 'Timeline' : 'Лента здоровья'}</p>
                  <p className="mt-1 text-xs text-slate-500">{isEn ? 'Visits, meds, documents' : 'Визиты, лекарства, документы'}</p>
                </Link>
                <Link
                  href="/owner/medications"
                  className="flex min-h-[72px] flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{isEn ? 'Medications' : 'Лекарства'}</p>
                  <p className="mt-1 text-xs text-slate-500">{isEn ? 'Doses and refills' : 'Дозы и продления'}</p>
                </Link>
                <Link
                  href="/owner/documents"
                  className="flex min-h-[72px] flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{isEn ? 'Documents' : 'Документы'}</p>
                  <p className="mt-1 text-xs text-slate-500">{isEn ? 'Labs and images' : 'Анализы и снимки'}</p>
                </Link>
                <Link
                  href="/owner/map"
                  className="flex min-h-[72px] flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{isEn ? 'Clinics' : 'Клиники'}</p>
                  <p className="mt-1 text-xs text-slate-500">{isEn ? 'Map and booking' : 'Карта и запись'}</p>
                </Link>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
