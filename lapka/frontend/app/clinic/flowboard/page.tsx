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
import { apiRequest } from '@/lib/api';
import {
  buildBranchRoomOptions,
  buildBranchResourceChoices,
  buildRoomAssignmentMap,
  resolveResourceByName,
  buildPatientMap,
  computeRoomConflicts,
  filterAppointmentsForBranch,
  FLOW_STAGE_TO_STATUS,
  FLOWBOARD_COLUMNS,
  computeWaitMinutes,
  formatDateTimeLocal,
  formatShortTime,
  localizeStage,
  localizeVisitType,
  readRoomAssignments,
  roomAssignmentForAppointment,
  setRoomAssignment,
  selectedDateRange,
} from '@/lib/clinic-operations';
import { useClinicScope } from '@/lib/clinic-scope';
import { localizePetBreed, localizePetSpecies } from '@/lib/pets';

function toInputDate(date) {
  return date.toISOString().slice(0, 10);
}

function deriveStage(appointment, overrides) {
  return appointment.flow_stage
    || overrides[appointment.id]
    || (
      appointment.status === 'completed' ? 'completed'
        : appointment.status === 'in_progress' ? 'in_consult'
          : appointment.status === 'waiting' ? 'waiting'
            : appointment.status === 'confirmed' ? 'arrived'
              : 'scheduled'
    );
}

export default function ClinicFlowboardPage() {
  const { clinicId, branches, selectedClinic, selectedBranch } = useClinicScope();
  const [dateValue, setDateValue] = useState(toInputDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clinic, setClinic] = useState(null);
  const [members, setMembers] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [resources, setResources] = useState([]);
  const [flowboardSummary, setFlowboardSummary] = useState(null);
  const [dragAppointmentId, setDragAppointmentId] = useState('');
  const [roomAssignments, setRoomAssignments] = useState({});
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [drawerStage, setDrawerStage] = useState('');
  const [drawerRoom, setDrawerRoom] = useState('');
  const [drawerUrgency, setDrawerUrgency] = useState('routine');
  const [drawerProtocolStatus, setDrawerProtocolStatus] = useState('not_started');
  const [drawerDischargeReady, setDrawerDischargeReady] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : '';
      const clinicPayload = await apiRequest(`/api/v1/clinics/me${query}`);
      const resolvedClinicId = clinicPayload?.id || clinicId;
      if (!resolvedClinicId) throw new Error('Не удалось определить клинику потока дня.');

      const { start, end } = selectedDateRange(dateValue);
      const summaryQuery = new URLSearchParams({
        clinic_id: resolvedClinicId,
        date: dateValue,
      });
      if (selectedBranch?.id) summaryQuery.set('clinic_location_id', selectedBranch.id);

      const [membersPayload, patientsPayload, appointmentsPayload, resourcesPayload, summaryPayload] = await Promise.all([
        apiRequest(`/api/v1/clinics/me/members${query}`),
        apiRequest(`/api/v1/clinics/me/patients${query}&limit=500`),
        apiRequest(`/api/v1/appointments?clinic_id=${encodeURIComponent(resolvedClinicId)}&date_from=${encodeURIComponent(start)}&date_to=${encodeURIComponent(end)}&mine=false`),
        apiRequest(`/api/v1/appointments/resources?clinic_id=${encodeURIComponent(resolvedClinicId)}`),
        apiRequest(`/api/v1/appointments/flowboard/summary?${summaryQuery.toString()}`),
      ]);

      setClinic(clinicPayload || null);
      setMembers(Array.isArray(membersPayload) ? membersPayload : []);
      setPatients(Array.isArray(patientsPayload) ? patientsPayload : []);
      setAppointments(Array.isArray(appointmentsPayload) ? appointmentsPayload : []);
      setResources(Array.isArray(resourcesPayload) ? resourcesPayload : []);
      setFlowboardSummary(summaryPayload || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить поток дня клиники.');
      setClinic(null);
      setMembers([]);
      setPatients([]);
      setAppointments([]);
      setResources([]);
      setFlowboardSummary(null);
    } finally {
      setLoading(false);
    }
  }, [clinicId, dateValue, selectedBranch?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const persistedAssignments = readRoomAssignments(clinic?.id || clinicId);
    const backendAssignments = buildRoomAssignmentMap(appointments, resources);
    setRoomAssignments({ ...persistedAssignments, ...backendAssignments });
  }, [appointments, clinic?.id, clinicId, resources]);

  const patientMap = useMemo(() => buildPatientMap(patients), [patients]);
  const resourceChoices = useMemo(
    () => buildBranchResourceChoices(branches, selectedBranch?.id || '', resources),
    [branches, resources, selectedBranch?.id]
  );

  const appointmentsInScope = useMemo(
    () => filterAppointmentsForBranch(appointments, branches, selectedBranch?.id),
    [appointments, branches, selectedBranch]
  );
  const vetNameById = useMemo(
    () => members.reduce((acc, row) => {
      acc[row.user_id] = row.full_name;
      return acc;
    }, {}),
    [members]
  );

  const metrics = flowboardSummary?.metrics || {};
  const bottlenecks = flowboardSummary?.bottlenecks || {};
  const roomConflicts = useMemo(
    () => computeRoomConflicts(appointmentsInScope, branches, 0, resources, roomAssignments),
    [appointmentsInScope, branches, resources, roomAssignments]
  );
  const roomUtilization = flowboardSummary?.room_utilization || [];
  const resourcePressure = flowboardSummary?.resource_pressure || [];
  const resourceTypeSummary = flowboardSummary?.resource_type_summary || [];

  const appointmentsByStage = useMemo(() => {
    const map = FLOWBOARD_COLUMNS.reduce((acc, column) => {
      acc[column.id] = [];
      return acc;
    }, {});
    appointmentsInScope.forEach((appointment) => {
      map[deriveStage(appointment, {})].push(appointment);
    });
    return map;
  }, [appointmentsInScope]);

  const selectedAppointment = useMemo(
    () => appointments.find((row) => row.id === selectedAppointmentId) || null,
    [appointments, selectedAppointmentId]
  );

  useEffect(() => {
    if (!selectedAppointment) return;
    setDrawerStage(deriveStage(selectedAppointment, {}));
    setDrawerRoom(roomAssignmentForAppointment(clinic?.id || clinicId, selectedAppointment, branches, roomAssignments, resources));
    setDrawerUrgency(selectedAppointment.urgency_level || 'routine');
    setDrawerProtocolStatus(selectedAppointment.protocol_status || 'not_started');
    setDrawerDischargeReady(Boolean(selectedAppointment.discharge_ready));
  }, [branches, clinic?.id, clinicId, resources, roomAssignments, selectedAppointment]);

  async function moveToStage(appointmentId, stageId) {
    const appointment = appointments.find((row) => row.id === appointmentId);
    if (!appointment) return;

    try {
      setError('');
      setSuccess('');
      const backendStatus = FLOW_STAGE_TO_STATUS[stageId];
      if (backendStatus && backendStatus !== appointment.status) {
        await apiRequest(`/api/v1/appointments/${appointment.id}`, {
          method: 'PATCH',
          body: {
            status: backendStatus,
            flow_stage: stageId,
            notes: `Стадия потока: ${localizeStage(stageId)}`,
          },
        });
      } else {
        await apiRequest(`/api/v1/appointments/${appointment.id}`, {
          method: 'PATCH',
          body: {
            flow_stage: stageId,
            notes: `Стадия потока: ${localizeStage(stageId)}`,
          },
        });
      }
      setSuccess(`Карточка перенесена в колонку «${localizeStage(stageId)}».`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обновить стадию потока.');
    }
  }

  async function saveDrawerChanges() {
    if (!selectedAppointment) return;
    try {
      await apiRequest(`/api/v1/appointments/${selectedAppointment.id}`, {
          method: 'PATCH',
          body: {
            room_label: drawerRoom || null,
            clinic_resource_id: resolveResourceByName(
              resources,
              selectedBranch?.id || selectedAppointment.clinic_location_id || '',
              drawerRoom
            )?.id || null,
            clinic_location_id: selectedBranch?.id || selectedAppointment.clinic_location_id || null,
            flow_stage: drawerStage || deriveStage(selectedAppointment, {}),
            urgency_level: drawerUrgency,
            protocol_status: drawerProtocolStatus,
            discharge_ready: drawerDischargeReady,
            notes: 'Обновлено из потока дня',
          },
        });
      setRoomAssignments(setRoomAssignment(clinic?.id || clinicId, selectedAppointment.id, drawerRoom || ''));
      if ((drawerStage || deriveStage(selectedAppointment, {})) !== deriveStage(selectedAppointment, {})) {
        await moveToStage(selectedAppointment.id, drawerStage || deriveStage(selectedAppointment, {}));
      } else {
        setSuccess('Карточка потока обновлена.');
        await loadData();
      }
    } catch {
      // moveToStage already reports errors
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Поток дня клиники</h1>
          <p className="page-subtitle">Операционный поток дня: движение пациента от записи до выписки или контроля, без переключения между таблицами.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <ClinicScopeSwitcher showBranchHint />
          <label className="block min-w-[210px]">
            <span className="label">Дата</span>
            <input className="input" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
          </label>
          <a className="btn-secondary" href="/clinic/schedule">
            Операционный календарь
          </a>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      {loading ? (
        <section className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </section>
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Поток дня"
            title={`${clinic?.name || selectedClinic?.name || 'Клиника'}${selectedBranch ? ` · ${selectedBranch.address}` : ''} · движение пациентов на ${new Date(`${dateValue}T00:00:00`).toLocaleDateString('ru-RU')}`}
            description="Колонки показывают не только статус записи, но и реальный этап потока: прибыл, ждёт врача, на диагностике, в стационаре или готов к выписке. Карточки можно перетаскивать между колонками."
            imageSrc="/assets/img/clinic-ops.svg"
            imageAlt="Flowboard клиники"
            badges={[
              `${appointmentsInScope.length} карт дня`,
              `${metrics.in_consult || 0} в приёме`,
              `${metrics.inpatient || 0} в стационаре`,
            ]}
          />

          <section className="kpi-grid">
            <StatsCard label="Ожидают" value={metrics.waiting + metrics.arrived} trend="Прибывшие и ожидающие врача" icon="Поток" />
            <StatsCard label="Диагностика" value={metrics.diagnostics} trend="Исследования и промежуточные сценарии" icon="Dx" />
            <StatsCard label="Готовы к выписке" value={metrics.ready_for_discharge} trend="Итог для владельца и выдача документов" icon="Итог" />
            <StatsCard label="Контроль" value={metrics.follow_up} trend="Нужен следующий контакт или визит" icon="Контроль" />
            <StatsCard label="Конфликты кабинетов" value={Object.keys(roomConflicts).length} trend="Наложения по room/resource" icon="Кабинет" />
          </section>

          <section className="grid-soft-2 items-start">
            <Card title="Сигналы узких мест" subtitle="Операционные индикаторы, которые помогают разгрузить поток.">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-lapka-500">Ожидание 30+ мин</p>
                  <p className="mt-2 text-3xl font-extrabold text-lapka-900">{bottlenecks.waitingOver30}</p>
                </div>
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-lapka-500">Диагностика в очереди</p>
                  <p className="mt-2 text-3xl font-extrabold text-lapka-900">{bottlenecks.diagnosticsBacklog}</p>
                </div>
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-lapka-500">Готовы к выписке</p>
                  <p className="mt-2 text-3xl font-extrabold text-lapka-900">{bottlenecks.dischargeQueue}</p>
                </div>
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-lapka-500">Стационарная нагрузка</p>
                  <p className="mt-2 text-3xl font-extrabold text-lapka-900">{bottlenecks.inpatientLoad}</p>
                </div>
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3 md:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-lapka-500">Срочные случаи</p>
                  <p className="mt-2 text-3xl font-extrabold text-lapka-900">{bottlenecks.urgentCases}</p>
                </div>
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-lapka-500">Черновики протоколов</p>
                  <p className="mt-2 text-3xl font-extrabold text-lapka-900">{bottlenecks.draftProtocols}</p>
                </div>
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-lapka-500">Готовы, но не выписаны</p>
                  <p className="mt-2 text-3xl font-extrabold text-lapka-900">{bottlenecks.unsignedReady}</p>
                </div>
              </div>
            </Card>
            <Card title="Ресурсы и кабинеты" subtitle="Кабинет можно закрепить за карточкой, чтобы поток был привязан к ресурсу.">
              <div className="grid gap-3 md:grid-cols-2">
                {resourceChoices.map((resource) => {
                  const roomName = resource.name;
                  const roomMetrics = roomUtilization.find((row) => row.room_name === roomName || row.roomName === roomName);
                  const count = roomMetrics?.appointments || 0;
                  return (
                    <div key={resource.id} className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                      <p className="text-sm font-extrabold text-lapka-900">{roomName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-lapka-500">{resource.resource_type_label}</p>
                      <p className="mt-1 text-sm text-lapka-600">Карточек на день: {count}</p>
                      <p className="mt-1 text-sm text-lapka-600">Срочных: {roomMetrics?.urgent || 0}</p>
                      <p className="mt-1 text-sm text-lapka-600">Стационарных: {roomMetrics?.inpatient || 0}</p>
                      <p className="mt-1 text-sm text-lapka-600">Конфликтов: {roomMetrics?.conflicts || 0}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>

          {resourcePressure.length ? (
            <Card title="Нагрузка по кабинетам" subtitle="Ресурсы, которые уже формируют очередь, конфликты или повышенную плотность потока.">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {resourcePressure.slice(0, 6).map((room) => (
                  <div key={room.resource_id || room.room_name} className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                    <p className="text-sm font-extrabold text-lapka-900">{room.room_name}</p>
                    <div className="mt-2 space-y-1 text-sm text-lapka-700">
                      <p>Тип: {room.resource_type_label}</p>
                      <p>Ёмкость: {room.capacity}</p>
                      <p>Карточек: {room.appointments}</p>
                      <p>Пик одновременно: {room.peak_parallel}</p>
                      <p>Срочных: {room.urgent}</p>
                      <p>Конфликтов: {room.conflicts}</p>
                      <p>Стационарных: {room.inpatient}</p>
                      {room.over_capacity ? <p className="font-semibold text-rose-700">Нагрузка выше ёмкости</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {resourceTypeSummary.length ? (
            <Card title="Сводка по типам ресурсов" subtitle="Показывает, где именно копится поток: кабинеты, диагностика, стационар или телемедицина.">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {resourceTypeSummary.map((item) => (
                  <div key={item.resource_type} className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                    <p className="text-sm font-extrabold text-lapka-900">{item.resource_type_label}</p>
                    <div className="mt-2 space-y-1 text-sm text-lapka-700">
                      <p>Зон: {item.rooms}</p>
                      <p>Карточек: {item.appointments}</p>
                      <p>Пик: {item.max_peak_parallel}</p>
                      <p>Срочных: {item.urgent}</p>
                      <p>Конфликтов: {item.conflicts}</p>
                      {item.over_capacity ? <p className="font-semibold text-rose-700">Зоны с перегрузкой: {item.over_capacity}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="overflow-x-auto">
            <div className="grid min-w-[1680px] grid-cols-9 gap-4 items-start">
              {FLOWBOARD_COLUMNS.map((column) => (
                <section
                  key={column.id}
                  className="surface-card flex min-h-[540px] flex-col p-4"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragAppointmentId) moveToStage(dragAppointmentId, column.id);
                    setDragAppointmentId('');
                  }}
                >
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xl font-extrabold text-lapka-900">{column.label}</h2>
                      <span className="pill !px-3 !py-1 text-sm">{appointmentsByStage[column.id].length}</span>
                    </div>
                    <p className="text-sm leading-6 text-lapka-600">{column.description}</p>
                  </div>

                  <div className="flex-1 space-y-3">
                    {appointmentsByStage[column.id].length ? (
                      appointmentsByStage[column.id]
                        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
                        .map((appointment) => {
                          const patient = patientMap[appointment.pet_id];
                          const waitMinutes = computeWaitMinutes(appointment, dateValue, {});
                          const roomName = roomAssignmentForAppointment(clinic?.id || clinicId, appointment, branches, roomAssignments, resources);
                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              draggable
                              onDragStart={() => setDragAppointmentId(appointment.id)}
                              onClick={() => setSelectedAppointmentId(appointment.id)}
                              className="w-full rounded-2xl border border-lapka-200 bg-white/95 p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-black text-lapka-900">{patient?.pet_name || 'Пациент'}</p>
                                  <p className="text-xs uppercase tracking-[0.16em] text-lapka-500">{formatShortTime(appointment.scheduled_at)}</p>
                                </div>
                                {appointment.status === 'in_progress' ? <span className="badge-yellow">В работе</span> : null}
                                {appointment.status === 'completed' ? <span className="badge-green">Готово</span> : null}
                                {appointment.urgency_level === 'urgent' ? <span className="badge-red">Срочно</span> : null}
                              </div>
                              <div className="mt-3 space-y-1 text-sm text-lapka-700">
                                <p>{appointment.service_type || appointment.service_name}</p>
                                <p>{vetNameById[appointment.vet_id] || 'Врач не назначен'}</p>
                                <p>{patient?.owner_name || 'Владелец скрыт'}</p>
                                <p>{localizeVisitType(appointment.visit_type)}</p>
                                <p>{roomName}</p>
                                <p>Протокол: {appointment.protocol_status === 'signed' ? 'Подписан' : appointment.protocol_status === 'ready' ? 'Готов' : appointment.protocol_status === 'draft' ? 'Черновик' : 'Не начат'}</p>
                                {appointment.discharge_ready ? <p className="font-semibold text-emerald-700">Готов к выписке</p> : null}
                                {roomConflicts[appointment.id] ? <p className="font-semibold text-rose-700">Конфликт по кабинету</p> : null}
                                {waitMinutes > 0 ? <p className={waitMinutes >= 30 ? 'font-semibold text-amber-700' : 'text-lapka-600'}>Ожидание: {waitMinutes} мин</p> : null}
                              </div>
                            </button>
                          );
                        })
                    ) : (
                      <EmptyState title="Пусто" text="В этой колонке на выбранную дату нет карточек." />
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}

      <Drawer
        open={Boolean(selectedAppointment)}
        onClose={() => setSelectedAppointmentId('')}
        title={selectedAppointment ? `Карточка этапа · ${patientMap[selectedAppointment.pet_id]?.pet_name || 'Пациент'}` : 'Карточка этапа'}
        width="max-w-[560px]"
        footer={
          selectedAppointment ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn-secondary !px-3 !py-2 text-sm" type="button" onClick={() => moveToStage(selectedAppointment.id, 'waiting')}>
                В ожидание
              </button>
              <button className="btn-secondary !px-3 !py-2 text-sm" type="button" onClick={() => moveToStage(selectedAppointment.id, 'in_consult')}>
                На приём
              </button>
              <button className="btn-primary !px-4 !py-2 text-sm" type="button" onClick={saveDrawerChanges}>
                Сохранить
              </button>
            </div>
          ) : null
        }
      >
        {selectedAppointment ? (
          <div className="space-y-4">
            <Card title="Контекст пациента" dense>
              <div className="space-y-1 text-sm text-lapka-700">
                <p className="text-lg font-extrabold text-lapka-900">{patientMap[selectedAppointment.pet_id]?.pet_name || 'Пациент'}</p>
                <p>{localizePetSpecies(patientMap[selectedAppointment.pet_id]?.species)} · {localizePetBreed(patientMap[selectedAppointment.pet_id]?.breed)}</p>
                <p>{patientMap[selectedAppointment.pet_id]?.owner_name || 'Владелец скрыт'}</p>
                <p>{selectedAppointment.service_type || selectedAppointment.service_name}</p>
              </div>
            </Card>
            <Card title="Текущий этап" dense tone="mint">
              <div className="space-y-3">
                <p className="text-sm text-lapka-700">Текущее окно: {formatShortTime(selectedAppointment.scheduled_at)} · {localizeVisitType(selectedAppointment.visit_type)}</p>
                <label className="block">
                  <span className="label">Стадия</span>
                  <select className="input" value={drawerStage} onChange={(event) => setDrawerStage(event.target.value)}>
                    {FLOWBOARD_COLUMNS.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Кабинет / ресурс</span>
                  <select className="input" value={drawerRoom} onChange={(event) => setDrawerRoom(event.target.value)}>
                    {resourceChoices.map((resource) => (
                      <option key={resource.id} value={resource.name}>
                        {resource.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Срочность</span>
                  <select className="input" value={drawerUrgency} onChange={(event) => setDrawerUrgency(event.target.value)}>
                    <option value="routine">Стандартно</option>
                    <option value="watch">Нужен контроль</option>
                    <option value="urgent">Срочно</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Статус протокола</span>
                  <select className="input" value={drawerProtocolStatus} onChange={(event) => setDrawerProtocolStatus(event.target.value)}>
                    <option value="not_started">Не начат</option>
                    <option value="draft">Черновик</option>
                    <option value="ready">Готов</option>
                    <option value="signed">Подписан</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-lapka-200 bg-white px-4 py-3 text-sm font-semibold text-lapka-800">
                  <input type="checkbox" checked={drawerDischargeReady} onChange={(event) => setDrawerDischargeReady(event.target.checked)} />
                  Готов к выписке
                </label>
                <label className="block">
                  <span className="label">Время</span>
                  <input className="input" type="datetime-local" value={formatDateTimeLocal(selectedAppointment.scheduled_at)} readOnly />
                </label>
                <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3 text-sm text-lapka-700">
                  <p className="font-semibold text-lapka-900">Ожидание сейчас: {computeWaitMinutes(selectedAppointment, dateValue, {})} мин</p>
                  <p className="mt-1">Используйте кабинет и стадию как явный operational context для ресепшн, врача и стационара.</p>
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
