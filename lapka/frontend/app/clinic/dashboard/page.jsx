'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import StatsCard from '@/components/ui/StatsCard';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import PageHeader from '@/components/ui/PageHeader';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';
import { localizeAccessScope } from '@/lib/access';
import { summarizeClinicOperations } from '@/lib/clinic-workspace';

const Table = dynamic(() => import('@/components/ui/Table'), {
  loading: () => <Skeleton className="h-44 w-full" />,
});
const Charts = dynamic(() => import('@/components/ui/Charts'), {
  loading: () => <Skeleton className="h-44 w-full" />,
});

export default function ClinicDashboardPage() {
  const { clinicId, selectedClinic, selectedBranch } = useClinicScope();
  const [clinic, setClinic] = useState(null);
  const [members, setMembers] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [expirationAlerts, setExpirationAlerts] = useState(null);
  const [expirationAlerts7, setExpirationAlerts7] = useState(null);
  const [flowboardSummary, setFlowboardSummary] = useState(null);
  const [noShowReport, setNoShowReport] = useState(null);
  const [integrationsStatus, setIntegrationsStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = clinicId ? `?clinic_id=${encodeURIComponent(clinicId)}` : '';
      const clinicPayload = await apiRequest(`/api/v1/clinics/me${query}`);
      const resolvedClinicId = clinicPayload?.id || clinicId;
      if (!resolvedClinicId) {
        throw new Error('Не удалось определить текущую клинику');
      }
      const [membersPayload, patientsPayload, appointmentsPayload, auditPayload, expPayload30, expPayload7, flowPayload, noShowPayload, integrationsPayload] = await Promise.all([
        apiRequest(`/api/v1/clinics/me/members${query}`),
        apiRequest(`/api/v1/clinics/me/patients?limit=500${clinicId ? `&clinic_id=${encodeURIComponent(clinicId)}` : ''}`),
        apiRequest(`/api/v1/appointments?clinic_id=${encodeURIComponent(resolvedClinicId)}&mine=false`),
        apiRequest('/api/v1/audit?limit=20'),
        apiRequest(`/api/v1/clinic/pharmacy/expiration-alerts?clinic_id=${encodeURIComponent(resolvedClinicId)}&within_days=30`).catch(() => ({ count: 0, items: [] })),
        apiRequest(`/api/v1/clinic/pharmacy/expiration-alerts?clinic_id=${encodeURIComponent(resolvedClinicId)}&within_days=7`).catch(() => ({ count: 0, items: [] })),
        apiRequest(`/api/v1/appointments/flowboard/summary?clinic_id=${encodeURIComponent(resolvedClinicId)}&date=${new Date().toISOString().slice(0, 10)}`).catch(() => null),
        apiRequest(`/api/v1/analytics/clinic/${resolvedClinicId}/no-show-risk/report?days=90`).catch(() => null),
        apiRequest('/api/v1/clinic/integrations/status').catch(() => null),
      ]);
      setClinic(clinicPayload || null);
      setMembers(Array.isArray(membersPayload) ? membersPayload : []);
      setPatients(Array.isArray(patientsPayload) ? patientsPayload : []);
      setAppointments(Array.isArray(appointmentsPayload) ? appointmentsPayload : []);
      setAuditRows(Array.isArray(auditPayload) ? auditPayload : []);
      setExpirationAlerts(expPayload30?.count != null ? expPayload30 : { count: 0, items: [] });
      setExpirationAlerts7(expPayload7?.count != null ? expPayload7 : { count: 0, items: [] });
      setFlowboardSummary(flowPayload || null);
      setNoShowReport(noShowPayload || null);
      setIntegrationsStatus(integrationsPayload || null);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить данные клиники');
      setClinic(null);
      setMembers([]);
      setPatients([]);
      setAppointments([]);
      setAuditRows([]);
      setExpirationAlerts(null);
      setExpirationAlerts7(null);
      setFlowboardSummary(null);
      setNoShowReport(null);
      setIntegrationsStatus(null);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const staffTableRows = useMemo(
    () =>
      (members || []).map((row) => [
        row.full_name || '—',
        row.email || '—',
        row.role_in_clinic || row.role || '—',
        row.status || '—',
      ]),
    [members]
  );

  const auditTableRows = useMemo(
    () =>
      auditRows.slice(0, 10).map((row) => [
        new Date(row.created_at).toLocaleString('ru-RU'),
        row.action || '—',
        row.target_type || '—',
        row.actor_user_id || 'system',
      ]),
    [auditRows]
  );

  const patientTableRows = useMemo(
    () =>
      (patients || []).slice(0, 12).map((row) => [
        row.pet_name || '—',
        row.species || '—',
        row.owner_name || '—',
        row.owner_email || '—',
        localizeAccessScope(row.consent_scope),
      ]),
    [patients]
  );

  const ops = useMemo(
    () => summarizeClinicOperations({ members, patients, appointments, auditRows }),
    [appointments, auditRows, members, patients]
  );
  const criticalAlerts = useMemo(() => {
    const alerts = [];
    const flowMetrics = flowboardSummary?.metrics || {};
    const bottlenecks = flowboardSummary?.bottlenecks || {};
    if (Number(expirationAlerts7?.count || 0) > 0) {
      alerts.push({
        key: 'pharmacy-expiration',
        label: 'Критичные сроки на складе',
        value: `${expirationAlerts7.count} поз.`,
        href: '/clinic/pharmacy?expires_within_days=7',
      });
    }
    if (Number(bottlenecks.waitingOver30 || 0) >= 3) {
      alerts.push({
        key: 'waiting-over-30',
        label: 'Очередь > 30 минут',
        value: `${bottlenecks.waitingOver30} пациентов`,
        href: '/clinic/flowboard',
      });
    }
    if (Number(flowMetrics.in_consult || 0) >= 8) {
      alerts.push({
        key: 'high-consult-load',
        label: 'Высокая нагрузка приёма',
        value: `${flowMetrics.in_consult} в приёме`,
        href: '/clinic/flowboard',
      });
    }
    if (Number(noShowReport?.high_risk || 0) >= 5) {
      alerts.push({
        key: 'no-show-high-risk',
        label: 'No-show high-risk сегмент',
        value: `${noShowReport.high_risk} owner`,
        href: '/clinic/no-show-operations',
      });
    }
    return alerts.slice(0, 4);
  }, [expirationAlerts7?.count, flowboardSummary?.bottlenecks, flowboardSummary?.metrics, noShowReport?.high_risk]);

  return (
    <>
      <PageHeader
        title="CRM и контроль клиники"
        subtitle="Операционные KPI, команда клиники, пациенты по согласию владельца и контроль аудита в одной панели."
        testId="clinic-dashboard-header"
        titleTestId="clinic-dashboard-title"
        actions={(
          <>
            <Link href="/clinic/schedule" className="btn-primary">Открыть расписание</Link>
            <Link href="/clinic/flowboard" className="btn-secondary">Поток дня</Link>
            <Link href="/clinic/checkin" className="btn-secondary">Ресепшн</Link>
          </>
        )}
      />

      {error ? <ErrorBanner message={error} onRetry={loadAdminData} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </section>
      ) : (
        <>
          <section className="showcase-shell p-6 md:p-7">
            <div className="showcase-grid" />
            <div className="showcase-orb left-[7%] top-[14%] h-5 w-5 bg-cyan-400/85 shadow-[0_0_0_14px_rgba(61,147,220,0.12)]" />
            <div className="showcase-orb right-[8%] top-[12%] h-6 w-6 bg-emerald-400/80 shadow-[0_0_0_16px_rgba(66,186,160,0.14)]" />
            <div className="relative z-[1] grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:items-center">
              <div className="min-w-0">
                <span className="pill">Управляющий центр клиники</span>
                <h2 className="mt-4 text-[2.05rem] font-black tracking-tight text-lapka-900 md:text-[2.7rem]">
                  {clinic?.name || 'Клиника'} · оперативная сводка
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-8 text-lapka-700">
                  Администратор видит сеть сотрудников, пациентов по действующим согласиям владельцев и динамику загрузки по ключевым операциям.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="showcase-panel p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lapka-500">Сотрудники</p>
                    <p className="mt-2 text-2xl font-black text-lapka-900">{ops.staff}</p>
                  </div>
                  <div className="showcase-panel p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lapka-500">Пациенты по согласию</p>
                    <p className="mt-2 text-2xl font-black text-lapka-900">{ops.patients}</p>
                  </div>
                  <div className="showcase-panel p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-lapka-500">Будущие записи</p>
                    <p className="mt-2 text-2xl font-black text-lapka-900">{ops.upcoming}</p>
                  </div>
                </div>
              </div>

              <div className="showcase-panel showcase-floating overflow-hidden p-4">
                <div className="relative h-64 w-full overflow-hidden rounded-[24px]">
                  <Image src="/assets/img/admin-side.svg" alt="Операции клиники" fill sizes="320px" className="object-cover" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="pill">Аудит</span>
                  <span className="pill">Сотрудники</span>
                  <span className="pill">Пациенты</span>
                </div>
              </div>
            </div>
          </section>

          <section className="kpi-grid">
            <StatsCard label="Клиника" value={clinic?.name || '—'} />
            <StatsCard label="Сотрудники" value={String(ops.staff)} />
            <StatsCard label="Врачи" value={String(ops.vets)} />
            <StatsCard label="Пациенты по согласию" value={String(ops.patients)} />
            <StatsCard label="Будущие записи" value={String(ops.upcoming)} />
            <StatsCard label="На приёме" value={String(ops.inProgress)} />
            <StatsCard label="События аудита" value={String(ops.audit)} />
            {expirationAlerts7 && expirationAlerts7.count > 0 ? (
              <Link
                href="/clinic/pharmacy?expires_within_days=7"
                className="kpi-item rounded-[16px] border border-red-200 bg-red-50 px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-red-700">Срочно</p>
                <p className="mt-1 text-lg font-bold text-red-900">{expirationAlerts7.count} позиций</p>
                <p className="text-xs text-red-600">срок до 7 дней</p>
              </Link>
            ) : null}
            {expirationAlerts && expirationAlerts.count > 0 ? (
              <Link href="/clinic/pharmacy?expires_within_days=30" className="kpi-item rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Склад</p>
                <p className="mt-1 text-lg font-bold text-amber-900">{expirationAlerts.count} позиций</p>
                <p className="text-xs text-amber-600">срок до 30 дней</p>
              </Link>
            ) : null}
          </section>

          <Card title="Критичные алерты дня" subtitle="Быстрый вход в операционные действия без поиска по разделам.">
            {criticalAlerts.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {criticalAlerts.map((item) => (
                  <Link key={item.key} href={item.href} className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">{item.label}</p>
                    <p className="mt-1 text-lg font-black text-red-900">{item.value}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="Критичных алертов нет" text="Операционный контур стабилен на текущий момент." />
            )}
          </Card>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
            <Card title="Информация о клинике">
              <Table
                columns={['Параметр', 'Значение']}
                rows={[
                  ['ID', clinic?.id || '—'],
                  ['Название', clinic?.name || selectedClinic?.name || '—'],
                  ['Адрес', clinic?.address || '—'],
                  ['Роль в клинике', clinic?.role_in_clinic || '—'],
                  ['Пациентов с активным доступом', String(ops.patients)],
                  ['Будущих записей', String(ops.upcoming)],
                ]}
              />
            </Card>

            <Card title="Сотрудники клиники" subtitle="Пользователи и роли в клинике">
              {staffTableRows.length ? (
                <Table columns={['ФИО', 'Email', 'Роль', 'Статус']} rows={staffTableRows} />
              ) : (
                <EmptyState title="Сотрудники не найдены" text="Проверьте memberships для клиники." />
              )}
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1fr_0.9fr]">
            <Card title="Что важно сегодня" subtitle="Приоритетные операционные маршруты для администратора.">
              <div className="grid gap-3">
                {[
                  { title: 'Ресепшн и регистрация', text: 'Поток регистрации, QR-проверка и создание черновика визита без провалов в очереди.', href: '/clinic/checkin' },
                  { title: 'Расписание', text: 'Врачи, смены, загрузка слотов и перенос записей в одном календаре.', href: '/clinic/schedule' },
                  { title: 'Поток дня', text: 'Этапы пациента от записи до выписки: ожидание, приём, диагностика, стационар и контроль.', href: '/clinic/flowboard' },
                  { title: 'Стационар', text: 'Койки, загрузка отделения, обновления для владельца и контроль камер.', href: '/clinic/inpatient' },
                  { title: 'Склад и сроки', text: 'Остатки по локациям, сроки годности и сигналы по позициям, приближающимся к просрочке.', href: '/clinic/pharmacy' },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                    <p className="mt-2 text-sm leading-7 text-lapka-600">{item.text}</p>
                  </Link>
                ))}
              </div>
            </Card>

            <Card title="Операционный слой клиники" subtitle="Команда, финансы, качество и шаблоны должны быть рядом, а не размазаны по разделам.">
              <div className="space-y-4">
                <div className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Финансы и сервисы</p>
                  <p className="mt-2 text-lg font-bold text-lapka-900">Счета, страховые кейсы и каталог услуг собраны в один операционный слой.</p>
                </div>
                <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Контроль качества</p>
                  <p className="mt-2 text-lg font-bold text-lapka-900">Шаблоны, аудит и аналитика работают как единый управленческий контур, а не как разрозненные страницы.</p>
                </div>
                {integrationsStatus ? (
                  <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Интеграции и ретраи</p>
                    <p className="mt-2 text-lg font-bold text-lapka-900">
                      Провайдеры: {(integrationsStatus.providers || []).map((row) => row.provider).join(', ') || '—'}
                    </p>
                    <p className="mt-2 text-sm text-lapka-600">
                      Ошибки оплат (7д): {integrationsStatus.failed_payments_7d || 0} · Ожидают лабы: {integrationsStatus.pending_labs || 0}
                    </p>
                    <p className="mt-1 text-sm text-lapka-600">
                      Рекомендуемых retry-циклов: {integrationsStatus.retries_recommended || 0}
                    </p>
                  </div>
                ) : null}
              </div>
            </Card>
          </section>

          <Card title="Пациенты клиники" subtitle="Единая выборка по действующим согласиям владельцев">
            {patientTableRows.length ? (
              <Table columns={['Питомец', 'Вид', 'Владелец', 'Email', 'Уровень доступа']} rows={patientTableRows} />
            ) : (
              <EmptyState title="Нет пациентов" text="Появятся после выдачи доступа владельцами." />
            )}
          </Card>

          <Card title="Журнал событий" subtitle="Последние действия по клинике">
            {auditTableRows.length ? (
              <Table columns={['Дата', 'Действие', 'Цель', 'Исполнитель']} rows={auditTableRows} />
            ) : (
              <EmptyState title="Логи не найдены" text="События аудита появятся после действий в системе." />
            )}
          </Card>

          <Card title="Операционная динамика" subtitle="Демо-график нагрузки">
            <Charts points={[22, 24, 27, 23, 31, 28, 30]} labels={['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']} />
          </Card>
        </>
      )}
    </>
  );
}
