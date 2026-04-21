'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/api';

export default function PlatformLostPetsHotspotOpsPage() {
  const { t, i18n } = useTranslation('common');
  const locale = i18n.resolvedLanguage === 'ru' ? 'ru-RU' : 'en-US';
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
      setError(requestError.message || t('platform.lostPetsHotspotOpsPage.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [days, t]);

  useEffect(() => {
    loadData(days);
  }, [days, loadData]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-cyan-500/14 via-surface-muted to-sky-500/12 p-5 shadow-card md:p-8">
        <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{t('platform.lostPetsHotspotOpsPage.eyebrow')}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">{t('platform.lostPetsHotspotOpsPage.title')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
              {t('platform.lostPetsHotspotOpsPage.subtitle')}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/platform/dashboard" className="btn-secondary">{t('platform.lostPetsHotspotOpsPage.linkBack')}</Link>
              <Link href="/platform/lost-pets-moderation" className="btn-secondary">{t('platform.lostPetsHotspotOpsPage.linkModeration')}</Link>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: t('platform.lostPetsHotspotOpsPage.kpiTotalNotifications'), value: summary?.total_hotspot_notifications ?? 0 },
                { label: t('platform.lostPetsHotspotOpsPage.kpiSuccessRate'), value: `${summary?.success_rate_percent ?? 0}%`, tone: 'text-emerald-700 dark:text-emerald-300' },
                { label: t('platform.lostPetsHotspotOpsPage.kpiInApp'), value: summary?.by_channel?.in_app ?? 0, tone: 'text-sky-700 dark:text-sky-300' },
                { label: t('platform.lostPetsHotspotOpsPage.kpiEmail'), value: summary?.by_channel?.email ?? 0, tone: 'text-violet-700 dark:text-violet-300' },
                { label: t('platform.lostPetsHotspotOpsPage.kpiSms'), value: summary?.by_channel?.sms ?? 0, tone: 'text-amber-700 dark:text-amber-300' },
                { label: t('platform.lostPetsHotspotOpsPage.kpiErrors'), value: summary?.errors?.length ?? 0, tone: 'text-rose-700 dark:text-rose-300' },
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

      <Card title={t('platform.lostPetsHotspotOpsPage.analysisWindowTitle')} subtitle={t('platform.lostPetsHotspotOpsPage.analysisWindowSubtitle')}>
        <div className="grid gap-3 md:grid-cols-[150px_auto] md:items-end">
          <label className="block">
            <span className="label">{t('platform.lostPetsHotspotOpsPage.daysLabel')}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(event) => setDays(Number(event.target.value || 14))}
            />
          </label>
          <button className="btn-primary" type="button" onClick={() => loadData(days)}>{t('platform.lostPetsHotspotOpsPage.refreshButton')}</button>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card title={t('platform.lostPetsHotspotOpsPage.deliveryStatusesTitle')} subtitle={t('platform.lostPetsHotspotOpsPage.deliveryStatusesSubtitle')}>
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

        <Card title={t('platform.lostPetsHotspotOpsPage.recommendationsTitle')} subtitle={t('platform.lostPetsHotspotOpsPage.recommendationsSubtitle')}>
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

      <Card title={t('platform.lostPetsHotspotOpsPage.deliveryErrorsTitle')} subtitle={t('platform.lostPetsHotspotOpsPage.deliveryErrorsSubtitle')}>
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
                <p className="mt-1 text-xs text-theme-muted">{new Date(row.created_at).toLocaleString(locale)} · {t('platform.lostPetsHotspotOpsPage.userLabel', { id: row.user_id })}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-theme-muted">{t('platform.lostPetsHotspotOpsPage.deliveryErrorsEmpty')}</p>
        )}
      </Card>
    </div>
  );
}
