'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Table from '@/components/ui/Table';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/api';
import { resolveClinicGallery, resolveClinicPhoto } from '@/lib/pets';

export default function PlatformClinicsPage() {
  const { t } = useTranslation('common');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadRows() {
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequest('/api/v1/clinics/platform-registry');
        if (!cancelled) setRows(Array.isArray(payload) ? payload : []);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || t('platform.clinicsPage.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRows();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('platform.clinicsPage.headerTitle')}</h1>
          <p className="page-subtitle">{t('platform.clinicsPage.headerSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/platform/branches" className="btn-secondary">{t('platform.clinicsPage.linkBranches')}</Link>
          <Link href="/platform/ai" className="btn-primary">{t('platform.clinicsPage.linkAiCenter')}</Link>
        </div>
      </header>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <Skeleton className="h-56 w-full" /> : (
        <>
          <ShowcasePanel
            eyebrow={t('platform.clinicsPage.showcaseEyebrow')}
            title={t('platform.clinicsPage.showcaseTitle')}
            description={t('platform.clinicsPage.showcaseDescription')}
            imageSrc="/assets/img/clinic-ops.svg"
            imageAlt={t('platform.clinicsPage.showcaseImageAlt')}
            badges={[
              t('platform.clinicsPage.badgeClinics', { count: rows.length }),
              t('platform.clinicsPage.badgeNetwork'),
              t('platform.clinicsPage.badgeBranchesTeams'),
            ]}
            compact
          />
          <section className="kpi-grid">
            <Card title={t('platform.clinicsPage.kpiClinics')}>
              <p className="text-4xl font-semibold text-lapka-900">{rows.length}</p>
            </Card>
            <Card title={t('platform.clinicsPage.kpiBranches')}>
              <p className="text-4xl font-semibold text-lapka-900">{rows.reduce((sum, row) => sum + (row.stats?.branches || 0), 0)}</p>
            </Card>
            <Card title={t('platform.clinicsPage.kpiVets')}>
              <p className="text-4xl font-semibold text-lapka-900">{rows.reduce((sum, row) => sum + (row.stats?.vets || 0), 0)}</p>
            </Card>
            <Card title={t('platform.clinicsPage.kpiInpatient')}>
              <p className="text-4xl font-semibold text-lapka-900">{rows.reduce((sum, row) => sum + (row.stats?.active_inpatient || 0), 0)}</p>
            </Card>
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            {rows.map((clinic) => {
              const gallery = resolveClinicGallery(clinic).slice(0, 3);
              return (
                <Card
                  key={clinic.id}
                  className="overflow-hidden p-0"
                  title={clinic.name}
                  subtitle={`${clinic.city || t('platform.clinicsPage.fallbackLocation')} · ${clinic.address || t('platform.clinicsPage.fallbackAddress')}`}
                  action={<span className={clinic.emergency_available ? 'badge-red' : 'badge-green'}>{clinic.emergency_available ? t('platform.clinicsPage.emergencyContour') : t('platform.clinicsPage.plannedContour')}</span>}
                >
                  <div className="space-y-0">
                    <div className="relative h-48 w-full overflow-hidden border-b border-lapka-200">
                      <AppImage
                        src={resolveClinicPhoto(clinic)}
                        alt={clinic.name}
                        fill
                        sizes="(max-width: 1280px) 100vw, 640px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-lapka-900/45 via-lapka-900/10 to-transparent" />
                      <div className="absolute bottom-3 left-3 rounded-xl bg-white/92 px-3 py-2 backdrop-blur">
                        <p className="text-sm font-semibold text-lapka-900">{clinic.name}</p>
                        <p className="text-xs text-lapka-600">{clinic.phone || t('platform.clinicsPage.fallbackContacts')}</p>
                      </div>
                    </div>
                      <div className="grid gap-3 p-4">
                        <div className="flex flex-wrap gap-2">
                          <span className="pill">{clinic.city || t('platform.clinicsPage.fallbackCity')}</span>
                          <span className="pill">{clinic.hours || t('platform.clinicsPage.fallbackHours')}</span>
                          <span className="pill">{t('platform.clinicsPage.pillPhotos', { count: Array.isArray(clinic.photos) ? clinic.photos.length : gallery.length })}</span>
                          <span className="pill">{t('platform.clinicsPage.pillBranches', { count: clinic.stats?.branches || 0 })}</span>
                        </div>
                      {gallery.length > 1 ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {gallery.map((imageSrc, index) => (
                            <div key={`${clinic.id}-${imageSrc}-${index}`} className="overflow-hidden rounded-2xl border border-lapka-200 bg-lapka-50">
                              <AppImage
                                src={imageSrc}
                                alt={t('platform.clinicsPage.galleryAlt', { clinic: clinic.name, index: index + 1 })}
                                width={480}
                                height={320}
                                sizes="(max-width: 768px) 100vw, 180px"
                                className="h-24 w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="grid gap-2 text-sm text-lapka-700 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.clinicsPage.blockOrgContourTitle')}</p>
                          <p className="mt-2 font-semibold text-lapka-900">{clinic.emergency_available ? t('platform.clinicsPage.blockOrgContourEmergency') : t('platform.clinicsPage.blockOrgContourPlanned')}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.clinicsPage.blockTeamTitle')}</p>
                          <p className="mt-2 font-semibold text-lapka-900">{t('platform.clinicsPage.blockTeamValue', { vets: clinic.stats?.vets || 0, admins: clinic.stats?.admins || 0 })}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.clinicsPage.blockOpsTitle')}</p>
                          <p className="mt-2 font-semibold text-lapka-900">{t('platform.clinicsPage.blockOpsValue', { appointments: clinic.stats?.upcoming_appointments || 0, inpatient: clinic.stats?.active_inpatient || 0 })}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.clinicsPage.blockPatientsTitle')}</p>
                          <p className="mt-2 font-semibold text-lapka-900">{t('platform.clinicsPage.blockPatientsValue', { count: clinic.stats?.patients || 0 })}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.clinicsPage.blockServicesTitle')}</p>
                          <p className="mt-2 font-semibold text-lapka-900">{t('platform.clinicsPage.blockServicesValue', { count: clinic.stats?.services || 0 })}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{t('platform.clinicsPage.blockAiTitle')}</p>
                          <p className="mt-2 font-semibold text-lapka-900">{t('platform.clinicsPage.blockAiValue', { count: clinic.stats?.ai_overrides || 0 })}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link className="btn-secondary !px-3 !py-1.5" href={`/platform/clinics/${clinic.id}`}>{t('platform.clinicsPage.actionClinicCard')}</Link>
                        <Link className="btn-secondary !px-3 !py-1.5" href="/platform/security">{t('platform.clinicsPage.actionSecurity')}</Link>
                        <Link className="btn-primary !px-3 !py-1.5" href="/platform/ai">{t('platform.clinicsPage.actionAiCenter')}</Link>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>
          <Card title={t('platform.clinicsPage.registryTitle')}>
            <Table
              columns={[
                { id: 'name', label: t('platform.clinicsPage.colName') },
                { id: 'city', label: t('platform.clinicsPage.colCity') },
                { id: 'branches', label: t('platform.clinicsPage.colBranches') },
                { id: 'vets', label: t('platform.clinicsPage.colVets') },
                { id: 'patients', label: t('platform.clinicsPage.colPatients') },
                { id: 'inpatient', label: t('platform.clinicsPage.colInpatient') },
                { id: 'ai', label: t('platform.clinicsPage.colAi') },
              ]}
              rows={rows.map((row) => ({
                id: row.id,
                name: row.name,
                city: row.city || '—',
                branches: String(row.stats?.branches || 0),
                vets: String(row.stats?.vets || 0),
                patients: String(row.stats?.patients || 0),
                inpatient: String(row.stats?.active_inpatient || 0),
                ai: String(row.stats?.ai_overrides || 0),
              }))}
              rowActions={(row) => [
                { label: t('platform.clinicsPage.actionClinicCard'), href: `/platform/clinics/${row.id}` },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
