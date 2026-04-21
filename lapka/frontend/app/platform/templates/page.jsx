'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/api';

export default function PlatformTemplatesPage() {
  const { t } = useTranslation('common');
  const localizeScope = (scope) => {
    const map = {
      system: t('platform.templatesPage.scopeSystem'),
      clinic: t('platform.templatesPage.scopeClinic'),
      branch: t('platform.templatesPage.scopeBranch'),
      personal: t('platform.templatesPage.scopePersonal'),
    };
    return map[scope] || scope || '—';
  };
  const localizeStatus = (value) => {
    const map = {
      draft: t('platform.templatesPage.statusDraft'),
      published: t('platform.templatesPage.statusPublished'),
      archived: t('platform.templatesPage.statusArchived'),
    };
    return map[value] || value || '—';
  };
  const localizeSpecialty = (value) => {
    const map = {
      general: t('platform.templatesPage.specialtyGeneral'),
      therapy: t('platform.templatesPage.specialtyTherapy'),
      surgery: t('platform.templatesPage.specialtySurgery'),
      dermatology: t('platform.templatesPage.specialtyDermatology'),
      cardiology: t('platform.templatesPage.specialtyCardiology'),
      neurology: t('platform.templatesPage.specialtyNeurology'),
      anesthesia: t('platform.templatesPage.specialtyAnesthesia'),
      inpatient: t('platform.templatesPage.specialtyInpatient'),
    };
    return map[value] || value || '—';
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadOverview() {
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequest('/api/v1/platform/templates/overview');
        if (!cancelled) setData(payload);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || t('platform.templatesPage.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return <Skeleton className="h-[520px] w-full" />;
  }

  if (error) {
    return <ErrorBanner message={error} />;
  }

  const summary = data?.summary || {};
  const clinicUsage = data?.clinic_usage || [];
  const topTemplates = data?.top_templates || [];
  const recentUpdates = data?.recent_updates || [];
  const recommendedUpdates = data?.recommended_updates || [];

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('platform.templatesPage.headerTitle')}</h1>
          <p className="page-subtitle">
            {t('platform.templatesPage.headerSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-secondary" href="/platform/ai">{t('platform.templatesPage.linkAiCenter')}</Link>
          <Link className="btn-primary" href="/platform/clinics">{t('platform.templatesPage.linkClinics')}</Link>
        </div>
      </header>

      <ShowcasePanel
        eyebrow={t('platform.templatesPage.showcaseEyebrow')}
        title={t('platform.templatesPage.showcaseTitle')}
        description={t('platform.templatesPage.showcaseDescription')}
        imageSrc="/assets/img/admin-side.svg"
        imageAlt={t('platform.templatesPage.showcaseImageAlt')}
        badges={[
          t('platform.templatesPage.badgeTemplates', { count: summary.templates || 0 }),
          t('platform.templatesPage.badgeClinics', { count: summary.clinics || 0 }),
          t('platform.templatesPage.badgePublished', { count: summary.published || 0 }),
          t('platform.templatesPage.badgeUsages', { count: summary.usage_total || 0 }),
        ]}
      />

      <section className="kpi-grid">
        <Card title={t('platform.templatesPage.kpiTemplates')}><p className="text-4xl font-semibold text-lapka-900">{summary.templates || 0}</p></Card>
        <Card title={t('platform.templatesPage.kpiClinics')}><p className="text-4xl font-semibold text-lapka-900">{summary.clinics || 0}</p></Card>
        <Card title={t('platform.templatesPage.kpiDefaults')}><p className="text-4xl font-semibold text-lapka-900">{summary.defaults || 0}</p></Card>
        <Card title={t('platform.templatesPage.kpiUsages')}><p className="text-4xl font-semibold text-lapka-900">{summary.usage_total || 0}</p></Card>
        <Card title={t('platform.templatesPage.kpiDoctorsUsing')}><p className="text-4xl font-semibold text-lapka-900">{summary.doctors_using || 0}</p></Card>
        <Card title={t('platform.templatesPage.kpiNeedUpdate')}><p className="text-4xl font-semibold text-lapka-900">{summary.recommended_updates || 0}</p></Card>
      </section>

      <section className="grid-soft-3 items-start">
        <Card title={t('platform.templatesPage.scopeLevelsTitle')} subtitle={t('platform.templatesPage.scopeLevelsSubtitle')}>
          <div className="space-y-3">
            {Object.entries(data?.scope_counts || {}).map(([scope, count]) => (
              <div key={scope} className="flex items-center justify-between rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div>
                  <p className="text-base font-semibold text-lapka-900">{localizeScope(scope)}</p>
                  <p className="text-sm text-lapka-500">{t('platform.templatesPage.contentLevelLabel')}</p>
                </div>
                <span className="text-2xl font-semibold text-lapka-900">{count || 0}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t('platform.templatesPage.statusesTitle')} subtitle={t('platform.templatesPage.statusesSubtitle')}>
          <div className="space-y-3">
            {Object.entries(data?.status_counts || {}).map(([statusKey, count]) => (
              <div key={statusKey} className="flex items-center justify-between rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div>
                  <p className="text-base font-semibold text-lapka-900">{localizeStatus(statusKey)}</p>
                  <p className="text-sm text-lapka-500">{t('platform.templatesPage.contentStateLabel')}</p>
                </div>
                <span className="text-2xl font-semibold text-lapka-900">{count || 0}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t('platform.templatesPage.typesTitle')} subtitle={t('platform.templatesPage.typesSubtitle')}>
          <div className="space-y-3">
            {Object.entries(data?.type_counts || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div>
                  <p className="text-base font-semibold text-lapka-900">{type}</p>
                  <p className="text-sm text-lapka-500">{t('platform.templatesPage.templateTypeLabel')}</p>
                </div>
                <span className="text-2xl font-semibold text-lapka-900">{count || 0}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <Card title={t('platform.templatesPage.clinicsAdoptionTitle')} subtitle={t('platform.templatesPage.clinicsAdoptionSubtitle')}>
          {clinicUsage.length ? (
            <Table
              columns={[
                { id: 'clinic_name', label: t('platform.templatesPage.colClinic') },
                { id: 'templates', label: t('platform.templatesPage.colTemplates') },
                { id: 'published', label: t('platform.templatesPage.colPublished') },
                { id: 'defaults', label: t('platform.templatesPage.colDefaults') },
                { id: 'personal', label: t('platform.templatesPage.colPersonal') },
                { id: 'branch', label: t('platform.templatesPage.colBranch') },
                { id: 'doctors_using', label: t('platform.templatesPage.colDoctors') },
                { id: 'usage_count', label: t('platform.templatesPage.colUsages') },
              ]}
              rows={clinicUsage.map((row) => ({
                id: row.clinic_id,
                clinic_id: row.clinic_id,
                clinic_name: row.clinic_name,
                templates: String(row.templates || 0),
                published: String(row.published || 0),
                defaults: String(row.defaults || 0),
                personal: String(row.personal || 0),
                branch: String(row.branch || 0),
                doctors_using: String(row.doctors_using || 0),
                usage_count: String(row.usage_count || 0),
              }))}
              rowActions={(row) => [
                { label: t('platform.templatesPage.actionClinicCard'), href: `/platform/clinics/${row.clinic_id}` },
              ]}
            />
          ) : (
            <EmptyState title={t('platform.templatesPage.emptyNoContentTitle')} text={t('platform.templatesPage.emptyNoContentText')} />
          )}
        </Card>

        <Card title={t('platform.templatesPage.topTemplatesTitle')} subtitle={t('platform.templatesPage.topTemplatesSubtitle')}>
          {topTemplates.length ? (
            <Table
              columns={[
                { id: 'name', label: t('platform.templatesPage.colTemplate') },
                { id: 'clinic_name', label: t('platform.templatesPage.colClinic') },
                { id: 'scope_label', label: t('platform.templatesPage.colLevel') },
                { id: 'specialty_label', label: t('platform.templatesPage.colSpecialty') },
                { id: 'status_label', label: t('platform.templatesPage.colStatus') },
                { id: 'usage_count', label: t('platform.templatesPage.colUsages') },
                { id: 'recommended_updates', label: t('platform.templatesPage.colNeedUpdate') },
              ]}
              rows={topTemplates.map((row) => ({
                id: row.id,
                name: row.name,
                clinic_name: row.clinic_name,
                scope_label: localizeScope(row.scope),
                specialty_label: localizeSpecialty(row.specialty),
                status_label: localizeStatus(row.status),
                usage_count: String(row.usage_count || 0),
                recommended_updates: row.recommended_updates || t('platform.templatesPage.noValue'),
              }))}
            />
          ) : (
            <EmptyState title={t('platform.templatesPage.emptyNoActivityTitle')} text={t('platform.templatesPage.emptyNoActivityText')} />
          )}
        </Card>
      </section>

      <Card title={t('platform.templatesPage.recentUpdatesTitle')} subtitle={t('platform.templatesPage.recentUpdatesSubtitle')}>
        {recentUpdates.length ? (
          <Table
            columns={[
              { id: 'name', label: t('platform.templatesPage.colTemplate') },
              { id: 'clinic_name', label: t('platform.templatesPage.colClinic') },
              { id: 'scope_label', label: t('platform.templatesPage.colLevel') },
              { id: 'status_label', label: t('platform.templatesPage.colStatus') },
              { id: 'author_name', label: t('platform.templatesPage.colAuthor') },
            ]}
            rows={recentUpdates.map((row) => ({
              id: row.id,
              name: row.name,
              clinic_name: row.clinic_name,
              scope_label: localizeScope(row.scope),
              status_label: localizeStatus(row.status),
              author_name: row.author_name,
            }))}
          />
        ) : (
          <EmptyState title={t('platform.templatesPage.emptyNoUpdatesTitle')} text={t('platform.templatesPage.emptyNoUpdatesText')} />
        )}
      </Card>

      <Card title={t('platform.templatesPage.recommendedUpdatesTitle')} subtitle={t('platform.templatesPage.recommendedUpdatesSubtitle')}>
        {recommendedUpdates.length ? (
          <Table
            columns={[
              { id: 'name', label: t('platform.templatesPage.colTemplate') },
              { id: 'clinic_name', label: t('platform.templatesPage.colClinic') },
              { id: 'scope_label', label: t('platform.templatesPage.colLevel') },
              { id: 'usage_count', label: t('platform.templatesPage.colUsages') },
              { id: 'reason', label: t('platform.templatesPage.colReason') },
            ]}
            rows={recommendedUpdates.map((row) => ({
              id: row.id,
              name: row.name,
              clinic_name: row.clinic_name,
              scope_label: localizeScope(row.scope),
              usage_count: String(row.usage_count || 0),
              reason: row.reason,
            }))}
          />
        ) : (
          <EmptyState title={t('platform.templatesPage.emptyNoRecommendationsTitle')} text={t('platform.templatesPage.emptyNoRecommendationsText')} />
        )}
      </Card>
    </div>
  );
}
