'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { AI_PROVIDER_PRESETS } from '@/lib/platform-workspace';

const DEFAULT_ROUTING = [
  { id: 'owner-triage', slug: 'owner-triage', scenario_key: 'owner-triage', scenario: 'Срочность владельца', primary: 'openai', fallback: 'anthropic', policy: 'Безопасный режим владельца', enabled: true },
  { id: 'doc-explain', slug: 'doc-explain', scenario_key: 'doc-explain', scenario: 'Объяснение документов', primary: 'openai', fallback: 'gemini', policy: 'Без рекомендаций по лечению', enabled: true },
  { id: 'vet-notes', slug: 'vet-notes', scenario_key: 'vet-notes', scenario: 'Структурирование заметок врача', primary: 'anthropic', fallback: 'openai', policy: 'Только для внутреннего контура врача', enabled: true },
  { id: 'knowledge-search', slug: 'knowledge-search', scenario_key: 'knowledge-search', scenario: 'Поиск по знаниям и справочникам', primary: 'gemini', fallback: 'openai', policy: 'Только на основе проверенной базы знаний', enabled: true },
];

const DEFAULT_OVERRIDES = [
  { id: 'clinic-demo', source_type: 'clinic', level: 'Клиника', target: 'ВетСеть', mode: 'Стандартный контур', provider: 'openai', enabled: true },
  { id: 'branch-sensitive', source_type: 'tenant', level: 'Платформа', target: 'Стационар / приватные кейсы', mode: 'Локальный резервный контур', provider: 'local', tenant_key: 'private-cases', enabled: true },
  { id: 'role-vet', source_type: 'role', level: 'Роль', target: 'Ветеринарный врач', mode: 'Ассистент врача', provider: 'anthropic', role: 'vet', enabled: true },
];

const DEFAULT_GUARDRAILS = {
  monthlyBudget: 4800,
  hardLimit: 6200,
  maxOwnerRequestsPerHour: 1600,
  maxVetRequestsPerHour: 900,
  piiRedaction: true,
  promptAudit: true,
  fallbackMode: 'strict',
};

export default function PlatformAiPage() {
  const [providers, setProviders] = useState([]);
  const [routing, setRouting] = useState(DEFAULT_ROUTING);
  const [overrides, setOverrides] = useState(DEFAULT_OVERRIDES);
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

  const normalizeOverride = useCallback((override) => ({
    id: override.id || `${override.source_type || 'override'}-${override.target || override.level}`,
    source_type: override.source_type || 'tenant',
    level: override.level || 'Платформа',
    target: override.target || 'Переопределение',
    mode: override.mode || 'Стандартный контур',
    provider: override.provider || 'openai',
    model_key: override.model_key || null,
    route_slug: override.route_slug || null,
    tenant_key: override.tenant_key || null,
    clinic_id: override.clinic_id || null,
    role: override.role || null,
    enabled: override.enabled !== false,
  }), []);

  const loadControlPlane = useCallback(async () => {
    setLoading(true);
    setError('');
    setSaveNote('');
    try {
      const payload = await apiRequest('/api/v1/platform/ai/control-plane');
      const providerRows = Array.isArray(payload?.providers) && payload.providers.length
        ? payload.providers.map(normalizeProvider)
        : AI_PROVIDER_PRESETS.map(normalizeProvider);
      const routeRows = Array.isArray(payload?.routing) && payload.routing.length
        ? payload.routing.map(normalizeRoute)
        : DEFAULT_ROUTING.map(normalizeRoute);
      const overrideRows = Array.isArray(payload?.overrides) && payload.overrides.length
        ? payload.overrides.map(normalizeOverride)
        : DEFAULT_OVERRIDES.map(normalizeOverride);

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
      setError(requestError.message || 'Не удалось загрузить центр AI');
      setProviders(AI_PROVIDER_PRESETS.map(normalizeProvider));
      setRouting(DEFAULT_ROUTING.map(normalizeRoute));
      setOverrides(DEFAULT_OVERRIDES.map(normalizeOverride));
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
  }, [normalizeOverride, normalizeProvider, normalizeRoute]);

  useEffect(() => {
    loadControlPlane();
  }, [loadControlPlane]);

  const activeCount = useMemo(() => providers.filter((row) => row.status === 'active').length, [providers]);
  const standbyCount = useMemo(() => providers.filter((row) => row.status === 'standby').length, [providers]);

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
      setSaveNote('Настройки сохранены в платформенном контуре.');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось сохранить настройки центра AI');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">AI-платформа</p>
          <h1 className="page-title">Центр AI</h1>
          <p className="page-subtitle">Провайдеры, модели по умолчанию, резервные цепочки, сценарии по ролям и правила использования AI на уровне платформы.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={loadControlPlane} disabled={loading || saving}>Обновить</button>
          <button type="button" className="btn-primary" onClick={saveControlPlane} disabled={loading || saving}>
            {saving ? 'Сохраняем…' : 'Сохранить настройки'}
          </button>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadControlPlane} /> : null}
      {saveNote ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{saveNote}</div> : null}

      <ShowcasePanel
        eyebrow="Управление AI"
        title="Провайдеры, сценарии и резервирование моделей"
        description="Платформа управляет несколькими AI-провайдерами: кто отвечает за срочность владельца, кто помогает врачу со структурой заметок и кто включается как резерв при высокой нагрузке."
        imageSrc="/assets/img/vet-side.svg"
        imageAlt="Центр AI"
        badges={[
          `${providers.length} провайдера`,
          `${activeCount} активных`,
          `${routing.length} маршрутов`,
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
        <StatsCard label="Провайдеры" value={String(providers.length)} />
        <StatsCard label="Активные" value={String(activeCount)} />
        <StatsCard label="Резерв" value={String(standbyCount)} />
        <StatsCard label="Переопределения" value={String(overrides.length)} />
        <StatsCard label="Месячный бюджет" value={`${guardrails.monthlyBudget} USD`} />
        <StatsCard label="Клиники в контуре" value={String(clinics.length)} />
        <StatsCard label="Промптов" value={String(prompts.length)} />
        <StatsCard label="Запросов за 30 дней" value={String(usageSummary?.requests || 0)} />
      </section>

      <section className="grid gap-5 2xl:grid-cols-[0.95fr_1.05fr]">
        <Card title="Последние AI-запросы" subtitle="Живой feed по маршрутам, блокировкам, fallback и времени ответа">
          {recentUsage.length ? (
            <div className="space-y-3">
              {recentUsage.map((row) => (
                <div key={row.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-lapka-900">{row.scenario}</p>
                      <p className="text-sm text-lapka-600">
                        {row.clinic_name} · {row.role_scope} · {row.provider_slug || 'provider'} / {row.model_key || 'model'}
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
                      {row.latency_ms ? `${row.latency_ms} мс` : 'без измерения'}
                    </span>
                    <span className="rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1">
                      {row.estimated_cost} USD
                    </span>
                    {row.fallback_used ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">Сработал резерв</span>
                    ) : null}
                    <span className="rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1">
                      {row.created_at ? new Date(row.created_at).toLocaleString('ru-RU') : 'время неизвестно'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-lapka-200 bg-lapka-50 px-4 py-5 text-sm text-lapka-600">
              Лента AI-запросов заполнится после первых обращений из triage, документов, протоколов и лабораторных сценариев.
            </div>
          )}
        </Card>

        <Card title="Здоровье сценариев" subtitle="Нагрузка, средняя задержка и проблемные маршруты за 14 дней">
          {routeHealth.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-lapka-200 text-left text-lapka-500">
                    <th className="px-3 py-3 font-semibold">Сценарий</th>
                    <th className="px-3 py-3 font-semibold">Роль</th>
                    <th className="px-3 py-3 font-semibold">Основной</th>
                    <th className="px-3 py-3 font-semibold">Запросы</th>
                    <th className="px-3 py-3 font-semibold">Ср. задержка</th>
                    <th className="px-3 py-3 font-semibold">Сбои</th>
                    <th className="px-3 py-3 font-semibold">Последний вызов</th>
                  </tr>
                </thead>
                <tbody>
                  {routeHealth.map((row) => (
                    <tr key={row.route_slug} className="border-b border-lapka-100 last:border-b-0">
                      <td className="px-3 py-3 font-semibold text-lapka-900">{row.scenario}</td>
                      <td className="px-3 py-3 text-lapka-700">{row.role_scope || 'Все роли'}</td>
                      <td className="px-3 py-3 text-lapka-800">{row.provider_slug || '—'}</td>
                      <td className="px-3 py-3 text-lapka-800">{row.requests}</td>
                      <td className="px-3 py-3 text-lapka-800">{row.avg_latency_ms ? `${row.avg_latency_ms} мс` : '—'}</td>
                      <td className="px-3 py-3 text-lapka-800">{row.issue_count}</td>
                      <td className="px-3 py-3 text-lapka-700">
                        {row.last_seen ? new Date(row.last_seen).toLocaleString('ru-RU') : 'ещё не запускался'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-lapka-200 bg-lapka-50 px-4 py-5 text-sm text-lapka-600">
              Срез по сценариям появится после первых живых вызовов и покажет, где есть задержки, ошибки и перегрузка.
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
        <Card title="Нагрузка по клиникам" subtitle="Запросы, стоимость, ошибки и локальные переопределения за 30 дней">
          {clinicUsage.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-lapka-200 text-left text-lapka-500">
                    <th className="px-3 py-3 font-semibold">Клиника</th>
                    <th className="px-3 py-3 font-semibold">Город</th>
                    <th className="px-3 py-3 font-semibold">Запросы</th>
                    <th className="px-3 py-3 font-semibold">Стоимость</th>
                    <th className="px-3 py-3 font-semibold">Ошибки</th>
                    <th className="px-3 py-3 font-semibold">Overrides</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicUsage.map((row) => (
                    <tr key={row.clinic_id} className="border-b border-lapka-100 last:border-b-0">
                      <td className="px-3 py-3 font-semibold text-lapka-900">{row.clinic_name}</td>
                      <td className="px-3 py-3 text-lapka-700">{row.city || '—'}</td>
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
              По клиникам ещё нет накопленной нагрузки. Данные появятся после первых AI-запросов в маршрутах владельца и врача.
            </div>
          )}
        </Card>

        <Card title="Матрица переопределений" subtitle="Что именно переопределяется на уровне платформы, клиники и роли">
          {overrideSummary.length ? (
            <div className="space-y-3">
              {overrideSummary.map((row) => (
                <div key={row.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-lapka-900">{row.target}</p>
                      <p className="text-sm text-lapka-600">{row.level} · {row.route_slug || 'весь контур'} · {row.mode_label}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {row.enabled ? 'Активно' : 'Отключено'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-lapka-700">
                    <span className="rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1">Провайдер: {row.provider_slug || '—'}</span>
                    <span className="rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1">Модель: {row.model_key || 'по умолчанию'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-lapka-200 bg-lapka-50 px-4 py-5 text-sm text-lapka-600">
              Переопределения ещё не заданы. Здесь появятся правила для ролей, клиник и частных сценариев.
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
        <Card title="Как распределяется нагрузка" subtitle="Сценарии и правила переключения между моделями">
          <div className="grid gap-3">
            {[
              ['Срочность владельца', 'Только безопасные сценарии, без лечения и дозировок.'],
              ['Контур врача', 'Структура протокола, заметки визита, контроль полноты.'],
              ['Документы и знания', 'Объяснение лабораторных и визуализация контекста без назначения терапии.'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <p className="text-base font-bold text-lapka-900">{title}</p>
                <p className="mt-1 text-sm leading-7 text-lapka-700">{text}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Политика платформы" subtitle="Что централизованно контролирует администратор платформы">
          <div className="grid gap-3">
            {[
              'Разграничение ролей и доступ к сценариям AI по клинике и филиалу.',
              'Резервные модели на случай деградации основного провайдера.',
              'Общий словарь политик безопасности, лимитов и шаблонов промптов.',
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4 text-sm leading-7 text-lapka-700">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.14fr_0.86fr]">
        <Card title="Маршрутизация сценариев" subtitle="Какой провайдер отвечает за каждый AI-сценарий по умолчанию">
          <div className="space-y-4">
            {routing.map((rule) => (
              <div key={rule.id} className="rounded-[24px] border border-lapka-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="block">
                    <span className="label">Сценарий</span>
                    <input className="input" value={rule.scenario} readOnly />
                  </label>
                  <label className="block">
                    <span className="label">Основной провайдер</span>
                    <select className="input" value={rule.primary} onChange={(event) => patchRouting(rule.id, { primary: event.target.value })}>
                      {providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Резерв</span>
                    <select className="input" value={rule.fallback} onChange={(event) => patchRouting(rule.id, { fallback: event.target.value })}>
                      {providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Политика сценария</span>
                    <input className="input" value={rule.policy} onChange={(event) => patchRouting(rule.id, { policy: event.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Лимиты и защитные правила" subtitle="Платформенные ограничения для AI-сценариев">
          <div className="space-y-3">
            <label className="block">
              <span className="label">Месячный бюджет</span>
              <input className="input" type="number" value={guardrails.monthlyBudget} onChange={(event) => setGuardrails((current) => ({ ...current, monthlyBudget: Number(event.target.value) || 0 }))} />
            </label>
            <label className="block">
              <span className="label">Жёсткий лимит</span>
              <input className="input" type="number" value={guardrails.hardLimit} onChange={(event) => setGuardrails((current) => ({ ...current, hardLimit: Number(event.target.value) || 0 }))} />
            </label>
            <label className="block">
              <span className="label">Запросов владельца в час</span>
              <input className="input" type="number" value={guardrails.maxOwnerRequestsPerHour} onChange={(event) => setGuardrails((current) => ({ ...current, maxOwnerRequestsPerHour: Number(event.target.value) || 0 }))} />
            </label>
            <label className="block">
              <span className="label">Запросов врача в час</span>
              <input className="input" type="number" value={guardrails.maxVetRequestsPerHour} onChange={(event) => setGuardrails((current) => ({ ...current, maxVetRequestsPerHour: Number(event.target.value) || 0 }))} />
            </label>
            <div className="grid gap-2">
              {[
                ['piiRedaction', 'Маскирование персональных и чувствительных данных'],
                ['promptAudit', 'Аудит промптов и ответов'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-[18px] border border-lapka-200 bg-lapka-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(guardrails[key])}
                    onChange={(event) => setGuardrails((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  <span className="text-sm font-semibold text-lapka-800">{label}</span>
                </label>
              ))}
            </div>
            <label className="block">
              <span className="label">Режим резервирования</span>
              <select className="input" value={guardrails.fallbackMode} onChange={(event) => setGuardrails((current) => ({ ...current, fallbackMode: event.target.value }))}>
                <option value="strict">Строгое резервирование</option>
                <option value="graceful">Плавное снижение режима</option>
                <option value="clinic-local">Сначала локальный контур клиники</option>
              </select>
            </label>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.1fr_0.9fr]">
        <Card title="Переопределения" subtitle="Отдельные правила для клиник, филиалов и ролей">
          <div className="space-y-4">
            {overrides.map((override) => (
              <div key={override.id} className="rounded-[24px] border border-lapka-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="block">
                    <span className="label">Уровень</span>
                    <input className="input" value={override.level} onChange={(event) => patchOverride(override.id, { level: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="label">Цель</span>
                    <input className="input" value={override.target} onChange={(event) => patchOverride(override.id, { target: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="label">Режим</span>
                    <input className="input" value={override.mode} onChange={(event) => patchOverride(override.id, { mode: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="label">Провайдер</span>
                    <select className="input" value={override.provider} onChange={(event) => patchOverride(override.id, { provider: event.target.value })}>
                      {providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Наблюдаемость AI" subtitle="Что администратор платформы держит под контролем">
          <div className="grid gap-3">
            {[
              `Бюджет ${guardrails.monthlyBudget} USD / жёсткий лимит ${guardrails.hardLimit} USD.`,
              `Поток владельцев: до ${guardrails.maxOwnerRequestsPerHour} запросов в час. Поток врачей: до ${guardrails.maxVetRequestsPerHour}.`,
              `Режим резервирования: ${guardrails.fallbackMode === 'strict' ? 'строгое резервирование' : guardrails.fallbackMode === 'graceful' ? 'плавное снижение режима' : 'сначала локальный контур клиники'}. Редактирование PII: ${guardrails.piiRedaction ? 'включено' : 'выключено'}.`,
              `Аудит промптов: ${guardrails.promptAudit ? 'включён' : 'выключен'}. Переопределений: ${overrides.length}.`,
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4 text-sm leading-7 text-lapka-700">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 2xl:grid-cols-2">
        {providers.map((provider) => (
          <Card key={provider.id} title={provider.name} subtitle={`Сценарии: ${provider.routing}`}>
            <div className="space-y-3">
              <label className="block">
                <span className="label">Статус</span>
                <select className="input" value={provider.status} onChange={(event) => patchProvider(provider.id, { status: event.target.value })}>
                  <option value="active">Активен</option>
                  <option value="standby">Резерв</option>
                  <option value="pilot">Пилот</option>
                  <option value="disabled">Отключён</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Модель по умолчанию</span>
                <select className="input" value={provider.models[0]} onChange={(event) => patchProvider(provider.id, { models: [event.target.value, ...provider.models.filter((row) => row !== event.target.value)] })}>
                  {provider.models.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">Резервная модель</span>
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
