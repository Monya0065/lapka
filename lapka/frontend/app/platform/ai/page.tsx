'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import PageHeader from '@/components/ui/PageHeader';
import { apiRequest } from '@/lib/api';
import { buildPlatformAiI18nMaps } from '@/lib/platform-ai-i18n.mjs';
import { AI_PROVIDER_PRESETS } from '@/lib/platform-workspace';

const DEFAULT_GUARDRAILS = {
  monthlyBudget: 4800,
  hardLimit: 6200,
  maxOwnerRequestsPerHour: 1600,
  maxVetRequestsPerHour: 900,
  piiRedaction: true,
  promptAudit: true,
  fallbackMode: 'strict',
};

const LOAD_SPLIT_BLOCKS = [
  ['loadBlock1Title', 'loadBlock1Text'],
  ['loadBlock2Title', 'loadBlock2Text'],
  ['loadBlock3Title', 'loadBlock3Text'],
];

export default function PlatformAiPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('ru') ? 'ru-RU' : 'en-US';
  const platformAiI18n = useMemo(() => buildPlatformAiI18nMaps(t), [t]);

  const defaultRouting = useMemo(
    () => [
      {
        id: 'owner-triage',
        slug: 'owner-triage',
        scenario_key: 'owner-triage',
        scenario: t('platform.aiPage.routeOwnerTriageScenario'),
        primary: 'openai',
        fallback: 'anthropic',
        policy: t('platform.aiPage.routeOwnerTriagePolicy'),
        enabled: true,
      },
      {
        id: 'doc-explain',
        slug: 'doc-explain',
        scenario_key: 'doc-explain',
        scenario: t('platform.aiPage.routeDocExplainScenario'),
        primary: 'openai',
        fallback: 'gemini',
        policy: t('platform.aiPage.routeDocExplainPolicy'),
        enabled: true,
      },
      {
        id: 'vet-notes',
        slug: 'vet-notes',
        scenario_key: 'vet-notes',
        scenario: t('platform.aiPage.routeVetNotesScenario'),
        primary: 'anthropic',
        fallback: 'openai',
        policy: t('platform.aiPage.routeVetNotesPolicy'),
        enabled: true,
      },
      {
        id: 'knowledge-search',
        slug: 'knowledge-search',
        scenario_key: 'knowledge-search',
        scenario: t('platform.aiPage.routeKnowledgeScenario'),
        primary: 'gemini',
        fallback: 'openai',
        policy: t('platform.aiPage.routeKnowledgePolicy'),
        enabled: true,
      },
    ],
    [t]
  );

  const defaultOverrides = useMemo(
    () => [
      {
        id: 'clinic-demo',
        source_type: 'clinic',
        level: t('platform.aiPage.ovClinicLevel'),
        target: t('platform.aiPage.ovClinicTarget'),
        mode: t('platform.aiPage.ovClinicMode'),
        provider: 'openai',
        enabled: true,
      },
      {
        id: 'branch-sensitive',
        source_type: 'tenant',
        level: t('platform.aiPage.ovBranchLevel'),
        target: t('platform.aiPage.ovBranchTarget'),
        mode: t('platform.aiPage.ovBranchMode'),
        provider: 'local',
        tenant_key: 'private-cases',
        enabled: true,
      },
      {
        id: 'role-vet',
        source_type: 'role',
        level: t('platform.aiPage.ovRoleLevel'),
        target: t('platform.aiPage.ovRoleTarget'),
        mode: t('platform.aiPage.ovRoleMode'),
        provider: 'anthropic',
        role: 'vet',
        enabled: true,
      },
    ],
    [t]
  );

  const [providers, setProviders] = useState([]);
  const [routing, setRouting] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [guardrails, setGuardrails] = useState(DEFAULT_GUARDRAILS);
  const [clinics, setClinics] = useState([]);
  const [clinicUsage, setClinicUsage] = useState([]);
  const [overrideSummary, setOverrideSummary] = useState([]);
  const [usageSummary, setUsageSummary] = useState(null);
  const [recentUsage, setRecentUsage] = useState([]);
  const [routeHealth, setRouteHealth] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveNote, setSaveNote] = useState('');

  const normalizeProvider = useCallback((provider) => {
    const slug = provider.slug || provider.id || 'provider';
    const models = Array.isArray(provider.models) ? provider.models : [];
    const defaultModel = provider.default_model || models[0] || provider.fallback || `${slug}-default`;
    const fallback = provider.fallback || models[1] || defaultModel;
    return {
      id: provider.id || slug,
      slug,
      name: provider.name || slug,
      status: provider.status || 'active',
      provider_type: provider.provider_type || (slug === 'local' ? 'local' : 'remote'),
      routing: provider.routing || '',
      fallback,
      default_model: defaultModel,
      models: models.length ? models : [defaultModel, fallback].filter(Boolean),
      capabilities: Array.isArray(provider.capabilities) ? provider.capabilities : [],
    };
  }, []);

  const localizedProviderPresets = useMemo(
    () =>
      AI_PROVIDER_PRESETS.map((p) =>
        normalizeProvider({
          ...p,
          name: p.nameKey ? t(p.nameKey) : p.name,
          routing: p.routingKey ? t(p.routingKey) : p.routing || '',
        })
      ),
    [normalizeProvider, t]
  );

  const normalizeRoute = useCallback((route) => ({
    id: route.id || route.slug || route.scenario_key,
    slug: route.slug || route.scenario_key,
    scenario_key: route.scenario_key || route.slug,
    scenario: route.scenario || route.scenario_key,
    role_scope: route.role_scope || null,
    primary: route.primary,
    primary_model: route.primary_model || null,
    fallback: route.fallback || null,
    fallback_model: route.fallback_model || null,
    policy: route.policy || '',
    enabled: route.enabled !== false,
  }), []);

  const normalizeOverride = useCallback(
    (override) => ({
      id: override.id || `${override.source_type || 'override'}-${override.target || override.level}`,
      source_type: override.source_type || 'tenant',
      level: override.level || t('platform.aiPage.overrideFallbackLevel'),
      target: override.target || t('platform.aiPage.overrideFallbackTarget'),
      mode: override.mode || t('platform.aiPage.overrideFallbackMode'),
      provider: override.provider || 'openai',
      model_key: override.model_key || null,
      route_slug: override.route_slug || null,
      tenant_key: override.tenant_key || null,
      clinic_id: override.clinic_id || null,
      role: override.role || null,
      enabled: override.enabled !== false,
    }),
    [t]
  );

  const loadControlPlane = useCallback(async () => {
    setLoading(true);
    setError('');
    setSaveNote('');
    try {
      const payload = await apiRequest('/api/v1/platform/ai/control-plane');
      const providerRows = Array.isArray(payload?.providers) && payload.providers.length
        ? payload.providers.map(normalizeProvider)
        : localizedProviderPresets;
      const routeRows = Array.isArray(payload?.routing) && payload.routing.length
        ? payload.routing.map(normalizeRoute)
        : defaultRouting.map(normalizeRoute);
      const overrideRows = Array.isArray(payload?.overrides) && payload.overrides.length
        ? payload.overrides.map(normalizeOverride)
        : defaultOverrides.map(normalizeOverride);

      setProviders(providerRows);
      setRouting(routeRows);
      setOverrides(overrideRows);
      setGuardrails({ ...DEFAULT_GUARDRAILS, ...(payload?.guardrails || {}) });
      setClinics(Array.isArray(payload?.clinics) ? payload.clinics : []);
      setClinicUsage(Array.isArray(payload?.clinic_usage) ? payload.clinic_usage : []);
      setOverrideSummary(Array.isArray(payload?.override_summary) ? payload.override_summary : []);
      setPrompts(Array.isArray(payload?.prompts) ? payload.prompts : []);
      setUsageSummary(payload?.usage_summary || null);
      setRecentUsage(Array.isArray(payload?.recent_usage) ? payload.recent_usage : []);
      setRouteHealth(Array.isArray(payload?.route_health) ? payload.route_health : []);
    } catch (requestError) {
      setError(requestError.message || t('platform.aiPage.loadError'));
      setProviders(localizedProviderPresets);
      setRouting(defaultRouting.map(normalizeRoute));
      setOverrides(defaultOverrides.map(normalizeOverride));
      setGuardrails(DEFAULT_GUARDRAILS);
      setClinics([]);
      setClinicUsage([]);
      setOverrideSummary([]);
      setPrompts([]);
      setUsageSummary(null);
      setRecentUsage([]);
      setRouteHealth([]);
    } finally {
      setLoading(false);
    }
  }, [
    defaultOverrides,
    defaultRouting,
    localizedProviderPresets,
    normalizeOverride,
    normalizeProvider,
    normalizeRoute,
    t,
  ]);

  useEffect(() => {
    loadControlPlane();
  }, [loadControlPlane]);

  const activeCount = useMemo(() => providers.filter((row) => row.status === 'active').length, [providers]);
  const standbyCount = useMemo(() => providers.filter((row) => row.status === 'standby').length, [providers]);

  const obsLines = useMemo(() => {
    const g = guardrails || {};
    const fb =
      g.fallbackMode === 'strict'
        ? t('platform.aiPage.fbLabelStrict')
        : g.fallbackMode === 'graceful'
          ? t('platform.aiPage.fbLabelGraceful')
          : t('platform.aiPage.fbLabelClinicLocal');
    const pii = g.piiRedaction ? t('platform.aiPage.wordOn') : t('platform.aiPage.wordOff');
    const audit = g.promptAudit ? t('platform.aiPage.promptAuditOn') : t('platform.aiPage.promptAuditOff');
    return [
      t('platform.aiPage.obsBudget', { monthly: g.monthlyBudget, hard: g.hardLimit }),
      t('platform.aiPage.obsFlows', { owner: g.maxOwnerRequestsPerHour, vet: g.maxVetRequestsPerHour }),
      t('platform.aiPage.obsFailoverPii', { mode: fb, pii }),
      t('platform.aiPage.obsAuditOverrides', { audit, count: overrides.length }),
    ];
  }, [guardrails, overrides.length, t]);

  const localizedRecentUsage = useMemo(
    () => platformAiI18n.localizeRecentUsage(recentUsage),
    [platformAiI18n, recentUsage]
  );

  const localizedRouteHealth = useMemo(
    () => platformAiI18n.localizeRouteHealth(routeHealth),
    [platformAiI18n, routeHealth]
  );

  const localizedOverrideSummary = useMemo(
    () => platformAiI18n.localizeOverrideSummary(overrideSummary),
    [overrideSummary, platformAiI18n]
  );

  function patchProvider(id, nextPatch) {
    setProviders((current) => current.map((row) => (row.id === id ? { ...row, ...nextPatch } : row)));
  }

  function patchRouting(id, nextPatch) {
    setRouting((current) => current.map((row) => (row.id === id ? { ...row, ...nextPatch } : row)));
  }

  function patchOverride(id, nextPatch) {
    setOverrides((current) => current.map((row) => (row.id === id ? { ...row, ...nextPatch } : row)));
  }

  const providerOptions = providers.map((provider) => ({ value: provider.slug || provider.id, label: provider.name }));

  async function saveControlPlane() {
    setSaving(true);
    setError('');
    setSaveNote('');
    const g = guardrails || {};
    if (
      Number(g.monthlyBudget) < 0
      || Number(g.hardLimit) < 0
      || Number(g.maxOwnerRequestsPerHour) < 0
      || Number(g.maxVetRequestsPerHour) < 0
    ) {
      setError(t('platform.aiPage.limitsNegative'));
      setSaving(false);
      return;
    }
    try {
      const payload = await apiRequest('/api/v1/platform/ai/control-plane', {
        method: 'PUT',
        body: {
          providers: providers.map((provider) => ({
            id: provider.id,
            slug: provider.slug,
            name: provider.name,
            status: provider.status,
            provider_type: provider.provider_type,
            routing: provider.routing,
            fallback: provider.fallback,
            default_model: provider.default_model,
            models: provider.models,
            capabilities: provider.capabilities || [],
          })),
          routing: routing.map((rule) => ({
            id: rule.id,
            slug: rule.slug,
            scenario_key: rule.scenario_key,
            scenario: rule.scenario,
            role_scope: rule.role_scope,
            primary: rule.primary,
            primary_model: rule.primary_model,
            fallback: rule.fallback,
            fallback_model: rule.fallback_model,
            policy: rule.policy,
            enabled: rule.enabled,
          })),
          overrides,
          guardrails,
        },
      });
      setProviders((Array.isArray(payload?.providers) ? payload.providers : []).map(normalizeProvider));
      setRouting((Array.isArray(payload?.routing) ? payload.routing : []).map(normalizeRoute));
      setOverrides((Array.isArray(payload?.overrides) ? payload.overrides : []).map(normalizeOverride));
      setGuardrails({ ...DEFAULT_GUARDRAILS, ...(payload?.guardrails || {}) });
      setClinics(Array.isArray(payload?.clinics) ? payload.clinics : []);
      setClinicUsage(Array.isArray(payload?.clinic_usage) ? payload.clinic_usage : []);
      setOverrideSummary(Array.isArray(payload?.override_summary) ? payload.override_summary : []);
      setPrompts(Array.isArray(payload?.prompts) ? payload.prompts : []);
      setUsageSummary(payload?.usage_summary || null);
      setRecentUsage(Array.isArray(payload?.recent_usage) ? payload.recent_usage : []);
      setRouteHealth(Array.isArray(payload?.route_health) ? payload.route_health : []);
      setSaveNote(t('platform.aiPage.savedNote'));
    } catch (requestError) {
      setError(requestError.message || t('platform.aiPage.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('platform.aiPage.headerEyebrow')}
        title={t('platform.aiPage.headerTitle')}
        subtitle={t('platform.aiPage.headerSubtitle')}
        actions={(
          <>
            <button type="button" className="btn-secondary" onClick={loadControlPlane} disabled={loading || saving}>
              {t('platform.aiPage.refresh')}
            </button>
            <button type="button" className="btn-primary" onClick={saveControlPlane} disabled={loading || saving}>
              {saving ? t('platform.aiPage.saving') : t('platform.aiPage.saveSettings')}
            </button>
          </>
        )}
      />

      {error ? <ErrorBanner message={error} onRetry={loadControlPlane} /> : null}
      {saveNote ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{saveNote}</div> : null}

      <ShowcasePanel
        eyebrow={t('platform.aiPage.showcaseEyebrow')}
        title={t('platform.aiPage.showcaseTitle')}
        description={t('platform.aiPage.showcaseDescription')}
        imageSrc="/assets/img/vet-side.svg"
        imageAlt={t('platform.aiPage.showcaseImageAlt')}
        badges={[
          t('platform.aiPage.badgeProviders', { count: providers.length }),
          t('platform.aiPage.badgeActive', { count: activeCount }),
          t('platform.aiPage.badgeRoutes', { count: routing.length }),
        ]}
      />

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </section>
      ) : (
        <>

      <section className="kpi-grid">
        <StatsCard label={t('platform.aiPage.statsProviders')} value={String(providers.length)} />
        <StatsCard label={t('platform.aiPage.statsActive')} value={String(activeCount)} />
        <StatsCard label={t('platform.aiPage.statsStandby')} value={String(standbyCount)} />
        <StatsCard label={t('platform.aiPage.statsOverrides')} value={String(overrides.length)} />
        <StatsCard label={t('platform.aiPage.statsMonthlyBudget')} value={`${guardrails.monthlyBudget} USD`} />
        <StatsCard label={t('platform.aiPage.statsClinics')} value={String(clinics.length)} />
        <StatsCard label={t('platform.aiPage.statsPrompts')} value={String(prompts.length)} />
        <StatsCard label={t('platform.aiPage.statsRequests30d')} value={String(usageSummary?.requests || 0)} />
      </section>

      <section className="grid gap-5 2xl:grid-cols-[0.95fr_1.05fr]">
        <Card title={t('platform.aiPage.cardRecentTitle')} subtitle={t('platform.aiPage.cardRecentSubtitle')}>
          {localizedRecentUsage.length ? (
            <div className="space-y-3">
              {localizedRecentUsage.map((row) => (
                <div key={row.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-lapka-900">{row.scenario}</p>
                      <p className="text-sm text-lapka-600">
                        {row.clinic_name} · {row.role_scope} ·{' '}
                        {row.provider_slug || t('platform.aiPage.placeholderProvider')} /{' '}
                        {row.model_key || t('platform.aiPage.placeholderModel')}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      row.status === 'ok'
                        ? 'bg-emerald-100 text-emerald-700'
                        : row.blocked
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                    }`}>
                      {row.status_label}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-lapka-700">
                    <span className="rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1">
                      {row.latency_ms ? t('platform.aiPage.latencyMs', { ms: row.latency_ms }) : t('platform.aiPage.latencyNone')}
                    </span>
                    <span className="rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1">
                      {row.estimated_cost} USD
                    </span>
                    {row.fallback_used ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                        {t('platform.aiPage.fallbackUsedBadge')}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1">
                      {row.created_at ? new Date(row.created_at).toLocaleString(dateLocale) : t('platform.aiPage.timeUnknown')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-lapka-200 bg-lapka-50 px-4 py-5 text-sm text-lapka-600">
              {t('platform.aiPage.recentEmpty')}
            </div>
          )}
        </Card>

        <Card title={t('platform.aiPage.cardHealthTitle')} subtitle={t('platform.aiPage.cardHealthSubtitle')}>
          {localizedRouteHealth.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-lapka-200 text-left text-lapka-500">
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thScenario')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thRole')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thPrimary')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thRequests')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thAvgLatency')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thIssues')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thLastCall')}</th>
                  </tr>
                </thead>
                <tbody>
                  {localizedRouteHealth.map((row) => (
                    <tr key={row.route_slug} className="border-b border-lapka-100 last:border-b-0">
                      <td className="px-3 py-3 font-semibold text-lapka-900">{row.scenario}</td>
                      <td className="px-3 py-3 text-lapka-700">{row.role_scope || t('platform.aiPage.allRoles')}</td>
                      <td className="px-3 py-3 text-lapka-800">{row.provider_slug || t('platform.aiPage.dash')}</td>
                      <td className="px-3 py-3 text-lapka-800">{row.requests}</td>
                      <td className="px-3 py-3 text-lapka-800">
                        {row.avg_latency_ms ? t('platform.aiPage.latencyMs', { ms: row.avg_latency_ms }) : t('platform.aiPage.dash')}
                      </td>
                      <td className="px-3 py-3 text-lapka-800">{row.issue_count}</td>
                      <td className="px-3 py-3 text-lapka-700">
                        {row.last_seen ? new Date(row.last_seen).toLocaleString(dateLocale) : t('platform.aiPage.neverRun')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-lapka-200 bg-lapka-50 px-4 py-5 text-sm text-lapka-600">
              {t('platform.aiPage.healthEmpty')}
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
        <Card title={t('platform.aiPage.cardClinicLoadTitle')} subtitle={t('platform.aiPage.cardClinicLoadSubtitle')}>
          {clinicUsage.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-lapka-200 text-left text-lapka-500">
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thClinic')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thCity')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thRequests')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thCost')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thErrors')}</th>
                    <th className="px-3 py-3 font-semibold">{t('platform.aiPage.thOverridesCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicUsage.map((row) => (
                    <tr key={row.clinic_id} className="border-b border-lapka-100 last:border-b-0">
                      <td className="px-3 py-3 font-semibold text-lapka-900">{row.clinic_name}</td>
                      <td className="px-3 py-3 text-lapka-700">{row.city || t('platform.aiPage.dash')}</td>
                      <td className="px-3 py-3 text-lapka-800">{row.requests}</td>
                      <td className="px-3 py-3 text-lapka-800">{row.estimated_cost} USD</td>
                      <td className="px-3 py-3 text-lapka-800">{row.errors}</td>
                      <td className="px-3 py-3 text-lapka-800">{row.overrides}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-lapka-200 bg-lapka-50 px-4 py-5 text-sm text-lapka-600">
              {t('platform.aiPage.clinicEmpty')}
            </div>
          )}
        </Card>

        <Card title={t('platform.aiPage.cardMatrixTitle')} subtitle={t('platform.aiPage.cardMatrixSubtitle')}>
          {localizedOverrideSummary.length ? (
            <div className="space-y-3">
              {localizedOverrideSummary.map((row) => (
                <div key={row.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-lapka-900">{row.target}</p>
                      <p className="text-sm text-lapka-600">
                        {row.level} · {row.route_slug || t('platform.aiPage.routeAllScopes')} · {row.mode_label}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {row.enabled ? t('platform.aiPage.statusActive') : t('platform.aiPage.statusInactive')}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-lapka-700">
                    <span className="rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1">
                      {t('platform.aiPage.chipProvider', { slug: row.provider_slug || t('platform.aiPage.dash') })}
                    </span>
                    <span className="rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1">
                      {t('platform.aiPage.chipModel', {
                        model: row.model_key || t('platform.aiPage.chipModelDefault'),
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-lapka-200 bg-lapka-50 px-4 py-5 text-sm text-lapka-600">
              {t('platform.aiPage.matrixEmpty')}
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
        <Card title={t('platform.aiPage.loadSplitTitle')} subtitle={t('platform.aiPage.loadSplitSubtitle')}>
          <div className="grid gap-3">
            {LOAD_SPLIT_BLOCKS.map(([titleKey, textKey]) => (
              <div key={titleKey} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <p className="text-base font-bold text-lapka-900">{t(`platform.aiPage.${titleKey}`)}</p>
                <p className="mt-1 text-sm leading-7 text-lapka-700">{t(`platform.aiPage.${textKey}`)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('platform.aiPage.policyTitle')} subtitle={t('platform.aiPage.policySubtitle')}>
          <div className="grid gap-3">
            {['policyB1', 'policyB2', 'policyB3'].map((key) => (
              <div key={key} className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4 text-sm leading-7 text-lapka-700">
                {t(`platform.aiPage.${key}`)}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.14fr_0.86fr]">
        <Card title={t('platform.aiPage.routingTitle')} subtitle={t('platform.aiPage.routingSubtitle')}>
          <div className="space-y-4">
            {routing.map((rule) => (
              <div key={rule.id} className="rounded-[24px] border border-lapka-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="block">
                    <span className="label">{t('platform.aiPage.labelScenario')}</span>
                    <input className="input" value={rule.scenario} readOnly />
                  </label>
                  <label className="block">
                    <span className="label">{t('platform.aiPage.labelPrimaryProvider')}</span>
                    <select className="input" value={rule.primary} onChange={(event) => patchRouting(rule.id, { primary: event.target.value })}>
                      {providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">{t('platform.aiPage.labelFallback')}</span>
                    <select className="input" value={rule.fallback} onChange={(event) => patchRouting(rule.id, { fallback: event.target.value })}>
                      {providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">{t('platform.aiPage.labelScenarioPolicy')}</span>
                    <input className="input" value={rule.policy} onChange={(event) => patchRouting(rule.id, { policy: event.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('platform.aiPage.guardrailsTitle')} subtitle={t('platform.aiPage.guardrailsSubtitle')}>
          <div className="space-y-3">
            <label className="block">
              <span className="label">{t('platform.aiPage.labelMonthlyBudget')}</span>
              <input className="input" type="number" value={guardrails.monthlyBudget} onChange={(event) => setGuardrails((current) => ({ ...current, monthlyBudget: Number(event.target.value) || 0 }))} />
            </label>
            <label className="block">
              <span className="label">{t('platform.aiPage.labelHardLimit')}</span>
              <input className="input" type="number" value={guardrails.hardLimit} onChange={(event) => setGuardrails((current) => ({ ...current, hardLimit: Number(event.target.value) || 0 }))} />
            </label>
            <label className="block">
              <span className="label">{t('platform.aiPage.labelOwnerRph')}</span>
              <input className="input" type="number" value={guardrails.maxOwnerRequestsPerHour} onChange={(event) => setGuardrails((current) => ({ ...current, maxOwnerRequestsPerHour: Number(event.target.value) || 0 }))} />
            </label>
            <label className="block">
              <span className="label">{t('platform.aiPage.labelVetRph')}</span>
              <input className="input" type="number" value={guardrails.maxVetRequestsPerHour} onChange={(event) => setGuardrails((current) => ({ ...current, maxVetRequestsPerHour: Number(event.target.value) || 0 }))} />
            </label>
            <div className="grid gap-2">
              {[
                ['piiRedaction', 'guardPiiMask'],
                ['promptAudit', 'guardPromptAudit'],
              ].map(([key, labelKey]) => (
                <label key={key} className="flex items-center gap-3 rounded-[18px] border border-lapka-200 bg-lapka-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(guardrails[key])}
                    onChange={(event) => setGuardrails((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  <span className="text-sm font-semibold text-lapka-800">{t(`platform.aiPage.${labelKey}`)}</span>
                </label>
              ))}
            </div>
            <label className="block">
              <span className="label">{t('platform.aiPage.labelFallbackMode')}</span>
              <select className="input" value={guardrails.fallbackMode} onChange={(event) => setGuardrails((current) => ({ ...current, fallbackMode: event.target.value }))}>
                <option value="strict">{t('platform.aiPage.fbStrict')}</option>
                <option value="graceful">{t('platform.aiPage.fbGraceful')}</option>
                <option value="clinic-local">{t('platform.aiPage.fbClinicLocal')}</option>
              </select>
            </label>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.1fr_0.9fr]">
        <Card title={t('platform.aiPage.overridesManageTitle')} subtitle={t('platform.aiPage.overridesManageSubtitle')}>
          <div className="space-y-4">
            {overrides.map((override) => (
              <div key={override.id} className="rounded-[24px] border border-lapka-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="block">
                    <span className="label">{t('platform.aiPage.labelLevel')}</span>
                    <input className="input" value={override.level} onChange={(event) => patchOverride(override.id, { level: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="label">{t('platform.aiPage.labelTarget')}</span>
                    <input className="input" value={override.target} onChange={(event) => patchOverride(override.id, { target: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="label">{t('platform.aiPage.labelMode')}</span>
                    <input className="input" value={override.mode} onChange={(event) => patchOverride(override.id, { mode: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="label">{t('platform.aiPage.labelProvider')}</span>
                    <select className="input" value={override.provider} onChange={(event) => patchOverride(override.id, { provider: event.target.value })}>
                      {providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('platform.aiPage.obsTitle')} subtitle={t('platform.aiPage.obsSubtitle')}>
          <div className="grid gap-3">
            {obsLines.map((item, idx) => (
              <div key={idx} className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4 text-sm leading-7 text-lapka-700">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-2">
        {providers.map((provider) => (
          <Card
            key={provider.id}
            title={provider.name}
            subtitle={t('platform.aiPage.providerScenarios', { routing: provider.routing })}
          >
            <div className="space-y-3">
              <label className="block">
                <span className="label">{t('platform.aiPage.labelStatus')}</span>
                <select className="input" value={provider.status} onChange={(event) => patchProvider(provider.id, { status: event.target.value })}>
                  <option value="active">{t('platform.aiPage.providerStatusActive')}</option>
                  <option value="standby">{t('platform.aiPage.providerStatusStandby')}</option>
                  <option value="pilot">{t('platform.aiPage.providerStatusPilot')}</option>
                  <option value="disabled">{t('platform.aiPage.providerStatusDisabled')}</option>
                </select>
              </label>
              <label className="block">
                <span className="label">{t('platform.aiPage.labelDefaultModel')}</span>
                <select className="input" value={provider.models[0]} onChange={(event) => patchProvider(provider.id, { models: [event.target.value, ...provider.models.filter((row) => row !== event.target.value)] })}>
                  {provider.models.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">{t('platform.aiPage.labelFallbackModel')}</span>
                <select className="input" value={provider.fallback} onChange={(event) => patchProvider(provider.id, { fallback: event.target.value })}>
                  {provider.models.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
              </label>
            </div>
          </Card>
        ))}
      </section>
        </>
      )}
    </div>
  );
}
