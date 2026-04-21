'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import StatsCard from '@/components/ui/StatsCard';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/api';
import { getApiBase, getStoredSession } from '@/lib/auth';

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

function suggestFunnelAction(source, submitRate) {
  const value = String(source || 'unknown').toLowerCase();
  const rate = Number(submitRate || 0);
  if (value.includes('map')) {
    return {
      area: 'Owner map',
      owner: 'Growth + Owner UX',
      priority: rate < 20 ? 'P0' : 'P1',
      action: 'Strengthen map-to-booking CTA: sticky booking button in clinic drawer and fewer secondary links.',
    };
  }
  if (value.includes('clinic')) {
    return {
      area: 'Clinic profile',
      owner: 'Clinic product',
      priority: rate < 20 ? 'P0' : 'P1',
      action: 'Reduce friction on clinic profile: keep only one primary booking path and preload clinic/vet in wizard.',
    };
  }
  if (value.includes('triage') || value.includes('sos')) {
    return {
      area: 'Triage flow',
      owner: 'Owner care UX',
      priority: rate < 20 ? 'P0' : 'P1',
      action: 'After urgency result, promote immediate clinic booking block above secondary actions.',
    };
  }
  if (value.includes('dashboard') || value.includes('services')) {
    return {
      area: 'Owner dashboard',
      owner: 'Owner product',
      priority: 'P1',
      action: 'Reorder service cards by conversion and keep map/booking cards in first viewport.',
    };
  }
  return {
    area: 'Generic source',
    owner: 'Platform analytics',
    priority: 'P2',
    action: 'Review click path and add targeted CTA for this source.',
  };
}

function targetSubmitRateForSource(source) {
  const value = String(source || 'unknown').toLowerCase();
  if (value.includes('map')) return 45;
  if (value.includes('clinic')) return 50;
  if (value.includes('triage') || value.includes('sos')) return 42;
  if (value.includes('dashboard') || value.includes('services')) return 48;
  return 40;
}

function deltaBadgeClass(delta, isBadWhenPositive = true) {
  const value = Number(delta || 0);
  if (value === 0) return 'text-lapka-600';
  const isBad = isBadWhenPositive ? value > 0 : value < 0;
  return isBad ? 'text-rose-700' : 'text-emerald-700';
}

const PERIOD_DAY_OPTIONS = [7, 14, 30, 60, 90];

function InlineNotice({ notice, onClose, dismissAriaLabel }) {
  if (!notice?.message) return null;
  const isError = notice.type === 'error';
  return (
    <div className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${
      isError
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    }`} role="status" aria-live={isError ? 'assertive' : 'polite'}>
      <span>{notice.message}</span>
      <button
        type="button"
        className="font-semibold leading-none opacity-80 transition hover:opacity-100"
        aria-label={dismissAriaLabel}
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

export default function PlatformDashboardPage() {
  const { t, i18n } = useTranslation('common');
  const statusLabel = useCallback((status) => {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'planned') return t('platform.dashboardSla.statusPlanned');
    if (value === 'in_progress') return t('platform.dashboardSla.statusInProgress');
    if (value === 'done') return t('platform.dashboardSla.statusDone');
    return value || t('platform.dashboardSla.statusUnknown');
  }, [t]);
  const auditKindLabel = useCallback((kind) => {
    const value = String(kind || '').trim().toLowerCase();
    if (value === 'detail') return t('platform.dashboardSla.filterKindDetail');
    if (value === 'management') return t('platform.dashboardSla.filterKindManagement');
    if (value === 'all') return t('platform.dashboardSla.filterKindAll');
    return value || t('platform.dashboardSla.filterKindAll');
  }, [t]);
  const sessionUser = getStoredSession().user || null;
  const [clinics, setClinics] = useState([]);
  const [branches, setBranches] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ownerFunnel, setOwnerFunnel] = useState(null);
  const [playbookStatusBySource, setPlaybookStatusBySource] = useState({});
  const [savingStatusSource, setSavingStatusSource] = useState('');
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [showSystemOnly, setShowSystemOnly] = useState(false);
  const [playbookDigest, setPlaybookDigest] = useState(null);
  const [playbookExportAudit, setPlaybookExportAudit] = useState([]);
  const [playbookExportRisk, setPlaybookExportRisk] = useState(null);
  const [systemTasksSummary, setSystemTasksSummary] = useState(null);
  const [systemTaskReasonAnalytics, setSystemTaskReasonAnalytics] = useState(null);
  const [systemTaskSlaRisk, setSystemTaskSlaRisk] = useState(null);
  const [systemTaskSlaRecommendations, setSystemTaskSlaRecommendations] = useState([]);
  const [systemTaskSlaLifecycle, setSystemTaskSlaLifecycle] = useState(null);
  const [applyingSlaSource, setApplyingSlaSource] = useState('');
  const [feedbackSlaSource, setFeedbackSlaSource] = useState('');
  const [showDismissedSla, setShowDismissedSla] = useState(false);
  const [systemTaskHistory, setSystemTaskHistory] = useState([]);
  const [selectedSystemTaskSource, setSelectedSystemTaskSource] = useState('');
  const [loadingSystemTaskHistory, setLoadingSystemTaskHistory] = useState(false);
  const [systemQuickActionsOnly, setSystemQuickActionsOnly] = useState(false);
  const [escalatingExportRisk, setEscalatingExportRisk] = useState(false);
  const [exportRiskEscalationState, setExportRiskEscalationState] = useState('');
  const [escalatingLatencyRisk, setEscalatingLatencyRisk] = useState(false);
  const [latencyRiskEscalationState, setLatencyRiskEscalationState] = useState('');
  const [auditPeriodDays, setAuditPeriodDays] = useState('30');
  const [auditKind, setAuditKind] = useState('all');
  const [auditUserFilter, setAuditUserFilter] = useState('');
  const [auditOverdueFilter, setAuditOverdueFilter] = useState('all');
  const [exportingAuditCsv, setExportingAuditCsv] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('in_progress');
  const [bulkDueDays, setBulkDueDays] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('none');
  const [playbookHistoryBySource, setPlaybookHistoryBySource] = useState({});
  const [expandedHistorySource, setExpandedHistorySource] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingManagementCsv, setExportingManagementCsv] = useState(false);
  const [exportingBoardPack, setExportingBoardPack] = useState(false);
  const [exportingPack, setExportingPack] = useState(false);
  const [exportActionNotice, setExportActionNotice] = useState({ type: '', message: '' });
  const [playbookActionNotice, setPlaybookActionNotice] = useState({ type: '', message: '' });
  const [exportIncludeHistory, setExportIncludeHistory] = useState(true);
  const [exportPeriodDays, setExportPeriodDays] = useState('14');
  const [exportHistoryLimit, setExportHistoryLimit] = useState('12');

  async function downloadCsvFromApi(path, params, accessToken, filename) {
    const response = await fetch(`${getApiBase()}${path}?${params.toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Failed to export ${filename}`);
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [clinicsPayload, branchesPayload, reviewsPayload] = await Promise.all([
          apiRequest('/api/v1/clinics/platform-registry'),
          apiRequest('/api/v1/clinics/platform-branches'),
          apiRequest('/api/v1/reviews?limit=30'),
        ]);
        const funnelPayload = await apiRequest('/api/v1/analytics/owner-funnel/platform-summary?period_days=14');
        const playbookStatusPayload = await apiRequest('/api/v1/analytics/owner-funnel/playbook-status?limit=300');
        const playbookDigestPayload = await apiRequest('/api/v1/analytics/owner-funnel/playbook-digest?period_days=14');
        const exportRiskPayload = await apiRequest('/api/v1/analytics/owner-funnel/playbook-export-risk?period_days=14');
        const systemTasksPayload = await apiRequest('/api/v1/analytics/owner-funnel/system-tasks-summary?period_days=30');
        const systemTaskReasonPayload = await apiRequest('/api/v1/analytics/owner-funnel/system-tasks-reason-analytics?period_days=30');
        const systemTaskSlaRiskPayload = await apiRequest('/api/v1/analytics/owner-funnel/system-tasks-sla-risk?period_days=30');
        const systemTaskSlaRecommendationsPayload = await apiRequest('/api/v1/analytics/owner-funnel/system-tasks-sla-recommendations?period_days=30&limit=6');
        if (cancelled) return;
        setClinics(Array.isArray(clinicsPayload) ? clinicsPayload : []);
        setBranches(Array.isArray(branchesPayload) ? branchesPayload : []);
        setReviews(Array.isArray(reviewsPayload) ? reviewsPayload : []);
        setOwnerFunnel(funnelPayload || null);
        setPlaybookDigest(playbookDigestPayload || null);
        setPlaybookExportRisk(exportRiskPayload || null);
        setSystemTasksSummary(systemTasksPayload || null);
        setSystemTaskReasonAnalytics(systemTaskReasonPayload || null);
        setSystemTaskSlaRisk(systemTaskSlaRiskPayload || null);
        setSystemTaskSlaRecommendations(Array.isArray(systemTaskSlaRecommendationsPayload?.recommendations) ? systemTaskSlaRecommendationsPayload.recommendations : []);
        const statusMap = {};
        (Array.isArray(playbookStatusPayload) ? playbookStatusPayload : []).forEach((row) => {
          const source = String(row?.source || '').trim();
          const status = String(row?.status || '').trim();
          if (source && status) {
            statusMap[source] = {
              status,
              due_in_days: Number.isFinite(Number(row?.due_in_days)) ? Number(row.due_in_days) : null,
              is_overdue: Boolean(row?.is_overdue),
              assignee_user_id: row?.assignee_user_id || null,
              assignee_label: row?.assignee_label || null,
            };
          }
        });
        setPlaybookStatusBySource(statusMap);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || t('platform.dashboardSla.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    async function loadAudit() {
      try {
        const params = new URLSearchParams();
        params.set('period_days', String(auditPeriodDays || '30'));
        params.set('limit', '50');
        if (auditKind !== 'all') params.set('kind', auditKind);
        if (auditUserFilter.trim()) params.set('exported_by_user_id', auditUserFilter.trim());
        if (auditOverdueFilter === 'yes') params.set('only_overdue', 'true');
        if (auditOverdueFilter === 'no') params.set('only_overdue', 'false');
        const payload = await apiRequest(`/api/v1/analytics/owner-funnel/playbook-export-audit?${params.toString()}`);
        if (!cancelled) setPlaybookExportAudit(Array.isArray(payload) ? payload : []);
      } catch {
        if (!cancelled) setPlaybookExportAudit([]);
      }
    }
    loadAudit();
    return () => {
      cancelled = true;
    };
  }, [auditKind, auditOverdueFilter, auditPeriodDays, auditUserFilter]);

  useEffect(() => {
    if (!systemTaskSources.length) {
      setSelectedSystemTaskSource('');
      setSystemTaskHistory([]);
      return;
    }
    if (!selectedSystemTaskSource || !systemTaskSources.includes(selectedSystemTaskSource)) {
      setSelectedSystemTaskSource(systemTaskSources[0]);
    }
  }, [selectedSystemTaskSource, systemTaskSources]);

  useEffect(() => {
    if (!selectedSystemTaskSource) {
      setSystemTaskHistory([]);
      return;
    }
    async function loadSystemTaskHistory() {
      await reloadSystemTaskHistory(selectedSystemTaskSource);
    }
    loadSystemTaskHistory();
  }, [reloadSystemTaskHistory, selectedSystemTaskSource]);

  useEffect(() => {
    if (!selectedSystemTaskSource) return;
    reloadSystemTaskHistory(selectedSystemTaskSource, systemQuickActionsOnly);
  }, [reloadSystemTaskHistory, selectedSystemTaskSource, systemQuickActionsOnly]);

  useEffect(() => {
    if (!exportActionNotice.message) return;
    const timerId = window.setTimeout(() => {
      setExportActionNotice({ type: '', message: '' });
    }, 5000);
    return () => window.clearTimeout(timerId);
  }, [exportActionNotice.message]);

  useEffect(() => {
    if (!playbookActionNotice.message) return;
    const timerId = window.setTimeout(() => {
      setPlaybookActionNotice({ type: '', message: '' });
    }, 5000);
    return () => window.clearTimeout(timerId);
  }, [playbookActionNotice.message]);

  async function exportPlaybookAuditCsv() {
    const { accessToken } = getStoredSession();
    if (!accessToken) return;
    setExportActionNotice({ type: '', message: '' });
    setExportingAuditCsv(true);
    try {
      const params = new URLSearchParams();
      params.set('period_days', String(auditPeriodDays || '30'));
      params.set('limit', '500');
      if (auditKind !== 'all') params.set('kind', auditKind);
      if (auditUserFilter.trim()) params.set('exported_by_user_id', auditUserFilter.trim());
      if (auditOverdueFilter === 'yes') params.set('only_overdue', 'true');
      if (auditOverdueFilter === 'no') params.set('only_overdue', 'false');
      await downloadCsvFromApi(
        '/api/v1/analytics/owner-funnel/playbook-export-audit.csv',
        params,
        accessToken,
        `owner-funnel-export-audit-${auditPeriodDays}d-${new Date().toISOString().slice(0, 10)}.csv`
      );
      setExportActionNotice({
        type: 'success',
        message: t('platform.dashboardSla.exportAuditSuccessNotice'),
      });
    } catch {
      setExportActionNotice({
        type: 'error',
        message: t('platform.dashboardSla.exportAuditErrorNotice'),
      });
    } finally {
      setExportingAuditCsv(false);
    }
  }

  async function escalateExportRiskTask() {
    setEscalatingExportRisk(true);
    setExportRiskEscalationState('');
    try {
      const result = await apiRequest('/api/v1/analytics/owner-funnel/playbook-export-risk/escalate?period_days=14', {
        method: 'POST',
      });
      if (result?.created) {
        setExportRiskEscalationState(t('platform.dashboardSla.exportEscalationCreated'));
      } else if (result?.reason === 'cooldown_24h') {
        setExportRiskEscalationState(t('platform.dashboardSla.exportEscalationCooldown'));
      } else if (result?.reason === 'risk_not_high') {
        setExportRiskEscalationState(t('platform.dashboardSla.exportEscalationSkipped'));
      } else {
        setExportRiskEscalationState(t('platform.dashboardSla.exportEscalationCompleted'));
      }
      await reloadSystemTaskInsights();
      if (selectedSystemTaskSource) await reloadSystemTaskHistory(selectedSystemTaskSource, systemQuickActionsOnly);
    } catch {
      setExportRiskEscalationState(t('platform.dashboardSla.exportEscalationFailed'));
    } finally {
      setEscalatingExportRisk(false);
    }
  }

  async function escalateLatencyRiskTask() {
    setEscalatingLatencyRisk(true);
    setLatencyRiskEscalationState('');
    try {
      const result = await apiRequest('/api/v1/analytics/owner-funnel/system-tasks-sla-latency-risk/escalate?period_days=30', {
        method: 'POST',
      });
      if (result?.created) {
        setLatencyRiskEscalationState(t('platform.dashboardSla.latencyEscalationCreated'));
      } else if (result?.reason === 'cooldown_24h') {
        setLatencyRiskEscalationState(t('platform.dashboardSla.latencyEscalationCooldown'));
      } else if (result?.reason === 'risk_not_high') {
        setLatencyRiskEscalationState(t('platform.dashboardSla.latencyEscalationSkipped'));
      } else {
        setLatencyRiskEscalationState(t('platform.dashboardSla.latencyEscalationCompleted'));
      }
      await reloadSystemTaskInsights();
      if (selectedSystemTaskSource) await reloadSystemTaskHistory(selectedSystemTaskSource, systemQuickActionsOnly);
    } catch {
      setLatencyRiskEscalationState(t('platform.dashboardSla.latencyEscalationFailed'));
    } finally {
      setEscalatingLatencyRisk(false);
    }
  }

  const metrics = useMemo(() => {
    const emergencyClinics = clinics.filter((clinic) => clinic.emergency_available).length;
    const totalBranches = branches.length;
    const blockedFlow = branches.reduce((sum, branch) => sum + Number(branch.stats?.blocked_flow || 0), 0);
    const activeFlow = branches.reduce((sum, branch) => sum + Number(branch.stats?.active_flow || 0), 0);
    const telemedicine = branches.reduce((sum, branch) => sum + Number(branch.stats?.telemedicine_14d || 0), 0);
    const appointments14d = branches.reduce((sum, branch) => sum + Number(branch.stats?.appointments_14d || 0), 0);
    const patients = clinics.reduce((sum, clinic) => sum + Number(clinic.stats?.patients || 0), 0);
    const aiOverrides = clinics.reduce((sum, clinic) => sum + Number(clinic.stats?.ai_overrides || 0), 0);
    const readinessBase = clinics.length
      ? clinics.reduce((sum, clinic) => {
        const branchCount = Math.max(1, Number(clinic.stats?.locations || 1));
        const serviceCoverage = Math.min(1, Number(clinic.stats?.services || 0) / 12);
        const teamCoverage = Math.min(1, Number(clinic.stats?.vets || 0) / (branchCount * 3));
        const aiCoverage = Math.min(1, Number(clinic.stats?.ai_overrides || 0) / Math.max(branchCount, 1));
        return sum + ((serviceCoverage * 0.35) + (teamCoverage * 0.4) + (aiCoverage * 0.25)) * 100;
      }, 0) / clinics.length
      : 0;
    return {
      emergencyClinics,
      totalBranches,
      blockedFlow,
      activeFlow,
      telemedicine,
      appointments14d,
      patients,
      aiOverrides,
      readiness: Math.max(0, Math.min(99, Math.round(readinessBase))),
      telemedicineShare: appointments14d ? Math.round((telemedicine / appointments14d) * 100) : 0,
    };
  }, [branches, clinics]);

  const clinicRows = useMemo(
    () => clinics.slice(0, 10).map((row) => [
      row.name,
      row.city || '—',
      `${row.stats?.locations || 0}`,
      `${row.stats?.vets || 0}`,
      `${row.stats?.patients || 0}`,
      row.emergency_available ? t('platform.clinicsPage.emergencyContour') : t('platform.clinicsPage.plannedContour'),
    ]),
    [clinics, t]
  );

  const branchSignalRows = useMemo(
    () => [...branches]
      .sort((left, right) => {
        const rightScore = Number(right.stats?.blocked_flow || 0) * 10 + Number(right.stats?.active_flow || 0);
        const leftScore = Number(left.stats?.blocked_flow || 0) * 10 + Number(left.stats?.active_flow || 0);
        return rightScore - leftScore;
      })
      .slice(0, 8)
      .map((row) => [
        row.clinic_name,
        `${row.city || '—'} · ${row.is_primary ? t('platform.branchesPage.mainBranch') : t('platform.branchesPage.branch')}`,
        `${row.stats?.appointments_14d || 0}`,
        `${row.stats?.active_flow || 0}`,
        `${row.stats?.blocked_flow || 0}`,
      ]),
    [branches, t]
  );

  const benchmarkRows = useMemo(
    () => clinics.slice(0, 8).map((row) => {
      const branchCount = Math.max(1, Number(row.stats?.locations || 1));
      const protocolCoverage = Math.round(Math.min(97, 58 + Number(row.stats?.services || 0) * 2 + branchCount * 3));
      const followUpControl = Math.round(Math.min(95, 54 + Number(row.stats?.upcoming_appointments || 0) * 1.5));
      return [
        row.name,
        formatPercent(protocolCoverage),
        formatPercent(followUpControl),
        row.emergency_available ? t('platform.clinicsPage.emergencyContour') : t('platform.clinicsPage.plannedContour'),
      ];
    }),
    [clinics, t]
  );

  const weakFunnelSources = useMemo(
    () => (ownerFunnel?.by_source || [])
      .filter((row) => Number(row.booking_open || 0) >= 3 && Number(row.submit_rate || 0) < 35)
      .slice(0, 5),
    [ownerFunnel]
  );

  const weakFunnelPlaybookRows = useMemo(
    () => weakFunnelSources.map((row) => {
      const suggestion = suggestFunnelAction(row.source, row.submit_rate);
      const currentRate = Number(row.submit_rate || 0);
      const targetRate = targetSubmitRateForSource(row.source);
      const opens = Number(row.booking_open || 0);
      const rateGap = Math.max(0, targetRate - currentRate);
      const expectedExtraSubmits14d = Math.max(0, Math.round((opens * rateGap) / 100));
      return [
        String(row.source || 'unknown'),
        suggestion.priority,
        suggestion.area,
        suggestion.owner,
        `${Math.round(currentRate)}% → ${targetRate}%`,
        `+${expectedExtraSubmits14d} / 14d`,
        suggestion.action,
      ];
    }).sort((left, right) => {
      const upliftLeft = Number(String(left[5]).replace(/[^\d.-]/g, '')) || 0;
      const upliftRight = Number(String(right[5]).replace(/[^\d.-]/g, '')) || 0;
      return upliftRight - upliftLeft;
    }),
    [weakFunnelSources]
  );

  const systemPlaybookRows = useMemo(
    () => Object.entries(playbookStatusBySource)
      .filter(([source]) => String(source || '').startsWith('export_'))
      .map(([source, state]) => {
        const isLatencyTask = source === 'export_latency_oncall_review';
        const latencyHigh = systemTaskSlaLifecycle?.latency_risk_level === 'high';
        const isUrgent = Boolean(state?.is_overdue) || (isLatencyTask && latencyHigh);
        return [
          source,
          'P0',
          'Security and compliance',
          'Network admin',
          'system task',
          isUrgent ? 'urgent' : 'n/a',
          isLatencyTask
            ? 'Auto-generated task from SLA latency risk monitor.'
            : 'Auto-generated task from export anomaly monitor.',
          isLatencyTask && latencyHigh ? 100 : (isUrgent ? 50 : 0),
        ];
      })
      .sort((left, right) => Number(right[7] || 0) - Number(left[7] || 0)),
    [playbookStatusBySource, systemTaskSlaLifecycle?.latency_risk_level]
  );

  const systemTaskSources = useMemo(
    () => [...new Set(Object.keys(playbookStatusBySource).filter((source) => String(source || '').startsWith('export_')))].sort(),
    [playbookStatusBySource]
  );

  const reloadSystemTaskHistory = useCallback(async (source, quickActionsOnly = systemQuickActionsOnly) => {
    const src = String(source || '').trim();
    if (!src) {
      setSystemTaskHistory([]);
      return;
    }
    setLoadingSystemTaskHistory(true);
    try {
      const params = new URLSearchParams();
      params.set('source', src);
      params.set('period_days', '30');
      params.set('limit', '20');
      if (quickActionsOnly) params.set('quick_actions_only', 'true');
      const payload = await apiRequest(`/api/v1/analytics/owner-funnel/system-tasks-history?${params.toString()}`);
      setSystemTaskHistory(Array.isArray(payload) ? payload : []);
    } catch {
      setSystemTaskHistory([]);
    } finally {
      setLoadingSystemTaskHistory(false);
    }
  }, [systemQuickActionsOnly]);

  const reloadSystemTaskInsights = useCallback(async (includeDismissed = showDismissedSla) => {
    try {
      const recParams = new URLSearchParams();
      recParams.set('period_days', '30');
      recParams.set('limit', '12');
      if (includeDismissed) recParams.set('include_dismissed', 'true');
      const [systemTasksPayload, systemTaskReasonPayload, systemTaskSlaRiskPayload, systemTaskSlaRecommendationsPayload] = await Promise.all([
        apiRequest('/api/v1/analytics/owner-funnel/system-tasks-summary?period_days=30'),
        apiRequest('/api/v1/analytics/owner-funnel/system-tasks-reason-analytics?period_days=30'),
        apiRequest('/api/v1/analytics/owner-funnel/system-tasks-sla-risk?period_days=30'),
        apiRequest(`/api/v1/analytics/owner-funnel/system-tasks-sla-recommendations?${recParams.toString()}`),
      ]);
      const slaLifecyclePayload = await apiRequest('/api/v1/analytics/owner-funnel/system-tasks-sla-lifecycle?period_days=30');
      setSystemTasksSummary(systemTasksPayload || null);
      setSystemTaskReasonAnalytics(systemTaskReasonPayload || null);
      setSystemTaskSlaRisk(systemTaskSlaRiskPayload || null);
      setSystemTaskSlaRecommendations(Array.isArray(systemTaskSlaRecommendationsPayload?.recommendations) ? systemTaskSlaRecommendationsPayload.recommendations : []);
      setSystemTaskSlaLifecycle(slaLifecyclePayload || null);
    } catch {
      // keep previous snapshot; next refresh will retry
    }
  }, [showDismissedSla]);

  useEffect(() => {
    reloadSystemTaskInsights(showDismissedSla);
  }, [reloadSystemTaskInsights, showDismissedSla]);

  useEffect(() => {
    const refreshId = window.setInterval(() => {
      reloadSystemTaskInsights();
    }, 30000);
    return () => window.clearInterval(refreshId);
  }, [reloadSystemTaskInsights]);

  const allPlaybookRows = useMemo(() => {
    const map = new Map();
    weakFunnelPlaybookRows.forEach((row) => {
      map.set(String(row[0] || 'unknown'), row);
    });
    systemPlaybookRows.forEach((row) => {
      map.set(String(row[0] || 'unknown'), row);
    });
    return [...map.values()];
  }, [systemPlaybookRows, weakFunnelPlaybookRows]);

  const filteredPlaybookRows = useMemo(
    () => ((showSystemOnly ? systemPlaybookRows : allPlaybookRows)
      .filter((row) => {
        if (!showOnlyOverdue) return true;
          const source = String(row[0] || 'unknown');
          return Boolean(playbookStatusBySource[source]?.is_overdue);
      })
    ).filter((row) => {
      if (!showOnlyMine) return true;
      const source = String(row[0] || 'unknown');
      return playbookStatusBySource[source]?.assignee_user_id && playbookStatusBySource[source]?.assignee_user_id === sessionUser?.id;
    }),
    [allPlaybookRows, playbookStatusBySource, sessionUser?.id, showOnlyMine, showOnlyOverdue, showSystemOnly, systemPlaybookRows]
  );

  const slaTrendAlert = useMemo(() => {
    const activeDelta = Number(systemTaskSlaLifecycle?.active_delta_vs_prev || 0);
    const snoozedDelta = Number(systemTaskSlaLifecycle?.snoozed_delta_vs_prev || 0);
    const ackedDelta = Number(systemTaskSlaLifecycle?.acked_delta_vs_prev || 0);
    const severe = activeDelta >= 2 && snoozedDelta >= 1;
    const warning = activeDelta > 0 || snoozedDelta > 0;
    if (severe) {
      return {
        level: 'critical',
        title: t('platform.dashboardSla.trendDegradedTitle'),
        text: t('platform.dashboardSla.trendDegradedText', { activeDelta, snoozedDelta }),
      };
    }
    if (warning) {
      return {
        level: 'warning',
        title: t('platform.dashboardSla.trendWarningTitle'),
        text: t('platform.dashboardSla.trendWarningText', {
          activeDelta: activeDelta >= 0 ? `+${activeDelta}` : activeDelta,
          snoozedDelta: snoozedDelta >= 0 ? `+${snoozedDelta}` : snoozedDelta,
        }),
      };
    }
    if (ackedDelta > 0) {
      return {
        level: 'ok',
        title: t('platform.dashboardSla.trendOkTitle'),
        text: t('platform.dashboardSla.trendOkText', { ackedDelta }),
      };
    }
    return null;
  }, [systemTaskSlaLifecycle?.acked_delta_vs_prev, systemTaskSlaLifecycle?.active_delta_vs_prev, systemTaskSlaLifecycle?.snoozed_delta_vs_prev, t]);

  async function setPlaybookStatus(source, status, dueInDays = null, assignee = null, reason = null) {
    const src = String(source || '').trim();
    if (!src || !status) return;
    setSavingStatusSource(src);
    try {
      await apiRequest('/api/v1/analytics/owner-funnel/playbook-status', {
        method: 'POST',
        body: {
          source: src,
          status,
          due_in_days: dueInDays,
          assignee_user_id: assignee?.assignee_user_id || null,
          assignee_label: assignee?.assignee_label || null,
          reason,
        },
      });
      setPlaybookStatusBySource((current) => ({
        ...current,
        [src]: {
          status,
          due_in_days: Number.isFinite(Number(dueInDays)) ? Number(dueInDays) : null,
          is_overdue: status !== 'done' && Number(dueInDays) === 0,
          assignee_user_id: assignee?.assignee_user_id || null,
          assignee_label: assignee?.assignee_label || null,
        },
      }));
      if (src.startsWith('export_')) {
        await Promise.all([
          reloadSystemTaskHistory(src, systemQuickActionsOnly),
          reloadSystemTaskInsights(),
        ]);
      }
    } catch {
      setPlaybookActionNotice({
        type: 'error',
        message: t('platform.dashboardSla.playbookStatusErrorNotice'),
      });
    } finally {
      setSavingStatusSource('');
    }
  }

  async function applySlaRecommendation(item) {
    const source = String(item?.source || '').trim();
    if (!source) return;
    const suggestedStatus = String(item?.suggested_status || '').trim() || 'in_progress';
    const dueRaw = Number(item?.suggested_due_in_days);
    const suggestedDueInDays = Number.isFinite(dueRaw) ? dueRaw : null;
    setApplyingSlaSource(source);
    try {
      const myAssignee = {
        assignee_user_id: sessionUser?.id || null,
        assignee_label: sessionUser?.full_name || sessionUser?.email || 'network_admin',
      };
      await setPlaybookStatus(source, suggestedStatus, suggestedDueInDays, myAssignee, String(item?.suggested_reason || 'sla_auto_apply'));
      setSystemTaskSlaRecommendations((current) => current.map((row) => (
        String(row?.source || '') === source
          ? {
              ...row,
              status: suggestedStatus,
              due_state: suggestedDueInDays === 0 ? 'overdue_now' : row?.due_state,
            }
          : row
      )));
    } finally {
      setApplyingSlaSource('');
    }
  }

  async function sendSlaRecommendationFeedback(item, action) {
    const source = String(item?.source || '').trim();
    if (!source || !action) return;
    setFeedbackSlaSource(source);
    try {
      let body = { source, action: 'ack' };
      if (action === 'snooze') {
        body = { source, action: 'snooze', snooze_days: 3 };
      } else if (action === 'restore') {
        body = { source, action: 'restore' };
      }
      await apiRequest('/api/v1/analytics/owner-funnel/system-tasks-sla-recommendations/feedback', {
        method: 'POST',
        body,
      });
      await reloadSystemTaskInsights();
    } finally {
      setFeedbackSlaSource('');
    }
  }

  async function applyBulkPlaybookUpdate() {
    const sources = filteredPlaybookRows.map((row) => String(row[0] || '').trim()).filter(Boolean);
    if (!sources.length) return;
    const dueInDays = bulkDueDays === '' ? null : Number(bulkDueDays);
    const assignee = bulkAssignee === 'me'
      ? {
          assignee_user_id: sessionUser?.id || null,
          assignee_label: sessionUser?.full_name || sessionUser?.email || 'me',
        }
      : { assignee_user_id: null, assignee_label: null };
    setPlaybookActionNotice({ type: '', message: '' });
    setSavingStatusSource('__bulk__');
    try {
      await apiRequest('/api/v1/analytics/owner-funnel/playbook-status/bulk', {
        method: 'POST',
        body: {
          sources,
          status: bulkStatus,
          due_in_days: dueInDays,
          assignee_user_id: assignee.assignee_user_id,
          assignee_label: assignee.assignee_label,
        },
      });
      setPlaybookStatusBySource((current) => {
        const next = { ...current };
        sources.forEach((source) => {
          next[source] = {
            status: bulkStatus,
            due_in_days: Number.isFinite(Number(dueInDays)) ? Number(dueInDays) : null,
            is_overdue: bulkStatus !== 'done' && Number(dueInDays) === 0,
            assignee_user_id: assignee.assignee_user_id,
            assignee_label: assignee.assignee_label,
          };
        });
        return next;
      });
      if (sources.some((source) => String(source || '').startsWith('export_'))) {
        await reloadSystemTaskInsights();
        if (selectedSystemTaskSource) await reloadSystemTaskHistory(selectedSystemTaskSource, systemQuickActionsOnly);
      }
      setPlaybookActionNotice({
        type: 'success',
        message: t('platform.dashboardSla.playbookBulkSuccessNotice', { count: sources.length }),
      });
    } catch {
      setPlaybookActionNotice({
        type: 'error',
        message: t('platform.dashboardSla.playbookBulkErrorNotice'),
      });
    } finally {
      setSavingStatusSource('');
    }
  }

  async function toggleHistory(source) {
    const src = String(source || '').trim();
    if (!src) return;
    if (expandedHistorySource === src) {
      setExpandedHistorySource('');
      return;
    }
    setExpandedHistorySource(src);
    if (playbookHistoryBySource[src]) return;
    try {
      const rows = await apiRequest(`/api/v1/analytics/owner-funnel/playbook-history?source=${encodeURIComponent(src)}&limit=12`);
      setPlaybookHistoryBySource((current) => ({ ...current, [src]: Array.isArray(rows) ? rows : [] }));
    } catch {
      setPlaybookHistoryBySource((current) => ({ ...current, [src]: [] }));
    }
  }

  async function exportPlaybookCsv() {
    const { accessToken } = getStoredSession();
    if (!accessToken) return;
    setExportActionNotice({ type: '', message: '' });
    setExportingCsv(true);
    try {
      const params = new URLSearchParams();
      params.set('include_history', exportIncludeHistory ? 'true' : 'false');
      params.set('period_days', String(exportPeriodDays || '14'));
      if (exportIncludeHistory) params.set('history_limit', String(exportHistoryLimit || '12'));
      if (showOnlyOverdue) params.set('only_overdue', 'true');
      if (showOnlyMine && sessionUser?.id) params.set('assignee_user_id', sessionUser.id);
      await downloadCsvFromApi(
        '/api/v1/analytics/owner-funnel/playbook-export.csv',
        params,
        accessToken,
        `owner-funnel-playbook-${new Date().toISOString().slice(0, 10)}.csv`
      );
      setExportActionNotice({
        type: 'success',
        message: t('platform.dashboardSla.exportCsvSuccessNotice'),
      });
    } catch {
      setExportActionNotice({
        type: 'error',
        message: t('platform.dashboardSla.exportCsvErrorNotice'),
      });
    } finally {
      setExportingCsv(false);
    }
  }

  async function exportManagementCsv() {
    const { accessToken } = getStoredSession();
    if (!accessToken) return;
    setExportActionNotice({ type: '', message: '' });
    setExportingManagementCsv(true);
    try {
      const params = new URLSearchParams();
      params.set('period_days', String(exportPeriodDays || '14'));
      if (showOnlyOverdue) params.set('only_overdue', 'true');
      if (showOnlyMine && sessionUser?.id) params.set('assignee_user_id', sessionUser.id);
      const periodTag = `${String(exportPeriodDays || '14')}d`;
      const scopeTag = showOnlyMine && sessionUser?.id ? 'mine' : 'all';
      const overdueTag = showOnlyOverdue ? 'overdue' : 'all-statuses';
      await downloadCsvFromApi(
        '/api/v1/analytics/owner-funnel/playbook-management-export.csv',
        params,
        accessToken,
        `owner-funnel-management-${periodTag}-${scopeTag}-${overdueTag}-${new Date().toISOString().slice(0, 10)}.csv`
      );
      setExportActionNotice({
        type: 'success',
        message: t('platform.dashboardSla.exportMgmtSuccessNotice'),
      });
    } catch {
      setExportActionNotice({
        type: 'error',
        message: t('platform.dashboardSla.exportMgmtErrorNotice'),
      });
    } finally {
      setExportingManagementCsv(false);
    }
  }

  async function exportBoardPack() {
    const { accessToken } = getStoredSession();
    if (!accessToken) return;
    setExportActionNotice({ type: '', message: '' });
    setExportingBoardPack(true);
    try {
      const params = new URLSearchParams();
      params.set('period_days', '30');
      if (showOnlyOverdue) params.set('only_overdue', 'true');
      if (showOnlyMine && sessionUser?.id) params.set('assignee_user_id', sessionUser.id);
      const scopeTag = showOnlyMine && sessionUser?.id ? 'mine' : 'all';
      const overdueTag = showOnlyOverdue ? 'overdue' : 'all-statuses';
      await downloadCsvFromApi(
        '/api/v1/analytics/owner-funnel/playbook-management-export.csv',
        params,
        accessToken,
        `owner-funnel-board-pack-30d-${scopeTag}-${overdueTag}-${new Date().toISOString().slice(0, 10)}.csv`
      );
      setExportActionNotice({
        type: 'success',
        message: t('platform.dashboardSla.exportBoardPackSuccessNotice'),
      });
    } catch {
      setExportActionNotice({
        type: 'error',
        message: t('platform.dashboardSla.exportBoardPackErrorNotice'),
      });
    } finally {
      setExportingBoardPack(false);
    }
  }

  async function exportPack() {
    const { accessToken } = getStoredSession();
    if (!accessToken) return;
    setExportActionNotice({ type: '', message: '' });
    setExportingPack(true);
    try {
      const detailParams = new URLSearchParams();
      detailParams.set('include_history', exportIncludeHistory ? 'true' : 'false');
      detailParams.set('period_days', String(exportPeriodDays || '14'));
      if (exportIncludeHistory) detailParams.set('history_limit', String(exportHistoryLimit || '12'));
      if (showOnlyOverdue) detailParams.set('only_overdue', 'true');
      if (showOnlyMine && sessionUser?.id) detailParams.set('assignee_user_id', sessionUser.id);

      const managementParams = new URLSearchParams();
      managementParams.set('period_days', String(exportPeriodDays || '14'));
      if (showOnlyOverdue) managementParams.set('only_overdue', 'true');
      if (showOnlyMine && sessionUser?.id) managementParams.set('assignee_user_id', sessionUser.id);

      const day = new Date().toISOString().slice(0, 10);
      const periodTag = `${String(exportPeriodDays || '14')}d`;
      const scopeTag = showOnlyMine && sessionUser?.id ? 'mine' : 'all';
      const overdueTag = showOnlyOverdue ? 'overdue' : 'all-statuses';

      await downloadCsvFromApi(
        '/api/v1/analytics/owner-funnel/playbook-export.csv',
        detailParams,
        accessToken,
        `owner-funnel-detail-${periodTag}-${scopeTag}-${overdueTag}-${day}.csv`
      );
      await downloadCsvFromApi(
        '/api/v1/analytics/owner-funnel/playbook-management-export.csv',
        managementParams,
        accessToken,
        `owner-funnel-management-${periodTag}-${scopeTag}-${overdueTag}-${day}.csv`
      );
      setExportActionNotice({
        type: 'success',
        message: t('platform.dashboardSla.exportPackSuccessNotice'),
      });
    } catch {
      setExportActionNotice({
        type: 'error',
        message: t('platform.dashboardSla.exportPackErrorNotice'),
      });
    } finally {
      setExportingPack(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('platform.dashboardSla.headerEyebrow')}
        title={t('platform.dashboardSla.headerTitle')}
        subtitle={t('platform.dashboardSla.headerSubtitle')}
        actions={(
          <>
            <Link href="/platform/clinics" className="btn-primary">{t('platform.dashboardSla.headerActionClinics')}</Link>
            <Link href="/platform/branches" className="btn-secondary">{t('platform.dashboardSla.headerActionBranches')}</Link>
            <Link href="/platform/ai" className="btn-secondary">{t('platform.dashboardSla.headerActionAi')}</Link>
          </>
        )}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <>
          <ShowcasePanel
            eyebrow={t('platform.dashboardSla.showcaseEyebrow')}
            title={t('platform.dashboardSla.showcaseTitle')}
            description={t('platform.dashboardSla.showcaseDescription')}
            imageSrc="/assets/img/admin-side.svg"
            imageAlt={t('platform.dashboardSla.showcaseImageAlt')}
            badges={[
              t('platform.dashboardSla.badgeClinics', { count: clinics.length }),
              t('platform.dashboardSla.badgeBranches', { count: metrics.totalBranches }),
              t('platform.dashboardSla.badgeEmergency', { count: metrics.emergencyClinics }),
              t('platform.dashboardSla.badgeAiOverrides', { count: metrics.aiOverrides }),
            ]}
            compact
          />

          <section className="kpi-grid">
            <StatsCard label={t('platform.dashboardSla.kpiClinicsLabel')} value={String(clinics.length)} />
            <StatsCard label={t('platform.dashboardSla.kpiBranchesLabel')} value={String(metrics.totalBranches)} />
            <StatsCard label={t('platform.dashboardSla.kpiPatientsByConsentLabel')} value={String(metrics.patients)} />
            <StatsCard label={t('platform.dashboardSla.kpiBlockedSignalsLabel')} value={String(metrics.blockedFlow)} />
            <StatsCard label={t('platform.dashboardSla.kpiTelemedicineShareLabel')} value={formatPercent(metrics.telemedicineShare)} />
            <StatsCard label={t('platform.dashboardSla.kpiNetworkReadinessLabel')} value={`${metrics.readiness}%`} />
            <StatsCard label={t('platform.dashboardSla.kpiOwnersFunnel14dLabel')} value={String(ownerFunnel?.unique_owners || 0)} />
            <StatsCard label={t('platform.dashboardSla.kpiPlaybookDone14dLabel')} value={String(playbookDigest?.completed_count || 0)} />
            <StatsCard label={t('platform.dashboardSla.kpiPlaybookOverdueLabel')} value={String(playbookDigest?.overdue_count || 0)} />
            <StatsCard label={t('platform.dashboardSla.kpiExportRisk14dLabel')} value={String(playbookExportRisk?.risk_level || 'low')} />
          </section>

          <section className="grid gap-5 2xl:grid-cols-[1fr_1fr] items-start">
            <Card title={t('platform.dashboardSla.executionDigestTitle')} subtitle={t('platform.dashboardSla.executionDigestSubtitle')}>
              <div className="grid gap-2 sm:grid-cols-2">
                <p className="text-sm text-lapka-700">{t('platform.dashboardSla.doneLabel')}: <span className="font-bold text-lapka-900">{playbookDigest?.completed_count || 0}</span></p>
                <p className="text-sm text-lapka-700">{t('platform.dashboardSla.inProgressLabel')}: <span className="font-bold text-lapka-900">{playbookDigest?.in_progress_count || 0}</span></p>
                <p className="text-sm text-lapka-700">{t('platform.dashboardSla.plannedLabel')}: <span className="font-bold text-lapka-900">{playbookDigest?.planned_count || 0}</span></p>
                <p className="text-sm text-lapka-700">{t('platform.dashboardSla.overdueLabel')}: <span className="font-bold text-lapka-900">{playbookDigest?.overdue_count || 0}</span></p>
              </div>
            </Card>
            <Card title={t('platform.dashboardSla.trendVsPreviousTitle')} subtitle={t('platform.dashboardSla.trendVsPreviousSubtitle')}>
              <div className="grid gap-2 sm:grid-cols-2">
                <p className="text-sm text-lapka-700">
                  Done delta:{' '}
                  <span className={`font-bold ${(playbookDigest?.completed_delta_pct || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {playbookDigest?.completed_delta_pct || 0}%
                  </span>
                </p>
                <p className="text-sm text-lapka-700">
                  Overdue delta:{' '}
                  <span className={`font-bold ${(playbookDigest?.overdue_delta_pct || 0) <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {playbookDigest?.overdue_delta_pct || 0}%
                  </span>
                </p>
                <p className="text-sm text-lapka-700">{t('platform.dashboardSla.avgDaysToDoneLabel')}: <span className="font-bold text-lapka-900">{playbookDigest?.avg_days_to_done || 0}</span></p>
                <p className="text-sm text-lapka-700">{t('platform.dashboardSla.previousDoneLabel')}: <span className="font-bold text-lapka-900">{playbookDigest?.previous_completed_count || 0}</span></p>
              </div>
            </Card>
          </section>

          <Card
            title={t('platform.dashboardSla.exportAnomalyTitle')}
            subtitle={t('platform.dashboardSla.exportAnomalySubtitle')}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="text-sm text-lapka-700">{t('platform.dashboardSla.exportRiskLevelLabel')}: <span className={`font-bold ${playbookExportRisk?.risk_level === 'high' ? 'text-rose-700' : playbookExportRisk?.risk_level === 'medium' ? 'text-amber-700' : 'text-emerald-700'}`}>{playbookExportRisk?.risk_level || 'low'}</span></p>
              <p className="text-sm text-lapka-700">{t('platform.dashboardSla.exportTotalLabel')}: <span className="font-bold text-lapka-900">{playbookExportRisk?.total_exports || 0}</span></p>
              <p className="text-sm text-lapka-700">{t('platform.dashboardSla.exportManagementShareLabel')}: <span className="font-bold text-lapka-900">{playbookExportRisk?.management_share_pct || 0}%</span></p>
              <p className="text-sm text-lapka-700">{t('platform.dashboardSla.exportOverdueShareLabel')}: <span className="font-bold text-lapka-900">{playbookExportRisk?.overdue_share_pct || 0}%</span></p>
              <p className="text-sm text-lapka-700">{t('platform.dashboardSla.exportUniqueExportersLabel')}: <span className="font-bold text-lapka-900">{playbookExportRisk?.unique_exporters || 0}</span></p>
            </div>
            {(playbookExportRisk?.risk_reasons || []).length ? (
              <ul className="mt-3 space-y-1 text-xs text-lapka-700">
                {(playbookExportRisk?.risk_reasons || []).map((reason, idx) => (
                  <li key={`risk-r-${idx}`} className="rounded-lg border border-lapka-200 bg-lapka-50 px-2 py-1">{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-emerald-700">{t('platform.dashboardSla.noExportAnomaliesText')}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary !min-h-[34px] !px-2 !py-1 text-xs"
                onClick={escalateExportRiskTask}
                disabled={escalatingExportRisk}
              >
                {escalatingExportRisk ? t('platform.dashboardSla.escalatingButton') : t('platform.dashboardSla.escalateSecurityButton')}
              </button>
              {exportRiskEscalationState ? (
                <span className="text-xs text-lapka-700">{exportRiskEscalationState}</span>
              ) : null}
            </div>
          </Card>

          <Card
            title={t('platform.dashboardSla.exportAuditTitle')}
            subtitle={t('platform.dashboardSla.exportAuditSubtitle')}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="text-xs text-lapka-700">
                {t('platform.dashboardSla.filterPeriodLabel')}
                <select className="input ml-2 !min-h-[34px] !w-[90px] !py-1 text-xs" value={auditPeriodDays} onChange={(event) => setAuditPeriodDays(event.target.value)}>
                  {PERIOD_DAY_OPTIONS.map((days) => (
                    <option key={`audit-period-${days}`} value={String(days)}>{days}d</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-lapka-700">
                {t('platform.dashboardSla.filterKindLabel')}
                <select className="input ml-2 !min-h-[34px] !w-[130px] !py-1 text-xs" value={auditKind} onChange={(event) => setAuditKind(event.target.value)}>
                  <option value="all">{t('platform.dashboardSla.filterKindAll')}</option>
                  <option value="detail">{t('platform.dashboardSla.filterKindDetail')}</option>
                  <option value="management">{t('platform.dashboardSla.filterKindManagement')}</option>
                </select>
              </label>
              <label className="text-xs text-lapka-700">
                {t('platform.dashboardSla.filterOverdueLabel')}
                <select className="input ml-2 !min-h-[34px] !w-[100px] !py-1 text-xs" value={auditOverdueFilter} onChange={(event) => setAuditOverdueFilter(event.target.value)}>
                  <option value="all">{t('platform.dashboardSla.filterAll')}</option>
                  <option value="yes">{t('platform.dashboardSla.filterYes')}</option>
                  <option value="no">{t('platform.dashboardSla.filterNo')}</option>
                </select>
              </label>
              <label className="text-xs text-lapka-700">
                {t('platform.dashboardSla.filterByUserLabel')}
                <input
                  type="text"
                  className="input ml-2 !min-h-[34px] !w-[220px] !py-1 text-xs"
                  placeholder={t('platform.dashboardSla.filterByUserPlaceholder')}
                  value={auditUserFilter}
                  onChange={(event) => setAuditUserFilter(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn-secondary !min-h-[34px] !px-2 !py-1 text-xs"
                onClick={exportPlaybookAuditCsv}
                disabled={exportingAuditCsv}
              >
                {exportingAuditCsv ? t('platform.dashboardSla.exportingButton') : t('platform.dashboardSla.exportAuditButton')}
              </button>
            </div>
            <Table
              columns={[t('platform.dashboardSla.colWhen'), t('platform.dashboardSla.colKind'), t('platform.dashboardSla.colPeriod'), t('platform.dashboardSla.colScope'), t('platform.dashboardSla.colOverdue'), t('platform.dashboardSla.colBy')]}
              rows={(playbookExportAudit || []).slice(0, 12).map((row) => [
                row?.exported_at ? new Date(row.exported_at).toLocaleString(i18n.resolvedLanguage === 'ru' ? 'ru-RU' : 'en-US') : '—',
                auditKindLabel(row?.kind),
                `${Number(row?.period_days || 0)}d`,
                row?.assignee_user_id ? `${t('platform.dashboardSla.assigneeLabel')}:${row.assignee_user_id}` : t('platform.dashboardSla.filterAll'),
                row?.only_overdue ? t('platform.dashboardSla.filterYes') : t('platform.dashboardSla.filterNo'),
                String(row?.exported_by_user_id || t('platform.dashboardSla.systemShort')),
              ])}
              emptyTitle={t('platform.dashboardSla.exportAuditEmptyTitle')}
              emptyText={t('platform.dashboardSla.exportAuditEmptyText')}
            />
          </Card>

          <section className="grid gap-5 2xl:grid-cols-[1.05fr_0.95fr] items-start">
            <Card title={t('platform.dashboardSla.networkClinicsTitle')} subtitle={t('platform.dashboardSla.networkClinicsSubtitle')}>
              <Table columns={[t('platform.dashboardSla.colClinic'), t('platform.dashboardSla.colCity'), t('platform.dashboardSla.colBranches'), t('platform.dashboardSla.colVets'), t('platform.dashboardSla.colPatients'), t('platform.dashboardSla.colPerimeter')]} rows={clinicRows} />
            </Card>
            <Card title={t('platform.dashboardSla.networkOpsTitle')} subtitle={t('platform.dashboardSla.networkOpsSubtitle')}>
              <ul className="space-y-2 text-sm text-lapka-700">
                <li>{t('platform.dashboardSla.networkBullet1')}</li>
                <li>{t('platform.dashboardSla.networkBullet2')}</li>
                <li>{t('platform.dashboardSla.networkBullet3')}</li>
                <li>{t('platform.dashboardSla.networkBullet4')}</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/platform/branches" className="btn-secondary !px-3 !py-1.5">{t('platform.dashboardSla.networkActionBranches')}</Link>
                <Link href="/platform/users" className="btn-secondary !px-3 !py-1.5">{t('platform.dashboardSla.networkActionRoles')}</Link>
              </div>
            </Card>
          </section>

          <section className="grid-soft-2 items-start">
            <Card title={t('platform.dashboardSla.benchmarkTitle')} subtitle={t('platform.dashboardSla.benchmarkSubtitle')}>
              <Table columns={[t('platform.dashboardSla.colClinic'), t('platform.dashboardSla.colProtocolCoverage'), t('platform.dashboardSla.colControl'), t('platform.dashboardSla.colPerimeter')]} rows={benchmarkRows} />
            </Card>
            <Card title={t('platform.dashboardSla.branchPressureTitle')} subtitle={t('platform.dashboardSla.branchPressureSubtitle')}>
              <Table
                columns={[t('platform.dashboardSla.colClinic'), t('platform.dashboardSla.colBranch'), t('platform.dashboardSla.colAppointments14d'), t('platform.dashboardSla.colActiveFlow'), t('platform.dashboardSla.colSignals')]}
                rows={branchSignalRows}
                emptyTitle={t('platform.dashboardSla.branchSignalsEmptyTitle')}
                emptyText={t('platform.dashboardSla.branchSignalsEmptyText')}
              />
            </Card>
          </section>

          <section className="grid gap-5 2xl:grid-cols-[1fr_1fr] items-start">
            <Card title={t('platform.dashboardSla.ownerFunnelTitle')} subtitle={t('platform.dashboardSla.ownerFunnelSubtitle')}>
              <Table
                columns={[t('platform.dashboardSla.colStep'), t('platform.dashboardSla.colEvents')]}
                rows={[
                  [t('platform.dashboardSla.triageOpenLabel'), `${ownerFunnel?.totals?.triage_open || 0}`],
                  [t('platform.dashboardSla.mapOpenLabel'), `${ownerFunnel?.totals?.map_open || 0}`],
                  [t('platform.dashboardSla.clinicOpenLabel'), `${ownerFunnel?.totals?.clinic_open || 0}`],
                  [t('platform.dashboardSla.bookingOpenLabel'), `${ownerFunnel?.totals?.booking_open || 0}`],
                  [t('platform.dashboardSla.bookingSubmitLabel'), `${ownerFunnel?.totals?.booking_submit || 0}`],
                ]}
              />
            </Card>
            <Card title={t('platform.dashboardSla.sourceConversionTitle')} subtitle={t('platform.dashboardSla.sourceConversionSubtitle')}>
              <Table
                columns={[t('platform.dashboardSla.colSource'), t('platform.dashboardSla.bookingOpenLabel'), t('platform.dashboardSla.bookingSubmitLabel'), t('platform.dashboardSla.colSubmitRate')]}
                rows={(ownerFunnel?.by_source || []).slice(0, 8).map((row) => [
                  String(row.source || 'unknown'),
                  `${row.booking_open || 0}`,
                  `${row.booking_submit || 0}`,
                  `${row.submit_rate || 0}%`,
                ])}
                emptyTitle={t('platform.dashboardSla.sourcesEmptyTitle')}
                emptyText={t('platform.dashboardSla.sourcesEmptyText')}
              />
            </Card>
          </section>

          <Card
            title={t('platform.dashboardSla.weakSourcesTitle')}
            subtitle={t('platform.dashboardSla.weakSourcesSubtitle')}
          >
            {weakFunnelSources.length ? (
              <ul className="space-y-2 text-sm text-lapka-700">
                {weakFunnelSources.map((row) => (
                  <li key={String(row.source)} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <span className="font-semibold text-lapka-900">{String(row.source)}</span>
                    {' · '}
                    {t('platform.dashboardSla.openShort')}
                    {' '}
                    {Number(row.booking_open || 0)}
                    {' · '}
                    {t('platform.dashboardSla.submitShort')}
                    {' '}
                    {Number(row.booking_submit || 0)}
                    {' · '}
                    {t('platform.dashboardSla.rateShort')}
                    {' '}
                    {Number(row.submit_rate || 0)}%
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-lapka-600">{t('platform.dashboardSla.weakSourcesEmptyText')}</p>
            )}
          </Card>

          <Card
            title={t('platform.dashboardSla.actionPlaybookTitle')}
            subtitle={t('platform.dashboardSla.actionPlaybookSubtitle')}
          >
            <div className="mb-3 rounded-2xl border border-lapka-200 bg-lapka-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lapka-500">{t('platform.dashboardSla.systemTasksSnapshotTitle')}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <p className="text-xs text-lapka-700">{t('platform.dashboardSla.totalLabel')}: <span className="font-bold text-lapka-900">{systemTasksSummary?.total_tasks || 0}</span></p>
                <p className="text-xs text-lapka-700">{t('platform.dashboardSla.inProgressLabel')}: <span className="font-bold text-lapka-900">{systemTasksSummary?.in_progress_count || 0}</span></p>
                <p className="text-xs text-lapka-700">{t('platform.dashboardSla.doneLabel')}: <span className="font-bold text-lapka-900">{systemTasksSummary?.done_count || 0}</span></p>
                <p className="text-xs text-lapka-700">{t('platform.dashboardSla.plannedLabel')}: <span className="font-bold text-lapka-900">{systemTasksSummary?.planned_count || 0}</span></p>
                <p className="text-xs text-lapka-700">{t('platform.dashboardSla.overdueLabel')}: <span className="font-bold text-lapka-900">{systemTasksSummary?.overdue_count || 0}</span></p>
                <p className="text-xs text-lapka-700">{t('platform.dashboardSla.avgDaysToDoneLabel')}: <span className="font-bold text-lapka-900">{systemTasksSummary?.avg_days_to_done || 0}</span></p>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <p className="text-xs text-lapka-700">{t('platform.dashboardSla.updates30dLabel')}: <span className="font-bold text-lapka-900">{systemTaskReasonAnalytics?.total_updates || 0}</span></p>
                <p className="text-xs text-lapka-700">{t('platform.dashboardSla.quickDoneLabel')}: <span className="font-bold text-lapka-900">{systemTaskReasonAnalytics?.quick_done_count || 0}</span></p>
                <p className="text-xs text-lapka-700">{t('platform.dashboardSla.quickPostponeLabel')}: <span className="font-bold text-lapka-900">{systemTaskReasonAnalytics?.quick_postpone_count || 0}</span></p>
              </div>
              {(systemTaskReasonAnalytics?.by_reason || []).length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(systemTaskReasonAnalytics?.by_reason || []).map((entry, idx) => (
                    <span key={`reason-kpi-${idx}`} className="rounded-full border border-lapka-200 bg-white px-2 py-1 text-[11px] text-lapka-700">
                      {String(entry.reason)}: <span className="font-semibold text-lapka-900">{Number(entry.count || 0)}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 rounded-xl border border-lapka-200 bg-white p-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lapka-500">{t('platform.dashboardSla.breachPredictorTitle')}</p>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                  <p className="text-xs text-lapka-700">{t('platform.dashboardSla.riskLabel')}: <span className={`font-bold ${systemTaskSlaRisk?.risk_level === 'high' ? 'text-rose-700' : systemTaskSlaRisk?.risk_level === 'medium' ? 'text-amber-700' : 'text-emerald-700'}`}>{systemTaskSlaRisk?.risk_level || 'low'}</span></p>
                  <p className="text-xs text-lapka-700">{t('platform.dashboardSla.openTasksLabel')}: <span className="font-bold text-lapka-900">{systemTaskSlaRisk?.total_open_tasks || 0}</span></p>
                  <p className="text-xs text-lapka-700">{t('platform.dashboardSla.projectedOverdueLabel')}: <span className="font-bold text-lapka-900">{systemTaskSlaRisk?.projected_overdue_7d || 0}</span></p>
                </div>
                {(systemTaskSlaRisk?.top_risky_sources || []).length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(systemTaskSlaRisk?.top_risky_sources || []).map((source) => (
                      <span key={`sla-risk-${source}`} className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                        {source}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mt-2 rounded-xl border border-lapka-200 bg-white p-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lapka-500">{t('platform.dashboardSla.lifecycleTitle')}</p>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-5">
                  <p className="text-xs text-lapka-700">
                    {t('platform.dashboardSla.activeLabel')}: <span className="font-bold text-lapka-900">{systemTaskSlaLifecycle?.active_count || 0}</span>
                    {' · '}
                    <span className={`font-semibold ${deltaBadgeClass(systemTaskSlaLifecycle?.active_delta_vs_prev, true)}`}>
                      {Number(systemTaskSlaLifecycle?.active_delta_vs_prev || 0) > 0 ? '+' : ''}{Number(systemTaskSlaLifecycle?.active_delta_vs_prev || 0)}
                    </span>
                  </p>
                  <p className="text-xs text-lapka-700">
                    {t('platform.dashboardSla.ackedLabel')}: <span className="font-bold text-lapka-900">{systemTaskSlaLifecycle?.acked_count || 0}</span>
                    {' · '}
                    <span className={`font-semibold ${deltaBadgeClass(systemTaskSlaLifecycle?.acked_delta_vs_prev, false)}`}>
                      {Number(systemTaskSlaLifecycle?.acked_delta_vs_prev || 0) > 0 ? '+' : ''}{Number(systemTaskSlaLifecycle?.acked_delta_vs_prev || 0)}
                    </span>
                  </p>
                  <p className="text-xs text-lapka-700">
                    {t('platform.dashboardSla.snoozedLabel')}: <span className="font-bold text-lapka-900">{systemTaskSlaLifecycle?.snoozed_count || 0}</span>
                    {' · '}
                    <span className={`font-semibold ${deltaBadgeClass(systemTaskSlaLifecycle?.snoozed_delta_vs_prev, true)}`}>
                      {Number(systemTaskSlaLifecycle?.snoozed_delta_vs_prev || 0) > 0 ? '+' : ''}{Number(systemTaskSlaLifecycle?.snoozed_delta_vs_prev || 0)}
                    </span>
                  </p>
                  <p className="text-xs text-lapka-700">
                    {t('platform.dashboardSla.restoredLabel')}: <span className="font-bold text-lapka-900">{systemTaskSlaLifecycle?.restored_events || 0}</span>
                    {' · '}
                    <span className={`font-semibold ${deltaBadgeClass(systemTaskSlaLifecycle?.restored_delta_vs_prev, false)}`}>
                      {Number(systemTaskSlaLifecycle?.restored_delta_vs_prev || 0) > 0 ? '+' : ''}{Number(systemTaskSlaLifecycle?.restored_delta_vs_prev || 0)}
                    </span>
                  </p>
                  <p className="text-xs text-lapka-700">{t('platform.dashboardSla.eventsLabel')}: <span className="font-bold text-lapka-900">{systemTaskSlaLifecycle?.total_feedback_events || 0}</span></p>
                </div>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  <p className="text-xs text-lapka-700">{t('platform.dashboardSla.alertCtaClicksLabel')}: <span className="font-bold text-lapka-900">{systemTaskSlaLifecycle?.alert_cta_clicks || 0}</span></p>
                  <p className="text-xs text-lapka-700">{t('platform.dashboardSla.alertResponseRateLabel')}: <span className="font-bold text-lapka-900">{Number(systemTaskSlaLifecycle?.alert_response_rate_pct || 0)}%</span></p>
                </div>
                {(systemTaskSlaLifecycle?.alert_response_by_level || []).length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(systemTaskSlaLifecycle?.alert_response_by_level || []).map((entry, idx) => (
                      <span key={`alert-level-${idx}`} className="rounded-full border border-lapka-200 bg-white px-2 py-1 text-[11px] text-lapka-700">
                        {String(entry.level)}: <span className="font-semibold text-lapka-900">{Number(entry.clicks || 0)}</span> ({Number(entry.rate_pct || 0)}%)
                      </span>
                    ))}
                  </div>
                ) : null}
                {(systemTaskSlaLifecycle?.alert_follow_up_by_level || []).length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(systemTaskSlaLifecycle?.alert_follow_up_by_level || []).map((entry, idx) => (
                      <span key={`alert-followup-${idx}`} className="rounded-full border border-lapka-200 bg-white px-2 py-1 text-[11px] text-lapka-700">
                        {t('platform.dashboardSla.followUp24hLabel', { level: String(entry.level) })}: <span className="font-semibold text-lapka-900">{Number(entry.follow_up_clicks_24h || 0)}</span> ({Number(entry.follow_up_rate_pct || 0)}%)
                        {' · '}
                        {t('platform.dashboardSla.ackShort')}
                        {' '}
                        <span className="font-semibold text-lapka-900">{Number(entry.ack_follow_up_24h || 0)}</span>
                        {' · '}
                        {t('platform.dashboardSla.doneShort')}
                        {' '}
                        <span className="font-semibold text-lapka-900">{Number(entry.done_follow_up_24h || 0)}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                {(systemTaskSlaLifecycle?.alert_follow_up_latency_by_level || []).length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(systemTaskSlaLifecycle?.alert_follow_up_latency_by_level || []).map((entry, idx) => (
                      <span key={`alert-latency-${idx}`} className="rounded-full border border-lapka-200 bg-white px-2 py-1 text-[11px] text-lapka-700">
                        {t('platform.dashboardSla.latencyByLevelLabel', { level: String(entry.level) })}: p50 <span className="font-semibold text-lapka-900">{Number(entry.p50_hours || 0)}h</span>, p90 <span className="font-semibold text-lapka-900">{Number(entry.p90_hours || 0)}h</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className={`mt-1.5 rounded-lg border px-2 py-1.5 text-xs ${
                  systemTaskSlaLifecycle?.latency_risk_level === 'high'
                    ? 'border-rose-300 bg-rose-50 text-rose-800'
                    : systemTaskSlaLifecycle?.latency_risk_level === 'medium'
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                }`}>
                  <p>
                    {t('platform.dashboardSla.latencyRiskLabel')}: <span className="font-semibold">{String(systemTaskSlaLifecycle?.latency_risk_level || 'low')}</span>
                    {systemTaskSlaLifecycle?.latency_risk_reason ? ` · ${String(systemTaskSlaLifecycle.latency_risk_reason)}` : ''}
                  </p>
                  {systemTaskSlaLifecycle?.latency_auto_action ? (
                    <p className="mt-0.5">
                      {t('platform.dashboardSla.autoActionLabel')}: <span className="font-semibold">{String(systemTaskSlaLifecycle.latency_auto_action)}</span>
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary !min-h-[30px] !px-2 !py-1 text-[11px]"
                      onClick={escalateLatencyRiskTask}
                      disabled={escalatingLatencyRisk}
                    >
                      {escalatingLatencyRisk ? t('platform.dashboardSla.escalatingButton') : t('platform.dashboardSla.escalateLatencyButton')}
                    </button>
                    {latencyRiskEscalationState ? (
                      <span className="text-[11px]">{latencyRiskEscalationState}</span>
                    ) : null}
                  </div>
                </div>
                {slaTrendAlert ? (
                  <div className={`mt-2 rounded-lg border px-2.5 py-2 text-xs ${
                    slaTrendAlert.level === 'critical'
                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                      : slaTrendAlert.level === 'warning'
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  }`}>
                    <p className="font-semibold">{slaTrendAlert.title}</p>
                    <p className="mt-0.5">{slaTrendAlert.text}</p>
                    <button
                      type="button"
                      className="mt-1.5 rounded-md border border-current bg-white/80 px-2 py-1 text-[11px] font-semibold transition hover:bg-white"
                      onClick={async () => {
                        const alertLevel = String(slaTrendAlert?.level || 'unknown').toLowerCase();
                        try {
                          await apiRequest(`/api/v1/analytics/owner-funnel/system-tasks-sla-alert-cta-click?level=${encodeURIComponent(alertLevel)}`, { method: 'POST' });
                        } catch {
                          // noop
                        }
                        setShowSystemOnly(true);
                        setShowOnlyOverdue(true);
                        await reloadSystemTaskInsights();
                      }}
                    >
                      {t('platform.dashboardSla.reviewTopRiskyButton')}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 rounded-xl border border-lapka-200 bg-white p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lapka-500">{t('platform.dashboardSla.autoActionsTitle')}</p>
                  <label className="text-xs text-lapka-700">
                    <input
                      type="checkbox"
                      className="mr-1 align-middle"
                      checked={showDismissedSla}
                      onChange={(event) => setShowDismissedSla(event.target.checked)}
                      aria-label={t('platform.dashboardSla.showDismissedAria')}
                    />
                    {t('platform.dashboardSla.showDismissedLabel')}
                  </label>
                </div>
                {systemTaskSlaRecommendations.length ? (
                  <ul className="mt-1.5 space-y-1.5">
                    {systemTaskSlaRecommendations.map((item, idx) => {
                      const priority = String(item.priority || 'P2');
                      const feedbackAction = String(item.feedback_action || 'none');
                      const snoozeUntil = item.snooze_until ? new Date(item.snooze_until).toLocaleString(i18n.resolvedLanguage === 'ru' ? 'ru-RU' : 'en-US') : '';
                      const isDismissed = Boolean(item.is_dismissed);
                      return (
                        <li key={`sla-reco-${String(item.source || 'unknown')}-${idx}`} className={`rounded-lg border px-2 py-1.5 text-xs ${isDismissed ? 'border-lapka-200 bg-lapka-100/70 text-lapka-500' : 'border-lapka-200 bg-lapka-50/50 text-lapka-700'}`}>
                          <span className={`mr-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${priority === 'P0' ? 'bg-rose-100 text-rose-700' : priority === 'P1' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {priority}
                          </span>
                          <span className="font-semibold text-lapka-900">{String(item.source || 'unknown')}</span>
                          {' - '}
                          {String(item.action || t('platform.dashboardSla.defaultAction'))}
                          {feedbackAction === 'ack' ? ` · ${t('platform.dashboardSla.ackedStatus')}` : null}
                          {feedbackAction === 'snooze' ? ` · ${t('platform.dashboardSla.snoozedUntilStatus', { until: snoozeUntil || t('platform.dashboardSla.notAvailableShort') })}` : null}
                          <button
                            type="button"
                            className="ml-2 rounded-md border border-lapka-300 bg-white px-2 py-1 text-[11px] font-semibold text-lapka-700 transition hover:border-lapka-400 hover:text-lapka-900 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => applySlaRecommendation(item)}
                            disabled={Boolean(applyingSlaSource) || Boolean(feedbackSlaSource) || savingStatusSource === String(item.source || '')}
                            title={Boolean(applyingSlaSource) || Boolean(feedbackSlaSource) || savingStatusSource === String(item.source || '') ? t('platform.dashboardSla.disabledBusyHint') : undefined}
                            aria-label={t('platform.dashboardSla.applyRecommendationAria', { source: String(item.source || 'unknown') })}
                          >
                            {applyingSlaSource === String(item.source || '') ? t('platform.dashboardSla.applyingButton') : t('platform.dashboardSla.applyRecommendationButton')}
                          </button>
                          <button
                            type="button"
                            className="ml-1 rounded-md border border-lapka-300 bg-white px-2 py-1 text-[11px] font-semibold text-lapka-700 transition hover:border-lapka-400 hover:text-lapka-900 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => sendSlaRecommendationFeedback(item, 'ack')}
                            disabled={Boolean(applyingSlaSource) || Boolean(feedbackSlaSource)}
                            title={Boolean(applyingSlaSource) || Boolean(feedbackSlaSource) ? t('platform.dashboardSla.disabledBusyHint') : undefined}
                            aria-label={t('platform.dashboardSla.ackRecommendationAria', { source: String(item.source || 'unknown') })}
                          >
                            {feedbackSlaSource === String(item.source || '') ? t('common.saving') : t('platform.dashboardSla.ackButton')}
                          </button>
                          <button
                            type="button"
                            className="ml-1 rounded-md border border-lapka-300 bg-white px-2 py-1 text-[11px] font-semibold text-lapka-700 transition hover:border-lapka-400 hover:text-lapka-900 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => sendSlaRecommendationFeedback(item, 'snooze')}
                            disabled={Boolean(applyingSlaSource) || Boolean(feedbackSlaSource)}
                            title={Boolean(applyingSlaSource) || Boolean(feedbackSlaSource) ? t('platform.dashboardSla.disabledBusyHint') : undefined}
                            aria-label={t('platform.dashboardSla.snoozeRecommendationAria', { source: String(item.source || 'unknown') })}
                          >
                            {t('platform.dashboardSla.snooze3dButton')}
                          </button>
                          {isDismissed ? (
                            <button
                              type="button"
                              className="ml-1 rounded-md border border-lapka-300 bg-white px-2 py-1 text-[11px] font-semibold text-lapka-700 transition hover:border-lapka-400 hover:text-lapka-900 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => sendSlaRecommendationFeedback(item, 'restore')}
                              disabled={Boolean(applyingSlaSource) || Boolean(feedbackSlaSource)}
                              title={Boolean(applyingSlaSource) || Boolean(feedbackSlaSource) ? t('platform.dashboardSla.disabledBusyHint') : undefined}
                              aria-label={t('platform.dashboardSla.restoreRecommendationAria', { source: String(item.source || 'unknown') })}
                            >
                              {t('platform.dashboardSla.restoreButton')}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-xs text-lapka-600">{t('platform.dashboardSla.noUrgentActionsText')}</p>
                )}
              </div>
              <div className="mt-3 rounded-xl border border-lapka-200 bg-white p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lapka-500">{t('platform.dashboardSla.systemTaskTimelineTitle')}</p>
                  <select
                    className="input !min-h-[34px] !w-[260px] !py-1 text-xs"
                    value={selectedSystemTaskSource}
                    onChange={(event) => setSelectedSystemTaskSource(event.target.value)}
                    disabled={!systemTaskSources.length}
                  >
                    {!systemTaskSources.length ? <option value="">{t('platform.dashboardSla.noSystemTasksOption')}</option> : null}
                    {systemTaskSources.map((source) => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                  <label className="text-xs text-lapka-700">
                    <input
                      type="checkbox"
                      className="mr-1 align-middle"
                      checked={systemQuickActionsOnly}
                      onChange={(event) => setSystemQuickActionsOnly(event.target.checked)}
                    />
                    {t('platform.dashboardSla.quickActionsOnlyLabel')}
                  </label>
                  <button
                    type="button"
                    className="btn-secondary !min-h-[34px] !px-2 !py-1 text-xs"
                    onClick={() => {
                      const current = playbookStatusBySource[selectedSystemTaskSource] || {};
                      setPlaybookStatus(
                        selectedSystemTaskSource,
                        'done',
                        current?.due_in_days ?? null,
                        {
                          assignee_user_id: current?.assignee_user_id || null,
                          assignee_label: current?.assignee_label || null,
                        },
                        'done_from_timeline'
                      );
                    }}
                    disabled={!selectedSystemTaskSource || savingStatusSource === selectedSystemTaskSource}
                    title={!selectedSystemTaskSource ? t('platform.dashboardSla.disabledSelectTaskHint') : (savingStatusSource === selectedSystemTaskSource ? t('platform.dashboardSla.disabledBusyHint') : undefined)}
                    aria-label={t('platform.dashboardSla.markDoneAria', { source: selectedSystemTaskSource || t('platform.dashboardSla.noSystemTasksOption') })}
                  >
                    {t('platform.dashboardSla.markDoneButton')}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary !min-h-[34px] !px-2 !py-1 text-xs"
                    onClick={() => {
                      const current = playbookStatusBySource[selectedSystemTaskSource] || {};
                      const currentDue = Number.isFinite(Number(current?.due_in_days)) ? Number(current.due_in_days) : 0;
                      setPlaybookStatus(
                        selectedSystemTaskSource,
                        current?.status || 'in_progress',
                        Math.max(0, currentDue + 1),
                        {
                          assignee_user_id: current?.assignee_user_id || null,
                          assignee_label: current?.assignee_label || null,
                        },
                        'postpone_from_timeline'
                      );
                    }}
                    disabled={!selectedSystemTaskSource || savingStatusSource === selectedSystemTaskSource}
                    title={!selectedSystemTaskSource ? t('platform.dashboardSla.disabledSelectTaskHint') : (savingStatusSource === selectedSystemTaskSource ? t('platform.dashboardSla.disabledBusyHint') : undefined)}
                    aria-label={t('platform.dashboardSla.postponeAria', { source: selectedSystemTaskSource || t('platform.dashboardSla.noSystemTasksOption') })}
                  >
                    {t('platform.dashboardSla.postpone1dButton')}
                  </button>
                </div>
                {loadingSystemTaskHistory ? (
                  <p className="mt-2 text-xs text-lapka-600">{t('platform.dashboardSla.loadingTimelineText')}</p>
                ) : (systemTaskHistory || []).length ? (
                  <ul className="mt-2 space-y-1.5 text-xs text-lapka-700">
                    {(systemTaskHistory || []).map((entry, idx) => (
                      <li key={`sys-h-${idx}`} className="rounded-lg border border-lapka-200 bg-lapka-50 px-2 py-1.5">
                        {entry.updated_at ? new Date(entry.updated_at).toLocaleString(i18n.resolvedLanguage === 'ru' ? 'ru-RU' : 'en-US') : '—'}
                        {' · '}
                        {statusLabel(entry.status)}
                        {' · '}
                        {t('platform.dashboardSla.dueShort')}
                        {' '}
                        {entry.due_in_days == null ? t('platform.dashboardSla.noneShort') : entry.due_in_days}
                        {' · '}
                        {entry.assignee_label || t('platform.dashboardSla.unassignedShort')}
                        {entry.reason ? ` · ${entry.reason}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-lapka-600">{t('platform.dashboardSla.noHistoryText')}</p>
                )}
              </div>
            </div>
            <div className="mb-3 flex items-center justify-end">
              <div className="flex flex-col items-end gap-2" aria-busy={exportingCsv || exportingManagementCsv || exportingPack || exportingBoardPack || exportingAuditCsv}>
                {exportActionNotice.message ? (
                  <InlineNotice
                    notice={exportActionNotice}
                    dismissAriaLabel={t('platform.dashboardSla.dismissNoticeAria')}
                    onClose={() => setExportActionNotice({ type: '', message: '' })}
                  />
                ) : null}
                <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="btn-secondary !min-h-[34px] !px-2 !py-1 text-xs"
                  onClick={exportPlaybookCsv}
                  disabled={exportingCsv}
                  title={exportingCsv ? t('platform.dashboardSla.disabledExportInProgressHint') : undefined}
                >
                  {exportingCsv ? t('platform.dashboardSla.exportingButton') : t('platform.dashboardSla.exportCsvButton')}
                </button>
                <button
                  type="button"
                  className="btn-secondary !min-h-[34px] !px-2 !py-1 text-xs"
                  onClick={exportManagementCsv}
                  disabled={exportingManagementCsv}
                  title={exportingManagementCsv ? t('platform.dashboardSla.disabledExportInProgressHint') : undefined}
                >
                  {exportingManagementCsv ? t('platform.dashboardSla.exportingButton') : t('platform.dashboardSla.exportMgmtCsvButton')}
                </button>
                <button
                  type="button"
                  className="btn-secondary !min-h-[34px] !px-2 !py-1 text-xs"
                  onClick={exportPack}
                  disabled={exportingPack}
                  title={exportingPack ? t('platform.dashboardSla.disabledExportInProgressHint') : t('platform.dashboardSla.exportPackTitle')}
                >
                  {exportingPack ? t('platform.dashboardSla.packagingButton') : t('platform.dashboardSla.exportPackButton')}
                </button>
                <button
                  type="button"
                  className="btn-primary !min-h-[34px] !px-2 !py-1 text-xs"
                  onClick={exportBoardPack}
                  disabled={exportingBoardPack}
                  title={exportingBoardPack ? t('platform.dashboardSla.disabledExportInProgressHint') : t('platform.dashboardSla.boardPackTitle')}
                >
                  {exportingBoardPack ? t('platform.dashboardSla.preparingButton') : t('platform.dashboardSla.boardPackButton')}
                </button>
                <label className="text-xs text-lapka-700">
                  {t('platform.dashboardSla.filterPeriodLabel')}
                  <select
                    className="input ml-2 !min-h-[34px] !w-[90px] !py-1 text-xs"
                    value={exportPeriodDays}
                    onChange={(event) => setExportPeriodDays(event.target.value)}
                  >
                    {PERIOD_DAY_OPTIONS.map((days) => (
                      <option key={`export-period-${days}`} value={String(days)}>{days}d</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-lapka-700">
                  <input
                    type="checkbox"
                    className="mr-2 align-middle"
                    checked={exportIncludeHistory}
                    onChange={(event) => setExportIncludeHistory(event.target.checked)}
                    aria-label={t('platform.dashboardSla.includeHistoryAria')}
                  />
                  {t('platform.dashboardSla.includeHistoryLabel')}
                </label>
                <label className="text-xs text-lapka-700">
                  {t('platform.dashboardSla.historyRowsLabel')}
                  <select
                    className="input ml-2 !min-h-[34px] !w-[90px] !py-1 text-xs"
                    value={exportHistoryLimit}
                    onChange={(event) => setExportHistoryLimit(event.target.value)}
                    disabled={!exportIncludeHistory}
                  >
                    <option value="5">5</option>
                    <option value="12">12</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </label>
                <label className="text-sm text-lapka-700">
                  <input
                    type="checkbox"
                    className="mr-2 align-middle"
                    checked={showOnlyOverdue}
                    onChange={(event) => setShowOnlyOverdue(event.target.checked)}
                    aria-label={t('platform.dashboardSla.onlyOverdueAria')}
                  />
                  {t('platform.dashboardSla.onlyOverdueLabel')}
                </label>
                <label className="text-sm text-lapka-700">
                  <input
                    type="checkbox"
                    className="mr-2 align-middle"
                    checked={showOnlyMine}
                    onChange={(event) => setShowOnlyMine(event.target.checked)}
                    aria-label={t('platform.dashboardSla.myItemsAria')}
                  />
                  {t('platform.dashboardSla.myItemsLabel')}
                </label>
                <label className="text-sm text-lapka-700">
                  <input
                    type="checkbox"
                    className="mr-2 align-middle"
                    checked={showSystemOnly}
                    onChange={(event) => setShowSystemOnly(event.target.checked)}
                    aria-label={t('platform.dashboardSla.systemTasksOnlyAria')}
                  />
                  {t('platform.dashboardSla.systemTasksOnlyLabel')}
                </label>
                </div>
              </div>
            </div>
            {filteredPlaybookRows.length ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-lapka-200 bg-lapka-50/70 p-3" aria-busy={savingStatusSource === '__bulk__'}>
                  {playbookActionNotice.message ? (
                    <div className="mb-2">
                      <InlineNotice
                        notice={playbookActionNotice}
                        dismissAriaLabel={t('platform.dashboardSla.dismissNoticeAria')}
                        onClose={() => setPlaybookActionNotice({ type: '', message: '' })}
                      />
                    </div>
                  ) : null}
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lapka-500">
                    {t('platform.dashboardSla.bulkActionsTitle', { count: filteredPlaybookRows.length })}
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <label className="text-xs text-lapka-600">
                      {t('platform.dashboardSla.statusFieldLabel')}
                      <select className="input mt-1 !min-h-[36px] !w-[150px] !py-1.5 text-sm" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>
                        <option value="planned">{t('platform.dashboardSla.statusPlanned')}</option>
                        <option value="in_progress">{t('platform.dashboardSla.statusInProgress')}</option>
                        <option value="done">{t('platform.dashboardSla.statusDone')}</option>
                      </select>
                    </label>
                    <label className="text-xs text-lapka-600">
                      {t('platform.dashboardSla.dueInDaysLabel')}
                      <select className="input mt-1 !min-h-[36px] !w-[130px] !py-1.5 text-sm" value={bulkDueDays} onChange={(event) => setBulkDueDays(event.target.value)}>
                        <option value="">{t('platform.dashboardSla.noneShort')}</option>
                        <option value="0">0</option>
                        <option value="1">1</option>
                        <option value="3">3</option>
                        <option value="7">7</option>
                        <option value="14">14</option>
                      </select>
                    </label>
                    <label className="text-xs text-lapka-600">
                      {t('platform.dashboardSla.assigneeLabel')}
                      <select className="input mt-1 !min-h-[36px] !w-[130px] !py-1.5 text-sm" value={bulkAssignee} onChange={(event) => setBulkAssignee(event.target.value)}>
                        <option value="none">{t('platform.dashboardSla.unassignedShort')}</option>
                      <option value="me">{t('platform.dashboardSla.meShort')}</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn-primary !min-h-[36px] !px-3 !py-1.5 text-sm"
                      onClick={applyBulkPlaybookUpdate}
                      disabled={savingStatusSource === '__bulk__'}
                      title={savingStatusSource === '__bulk__' ? t('platform.dashboardSla.disabledBusyHint') : undefined}
                      aria-label={t('platform.dashboardSla.applyBulkAria', { count: filteredPlaybookRows.length })}
                    >
                      {savingStatusSource === '__bulk__' ? t('platform.dashboardSla.applyingButton') : t('platform.dashboardSla.applyToFilteredButton')}
                    </button>
                  </div>
                </div>
                {filteredPlaybookRows.map((row) => {
                  const source = String(row[0] || 'unknown');
                  const currentStatus = playbookStatusBySource[source]?.status || 'planned';
                  const currentDue = playbookStatusBySource[source]?.due_in_days;
                  const isOverdue = Boolean(playbookStatusBySource[source]?.is_overdue);
                  const currentAssigneeUserId = playbookStatusBySource[source]?.assignee_user_id || null;
                  const currentAssigneeLabel = playbookStatusBySource[source]?.assignee_label || null;
                  return (
                    <div key={source} className={`rounded-2xl border bg-white p-4 ${isOverdue ? 'border-rose-300' : 'border-lapka-200'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-lapka-900">
                            {source}
                            {source === 'export_security_review' ? (
                              <span className="ml-2 rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-700">
                                {t('platform.dashboardSla.systemShort')}
                              </span>
                            ) : null}
                            {source === 'export_latency_oncall_review' ? (
                              <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                systemTaskSlaLifecycle?.latency_risk_level === 'high'
                                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                                  : 'border-amber-300 bg-amber-50 text-amber-700'
                              }`}>
                                {t('platform.dashboardSla.latencyShort')}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-lapka-600">
                            {row[1]} · {row[2]} · {row[3]}
                          </p>
                          <p className="text-xs text-lapka-600">
                            {String(row[4])} · {t('platform.dashboardSla.upliftShort')} {String(row[5])}
                          </p>
                          <p className="text-xs text-lapka-600">
                            {t('platform.dashboardSla.assigneeLabel')}: <span className="font-semibold text-lapka-900">{currentAssigneeLabel || t('platform.dashboardSla.unassignedShort')}</span>
                          </p>
                          {isOverdue ? <p className="text-xs font-semibold text-rose-700">{t('platform.dashboardSla.overdueLabel')}</p> : null}
                        </div>
                        <div className="grid gap-2">
                          <label className="text-xs text-lapka-600">
                            {t('platform.dashboardSla.statusFieldLabel')}
                            <select
                              className="input mt-1 !min-h-[38px] !w-[170px] !py-1.5 text-sm"
                              value={currentStatus}
                              onChange={(event) =>
                                setPlaybookStatus(source, event.target.value, currentDue, {
                                  assignee_user_id: currentAssigneeUserId,
                                  assignee_label: currentAssigneeLabel,
                                })
                              }
                              disabled={savingStatusSource === source}
                            >
                              <option value="planned">{t('platform.dashboardSla.statusPlanned')}</option>
                              <option value="in_progress">{t('platform.dashboardSla.statusInProgress')}</option>
                              <option value="done">{t('platform.dashboardSla.statusDone')}</option>
                            </select>
                          </label>
                          <label className="text-xs text-lapka-600">
                            {t('platform.dashboardSla.dueInDaysLabel')}
                            <select
                              className="input mt-1 !min-h-[38px] !w-[170px] !py-1.5 text-sm"
                              value={currentDue == null ? '' : String(currentDue)}
                              onChange={(event) => {
                                const value = event.target.value === '' ? null : Number(event.target.value);
                                setPlaybookStatus(source, currentStatus, value, {
                                  assignee_user_id: currentAssigneeUserId,
                                  assignee_label: currentAssigneeLabel,
                                });
                              }}
                              disabled={savingStatusSource === source}
                            >
                              <option value="">{t('platform.dashboardSla.noneShort')}</option>
                              <option value="0">{t('platform.dashboardSla.todayOption')}</option>
                              <option value="1">1</option>
                              <option value="3">3</option>
                              <option value="7">7</option>
                              <option value="14">14</option>
                            </select>
                          </label>
                          <label className="text-xs text-lapka-600">
                            {t('platform.dashboardSla.assigneeLabel')}
                            <select
                              className="input mt-1 !min-h-[38px] !w-[170px] !py-1.5 text-sm"
                              value={currentAssigneeUserId ? 'me' : 'none'}
                              onChange={(event) => {
                                const next = event.target.value === 'me'
                                  ? {
                                      assignee_user_id: sessionUser?.id || null,
                                      assignee_label: sessionUser?.full_name || sessionUser?.email || t('platform.dashboardSla.meShort'),
                                    }
                                  : { assignee_user_id: null, assignee_label: null };
                                setPlaybookStatus(source, currentStatus, currentDue, next);
                              }}
                              disabled={savingStatusSource === source}
                            >
                              <option value="none">{t('platform.dashboardSla.unassignedShort')}</option>
                              <option value="me">{t('platform.dashboardSla.meShort')}</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            className="btn-secondary !min-h-[34px] !px-2 !py-1 text-xs"
                            onClick={() => toggleHistory(source)}
                          >
                            {expandedHistorySource === source ? t('platform.dashboardSla.hideHistoryButton') : t('platform.dashboardSla.showHistoryButton')}
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-lapka-700">{String(row[6])}</p>
                      {expandedHistorySource === source ? (
                        <div className="mt-3 rounded-xl border border-lapka-200 bg-lapka-50/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lapka-500">{t('platform.dashboardSla.historyTitle')}</p>
                          {(playbookHistoryBySource[source] || []).length ? (
                            <ul className="mt-2 space-y-1.5 text-xs text-lapka-700">
                              {(playbookHistoryBySource[source] || []).map((entry, idx) => (
                                <li key={`${source}-h-${idx}`} className="rounded-lg border border-lapka-200 bg-white px-2 py-1.5">
                                  {entry.updated_at ? new Date(entry.updated_at).toLocaleString(i18n.resolvedLanguage === 'ru' ? 'ru-RU' : 'en-US') : '—'}
                                  {' · '}
                                  {statusLabel(entry.status)}
                                  {' · '}
                                  {t('platform.dashboardSla.dueShort')}
                                  {' '}
                                  {entry.due_in_days == null ? t('platform.dashboardSla.noneShort') : entry.due_in_days}
                                  {' · '}
                                  {entry.assignee_label || t('platform.dashboardSla.unassignedShort')}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-lapka-600">{t('platform.dashboardSla.noHistoryText')}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-lapka-600">
                {showOnlyOverdue || showOnlyMine || showSystemOnly
                  ? t('platform.dashboardSla.noTasksForCurrentFilter')
                  : t('platform.dashboardSla.playbookNotNeededYet')}
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
