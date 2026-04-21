'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';

const ACK_STORAGE_KEY = 'lapka.legal-ack.v2';

function readAck() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAck(value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(value));
}

export default function LegalCenterPage({
  title,
  subtitle,
  eyebrow = 'Безопасность и право',
  headerActions = null,
  operationalCards = [],
  operationalTitle = 'Операционный срез юридического контура',
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [savingDoc, setSavingDoc] = useState('');
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [ack, setAck] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [metaPayload, acceptancePayload] = await Promise.all([
          apiRequest('/api/v1/legal/meta', { auth: false }),
          apiRequest('/api/v1/legal/acceptances'),
        ]);

        if (!cancelled) {
          setMeta(metaPayload || null);
          const serverAck = Object.fromEntries(
            (acceptancePayload || []).map((row) => [
              row.document_type,
              { version: row.version, accepted_at: row.accepted_at },
            ]),
          );
          const merged = { ...readAck(), ...serverAck };
          setAck(merged);
          writeAck(merged);
        }
      } catch (requestError) {
        if (!cancelled) {
          setMeta(null);
          setError(requestError.message || 'Не удалось загрузить юридические данные');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (!meta) return [];
    return [
      { id: 'privacy', title: 'Политика конфиденциальности', version: meta.privacy_policy_version, href: '/privacy' },
      { id: 'terms', title: 'Пользовательское соглашение', version: meta.terms_version, href: '/terms' },
      { id: 'consent', title: 'Согласие на обработку данных', version: meta.consent_version, href: '/security' },
      { id: 'dpa', title: 'Соглашение об обработке данных (DPA)', version: meta.dpa_version, href: '/security' },
    ];
  }, [meta]);

  const missingFromQuery = useMemo(() => {
    const raw = searchParams?.get('missing') || '';
    if (!raw) return [];
    return raw
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }, [searchParams]);

  const requiredRedirect = searchParams?.get('required') === '1';
  const nextFromQuery = searchParams?.get('next') || '';
  const progress = useMemo(() => {
    const total = rows.length;
    const accepted = rows.filter((row) => ack?.[row.id]?.version === row.version).length;
    return { accepted, total };
  }, [ack, rows]);

  const safeNextPath = useMemo(() => {
    if (!nextFromQuery || typeof nextFromQuery !== 'string') return '';
    if (!nextFromQuery.startsWith('/')) return '';
    if (nextFromQuery.startsWith('//')) return '';
    return nextFromQuery;
  }, [nextFromQuery]);

  useEffect(() => {
    if (!requiredRedirect) return;
    if (!safeNextPath) return;
    if (!progress.total) return;
    if (progress.accepted < progress.total) return;
    const t = setTimeout(() => {
      router.replace(safeNextPath);
    }, 350);
    return () => clearTimeout(t);
  }, [progress.accepted, progress.total, requiredRedirect, router, safeNextPath]);

  async function toggleAck(id, version, checked) {
    if (!checked) return;
    setSavingDoc(id);
    setError('');
    try {
      const accepted = await apiRequest('/api/v1/legal/acceptances', {
        method: 'POST',
        body: { document_type: id, version },
      });
      const next = {
        ...ack,
        [id]: { version: accepted.version, accepted_at: accepted.accepted_at },
      };
      setAck(next);
      writeAck(next);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось сохранить подтверждение');
    } finally {
      setSavingDoc('');
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-400/12 via-surface-muted to-amber-400/14 p-6 shadow-card md:p-8 dark:from-slate-500/10 dark:to-amber-600/10">
        <div className="relative grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <p className="page-header-eyebrow !mb-2 !mt-0">{eyebrow}</p>
            <h1 className="text-3xl font-black tracking-tight text-theme md:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-theme-muted">{subtitle}</p>
            {headerActions ? <div className="mt-5 flex flex-wrap items-center gap-2">{headerActions}</div> : null}
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : meta ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Подтверждено', value: progress.accepted, tone: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'Осталось', value: Math.max(0, progress.total - progress.accepted), tone: Math.max(0, progress.total - progress.accepted) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300' },
                { label: 'Документов', value: progress.total, tone: 'text-sky-700 dark:text-sky-300' },
                {
                  label: 'Политика',
                  value: meta.privacy_policy_version != null ? `v${meta.privacy_policy_version}` : '—',
                  tone: 'text-violet-700 dark:text-violet-300',
                },
                { label: 'Terms', value: meta.terms_version != null ? `v${meta.terms_version}` : '—', tone: 'text-theme' },
                { label: 'DPA', value: meta.dpa_version != null ? `v${meta.dpa_version}` : '—', tone: 'text-rose-700 dark:text-rose-300' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-xl font-black tabular-nums sm:text-2xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {error ? <ErrorBanner message={error} onRetry={() => window.location.reload()} /> : null}

      {loading ? (
        <section className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </section>
      ) : !meta ? (
        <EmptyState title="Юридические данные недоступны" text="Попробуйте обновить страницу позже." />
      ) : (
        <>
          {operationalCards.length ? (
            <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">{operationalTitle}</h2>
                </div>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
                  legal ops
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {operationalCards.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="rounded-2xl border border-border bg-surface/85 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    <p className={`text-base font-black ${item.tone || 'text-theme'}`}>{item.title}</p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-theme">{item.value}</p>
                    <p className="mt-2 text-sm leading-relaxed text-theme">{item.text}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">Открыть контур</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {requiredRedirect ? (
            <Card title="Требуется подтверждение документов">
              <p className="text-sm text-theme-muted">
                Для продолжения работы подтвердите актуальные версии документов.
              </p>
              {safeNextPath && progress.total > 0 && progress.accepted >= progress.total ? (
                <p className="mt-2 text-xs text-success">Все документы подтверждены. Возвращаем вас на предыдущий экран...</p>
              ) : null}
              {missingFromQuery.length ? (
                <p className="mt-2 text-xs text-warning">
                  Не подтверждено: {missingFromQuery.join(', ')}
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card title="Статус подтверждений">
            <p className="text-sm text-theme">
              Подтверждено {progress.accepted} из {progress.total} документов.
            </p>
            <div className="mt-3 h-2 w-full rounded-full bg-surface-muted">
              <div
                className="h-2 rounded-full bg-lapka-gradient transition-all"
                style={{ width: `${progress.total ? Math.round((progress.accepted / progress.total) * 100) : 0}%` }}
              />
            </div>
          </Card>

          <Card title="Контакт по вопросам приватности">
            <p className="text-sm text-theme">
              По вопросам персональных данных и удалению информации:{' '}
              <span className="font-semibold">{meta.privacy_contact_email}</span>
            </p>
          </Card>

          <section className="grid gap-3">
            {[...rows]
              .sort((a, b) => {
                const aMissing = missingFromQuery.includes(a.id) ? 1 : 0;
                const bMissing = missingFromQuery.includes(b.id) ? 1 : 0;
                return bMissing - aMissing;
              })
              .map((row) => {
              const accepted = ack?.[row.id];
              const isCurrent = accepted?.version === row.version;
              return (
                <Card key={row.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-theme">{row.title}</p>
                      <p className="text-sm text-theme-muted">Версия: {row.version}</p>
                      {isCurrent ? (
                        <p className="mt-1 text-xs text-success">
                          Ознакомлено: {new Date(accepted.accepted_at).toLocaleString('ru-RU')}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-warning">Требуется подтверждение текущей версии</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <a href={row.href} className="btn-secondary !min-h-[40px] !px-4 !py-2 text-sm">
                        Открыть документ
                      </a>
                      <label className="inline-flex items-center gap-2 text-sm text-theme">
                        <input
                          type="checkbox"
                          checked={Boolean(isCurrent)}
                          disabled={savingDoc === row.id}
                          onChange={(event) => toggleAck(row.id, row.version, event.target.checked)}
                        />
                        Ознакомлен
                      </label>
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
