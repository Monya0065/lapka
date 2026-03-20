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

export const FLOW_STAGE_TO_STATUS = {
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

export const STATUS_LABELS = {
  new: 'Новая',
  scheduled: 'Запланирована',
  confirmed: 'Подтверждена',
  waiting: 'Ожидание',
  in_progress: 'На приёме',
  completed: 'Завершена',
  cancelled: 'Отменена',
  no_show: 'Неявка',
};

export const RESOURCE_TYPE_LABELS = {
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

function normalizeResourceTypeKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function inferResourceTypeFromName(name = '') {
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

function pluralizeResourceCount(count) {
  const abs = Math.abs(Number(count) || 0);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ресурс';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'ресурса';
  return 'ресурсов';
}

function deriveResourceTypeMetaForResource(resource = {}) {
  const key = normalizeResourceTypeKey(resource.resource_type || resource.resource_type_label)
    || inferResourceTypeFromName(resource.name);
  return {
    key,
    label: localizeResourceType(resource.resource_type_label || resource.resource_type || key),
  };
}

function deriveResourceTypeMetaForAppointment(appointment = {}, resources = [], options = {}) {
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

export function resolveResourceForLane(resources = [], branchId = '', laneId = '', appointment = null) {
  const scopedResources = filterResourcesForBranch(resources, branchId);
  if (!scopedResources.length || !laneId) return null;

  const currentResource = resolveResourceById(resources, appointment?.clinic_resource_id);
  const currentMeta = currentResource ? deriveResourceTypeMetaForResource(currentResource) : null;
  if (currentResource && currentMeta?.key === laneId) return currentResource;

  return scopedResources.find((resource) => deriveResourceTypeMetaForResource(resource).key === laneId) || null;
}

export function appointmentDurationMinutes(appointment) {
  return Math.max(10, Number(appointment?.duration_minutes || 30));
}

export function getAppointmentEnd(appointment) {
  const start = new Date(appointment.scheduled_at);
  return new Date(start.getTime() + appointmentDurationMinutes(appointment) * 60 * 1000);
}

export function formatShortTime(value) {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatShortDate(value) {
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function formatDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

export function mondayStart(dateValue) {
  const current = new Date(`${dateValue}T00:00:00`);
  const weekday = current.getDay() === 0 ? 6 : current.getDay() - 1;
  current.setDate(current.getDate() - weekday);
  current.setHours(0, 0, 0, 0);
  return current;
}

export function weekRange(dateValue) {
  const start = mondayStart(dateValue);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function selectedDateRange(dateValue) {
  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(`${dateValue}T23:59:59`);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function buildTimeSlots({
  dateValue,
  startHour = 8,
  endHour = 21,
  intervalMinutes = 30,
}) {
  const slots = [];
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

export function localizeVisitType(value) {
  return value === 'video_consultation' ? 'Видео' : 'Очный';
}

export function localizeResourceType(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Кабинет';
  if (/[А-Яа-яЁё]/.test(normalized)) return normalized;
  return RESOURCE_TYPE_LABELS[normalized] || 'Ресурс';
}

export function localizeStage(stageId) {
  return FLOWBOARD_COLUMNS.find((column) => column.id === stageId)?.label || 'Стадия';
}

export function deriveFlowStage(appointment, overrides = {}) {
  if (appointment?.flow_stage) return appointment.flow_stage;
  const overridden = overrides[appointment.id];
  if (overridden) return overridden;

  const status = appointment.status;
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in_consult';
  if (status === 'waiting') return 'waiting';
  if (status === 'confirmed') return 'arrived';
  if (status === 'new' || status === 'scheduled') return 'scheduled';
  return 'scheduled';
}

function roomAssignmentsStorageKey(clinicId) {
  return clinicId ? `lapka:room-assignments:${clinicId}` : '';
}

export function readRoomAssignments(clinicId = '') {
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

export function saveRoomAssignments(clinicId = '', assignments = {}) {
  if (typeof window === 'undefined' || !clinicId) return assignments;
  try {
    window.localStorage.setItem(roomAssignmentsStorageKey(clinicId), JSON.stringify(assignments));
  } catch {
    // ignore storage errors in demo mode
  }
  return assignments;
}

export function setRoomAssignment(clinicId = '', appointmentId = '', roomName = '') {
  if (!clinicId || !appointmentId) return readRoomAssignments(clinicId);
  const next = { ...readRoomAssignments(clinicId) };
  if (roomName) next[appointmentId] = roomName;
  else delete next[appointmentId];
  return saveRoomAssignments(clinicId, next);
}

function filterResourcesForBranch(resources = [], branchId = '') {
  if (!Array.isArray(resources) || !resources.length) return [];
  const activeRows = resources.filter((resource) => resource?.is_active !== false);
  if (!branchId) return activeRows;
  const scopedRows = activeRows.filter((resource) => resource.clinic_location_id === branchId);
  return scopedRows.length ? scopedRows : activeRows.filter((resource) => !resource.clinic_location_id);
}

export function buildBranchResourceOptions(branches = [], branchId = '', resources = []) {
  return filterResourcesForBranch(resources, branchId);
}

export function buildBranchResourceChoices(branches = [], branchId = '', resources = []) {
  return buildBranchResourceOptions(branches, branchId, resources).map((resource) => ({
    ...resource,
    resource_type_label: localizeResourceType(resource.resource_type_label || resource.resource_type),
    label: `${resource.name} · ${localizeResourceType(resource.resource_type_label || resource.resource_type)}`,
  }));
}

export function resolveResourceById(resources = [], resourceId = '') {
  if (!resourceId) return null;
  return resources.find((resource) => resource.id === resourceId) || null;
}

export function resolveResourceByName(resources = [], branchId = '', roomName = '') {
  if (!roomName) return null;
  const scopedRows = filterResourcesForBranch(resources, branchId);
  return scopedRows.find((resource) => resource.name === roomName)
    || resources.find((resource) => resource.name === roomName)
    || null;
}

export function roomAssignmentForAppointment(clinicId, appointment, branches = [], explicitMap = {}, resources = []) {
  const fromMap = explicitMap[appointment?.id];
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

export function buildRoomAssignmentMap(appointments = [], resources = []) {
  return appointments.reduce((acc, appointment) => {
    const fromResource = resolveResourceById(resources, appointment?.clinic_resource_id);
    const roomName = fromResource?.name || appointment?.room_label || '';
    if (appointment?.id && roomName) {
      acc[appointment.id] = roomName;
    }
    return acc;
  }, {});
}

export function readSchedulerBuffer(clinicId, fallback = 10) {
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

export function saveSchedulerBuffer(clinicId, value) {
  if (typeof window === 'undefined' || !clinicId) return;
  try {
    window.localStorage.setItem(`lapka:scheduler-buffer:${clinicId}`, String(value));
  } catch {
    // ignore local persistence failures
  }
}


function stableIndexFromString(value, modulo) {
  const source = String(value || 'branch');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
}

export function resolveAppointmentBranchId(appointment, branches = []) {
  if (!Array.isArray(branches) || !branches.length || !appointment) return '';
  if (appointment.clinic_location_id && branches.some((branch) => branch.id === appointment.clinic_location_id)) {
    return appointment.clinic_location_id;
  }
  const key = appointment.vet_id || appointment.id || appointment.pet_id || 'branch';
  return branches[stableIndexFromString(key, branches.length)]?.id || '';
}

export function filterAppointmentsForBranch(appointments = [], branches = [], branchId = '') {
  if (!branchId) return appointments;
  return appointments.filter((appointment) => resolveAppointmentBranchId(appointment, branches) === branchId);
}

export function buildBranchRoomOptions(branches = [], branchId = '', resources = []) {
  const filteredResources = buildBranchResourceChoices(branches, branchId, resources);
  if (filteredResources.length) {
    return filteredResources.map((resource) => resource.name);
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

export function buildPatientMap(rows = []) {
  return rows.reduce((acc, row) => {
    acc[row.pet_id] = row;
    return acc;
  }, {});
}

export function buildLaneDefinitions({
  mode,
  vets = [],
  appointments = [],
  clinics = [],
  selectedClinic = null,
  selectedVetId = '',
  branches = [],
  selectedBranchId = '',
  resources = [],
  explicitMap = {},
}) {
  if (mode === 'doctor') {
    const vetRows = selectedVetId ? vets.filter((vet) => vet.user_id === selectedVetId) : vets;
    return vetRows.map((vet) => ({
      id: vet.user_id,
      title: vet.full_name,
      subtitle: 'Врач',
      type: 'doctor',
    }));
  }

  if (mode === 'resource') {
    const scopedResources = filterResourcesForBranch(resources, selectedBranchId);
    const typeMap = new Map();

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
      current.resourceNames.push(resource.name);
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
      id: row.id,
      title: row.address || row.name || selectedClinic?.name || 'Филиал',
      subtitle: [row.city, row.hours].filter(Boolean).join(' · ') || 'Контур филиала',
      type: 'branch',
    }));
  }

  const fallbackRows = vets;
  return fallbackRows.map((vet) => ({
    id: vet.user_id,
    title: vet.full_name,
    subtitle: 'Дневной слот врача',
    type: 'doctor',
  }));
}

export function resolveLaneIdForAppointment(appointment, mode, options = {}) {
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
  return appointment.vet_id;
}

export function computeOverlaps(items = [], defaultBufferMinutes = 0) {
  const rows = [...items].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const overlapMap = {};
  for (let index = 0; index < rows.length; index += 1) {
    const current = rows[index];
    const currentStart = new Date(current.scheduled_at);
    const currentBuffer = Number(current?.buffer_minutes ?? defaultBufferMinutes) || 0;
    const currentEnd = new Date(getAppointmentEnd(current).getTime() + currentBuffer * 60 * 1000);
    for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex += 1) {
      const next = rows[nextIndex];
      const nextStart = new Date(next.scheduled_at);
      if (nextStart >= currentEnd) break;
      const nextEnd = getAppointmentEnd(next);
      if (currentStart < nextEnd && nextStart < currentEnd) {
        overlapMap[current.id] = true;
        overlapMap[next.id] = true;
      }
    }
  }
  return overlapMap;
}

export function computeRoomConflicts(items = [], branches = [], defaultBufferMinutes = 0, resources = [], explicitMap = {}) {
  const rows = [...items]
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const conflictMap = {};

  for (let index = 0; index < rows.length; index += 1) {
    const current = rows[index];
    const currentBranch = resolveAppointmentBranchId(current, branches);
    const currentRoom = roomAssignmentForAppointment('', current, branches, explicitMap, resources);
    const currentStart = new Date(current.scheduled_at);
    const currentBuffer = Number(current?.buffer_minutes ?? defaultBufferMinutes) || 0;
    const currentEnd = new Date(getAppointmentEnd(current).getTime() + currentBuffer * 60 * 1000);

    for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex += 1) {
      const next = rows[nextIndex];
      const nextBranch = resolveAppointmentBranchId(next, branches);
      const nextRoom = roomAssignmentForAppointment('', next, branches, explicitMap, resources);
      if (currentBranch !== nextBranch || currentRoom !== nextRoom) continue;

      const nextStart = new Date(next.scheduled_at);
      if (nextStart >= currentEnd) break;

      const nextBuffer = Number(next?.buffer_minutes ?? defaultBufferMinutes) || 0;
      const nextEnd = new Date(getAppointmentEnd(next).getTime() + nextBuffer * 60 * 1000);
      if (currentStart < nextEnd && nextStart < currentEnd) {
        conflictMap[current.id] = true;
        conflictMap[next.id] = true;
      }
    }
  }

  return conflictMap;
}

export function computeWaitMinutes(appointment, dateValue = '', stageMap = {}) {
  if (!appointment?.scheduled_at) return 0;
  const stage = deriveFlowStage(appointment, stageMap);
  if (!['arrived', 'waiting', 'scheduled'].includes(stage)) return 0;
  const now = new Date();
  const start = new Date(appointment.scheduled_at);
  if (dateValue && start.toISOString().slice(0, 10) !== dateValue) return 0;
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 60000));
}

export function buildWeekDays(dateValue, appointments = []) {
  const start = mondayStart(dateValue);
  const rows = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + offset);
    const iso = day.toISOString().slice(0, 10);
    const dayAppointments = appointments.filter((appointment) => appointment.scheduled_at.slice(0, 10) === iso);
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

export function buildFlowboardMetrics(appointments = [], stageMap = {}) {
  const metrics = FLOWBOARD_COLUMNS.reduce((acc, column) => {
    acc[column.id] = 0;
    return acc;
  }, {});
  appointments.forEach((appointment) => {
    metrics[deriveFlowStage(appointment, stageMap)] += 1;
  });
  return metrics;
}

export function buildBottleneckIndicators(appointments = [], stageMap = {}, dateValue = '') {
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

export function buildRoomUtilization(appointments = [], branches = [], selectedBranchId = '', resources = [], explicitMap = {}) {
  const counts = new Map();
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
}) {
  return {
    appointments: appointments.length,
    waiting: appointments.filter((row) => ['new', 'scheduled', 'confirmed', 'waiting'].includes(row.status)).length,
    active: appointments.filter((row) => row.status === 'in_progress').length,
    overlaps: Object.keys(overlaps).length,
    roomConflicts: Object.keys(roomConflicts).length,
    telemedicine: appointments.filter((row) => row.visit_type === 'video_consultation').length,
    lanes: lanes.length,
  };
}
