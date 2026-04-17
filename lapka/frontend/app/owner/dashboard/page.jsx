'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';
import { loadOwnerBaseData, loadPetHealthBundle, loadOwnerServicesData } from '@/lib/owner-data';
import {
  buildHealthTimeline,
  buildMedicationCenter,
  buildPersonalCarePlan,
  buildServiceOverview,
  formatDateTimeLabel,
} from '@/lib/owner-workspace';
import {
  localizeDocumentType,
  localizePetBreed,
  localizePetSpecies,
  localizeServiceType,
  resolveClinicPhoto,
  resolvePetPhoto,
} from '@/lib/pets';

export default function OwnerDashboardPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const docLocale = isEn ? 'en' : 'ru';
  const dtLocale = isEn ? 'en' : 'ru';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionsByVisit, setPrescriptionsByVisit] = useState({});
  const [petLoading, setPetLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState('');
  const [photoTargetPetId, setPhotoTargetPetId] = useState('');
  const fileInputRef = useRef(null);

  const selectedPet = useMemo(() => pets.find((p) => p.id === selectedPetId) || null, [pets, selectedPetId]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [base, services] = await Promise.all([loadOwnerBaseData(), loadOwnerServicesData()]);
      setPets(base.pets);
      setReminders(base.reminders);
      setAppointments(base.appointments);
      setInvoices(base.invoices);
      setClinics(services.clinics);
      setSelectedPetId((cur) => (cur && base.pets.some((p) => p.id === cur) ? cur : base.pets[0]?.id || ''));
    } catch (e) {
      setError(e.message || (isEn ? 'Failed to load dashboard' : 'Не удалось загрузить дашборд'));
      setPets([]);
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  const loadPetBundle = useCallback(async (petId) => {
    if (!petId) return;
    setPetLoading(true);
    try {
      const payload = await loadPetHealthBundle(petId);
      setVisits(payload.visits);
      setDocuments(payload.documents);
      setVaccines(payload.vaccines);
      setPrescriptions(payload.prescriptions);
      setPrescriptionsByVisit(payload.prescriptionsByVisit);
    } catch {
      setVisits([]);
      setDocuments([]);
    } finally {
      setPetLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (selectedPetId) loadPetBundle(selectedPetId); }, [loadPetBundle, selectedPetId]);

  const handlePhotoButtonClick = useCallback((petId = selectedPetId) => {
    if (petId) {
      setPhotoTargetPetId(petId);
      fileInputRef.current?.click();
    }
  }, [selectedPetId]);

  const handlePhotoSelected = useCallback(async (e) => {
    const file = e.target?.files?.[0];
    const targetId = photoTargetPetId || selectedPetId;
    if (!file || !targetId) return;
    setPhotoUploading(true);
    setPhotoUploadError('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => reject(new Error(isEn ? 'Could not read file' : 'Не удалось прочитать'));
        r.readAsDataURL(file);
      });
      const updated = await apiRequest(`/api/v1/pets/${targetId}`, { method: 'PATCH', body: { photo_url: dataUrl } });
      setPets((cur) => cur.map((p) => (p.id === targetId ? { ...p, ...updated, photo_url: updated?.photo_url || dataUrl } : p)));
    } catch (e) {
      setPhotoUploadError(e.message || (isEn ? 'Save failed' : 'Ошибка сохранения'));
    } finally {
      setPhotoUploading(false);
      setPhotoTargetPetId('');
      if (e.target) e.target.value = '';
    }
  }, [isEn, photoTargetPetId, selectedPetId]);

  const timeline = useMemo(
    () => buildHealthTimeline({ petId: selectedPetId, visits, documents, reminders, appointments, vaccines, prescriptionsByVisit }),
    [appointments, documents, prescriptionsByVisit, reminders, selectedPetId, vaccines, visits]
  );
  const medications = useMemo(
    () => buildMedicationCenter({ pet: selectedPet, reminders: reminders.filter((r) => r.pet_id === selectedPetId), prescriptions, visits }),
    [prescriptions, reminders, selectedPet, selectedPetId, visits]
  );
  const carePlan = useMemo(
    () => buildPersonalCarePlan({ pet: selectedPet, reminders: reminders.filter((r) => r.pet_id === selectedPetId), timeline }),
    [reminders, selectedPet, selectedPetId, timeline]
  );
  const serviceOverview = useMemo(() => buildServiceOverview({ clinics, appointments, invoices }), [appointments, clinics, invoices]);

  const nextAppointment = serviceOverview.nextAppointment;
  const latestTimeline = timeline.slice(0, 4);
  const latestDocuments = documents.slice(0, 3);

  const todayItems = useMemo(() => {
    const items = [];
    if (medications.nextMedication) {
      items.push({
        label: isEn ? 'Medication' : 'Лекарство',
        value: medications.nextMedication.title,
        href: `/owner/medications?pet=${selectedPetId}`,
        time: medications.nextMedication.due_at,
      });
    }
    if (nextAppointment) {
      items.push({
        label: isEn ? 'Visit' : 'Визит',
        value: localizeServiceType(nextAppointment.service_type || nextAppointment.service_name, docLocale),
        href: `/owner/appointment/${nextAppointment.id}`,
        time: nextAppointment.scheduled_at,
      });
    }
    if (carePlan.today[0]) {
      items.push({ label: isEn ? 'Care' : 'Уход', value: carePlan.today[0], href: '/owner/care' });
    }
    return items;
  }, [carePlan.today, docLocale, isEn, medications.nextMedication, nextAppointment, selectedPetId]);

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {isEn ? 'Your pet health hub' : 'Персональный центр здоровья питомца'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{isEn ? 'What matters today' : 'Главное на сегодня'}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/owner/appointments" className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            {isEn ? 'Appointments' : 'Записи'}
          </Link>
          <Link href="/owner/care" className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {isEn ? 'Care' : 'Уход'}
          </Link>
        </div>
      </header>

      {error && <ErrorBanner message={error} onRetry={loadDashboard} />}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !selectedPet ? (
        <EmptyState
          title={isEn ? 'Add a pet' : 'Добавьте питомца'}
          text={isEn ? 'Then Lapka can pull records, medications and visits into one place.' : 'После этого Lapka соберёт медкарту, лекарства и визиты в одном месте.'}
        />
      ) : (
        <>
          {/* Hero: Pet + Today summary */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid min-w-0 gap-0 sm:grid-cols-[1fr_320px]">
              <div className="min-w-0 p-6">
                <div className="flex flex-wrap gap-2">
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      type="button"
                      onClick={() => setSelectedPetId(pet.id)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${pet.id === selectedPetId ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {pet.name}
                    </button>
                  ))}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-900 sm:text-2xl">{selectedPet.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {localizePetSpecies(selectedPet.species, docLocale)} · {localizePetBreed(selectedPet.breed, docLocale)}
                  {selectedPet.weight_kg ? ` · ${selectedPet.weight_kg} ${isEn ? 'kg' : 'кг'}` : ''}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/owner/pet/${selectedPet.id}`} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                    {isEn ? 'Profile' : 'Профиль'}
                  </Link>
                  <button type="button" onClick={() => handlePhotoButtonClick()} disabled={photoUploading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {photoUploading ? (isEn ? 'Uploading…' : 'Загрузка…') : isEn ? 'Photo' : 'Фото'}
                  </button>
                  <Link href={`/owner/quick-triage?pet=${selectedPet.id}`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {isEn ? 'Symptoms' : 'Симптомы'}
                  </Link>
                </div>
                {photoUploadError && <p className="mt-2 text-sm text-rose-600">{photoUploadError}</p>}
              </div>
              <div className="min-w-0 border-t border-slate-200 bg-slate-50/50 p-6 sm:border-l sm:border-t-0">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{isEn ? 'Today' : 'Сегодня'}</p>
                {todayItems.length ? (
                  <ul className="mt-3 space-y-3">
                    {todayItems.map((item, i) => (
                      <li key={i}>
                        <Link href={item.href} className="block rounded-lg border border-slate-200 bg-white p-3 text-sm hover:border-slate-300">
                          <span className="font-medium text-slate-900">{item.value}</span>
                          {item.time && <span className="mt-1 block text-xs text-slate-500">{formatDateTimeLabel(item.time, dtLocale)}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">{isEn ? 'Nothing scheduled' : 'Нет запланированных действий'}</p>
                )}
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
          </section>

          {/* Two columns: Timeline + Documents */}
          <section className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">{isEn ? 'Health timeline' : 'Лента здоровья'}</h3>
                <Link href="/owner/timeline" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  {isEn ? 'Full timeline →' : 'Вся лента →'}
                </Link>
              </div>
              {petLoading ? (
                <Skeleton className="mt-4 h-48 w-full" />
              ) : latestTimeline.length ? (
                <ul className="mt-4 space-y-2">
                  {latestTimeline.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 hover:border-slate-200 hover:bg-slate-50">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.tone === 'warning' ? 'bg-amber-400' : item.tone === 'critical' ? 'bg-rose-400' : 'bg-slate-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">{item.title}</p>
                          <p className="mt-0.5 text-sm text-slate-500">{item.subtitle}</p>
                          <span className="mt-1 block text-xs text-slate-400">{formatDateTimeLabel(item.when, dtLocale)}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500">{isEn ? 'History will appear after visits and documents' : 'История появится после визитов и документов'}</p>
              )}
            </div>

            <div className="min-w-0 space-y-6 overflow-hidden">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">{isEn ? 'Documents' : 'Документы'}</h3>
                  <Link href={`/owner/pet/${selectedPet.id}/documents`} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                    {isEn ? 'All →' : 'Все →'}
                  </Link>
                </div>
                {latestDocuments.length ? (
                  <ul className="mt-4 space-y-2">
                    {latestDocuments.map((row) => (
                      <li key={row.id}>
                        <Link href={`/owner/pet/${selectedPet.id}/documents`} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:border-slate-200 hover:bg-slate-50">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{row.title || localizeDocumentType(row.doc_type, docLocale)}</p>
                            <p className="text-xs text-slate-500">{formatDateTimeLabel(row.created_at, dtLocale)}</p>
                          </div>
                          <span className="ml-2 shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            {localizeDocumentType(row.doc_type, docLocale)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">{isEn ? 'Upload labs and discharge notes' : 'Загрузите анализы и выписки'}</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">{isEn ? 'Services' : 'Сервисы'}</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Link href="/owner/appointments" className="rounded-lg border border-slate-200 p-4 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                    {isEn ? 'Book a vet' : 'Записи к врачу'}
                  </Link>
                  <Link href="/owner/services" className="rounded-lg border border-slate-200 p-4 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                    {isEn ? 'Clinics' : 'Клиники'}
                  </Link>
                  <Link href="/owner/billing" className="rounded-lg border border-slate-200 p-4 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                    {isEn ? 'Invoices' : 'Счета'}
                  </Link>
                  <Link href="/owner/medications" className="rounded-lg border border-slate-200 p-4 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                    {isEn ? 'Medications' : 'Лекарства'}
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
