'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';
import { formatDateTimeLabel } from '@/lib/owner-workspace';

export default function OwnerVisitDetailPage() {
  const params = useParams();
  const visitId = useMemo(() => String(params?.id || ''), [params]);
  const [visit, setVisit] = useState(null);
  const [petName, setPetName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!visitId) return;
    setLoading(true);
    setError('');
    try {
      const [visitPayload, petsPayload] = await Promise.all([
        apiRequest(`/api/v1/visits/${encodeURIComponent(visitId)}`),
        apiRequest('/api/v1/pets'),
      ]);
      setVisit(visitPayload && typeof visitPayload === 'object' ? visitPayload : null);
      const pets = Array.isArray(petsPayload) ? petsPayload : [];
      const pid = visitPayload?.pet_id;
      const pet = pets.find((p) => p.id === pid);
      setPetName(pet?.name || '');
    } catch (e) {
      setError(e.message || 'Не удалось загрузить визит');
      setVisit(null);
      setPetName('');
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = useMemo(() => {
    if (!visit) return '';
    if (visit.finalized_flag || visit.status === 'completed') return 'Завершён';
    return visit.status || 'В работе';
  }, [visit]);

  const nextSteps = useMemo(() => {
    if (!visit) return [];
    const steps = [];
    if (visit.follow_up_note) steps.push(visit.follow_up_note);
    if (visit.owner_summary) steps.push('Сверяйтесь с кратким резюме и задайте вопросы врачу на контроле.');
    if (!steps.length) {
      steps.push('Если состояние ухудшается, свяжитесь с клиникой и не откладывайте повторный визит.');
    }
    return steps.slice(0, 3);
  }, [visit]);
  const visitPressure = useMemo(() => {
    if (!visit) return 'LOW';
    if (['cancelled', 'no_show'].includes(String(visit.status || '').toLowerCase())) return 'HIGH';
    if (!visit.finalized_flag || !visit.owner_summary) return 'MED';
    return 'OK';
  }, [visit]);
  const summaryReadiness = useMemo(() => {
    if (!visit) return 0;
    const checkpoints = [
      Boolean(visit.owner_summary),
      Boolean(visit.follow_up_note),
      Boolean(visit.physical_exam),
      Boolean(visit.diagnostics),
    ];
    return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100);
  }, [visit]);
  const followUpCoverage = useMemo(() => {
    if (!visit) return 0;
    const base = Math.max(1, nextSteps.length + (visit.follow_up_note ? 1 : 0));
    const ready = nextSteps.length;
    return Math.min(100, Math.round((ready / base) * 100));
  }, [nextSteps.length, visit]);

  return (
    <div className="space-y-6">
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-sky-400/14 via-surface-muted to-lime-400/12 p-5 shadow-card md:p-8 dark:from-sky-500/10 dark:to-lime-600/10">
        <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">
              {loading ? 'Загрузка визита…' : 'Визит владельца'}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">Визит</h1>
            {!loading && visit ? (
              <p className="mt-2 text-xl font-black text-theme">{statusLabel}</p>
            ) : null}
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
              Краткая информация для владельца. План лечения и дозировки — только у ветеринара.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/owner/visits" className="btn-secondary !min-h-[44px]">
                Все визиты
              </Link>
              {visit?.pet_id ? (
                <Link href={`/owner/pet/${visit.pet_id}/documents`} className="btn-primary !min-h-[44px]">
                  Документы питомца
                </Link>
              ) : null}
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : visit ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Питомец', value: petName || '—', tone: '' },
                { label: 'Дата', value: visit.created_at ? formatDateTimeLabel(visit.created_at) : '—', tone: 'text-sky-700 dark:text-sky-300' },
                { label: 'Советы', value: nextSteps.length, tone: 'text-violet-700 dark:text-violet-300' },
                {
                  label: 'Выписка',
                  value: visit.finalized_flag || visit.status === 'completed' ? 'Готово' : 'В работе',
                  tone: visit.finalized_flag || visit.status === 'completed' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300',
                },
                { label: 'Статус', value: statusLabel, tone: 'text-rose-700 dark:text-rose-300' },
                { label: 'Запись', value: visit.appointment_id ? 'Привязана' : 'Без записи', tone: visit.appointment_id ? 'text-emerald-700 dark:text-emerald-300' : 'text-theme' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-lg font-black leading-snug sm:text-xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-surface-muted/50 p-6 text-sm text-theme-muted">
              Откройте визит из списка — здесь появятся цифры и контекст.
            </div>
          )}
        </div>
      </section>

      {!loading && visit ? (
        <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">Сигналы визитного контура</h2>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
              owner visit ops
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Давление визита',
                value: visitPressure,
                text: 'Сигнал по статусу визита, полноте выписки и готовности владельческого контекста.',
                href: '/owner/visits',
                tone: visitPressure === 'HIGH'
                  ? 'text-rose-700 dark:text-rose-300'
                  : visitPressure === 'MED'
                    ? 'text-amber-700 dark:text-amber-300'
                    : visitPressure === 'OK'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-sky-700 dark:text-sky-300',
              },
              {
                title: 'Готовность сводки',
                value: `${summaryReadiness}%`,
                text: 'Покрытие карточки ключевыми блоками: summary, follow-up, осмотр и диагностика.',
                href: '/owner/documents',
                tone: 'text-violet-700 dark:text-violet-300',
              },
              {
                title: 'Покрытие follow-up',
                value: `${followUpCoverage}%`,
                text: 'Насколько текущая карточка уже переводит в понятные последующие шаги владельца.',
                href: '/owner/appointments',
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
      ) : null}

      {loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : !visit ? (
        <EmptyState title="Визит не найден" text="Проверьте ссылку или откройте визит из списка." />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Общее" subtitle={petName ? `Питомец: ${petName}` : undefined}>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-theme-muted">Статус</dt>
                <dd className="font-medium text-theme">{statusLabel}</dd>
              </div>
              <div>
                <dt className="text-theme-muted">Создан</dt>
                <dd>{formatDateTimeLabel(visit.created_at)}</dd>
              </div>
              {visit.finalized_at ? (
                <div>
                  <dt className="text-theme-muted">Завершён</dt>
                  <dd>{formatDateTimeLabel(visit.finalized_at)}</dd>
                </div>
              ) : null}
              {visit.appointment_id ? (
                <div>
                  <dt className="text-theme-muted">Запись</dt>
                  <dd>
                    <Link className="link-accent" href={`/owner/appointment/${visit.appointment_id}`}>
                      Открыть запись
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card title="Резюме для вас" subtitle={visit.owner_summary ? undefined : 'Врач может добавить краткое резюме после приёма'}>
            <p className="text-sm text-text whitespace-pre-wrap">{visit.owner_summary || '—'}</p>
          </Card>

          <Card title="Жалобы на приёме">
            <p className="text-sm text-text whitespace-pre-wrap">{visit.complaints || '—'}</p>
          </Card>

          <Card title="Осмотр и диагностика">
            <div className="space-y-3 text-sm text-text">
              <div>
                <p className="font-semibold text-theme">Осмотр</p>
                <p className="whitespace-pre-wrap">{visit.physical_exam || '—'}</p>
              </div>
              <div>
                <p className="font-semibold text-theme">Диагностика</p>
                <p className="whitespace-pre-wrap">{visit.diagnostics || '—'}</p>
              </div>
            </div>
          </Card>

          {visit.follow_up_note ? (
            <Card title="Рекомендации по наблюдению" className="lg:col-span-2">
              <p className="text-sm text-text whitespace-pre-wrap">{visit.follow_up_note}</p>
            </Card>
          ) : null}

          <Card title="Что дальше" subtitle="План последующих действий после визита" className="lg:col-span-2">
            <ul className="space-y-2">
              {nextSteps.map((step, idx) => (
                <li key={`${idx}-${step.slice(0, 12)}`} className="rounded-xl border border-border bg-surface-muted/70 px-3 py-2 text-sm text-text">
                  {step}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/owner/appointments" className="btn-primary !min-h-[40px] !px-3 !py-1.5 text-sm">
                Запланировать контроль
              </Link>
              {visit.pet_id ? (
                <Link href={`/owner/pet/${visit.pet_id}/consents`} className="btn-secondary !min-h-[40px] !px-3 !py-1.5 text-sm">
                  Проверить доступы
                </Link>
              ) : null}
            </div>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}
