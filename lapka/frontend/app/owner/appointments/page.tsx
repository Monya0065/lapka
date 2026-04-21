'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { trackOwnerFunnelStep } from '@/lib/owner-funnel';
import { localizeResourceType } from '@/lib/clinic-operations';
import { localizeServiceType, localizeVisitType } from '@/lib/pets';

function getStepLabels(isEn) {
  return isEn
    ? ['1. Pet', '2. Clinic and vet', '3. Service and format', '4. Slot and confirmation']
    : ['1. Питомец', '2. Клиника и врач', '3. Услуга и формат', '4. Слот и подтверждение'];
}

function getStatusLabel(status, isEn) {
  const ru = {
    scheduled: 'Запланирован',
    confirmed: 'Подтвержден',
    in_progress: 'Идёт приём',
    completed: 'Завершён',
    cancelled: 'Отменён',
    no_show: 'Неявка',
    new: 'Новая',
    waiting: 'Ожидание',
  };
  const en = {
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No show',
    new: 'New',
    waiting: 'Waiting',
  };
  return (isEn ? en : ru)[status] || status;
}

function describeSlotConflict(slot, isEn) {
  const scopes = Array.isArray(slot?.conflict_scopes) ? slot.conflict_scopes : [];
  if (scopes.includes('vet') && scopes.includes('resource')) return isEn ? 'vet and room are occupied' : 'заняты врач и кабинет';
  if (scopes.includes('resource')) return slot?.room_label ? (isEn ? `${slot.room_label.toLowerCase()} is occupied` : `занят ${slot.room_label.toLowerCase()}`) : (isEn ? 'room is occupied' : 'занят кабинет');
  if (scopes.includes('vet')) return isEn ? 'vet is occupied' : 'занят врач';
  return isEn ? 'slot unavailable' : 'слот недоступен';
}

function toLocalDateInput(daysShift = 1) {
  const date = new Date();
  date.setDate(date.getDate() + daysShift);
  while ([0, 6].includes(date.getDay())) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

function statusPill(status, isEn) {
  const map = {
    scheduled: 'pill',
    confirmed: 'badge-green',
    in_progress: 'badge-yellow',
    completed: 'badge-green',
    cancelled: 'badge-red',
    no_show: 'badge-red',
    new: 'pill',
    waiting: 'badge-yellow',
  };
  return <span className={map[status] || 'pill'}>{getStatusLabel(status, isEn)}</span>;
}

export default function OwnerAppointmentsPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const stepLabels = getStepLabels(isEn);
  const searchParams = useSearchParams();
  const [pets, setPets] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [vets, setVets] = useState([]);
  const [services, setServices] = useState([]);
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [resources, setResources] = useState([]);
  const [slots, setSlots] = useState([]);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [clinicLoading, setClinicLoading] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelingId, setCancelingId] = useState('');
  const [cancelConfirmId, setCancelConfirmId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [petId, setPetId] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [clinicLocationId, setClinicLocationId] = useState('');
  const [clinicResourceId, setClinicResourceId] = useState('');
  const [vetId, setVetId] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [appointmentTypeId, setAppointmentTypeId] = useState('');
  const [visitType, setVisitType] = useState('clinic_visit');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [dateValue, setDateValue] = useState(toLocalDateInput(1));
  const [slotValue, setSlotValue] = useState('');
  const [notes, setNotes] = useState('');

  const preselectedClinicId = searchParams.get('clinic_id') || '';
  const preselectedVetId = searchParams.get('vet_id') || '';
  const preselectedService = searchParams.get('service') || '';

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [petsPayload, clinicsPayload, appointmentsPayload] = await Promise.all([
        apiRequest('/api/v1/pets'),
        apiRequest('/api/v1/clinics'),
        apiRequest('/api/v1/appointments'),
      ]);

      const petsRows = Array.isArray(petsPayload) ? petsPayload : [];
      const clinicsRows = Array.isArray(clinicsPayload) ? clinicsPayload : [];
      const apptRows = Array.isArray(appointmentsPayload) ? appointmentsPayload : [];

      setPets(petsRows);
      setClinics(clinicsRows);
      setAppointments(apptRows);

      if (!petId && petsRows[0]?.id) setPetId(petsRows[0].id);
      const clinicFromQuery = preselectedClinicId && clinicsRows.some((row) => row.id === preselectedClinicId)
        ? preselectedClinicId
        : clinicsRows[0]?.id;
      if (!clinicId && clinicFromQuery) setClinicId(clinicFromQuery);
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to load appointment data' : 'Не удалось загрузить данные для записи'));
      setPets([]);
      setClinics([]);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, isEn, petId, preselectedClinicId]);

  const loadClinicContext = useCallback(async (targetClinicId) => {
    if (!targetClinicId) return;
    setClinicLoading(true);
    setError('');
    try {
      const [vetsPayload, servicesPayload, typesPayload] = await Promise.all([
        apiRequest(`/api/v1/clinics/${targetClinicId}/vets`),
        apiRequest(`/api/v1/clinics/${targetClinicId}/services`),
        apiRequest(`/api/v1/appointments/types?clinic_id=${encodeURIComponent(targetClinicId)}`),
      ]);

      const vetRows = Array.isArray(vetsPayload) ? vetsPayload : [];
      const serviceRows = Array.isArray(servicesPayload) ? servicesPayload : [];
      const typeRows = Array.isArray(typesPayload) ? typesPayload : [];

      setVets(vetRows);
      setServices(serviceRows);
      setAppointmentTypes(typeRows);

      const clinicRecord = clinics.find((row) => row.id === targetClinicId);
      const clinicLocations = Array.isArray(clinicRecord?.locations) ? clinicRecord.locations : [];
      const nextLocationId = clinicLocations.find((row) => row.is_primary)?.id || clinicLocations[0]?.id || '';
      setClinicLocationId((prev) => (prev && clinicLocations.some((row) => row.id === prev) ? prev : nextLocationId));

      const nextVetId = vetRows[0]?.id || '';
      const nextService = serviceRows[0]?.name || typeRows[0]?.name || '';
      const nextTypeId = typeRows[0]?.id || '';

      setVetId((prev) => {
        if (preselectedVetId && vetRows.some((row) => row.id === preselectedVetId)) return preselectedVetId;
        return vetRows.some((row) => row.id === prev) ? prev : nextVetId;
      });
      setServiceType((prev) => {
        if (preselectedService && serviceRows.some((s) => s.name === preselectedService)) return preselectedService;
        return prev && (serviceRows.some((s) => s.name === prev) || prev === nextService) ? prev : nextService;
      });
      setAppointmentTypeId((prev) => (typeRows.some((row) => row.id === prev) ? prev : nextTypeId));

      const selectedType = typeRows.find((row) => row.id === (typeRows.some((row) => row.id === appointmentTypeId) ? appointmentTypeId : nextTypeId));
      if (selectedType?.default_duration_minutes) {
        setDurationMinutes(selectedType.default_duration_minutes);
      } else if (serviceRows[0]?.duration_min) {
        setDurationMinutes(serviceRows[0].duration_min);
      }
      if (selectedType?.is_telemedicine) {
        setVisitType('video_consultation');
      }
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to load clinic schedule' : 'Не удалось загрузить расписание клиники'));
      setVets([]);
      setServices([]);
      setAppointmentTypes([]);
    } finally {
      setClinicLoading(false);
    }
  }, [appointmentTypeId, clinics, isEn, preselectedService, preselectedVetId]);

  const loadResources = useCallback(async () => {
    if (!clinicId) {
      setResources([]);
      setClinicResourceId('');
      return;
    }
    setResourcesLoading(true);
    setError('');
    try {
      const search = new URLSearchParams({ clinic_id: clinicId });
      if (clinicLocationId) search.set('clinic_location_id', clinicLocationId);
      const payload = await apiRequest(`/api/v1/appointments/resources?${search.toString()}`);
      const rows = Array.isArray(payload) ? payload : [];
      setResources(rows);
      setClinicResourceId((prev) => (prev && rows.some((row) => row.id === prev) ? prev : ''));
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to load rooms and resources' : 'Не удалось загрузить кабинеты и ресурсы'));
      setResources([]);
      setClinicResourceId('');
    } finally {
      setResourcesLoading(false);
    }
  }, [clinicId, clinicLocationId, isEn]);

  const loadSlots = useCallback(async () => {
    if (!clinicId || !vetId || !dateValue) {
      setSlots([]);
      setSlotValue('');
      return;
    }
    setSlotsLoading(true);
    setError('');
    try {
      const search = new URLSearchParams({
        clinic_id: clinicId,
        vet_id: vetId,
        date: dateValue,
      });
      if (clinicLocationId) search.set('clinic_location_id', clinicLocationId);
      if (clinicResourceId) search.set('clinic_resource_id', clinicResourceId);
      if (appointmentTypeId) search.set('appointment_type_id', appointmentTypeId);
      if (durationMinutes) search.set('duration_minutes', String(durationMinutes));

      const payload = await apiRequest(`/api/v1/appointments/slots?${search.toString()}`);
      const rows = Array.isArray(payload) ? payload : [];
      setSlots(rows);

      const firstAvailable = rows.find((slot) => slot.available);
      setSlotValue((prev) => {
        if (prev && rows.some((slot) => slot.start_at === prev && slot.available)) return prev;
        return firstAvailable?.start_at || '';
      });
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to load slots' : 'Не удалось получить слоты'));
      setSlots([]);
      setSlotValue('');
    } finally {
      setSlotsLoading(false);
    }
  }, [appointmentTypeId, clinicId, clinicLocationId, clinicResourceId, dateValue, durationMinutes, vetId, isEn]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    trackOwnerFunnelStep('booking_open', { source: 'appointments_page', clinicId, petId });
    // track on first render and when deep-links preselect clinic/pet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (clinicId) {
      loadClinicContext(clinicId);
    }
  }, [clinicId, loadClinicContext]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    const selectedType = appointmentTypes.find((row) => row.id === appointmentTypeId);
    if (!selectedType) return;
    if (selectedType.default_duration_minutes) {
      setDurationMinutes(selectedType.default_duration_minutes);
    }
    if (selectedType.is_telemedicine) {
      setVisitType('video_consultation');
      setServiceType((prev) => prev || selectedType.name);
      const telemedicineRoom = resources.find((row) => row.resource_type === 'telemedicine');
      if (telemedicineRoom) setClinicResourceId(telemedicineRoom.id);
    }
  }, [appointmentTypeId, appointmentTypes, resources]);

  async function onCreateAppointment(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!petId || !clinicId || !vetId || !serviceType || !slotValue) {
      setError(isEn ? 'Fill all required fields and choose an available slot.' : 'Заполните все обязательные поля и выберите свободный слот.');
      return;
    }

    setSaving(true);
    try {
      await apiRequest('/api/v1/appointments', {
        method: 'POST',
        body: {
          pet_id: petId,
          clinic_id: clinicId,
          vet_id: vetId,
          appointment_type_id: appointmentTypeId || null,
          service_type: serviceType,
          clinic_location_id: clinicLocationId || null,
          clinic_resource_id: clinicResourceId || null,
          scheduled_at: slotValue,
          duration_minutes: durationMinutes,
          visit_type: visitType,
          notes: notes || null,
          status: 'scheduled',
        },
      });
      trackOwnerFunnelStep('booking_submit', { source: 'appointments_submit', clinicId, petId });

      setSuccess(isEn ? 'Appointment created. 24h and 2h reminders were added automatically.' : 'Запись создана. Напоминания на 24 часа и 2 часа добавлены автоматически.');
      setStep(1);
      setNotes('');
      await loadBaseData();
      await loadSlots();
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to create appointment' : 'Не удалось создать запись'));
    } finally {
      setSaving(false);
    }
  }

  async function onCancelAppointment(appointmentId) {
    setError('');
    setSuccess('');
    setCancelConfirmId('');
    setCancelingId(appointmentId);

    try {
      await apiRequest(`/api/v1/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        body: { notes: isEn ? 'Cancelled by owner' : 'Отменено владельцем' },
      });
      setSuccess(isEn ? 'Appointment canceled. Reminders were closed automatically.' : 'Запись отменена. Напоминания автоматически закрыты.');
      await loadBaseData();
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to cancel appointment' : 'Не удалось отменить запись'));
    } finally {
      setCancelingId('');
    }
  }

  const selectedPet = useMemo(() => pets.find((item) => item.id === petId), [pets, petId]);
  const selectedClinic = useMemo(() => clinics.find((item) => item.id === clinicId), [clinics, clinicId]);
  const selectedClinicLocations = useMemo(() => (Array.isArray(selectedClinic?.locations) ? selectedClinic.locations : []), [selectedClinic]);
  const selectedClinicLocation = useMemo(() => selectedClinicLocations.find((item) => item.id === clinicLocationId) || selectedClinic?.primary_location || null, [clinicLocationId, selectedClinic, selectedClinicLocations]);
  const selectedResource = useMemo(() => resources.find((item) => item.id === clinicResourceId) || null, [clinicResourceId, resources]);
  const selectedVet = useMemo(() => vets.find((item) => item.id === vetId), [vets, vetId]);
  const availableSlots = slots.filter((slot) => slot.available);
  const unavailableSlots = slots.filter((slot) => !slot.available);

  const locale = isEn ? 'en-US' : 'ru-RU';
  const appointmentRows = appointments
    .slice()
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .map((item) => [
      new Date(item.scheduled_at).toLocaleString(locale),
      localizeServiceType(item.service_type || item.service_name, isEn ? 'en' : 'ru'),
      item.room_label || (isEn ? 'Clinic auto-assignment' : 'Автоподбор клиники'),
      localizeVisitType(item.visit_type, isEn ? 'en' : 'ru'),
      statusPill(item.status, isEn),
      <div key={item.id} className="flex flex-wrap gap-2">
        <Link className="btn-secondary !px-3 !py-1" href={`/owner/appointment/${item.id}`}>
          {isEn ? 'Appointment card' : 'Карточка записи'}
        </Link>
        {['scheduled', 'confirmed', 'new', 'waiting'].includes(item.status) ? (
          <button
            className="btn-secondary !px-3 !py-1"
            type="button"
            onClick={() => setCancelConfirmId(item.id)}
            disabled={cancelingId === item.id}
          >
            {cancelingId === item.id ? (isEn ? 'Canceling...' : 'Отменяем...') : (isEn ? 'Cancel' : 'Отменить')}
          </button>
        ) : null}
      </div>,
    ]);

  const canGoNextFromStep = {
    1: Boolean(petId),
    2: Boolean(clinicId && vetId),
    3: Boolean(serviceType && (visitType === 'clinic_visit' || visitType === 'video_consultation')),
    4: Boolean(slotValue),
  };

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{isEn ? 'Online booking and telemedicine' : 'Онлайн-запись и телемедицина'}</h1>
          <p className="page-subtitle">{isEn ? 'Choose a pet, vet, service and available slot. A link is created for video consultations.' : 'Выберите питомца, врача, услугу и свободный слот. Для видеоконсультации будет создана ссылка.'}</p>
        </div>
      </header>

      <ShowcasePanel
        eyebrow={isEn ? 'Clinic booking' : 'Запись в клинику'}
        title={isEn ? 'Choose vet, service and convenient slot in one flow' : 'Выбор врача, услуги и удобного слота в одном мастере'}
        description={isEn ? 'Book an in-clinic visit or video consultation in one flow, with automatic reminders.' : 'Владелец бронирует очный приём или видеоконсультацию в одном процессе, а напоминания создаются автоматически.'}
        imageSrc="/assets/img/owner-banner.svg"
        imageAlt={isEn ? 'Owner online booking' : 'Онлайн-запись владельца'}
      />

      {error ? <ErrorBanner message={error} onRetry={loadBaseData} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      {loading ? (
        <section className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </section>
      ) : (
        <>
          <Card title={isEn ? 'Booking wizard' : 'Мастер записи'} subtitle={isEn ? 'Step-by-step appointment booking' : 'Пошаговое бронирование приёма'}>
            <form className="space-y-5" onSubmit={onCreateAppointment}>
              <div className="grid gap-2 md:grid-cols-4">
                {stepLabels.map((label, index) => {
                  const stepNumber = index + 1;
                  const isActive = step === stepNumber;
                  const isPassed = step > stepNumber;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${isActive ? 'border-sky-300 bg-sky-50 text-sky-800' : isPassed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-lapka-200 bg-white text-lapka-600'}`}
                      onClick={() => setStep(stepNumber)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {step >= 1 ? (
                <section className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                      <span className="label">{isEn ? 'Pet' : 'Питомец'}</span>
                    <select className="input" value={petId} onChange={(event) => setPetId(event.target.value)}>
                      {pets.map((pet) => (
                        <option key={pet.id} value={pet.id}>
                          {pet.name} · {pet.species}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm text-lapka-700">
                    <span className="font-semibold">{isEn ? 'Selected:' : 'Выбрано:'}</span> {selectedPet ? `${selectedPet.name} (${selectedPet.species})` : '—'}
                  </div>
                </section>
              ) : null}

              {step >= 2 ? (
                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                      <span className="label">{isEn ? 'Clinic' : 'Клиника'}</span>
                    <select className="input" value={clinicId} onChange={(event) => setClinicId(event.target.value)}>
                      {clinics.map((clinic) => (
                        <option key={clinic.id} value={clinic.id}>
                          {clinic.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                      <span className="label">{isEn ? 'Branch' : 'Филиал'}</span>
                    <select className="input" value={clinicLocationId} onChange={(event) => setClinicLocationId(event.target.value)} disabled={!selectedClinicLocations.length}>
                      {selectedClinicLocations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.is_primary ? (isEn ? 'Primary · ' : 'Основной · ') : ''}{location.address}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                      <span className="label">{isEn ? 'Vet' : 'Врач'}</span>
                    <select className="input" value={vetId} onChange={(event) => setVetId(event.target.value)} disabled={clinicLoading}>
                      {vets.map((vet) => (
                        <option key={vet.id} value={vet.id}>
                          {vet.full_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm text-lapka-700">
                    <span className="font-semibold">{isEn ? 'Clinic:' : 'Клиника:'}</span> {selectedClinic?.name || '—'}
                    <br />
                    <span className="font-semibold">{isEn ? 'Branch:' : 'Филиал:'}</span> {selectedClinicLocation?.address || '—'}
                    <br />
                    <span className="font-semibold">{isEn ? 'Vet:' : 'Врач:'}</span> {selectedVet?.full_name || '—'}
                  </div>
                </section>
              ) : null}

              {step >= 3 ? (
                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className="block">
                    <span className="label">{isEn ? 'Appointment type' : 'Тип приёма'}</span>
                    <select className="input" value={appointmentTypeId} onChange={(event) => setAppointmentTypeId(event.target.value)}>
                      <option value="">{isEn ? 'No type' : 'Без типа'}</option>
                      {appointmentTypes.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}{row.is_telemedicine ? (isEn ? ' · telemedicine' : ' · телемедицина') : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="label">{isEn ? 'Service' : 'Услуга'}</span>
                    <select className="input" value={serviceType} onChange={(event) => setServiceType(event.target.value)}>
                      {services.map((service) => (
                        <option key={service.id} value={service.name}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="label">{isEn ? 'Visit format' : 'Формат визита'}</span>
                    <select className="input" value={visitType} onChange={(event) => setVisitType(event.target.value)}>
                      <option value="clinic_visit">{isEn ? 'In-clinic visit' : 'Очный визит'}</option>
                      <option value="video_consultation">{isEn ? 'Video consultation' : 'Видеоконсультация'}</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="label">{isEn ? 'Room / resource' : 'Кабинет / ресурс'}</span>
                    <select className="input" value={clinicResourceId} onChange={(event) => setClinicResourceId(event.target.value)} disabled={resourcesLoading || !resources.length}>
                      <option value="">{isEn ? 'Auto-assign' : 'Автоподбор'}</option>
                      {resources.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name} · {localizeResourceType(resource.resource_type)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="label">{isEn ? 'Duration (min)' : 'Длительность (мин.)'}</span>
                    <input
                      className="input"
                      type="number"
                      min="10"
                      max="240"
                      value={durationMinutes}
                      onChange={(event) => setDurationMinutes(Number(event.target.value) || 30)}
                    />
                  </label>
                </section>
              ) : null}

              {step >= 3 ? (
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-4 py-3 text-sm text-lapka-700">
                  <span className="font-semibold">{isEn ? 'Selected branch:' : 'Выбранный филиал:'}</span> {selectedClinicLocation?.address || '—'}
                  <br />
                  <span className="font-semibold">{isEn ? 'Room / resource:' : 'Кабинет / ресурс:'}</span> {selectedResource ? `${selectedResource.name} · ${localizeResourceType(selectedResource.resource_type)}` : (isEn ? 'Auto-assigned by clinic' : 'Автоподбор по клинике')}
                </div>
              ) : null}

              {step >= 4 ? (
                <section className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                    <label className="block">
                      <span className="label">{isEn ? 'Visit date' : 'Дата визита'}</span>
                      <input className="input" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
                    </label>

                    <label className="block">
                      <span className="label">{isEn ? 'Notes' : 'Комментарий'}</span>
                      <input
                        className="input"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={isEn ? 'What should be considered during the visit' : 'Что важно учесть на приёме'}
                      />
                    </label>
                  </div>

                  {slotsLoading ? (
                    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
                      {Array.from({ length: 10 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : slots.length ? (
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
                        {slots.map((slot) => {
                          const isSelected = slotValue === slot.start_at;
                          const timeLabel = new Date(slot.start_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                          return (
                            <button
                              key={slot.start_at}
                              type="button"
                              className={`rounded-xl border px-3 py-3 text-left text-sm transition ${slot.available ? isSelected ? 'border-sky-300 bg-sky-100 text-sky-900' : 'border-lapka-200 bg-white text-lapka-700 hover:border-sky-200 hover:bg-sky-50' : 'cursor-not-allowed border-lapka-200 bg-slate-50 text-lapka-500 opacity-80'}`}
                              onClick={() => slot.available && setSlotValue(slot.start_at)}
                              disabled={!slot.available}
                            >
                              <div className="font-semibold">{timeLabel}</div>
                              <div className={`mt-1 text-xs ${slot.available ? 'text-emerald-700' : 'text-lapka-500'}`}>{slot.available ? (isEn ? 'Available' : 'Свободно') : describeSlotConflict(slot, isEn)}</div>
                              {!slot.available && slot.room_label ? <div className="mt-1 text-[11px] text-lapka-400">{slot.room_label}</div> : null}
                            </button>
                          );
                        })}
                      </div>
                      {unavailableSlots.length ? (
                        <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-4 py-3 text-sm text-lapka-700">
                          <p className="font-semibold text-lapka-900">{isEn ? 'Why some slots are unavailable' : 'Почему часть слотов недоступна'}</p>
                          <ul className="mt-2 space-y-1 text-lapka-600">
                            <li>{isEn ? '• Vet occupied — another visit already uses this doctor at the same time.' : '• Занят врач — в это время уже идёт другой приём у выбранного врача.'}</li>
                            <li>{isEn ? '• Room occupied — conflict with room, diagnostics or telemedicine resource.' : '• Занят кабинет — конфликт по кабинету, диагностике или телемедицинской комнате.'}</li>
                            <li>{isEn ? '• Vet and room occupied — conflict on both scheduling dimensions.' : '• Заняты врач и кабинет — конфликт сразу по двум линиям расписания.'}</li>
                          </ul>
                        </div>
                      ) : null}
                      <div className="rounded-xl border border-lapka-200 bg-white px-4 py-3 text-sm text-lapka-700">
                        <span className="font-semibold text-lapka-900">{isEn ? 'Booking summary:' : 'Итог бронирования:'}</span>{' '}
                        {selectedClinic?.name || '—'} · {selectedClinicLocation?.address || '—'} · {selectedVet?.full_name || '—'}
                        <br />
                        <span className="font-semibold">{isEn ? 'Room / resource:' : 'Кабинет / ресурс:'}</span> {selectedResource ? selectedResource.name : (isEn ? 'Clinic auto-assignment' : 'Автоподбор клиники')}
                        <br />
                        <span className="font-semibold">{isEn ? 'Format:' : 'Формат:'}</span> {localizeVisitType(visitType, isEn ? 'en' : 'ru')}
                      </div>
                    </div>
                  ) : (
                    <EmptyState title={isEn ? 'No slots found' : 'Слоты не найдены'} text={isEn ? 'Pick another date, vet, branch or room.' : 'Выберите другую дату, врача, филиал или кабинет.'} />
                  )}
                </section>
              ) : null}

              <section className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                    disabled={step === 1}
                  >
                    {isEn ? 'Back' : 'Назад'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setStep((prev) => Math.min(4, prev + 1))}
                    disabled={step >= 4 || !canGoNextFromStep[step]}
                  >
                    {isEn ? 'Next' : 'Далее'}
                  </button>
                </div>

                <button className="btn-primary" type="submit" disabled={saving || !slotValue}>
                  {saving ? (isEn ? 'Creating appointment...' : 'Создаём запись...') : (isEn ? 'Confirm booking' : 'Подтвердить запись')}
                </button>
              </section>
            </form>
          </Card>

          <Card title={isEn ? 'My appointments' : 'Мои записи'} subtitle={isEn ? 'In-clinic and remote consultations' : 'Очные и дистанционные консультации'}>
            {appointmentRows.length ? (
              <Table columns={isEn ? ['Date & time', 'Service', 'Room', 'Format', 'Status', 'Actions'] : ['Дата и время', 'Услуга', 'Кабинет', 'Формат', 'Статус', 'Действия']} rows={appointmentRows} />
            ) : (
              <EmptyState title={isEn ? 'No appointments yet' : 'Пока нет записей'} text={isEn ? 'Create the first appointment using the wizard above.' : 'Создайте первую запись через мастер выше.'} />
            )}
          </Card>
        </>
      )}
      <ConfirmDialog
        open={Boolean(cancelConfirmId)}
        title={isEn ? 'Cancel selected appointment?' : 'Отменить выбранную запись?'}
        message={isEn ? 'This action cannot be automatically undone. Create a new appointment if needed.' : 'Действие нельзя откатить автоматически. При необходимости создайте новую запись.'}
        confirmLabel={isEn ? 'Yes, cancel' : 'Да, отменить'}
        cancelLabel={isEn ? 'No' : 'Нет'}
        danger
        loading={Boolean(cancelingId)}
        onCancel={() => setCancelConfirmId('')}
        onConfirm={() => onCancelAppointment(cancelConfirmId)}
      />
    </>
  );
}
