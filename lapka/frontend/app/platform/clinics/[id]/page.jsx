'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { resolveClinicGallery, resolveClinicPhoto } from '@/lib/pets';

function localizeScope(scope, t) {
  const map = {
    prescriptions_only: t('platform.clinicDetailPage.scopePrescriptionsOnly'),
    basic_medical: t('platform.clinicDetailPage.scopeBasicMedical'),
    full_record: t('platform.clinicDetailPage.scopeFullRecord'),
    inpatient_view: t('platform.clinicDetailPage.scopeInpatientView'),
    camera_view: t('platform.clinicDetailPage.scopeCameraView'),
  };
  return map[scope] || scope || '—';
}

export default function PlatformClinicDetailPage() {
  const { t } = useTranslation('common');
  const params = useParams();
  const clinicId = params?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!clinicId) return;
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequest(`/api/v1/clinics/platform-registry/${clinicId}`);
        if (!cancelled) setData(payload);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || t('platform.clinicDetailPage.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [clinicId, t]);

  const clinic = data?.clinic || null;
  const gallery = useMemo(() => resolveClinicGallery(clinic).slice(0, 4), [clinic]);
  const primaryLocation = useMemo(
    () => (data?.locations || []).find((location) => location.is_primary) || data?.locations?.[0] || null,
    [data]
  );
  const buildClinicWorkspaceHref = (pathname) => {
    if (!clinic?.id) return pathname;
    const query = new URLSearchParams({ clinic_id: clinic.id });
    if (primaryLocation?.id) query.set('branch_id', primaryLocation.id);
    return `${pathname}?${query.toString()}`;
  };
  const consentRows = useMemo(() => {
    const source = data?.stats?.consents_by_scope || {};
    return Object.entries(source).map(([scope, count]) => [localizeScope(scope, t), String(count || 0)]);
  }, [data, t]);
  const locationSummaries = useMemo(() => {
    const source = data?.location_summaries || [];
    return new Map(source.map((row) => [row.location_id, row]));
  }, [data]);

  if (loading) {
    return <Skeleton className="h-[520px] w-full" />;
  }

  if (error) {
    return <ErrorBanner message={error} />;
  }

  if (!clinic) {
    return <ErrorBanner message={t('platform.clinicDetailPage.unavailableMessage')} />;
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">{t('platform.clinicDetailPage.headerEyebrow')}</p>
          <h1 className="page-title">{clinic.name}</h1>
          <p className="page-subtitle">
            {t('platform.clinicDetailPage.headerSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-secondary" href="/platform/clinics">{t('platform.clinicDetailPage.linkRegistry')}</Link>
          <Link className="btn-secondary" href={`/platform/branches?clinic_id=${clinic.id}`}>{t('platform.clinicDetailPage.linkBranches')}</Link>
          <Link className="btn-secondary" href={buildClinicWorkspaceHref('/clinic/schedule')}>{t('platform.clinicDetailPage.linkSchedule')}</Link>
          <Link className="btn-secondary" href={buildClinicWorkspaceHref('/clinic/flowboard')}>{t('platform.clinicDetailPage.linkFlowboard')}</Link>
          <Link className="btn-secondary" href={buildClinicWorkspaceHref('/clinic/inpatient')}>{t('platform.clinicDetailPage.linkInpatient')}</Link>
          <Link className="btn-secondary" href="/platform/ai">{t('platform.clinicDetailPage.linkAiCenter')}</Link>
          <Link className="btn-primary" href="/platform/security">{t('platform.clinicDetailPage.linkSecurity')}</Link>
        </div>
      </header>

      <ShowcasePanel
        eyebrow={t('platform.clinicDetailPage.showcaseEyebrow')}
        title={`${clinic.name}${clinic.city ? ` · ${clinic.city}` : ''}`}
        description={`${clinic.address || t('platform.clinicDetailPage.addressFallback')}${clinic.phone ? ` · ${clinic.phone}` : ''}${clinic.website ? ` · ${clinic.website}` : ''}`}
        imageSrc={resolveClinicPhoto(clinic)}
        imageAlt={clinic.name}
        badges={[
          clinic.emergency_available ? t('platform.clinicDetailPage.emergencyFlow') : t('platform.clinicDetailPage.plannedFlow'),
          t('platform.clinicDetailPage.badgeBranches', { count: data?.stats?.branches || 0 }),
          t('platform.clinicDetailPage.badgeVets', { count: data?.stats?.vets || 0 }),
          t('platform.clinicDetailPage.badgeInpatient', { count: data?.stats?.active_inpatient || 0 }),
        ]}
      />

      {gallery.length > 1 ? (
        <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {gallery.map((imageSrc, index) => (
            <div key={`${imageSrc}-${index}`} className="overflow-hidden rounded-[24px] border border-lapka-200 bg-white shadow-soft">
              <AppImage
                src={imageSrc}
                alt={t('platform.clinicDetailPage.galleryAlt', { clinic: clinic.name, index: index + 1 })}
                width={960}
                height={640}
                sizes="(max-width: 1280px) 100vw, 25vw"
                className="h-40 w-full object-cover"
              />
            </div>
          ))}
        </section>
      ) : null}

      <section className="kpi-grid">
        <Card title={t('platform.clinicDetailPage.kpiBranches')}><p className="text-4xl font-semibold text-lapka-900">{data?.stats?.branches || 0}</p></Card>
        <Card title={t('platform.clinicDetailPage.kpiTeam')}><p className="text-4xl font-semibold text-lapka-900">{data?.stats?.staff || 0}</p></Card>
        <Card title={t('platform.clinicDetailPage.kpiPatientsWithConsent')}><p className="text-4xl font-semibold text-lapka-900">{data?.stats?.patients || 0}</p></Card>
        <Card title={t('platform.clinicDetailPage.kpiAiOverrides')}><p className="text-4xl font-semibold text-lapka-900">{data?.stats?.ai_overrides || 0}</p></Card>
      </section>

      <section className="grid-soft-3 items-start">
        <Card title={t('platform.clinicDetailPage.locationsTitle')} subtitle={t('platform.clinicDetailPage.locationsSubtitle')}>
          <div className="space-y-3">
            {(data?.locations || []).map((location) => (
              <div key={location.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-semibold text-lapka-900">{location.city}</p>
                  <span className={location.is_primary ? 'badge-green' : 'badge-blue'}>
                    {location.is_primary ? t('platform.clinicDetailPage.mainBranch') : t('platform.clinicDetailPage.branch')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-lapka-600">{location.address}</p>
                <p className="mt-1 text-sm text-lapka-500">{location.hours || t('platform.clinicDetailPage.hoursFallback')}{location.phone ? ` · ${location.phone}` : ''}</p>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">{t('platform.clinicDetailPage.locationKpiAppointments14d')}</p>
                    <p className="mt-2 text-2xl font-extrabold text-lapka-900">{locationSummaries.get(location.id)?.appointments_14d || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">{t('platform.clinicDetailPage.locationKpiActiveFlow')}</p>
                    <p className="mt-2 text-2xl font-extrabold text-lapka-900">{locationSummaries.get(location.id)?.active_flow || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">{t('platform.clinicDetailPage.locationKpiTelemedicine')}</p>
                    <p className="mt-2 text-2xl font-extrabold text-lapka-900">{locationSummaries.get(location.id)?.telemedicine_14d || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">{t('platform.clinicDetailPage.locationKpiReadyDischarge')}</p>
                    <p className="mt-2 text-2xl font-extrabold text-lapka-900">{locationSummaries.get(location.id)?.ready_for_discharge || 0}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="btn-primary !px-3 !py-1.5"
                    href={`/platform/branches/${encodeURIComponent(location.id)}`}
                  >
                    {t('platform.clinicDetailPage.actionBranchCard')}
                  </Link>
                  <Link
                    className="btn-secondary !px-3 !py-1.5"
                    href={`/clinic/schedule?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(location.id)}`}
                  >
                    {t('platform.clinicDetailPage.actionBranchSchedule')}
                  </Link>
                  <Link
                    className="btn-secondary !px-3 !py-1.5"
                    href={`/clinic/flowboard?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(location.id)}`}
                  >
                    {t('platform.clinicDetailPage.actionBranchFlow')}
                  </Link>
                  <Link
                    className="btn-secondary !px-3 !py-1.5"
                    href={`/clinic/inpatient?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(location.id)}`}
                  >
                    {t('platform.clinicDetailPage.actionBranchInpatient')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('platform.clinicDetailPage.teamTitle')} subtitle={t('platform.clinicDetailPage.teamSubtitle')}>
          <div className="space-y-3">
            {(data?.staff || []).slice(0, 8).map((member) => (
              <div key={member.membership_id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-lapka-900">{member.full_name}</p>
                    <p className="text-sm text-lapka-600">{member.role_label}{member.specialty ? ` · ${member.specialty}` : ''}</p>
                  </div>
                  <span className="pill">{member.languages?.[0] || t('platform.clinicDetailPage.teamFallback')}</span>
                </div>
                {member.bio ? <p className="mt-2 text-sm leading-6 text-lapka-600">{member.bio}</p> : null}
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('platform.clinicDetailPage.perimeterStateTitle')} subtitle={t('platform.clinicDetailPage.perimeterStateSubtitle')}>
          <div className="space-y-3">
            <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.clinicDetailPage.ownerConsentsTitle')}</p>
              <p className="mt-2 text-sm text-lapka-600">{t('platform.clinicDetailPage.ownerConsentsSubtitle')}</p>
            </div>
            <Table
              searchable={false}
              paginated={false}
              columns={[t('platform.clinicDetailPage.colScope'), t('platform.clinicDetailPage.colCount')]}
              rows={consentRows}
              emptyTitle={t('platform.clinicDetailPage.consentsEmptyTitle')}
              emptyText={t('platform.clinicDetailPage.consentsEmptyText')}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.clinicDetailPage.activeInpatientTitle')}</p>
                <p className="mt-2 text-2xl font-semibold text-lapka-900">{data?.stats?.active_inpatient || 0}</p>
              </div>
              <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.clinicDetailPage.upcomingAppointmentsTitle')}</p>
                <p className="mt-2 text-2xl font-semibold text-lapka-900">{data?.stats?.upcoming_appointments || 0}</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <Card title={t('platform.clinicDetailPage.templatesTitle')} subtitle={t('platform.clinicDetailPage.templatesSubtitle')}>
          <Table
            columns={[t('platform.clinicDetailPage.colName'), t('platform.clinicDetailPage.colLevel'), t('platform.clinicDetailPage.colStatus'), t('platform.clinicDetailPage.colVersion'), t('platform.clinicDetailPage.colUsages')]}
            rows={(data?.templates || []).map((template) => [
              template.name,
              template.scope_label || template.scope || '—',
              template.status_label || template.status || '—',
              String(template.version || 1),
              String(template.usage_count || 0),
            ])}
            rowActions={(row) => [
              { label: t('platform.clinicDetailPage.actionPlatformTemplates'), href: '/platform/templates' },
            ]}
          />
        </Card>

        <Card title={t('platform.clinicDetailPage.aiOverridesTitle')} subtitle={t('platform.clinicDetailPage.aiOverridesSubtitle')}>
          <div className="space-y-3">
            {(data?.ai_overrides || []).length ? (data.ai_overrides.map((override) => (
              <div key={override.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-semibold text-lapka-900">{override.route_label || override.route_slug || t('platform.clinicDetailPage.aiRouteFallback')}</p>
                  <span className="pill">{override.provider_label || override.provider_slug || t('platform.clinicDetailPage.aiProviderFallback')}</span>
                </div>
                <p className="mt-2 text-sm text-lapka-600">{override.mode_label || t('platform.clinicDetailPage.aiModeFallback')}</p>
                <p className="mt-1 text-sm text-lapka-500">{override.model_key || t('platform.clinicDetailPage.aiModelFallback')}</p>
              </div>
            ))) : (
              <div className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-6 text-sm text-lapka-600">
                {t('platform.clinicDetailPage.aiOverridesEmptyText')}
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <Card title={t('platform.clinicDetailPage.reviewsTitle')} subtitle={t('platform.clinicDetailPage.reviewsSubtitle')}>
          <Table
            columns={[t('platform.clinicDetailPage.colTarget'), t('platform.clinicDetailPage.colRating'), t('platform.clinicDetailPage.colTitle'), t('platform.clinicDetailPage.colStatus')]}
            rows={(data?.reviews?.items || []).map((review) => [
              review.target_label || t('platform.clinicDetailPage.reviewTargetClinic'),
              String(review.rating || 0),
              review.title || t('platform.clinicDetailPage.reviewTitleFallback'),
              review.status_label || review.status || '—',
            ])}
          />
        </Card>
        <Card title={t('platform.clinicDetailPage.auditTitle')} subtitle={t('platform.clinicDetailPage.auditSubtitle')}>
          <Table
            columns={[t('platform.clinicDetailPage.colEvent'), t('platform.clinicDetailPage.colUser'), t('platform.clinicDetailPage.colWhen')]}
            rows={(data?.audit || []).map((event) => [
              event.action_label || event.action || t('platform.clinicDetailPage.eventFallback'),
              event.actor_name || t('platform.clinicDetailPage.systemFallback'),
              event.created_at_label || '—',
            ])}
          />
        </Card>
      </section>
    </div>
  );
}
