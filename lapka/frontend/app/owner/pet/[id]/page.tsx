'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import Table from '@/components/ui/Table';
import Timeline from '@/components/ui/Timeline';
import { apiRequest } from '@/lib/api';
import {
  formatPetAge,
  localizeDocumentType,
  localizePetBreed,
  localizePetSex,
  localizePetSpecies,
} from '@/lib/pets';

function formatDateTime(value, locale) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString(locale);
}

function formatDate(value, locale) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString(locale);
}

function toneForReminder(type) {
  if (type === 'vaccine') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (type === 'medication') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-cyan-50 text-cyan-700 border-cyan-200';
}

function localizeReminderType(type, isRu) {
  if (type === 'vaccine') return isRu ? 'Вакцинация' : 'Vaccination';
  if (type === 'medication') return isRu ? 'Домашний уход' : 'Home care';
  if (type === 'checkup') return isRu ? 'Контрольный визит' : 'Checkup';
  return type || '—';
}

export default function OwnerPetProfilePage() {
  const { i18n } = useTranslation();
  const params = useParams();
  const petId = useMemo(() => String(params?.id || ''), [params]);
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const locale = langCode.startsWith('ru') ? 'ru-RU' : 'en-US';
  const isRu = langCode.startsWith('ru');
  const copy = isRu
    ? {
        title: 'Профиль питомца',
        subtitle: 'Полная карточка питомца: профиль, напоминания, вакцины, документы и история визитов.',
        retry: 'Обновить данные',
        notFoundTitle: 'Питомец не найден',
        notFoundText: 'Проверьте ссылку или вернитесь к списку питомцев.',
        heroTitle: 'Карточка питомца',
        heroSubtitle: 'Единая карточка питомца для владельца, врача и клиники.',
        statusStable: 'Стабильно',
        statusInpatient: 'Стационар',
        statusControl: 'Контроль',
        birthDate: 'Дата рождения',
        sex: 'Пол',
        chip: 'Чип',
        passport: 'Паспорт',
        lapkaId: 'Lapka ID',
        createdAt: 'Создан в системе',
        quickTitle: 'Быстрые действия',
        quickSubtitle: 'Ключевые сценарии по питомцу в одном месте.',
        visits: 'Визиты',
        documents: 'Документы',
        reminders: 'Напоминания',
        vaccines: 'Вакцины',
        openRecords: 'Медкарта',
        openDocuments: 'Документы',
        openCalendar: 'Календарь',
        openPassport: 'QR-паспорт',
        openNutrition: 'Питание и вес',
        openSafeFood: 'Опасные продукты',
        uploadPhoto: 'Загрузить фото',
        uploadingPhoto: 'Сохраняю фото…',
        uploadPhotoHint: 'Фото сохраняется в общей карте и будет видно врачу и администратору.',
        uploadPhotoError: 'Не удалось сохранить фото. Попробуйте другой файл.',
        timelineTitle: 'Лента событий',
        timelineSubtitle: 'Последние визиты и ближайшие уведомления владельца.',
        timelineEmptyTitle: 'Пока нет событий',
        timelineEmptyText: 'После первого визита и первых напоминаний здесь появится история.',
        remindersTitle: 'Ближайшие напоминания',
        remindersSubtitle: 'Вакцинации, контрольные визиты и домашний уход.',
        remindersEmptyTitle: 'Нет активных напоминаний',
        remindersEmptyText: 'Добавьте напоминание в календаре питомца.',
        vaccinesTitle: 'История вакцинаций',
        vaccinesSubtitle: 'Последние записи и ближайшие даты ревакцинации.',
        vaccinesEmptyTitle: 'Вакцинации ещё не добавлены',
        vaccinesEmptyText: 'Владелец и врач могут наполнять этот раздел.',
        docsTitle: 'Архив документов',
        docsSubtitle: 'Анализы, изображения, выписки и безопасные AI-сводки.',
        docsEmptyTitle: 'Документы пока не загружены',
        docsEmptyText: 'Добавьте анализы или выписки в раздел документов.',
        visitHistoryTitle: 'История визитов',
        visitHistorySubtitle: 'Последние визиты из общей базы.',
        visitHistoryEmptyTitle: 'Нет визитов',
        visitHistoryEmptyText: 'История приёмов появится после первого визита.',
        metaSex: 'Пол',
        metaBreed: 'Порода',
        metaAge: 'Возраст',
        metaWeight: 'Вес',
        metaStatus: 'Статус',
        docType: 'Тип',
        docDate: 'Дата',
        docFile: 'Файл',
        visitDate: 'Дата',
        visitComplaint: 'Причина обращения',
        visitStatus: 'Статус',
        visitOwnerSummary: 'Сводка для владельца',
        reminderDue: 'Срок',
        reminderChannel: 'Канал',
        nextDue: 'След. дата',
        open: 'Открыть профиль',
        noWeight: 'не указан',
      }
    : {
        title: 'Pet profile',
        subtitle: 'Unified pet card: profile, reminders, vaccines, documents and visit history.',
        retry: 'Refresh',
        notFoundTitle: 'Pet not found',
        notFoundText: 'Check the link or return to the pets list.',
        heroTitle: 'Pet profile',
        heroSubtitle: 'Unified pet profile for owner, vet and clinic.',
        statusStable: 'Stable',
        statusInpatient: 'Inpatient',
        statusControl: 'Control',
        birthDate: 'Birth date',
        sex: 'Sex',
        chip: 'Chip',
        passport: 'Passport',
        lapkaId: 'Lapka ID',
        createdAt: 'Created',
        quickTitle: 'Quick actions',
        quickSubtitle: 'Key scenarios for this pet in one place.',
        visits: 'Visits',
        documents: 'Documents',
        reminders: 'Reminders',
        vaccines: 'Vaccines',
        openRecords: 'Medical record',
        openDocuments: 'Documents',
        openCalendar: 'Calendar',
        openPassport: 'QR passport',
        openNutrition: 'Nutrition & weight',
        openSafeFood: 'Dangerous foods',
        uploadPhoto: 'Upload photo',
        uploadingPhoto: 'Saving photo…',
        uploadPhotoHint: 'The photo is saved into the shared card and is visible across roles.',
        uploadPhotoError: 'Could not save the photo. Try another file.',
        timelineTitle: 'Events timeline',
        timelineSubtitle: 'Recent visits and upcoming reminders.',
        timelineEmptyTitle: 'No events yet',
        timelineEmptyText: 'After the first visit or reminder, the history will appear here.',
        remindersTitle: 'Upcoming reminders',
        remindersSubtitle: 'Vaccination, checkup visits and home care.',
        remindersEmptyTitle: 'No active reminders',
        remindersEmptyText: 'Add a reminder in this pet calendar.',
        vaccinesTitle: 'Vaccination history',
        vaccinesSubtitle: 'Recent entries and upcoming booster dates.',
        vaccinesEmptyTitle: 'No vaccines yet',
        vaccinesEmptyText: 'Owner and vet can fill this section together.',
        docsTitle: 'Documents archive',
        docsSubtitle: 'Labs, images, discharge notes and clear summaries.',
        docsEmptyTitle: 'No documents yet',
        docsEmptyText: 'Upload lab results or discharge notes in documents.',
        visitHistoryTitle: 'Visit history',
        visitHistorySubtitle: 'Recent visits from the shared clinic timeline.',
        visitHistoryEmptyTitle: 'No visits',
        visitHistoryEmptyText: 'Visit history appears after the first appointment.',
        metaSex: 'Sex',
        metaBreed: 'Breed',
        metaAge: 'Age',
        metaWeight: 'Weight',
        metaStatus: 'Status',
        docType: 'Тип',
        docDate: 'Дата',
        docFile: 'Файл',
        visitDate: 'Date',
        visitComplaint: 'Chief complaint',
        visitStatus: 'Status',
        visitOwnerSummary: 'Owner summary',
        reminderDue: 'Due',
        reminderChannel: 'Channel',
        nextDue: 'Next due',
        open: 'Open profile',
        noWeight: 'not set',
      };

  const [pet, setPet] = useState(null);
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState('');
  const fileInputRef = useRef(null);

  const loadPetData = useCallback(async () => {
    if (!petId) return;
    setLoading(true);
    setError('');
    try {
      const [petPayload, visitsPayload, docsPayload, remindersPayload, vaccinesPayload] = await Promise.all([
        apiRequest(`/api/v1/pets/${petId}`),
        apiRequest(`/api/v1/visits?pet_id=${encodeURIComponent(petId)}&limit=20`),
        apiRequest(`/api/v1/documents?pet_id=${encodeURIComponent(petId)}`),
        apiRequest(`/api/v1/reminders?pet_id=${encodeURIComponent(petId)}&upcoming_days=180&limit=50`),
        apiRequest(`/api/v1/pets/${petId}/vaccines`),
      ]);
      setPet(petPayload || null);
      setVisits(Array.isArray(visitsPayload) ? visitsPayload : []);
      setDocuments(Array.isArray(docsPayload) ? docsPayload : []);
      setReminders(Array.isArray(remindersPayload) ? remindersPayload : []);
      setVaccines(Array.isArray(vaccinesPayload) ? vaccinesPayload : []);
    } catch (e) {
      setError(e.message || (isRu ? 'Не удалось загрузить профиль питомца' : 'Failed to load pet profile'));
      setPet(null);
      setVisits([]);
      setDocuments([]);
      setReminders([]);
      setVaccines([]);
    } finally {
      setLoading(false);
    }
  }, [isRu, petId]);

  useEffect(() => {
    loadPetData();
  }, [loadPetData]);

  const handlePhotoButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePhotoSelected = useCallback(async (event) => {
    const file = event.target?.files?.[0];
    if (!file || !petId) return;

    setPhotoUploading(true);
    setPhotoUploadError('');

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error(copy.uploadPhotoError));
        reader.readAsDataURL(file);
      });

      const updatedPet = await apiRequest(`/api/v1/pets/${petId}`, {
        method: 'PATCH',
        body: { photo_url: dataUrl },
      });

      setPet((current) => ({ ...(current || {}), ...(updatedPet || {}), photo_url: updatedPet?.photo_url || dataUrl }));
    } catch (uploadError) {
      setPhotoUploadError(uploadError?.message || copy.uploadPhotoError);
    } finally {
      setPhotoUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  }, [copy.uploadPhotoError, petId]);

  const statusLabel = useMemo(() => {
    const inpatientActive = visits.some((row) => row.inpatient_status === 'active') || pet?.inpatient_status === 'active';
    if (inpatientActive) return copy.statusInpatient;
    if (reminders.some((row) => row.reminder_type === 'checkup')) return copy.statusControl;
    return copy.statusStable;
  }, [copy.statusControl, copy.statusInpatient, copy.statusStable, pet?.inpatient_status, reminders, visits]);

  const summaryCards = useMemo(
    () => [
      { label: copy.visits, value: visits.length, tone: 'bg-cyan-50 text-cyan-800' },
      { label: copy.documents, value: documents.length, tone: 'bg-indigo-50 text-indigo-800' },
      { label: copy.reminders, value: reminders.length, tone: 'bg-emerald-50 text-emerald-800' },
      { label: copy.vaccines, value: vaccines.length, tone: 'bg-amber-50 text-amber-800' },
    ],
    [copy.documents, copy.reminders, copy.vaccines, copy.visits, documents.length, reminders.length, vaccines.length, visits.length]
  );

  const heroMeta = useMemo(() => {
    if (!pet) return [];
    return [
      { label: copy.metaSpecies, value: localizePetSpecies(pet.species, i18n.language) },
      { label: copy.metaBreed, value: localizePetBreed(pet.breed, i18n.language) },
      { label: copy.metaAge, value: formatPetAge(pet.birth_date, i18n.language) },
      { label: copy.sex, value: localizePetSex(pet.sex, i18n.language) },
      { label: copy.metaWeight, value: pet.weight_kg ? `${pet.weight_kg} ${isRu ? 'кг' : 'kg'}` : copy.noWeight },
      { label: copy.metaStatus, value: statusLabel },
      { label: copy.chip, value: pet.chip_id || '—' },
      { label: copy.passport, value: pet.passport_id || '—' },
      { label: copy.lapkaId, value: pet.lapka_id || '—' },
      { label: copy.birthDate, value: formatDate(pet.birth_date, locale) },
    ];
  }, [copy.birthDate, copy.chip, copy.lapkaId, copy.metaAge, copy.metaBreed, copy.metaSpecies, copy.metaStatus, copy.metaWeight, copy.noWeight, copy.passport, copy.sex, i18n.language, isRu, locale, pet, statusLabel]);

  const timelineItems = useMemo(() => {
    const visitEvents = visits.slice(0, 4).map((visit) => ({
      sortKey: new Date(visit.created_at).getTime(),
      time: formatDate(visit.created_at, locale),
      text: `${visit.chief_complaint || visit.complaints || copy.visitHistoryTitle} · ${visit.finalized_flag ? copy.statusStable : copy.statusControl}`,
    }));
    const reminderEvents = reminders.slice(0, 4).map((item) => ({
      sortKey: new Date(item.due_at).getTime(),
      time: formatDate(item.due_at, locale),
      text: `${item.title} · ${item.channel || (isRu ? 'уведомление' : 'reminder')}`,
    }));
    return [...visitEvents, ...reminderEvents].sort((a, b) => b.sortKey - a.sortKey).slice(0, 6);
  }, [copy.statusControl, copy.statusStable, copy.visitHistoryTitle, isRu, locale, reminders, visits]);

  const topReminders = useMemo(
    () => reminders.slice().sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).slice(0, 6),
    [reminders]
  );

  const topVaccines = useMemo(() => vaccines.slice(0, 6), [vaccines]);
  const topDocuments = useMemo(() => documents.slice(0, 6), [documents]);

  const visitRows = useMemo(
    () =>
      visits.slice(0, 10).map((visit) => [
        formatDateTime(visit.created_at, locale),
        visit.chief_complaint || visit.complaints || '—',
        visit.finalized_flag ? copy.statusStable : copy.statusControl,
        visit.owner_summary || '—',
        <Link key={visit.id} href={`/owner/pet/${petId}/records`} className="btn-secondary !px-3 !py-1">
          {copy.open}
        </Link>,
      ]),
    [copy.open, copy.statusControl, copy.statusStable, locale, petId, visits]
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{copy.title}</h1>
          <p className="page-subtitle">{copy.subtitle}</p>
        </div>
        <button className="btn-secondary" type="button" onClick={loadPetData}>
          {copy.retry}
        </button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPetData} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-[280px] w-full" />
          <Skeleton className="h-[220px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </section>
      ) : !pet ? (
        <EmptyState title={copy.notFoundTitle} text={copy.notFoundText} />
      ) : (
        <div className="space-y-4 md:space-y-6">
          <Card tone="tinted">
            <div className="grid gap-8 lg:grid-cols-[260px_1fr] xl:grid-cols-[300px_1fr]">
              <div className="space-y-4">
                <div className="relative aspect-square overflow-hidden rounded-3xl border-2 border-lapka-200 bg-gradient-to-br from-lapka-50 to-white shadow-soft">
                  <img
                    src={pet.photo_url || `https://placekitten.com/400/400?text=${encodeURIComponent(pet.name || 'Pet')}`}
                    alt={pet.name || 'Pet'}
                    className="h-full w-full object-cover"
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelected}
                />
                <button
                  type="button"
                  className="btn-secondary w-full justify-center text-sm py-2.5"
                  onClick={handlePhotoButtonClick}
                  disabled={photoUploading}
                >
                  {photoUploading ? copy.uploadingPhoto : isRu ? 'Загрузить фото' : 'Upload photo'}
                </button>
                <div className="rounded-2xl border border-lapka-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-lapka-500 mb-3">{isRu ? 'Документы' : 'Documents'}</p>
                  <div className="space-y-2">
                    {heroMeta.slice(5).map((item) => (
                      <div key={item.label} className="flex justify-between items-center py-1 border-b border-lapka-50 last:border-0">
                        <span className="text-xs text-lapka-500">{item.label}</span>
                        <span className="text-xs font-semibold text-lapka-900 truncate max-w-[130px]">{item.value || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl bg-gradient-to-br from-lapka-100 via-lapka-50 to-white p-6 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-4xl font-black text-lapka-900 tracking-tight">{pet.name || '—'}</h2>
                      <p className="mt-2 text-lg font-medium text-lapka-600">
                        {localizePetSpecies(pet.species, i18n.language)} · {localizePetBreed(pet.breed, i18n.language)}
                      </p>
                    </div>
                    <span className="rounded-full border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm">
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-lapka-700">
                    <span className="rounded-full border border-lapka-200 bg-white/80 px-3 py-1.5">{localizePetSex(pet.sex, i18n.language)}</span>
                    <span className="text-lapka-400">•</span>
                    <span className="rounded-full border border-lapka-200 bg-white/80 px-3 py-1.5">{formatPetAge(pet.birth_date, i18n.language)}</span>
                    <span className="text-lapka-400">•</span>
                    <span className="rounded-full border border-lapka-200 bg-white/80 px-3 py-1.5">{pet.weight_kg ? `${pet.weight_kg} ${isRu ? 'кг' : 'kg'}` : copy.noWeight}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-lapka-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-lapka-500 mb-3">{isRu ? 'Идентификация' : 'Identification'}</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {heroMeta.slice(0, 5).map((item) => (
                      <div key={item.label} className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-lapka-400">{item.label}</span>
                        <span className="text-sm font-semibold text-lapka-900 truncate">{item.value || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link href={`/owner/pet/${petId}/passport`} className="btn-primary flex-1 justify-center text-base py-3.5 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all">
                    {isRu ? 'QR-паспорт' : 'QR Passport'}
                  </Link>
                  <Link href={`/owner/pet/${petId}/records`} className="btn-secondary flex-1 justify-center text-base py-3.5">
                    {isRu ? 'Медкарта' : 'Medical record'}
                  </Link>
                  <Link href={`/owner/pet/${petId}/calendar`} className="btn-subtle flex items-center justify-center px-4 py-3.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </Card>

          <section className="grid gap-4 md:grid-cols-1 lg:grid-cols-[320px] xl:grid-cols-[360px] 2xl:grid-cols-[400px]">
            <Card title={copy.timelineTitle} subtitle={copy.timelineSubtitle}>
                {timelineItems.length ? (
                  <Timeline items={timelineItems} />
                ) : (
                  <EmptyState title={copy.timelineEmptyTitle} text={copy.timelineEmptyText} />
                )}
              </Card>

              <Card title={copy.remindersTitle} subtitle={copy.remindersSubtitle}>
                {topReminders.length ? (
                  <div className="space-y-3">
                    {topReminders.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-lapka-900">{item.title}</p>
                            <p className="mt-1 text-xs text-lapka-500">
                              {copy.reminderDue}: {formatDateTime(item.due_at, locale)}
                            </p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneForReminder(item.reminder_type)}`}>
                            {localizeReminderType(item.reminder_type, isRu)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-lapka-600">
                          {copy.reminderChannel}: {item.channel || 'push'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title={copy.remindersEmptyTitle} text={copy.remindersEmptyText} />
                )}
              </Card>
          </section>

          <section className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <Card title={copy.vaccinesTitle} subtitle={copy.vaccinesSubtitle}>
              {topVaccines.length ? (
                <div className="space-y-3">
                  {topVaccines.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                      <p className="font-semibold text-lapka-900">{item.vaccine_name}</p>
                      <p className="mt-1 text-xs text-lapka-600">{formatDate(item.administered_at, locale)}</p>
                      <p className="mt-1 text-xs text-lapka-500">
                        {copy.nextDue}: {formatDate(item.next_due_date, locale)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title={copy.vaccinesEmptyTitle} text={copy.vaccinesEmptyText} />
              )}
            </Card>

            <Card title={copy.docsTitle} subtitle={copy.docsSubtitle}>
              {topDocuments.length ? (
                <div className="space-y-3">
                  {topDocuments.map((doc) => (
                    <div key={doc.id} className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                      <p className="font-semibold text-lapka-900">{localizeDocumentType(doc.doc_type, i18n.language)}</p>
                      <p className="mt-1 text-xs text-lapka-600">{formatDateTime(doc.created_at, locale)}</p>
                      <p className="mt-1 truncate text-xs text-lapka-500">{doc.file_ref || '—'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title={copy.docsEmptyTitle} text={copy.docsEmptyText} />
              )}
            </Card>

            <Card
              title={copy.quickTitle}
              subtitle={isRu ? 'Маршруты владельца вокруг питомца.' : 'Owner routes around this pet.'}
            >
              <div className="grid gap-2">
                <Link href={`/owner/pet/${petId}/records`} className="action-grid-link">{copy.openRecords}</Link>
                <Link href={`/owner/pet/${petId}/documents`} className="action-grid-link">{copy.openDocuments}</Link>
                <Link href={`/owner/pet/${petId}/calendar`} className="action-grid-link">{copy.openCalendar}</Link>
                <Link href={`/owner/pet/${petId}/passport`} className="action-grid-link">{copy.openPassport}</Link>
                <Link href={`/owner/pet/${petId}/inpatient`} className="action-grid-link">
                  {isRu ? 'Стационар' : 'Inpatient'}
                </Link>
                <Link href={`/owner/pet/${petId}/consents`} className="action-grid-link">
                  {isRu ? 'Доступ клиникам' : 'Clinic access'}
                </Link>
              </div>
            </Card>
          </section>

          <Card title={copy.visitHistoryTitle} subtitle={copy.visitHistorySubtitle}>
            {visits.length ? (
              <Table
                columns={[copy.visitDate, copy.visitComplaint, copy.visitStatus, copy.visitOwnerSummary, copy.open]}
                rows={visitRows}
                searchPlaceholder={isRu ? 'Поиск по визитам...' : 'Search visits...'}
              />
            ) : (
              <EmptyState title={copy.visitHistoryEmptyTitle} text={copy.visitHistoryEmptyText} />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
