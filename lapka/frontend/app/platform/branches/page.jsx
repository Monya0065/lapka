'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import Table from '@/components/ui/Table';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/api';
import { resolveClinicGallery } from '@/lib/pets';

export default function PlatformBranchesPage() {
  const { t } = useTranslation('common');
  const searchParams = useSearchParams();
  const selectedClinicId = searchParams?.get('clinic_id') || '';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadRows() {
      setLoading(true);
      setError('');
      try {
        const query = selectedClinicId ? `?clinic_id=${encodeURIComponent(selectedClinicId)}` : '';
        const payload = await apiRequest(`/api/v1/clinics/platform-branches${query}`);
        if (!cancelled) setRows(Array.isArray(payload) ? payload : []);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || t('platform.branchesPage.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRows();
    return () => {
      cancelled = true;
    };
  }, [selectedClinicId, t]);

  const cities = useMemo(() => new Set(rows.map((row) => row.city).filter(Boolean)).size, [rows]);
  const primaryCount = useMemo(() => rows.filter((row) => row.is_primary).length, [rows]);
  const emergencyCount = useMemo(() => rows.filter((row) => row.emergency_available).length, [rows]);
  const flowPressure = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.stats?.blocked_flow || 0), 0),
    [rows]
  );

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">{t('platform.branchesPage.headerEyebrow')}</p>
          <h1 className="page-title">{t('platform.branchesPage.headerTitle')}</h1>
          <p className="page-subtitle">{t('platform.branchesPage.headerSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/platform/clinics" className="btn-secondary">{t('platform.branchesPage.linkClinics')}</Link>
          <Link href="/platform/dashboard" className="btn-secondary">{t('platform.branchesPage.linkOverview')}</Link>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          <ShowcasePanel
            eyebrow={t('platform.branchesPage.showcaseEyebrow')}
            title={t('platform.branchesPage.showcaseTitle')}
            description={selectedClinicId
              ? t('platform.branchesPage.showcaseDescriptionFiltered')
              : t('platform.branchesPage.showcaseDescriptionDefault')}
            imageSrc="/assets/img/clinic-ops.svg"
            imageAlt={t('platform.branchesPage.showcaseImageAlt')}
            badges={[
              t('platform.branchesPage.badgeBranches', { count: rows.length }),
              t('platform.branchesPage.badgeCities', { count: cities }),
              t('platform.branchesPage.badgeEmergency', { count: emergencyCount }),
              t('platform.branchesPage.badgeFlowSignals', { count: flowPressure }),
            ]}
            compact
          />

          <section className="kpi-grid">
            <StatsCard label={t('platform.branchesPage.kpiBranches')} value={String(rows.length)} />
            <StatsCard label={t('platform.branchesPage.kpiPrimary')} value={String(primaryCount)} />
            <StatsCard label={t('platform.branchesPage.kpiCities')} value={String(cities)} />
            <StatsCard label={t('platform.branchesPage.kpiFlowPressure')} value={String(flowPressure)} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            {rows.slice(0, 8).map((branch) => {
              const gallery = resolveClinicGallery({ photos: branch.photos, photo_url: branch.cover_photo }).slice(0, 3);
              const branchDetailHref = `/platform/branches/${branch.id}`;
              const scopedSchedule = `/clinic/schedule?clinic_id=${encodeURIComponent(branch.clinic_id)}&branch_id=${encodeURIComponent(branch.id)}`;
              const scopedFlowboard = `/clinic/flowboard?clinic_id=${encodeURIComponent(branch.clinic_id)}&branch_id=${encodeURIComponent(branch.id)}`;
              const scopedInpatient = `/clinic/inpatient?clinic_id=${encodeURIComponent(branch.clinic_id)}&branch_id=${encodeURIComponent(branch.id)}`;
              return (
                <Card
                  key={branch.id}
                  className="overflow-hidden p-0"
                  title={branch.clinic_name}
                  subtitle={`${branch.city || t('platform.branchesPage.cityFallback')} · ${branch.address || t('platform.branchesPage.addressFallback')}`}
                  action={<span className={branch.emergency_available ? 'badge-red' : 'badge-blue'}>{branch.emergency_available ? t('platform.branchesPage.emergencyBranch') : t('platform.branchesPage.plannedBranch')}</span>}
                >
                  <div className="space-y-0">
                    <div className="relative h-40 w-full overflow-hidden border-b border-lapka-200">
                      <AppImage
                        src={branch.cover_photo || gallery[0] || '/assets/img/clinic-ops.svg'}
                        alt={branch.clinic_name}
                        fill
                        sizes="(max-width: 1280px) 100vw, 640px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-lapka-900/45 via-lapka-900/10 to-transparent" />
                      <div className="absolute bottom-3 left-3 rounded-xl bg-white/92 px-3 py-2 backdrop-blur">
                        <p className="text-sm font-semibold text-lapka-900">{branch.is_primary ? t('platform.branchesPage.mainBranch') : t('platform.branchesPage.branch')}</p>
                        <p className="text-xs text-lapka-600">{branch.phone || t('platform.branchesPage.contactFallback')}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 p-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="pill">{branch.hours || t('platform.branchesPage.hoursFallback')}</span>
                        <span className="pill">{t('platform.branchesPage.appointments14dPill', { count: branch.stats?.appointments_14d || 0 })}</span>
                        <span className="pill">{t('platform.branchesPage.vetsPill', { count: branch.stats?.clinic_vets || 0 })}</span>
                      </div>
                      {gallery.length > 1 ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {gallery.map((imageSrc, index) => (
                            <div key={`${branch.id}-${imageSrc}-${index}`} className="overflow-hidden rounded-2xl border border-lapka-200 bg-lapka-50">
                              <AppImage
                                src={imageSrc}
                                alt={t('platform.branchesPage.galleryAlt', { clinic: branch.clinic_name, index: index + 1 })}
                                width={480}
                                height={320}
                                sizes="(max-width: 768px) 100vw, 180px"
                                className="h-24 w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">{t('platform.branchesPage.metricFlowNow')}</p>
                          <p className="mt-2 text-2xl font-extrabold text-lapka-900">{branch.stats?.active_flow || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">{t('platform.branchesPage.metricTelemedicine')}</p>
                          <p className="mt-2 text-2xl font-extrabold text-lapka-900">{branch.stats?.telemedicine_14d || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">{t('platform.branchesPage.metricReadyDischarge')}</p>
                          <p className="mt-2 text-2xl font-extrabold text-lapka-900">{branch.stats?.ready_for_discharge || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">{t('platform.branchesPage.metricFlowSignals')}</p>
                          <p className="mt-2 text-2xl font-extrabold text-lapka-900">{branch.stats?.blocked_flow || 0}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link className="btn-primary !px-3 !py-1.5" href={branchDetailHref}>{t('platform.branchesPage.actionBranchCard')}</Link>
                        <Link className="btn-secondary !px-3 !py-1.5" href={scopedSchedule}>{t('platform.branchesPage.actionBranchSchedule')}</Link>
                        <Link className="btn-secondary !px-3 !py-1.5" href={scopedFlowboard}>{t('platform.branchesPage.actionBranchFlow')}</Link>
                        <Link className="btn-secondary !px-3 !py-1.5" href={scopedInpatient}>{t('platform.branchesPage.actionBranchInpatient')}</Link>
                        <Link className="btn-secondary !px-3 !py-1.5" href={`/platform/clinics/${branch.clinic_id}`}>{t('platform.branchesPage.actionClinicCard')}</Link>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>

          <Card title={t('platform.branchesPage.registryTitle')} subtitle={t('platform.branchesPage.registrySubtitle')}>
            <Table
              columns={[
                { id: 'clinic', label: t('platform.branchesPage.colClinic') },
                { id: 'city', label: t('platform.branchesPage.colCity') },
                { id: 'branch', label: t('platform.branchesPage.colBranch') },
                { id: 'appointments', label: t('platform.branchesPage.colAppointments') },
                { id: 'flow', label: t('platform.branchesPage.colFlow') },
                { id: 'signals', label: t('platform.branchesPage.colSignals') },
              ]}
              rows={rows.map((row) => ({
                id: row.id,
                clinic: row.clinic_name,
                city: row.city || '—',
                branch: row.is_primary ? t('platform.branchesPage.mainBranch') : t('platform.branchesPage.branch'),
                appointments: String(row.stats?.appointments_14d || 0),
                flow: String(row.stats?.active_flow || 0),
                signals: String(row.stats?.blocked_flow || 0),
              }))}
              rowActions={(row) => {
                const branch = rows.find((candidate) => candidate.id === row.id);
                if (!branch) return [];
                return [
                  { label: t('platform.branchesPage.actionBranchCard'), href: `/platform/branches/${branch.id}` },
                  { label: t('platform.branchesPage.actionBranchSchedule'), href: `/clinic/schedule?clinic_id=${branch.clinic_id}&branch_id=${branch.id}` },
                  { label: t('platform.branchesPage.actionClinicCard'), href: `/platform/clinics/${branch.clinic_id}` },
                ];
              }}
            />
          </Card>
        </>
      )}
    </div>
  );
}
