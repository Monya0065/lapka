'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';

export default function PlatformLostPetsModerationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [queue, setQueue] = useState([]);
  const [abuseReports, setAbuseReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [moderationReason, setModerationReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [queuePayload, abusePayload] = await Promise.all([
        apiRequest(`/api/v1/admin/lost-pets/moderation/queue?moderation_status=${encodeURIComponent(statusFilter)}`),
        apiRequest('/api/v1/admin/lost-pets/abuse-reports?status=open'),
      ]);
      setQueue(Array.isArray(queuePayload) ? queuePayload : []);
      setAbuseReports(Array.isArray(abusePayload) ? abusePayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить модерацию потеряшек');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function moderateReport(reportId, moderationStatus) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/admin/lost-pets/${reportId}/moderate`, {
        method: 'POST',
        body: {
          moderation_status: moderationStatus,
          moderation_reason: moderationReason || null,
        },
      });
      setSuccess(`Объявление ${moderationStatus}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обновить статус модерации');
    } finally {
      setSaving(false);
    }
  }

  async function resolveAbuseReport(reportId, status) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/admin/lost-pets/abuse-reports/${reportId}/resolve`, {
        method: 'POST',
        body: {
          status,
          resolution_note: moderationReason || null,
        },
      });
      setSuccess(`Жалоба ${status}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обновить жалобу');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-rose-500/14 via-surface-muted to-red-500/12 p-5 shadow-card md:p-8">
        <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Trust & Safety</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">Модерация потеряшек</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
              Очередь рискованных объявлений, жалобы пользователей и быстрые решения модератора в одном операционном контуре.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/platform/dashboard" className="btn-secondary">Назад в обзор</Link>
              <Link href="/platform/lost-pets-ads" className="btn-secondary">Бюджет рекламы</Link>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'В очереди', value: queue.length },
                { label: 'Открытых жалоб', value: abuseReports.length, tone: 'text-rose-700 dark:text-rose-300' },
                { label: 'Фильтр', value: statusFilter, tone: 'text-sky-700 dark:text-sky-300' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-xl font-black tabular-nums ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}
      {success ? <div className="callout-success">{success}</div> : null}

      <Card title="Управление очередью" subtitle="Фильтр и единый комментарий для решений">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="label">Статус очереди</span>
            <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="blocked">blocked</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Комментарий модератора</span>
            <input className="input" value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} />
          </label>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card title="Очередь объявлений" subtitle="Рискованные и спорные карточки">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : queue.length ? (
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {queue.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-surface-muted/70 px-3 py-2 text-sm">
                  <p className="font-semibold text-theme">{item.pet_name} · {item.city}</p>
                  <p className="mt-1 text-xs text-theme-muted">risk: {item.risk_score || 0} · moderation: {item.moderation_status}</p>
                  <p className="mt-1 text-xs text-theme">{item.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="btn-secondary !px-2 !py-1 text-xs" disabled={saving} onClick={() => moderateReport(item.id, 'approved')}>approve</button>
                    <button className="btn-secondary !px-2 !py-1 text-xs" disabled={saving} onClick={() => moderateReport(item.id, 'rejected')}>reject</button>
                    <button className="btn-secondary !px-2 !py-1 text-xs" disabled={saving} onClick={() => moderateReport(item.id, 'blocked')}>block</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-theme-muted">Очередь пуста.</p>
          )}
        </Card>

        <Card title="Жалобы пользователей" subtitle="Открытые abuse reports по объявлениям">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : abuseReports.length ? (
            <div className="max-h-[420px] space-y-2 overflow-auto">
              {abuseReports.map((row) => (
                <div key={row.id} className="rounded-2xl border border-border bg-surface-muted/70 px-3 py-2 text-sm">
                  <p className="font-semibold text-theme">{row.reason} · report {row.report_id}</p>
                  <p className="mt-1 text-xs text-theme-muted">{row.message || 'Без комментария'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="btn-secondary !px-2 !py-1 text-xs" disabled={saving} onClick={() => resolveAbuseReport(row.id, 'resolved')}>resolve</button>
                    <button className="btn-secondary !px-2 !py-1 text-xs" disabled={saving} onClick={() => resolveAbuseReport(row.id, 'rejected')}>reject complaint</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-theme-muted">Открытых жалоб нет.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
