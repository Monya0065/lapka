'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function OwnerPrivacyPackPage() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/v1/owner/privacy-pack');
      setPayload(data || null);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить privacy pack');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const auditRows = useMemo(() => {
    const rows = Array.isArray(payload?.audit_trail) ? payload.audit_trail : [];
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? rows
      : rows.filter((row) => `${row.action || ''} ${row.target_type || ''} ${row.target_id || ''}`.toLowerCase().includes(q));
    return filtered.map((row) => [row.created_at ? new Date(row.created_at).toLocaleString('ru-RU') : '—', row.action || '—', row.target_type || '—', row.target_id || '—']);
  }, [payload?.audit_trail, query]);
  const privacyPressure = useMemo(() => {
    if (!payload) return 'LOW';
    const sessionsCount = (payload.sessions || []).length;
    const auditCount = (payload.audit_trail || []).length;
    if (sessionsCount >= 8 || auditCount >= 120) return 'HIGH';
    if (sessionsCount > 0 || auditCount >= 40) return 'MED';
    return 'OK';
  }, [payload]);
  const complianceCoverage = useMemo(() => {
    if (!payload) return 0;
    const checks = [
      (payload.pets || []).length > 0,
      (payload.documents || []).length > 0,
      (payload.consents || []).length > 0,
      (payload.legal_acceptances || []).length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [payload]);
  const auditReadiness = useMemo(() => {
    if (!payload) return 0;
    const auditCount = (payload.audit_trail || []).length;
    return Math.min(100, auditCount >= 80 ? 100 : Math.round((auditCount / 80) * 100));
  }, [payload]);

  return (
    <div className="space-y-6">
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {loading ? (
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-400/10 via-surface-muted to-violet-400/12 p-5 shadow-card md:p-8 dark:from-slate-500/10 dark:to-violet-500/10">
          <div className="relative space-y-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Privacy Pack</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">Пакет персональных данных</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
                Сущности, согласия, сессии и журнал доступа — готовим сводку для выгрузки.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Skeleton className="h-10 w-28 rounded-xl" />
                <Skeleton className="h-10 w-36 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        </section>
      ) : !payload ? (
        <EmptyState title="Нет данных" text="Не удалось сформировать privacy pack." />
      ) : (
        <>
          <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-400/10 via-surface-muted to-violet-400/12 p-5 shadow-card md:p-8 dark:from-slate-500/10 dark:to-violet-500/10">
            <div className="relative space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Privacy Pack</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">Ваши данные в Lapka</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
                    Полный пакет персональных данных владельца: сущности, согласия, сессии и журнал доступа. Сводные объёмы — перед
                    выгрузкой JSON и детальным журналом ниже.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={load}>
                    Обновить
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => downloadJson(`lapka-privacy-pack-${new Date().toISOString().slice(0, 10)}.json`, payload)}
                  >
                    Скачать JSON
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: 'Питомцы', value: (payload.pets || []).length },
                  { label: 'Документы', value: (payload.documents || []).length },
                  { label: 'Согласия', value: (payload.consents || []).length },
                  { label: 'Сессии', value: (payload.sessions || []).length },
                  { label: 'Юр. акцепты', value: (payload.legal_acceptances || []).length },
                  { label: 'Audit', value: (payload.audit_trail || []).length },
                ].map((cell) => (
                  <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-theme sm:text-3xl">{cell.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">Сигналы privacy-контура</h2>
              </div>
              <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
                privacy ops
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'Давление приватности',
                  value: privacyPressure,
                  text: 'Сигнал по плотности сессий и активности в audit trail для owner-профиля.',
                  href: '/owner/security',
                  tone: privacyPressure === 'HIGH'
                    ? 'text-rose-700 dark:text-rose-300'
                    : privacyPressure === 'MED'
                      ? 'text-amber-700 dark:text-amber-300'
                      : privacyPressure === 'OK'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-sky-700 dark:text-sky-300',
                },
                {
                  title: 'Покрытие комплаенса',
                  value: `${complianceCoverage}%`,
                  text: 'Насколько полно собраны ключевые сущности privacy pack для выгрузки.',
                  href: '/owner/legal',
                  tone: 'text-violet-700 dark:text-violet-300',
                },
                {
                  title: 'Готовность аудита',
                  value: `${auditReadiness}%`,
                  text: 'Степень заполненности owner-safe журнала для проверки и контроля доступа.',
                  href: '/owner/profile',
                  tone: 'text-sky-700 dark:text-sky-300',
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

          <Card title="Журнал действий" subtitle="Поиск по action/target, owner-safe представление.">
            <div className="mb-3">
              <input
                className="input max-w-[360px]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по журналу..."
              />
            </div>
            <Table
              columns={['Время', 'Action', 'Target type', 'Target id']}
              rows={auditRows}
              paginated
              initialPageSize={12}
              emptyTitle="Событий не найдено"
              emptyText="Попробуйте изменить фильтр или обновить пакет."
            />
          </Card>
        </>
      )}
    </div>
  );
}

