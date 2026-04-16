'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';

export default function PlatformLostPetsHotspotOpsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(14);
  const [summary, setSummary] = useState(null);

  const loadData = useCallback(async (windowDays = days) => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest(`/api/v1/admin/lost-pets/hotspots/delivery-summary?days=${encodeURIComponent(windowDays)}`);
      setSummary(payload || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить delivery analytics по hotspot');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadData(days);
  }, [days, loadData]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-cyan-500/14 via-surface-muted to-sky-500/12 p-5 shadow-card md:p-8">
        <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Hotspot delivery ops</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">Качество доставки hotspot-уведомлений</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
              Канальные метрики (in-app/email/SMS), ошибки доставки, quality signals и рекомендации для операционного контура.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/platform/dashboard" className="btn-secondary">Назад в обзор</Link>
              <Link href="/platform/lost-pets-moderation" className="btn-secondary">Модерация потеряшек</Link>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Всего уведомлений', value: summary?.total_hotspot_notifications ?? 0 },
                { label: 'Success rate', value: `${summary?.success_rate_percent ?? 0}%`, tone: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'In-app', value: summary?.by_channel?.in_app ?? 0, tone: 'text-sky-700 dark:text-sky-300' },
                { label: 'Email', value: summary?.by_channel?.email ?? 0, tone: 'text-violet-700 dark:text-violet-300' },
                { label: 'SMS', value: summary?.by_channel?.sms ?? 0, tone: 'text-amber-700 dark:text-amber-300' },
                { label: 'Ошибок', value: summary?.errors?.length ?? 0, tone: 'text-rose-700 dark:text-rose-300' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {error ? <ErrorBanner message={error} onRetry={() => loadData(days)} /> : null}

      <Card title="Окно анализа" subtitle="Период выборки метрик">
        <div className="grid gap-3 md:grid-cols-[150px_auto] md:items-end">
          <label className="block">
            <span className="label">Дней</span>
            <input
              className="input"
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(event) => setDays(Number(event.target.value || 14))}
            />
          </label>
          <button className="btn-primary" type="button" onClick={() => loadData(days)}>Обновить метрики</button>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card title="Статусы доставки" subtitle="Сводка sent/error/no_recipient/audit_only">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(summary?.by_delivery_status || {}).map(([status, count]) => (
                <div key={status} className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-sm">
                  <span className="font-semibold text-theme">{status}</span>: <span className="tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Операционные рекомендации" subtitle="Что исправить в контурах доставки">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <ul className="space-y-2 text-sm text-theme">
              {(summary?.recommendations || []).map((item) => (
                <li key={item} className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2">{item}</li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card title="Ошибки доставки (top 100)" subtitle="Последние инциденты по hotspot-уведомлениям">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : summary?.errors?.length ? (
          <div className="max-h-[420px] space-y-2 overflow-auto">
            {summary.errors.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border bg-surface-muted/70 px-3 py-2 text-sm">
                <p className="font-semibold text-theme">{row.channel} · {row.status}</p>
                <p className="mt-1 text-xs text-theme-muted">{new Date(row.created_at).toLocaleString('ru-RU')} · user {row.user_id}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-theme-muted">Ошибок доставки за выбранный период нет.</p>
        )}
      </Card>
    </div>
  );
}
