'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadOwnerBaseData } from '@/lib/owner-data';
import Skeleton from '@/components/ui/Skeleton';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Крупный блок с реальными данными владельца: питомцы, ближайшая запись, счета.
 */
export default function WorkspaceOwnerContextStrip() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await loadOwnerBaseData();
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setData({ pets: [], reminders: [], appointments: [], invoices: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nextAppt = useMemo(() => {
    if (!data?.appointments?.length) return null;
    const now = Date.now();
    const upcoming = [...data.appointments]
      .filter((a) => new Date(a.scheduled_at || a.start_at || 0).getTime() >= now - 60_000)
      .sort((a, b) => new Date(a.scheduled_at || a.start_at) - new Date(b.scheduled_at || b.start_at));
    return upcoming[0] || null;
  }, [data]);

  const openInvoices = useMemo(
    () =>
      (data?.invoices || []).filter((inv) => inv.status === 'issued' || inv.status === 'draft'),
    [data]
  );

  if (loading) {
    return <Skeleton className="h-[7.5rem] w-full rounded-3xl md:h-[8.5rem]" />;
  }

  const pets = data?.pets || [];
  const remindersSoon = (data?.reminders || []).filter((r) => !r.is_done).length;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-violet-500/12 via-surface-muted to-teal-500/10 shadow-card dark:from-violet-500/08"
      data-testid="workspace-owner-context"
    >
      <div className="pointer-events-none absolute -left-20 top-0 h-48 w-48 rounded-full bg-lapka-gradient opacity-[0.1] blur-3xl" />
      <div className="relative grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:gap-8 md:p-7">
        <div className="min-w-0 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-theme-muted">Ваш кабинет · данные из Lapka</p>
          <h2 className="text-xl font-black tracking-tight text-theme md:text-2xl">
            {pets.length ? (
              <>
                {pets.length} {pets.length === 1 ? 'питомец' : pets.length < 5 ? 'питомца' : 'питомцев'} в профиле
              </>
            ) : (
              'Добавьте первого питомца'
            )}
          </h2>
          {pets.length ? (
            <div className="flex flex-wrap gap-2">
              {pets.slice(0, 8).map((pet) => (
                <Link
                  key={pet.id}
                  href={`/owner/pet/${pet.id}`}
                  className="inline-flex rounded-full border border-border bg-surface/90 px-3 py-1 text-sm font-semibold text-theme shadow-sm transition hover:border-border-hover"
                >
                  {pet.name}
                </Link>
              ))}
              {pets.length > 8 ? (
                <span className="inline-flex items-center rounded-full border border-dashed border-border px-3 py-1 text-xs text-theme-muted">
                  +{pets.length - 8}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-theme-muted">Медкарта, визиты и документы появятся после добавления питомца.</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-theme-muted">
            {remindersSoon > 0 ? (
              <span className="rounded-full bg-surface/80 px-2.5 py-1">Активных напоминаний: {remindersSoon}</span>
            ) : null}
            {openInvoices.length > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-900 dark:text-amber-100">
                Счетов к оплате: {openInvoices.length}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex min-w-[240px] flex-col gap-3 md:items-end">
          {nextAppt ? (
            <div className="w-full rounded-2xl border border-border bg-surface/90 p-4 shadow-sm md:max-w-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-theme-muted">Ближайшая запись</p>
              <p className="mt-1 font-bold text-theme">{nextAppt.service_name || nextAppt.service_type || 'Приём'}</p>
              <p className="text-sm text-theme-muted">{formatWhen(nextAppt.scheduled_at || nextAppt.start_at)}</p>
              <Link href={`/owner/appointment/${nextAppt.id}`} className="mt-2 inline-block text-sm font-semibold text-teal-600 dark:text-teal-400">
                Открыть →
              </Link>
            </div>
          ) : (
            <p className="max-w-xs text-right text-sm text-theme-muted">Нет предстоящих записей. Запланируйте визит у клиники.</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/owner/dashboard" className="btn-secondary !px-4 !py-2 text-sm">
              Дашборд
            </Link>
            <Link href="/owner/appointments" className="btn-primary !px-4 !py-2 text-sm">
              Записи
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
