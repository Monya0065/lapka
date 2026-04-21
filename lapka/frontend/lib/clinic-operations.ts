export const FLOWBOARD_COLUMNS = [
  { id: 'scheduled', label: 'Запланированы', description: 'Слоты созданы и ожидают подтверждения.' },
  { id: 'arrived', label: 'Прибыли', description: 'Пациенты уже в клинике и готовы к регистрации.' },
  { id: 'waiting', label: 'Ожидают', description: 'Регистрация пройдена, очередь на приём.' },
  { id: 'in_consult', label: 'На приёме', description: 'Врач ведёт приём или оформляет визит.' },
  { id: 'diagnostics', label: 'Диагностика', description: 'Пациент на исследованиях и быстрых процедурах.' },
  { id: 'inpatient', label: 'Стационар', description: 'Пациент переведён в inpatient-поток.' },
  { id: 'ready_for_discharge', label: 'Готовы к выписке', description: 'Остался owner-facing итог и выдача.' },
  { id: 'follow_up', label: 'Контроль', description: 'Назначен следующий визит или удалённый контроль.' },
  { id: 'completed', label: 'Завершены', description: 'Сценарий закрыт, документы и счёт готовы.' },
];

export const FLOW_STAGE_TO_STATUS: Record<string, string> = {
  scheduled: 'scheduled',
  arrived: 'waiting',
  waiting: 'waiting',
  in_consult: 'in_progress',
  diagnostics: 'in_progress',
  inpatient: 'in_progress',
  ready_for_discharge: 'in_progress',
  follow_up: 'completed',
  completed: 'completed',
};

export const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  scheduled: 'Запланирована',
  confirmed: 'Подтверждена',
  waiting: 'Ожидание',
  in_progress: 'На приёме',
  completed: 'Завершена',
  cancelled: 'Отменена',
  no_show: 'Неявка',
};

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  room: 'Кабинет',
  diagnostics: 'Диагностика',
  procedure: 'Процедурная',
  telemedicine: 'Телемедицина',
  telemedicine_room: 'Телемедицинская комната',
  imaging: 'Диагностика',
  ultrasound: 'УЗИ',
  xray: 'Рентген',
  surgery: 'Операционная',
  lab: 'Лаборатория',
  icu: 'Интенсивная терапия',
  inpatient: 'Стационар',
  other: 'Ресурс',
};

function normalizeResourceTypeKey(value = ''): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function inferResourceTypeFromName(name = ''): string {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) return 'room';
  if (normalized.includes('теле')) return 'telemedicine';
  if (normalized.includes('узи')) return 'ultrasound';
  if (normalized.includes('рентген')) return 'xray';
  if (normalized.includes('диагност')) return 'diagnostics';
  if (normalized.includes('процедур')) return 'procedure';
  if (normalized.includes('операц')) return 'surgery';
  if (normalized.includes('лаборат')) return 'lab';
  if (normalized.includes('стацион')) return 'inpatient';
  if (normalized.includes('интенсив')) return 'icu';
  return 'room';
}

function pluralizeResourceCount(count: number): string {
  const abs = Math.abs(Number(count) || 0);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ресурс';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'ресурса';
  return 'ресурсов';
}

interface Resource {
  id?: string;
  resource_type?: string;
  resource_type_label?: string;
  name?: string;
  clinic_location_id?: string;
  is_active?: boolean;
}

interface Appointment {
  id?: string;
  pet_id?: string;
  vet_id?: string;
  clinic_location_id?: string;
  clinic_resource_id?: string;
  scheduled_at?: string;
  status?: string;
  visit_type?: string;
  room_label?: string;
  resource_type?: string;
  resource_type_label?: string;
  duration_minutes?: number;
  buffer_minutes?: number;
  urgency_level?: string;
  protocol_status?: string;
  discharge_ready?: boolean;
  flow_stage?: string;
}

interface Branch {
  id?: string;
  name?: string;
  address?: string;
  city?: string;
  hours?: string;
  locations?: Branch[];
}

function deriveResourceTypeMetaForResource(resource: Resource = {}): { key: string; label: string } {
  const key = normalizeResourceTypeKey(resource.resource_type || resource.resource_type_label)
    || inferResourceTypeFromName(resource.name || '');
  return {
    key,
    label: localizeResourceType(resource.resource_type_label || resource.resource_type || key),
  };
}

function deriveResourceTypeMetaForAppointment(appointment: Appointment = {}, resources: Resource[] = [], options: { branches?: Branch[]; explicitMap?: Record<string, string> } = {}): { key: string; label: string } {
  if (appointment.visit_type === 'video_consultation') {
    return { key: 'telemedicine', label: localizeResourceType('telemedicine') };
  }

  const fromResource = resolveResourceById(resources, appointment?.clinic_resource_id);
  if (fromResource) return deriveResourceTypeMetaForResource(fromResource);

  const branchId = resolveAppointmentBranchId(appointment, options.branches || []);
  const roomName = roomAssignmentForAppointment('', appointment, options.branches || [], options.explicitMap || {}, resources);
  const byName = resolveResourceByName(resources, branchId, roomName);
  if (byName) return deriveResourceTypeMetaForResource(byName);

  const explicitType = normalizeResourceTypeKey(appointment.resource_type || appointment.resource_type_label);
  if (explicitType) {
    return {
      key: explicitType,
      label: localizeResourceType(appointment.resource_type_label || appointment.resource_type || explicitType),
    };
  }

  if (appointment.room_label) {
    const inferredKey = inferResourceTypeFromName(appointment.room_label);
    return { key: inferredKey, label: localizeResourceType(inferredKey) };
  }

  return { key: 'room', label: localizeResourceType('room') };
}

export function resolveResourceForLane(resources: Resource[] = [], branchId = '', laneId = '', appointment: Appointment | null = null): Resource | null {
  const scopedResources = filterResourcesForBranch(resources, branchId);
  if (!scopedResources.length || !laneId) return null;

  const currentResource = resolveResourceById(resources, appointment?.clinic_resource_id);
  const currentMeta = currentResource ? deriveResourceTypeMetaForResource(currentResource) : null;
  if (currentResource && currentMeta?.key === laneId) return currentResource;

  return scopedResources.find((resource) => deriveResourceTypeMetaForResource(resource).key === laneId) || null;
}

export function appointmentDurationMinutes(appointment: Appointment): number {
  return Math.max(10, Number(appointment?.duration_minutes || 30));
}

export function getAppointmentEnd(appointment: Appointment): Date {
  const start = new Date(appointment.scheduled_at || '');
  return new Date(start.getTime() + appointmentDurationMinutes(appointment) * 60 * 1000);
}

export function formatShortTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatShortDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function formatDateTimeLocal(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

export function mondayStart(dateValue: string): Date {
  const current = new Date(`${dateValue}T00:00:00`);
  const weekday = current.getDay() === 0 ? 6 : current.getDay() - 1;
  current.setDate(current.getDate() - weekday);
  current.setHours(0, 0, 0, 0);
  return current;
}

export function weekRange(dateValue: string): { start: string; end: string } {
  const start = mondayStart(dateValue);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function selectedDateRange(dateValue: string): { start: string; end: string } {
  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(`${dateValue}T23:59:59`);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function buildTimeSlots({
  dateValue,
  startHour = 8,
  endHour = 21,
  intervalMinutes = 30,
}: {
  dateValue: string;
  startHour?: number;
  endHour?: number;
  intervalMinutes?: number;
}): Date[] {
  const slots: Date[] = [];
  const base = new Date(`${dateValue}T00:00:00`);
  for (let hour = startHour; hour < endHour; hour += 1) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      const slot = new Date(base);
      slot.setHours(hour, minute, 0, 0);
      slots.push(slot);
    }
  }
  return slots;
}

export function localizeVisitType(value: string): string {
  return value === 'video_consultation' ? 'Видео' : 'Очный';
}

export function localizeResourceType(value: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Кабинет';
  if (/[А-Яа-яЁё]/.test(normalized)) return normalized;
  return RESOURCE_TYPE_LABELS[normalized] || 'Ресурс';
}

export function localizeStage(stageId: string): string {
  return FLOWBOARD_COLUMNS.find((column) => column.id === stageId)?.label || 'Стадия';
}

export function deriveFlowStage(appointment: Appointment, overrides: Record<string, string> = {}): string {
  if (appointment?.flow_stage) return appointment.flow_stage;
  const overridden = overrides[appointment?.id || ''];
  if (overridden) return overridden;

  const status = appointment?.status || '';
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in_consult';
  if (status === 'waiting') return 'waiting';
  if (status === 'confirmed') return 'arrived';
  if (status === 'new' || status === 'scheduled') return 'scheduled';
  return 'scheduled';
}

function roomAssignmentsStorageKey(clinicId: string): string {
  return clinicId ? `lapka:room-assignments:${clinicId}` : '';
}

export function readRoomAssignments(clinicId = ''): Record<string, string> {
  if (typeof window === 'undefined' || !clinicId) return {};
  try {
    const value = window.localStorage.getItem(roomAssignmentsStorageKey(clinicId));
    if (!value) return {};
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRoomAssignments(clinicId = '', assignments: Record<string, string> = {}): Record<string, string> {
  if (typeof window === 'undefined' || !clinicId) return assignments;
  try {
    window.localStorage.setItem(roomAssignmentsStorageKey(clinicId), JSON.stringify(assignments));
  } catch {
    // ignore storage errors in demo mode
  }
  return assignments;
}

export function setRoomAssignment(clinicId = '', appointmentId = '', roomName = ''): Record<string, string> {
  if (!clinicId || !appointmentId) return readRoomAssignments(clinicId);
  const next = { ...readRoomAssignments(clinicId) };
  if (roomName) next[appointmentId] = roomName;
  else delete next[appointmentId];
  return saveRoomAssignments(clinicId, next);
}

function filterResourcesForBranch(resources: Resource[] = [], branchId = ''): Resource[] {
  if (!Array.isArray(resources) || !resources.length) return [];
  const activeRows = resources.filter((resource) => resource?.is_active !== false);
  if (!branchId) return activeRows;
  const scopedRows = activeRows.filter((resource) => resource.clinic_location_id === branchId);
  return scopedRows.length ? scopedRows : activeRows.filter((resource) => !resource.clinic_location_id);
}

export function buildBranchResourceOptions(branches: Branch[] = [], branchId = '', resources: Resource[] = []): Resource[] {
  return filterResourcesForBranch(resources, branchId);
}

export function buildBranchResourceChoices(branches: Branch[] = [], branchId = '', resources: Resource[] = []): (Resource & { resource_type_label: string; label: string })[] {
  return buildBranchResourceOptions(branches, branchId, resources).map((resource) => ({
    ...resource,
    resource_type_label: localizeResourceType(resource.resource_type_label || resource.resource_type || ''),
    label: `${resource.name} · ${localizeResourceType(resource.resource_type_label || resource.resource_type || '')}`,
  }));
}

export function resolveResourceById(resources: Resource[] = [], resourceId = ''): Resource | null {
  if (!resourceId) return null;
  return resources.find((resource) => resource.id === resourceId) || null;
}

export function resolveResourceByName(resources: Resource[] = [], branchId = '', roomName = ''): Resource | null {
  if (!roomName) return null;
  const scopedRows = filterResourcesForBranch(resources, branchId);
  return scopedRows.find((resource) => resource.name === roomName)
    || resources.find((resource) => resource.name === roomName)
    || null;
}

export function roomAssignmentForAppointment(clinicId: string, appointment: Appointment, branches: Branch[] = [], explicitMap: Record<string, string> = {}, resources: Resource[] = []): string {
  const fromMap = explicitMap[appointment?.id || ''];
  if (fromMap) return fromMap;
  const fromResource = resolveResourceById(resources, appointment?.clinic_resource_id);
  if (fromResource?.name) return fromResource.name;
  const fromModel = appointment?.room_label;
  if (fromModel) return fromModel;
  const presets = buildBranchRoomOptions(
    branches,
    resolveAppointmentBranchId(appointment, branches),
    resources
  );
  return presets[stableIndexFromString(appointment?.pet_id || appointment?.id || 'room', presets.length)] || 'Кабинет 1';
}

export function buildRoomAssignmentMap(appointments: Appointment[] = [], resources: Resource[] = []): Record<string, string> {
  return appointments.reduce((acc, appointment) => {
    const fromResource = resolveResourceById(resources, appointment?.clinic_resource_id);
    const roomName = fromResource?.name || appointment?.room_label || '';
    if (appointment?.id && roomName) {
      acc[appointment.id] = roomName;
    }
    return acc;
  }, {} as Record<string, string>);
}

export function readSchedulerBuffer(clinicId: string, fallback = 10): number {
  if (typeof window === 'undefined' || !clinicId) return fallback;
  try {
    const value = window.localStorage.getItem(`lapka:scheduler-buffer:${clinicId}`);
    if (value == null) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveSchedulerBuffer(clinicId: string, value: number): void {
  if (typeof window === 'undefined' || !clinicId) return;
  try {
    window.localStorage.setItem(`lapka:scheduler-buffer:${clinicId}`, String(value));
  } catch {
    // ignore local persistence failures
  }
}

function stableIndexFromString(value: string, modulo: number): number {
  const source = String(value || 'branch');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

export function resolveAppointmentBranchId(appointment: Appointment, branches: Branch[] = []): string {
  if (!Array.isArray(branches) || !branches.length || !appointment) return '';
  if (appointment.clinic_location_id && branches.some((branch) => branch.id === appointment.clinic_location_id)) {
    return appointment.clinic_location_id;
  }
  const key = appointment.vet_id || appointment.id || appointment.pet_id || 'branch';
  return branches[stableIndexFromString(key, branches.length)]?.id || '';
}

export function filterAppointmentsForBranch(appointments: Appointment[] = [], branches: Branch[] = [], branchId = ''): Appointment[] {
  if (!branchId) return appointments;
  return appointments.filter((appointment) => resolveAppointmentBranchId(appointment, branches) === branchId);
}

export function buildBranchRoomOptions(branches: Branch[] = [], branchId = '', resources: Resource[] = []): string[] {
  const filteredResources = buildBranchResourceChoices(branches, branchId, resources);
  if (filteredResources.length) {
    return filteredResources.map((resource) => resource.name || '');
  }
  const baseRooms = ['Кабинет 1', 'Кабинет 2', 'Диагностика', 'Телемедицина', 'Процедурная'];
  if (!branchId) return baseRooms;
  const branch = branches.find((row) => row.id === branchId);
  if (!branch) return baseRooms;
  const prefix = branch.address?.split(',')[0] || branch.city || 'Филиал';
  return [
    `${prefix} · Кабинет 1`,
    `${prefix} · Кабинет 2`,
    `${prefix} · Диагностика`,
    `${prefix} · Процедурная`,
  ];
}

export function buildPatientMap(rows: { pet_id: string }[] = []): Record<string, { pet_id: string }> {
  return rows.reduce((acc, row) => {
    acc[row.pet_id] = row;
    return acc;
  }, {} as Record<string, { pet_id: string }>);
}

export function buildLaneDefinitions({
  mode,
  vets = [],
  appointments = [],
  selectedClinic = null,
  selectedVetId = '',
  branches = [],
  selectedBranchId = '',
  resources = [],
  explicitMap = {},
}: {
  mode: string;
  vets?: { user_id?: string; full_name?: string }[];
  appointments?: Appointment[];
  selectedClinic?: { name?: string; locations?: Branch[] } | null;
  selectedVetId?: string;
  branches?: Branch[];
  selectedBranchId?: string;
  resources?: Resource[];
  explicitMap?: Record<string, string>;
}): { id: string; title: string; subtitle: string; type: string; resourceCount?: number; resourceNames?: string[] }[] {
  if (mode === 'doctor') {
    const vetRows = selectedVetId ? vets.filter((vet) => vet.user_id === selectedVetId) : vets;
    return vetRows.map((vet) => ({
      id: vet.user_id || '',
      title: vet.full_name || '',
      subtitle: 'Врач',
      type: 'doctor',
    }));
  }

  if (mode === 'resource') {
    const scopedResources = filterResourcesForBranch(resources, selectedBranchId);
    const typeMap = new Map<string, { id: string; title: string; subtitle: string; type: string; resourceCount: number; resourceNames: string[] }>();

    scopedResources.forEach((resource) => {
      const meta = deriveResourceTypeMetaForResource(resource);
      const current = typeMap.get(meta.key) || {
        id: meta.key,
        title: meta.label,
        subtitle: '',
        type: 'resource',
        resourceCount: 0,
        resourceNames: [],
      };
      current.resourceCount += 1;
      current.resourceNames.push(resource.name || '');
      typeMap.set(meta.key, current);
    });

    if (!typeMap.size) {
      appointments.forEach((appointment) => {
        const meta = deriveResourceTypeMetaForAppointment(appointment, resources, { branches, explicitMap });
        if (!meta.key) return;
        if (!typeMap.has(meta.key)) {
          typeMap.set(meta.key, {
            id: meta.key,
            title: meta.label,
            subtitle: 'Тип ресурса',
            type: 'resource',
            resourceCount: 0,
            resourceNames: [],
          });
        }
      });
    }

    return Array.from(typeMap.values()).map((lane) => ({
      ...lane,
      subtitle: lane.resourceCount
        ? `${lane.resourceCount} ${pluralizeResourceCount(lane.resourceCount)}`
        : 'Тип ресурса',
    }));
  }

  if (mode === 'room') {
    const names = buildBranchRoomOptions(branches, selectedBranchId, resources);
    return names.map((name) => ({
      id: name,
      title: name,
      subtitle: 'Кабинет / ресурс',
      type: 'room',
    }));
  }

  if (mode === 'branch') {
    const rows = branches.length ? branches : (Array.isArray(selectedClinic?.locations) ? selectedClinic.locations : []);
    const scopedRows = selectedBranchId ? rows.filter((row) => row.id === selectedBranchId) : rows;
    return scopedRows.map((row) => ({
      id: row.id || '',
      title: row.address || row.name || selectedClinic?.name || 'Филиал',
      subtitle: [row.city, row.hours].filter(Boolean).join(' · ') || 'Контур филиала',
      type: 'branch',
    }));
  }

  const fallbackRows = vets;
  return fallbackRows.map((vet) => ({
    id: vet.user_id || '',
    title: vet.full_name || '',
    subtitle: 'Дневной слот врача',
    type: 'doctor',
  }));
}

export function resolveLaneIdForAppointment(appointment: Appointment, mode: string, options: { branches?: Branch[]; resources?: Resource[]; explicitMap?: Record<string, string> } = {}): string {
  if (mode === 'resource') {
    return deriveResourceTypeMetaForAppointment(appointment, options.resources || [], {
      branches: options.branches || [],
      explicitMap: options.explicitMap || {},
    }).key;
  }
  if (mode === 'room') {
    return roomAssignmentForAppointment('', appointment, options.branches || [], options.explicitMap || {}, options.resources || []);
  }
  if (mode === 'branch') {
    return resolveAppointmentBranchId(appointment, options.branches || []);
  }
  return appointment.vet_id || '';
}

export function computeOverlaps(items: Appointment[] = [], defaultBufferMinutes = 0): Record<string, boolean> {
  const rows = [...items].sort((a, b) => new Date(a.scheduled_at || '').getTime() - new Date(b.scheduled_at || '').getTime());
  const overlapMap: Record<string, boolean> = {};
  for (let index = 0; index < rows.length; index += 1) {
    const current = rows[index];
    const currentStart = new Date(current.scheduled_at || '');
    const currentBuffer = Number(current?.buffer_minutes ?? defaultBufferMinutes) || 0;
    const currentEnd = new Date(getAppointmentEnd(current).getTime() + currentBuffer * 60 * 1000);
    for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex += 1) {
      const next = rows[nextIndex];
      const nextStart = new Date(next.scheduled_at || '');
      if (nextStart >= currentEnd) break;
      const nextEnd = getAppointmentEnd(next);
      if (currentStart < nextEnd && nextStart < currentEnd) {
        overlapMap[current.id || ''] = true;
        overlapMap[next.id || ''] = true;
      }
    }
  }
  return overlapMap;
}

export function computeRoomConflicts(items: Appointment[] = [], branches: Branch[] = [], defaultBufferMinutes = 0, resources: Resource[] = [], explicitMap: Record<string, string> = {}): Record<string, boolean> {
  const rows = [...items]
    .sort((a, b) => new Date(a.scheduled_at || '').getTime() - new Date(b.scheduled_at || '').getTime());
  const conflictMap: Record<string, boolean> = {};

  for (let index = 0; index < rows.length; index += 1) {
    const current = rows[index];
    const currentBranch = resolveAppointmentBranchId(current, branches);
    const currentRoom = roomAssignmentForAppointment('', current, branches, explicitMap, resources);
    const currentStart = new Date(current.scheduled_at || '');
    const currentBuffer = Number(current?.buffer_minutes ?? defaultBufferMinutes) || 0;
    const currentEnd = new Date(getAppointmentEnd(current).getTime() + currentBuffer * 60 * 1000);

    for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex += 1) {
      const next = rows[nextIndex];
      const nextBranch = resolveAppointmentBranchId(next, branches);
      const nextRoom = roomAssignmentForAppointment('', next, branches, explicitMap, resources);
      if (currentBranch !== nextBranch || currentRoom !== nextRoom) continue;

      const nextStart = new Date(next.scheduled_at || '');
      if (nextStart >= currentEnd) break;

      const nextBuffer = Number(next?.buffer_minutes ?? defaultBufferMinutes) || 0;
      const nextEnd = new Date(getAppointmentEnd(next).getTime() + nextBuffer * 60 * 1000);
      if (currentStart < nextEnd && nextStart < currentEnd) {
        conflictMap[current.id || ''] = true;
        conflictMap[next.id || ''] = true;
      }
    }
  }

  return conflictMap;
}

export function computeWaitMinutes(appointment: Appointment, dateValue = '', stageMap: Record<string, string> = {}): number {
  if (!appointment?.scheduled_at) return 0;
  const stage = deriveFlowStage(appointment, stageMap);
  if (!['arrived', 'waiting', 'scheduled'].includes(stage)) return 0;
  const now = new Date();
  const start = new Date(appointment.scheduled_at);
  if (dateValue && start.toISOString().slice(0, 10) !== dateValue) return 0;
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 60000));
}

export function buildWeekDays(dateValue: string, appointments: Appointment[] = []): { id: string; date: Date; count: number; confirmed: number; inProgress: number; telemedicine: number }[] {
  const start = mondayStart(dateValue);
  const rows: { id: string; date: Date; count: number; confirmed: number; inProgress: number; telemedicine: number }[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + offset);
    const iso = day.toISOString().slice(0, 10);
    const dayAppointments = appointments.filter((appointment) => (appointment.scheduled_at || '').slice(0, 10) === iso);
    rows.push({
      id: iso,
      date: day,
      count: dayAppointments.length,
      confirmed: dayAppointments.filter((item) => item.status === 'confirmed').length,
      inProgress: dayAppointments.filter((item) => item.status === 'in_progress').length,
      telemedicine: dayAppointments.filter((item) => item.visit_type === 'video_consultation').length,
    });
  }
  return rows;
}

export function buildFlowboardMetrics(appointments: Appointment[] | undefined = undefined, stageMap: Record<string, string> = {}): Record<string, number> {
  const metrics = FLOWBOARD_COLUMNS.reduce((acc, column) => {
    acc[column.id] = 0;
    return acc;
  }, {} as Record<string, number>);
  (appointments || []).forEach((appointment) => {
    metrics[deriveFlowStage(appointment, stageMap)] += 1;
  });
  return metrics;
}

export function buildBottleneckIndicators(appointments: Appointment[] = [], stageMap: Record<string, string> = {}, dateValue = ''): { waitingOver30: number; diagnosticsBacklog: number; dischargeQueue: number; inpatientLoad: number; urgentCases: number; draftProtocols: number; unsignedReady: number } {
  const waitingOver30 = appointments.filter((appointment) => computeWaitMinutes(appointment, dateValue, stageMap) >= 30).length;
  const diagnosticsBacklog = appointments.filter((appointment) => deriveFlowStage(appointment, stageMap) === 'diagnostics').length;
  const dischargeQueue = appointments.filter((appointment) => deriveFlowStage(appointment, stageMap) === 'ready_for_discharge' || appointment.discharge_ready).length;
  const inpatientLoad = appointments.filter((appointment) => deriveFlowStage(appointment, stageMap) === 'inpatient').length;
  const urgentCases = appointments.filter((appointment) => appointment.urgency_level === 'urgent').length;
  const draftProtocols = appointments.filter((appointment) => appointment.protocol_status === 'draft').length;
  const unsignedReady = appointments.filter((appointment) => appointment.protocol_status === 'ready' && !appointment.discharge_ready).length;
  return {
    waitingOver30,
    diagnosticsBacklog,
    dischargeQueue,
    inpatientLoad,
    urgentCases,
    draftProtocols,
    unsignedReady,
  };
}

export function buildRoomUtilization(appointments: Appointment[] = [], branches: Branch[] = [], selectedBranchId = '', resources: Resource[] = [], explicitMap: Record<string, string> = {}): { roomName: string; appointments: number; urgent: number; inpatient: number }[] {
  const counts = new Map<string, { roomName: string; appointments: number; urgent: number; inpatient: number }>();
  appointments.forEach((appointment) => {
    const branchId = resolveAppointmentBranchId(appointment, branches);
    if (selectedBranchId && branchId !== selectedBranchId) return;
    const roomName = roomAssignmentForAppointment('', appointment, branches, explicitMap, resources);
    const current = counts.get(roomName) || {
      roomName,
      appointments: 0,
      urgent: 0,
      inpatient: 0,
    };
    current.appointments += 1;
    if (appointment.urgency_level === 'urgent') current.urgent += 1;
    if (deriveFlowStage(appointment, {}) === 'inpatient') current.inpatient += 1;
    counts.set(roomName, current);
  });
  return [...counts.values()].sort((a, b) => b.appointments - a.appointments);
}

export function summarizeScheduler({
  appointments = [],
  lanes = [],
  overlaps = {},
  roomConflicts = {},
}: {
  appointments?: Appointment[];
  lanes?: { id: string }[];
  overlaps?: Record<string, boolean>;
  roomConflicts?: Record<string, boolean>;
}): { appointments: number; waiting: number; active: number; overlaps: number; roomConflicts: number; telemedicine: number; lanes: number } {
  return {
    appointments: appointments.length,
    waiting: appointments.filter((row) => ['new', 'scheduled', 'confirmed', 'waiting'].includes(row.status || '')).length,
    active: appointments.filter((row) => row.status === 'in_progress').length,
    overlaps: Object.keys(overlaps).length,
    roomConflicts: Object.keys(roomConflicts).length,
    telemedicine: appointments.filter((row) => row.visit_type === 'video_consultation').length,
    lanes: lanes.length,
  };
}