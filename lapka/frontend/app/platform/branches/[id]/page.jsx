'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/api';
import { resolveClinicGallery } from '@/lib/pets';

function formatVisitType(value, t) {
  const map = {
    in_person: t('platform.branchDetailPage.visitTypeInPerson'),
    video_consultation: t('platform.branchDetailPage.visitTypeTelemedicine'),
    telemedicine: t('platform.branchDetailPage.visitTypeTelemedicine'),
  };
  return map[value] || value || '—';
}

export default function PlatformBranchDetailPage() {
  const { t, i18n } = useTranslation('common');
  const params = useParams();
  const branchId = params?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest(`/api/v1/clinics/platform-branches/${branchId}`);
      setData(payload);
    } catch (requestError) {
      setError(requestError.message || t('platform.branchDetailPage.loadError'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, t]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const branch = data?.branch || null;
  const clinic = data?.clinic || null;
  const stats = data?.stats || {};
  const signals = data?.signals || {};
  const scheduler = data?.scheduler_settings || null;
  const resources = data?.resources || [];
  const staff = useMemo(() => data?.staff || [], [data?.staff]);
  const appointments = useMemo(() => data?.upcoming_appointments || [], [data?.upcoming_appointments]);
  const gallery = useMemo(
    () => resolveClinicGallery({ photos: branch?.photos || clinic?.photos || [], photo_url: branch?.cover_photo || clinic?.photos?.[0] }).slice(0, 4),
    [branch, clinic]
  );
  const appointmentRows = useMemo(
    () =>
      appointments.map((row) => ({
        id: row.id,
        time: row.start_at
          ? new Date(row.start_at).toLocaleString(i18n.resolvedLanguage === 'ru' ? 'ru-RU' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : '—',
        patient: row.pet_name || t('platform.branchDetailPage.patientFallback'),
        vet: row.vet_name || t('platform.branchDetailPage.vetFallback'),
        service: row.service_name || formatVisitType(row.visit_type, t),
        status: row.status_label || '—',
        room: row.room_label || t('platform.branchDetailPage.roomAuto'),
        pet_id: row.pet_id,
      })),
    [appointments, i18n.resolvedLanguage, t]
  );
  const todayAppointmentsCount = useMemo(
    () =>
      appointments.filter((row) => {
        if (!row.start_at) return false;
        const date = new Date(row.start_at);
        const now = new Date();
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
      }).length,
    [appointments]
  );
  const vetsCount = useMemo(() => staff.filter((member) => member.role === 'vet').length, [staff]);
  const adminsCount = useMemo(() => staff.filter((member) => member.role === 'clinic_admin').length, [staff]);
  const highLoadSignal = useMemo(
    () => Number(stats.blocked_flow || 0) > 0 || Boolean(signals.bottleneck) || Number(signals.resource_pressure || 0) >= 80,
    [signals.bottleneck, signals.resource_pressure, stats.blocked_flow]
  );

  const scopedSchedule = useMemo(() => {
    if (!branch?.id || !clinic?.id) return '/platform/branches';
    return `/clinic/schedule?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(branch.id)}`;
  }, [branch, clinic]);
  const scopedFlowboard = useMemo(() => {
    if (!branch?.id || !clinic?.id) return '/platform/branches';
    return `/clinic/flowboard?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(branch.id)}`;
  }, [branch, clinic]);
  const scopedInpatient = useMemo(() => {
    if (!branch?.id || !clinic?.id) return '/platform/branches';
    return `/clinic/inpatient?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(branch.id)}`;
  }, [branch, clinic]);

  const ready = Boolean(!loading && !error && branch && clinic);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-teal-400/14 via-surface-muted to-sky-400/12 p-5 shadow-card md:p-8 dark:from-teal-500/10 dark:to-sky-500/10">
        <Link className="btn-secondary mb-5 inline-flex !px-4 !py-2" href="/platform/branches">
          {t('platform.branchDetailPage.backToRegistry')}
        </Link>
        {loading ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-full max-w-xl" />
              <Skeleton className="h-16 w-full max-w-2xl" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{t('platform.branchDetailPage.headerEyebrow')}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl" data-testid="platform-branch-detail-title">
              {t('platform.branchDetailPage.errorTitle')}
            </h1>
            <p className="mt-3 max-w-2xl text-theme-muted">{t('platform.branchDetailPage.errorText')}</p>
          </div>
        ) : !branch || !clinic ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{t('platform.branchDetailPage.headerEyebrow')}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl" data-testid="platform-branch-detail-title">
              {t('platform.branchDetailPage.notFoundTitle')}
            </h1>
            <p className="mt-3 text-theme-muted">{t('platform.branchDetailPage.notFoundText')}</p>
          </div>
        ) : (
          <div className="relative grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">
                {branch.clinic_name || t('platform.branchDetailPage.clinicFallback')}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl" data-testid="platform-branch-detail-title">
                {branch.is_primary ? t('platform.branchDetailPage.mainBranch') : t('platform.branchDetailPage.branch')} · {branch.city}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
                {t('platform.branchDetailPage.heroDescription')}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/platform/clinics/${clinic.id}`} className="btn-secondary">
                  {t('platform.branchDetailPage.actionClinicCard')}
                </Link>
                <Link href={scopedSchedule} className="btn-secondary">
                  {t('platform.branchDetailPage.actionBranchSchedule')}
                </Link>
                <Link href={scopedFlowboard} className="btn-secondary">
                  {t('platform.branchDetailPage.actionBranchFlow')}
                </Link>
                <Link href={scopedInpatient} className="btn-primary">
                  {t('platform.branchDetailPage.actionBranchInpatient')}
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: t('platform.branchDetailPage.kpiAppointments14d'), value: stats.appointments_14d || 0, tone: 'text-sky-700 dark:text-sky-300' },
                { label: t('platform.branchDetailPage.kpiFlow'), value: stats.active_flow || 0, tone: 'text-violet-700 dark:text-violet-300' },
                { label: t('platform.branchDetailPage.kpiTelemed14d'), value: stats.telemedicine_14d || 0, tone: 'text-amber-700 dark:text-amber-300' },
                { label: t('platform.branchDetailPage.kpiOverload'), value: stats.blocked_flow || 0, tone: (stats.blocked_flow || 0) > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300' },
                { label: t('platform.branchDetailPage.kpiResources'), value: stats.active_resources || 0, tone: 'text-emerald-700 dark:text-emerald-300' },
                { label: t('platform.branchDetailPage.kpiShared'), value: stats.shared_resources || 0, tone: '' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums sm:text-3xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {error ? <ErrorBanner message={error} onRetry={loadDetail} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-52 w-full rounded-3xl" />
          <Skeleton className="h-96 w-full rounded-3xl" />
        </section>
      ) : null}

      {ready ? (
        <>
      <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{t('platform.branchDetailPage.opsEyebrow')}</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">{t('platform.branchDetailPage.opsTitle')}</h2>
          </div>
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
            branch ops
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
            title: t('platform.branchDetailPage.opsTodayAppointmentsTitle'),
              value: todayAppointmentsCount,
            text: t('platform.branchDetailPage.opsTodayAppointmentsText'),
              href: scopedSchedule,
              tone: 'text-sky-700 dark:text-sky-300',
            },
            {
            title: t('platform.branchDetailPage.opsShiftTeamTitle'),
              value: `${vetsCount}/${adminsCount}`,
            text: t('platform.branchDetailPage.opsShiftTeamText'),
              href: '#branch-team',
              tone: 'text-violet-700 dark:text-violet-300',
            },
            {
            title: t('platform.branchDetailPage.opsOverloadRiskTitle'),
              value: highLoadSignal ? 'HIGH' : 'OK',
            text: t('platform.branchDetailPage.opsOverloadRiskText'),
              href: scopedFlowboard,
              tone: highLoadSignal ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300',
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-border bg-surface/85 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <p className={`text-base font-black ${item.tone}`}>{item.title}</p>
              <p className="mt-2 text-3xl font-black tabular-nums text-theme">{item.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-theme">{item.text}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">{t('platform.branchDetailPage.openPerimeterCta')}</p>
            </Link>
          ))}
        </div>
      </section>

      <ShowcasePanel
        eyebrow={t('platform.branchDetailPage.showcaseEyebrow')}
        title={`${branch.clinic_name} · ${branch.city}`}
        description={`${branch.address}${branch.phone ? ` · ${branch.phone}` : ''}${branch.website ? ` · ${branch.website}` : ''}`}
        imageSrc={branch.cover_photo || gallery[0] || '/assets/img/clinic-ops.svg'}
        imageAlt={branch.clinic_name}
        badges={[
          branch.is_primary ? t('platform.branchDetailPage.mainBranch') : t('platform.branchDetailPage.workingBranch'),
          branch.emergency_available ? t('platform.branchDetailPage.emergencyFlow') : t('platform.branchDetailPage.plannedFlow'),
          t('platform.branchDetailPage.badgeAppointments14d', { count: stats.appointments_14d || 0 }),
          t('platform.branchDetailPage.badgeActiveResources', { count: stats.active_resources || 0 }),
        ]}
        compact
      />

      {gallery.length > 1 ? (
        <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {gallery.map((imageSrc, index) => (
            <div key={`${imageSrc}-${index}`} className="overflow-hidden rounded-[24px] border border-border bg-surface-muted/70 shadow-soft">
              <AppImage
                src={imageSrc}
                alt={t('platform.branchDetailPage.galleryAlt', { clinic: branch.clinic_name, index: index + 1 })}
                width={960}
                height={640}
                sizes="(max-width: 1280px) 100vw, 25vw"
                className="h-40 w-full object-cover"
              />
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid-soft-3 items-start">
        <Card title={t('platform.branchDetailPage.operationalProfileTitle')} subtitle={t('platform.branchDetailPage.operationalProfileSubtitle')}>
          <div className="space-y-3">
            <div className="rounded-[22px] border border-border bg-surface-muted/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">{t('platform.branchDetailPage.addressTitle')}</p>
              <p className="mt-2 text-base font-semibold text-theme">{branch.address}</p>
              <p className="mt-1 text-sm text-theme-muted">{branch.hours || t('platform.branchDetailPage.hoursFallback')}{branch.phone ? ` · ${branch.phone}` : ''}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">{t('platform.branchDetailPage.telemedicineShareTitle')}</p>
                <p className="mt-2 text-2xl font-extrabold text-theme">{signals.telemedicine_share || 0}%</p>
              </div>
              <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">{t('platform.branchDetailPage.resourcePressureTitle')}</p>
                <p className="mt-2 text-2xl font-extrabold text-theme">{signals.resource_pressure || 0}</p>
              </div>
            </div>
            <div className={`rounded-[22px] border px-4 py-4 ${signals.bottleneck ? 'surface-accent-warning' : 'surface-accent-success'}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">{t('platform.branchDetailPage.flowSignalTitle')}</p>
              <p className="mt-2 text-base font-semibold text-theme">
                {signals.bottleneck ? t('platform.branchDetailPage.flowSignalWarningText') : t('platform.branchDetailPage.flowSignalOkText')}
              </p>
            </div>
          </div>
        </Card>

        <Card title={t('platform.branchDetailPage.schedulerTitle')} subtitle={t('platform.branchDetailPage.schedulerSubtitle')}>
          {scheduler ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">{t('platform.branchDetailPage.schedulerWorkdayTitle')}</p>
                  <p className="mt-2 text-2xl font-extrabold text-theme">
                    {scheduler.day_start_hour}:00 – {scheduler.day_end_hour}:00
                  </p>
                </div>
                <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">{t('platform.branchDetailPage.schedulerSlotIntervalTitle')}</p>
                  <p className="mt-2 text-2xl font-extrabold text-theme">{scheduler.slot_interval_minutes} {t('platform.branchDetailPage.minutesShort')}</p>
                </div>
                <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">{t('platform.branchDetailPage.schedulerBufferTitle')}</p>
                  <p className="mt-2 text-2xl font-extrabold text-theme">{scheduler.default_buffer_minutes} {t('platform.branchDetailPage.minutesShort')}</p>
                </div>
                <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">{t('platform.branchDetailPage.schedulerSourceTitle')}</p>
                  <p className="mt-2 text-lg font-semibold text-theme">
                    {scheduler.source === 'branch_override'
                      ? t('platform.branchDetailPage.schedulerSourceBranch')
                      : scheduler.source === 'clinic_default'
                        ? t('platform.branchDetailPage.schedulerSourceClinic')
                        : t('platform.branchDetailPage.schedulerSourceSystem')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={scopedSchedule} className="btn-secondary !px-3 !py-1.5">{t('platform.branchDetailPage.schedulerOpenCalendar')}</Link>
                <Link href={scopedFlowboard} className="btn-secondary !px-3 !py-1.5">{t('platform.branchDetailPage.schedulerOpenFlow')}</Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-theme-muted">{t('platform.branchDetailPage.schedulerEmptyText')}</p>
          )}
        </Card>

        <Card title={t('platform.branchDetailPage.resourcesTitle')} subtitle={t('platform.branchDetailPage.resourcesSubtitle')}>
          <div className="space-y-3">
            {resources.length ? resources.map((resource) => (
              <div key={resource.id} className="rounded-[22px] border border-border bg-surface-muted/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-theme">{resource.name}</p>
                    <p className="text-sm text-theme-muted">{resource.resource_type_label}{resource.code ? ` · ${resource.code}` : ''}</p>
                  </div>
                  <span className="pill">{resource.scope_label}</span>
                </div>
                <p className="mt-2 text-sm text-theme-muted">{t('platform.branchDetailPage.capacityLabel', { count: resource.capacity || 1 })}</p>
              </div>
            )) : (
              <p className="text-sm text-theme-muted">{t('platform.branchDetailPage.resourcesEmptyText')}</p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card title={t('platform.branchDetailPage.appointmentsTitle')} subtitle={t('platform.branchDetailPage.appointmentsSubtitle')}>
          <Table
            columns={[
              { id: 'time', label: t('platform.branchDetailPage.colTime') },
              { id: 'patient', label: t('platform.branchDetailPage.colPatient') },
              { id: 'vet', label: t('platform.branchDetailPage.colVet') },
              { id: 'service', label: t('platform.branchDetailPage.colService') },
              { id: 'status', label: t('platform.branchDetailPage.colStatus') },
              { id: 'room', label: t('platform.branchDetailPage.colRoom') },
            ]}
            rows={appointmentRows}
            rowActions={(row) => {
              if (!row?.pet_id) return [];
              return [
                { label: t('platform.branchDetailPage.actionPatientCard'), href: `/clinic/patients/${row.pet_id}?clinic_id=${clinic.id}&branch_id=${branch.id}` },
                { label: t('platform.branchDetailPage.actionBranchSchedule'), href: scopedSchedule },
              ];
            }}
            emptyTitle={t('platform.branchDetailPage.appointmentsEmptyTitle')}
            emptyText={t('platform.branchDetailPage.appointmentsEmptyText')}
          />
        </Card>

        <Card title={t('platform.branchDetailPage.teamSignalsTitle')} subtitle={t('platform.branchDetailPage.teamSignalsSubtitle')}>
          <div id="branch-team" />
          <div className="space-y-3">
            {staff.slice(0, 8).map((member) => (
              <div key={member.membership_id} className="rounded-[22px] border border-border bg-surface-muted/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-theme">{member.full_name}</p>
                    <p className="text-sm text-theme-muted">{member.role_label}{member.specialty ? ` · ${member.specialty}` : ''}</p>
                  </div>
                  <span className="pill">{member.experience_years ? t('platform.branchDetailPage.experienceYears', { count: member.experience_years }) : t('platform.branchDetailPage.teamFallback')}</span>
                </div>
                {member.email ? <p className="mt-2 text-sm text-theme-muted">{member.email}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: t('platform.branchDetailPage.quickCalendarTitle'),
            text: t('platform.branchDetailPage.quickCalendarText'),
            href: scopedSchedule,
            tone: 'text-sky-700 dark:text-sky-300',
          },
          {
            title: t('platform.branchDetailPage.quickFlowboardTitle'),
            text: t('platform.branchDetailPage.quickFlowboardText'),
            href: scopedFlowboard,
            tone: 'text-rose-700 dark:text-rose-300',
          },
          {
            title: t('platform.branchDetailPage.quickInpatientTitle'),
            text: t('platform.branchDetailPage.quickInpatientText'),
            href: scopedInpatient,
            tone: 'text-emerald-700 dark:text-emerald-300',
          },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-2xl border border-border bg-surface-muted/70 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
          >
            <p className={`text-base font-black ${item.tone}`}>{item.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-theme">{item.text}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">{t('platform.branchDetailPage.openPerimeterCta')}</p>
          </Link>
        ))}
      </section>
        </>
      ) : null}
    </div>
  );
}
