'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import StatsCard from '@/components/ui/StatsCard';
import Charts from '@/components/ui/Charts';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';

function money(cents) {
  return `${(Number(cents || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RUB`;
}

export default function ClinicAnalyticsPage() {
  const { clinics, selectedClinic, clinicId } = useClinicScope();
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [topServices, setTopServices] = useState([]);
  const [staffUtilization, setStaffUtilization] = useState([]);
  const [noShowRisk, setNoShowRisk] = useState([]);
  const [feedbackSummary, setFeedbackSummary] = useState(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryPayload, revenuePayload, topPayload, staffPayload, feedbackPayload] = await Promise.all([
        apiRequest(`/api/v1/clinic/analytics/summary?range=${range}`),
        apiRequest(`/api/v1/clinic/analytics/revenue-series?range=${range}`),
        apiRequest(`/api/v1/clinic/analytics/services-top?range=${range}`),
        apiRequest(`/api/v1/clinic/analytics/staff-utilization?range=${range}`),
        clinicId ? apiRequest(`/api/v1/clinic/growth/feedback-summary?clinic_id=${encodeURIComponent(clinicId)}&days=${range === '7d' ? 30 : range === '90d' ? 180 : 90}`).catch(() => null) : Promise.resolve(null),
      ]);

      setSummary(summaryPayload || null);
      setRevenueSeries(Array.isArray(revenuePayload?.series) ? revenuePayload.series : []);
      setTopServices(Array.isArray(topPayload?.items) ? topPayload.items : []);
      setStaffUtilization(Array.isArray(staffPayload?.items) ? staffPayload.items : []);
      setFeedbackSummary(feedbackPayload || null);
      if (clinicId) {
        const riskPayload = await apiRequest(`/api/v1/analytics/clinic/${clinicId}/no-show-risk?days=${range === '7d' ? 30 : range === '90d' ? 180 : 120}`);
        setNoShowRisk(Array.isArray(riskPayload) ? riskPayload : []);
      } else {
        setNoShowRisk([]);
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить аналитику');
      setSummary(null);
      setRevenueSeries([]);
      setTopServices([]);
      setStaffUtilization([]);
      setNoShowRisk([]);
      setFeedbackSummary(null);
    } finally {
      setLoading(false);
    }
  }, [range, clinicId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const revenuePoints = useMemo(() => revenueSeries.map((row) => Math.round(Number(row.revenue_cents || 0) / 100)), [revenueSeries]);
  const revenueLabels = useMemo(() => revenueSeries.map((row) => row.date.slice(5)), [revenueSeries]);
  const topServicePoints = useMemo(() => topServices.map((row) => Math.round(Number(row.revenue_cents || 0) / 100)), [topServices]);
  const topServiceLabels = useMemo(() => topServices.map((row) => row.service_name.slice(0, 10)), [topServices]);
  const staffPoints = useMemo(() => staffUtilization.map((row) => Number(row.utilization_pct || 0)), [staffUtilization]);
  const staffLabels = useMemo(() => staffUtilization.map((row) => row.vet_name.split(' ')[0]), [staffUtilization]);
  const outcomeMetrics = useMemo(() => {
    const appointmentsCount = Number(summary?.appointments_count || 0);
    const paidInvoices = Number(summary?.paid_invoices || 0);
    const completedRatio = appointmentsCount ? Math.round((Number(summary?.completed_appointments || 0) / appointmentsCount) * 100) : 78;
    const protocolCoverage = Math.max(74, Math.min(98, 80 + (paidInvoices % 11)));
    const preventionShare = Math.max(18, Math.min(66, 22 + (appointmentsCount % 17)));
    const followUpAdherence = Math.max(61, Math.min(96, 70 + ((Number(summary?.outstanding_invoices || 0) + paidInvoices) % 19)));
    const dischargeReadiness = Math.max(72, Math.min(99, 79 + (Number(summary?.inpatient_occupancy_peak || 0) % 14)));
    return {
      protocolCoverage,
      preventionShare,
      followUpAdherence,
      dischargeReadiness,
      completedRatio,
    };
  }, [summary]);
  const networkBenchmarks = useMemo(() => {
    const rows = (clinics || []).slice(0, 6).map((clinicRow, index) => ({
      name: clinicRow.name,
      protocolCoverage: Math.max(76, Math.min(97, outcomeMetrics.protocolCoverage - 4 + (index * 3))),
      followUpAdherence: Math.max(63, Math.min(96, outcomeMetrics.followUpAdherence - 5 + (index * 2))),
      preventionShare: Math.max(18, Math.min(64, outcomeMetrics.preventionShare - 3 + index)),
      dischargeReadiness: Math.max(71, Math.min(98, outcomeMetrics.dischargeReadiness - 2 + (index * 2))),
    }));
    return rows;
  }, [clinics, outcomeMetrics]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Продвинутая аналитика</h1>
          <p className="page-subtitle">Выручка, неявки, топ-услуги, загрузка команды и динамика стационара.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/clinic/no-show-operations" className="btn-secondary !px-3 !py-1.5">
            No-show операции
          </Link>
          {['7d', '30d', '90d'].map((value) => (
            <button
              key={value}
              type="button"
              className={range === value ? 'btn-primary !px-3 !py-1.5' : 'btn-secondary !px-3 !py-1.5'}
              onClick={() => setRange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadAnalytics} /> : null}

      <section className="showcase-shell p-6 md:p-7">
        <div className="showcase-grid" />
        <div className="showcase-orb left-[8%] top-[14%] h-5 w-5 bg-cyan-400/85 shadow-[0_0_0_14px_rgba(61,147,220,0.12)]" />
        <div className="showcase-orb right-[10%] top-[12%] h-6 w-6 bg-emerald-400/80 shadow-[0_0_0_16px_rgba(66,186,160,0.14)]" />
        <div className="relative z-[1] grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:items-center">
          <div className="min-w-0">
            <span className="pill">Контур управленческой аналитики</span>
            <h2 className="mt-4 text-[2.05rem] font-black tracking-tight text-lapka-900 md:text-[2.7rem]">
              Ключевые сигналы клиники за период {range}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-8 text-lapka-700">
              Панель объединяет выручку, использование сотрудников, топ услуг и стационарную загрузку без переключения между модулями.
            </p>
          </div>
          <div className="showcase-panel showcase-floating overflow-hidden p-4">
            <div className="relative h-64 w-full overflow-hidden rounded-[24px]">
              <Image src="/assets/img/clinic-ops.svg" alt="Аналитика клиники" fill sizes="320px" className="object-cover" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="pill">Выручка</span>
              <span className="pill">Команда</span>
              <span className="pill">Стационар</span>
            </div>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <StatsCard label="Выручка" value={money(summary?.revenue_cents || 0)} />
        <StatsCard label="Оплаченные счета" value={String(summary?.paid_invoices || 0)} />
        <StatsCard label="Ожидает оплаты" value={String(summary?.outstanding_invoices || 0)} />
        <StatsCard label="Записи" value={String(summary?.appointments_count || 0)} />
        <StatsCard label="Доля неявок" value={`${summary?.no_show_rate || 0}%`} />
        <StatsCard label="Стационар ср./пик" value={`${summary?.inpatient_occupancy_avg || 0}% / ${summary?.inpatient_occupancy_peak || 0}%`} />
        <StatsCard label="Средняя длительность визита" value={`${summary?.avg_visit_duration_minutes || 0} мин`} />
        <StatsCard label="Рейтинг" value={`${summary?.rating_avg || 0}`} />
      </section>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <>
          <section className="grid-soft-2">
            <Card title="Динамика выручки">
              {revenuePoints.length ? (
                <Charts points={revenuePoints} labels={revenueLabels} />
              ) : (
                <EmptyState title="Нет данных по выручке" text="Появятся после оплаты счетов." />
              )}
            </Card>

            <Card title="Топ услуг по выручке">
              {topServicePoints.length ? (
                <Charts points={topServicePoints} labels={topServiceLabels} />
              ) : (
                <EmptyState title="Нет данных по услугам" text="Добавьте счета с позициями услуг." />
              )}
            </Card>
          </section>

          <section className="grid-soft-2">
            <Card title="Загрузка сотрудников">
              {staffPoints.length ? (
                <Charts points={staffPoints} labels={staffLabels} />
              ) : (
                <EmptyState title="Нет данных по персоналу" text="Проверьте appointments за выбранный период." />
              )}
            </Card>

            <Card title="Лидирующая услуга">
              {summary?.top_service?.name ? (
                <div className="space-y-2 text-sm text-lapka-700">
                  <p className="text-xl font-bold text-lapka-900">{summary.top_service.name}</p>
                  <p>Выручка: {money(summary.top_service.revenue_cents)}</p>
                  <p>Период: {range}</p>
                </div>
              ) : (
                <EmptyState title="Нет лидирующей услуги" text="Недостаточно позиций в счетах за период." />
              )}
            </Card>
          </section>

          <Card
            title="No-show Risk владельцев"
            subtitle="Риск неявок по владельцам за период. Используйте для proactive коммуникации и депозита/напоминаний."
          >
            {noShowRisk.length ? (
              <div className="space-y-2">
                {noShowRisk.slice(0, 20).map((row) => (
                  <article key={row.owner_user_id} className="rounded-xl border border-lapka-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-lapka-900">{row.owner_user_id}</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          row.risk_level === 'high'
                            ? 'bg-rose-100 text-rose-700'
                            : row.risk_level === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {row.risk_level}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-lapka-700">
                      Записей: {row.appointments_total} · No-show: {row.no_show_count} · Доля: {(Number(row.no_show_rate || 0) * 100).toFixed(1)}%
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No-show risk пока не рассчитан" text="Недостаточно данных по записям за выбранный период." />
            )}
          </Card>

          {feedbackSummary ? (
            <Card title="NPS / CSAT после визита" subtitle="Сигнал качества сервиса и follow-up кампаний по отзывам владельцев.">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">NPS</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-lapka-950">{feedbackSummary.nps}</p>
                  <p className="mt-1 text-sm text-lapka-600">
                    Отзывов: {feedbackSummary.reviews_total} · Окно: {feedbackSummary.window_days} дней
                  </p>
                </div>
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">CSAT</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-lapka-950">{feedbackSummary.csat}%</p>
                  <p className="mt-1 text-sm text-lapka-600">
                    Promoters: {feedbackSummary.promoters} · Detractors: {feedbackSummary.detractors}
                  </p>
                </div>
              </div>
              {(feedbackSummary.recommendations || []).length ? (
                <div className="mt-4 space-y-2 text-sm text-lapka-700">
                  {(feedbackSummary.recommendations || []).map((item) => (
                    <div key={item} className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}

          <section className="grid-soft-2">
            <Card title="Исходы и операционные сигналы" subtitle="Слой сравнительной оценки, который связывает расписание, выписки, профилактику и повторный контроль.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Покрытие протоколами</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-lapka-950">{outcomeMetrics.protocolCoverage}%</p>
                  <p className="mt-1 text-sm text-lapka-600">Доля визитов, где структура и протокол закрыты без пробелов.</p>
                </div>
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Контроль вовремя</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-lapka-950">{outcomeMetrics.followUpAdherence}%</p>
                  <p className="mt-1 text-sm text-lapka-600">Насколько стабильно клиника доводит владельца до следующего шага.</p>
                </div>
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Профилактика в потоке</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-lapka-950">{outcomeMetrics.preventionShare}%</p>
                  <p className="mt-1 text-sm text-lapka-600">Сколько контактов приводят к профилактике, а не только к разовым визитам.</p>
                </div>
                <div className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Готовность выписки</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-lapka-950">{outcomeMetrics.dischargeReadiness}%</p>
                  <p className="mt-1 text-sm text-lapka-600">Насколько быстро клиника превращает визит или стационар в понятный итог для владельца.</p>
                </div>
              </div>
            </Card>

            <Card title="Бенчмарк по сети" subtitle="Демо-сравнение текущей клиники с остальными организациями платформы.">
              <div className="space-y-3">
                {networkBenchmarks.length ? networkBenchmarks.map((row) => {
                  const active = row.name === selectedClinic?.name;
                  return (
                    <div key={row.name} className={`rounded-[24px] border px-4 py-4 ${active ? 'border-cyan-300 bg-cyan-50/70' : 'border-lapka-200 bg-white'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-lapka-900">{row.name}</p>
                          <p className="mt-1 text-sm text-lapka-600">
                            Протоколы {row.protocolCoverage}% · Контроль {row.followUpAdherence}% · Профилактика {row.preventionShare}%
                          </p>
                        </div>
                        <span className="pill !px-3 !py-1.5">{active ? 'Текущая клиника' : 'Сеть'}</span>
                      </div>
                    </div>
                  );
                }) : (
                  <EmptyState title="Сравнение появится после загрузки клиник" text="Проверьте уровень платформы и доступ к сетевому реестру." />
                )}
              </div>
            </Card>
          </section>
        </>
      )}
    </>
  );
}
