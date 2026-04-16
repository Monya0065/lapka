'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';
import { getStoredSession } from '@/lib/auth';
import { useClinicScope } from '@/lib/clinic-scope';

const ACTIONS = [
  { id: 'soft_reminder', label: 'Soft reminder' },
  { id: 'call_owner', label: 'Прозвон владельца' },
  { id: 'require_deposit', label: 'Депозит перед записью' },
  { id: 'manual_review', label: 'Ручной разбор кейса' },
];

export default function ClinicNoShowOperationsPage() {
  const { clinicId, selectedClinic, selectedBranch } = useClinicScope();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [ownerQuery, setOwnerQuery] = useState('');
  const [statuses, setStatuses] = useState({});
  const [report, setReport] = useState(null);
  const [batchHistory, setBatchHistory] = useState([]);
  const [recentBatches, setRecentBatches] = useState([]);
  const [busyOwnerId, setBusyOwnerId] = useState('');
  const [batchBusyKey, setBatchBusyKey] = useState('');
  const [lastBatchId, setLastBatchId] = useState('');
  const [confirmTokens, setConfirmTokens] = useState({});
  const [previewTokens, setPreviewTokens] = useState({});
  const [previewExpiryTs, setPreviewExpiryTs] = useState({});
  const [ttlNow, setTtlNow] = useState(Date.now());
  const [previewStatuses, setPreviewStatuses] = useState({});
  const [batchCooldownHours, setBatchCooldownHours] = useState(72);
  const [autoRunDays, setAutoRunDays] = useState(90);
  const [autoRunLimit, setAutoRunLimit] = useState(120);
  const [autoRunBusy, setAutoRunBusy] = useState(false);
  const [autoRunResult, setAutoRunResult] = useState(null);
  const [autoRunnerStatus, setAutoRunnerStatus] = useState(null);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError('');
    try {
      const session = getStoredSession();
      const canSeeAutoRunner = session?.role === 'clinic_admin' || session?.role === 'network_admin';
      const requests = [
        apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk?days=90`),
        apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions?limit=300`),
        apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk/report?days=90`),
        apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions?limit=80&batch_only=true`),
        apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions/batch/recent?limit=20`),
      ];
      if (canSeeAutoRunner) {
        requests.push(
          apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions/batch/auto-runner/status`),
        );
      }
      const results = await Promise.all(requests);
      const data = results[0];
      const history = results[1];
      const reportPayload = results[2];
      const batchHistoryPayload = results[3];
      const recentBatchesPayload = results[4];
      const statusPayload = canSeeAutoRunner ? results[5] : null;

      setRows(Array.isArray(data) ? data : []);
      setReport(reportPayload || null);
      const latest = {};
      if (Array.isArray(history)) {
        history.forEach((item) => {
          if (!item?.owner_user_id || latest[item.owner_user_id]) return;
          latest[item.owner_user_id] = {
            action: item.action || '',
            at: item.created_at,
          };
        });
      }
      setStatuses(latest);
      setBatchHistory(Array.isArray(batchHistoryPayload) ? batchHistoryPayload : []);
      setRecentBatches(Array.isArray(recentBatchesPayload) ? recentBatchesPayload : []);
      setAutoRunnerStatus(statusPayload && typeof statusPayload === 'object' ? statusPayload : null);
      setConfirmTokens({});
      setPreviewTokens({});
      setPreviewExpiryTs({});
    } catch (e) {
      setError(e.message || 'Не удалось загрузить no-show risk');
      setRows([]);
      setStatuses({});
      setReport(null);
      setBatchHistory([]);
      setRecentBatches([]);
      setAutoRunnerStatus(null);
      setConfirmTokens({});
      setPreviewTokens({});
      setPreviewExpiryTs({});
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setTtlNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const activeKeys = Object.keys(previewTokens || {}).filter((key) => previewTokens[key]);
    if (!activeKeys.length || !clinicId) return;
    const interval = setInterval(async () => {
      await Promise.all(
        activeKeys.map(async (key) => {
          const token = previewTokens[key];
          if (!token) return;
          try {
            const payload = await apiRequest(
              `/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions/batch/preview-status?preview_token=${encodeURIComponent(token)}`,
            );
            setPreviewStatuses((prev) => ({ ...prev, [key]: payload?.status || 'unknown' }));
          } catch {
            setPreviewStatuses((prev) => ({ ...prev, [key]: 'unknown' }));
          }
        }),
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [clinicId, previewTokens]);

  useEffect(() => {
    const expiredKeys = Object.keys(previewExpiryTs || {}).filter((key) => {
      const ts = Number(previewExpiryTs[key] || 0);
      return ts > 0 && ts < ttlNow;
    });
    if (!expiredKeys.length) return;
    setConfirmTokens((prev) => {
      const next = { ...prev };
      expiredKeys.forEach((key) => { next[key] = ''; });
      return next;
    });
    setPreviewTokens((prev) => {
      const next = { ...prev };
      expiredKeys.forEach((key) => { next[key] = ''; });
      return next;
    });
    setPreviewStatuses((prev) => {
      const next = { ...prev };
      expiredKeys.forEach((key) => { next[key] = 'expired'; });
      return next;
    });
  }, [previewExpiryTs, ttlNow]);

  const applyAction = useCallback(async (ownerId, action) => {
    if (!clinicId) return;
    setBusyOwnerId(ownerId);
    try {
      await apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions`, {
        method: 'POST',
        body: JSON.stringify({ owner_user_id: ownerId, action }),
      });
      setStatuses((prev) => ({
        ...prev,
        [ownerId]: {
          action,
          at: new Date().toISOString(),
        },
      }));
    } catch (e) {
      setError(e.message || 'Не удалось применить действие');
    } finally {
      setBusyOwnerId('');
    }
  }, [clinicId]);

  const applyBatchAction = useCallback(async (planItem) => {
    if (!clinicId || !planItem?.action || !planItem?.segment) return;
    const key = `${planItem.segment}:${planItem.action}`;
    setBatchBusyKey(key);
    setError('');
    try {
      const token = confirmTokens[key];
      const previewToken = previewTokens[key];
      if (!token) {
        throw new Error('Сначала выполните Preview для получения confirm token.');
      }
      if (!previewToken) {
        throw new Error('Сначала выполните Preview для получения preview token.');
      }
      const payload = await apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions/batch`, {
        method: 'POST',
        body: JSON.stringify({
          segment: planItem.segment,
          action: planItem.action,
          note: planItem.note || 'weekly plan batch',
          days: 90,
          limit: 200,
          cooldown_hours: Math.max(1, Number(batchCooldownHours) || 72),
          confirm_token: token,
          preview_token: previewToken,
        }),
      });
      setLastBatchId(payload?.batch_id || '');
      setConfirmTokens((prev) => ({ ...prev, [key]: '' }));
      setPreviewTokens((prev) => ({ ...prev, [key]: '' }));
      setPreviewExpiryTs((prev) => ({ ...prev, [key]: 0 }));
      await load();
      setError(
        `Batch выполнен: applied ${Number(payload?.applied || 0)}, skipped by cooldown ${Number(payload?.skipped_due_cooldown || 0)}.`,
      );
    } catch (e) {
      setError(e.message || 'Не удалось применить batch действие');
    } finally {
      setBatchBusyKey('');
    }
  }, [clinicId, load, confirmTokens, previewTokens, batchCooldownHours]);

  const previewBatchAction = useCallback(async (planItem) => {
    if (!clinicId || !planItem?.action || !planItem?.segment) return;
    setError('');
    try {
      const payload = await apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions/batch`, {
        method: 'POST',
        body: JSON.stringify({
          segment: planItem.segment,
          action: planItem.action,
          note: planItem.note || 'weekly plan preview',
          days: 90,
          limit: 200,
          cooldown_hours: Math.max(1, Number(batchCooldownHours) || 72),
          dry_run: true,
        }),
      });
      const count = Number(payload?.candidate_count || 0);
      const skipped = Number(payload?.skipped_due_cooldown || 0);
      const key = `${planItem.segment}:${planItem.action}`;
      setConfirmTokens((prev) => ({ ...prev, [key]: payload?.confirm_token_hint || '' }));
      setPreviewTokens((prev) => ({ ...prev, [key]: payload?.preview_token || '' }));
      setPreviewExpiryTs((prev) => ({ ...prev, [key]: Date.now() + Number(payload?.preview_expires_in_sec || 0) * 1000 }));
      setPreviewStatuses((prev) => ({ ...prev, [key]: 'valid' }));
      setError(`Preview: ${count} owner(s), skipped by cooldown ${skipped}, сегмент ${planItem.segment}.`);
    } catch (e) {
      setError(e.message || 'Не удалось выполнить dry-run');
    }
  }, [clinicId, batchCooldownHours]);

  const refreshPreviewStatus = useCallback(async (key) => {
    if (!clinicId) return;
    const token = previewTokens[key];
    if (!token) return;
    try {
      const payload = await apiRequest(
        `/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions/batch/preview-status?preview_token=${encodeURIComponent(token)}`,
      );
      setPreviewStatuses((prev) => ({ ...prev, [key]: payload?.status || 'unknown' }));
    } catch {
      setPreviewStatuses((prev) => ({ ...prev, [key]: 'unknown' }));
    }
  }, [clinicId, previewTokens]);

  const undoLastBatch = useCallback(async () => {
    if (!clinicId || !lastBatchId) return;
    setError('');
    try {
      await apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions/batch/undo`, {
        method: 'POST',
        body: JSON.stringify({ batch_id: lastBatchId, window_minutes: 30 }),
      });
      setLastBatchId('');
      await load();
    } catch (e) {
      setError(e.message || 'Не удалось откатить batch');
    }
  }, [clinicId, lastBatchId, load]);

  const runAutoCampaign = useCallback(async (dryRun) => {
    if (!clinicId) return;
    setAutoRunBusy(true);
    setError('');
    try {
      const payload = await apiRequest(
        `/api/v1/analytics/clinic/${clinicId}/no-show-risk/actions/batch/auto-run`,
        {
          method: 'POST',
          body: JSON.stringify({
            days: Math.max(7, Math.min(365, Number(autoRunDays) || 90)),
            cooldown_hours: Math.max(1, Math.min(336, Number(batchCooldownHours) || 72)),
            limit: Math.max(1, Math.min(500, Number(autoRunLimit) || 120)),
            dry_run: Boolean(dryRun),
          }),
        },
      );
      setAutoRunResult(payload || null);
      if (!dryRun) {
        await load();
      }
    } catch (e) {
      setError(e.message || 'Не удалось выполнить auto-run no-show кампанию');
    } finally {
      setAutoRunBusy(false);
    }
  }, [clinicId, autoRunDays, batchCooldownHours, autoRunLimit, load]);

  const filteredRows = useMemo(() => {
    const query = ownerQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (riskFilter !== 'all' && row.risk_level !== riskFilter) return false;
      if (query && !String(row.owner_user_id || '').toLowerCase().includes(query)) return false;
      return true;
    });
  }, [rows, riskFilter, ownerQuery]);

  const tableRows = useMemo(() => {
    return filteredRows.map((row) => {
      const st = statuses[row.owner_user_id];
      const riskTone = row.risk_level === 'high' ? 'critical' : row.risk_level === 'medium' ? 'warning' : 'neutral';
      return [
        <code key={`id-${row.owner_user_id}`} className="text-xs">{row.owner_user_id}</code>,
        row.appointments_total,
        row.no_show_count,
        `${Math.round(Number(row.no_show_rate || 0) * 100)}%`,
        <span key={`risk-${row.owner_user_id}`} className={`badge badge-${riskTone}`}>{row.risk_level}</span>,
        st ? `${st.action} · ${new Date(st.at).toLocaleString('ru-RU')}` : '—',
        <div key={`act-${row.owner_user_id}`} className="flex flex-wrap gap-1.5">
          {ACTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="btn-secondary !px-2.5 !py-1 text-xs"
              onClick={() => applyAction(row.owner_user_id, item.id)}
              disabled={busyOwnerId === row.owner_user_id}
            >
              {item.label}
            </button>
          ))}
        </div>,
      ];
    });
  }, [filteredRows, statuses, busyOwnerId, applyAction]);

  const highRiskCount = rows.filter((row) => row.risk_level === 'high').length;
  const mediumRiskCount = rows.filter((row) => row.risk_level === 'medium').length;
  const conversionToActionPct = useMemo(() => {
    if (!rows.length) return 0;
    return Math.round((Object.keys(statuses).length / rows.length) * 100);
  }, [rows.length, statuses]);
  const escalationPressure = useMemo(() => {
    if (highRiskCount >= 12 || Number(report?.trend_no_show_rate?.['30d'] || 0) >= 18) return 'HIGH';
    if (highRiskCount > 0 || Number(report?.trend_no_show_rate?.['30d'] || 0) >= 10) return 'MED';
    if (rows.length > 0) return 'OK';
    return 'LOW';
  }, [highRiskCount, report?.trend_no_show_rate, rows.length]);
  const staleRiskRows = useMemo(
    () => rows.filter((row) => row.risk_level === 'high' && !statuses[row.owner_user_id]).length,
    [rows, statuses]
  );
  const topActions = useMemo(
    () => Object.entries(report?.actions_by_type || {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 4),
    [report?.actions_by_type],
  );
  const impactRows = useMemo(() => {
    return Object.entries(report?.action_impact || {}).sort((a, b) => {
      const scoreB = Number(b[1]?.priority_score || 0);
      const scoreA = Number(a[1]?.priority_score || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return Number(a[1]?.delta_no_show_rate_pct || 0) - Number(b[1]?.delta_no_show_rate_pct || 0);
    });
  }, [report?.action_impact]);

  const autoRunnerHealth = useMemo(() => {
    const h = autoRunnerStatus?.schedule_health;
    const map = {
      runner_disabled: { label: 'Nightly отключён в конфигурации API', cls: 'bg-border text-theme' },
      ok: { label: 'За сегодня (UTC) зафиксирован auto-batch в аудите', cls: 'status-tone-success' },
      before_window: { label: 'Окно nightly по UTC ещё не наступило', cls: 'bg-surface-highlight text-theme' },
      in_window: { label: 'Окно nightly (UTC): ожидаем запись в аудит', cls: 'status-tone-warning' },
      stale: { label: 'После окна нет аудита за сегодня — проверьте воркер API', cls: 'status-tone-critical' },
    };
    return map[h] || { label: h ? String(h) : '—', cls: 'bg-surface-muted text-theme' };
  }, [autoRunnerStatus?.schedule_health]);

  const sessionRole = getStoredSession()?.role || '';
  const canUseAutoRunner = sessionRole === 'clinic_admin' || sessionRole === 'network_admin';

  const exportJson = useCallback(() => {
    const payload = {
      exported_at: new Date().toISOString(),
      clinic_id: clinicId,
      risk_filter: riskFilter,
      owner_query: ownerQuery,
      rows: filteredRows,
      statuses,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lapka-no-show-operations-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [clinicId, riskFilter, ownerQuery, filteredRows, statuses]);

  const noShowHeroLoading = Boolean(clinicId) && loading;

  const exportCsv = useCallback(() => {
    const lines = [
      ['owner_user_id', 'appointments_total', 'no_show_count', 'no_show_rate', 'risk_level', 'last_action', 'last_action_at'].join(','),
      ...filteredRows.map((row) => {
        const st = statuses[row.owner_user_id] || {};
        return [
          row.owner_user_id,
          row.appointments_total,
          row.no_show_count,
          row.no_show_rate,
          row.risk_level,
          st.action || '',
          st.at || '',
        ].join(',');
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lapka-no-show-operations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [filteredRows, statuses]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-red-500/14 via-surface-muted to-amber-500/12 p-5 shadow-card md:p-8 dark:from-red-500/10">
        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">
              {noShowHeroLoading ? 'Загрузка рисков…' : 'Операции против no-show'}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">No-show: операционный контур</h1>
            <p className="mt-2 text-base font-bold text-theme">{selectedClinic?.name || 'Клиника'}</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
              {selectedBranch
                ? `${[selectedBranch.city, selectedBranch.address].filter(Boolean).join(' · ') || selectedBranch.address}`
                : 'Сегментация владельцев, отчёт за 90 дней и быстрые действия по каждому уровню риска.'}
            </p>
            {!clinicId ? (
              <p className="mt-3 text-sm font-semibold text-amber-700 dark:text-amber-300">Выберите клинику в шапке рабочего контура — тогда подтянутся риски и отчёты.</p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-xs text-text-muted">
                Cooldown (часы)
                <input
                  className="input !h-8 !w-20 !py-0 text-xs"
                  type="number"
                  min={1}
                  max={336}
                  value={batchCooldownHours}
                  onChange={(event) => setBatchCooldownHours(Number(event.target.value))}
                  disabled={noShowHeroLoading}
                />
              </label>
              <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!clinicId}>
                Export CSV
              </button>
              <button type="button" className="btn-secondary" onClick={exportJson} disabled={!clinicId}>
                Export JSON
              </button>
              <button type="button" className="btn-primary" onClick={load} disabled={!clinicId || noShowHeroLoading}>
                Обновить
              </button>
            </div>
            <div className="relative mt-4 flex flex-wrap gap-2">
              <Link href="/clinic/analytics" className="btn-secondary text-sm">
                Аналитика
              </Link>
              <Link href="/clinic/schedule" className="btn-secondary text-sm">
                Расписание
              </Link>
            </div>
          </div>
          {!clinicId ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {['High risk', 'Medium', 'Владельцев', 'Покрытие', 'Batch 14д', 'Авто-run'].map((label) => (
                <div key={label} className="rounded-2xl border border-dashed border-border bg-surface-muted/40 px-3 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{label}</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-theme-muted">—</p>
                </div>
              ))}
            </div>
          ) : noShowHeroLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'High risk', value: highRiskCount, warn: highRiskCount > 0, tone: 'text-rose-700 dark:text-rose-300' },
                { label: 'Medium', value: mediumRiskCount, tone: 'text-amber-700 dark:text-amber-300' },
                { label: 'Владельцев', value: rows.length, tone: '' },
                { label: 'Покрытие', value: report ? `${report.action_coverage_pct}%` : '—', tone: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'Batch 14д', value: report?.batch_outcomes?.recent_batches_14d ?? '—', tone: 'text-violet-700 dark:text-violet-300' },
                { label: 'Авто-run', value: autoRunnerStatus?.last_run ? 'OK' : '—', tone: 'text-sky-700 dark:text-sky-300' },
              ].map((cell) => (
                <div
                  key={cell.label}
                  className={`rounded-2xl border px-3 py-4 ${cell.warn ? 'border-rose-500/40 bg-rose-500/10' : 'border-border bg-surface/90 shadow-sm'}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums sm:text-3xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {!noShowHeroLoading && clinicId ? (
        <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">Сигналы анти no-show кампаний</h2>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
              no-show ops
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Давление эскалаций',
                value: escalationPressure,
                text: 'Сводный риск по high-сегменту и текущему no-show тренду за 30 дней.',
                href: '/clinic/analytics',
                tone: escalationPressure === 'HIGH'
                  ? 'text-rose-700 dark:text-rose-300'
                  : escalationPressure === 'MED'
                    ? 'text-amber-700 dark:text-amber-300'
                    : escalationPressure === 'OK'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-sky-700 dark:text-sky-300',
              },
              {
                title: 'Покрытие действиями',
                value: `${conversionToActionPct}%`,
                text: 'Доля владельцев риска, по которым уже зафиксировано хотя бы одно действие.',
                href: '/clinic/checkin',
                tone: 'text-violet-700 dark:text-violet-300',
              },
              {
                title: 'Без обработки (high)',
                value: staleRiskRows,
                text: 'High-risk владельцы без применённого шага, требующие ручного вмешательства.',
                href: '/clinic/inbox',
                tone: staleRiskRows > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-sky-700 dark:text-sky-300',
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
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">Открыть контур</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Card title="Operational report" subtitle="Агрегированный срез: распределение риска, покрытие действиями, топ-паттерны операций.">
        {report ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme">
              <p className="font-semibold text-theme">Распределение риска</p>
              <p className="mt-1">High: {report.high_risk}</p>
              <p>Medium: {report.medium_risk}</p>
              <p>Low: {report.low_risk}</p>
              <p className="mt-1 text-xs text-theme-muted">Период: {report.period_days} дней</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme">
              <p className="font-semibold text-theme">Топ действий</p>
              {topActions.length ? topActions.map(([key, value]) => (
                <p key={key} className="mt-1">{key}: {value}</p>
              )) : <p className="mt-1 text-theme-muted">Действия пока не применялись.</p>}
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme">
              <p className="font-semibold text-theme">No-show trend</p>
              <p className="mt-1">7д: {report.trend_no_show_rate?.['7d'] ?? 0}%</p>
              <p>30д: {report.trend_no_show_rate?.['30d'] ?? 0}%</p>
              <p>90д: {report.trend_no_show_rate?.['90d'] ?? 0}%</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme md:col-span-3">
              <p className="font-semibold text-theme">Рекомендации</p>
              {(report.recommendations || []).length ? (
                <div className="mt-2 space-y-1.5">
                  {(report.recommendations || []).map((item, idx) => (
                    <p key={`${idx}-${item}`}>• {item}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-theme-muted">Рекомендаций пока нет.</p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme md:col-span-3">
              <p className="font-semibold text-theme">Recommended next action this week</p>
              {(report.weekly_plan || []).length ? (
                <div className="mt-2 space-y-1.5">
                  {(report.weekly_plan || []).map((item, idx) => (
                    <p key={`${idx}-${item}`}>• {item}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-theme-muted">Недельный план будет доступен после расчета отчета.</p>
              )}
              {(report.weekly_actions || []).length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(report.weekly_actions || []).map((item, idx) => {
                    const key = `${item.segment}:${item.action}`;
                    return (
                      <div key={`${idx}-${item.title}-${key}`} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="btn-secondary !px-3 !py-1.5 text-xs"
                          onClick={() => previewBatchAction(item)}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="btn-primary !px-3 !py-1.5 text-xs"
                          onClick={() => applyBatchAction(item)}
                          disabled={batchBusyKey === key || !confirmTokens[key] || !previewTokens[key] || (previewExpiryTs[key] && previewExpiryTs[key] < ttlNow)}
                        >
                          {batchBusyKey === key ? 'Применяем...' : `${item.title} (${item.segment})`}
                        </button>
                        {previewExpiryTs[key] ? (
                          <span className="text-[11px] text-theme-muted">
                            TTL: {Math.max(0, Math.ceil((previewExpiryTs[key] - ttlNow) / 1000))}s
                          </span>
                        ) : null}
                        {previewTokens[key] ? (
                          <button
                            type="button"
                            className={`btn-secondary !px-2 !py-1 text-[11px] ${
                              previewStatuses[key] === 'valid'
                                ? 'preview-token-status-valid'
                                : previewStatuses[key] === 'expired'
                                  ? 'preview-token-status-expired'
                                  : previewStatuses[key] === 'used'
                                    ? 'preview-token-status-used'
                                    : ''
                            }`}
                            onClick={() => refreshPreviewStatus(key)}
                          >
                            Status: {previewStatuses[key] || 'check'}
                          </button>
                        ) : (
                          <span className="status-tone-critical rounded-full px-2 py-1 text-[11px]">
                            Нужен новый Preview
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {lastBatchId ? (
                <div className="mt-3 flex items-center gap-2">
                  <p className="text-xs text-theme-muted">Последний batch: {lastBatchId}</p>
                  <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={undoLastBatch}>
                    Undo (30m)
                  </button>
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme md:col-span-3">
              <p className="font-semibold text-theme">Batch audit feed</p>
              <p className="mt-1 text-xs text-theme-muted">
                14д: batches {report.batch_outcomes?.recent_batches_14d ?? 0} · owners {report.batch_outcomes?.recent_owners_14d ?? 0}
                {' · '}revert rate {report.batch_outcomes?.revert_rate_pct ?? 0}%
                {' · '}preview unused {report.batch_outcomes?.preview_unused_rate_pct ?? 0}%
              </p>
              <p className="mt-1 text-xs font-semibold text-theme">
                Batch quality score: {report.batch_quality_score ?? 0}
              </p>
              {(report.batch_quality_hints || []).length ? (
                <div className="mt-1 space-y-1">
                  {(report.batch_quality_hints || []).map((hint, idx) => (
                    <p key={`${idx}-${hint}`} className="text-xs text-theme-muted">• {hint}</p>
                  ))}
                </div>
              ) : null}
              {batchHistory.length ? (
                <div className="mt-2 space-y-1.5">
                  {batchHistory.slice(0, 8).map((row) => (
                    <p key={`${row.owner_user_id}-${row.created_at}-${row.action}`}>
                      {new Date(row.created_at).toLocaleString('ru-RU')} · {row.owner_user_id} · {row.action}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-theme-muted">Batch действий пока нет.</p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme md:col-span-3">
              <p className="font-semibold text-theme">Recent batch confirmations</p>
              {recentBatches.length ? (
                <div className="mt-2 space-y-1.5">
                  {recentBatches.slice(0, 8).map((row) => (
                    <p key={`${row.batch_id}-${row.created_at}`}>
                      {new Date(row.created_at).toLocaleString('ru-RU')} · {row.segment}/{row.action} · applied {row.applied} · reverted {row.reverted}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-theme-muted">Подтвержденных batch запусков пока нет.</p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme md:col-span-3">
              <p className="font-semibold text-theme">Эффективность мер (до/после)</p>
              {impactRows.length ? (
                <div className="mt-2 space-y-1.5">
                  {impactRows.map(([actionKey, values]) => (
                    <div key={actionKey} className="rounded-xl border border-border bg-surface-muted/50 px-3 py-2">
                      <p className="font-semibold text-theme">
                        {actionKey}
                        {' '}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                          values.confidence === 'high'
                            ? 'status-tone-success'
                            : values.confidence === 'medium'
                              ? 'status-tone-warning'
                              : 'bg-border text-theme'
                        }`}>
                          confidence: {values.confidence || 'low'}
                        </span>
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                          values.signal === 'reduced_no_show'
                            ? 'status-tone-success'
                            : values.signal === 'increased_no_show'
                              ? 'status-tone-critical'
                              : 'bg-border text-theme'
                        }`}>
                          {values.signal || 'neutral'}
                        </span>
                      </p>
                      <p className="mt-1">
                        {values.before_no_show_rate_pct}% → {values.after_no_show_rate_pct}% (Δ {values.delta_no_show_rate_pct}%)
                      </p>
                      <p className="text-xs text-theme-muted">
                        owners: {values.owners} · priority score: {values.priority_score || 0}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-theme-muted">Недостаточно истории для расчета эффекта.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-theme-muted">Отчет недоступен. Обновите страницу.</p>
        )}
      </Card>

      <Card
        title="Auto no-show campaign runner"
        subtitle="Ручной запуск nightly-пайплайна: dry-run для оценки и execute для применения действий с cooldown."
      >
        {!canUseAutoRunner ? (
          <p className="callout-warning mb-3 !text-xs">
            Ручной auto-run и мониторинг воркера доступны ролям clinic_admin и network_admin.
          </p>
        ) : null}
        {autoRunnerStatus ? (
          <div className="mb-4 space-y-2 rounded-xl border border-border bg-surface-muted/60 p-3 text-sm text-theme">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${autoRunnerHealth.cls}`}>
                {autoRunnerHealth.label}
              </span>
              <span className="text-xs text-theme-muted">
                UTC {autoRunnerStatus.utc_date} · окно воркера {String(autoRunnerStatus.scheduled_hour_utc).padStart(2, '0')}:00
                {autoRunnerStatus.runner_enabled ? '' : ' · runner выключен'}
              </span>
            </div>
            <p className="text-xs text-theme-muted">
              Дефолты воркера: период {autoRunnerStatus.default_days} дн., cooldown {autoRunnerStatus.default_cooldown_hours} ч., лимит {autoRunnerStatus.default_limit}.
            </p>
            {autoRunnerStatus.last_run_age_hours !== null && autoRunnerStatus.last_run_age_hours !== undefined ? (
              <p className="text-xs text-theme-muted">
                Давность последнего auto-run: {autoRunnerStatus.last_run_age_hours} ч.
                {' · '}
                пропущено дней: {autoRunnerStatus.missed_run_days ?? '—'}
              </p>
            ) : null}
            {Array.isArray(autoRunnerStatus.run_history_14d) && autoRunnerStatus.run_history_14d.length ? (
              <div className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2">
                <p className="text-xs font-semibold text-theme">
                  Последние 14 дней: пропуски подряд {Number(autoRunnerStatus.consecutive_missed_days || 0)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {autoRunnerStatus.run_history_14d.map((item) => (
                    <span
                      key={item.date}
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        item.ran ? 'status-tone-success' : 'status-tone-critical'
                      }`}
                      title={`${item.date} · batches ${Number(item.batches || 0)}`}
                    >
                      {item.date.slice(5)} {item.ran ? 'run' : 'miss'}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {autoRunnerStatus.last_run ? (
              <div className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-xs text-theme">
                <p className="font-semibold text-theme">Последний batch.auto в аудите</p>
                <p className="mt-1">
                  {new Date(autoRunnerStatus.last_run.created_at).toLocaleString('ru-RU')} · batch{' '}
                  <code className="text-[11px]">{autoRunnerStatus.last_run.batch_id}</code>
                </p>
                <p className="mt-1">
                  considered {autoRunnerStatus.last_run.considered} · applied {autoRunnerStatus.last_run.applied} · skipped cooldown {autoRunnerStatus.last_run.skipped_due_cooldown}
                </p>
                <p className="mt-1 text-theme-muted">
                  call_owner {Number(autoRunnerStatus.last_run.actions?.call_owner || 0)}, soft_reminder {Number(autoRunnerStatus.last_run.actions?.soft_reminder || 0)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-theme-muted">Записей analytics.no_show_risk.batch.auto для клиники пока нет.</p>
            )}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="label">Период (дней)</span>
            <input
              className="input"
              type="number"
              min={7}
              max={365}
              value={autoRunDays}
              onChange={(event) => setAutoRunDays(Number(event.target.value))}
            />
          </label>
          <label className="block">
            <span className="label">Cooldown (часы)</span>
            <input
              className="input"
              type="number"
              min={1}
              max={336}
              value={batchCooldownHours}
              onChange={(event) => setBatchCooldownHours(Number(event.target.value))}
            />
          </label>
          <label className="block">
            <span className="label">Лимит на клинику</span>
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              value={autoRunLimit}
              onChange={(event) => setAutoRunLimit(Number(event.target.value))}
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="btn-secondary w-full"
              disabled={autoRunBusy || !canUseAutoRunner}
              onClick={() => runAutoCampaign(true)}
            >
              {autoRunBusy ? '...' : 'Dry-run'}
            </button>
            <button
              type="button"
              className="btn-primary w-full"
              disabled={autoRunBusy || !canUseAutoRunner}
              onClick={() => runAutoCampaign(false)}
            >
              {autoRunBusy ? '...' : 'Execute'}
            </button>
          </div>
        </div>
        {autoRunResult ? (
          <div className="mt-3 rounded-xl border border-border bg-surface-muted/70 p-3 text-sm text-theme">
            <p className="font-semibold text-theme">
              Result: {autoRunResult.dry_run ? 'dry-run' : 'executed'} · batch {autoRunResult.batch_id}
            </p>
            <p className="mt-1">
              considered: {autoRunResult.considered} · applied: {autoRunResult.applied} · skipped by cooldown: {autoRunResult.skipped_due_cooldown}
            </p>
            <p className="mt-1 text-xs text-theme-muted">
              actions: call_owner {Number(autoRunResult.actions?.call_owner || 0)}, soft_reminder {Number(autoRunResult.actions?.soft_reminder || 0)}
            </p>
          </div>
        ) : null}
      </Card>

      <Card title="Очередь владельцев" subtitle="Действия пишутся в аудит и позволяют стандартизировать работу ресепшн/координаторов.">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select className="input !h-10 !w-[220px] !py-0" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
            <option value="all">Все риски</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            className="input !h-10 max-w-[280px]"
            value={ownerQuery}
            onChange={(event) => setOwnerQuery(event.target.value)}
            placeholder="Фильтр owner id..."
          />
        </div>
        {loading ? (
          <p className="text-sm text-theme-muted">Загрузка...</p>
        ) : filteredRows.length ? (
          <Table
            columns={['Owner', 'Визиты', 'No-show', 'Rate', 'Risk', 'Последнее действие', 'Actions']}
            rows={tableRows}
            paginated
            initialPageSize={10}
            searchable={false}
          />
        ) : (
          <EmptyState title="Рисков не найдено" text="Для выбранных фильтров нет владельцев с зафиксированными no-show." />
        )}
      </Card>
    </div>
  );
}

