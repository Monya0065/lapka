'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import ClinicScopeSwitcher from '@/components/ui/ClinicScopeSwitcher';
import Drawer from '@/components/ui/Drawer';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import Tabs from '@/components/ui/Tabs';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';
import {
  appointmentDurationMinutes,
  buildBranchRoomOptions,
  buildBranchResourceChoices,
  buildRoomAssignmentMap,
  resolveResourceByName,
  resolveResourceForLane,
  buildLaneDefinitions,
  buildPatientMap,
  buildTimeSlots,
  filterAppointmentsForBranch,
  buildWeekDays,
  computeOverlaps,
  computeRoomConflicts,
  FLOW_STAGE_TO_STATUS,
  FLOWBOARD_COLUMNS,
  formatDateTimeLocal,
  formatShortDate,
  formatShortTime,
  getAppointmentEnd,
  localizeStage,
  localizeVisitType,
  resolveLaneIdForAppointment,
  readRoomAssignments,
  roomAssignmentForAppointment,
  setRoomAssignment,
  summarizeScheduler,
  weekRange,
} from '@/lib/clinic-operations';
import { localizePetBreed, localizePetSpecies } from '@/lib/pets';

const ROW_HEIGHT = 58;
const WEEK_DAYS = [
  { value: 0, label: 'Понедельник' },
  { value: 1, label: 'Вторник' },
  { value: 2, label: 'Среда' },
  { value: 3, label: 'Четверг' },
  { value: 4, label: 'Пятница' },
  { value: 5, label: 'Суббота' },
  { value: 6, label: 'Воскресенье' },
];

function toInputDate(date) {
  return date.toISOString().slice(0, 10);
}

function weekdayFromInput(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  const raw = date.getDay();
  return raw === 0 ? 6 : raw - 1;
}

function statusChip(status) {
  const map = {
    new: 'pill',
    scheduled: 'pill',
    confirmed: 'badge-green',
    waiting: 'badge-yellow',
    in_progress: 'badge-yellow',
    completed: 'badge-green',
    cancelled: 'badge-red',
    no_show: 'badge-red',
  };
  const labels = {
    new: 'Новая',
    scheduled: 'Запланирована',
    confirmed: 'Подтверждена',
    waiting: 'Ожидание',
    in_progress: 'На приёме',
    completed: 'Завершена',
    cancelled: 'Отменена',
    no_show: 'Неявка',
  };
  return <span className={map[status] || 'pill'}>{labels[status] || status}</span>;
}

function toIso(dateStringLocal) {
  return new Date(dateStringLocal).toISOString();
}

function formatDayCaption(dateValue) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function laneBadge(type) {
  if (type === 'resource') return 'Ресурс';
  if (type === 'room') return 'Кабинет';
  if (type === 'branch') return 'Филиал';
  return 'Врач';
}

export default function ClinicSchedulePage() {
  const { clinicId, clinics, branches, selectedClinic, selectedBranch, setClinicId, setBranchId } = useClinicScope();
  const [dateValue, setDateValue] = useState(toInputDate(new Date()));
  const [viewMode, setViewMode] = useState('day');
  const [selectedVetId, setSelectedVetId] = useState('');
  const [clinic, setClinic] = useState(null);
  const [members, setMembers] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [resources, setResources] = useState([]);
  const [schedulerSettings, setSchedulerSettings] = useState({
    default_buffer_minutes: 10,
    day_start_hour: 8,
    day_end_hour: 21,
    slot_interval_minutes: 30,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [dragState, setDragState] = useState({ appointmentId: '', laneId: '' });
  const [roomAssignments, setRoomAssignments] = useState({});
  const [resizeState, setResizeState] = useState({
    appointmentId: '',
    startY: 0,
    initialDuration: 0,
    currentDuration: 0,
  });
  const [bufferMinutes, setBufferMinutes] = useState(10);
  const [appointmentDraft, setAppointmentDraft] = useState({
    scheduledAt: '',
    durationMinutes: 30,
    bufferMinutes: 10,
    vetId: '',
    stageId: '',
    roomName: '',
  });
  const [quickCreateForm, setQuickCreateForm] = useState({
    petId: '',
    ownerUserId: '',
    vetId: '',
    serviceType: 'Первичная консультация',
    scheduledAt: `${toInputDate(new Date())}T10:00`,
    durationMinutes: 30,
    bufferMinutes: 10,
    roomName: '',
    visitType: 'clinic_visit',
  });
  const [scheduleForm, setScheduleForm] = useState({
    vetId: '',
    weekday: weekdayFromInput(toInputDate(new Date())),
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: 30,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : '';
      const clinicPayload = await apiRequest(`/api/v1/clinics/me${query}`);
      const resolvedClinicId = clinicPayload?.id || clinicId;
      if (!resolvedClinicId) throw new Error('Не удалось определить клинику операционного контура.');

      const { start, end } = weekRange(dateValue);
      const appointmentParams = new URLSearchParams({
        clinic_id: resolvedClinicId,
        date_from: start,
        date_to: end,
        mine: 'false',
      });
      if (selectedBranch?.id) {
        appointmentParams.set('clinic_location_id', selectedBranch.id);
      }
      const [membersPayload, patientsPayload, appointmentsPayload, schedulesPayload, resourcesPayload, settingsPayload] = await Promise.all([
        apiRequest(`/api/v1/clinics/me/members${query}`),
        apiRequest(`/api/v1/clinics/me/patients${query}&limit=500`),
        apiRequest(`/api/v1/appointments?${appointmentParams.toString()}`),
        apiRequest(`/api/v1/appointments/doctor-schedules?clinic_id=${encodeURIComponent(resolvedClinicId)}`),
        apiRequest(`/api/v1/appointments/resources?clinic_id=${encodeURIComponent(resolvedClinicId)}`),
        apiRequest(
          `/api/v1/appointments/settings?clinic_id=${encodeURIComponent(resolvedClinicId)}${
            selectedBranch?.id ? `&clinic_location_id=${encodeURIComponent(selectedBranch.id)}` : ''
          }`
        ),
      ]);

      const [membersRows, patientRows, appointmentRows, scheduleRows, resourceRows] = [
        Array.isArray(membersPayload) ? membersPayload : [],
        Array.isArray(patientsPayload) ? patientsPayload : [],
        Array.isArray(appointmentsPayload) ? appointmentsPayload : [],
        Array.isArray(schedulesPayload) ? schedulesPayload : [],
        Array.isArray(resourcesPayload) ? resourcesPayload : [],
      ];

      setClinic(clinicPayload || null);
      setMembers(membersRows);
      setPatients(patientRows);
      setAppointments(appointmentRows);
      setSchedules(scheduleRows);
      setResources(resourceRows);
      const normalizedSettings = {
        default_buffer_minutes: Number(settingsPayload?.default_buffer_minutes) || 10,
        day_start_hour: Number(settingsPayload?.day_start_hour) || 8,
        day_end_hour: Number(settingsPayload?.day_end_hour) || 21,
        slot_interval_minutes: Number(settingsPayload?.slot_interval_minutes) || 30,
      };
      setSchedulerSettings(normalizedSettings);
      setBufferMinutes(normalizedSettings.default_buffer_minutes);

      setScheduleForm((prev) => ({
        ...prev,
        vetId: prev.vetId || membersRows.find((row) => row.role_in_clinic === 'vet')?.user_id || '',
        weekday: weekdayFromInput(dateValue),
        slotDuration: prev.slotDuration || normalizedSettings.slot_interval_minutes,
      }));
      setSelectedVetId((prev) => prev || membersRows.find((row) => row.role_in_clinic === 'vet')?.user_id || '');
      const defaultRoom = buildBranchRoomOptions(branches, selectedBranch?.id || '', resourceRows)[0] || '';
      setQuickCreateForm((prev) => ({
        ...prev,
        petId: prev.petId || patientRows[0]?.pet_id || '',
        ownerUserId: prev.ownerUserId || patientRows[0]?.owner_user_id || '',
        vetId: prev.vetId || membersRows.find((row) => row.role_in_clinic === 'vet')?.user_id || '',
        scheduledAt: prev.scheduledAt || `${dateValue}T10:00`,
        bufferMinutes: Number.isFinite(prev.bufferMinutes) ? prev.bufferMinutes : normalizedSettings.default_buffer_minutes,
        roomName: prev.roomName || defaultRoom,
      }));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить операционный экран расписания.');
      setClinic(null);
      setMembers([]);
      setPatients([]);
      setAppointments([]);
      setSchedules([]);
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [branches, clinicId, dateValue, selectedBranch?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const persistedAssignments = readRoomAssignments(clinic?.id || clinicId);
    const backendAssignments = buildRoomAssignmentMap(appointments, resources);
    setRoomAssignments({ ...persistedAssignments, ...backendAssignments });
  }, [appointments, clinic?.id, clinicId, resources]);

  const vets = useMemo(
    () => members.filter((row) => row.role_in_clinic === 'vet'),
    [members]
  );
  const resourceChoices = useMemo(
    () => buildBranchResourceChoices(branches, selectedBranch?.id || '', resources),
    [branches, resources, selectedBranch?.id]
  );
  const roomOptions = useMemo(
    () => buildBranchRoomOptions(branches, selectedBranch?.id || '', resources),
    [branches, resources, selectedBranch?.id]
  );

  const patientMap = useMemo(() => buildPatientMap(patients), [patients]);

  const appointmentsInScope = useMemo(
    () => filterAppointmentsForBranch(appointments, branches, selectedBranch?.id),
    [appointments, branches, selectedBranch]
  );

  const selectedDateAppointments = useMemo(
    () => appointmentsInScope.filter((row) => row.scheduled_at.slice(0, 10) === dateValue),
    [appointmentsInScope, dateValue]
  );

  const selectedWeekday = weekdayFromInput(dateValue);
  const daySchedules = useMemo(
    () => schedules.filter((row) => row.weekday === selectedWeekday && row.is_active),
    [schedules, selectedWeekday]
  );

  const lanes = useMemo(
    () =>
      buildLaneDefinitions({
        mode: viewMode,
        vets,
        appointments: selectedDateAppointments,
        clinics,
        selectedClinic: clinic || selectedClinic,
        selectedVetId,
        branches,
        selectedBranchId: selectedBranch?.id || '',
        explicitMap: roomAssignments,
        resources,
      }),
    [branches, clinic, clinics, resources, roomAssignments, selectedBranch, selectedClinic, selectedDateAppointments, selectedVetId, vets, viewMode]
  );

  const schedulerAppointments = useMemo(() => {
    if (viewMode === 'doctor' && selectedVetId) {
      return selectedDateAppointments.filter((appointment) => appointment.vet_id === selectedVetId);
    }
    return selectedDateAppointments;
  }, [selectedDateAppointments, selectedVetId, viewMode]);

  const overlaps = useMemo(() => computeOverlaps(schedulerAppointments, bufferMinutes), [bufferMinutes, schedulerAppointments]);
  const roomConflicts = useMemo(
    () => computeRoomConflicts(schedulerAppointments, branches, bufferMinutes, resources, roomAssignments),
    [branches, bufferMinutes, resources, roomAssignments, schedulerAppointments]
  );
  const slots = useMemo(
    () =>
      buildTimeSlots({
        dateValue,
        startHour: schedulerSettings.day_start_hour,
        endHour: schedulerSettings.day_end_hour,
        intervalMinutes: schedulerSettings.slot_interval_minutes,
      }),
    [dateValue, schedulerSettings.day_end_hour, schedulerSettings.day_start_hour, schedulerSettings.slot_interval_minutes]
  );
  const slotMinutes = Number(schedulerSettings.slot_interval_minutes) || 30;
  const dayStartHour = Number(schedulerSettings.day_start_hour) || 8;
  const schedulerSummary = useMemo(
    () => summarizeScheduler({ appointments: schedulerAppointments, lanes, overlaps, roomConflicts }),
    [schedulerAppointments, lanes, overlaps, roomConflicts]
  );
  const weekDays = useMemo(() => buildWeekDays(dateValue, appointmentsInScope), [appointmentsInScope, dateValue]);
  const dayScheduleCount = daySchedules.length;

  const selectedAppointment = useMemo(
    () => schedulerAppointments.find((row) => row.id === selectedAppointmentId) || appointments.find((row) => row.id === selectedAppointmentId) || null,
    [appointments, schedulerAppointments, selectedAppointmentId]
  );

  useEffect(() => {
    if (!selectedAppointment) return;
    setAppointmentDraft({
      scheduledAt: formatDateTimeLocal(selectedAppointment.scheduled_at),
      durationMinutes: appointmentDurationMinutes(selectedAppointment),
      bufferMinutes: Number(selectedAppointment.buffer_minutes ?? bufferMinutes) || 10,
      vetId: selectedAppointment.vet_id || '',
      stageId: selectedAppointment.flow_stage || '',
      roomName: roomAssignmentForAppointment(clinic?.id || clinicId, selectedAppointment, branches, roomAssignments, resources),
    });
  }, [branches, bufferMinutes, clinic?.id, clinicId, resources, roomAssignments, selectedAppointment]);

  async function createShift(event) {
    event.preventDefault();
    if (!clinic?.id || !scheduleForm.vetId) {
      setError('Выберите врача и клинику для настройки смены.');
      return;
    }

    setError('');
    setSuccess('');

    try {
      await apiRequest('/api/v1/appointments/doctor-schedules', {
        method: 'POST',
        body: {
          clinic_id: clinic.id,
          vet_id: scheduleForm.vetId,
          weekday: Number(scheduleForm.weekday),
          start_time: scheduleForm.startTime,
          end_time: scheduleForm.endTime,
          slot_duration: Number(scheduleForm.slotDuration),
        },
      });
      setSuccess('Смена врача добавлена.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось добавить смену.');
    }
  }

  async function saveSchedulerSettings() {
    if (!clinic?.id) {
      setError('Не удалось определить клинику для сохранения настроек календаря.');
      return;
    }

    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/api/v1/appointments/settings', {
        method: 'PATCH',
        body: {
          clinic_id: clinic.id,
          clinic_location_id: selectedBranch?.id || null,
          default_buffer_minutes: Number(bufferMinutes) || 0,
          day_start_hour: Number(schedulerSettings.day_start_hour) || 8,
          day_end_hour: Number(schedulerSettings.day_end_hour) || 21,
          slot_interval_minutes: Number(schedulerSettings.slot_interval_minutes) || 30,
        },
      });
      setSchedulerSettings({
        default_buffer_minutes: Number(payload?.default_buffer_minutes) || 10,
        day_start_hour: Number(payload?.day_start_hour) || 8,
        day_end_hour: Number(payload?.day_end_hour) || 21,
        slot_interval_minutes: Number(payload?.slot_interval_minutes) || 30,
      });
      setBufferMinutes(Number(payload?.default_buffer_minutes) || 10);
      setSuccess('Настройки календаря сохранены.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось сохранить настройки календаря.');
    }
  }

  async function createAppointment(event) {
    event.preventDefault();
    if (!clinic?.id || !quickCreateForm.petId || !quickCreateForm.vetId) {
      setError('Выберите пациента, врача и клинику для быстрой записи.');
      return;
    }

    setError('');
    setSuccess('');
    try {
      const selectedResource = resolveResourceByName(resources, selectedBranch?.id || '', quickCreateForm.roomName);
      const createdAppointment = await apiRequest('/api/v1/appointments', {
        method: 'POST',
        body: {
          ...(selectedResource ? { clinic_resource_id: selectedResource.id } : {}),
          clinic_id: clinic.id,
          pet_id: quickCreateForm.petId,
          owner_user_id: quickCreateForm.ownerUserId || undefined,
          vet_id: quickCreateForm.vetId,
          service_type: quickCreateForm.serviceType,
          scheduled_at: toIso(quickCreateForm.scheduledAt),
          duration_minutes: Number(quickCreateForm.durationMinutes) || 30,
          buffer_minutes: Number(quickCreateForm.bufferMinutes) || 0,
          room_label: quickCreateForm.roomName || undefined,
          clinic_location_id: selectedBranch?.id || undefined,
          visit_type: quickCreateForm.visitType,
          status: 'scheduled',
          notes: 'Быстро создано из операционного календаря',
        },
      });
      if (quickCreateForm.roomName && createdAppointment?.id) {
        setRoomAssignments(setRoomAssignment(clinic.id, createdAppointment.id, quickCreateForm.roomName));
      }
      setSuccess('Запись создана.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать запись.');
    }
  }

  async function applyAction(appointmentId, endpoint, successText) {
    setActionLoadingId(appointmentId);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/appointments/${appointmentId}/${endpoint}`, {
        method: 'POST',
        body: { notes: 'Операционное действие администратора клиники' },
      });
      setSuccess(successText);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обновить запись.');
    } finally {
      setActionLoadingId('');
    }
  }

  async function saveAppointmentChanges() {
    if (!selectedAppointment) return;
    setActionLoadingId(selectedAppointment.id);
    setError('');
    setSuccess('');

    try {
      const stageId = appointmentDraft.stageId || selectedAppointment.flow_stage || '';
      const backendStatus = stageId ? FLOW_STAGE_TO_STATUS[stageId] : undefined;
      await apiRequest(`/api/v1/appointments/${selectedAppointment.id}`, {
        method: 'PATCH',
        body: {
          clinic_resource_id: resolveResourceByName(
            resources,
            selectedBranch?.id || selectedAppointment.clinic_location_id || '',
            appointmentDraft.roomName
          )?.id || null,
          scheduled_at: appointmentDraft.scheduledAt ? toIso(appointmentDraft.scheduledAt) : undefined,
          duration_minutes: Number(appointmentDraft.durationMinutes) || appointmentDurationMinutes(selectedAppointment),
          buffer_minutes: Number(appointmentDraft.bufferMinutes) || 0,
          vet_id: appointmentDraft.vetId || selectedAppointment.vet_id,
          room_label: appointmentDraft.roomName || null,
          clinic_location_id: selectedBranch?.id || selectedAppointment.clinic_location_id || null,
          flow_stage: stageId || null,
          status: backendStatus,
          notes: 'Обновлено из операционного планировщика',
        },
      });
      setRoomAssignments(setRoomAssignment(clinic?.id || clinicId, selectedAppointment.id, appointmentDraft.roomName || ''));
      setSuccess('Запись обновлена.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось сохранить изменения по записи.');
    } finally {
      setActionLoadingId('');
    }
  }

  useEffect(() => {
    if (!resizeState.appointmentId) return undefined;

    function handleMouseMove(event) {
      const deltaY = event.clientY - resizeState.startY;
      const slotDelta = Math.round(deltaY / ROW_HEIGHT);
      const nextDuration = Math.max(
        10,
        Math.min(240, resizeState.initialDuration + slotDelta * slotMinutes)
      );
      setResizeState((prev) => ({ ...prev, currentDuration: nextDuration }));
    }

    async function handleMouseUp() {
      const appointment = schedulerAppointments.find((row) => row.id === resizeState.appointmentId)
        || appointments.find((row) => row.id === resizeState.appointmentId);
      const nextDuration = resizeState.currentDuration;
      const appointmentId = resizeState.appointmentId;
      const shouldPersist = appointment && nextDuration !== appointmentDurationMinutes(appointment);

      setResizeState({ appointmentId: '', startY: 0, initialDuration: 0, currentDuration: 0 });
      if (!appointment || !shouldPersist) return;

      setActionLoadingId(appointmentId);
      setError('');
      setSuccess('');
      try {
        await apiRequest(`/api/v1/appointments/${appointmentId}`, {
          method: 'PATCH',
          body: {
            duration_minutes: nextDuration,
            notes: 'Изменена длительность блока из операционного календаря',
          },
        });
        setSuccess(`Длительность записи обновлена: ${nextDuration} мин.`);
        await loadData();
      } catch (requestError) {
        setError(requestError.message || 'Не удалось изменить длительность записи.');
      } finally {
        setActionLoadingId('');
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [appointments, loadData, resizeState, schedulerAppointments, slotMinutes]);

  const handleDrop = useCallback(async (lane, slotDate) => {
    if (!dragState.appointmentId) return;
    const appointment = schedulerAppointments.find((row) => row.id === dragState.appointmentId) || appointments.find((row) => row.id === dragState.appointmentId);
    if (!appointment) return;

    setActionLoadingId(appointment.id);
    setError('');
    setSuccess('');

    try {
      const body = {
        scheduled_at: slotDate.toISOString(),
        clinic_location_id: lane.type === 'branch' ? lane.id : selectedBranch?.id || appointment.clinic_location_id || null,
        notes: 'Перенесено из операционного календаря',
      };
      if (lane.type === 'doctor') {
        body.vet_id = lane.id;
      }
      if (lane.type === 'resource') {
        const nextResource = resolveResourceForLane(
          resources,
          selectedBranch?.id || appointment.clinic_location_id || '',
          lane.id,
          appointment
        );
        body.clinic_resource_id = nextResource?.id || null;
        body.room_label = nextResource?.name || appointment.room_label || null;
      }
      if (lane.type === 'room') {
        body.room_label = lane.id;
        body.clinic_resource_id = resolveResourceByName(resources, selectedBranch?.id || appointment.clinic_location_id || '', lane.id)?.id || null;
      }
      await apiRequest(`/api/v1/appointments/${appointment.id}`, {
        method: 'PATCH',
        body,
      });
      if (lane.type === 'room') {
        setRoomAssignments(setRoomAssignment(clinic?.id || clinicId, appointment.id, lane.id));
      }
      if (lane.type === 'resource') {
        const nextResource = resolveResourceForLane(
          resources,
          selectedBranch?.id || appointment.clinic_location_id || '',
          lane.id,
          appointment
        );
        if (nextResource?.name) {
          setRoomAssignments(setRoomAssignment(clinic?.id || clinicId, appointment.id, nextResource.name));
        }
      }
      setSuccess('Запись перенесена в новый слот.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось перенести запись.');
    } finally {
      setDragState({ appointmentId: '', laneId: '' });
      setActionLoadingId('');
    }
  }, [appointments, clinic?.id, clinicId, dragState.appointmentId, loadData, resources, schedulerAppointments, selectedBranch?.id]);

  const schedulerBoard = useMemo(() => {
    if (!lanes.length) {
      return <EmptyState title="Нет активных линий" text="Добавьте врача в смену или переключите режим просмотра." />;
    }

    const gridTemplateColumns = `84px repeat(${lanes.length}, minmax(240px, 1fr))`;
    const boardHeight = slots.length * ROW_HEIGHT;

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[980px]" style={{ display: 'grid', gridTemplateColumns }}>
          <div className="sticky left-0 z-10 rounded-l-2xl border-b border-r border-lapka-200 bg-white/95 px-3 py-4 text-xs font-bold uppercase tracking-[0.18em] text-lapka-500">
            Время
          </div>
          {lanes.map((lane) => (
            <div key={lane.id} className="border-b border-lapka-200 bg-white/95 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-extrabold text-lapka-900">{lane.title}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-lapka-500">{laneBadge(lane.type)}</p>
                </div>
                <span className="pill !px-3 !py-1 text-xs">{lane.subtitle}</span>
              </div>
            </div>
          ))}

          <div className="sticky left-0 z-[5] border-r border-lapka-200 bg-white/90">
            {slots.map((slot, index) => (
              <div
                key={slot.toISOString()}
                className="border-b border-lapka-100 px-3 py-2 text-right text-xs font-semibold text-lapka-500"
                style={{ height: ROW_HEIGHT }}
              >
                {index % 2 === 0 ? formatShortTime(slot.toISOString()) : ''}
              </div>
            ))}
          </div>

          {lanes.map((lane) => {
            const laneAppointments = schedulerAppointments
              .filter((appointment) => resolveLaneIdForAppointment(appointment, viewMode, { branches, explicitMap: roomAssignments, resources }) === lane.id)
              .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

            return (
              <div key={lane.id} className="relative border-l border-lapka-200 bg-white/80">
                <div className="relative" style={{ height: boardHeight }}>
                  {slots.map((slot, index) => (
                    <button
                      key={`${lane.id}-${slot.toISOString()}`}
                      type="button"
                      aria-label={`Перенести запись в слот ${formatShortTime(slot.toISOString())}`}
                      className="absolute inset-x-0 border-b border-lapka-100 transition hover:bg-lapka-50/80"
                      style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDrop(lane, slot);
                      }}
                    />
                  ))}

                  {laneAppointments.map((appointment) => {
                    const start = new Date(appointment.scheduled_at);
                    const minutesFromStart = (start.getHours() - dayStartHour) * 60 + start.getMinutes();
                    const slotIndex = Math.max(0, Math.round(minutesFromStart / slotMinutes));
                    const top = slotIndex * ROW_HEIGHT + 4;
                    const visualDuration = resizeState.appointmentId === appointment.id
                      ? resizeState.currentDuration
                      : appointmentDurationMinutes(appointment);
                    const span = Math.max(1, Math.ceil(visualDuration / slotMinutes));
                    const height = Math.max(ROW_HEIGHT - 10, span * ROW_HEIGHT - 8);
                    const patient = patientMap[appointment.pet_id];
                    const stageId = appointment.flow_stage || '';
                    const stageLabel = stageId ? localizeStage(stageId) : '';
                    const roomName = roomAssignmentForAppointment(clinic?.id || clinicId, appointment, branches, roomAssignments, resources);
                    const appointmentEnd = new Date(start.getTime() + visualDuration * 60 * 1000);

                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        draggable
                        onDragStart={() => setDragState({ appointmentId: appointment.id, laneId: lane.id })}
                        onClick={() => setSelectedAppointmentId(appointment.id)}
                        className={`absolute left-2 right-2 rounded-2xl border px-3 py-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card ${
                          overlaps[appointment.id]
                            ? 'border-amber-300 bg-amber-50/95'
                            : appointment.status === 'in_progress'
                              ? 'border-lapka-300 bg-cyan-50/95'
                              : 'border-lapka-200 bg-white/96'
                        }`}
                        style={{ top, height }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-extrabold text-lapka-900">{formatShortTime(appointment.scheduled_at)} · {patient?.pet_name || 'Пациент'}</p>
                            <p className="text-sm text-lapka-700">{appointment.service_type || appointment.service_name}</p>
                          </div>
                          {statusChip(appointment.status)}
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-lapka-600">
                          <p>{patient?.owner_name || 'Владелец скрыт'} · {localizeVisitType(appointment.visit_type)}</p>
                          <p>{visualDuration} мин · {formatShortTime(appointmentEnd.toISOString())}</p>
                          <p>{roomName}</p>
                          {stageLabel ? <p className="font-semibold text-lapka-700">{stageLabel}</p> : null}
                          {resizeState.appointmentId === appointment.id ? (
                            <p className="font-semibold text-lapka-700">Новая длительность: {resizeState.currentDuration} мин</p>
                          ) : null}
                          {overlaps[appointment.id] ? <p className="font-semibold text-amber-700">Есть пересечение или нарушен буфер</p> : null}
                          {roomConflicts[appointment.id] ? <p className="font-semibold text-rose-700">Конфликт по кабинету или ресурсу</p> : null}
                        </div>
                        <span
                          role="presentation"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setResizeState({
                              appointmentId: appointment.id,
                              startY: event.clientY,
                              initialDuration: appointmentDurationMinutes(appointment),
                              currentDuration: appointmentDurationMinutes(appointment),
                            });
                          }}
                          className="absolute bottom-2 right-2 flex h-4 w-10 cursor-ns-resize items-center justify-center rounded-full border border-lapka-300 bg-white/90 text-[10px] font-bold uppercase tracking-[0.16em] text-lapka-500"
                        >
                          ↕
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [
    branches,
    clinic?.id,
    clinicId,
    handleDrop,
    lanes,
    overlaps,
    patientMap,
    resources,
    resizeState.appointmentId,
    resizeState.currentDuration,
    roomConflicts,
    schedulerAppointments,
    slots,
    slotMinutes,
    dayStartHour,
    roomAssignments,
    viewMode,
  ]);

  const scheduleTabs = useMemo(
    () => [
      {
        id: 'day',
        label: 'День',
        content: (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lapka-200 bg-white/90 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-lapka-500">Дневной операционный календарь</p>
                <p className="text-base font-semibold text-lapka-800">{formatDayCaption(dateValue)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary !px-3 !py-1.5 text-sm" type="button" onClick={() => setViewMode('doctor')}>
                  Фокус на враче
                </button>
                <a className="btn-secondary !px-3 !py-1.5 text-sm" href="/clinic/flowboard">
                  Открыть поток дня
                </a>
              </div>
            </div>
            {schedulerBoard}
          </div>
        ),
      },
      {
        id: 'week',
        label: 'Неделя',
        content: (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            {weekDays.map((day) => (
              <button
                key={day.id}
                type="button"
                className={`surface-card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-card ${day.id === dateValue ? 'ring-2 ring-lapka-300' : ''}`}
                onClick={() => {
                  setDateValue(day.id);
                  setViewMode('day');
                }}
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-lapka-500">{formatShortDate(day.date.toISOString())}</p>
                <h3 className="mt-2 text-2xl font-extrabold text-lapka-900">{day.count}</h3>
                <p className="text-sm text-lapka-600">всего записей</p>
                <div className="mt-4 space-y-1 text-sm text-lapka-700">
                  <p>Подтверждены: {day.confirmed}</p>
                  <p>В работе: {day.inProgress}</p>
                  <p>Видео: {day.telemedicine}</p>
                </div>
              </button>
            ))}
          </div>
        ),
      },
      {
        id: 'doctor',
        label: 'Врач',
        content: (
          <div className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px] items-start">
              <Card title="Фокус по врачу" subtitle="Переключайте линию врача и перенастраивайте поток в один клик." dense>
                {schedulerBoard}
              </Card>
              <Card title="Выбор врача" subtitle="Личный поток и загрузка смен." dense tone="mint">
                <div className="space-y-3">
                  <select className="input" value={selectedVetId} onChange={(event) => setSelectedVetId(event.target.value)}>
                    {vets.map((vet) => (
                      <option key={vet.user_id} value={vet.user_id}>
                        {vet.full_name}
                      </option>
                    ))}
                  </select>
                  <div className="space-y-2 text-sm text-lapka-700">
                    {daySchedules
                      .filter((row) => row.vet_id === selectedVetId)
                      .map((row) => (
                        <div key={row.id} className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                          {row.start_time}–{row.end_time} · слот {row.slot_duration} мин
                        </div>
                      ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ),
      },
      {
        id: 'resource',
        label: 'Ресурс',
        content: (
          <div className="space-y-4">
            <Card title="Ресурсные линии" subtitle="Диагностические и телемедицинские потоки собраны по типу услуги.">
              {schedulerBoard}
            </Card>
          </div>
        ),
      },
      {
        id: 'room',
        label: 'Кабинет',
        content: (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)] items-start">
            <Card title="Поток по кабинетам" subtitle="Линии календаря строятся по кабинетам и процедурным выбранного филиала.">
              {schedulerBoard}
            </Card>
            <Card title="Кабинеты филиала" subtitle="Переносите записи между кабинетами, отслеживайте загрузку и конфликты по времени." tone="mint">
              <div className="space-y-3">
                {roomOptions.length ? roomOptions.map((roomName) => {
                  const roomCount = selectedDateAppointments.filter((appointment) => roomAssignmentForAppointment(clinic?.id || clinicId, appointment, branches, roomAssignments, resources) === roomName).length;
                  return (
                    <div key={roomName} className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-extrabold text-lapka-900">{roomName}</p>
                          <p className="mt-1 text-sm text-lapka-600">Записей на день: {roomCount}</p>
                        </div>
                        <span className="pill !px-3 !py-1 text-xs">{roomCount ? 'Активен' : 'Свободен'}</span>
                      </div>
                    </div>
                  );
                }) : (
                  <EmptyState title="Кабинеты не настроены" text="Добавьте комнаты в филиал, чтобы календарь строился по кабинетам." />
                )}
                <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-4 py-3 text-sm text-lapka-700">
                  Если две записи попадают в один кабинет с пересечением по времени или буферу, карточка подсветится как конфликт по кабинету.
                </div>
              </div>
            </Card>
          </div>
        ),
      },
      {
        id: 'branch',
        label: 'Филиал',
        content: (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)] items-start">
            <Card title="Филиалы выбранной клиники" subtitle="Переключайте конкретный филиал и сразу меняйте контекст расписания." tone="mint">
              <div className="grid gap-3 md:grid-cols-2">
                {branches.map((branchRow) => {
                  const isSelected = branchRow.id === selectedBranch?.id;
                  return (
                    <article key={branchRow.id} className={`rounded-2xl border p-4 ${isSelected ? 'border-lapka-300 bg-cyan-50/90' : 'border-lapka-200 bg-white'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-extrabold text-lapka-900">{branchRow.address || 'Филиал'}</h4>
                          <p className="mt-1 text-sm text-lapka-600">{[branchRow.city, branchRow.hours].filter(Boolean).join(' · ') || 'Контур филиала'}</p>
                        </div>
                        {isSelected ? <span className="badge-green">Текущий филиал</span> : null}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!isSelected ? (
                          <button className="btn-secondary !px-3 !py-1.5 text-sm" type="button" onClick={() => setBranchId(branchRow.id)}>
                            Переключить филиал
                          </button>
                        ) : (
                          <span className="pill !px-3 !py-1.5 text-sm">Уже выбран</span>
                        )}
                        <a className="btn-secondary !px-3 !py-1.5 text-sm" href="/clinic/flowboard">
                          Открыть поток дня
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </Card>

            <Card title="Что важно по филиалу" subtitle="Дневные сигналы по выбранному филиалу.">
              <div className="space-y-3 text-sm text-lapka-700">
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="font-semibold text-lapka-900">Записей на день: {selectedDateAppointments.length}</p>
                  <p className="mt-1">Вид собран по текущему филиалу, поэтому календарь и поток показывают только его контекст.</p>
                </div>
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="font-semibold text-lapka-900">Активные смены: {dayScheduleCount}</p>
                  <p className="mt-1">Проверьте перекрытия и буфер между консультациями перед пиком дня.</p>
                </div>
              </div>
            </Card>
          </div>
        ),
      },
    ],
    [branches, clinic?.id, clinicId, dateValue, dayScheduleCount, daySchedules, resources, roomAssignments, roomOptions, schedulerBoard, selectedBranch, selectedDateAppointments, selectedVetId, setBranchId, vets, weekDays]
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Операционный календарь и поток клиники</h1>
          <p className="page-subtitle">
            Единый операционный слой для дня, недели, врачей, ресурсов и филиалов без перехода между разрозненными таблицами.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <ClinicScopeSwitcher showBranchHint />
          <label className="block min-w-[210px]">
            <span className="label">Дата</span>
            <input className="input" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
          </label>
          <a className="btn-primary" href="/clinic/flowboard">
            Открыть поток дня
          </a>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      {loading ? (
        <section className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </section>
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Операционный слой"
            title={`${clinic?.name || 'Клиника'}${selectedBranch ? ` · ${selectedBranch.address}` : ''} · расписание, ресурсы и поток на ${formatDayCaption(dateValue)}`}
            description="Новый операционный календарь собирает день по врачам, ресурсам, филиалам и неделе. Перетаскивайте слоты, меняйте длительность, отслеживайте пересечения и сразу открывайте поток дня."
            imageSrc="/assets/img/clinic-ops.svg"
            imageAlt="Операционный scheduler клиники"
            badges={[
              `${schedulerSummary.appointments} записей`,
              `${schedulerSummary.lanes} активных линий`,
              `${schedulerSummary.telemedicine} видео`,
            ]}
          />

          <section className="kpi-grid">
            <StatsCard label="В очереди" value={schedulerSummary.waiting} trend="Новые, подтверждённые и ожидающие" icon="Очередь" />
            <StatsCard label="В работе" value={schedulerSummary.active} trend="Приёмы в активной зоне" icon="Поток" />
            <StatsCard label="Пересечения" value={schedulerSummary.overlaps} trend="Блоки с overlap warning" icon="Риск" />
            <StatsCard label="Конфликты кабинетов" value={schedulerSummary.roomConflicts} trend="Наложения по room/resource" icon="Кабинет" />
            <StatsCard label="Смены" value={dayScheduleCount} trend="Активные смены врачей" icon="День" />
          </section>

          <section className="grid-soft-2 items-start">
            <Card title="Режим просмотра" subtitle="Переключайте грамматику расписания без выхода из экрана." dense tone="tinted">
              <div className="flex flex-wrap gap-2">
                {[
                  ['day', 'День'],
                  ['week', 'Неделя'],
                  ['doctor', 'Врач'],
                  ['resource', 'Ресурс'],
                  ['room', 'Кабинет'],
                  ['branch', 'Филиал'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={viewMode === id ? 'btn-primary !px-4 !py-2 text-sm' : 'btn-secondary !px-4 !py-2 text-sm'}
                    onClick={() => setViewMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Card>

            <Card title="Настроить смену врача" subtitle="Рабочие часы и буфер сохраняются для клиники или филиала." dense tone="mint">
              <form className="grid gap-3 xl:grid-cols-2 items-end" onSubmit={createShift}>
                <label className="block">
                  <span className="label">Врач</span>
                  <select className="input" value={scheduleForm.vetId} onChange={(event) => setScheduleForm((prev) => ({ ...prev, vetId: event.target.value }))}>
                    {vets.map((vet) => (
                      <option key={vet.user_id} value={vet.user_id}>
                        {vet.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">День недели</span>
                  <select className="input" value={scheduleForm.weekday} onChange={(event) => setScheduleForm((prev) => ({ ...prev, weekday: Number(event.target.value) }))}>
                    {WEEK_DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Начало</span>
                  <input className="input" type="time" value={scheduleForm.startTime} onChange={(event) => setScheduleForm((prev) => ({ ...prev, startTime: event.target.value }))} />
                </label>
                <label className="block">
                  <span className="label">Конец</span>
                  <input className="input" type="time" value={scheduleForm.endTime} onChange={(event) => setScheduleForm((prev) => ({ ...prev, endTime: event.target.value }))} />
                </label>
                <label className="block">
                  <span className="label">Буфер между слотами</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="120"
                    value={bufferMinutes}
                    onChange={(event) => setBufferMinutes(Number(event.target.value) || 0)}
                  />
                </label>
                <label className="block">
                  <span className="label">Начало дня</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="23"
                    value={schedulerSettings.day_start_hour}
                    onChange={(event) => setSchedulerSettings((prev) => ({ ...prev, day_start_hour: Number(event.target.value) || 8 }))}
                  />
                </label>
                <label className="block">
                  <span className="label">Конец дня</span>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="24"
                    value={schedulerSettings.day_end_hour}
                    onChange={(event) => setSchedulerSettings((prev) => ({ ...prev, day_end_hour: Number(event.target.value) || 21 }))}
                  />
                </label>
                <label className="block">
                  <span className="label">Длительность слота</span>
                  <input className="input" type="number" min="10" max="180" value={scheduleForm.slotDuration} onChange={(event) => setScheduleForm((prev) => ({ ...prev, slotDuration: Number(event.target.value) || 30 }))} />
                </label>
                <label className="block">
                  <span className="label">Шаг сетки</span>
                  <input
                    className="input"
                    type="number"
                    min="10"
                    max="180"
                    value={schedulerSettings.slot_interval_minutes}
                    onChange={(event) => setSchedulerSettings((prev) => ({ ...prev, slot_interval_minutes: Number(event.target.value) || 30 }))}
                  />
                </label>
                <button className="btn-primary" type="submit">Добавить смену</button>
                <button className="btn-secondary" type="button" onClick={saveSchedulerSettings}>Сохранить настройки календаря</button>
              </form>
            </Card>
          </section>

          <section className="grid-soft-2 items-start">
            <Card title="Быстро создать запись" subtitle="Создание слота без выхода из календаря." dense>
              <form className="grid gap-3 xl:grid-cols-2 items-end" onSubmit={createAppointment}>
                <label className="block">
                  <span className="label">Пациент</span>
                  <select
                    className="input"
                    value={quickCreateForm.petId}
                    onChange={(event) => {
                      const patient = patients.find((row) => row.pet_id === event.target.value);
                      setQuickCreateForm((prev) => ({
                        ...prev,
                        petId: event.target.value,
                        ownerUserId: patient?.owner_user_id || '',
                      }));
                    }}
                  >
                    {patients.map((patient) => (
                      <option key={patient.pet_id} value={patient.pet_id}>
                        {patient.pet_name} · {patient.owner_name || 'Владелец'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Врач</span>
                  <select className="input" value={quickCreateForm.vetId} onChange={(event) => setQuickCreateForm((prev) => ({ ...prev, vetId: event.target.value }))}>
                    {vets.map((vet) => (
                      <option key={vet.user_id} value={vet.user_id}>
                        {vet.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Услуга</span>
                  <input className="input" value={quickCreateForm.serviceType} onChange={(event) => setQuickCreateForm((prev) => ({ ...prev, serviceType: event.target.value }))} />
                </label>
                <label className="block">
                  <span className="label">Формат</span>
                  <select className="input" value={quickCreateForm.visitType} onChange={(event) => setQuickCreateForm((prev) => ({ ...prev, visitType: event.target.value }))}>
                    <option value="clinic_visit">Очный визит</option>
                    <option value="video_consultation">Телемедицина</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Дата и время</span>
                  <input className="input" type="datetime-local" value={quickCreateForm.scheduledAt} onChange={(event) => setQuickCreateForm((prev) => ({ ...prev, scheduledAt: event.target.value }))} />
                </label>
                <label className="block">
                  <span className="label">Длительность</span>
                  <input className="input" type="number" min="10" max="240" value={quickCreateForm.durationMinutes} onChange={(event) => setQuickCreateForm((prev) => ({ ...prev, durationMinutes: Number(event.target.value) || 30 }))} />
                </label>
                <label className="block">
                  <span className="label">Буфер</span>
                  <input className="input" type="number" min="0" max="120" value={quickCreateForm.bufferMinutes} onChange={(event) => setQuickCreateForm((prev) => ({ ...prev, bufferMinutes: Number(event.target.value) || 0 }))} />
                </label>
                <label className="block">
                  <span className="label">Кабинет / ресурс</span>
                  <select className="input" value={quickCreateForm.roomName} onChange={(event) => setQuickCreateForm((prev) => ({ ...prev, roomName: event.target.value }))}>
                    {resourceChoices.map((resource) => (
                      <option key={resource.id} value={resource.name}>
                        {resource.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn-primary" type="submit">Создать запись</button>
              </form>
            </Card>

            <Card title="Что важно по дню" subtitle="Буфер, пересечения и линии ресурсов.">
              <div className="space-y-3 text-sm text-lapka-700">
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="font-semibold text-lapka-900">Буфер по умолчанию: {bufferMinutes} мин</p>
                  <p className="mt-1">Новые записи получают этот буфер по умолчанию, а в карточке записи его можно переопределить.</p>
                </div>
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="font-semibold text-lapka-900">Рабочее окно: {schedulerSettings.day_start_hour}:00 - {schedulerSettings.day_end_hour}:00</p>
                  <p className="mt-1">Сетка строится по шагу {schedulerSettings.slot_interval_minutes} мин и сохраняется для выбранного контура.</p>
                </div>
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="font-semibold text-lapka-900">Конфликты по кабинетам: {schedulerSummary.roomConflicts}</p>
                  <p className="mt-1">Если две записи попадают в один кабинет с пересечением по времени или буферу, карточка подсвечивается отдельно.</p>
                </div>
              </div>
            </Card>
          </section>

          <Tabs items={scheduleTabs} value={viewMode} onChange={setViewMode} />
        </>
      )}

      <Drawer
        open={Boolean(selectedAppointment)}
        onClose={() => setSelectedAppointmentId('')}
        title={selectedAppointment ? `Запись · ${patientMap[selectedAppointment.pet_id]?.pet_name || 'Пациент'}` : 'Запись'}
        width="max-w-[560px]"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {selectedAppointment ? (
              <>
                <button
                  className="btn-secondary !px-3 !py-2 text-sm"
                  type="button"
                  disabled={actionLoadingId === selectedAppointment.id}
                  onClick={() => applyAction(selectedAppointment.id, 'confirm', 'Запись подтверждена.')}
                >
                  Подтвердить
                </button>
                <button
                  className="btn-secondary !px-3 !py-2 text-sm"
                  type="button"
                  disabled={actionLoadingId === selectedAppointment.id}
                  onClick={() => applyAction(selectedAppointment.id, 'start', 'Приём начат.')}
                >
                  Начать приём
                </button>
                <button
                  className="btn-secondary !px-3 !py-2 text-sm"
                  type="button"
                  disabled={actionLoadingId === selectedAppointment.id}
                  onClick={() => applyAction(selectedAppointment.id, 'complete', 'Приём завершён.')}
                >
                  Завершить
                </button>
                <button
                  className="btn-primary !px-4 !py-2 text-sm"
                  type="button"
                  disabled={actionLoadingId === selectedAppointment.id}
                  onClick={saveAppointmentChanges}
                >
                  Сохранить изменения
                </button>
              </>
            ) : null}
          </div>
        }
      >
        {selectedAppointment ? (
          <div className="space-y-4">
            <Card title="Контекст пациента" dense>
              <div className="space-y-1 text-sm text-lapka-700">
                <p className="text-lg font-extrabold text-lapka-900">{patientMap[selectedAppointment.pet_id]?.pet_name || 'Пациент'}</p>
                <p>{localizePetSpecies(patientMap[selectedAppointment.pet_id]?.species)} · {localizePetBreed(patientMap[selectedAppointment.pet_id]?.breed)}</p>
                <p>{patientMap[selectedAppointment.pet_id]?.owner_name || 'Владелец не указан'}</p>
                <p>{selectedAppointment.service_type || selectedAppointment.service_name} · {localizeVisitType(selectedAppointment.visit_type)}</p>
                <p>{statusChip(selectedAppointment.status)}</p>
              </div>
            </Card>

            <Card title="Управление блоком" subtitle="Перенос, смена врача и длительности внутри одного окна." dense tone="mint">
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Дата и время</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={appointmentDraft.scheduledAt}
                    onChange={(event) => setAppointmentDraft((prev) => ({ ...prev, scheduledAt: event.target.value }))}
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="label">Врач</span>
                    <select className="input" value={appointmentDraft.vetId} onChange={(event) => setAppointmentDraft((prev) => ({ ...prev, vetId: event.target.value }))}>
                      {vets.map((vet) => (
                        <option key={vet.user_id} value={vet.user_id}>
                          {vet.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Длительность</span>
                    <input
                      className="input"
                      type="number"
                      min="10"
                      max="240"
                      value={appointmentDraft.durationMinutes}
                      onChange={(event) => setAppointmentDraft((prev) => ({ ...prev, durationMinutes: Number(event.target.value) || 30 }))}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Буфер</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="120"
                      value={appointmentDraft.bufferMinutes}
                      onChange={(event) => setAppointmentDraft((prev) => ({ ...prev, bufferMinutes: Number(event.target.value) || 0 }))}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Кабинет / ресурс</span>
                    <select className="input" value={appointmentDraft.roomName} onChange={(event) => setAppointmentDraft((prev) => ({ ...prev, roomName: event.target.value }))}>
                      {resourceChoices.map((resource) => (
                        <option key={resource.id} value={resource.name}>
                          {resource.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="label">Стадия потока</span>
                  <select className="input" value={appointmentDraft.stageId} onChange={(event) => setAppointmentDraft((prev) => ({ ...prev, stageId: event.target.value }))}>
                    <option value="">Определять по статусу</option>
                    {FLOWBOARD_COLUMNS.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Card>

            <Card title="Что важно" dense>
              <div className="space-y-2 text-sm text-lapka-700">
                <p>Начало: {formatShortTime(selectedAppointment.scheduled_at)}</p>
                <p>Окончание: {formatShortTime(getAppointmentEnd(selectedAppointment).toISOString())}</p>
                <p>Смены врача на день: {daySchedules.filter((row) => row.vet_id === selectedAppointment.vet_id).length}</p>
                <p>Пересечение/буфер: {overlaps[selectedAppointment.id] ? 'Есть риск' : 'Чисто'}</p>
                <p>Конфликт по кабинету: {roomConflicts[selectedAppointment.id] ? 'Есть риск' : 'Чисто'}</p>
                <p>Кабинет: {appointmentDraft.roomName || 'Не выбран'}</p>
                <p>Буфер: {appointmentDraft.bufferMinutes || 0} мин</p>
              </div>
            </Card>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
