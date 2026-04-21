'use client';

import Link from 'next/link';
import { useClinicScope } from '@/lib/clinic-scope';

/**
 * Контекст сети для network_admin: сколько клиник в области выбора, фокус на выбранной.
 */
export default function WorkspacePlatformIdentityStrip() {
  const { clinics, selectedClinic, clinicId } = useClinicScope();
  const n = clinics.length;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-600/15 via-surface-muted to-indigo-500/12 shadow-card dark:from-slate-400/10 dark:to-indigo-500/10"
      data-testid="workspace-platform-context"
    >
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 translate-x-1/4 -translate-y-1/4 rounded-full bg-indigo-500/20 blur-2xl" />
      <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-7">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-theme-muted">Платформа Lapka</p>
          <h2 className="text-xl font-black tracking-tight text-theme md:text-2xl">
            {n ? `В контуре выбора: ${n} ${n === 1 ? 'клиника' : n < 5 ? 'клиники' : 'клиник'}` : 'Загрузка реестра…'}
          </h2>
          {selectedClinic ? (
            <p className="text-sm text-theme-muted">
              <span className="font-semibold text-theme">Фокус: </span>
              {selectedClinic.name}
              {selectedClinic.city ? ` · ${selectedClinic.city}` : ''}
            </p>
          ) : clinicId ? (
            <p className="text-sm text-theme-muted">Клиника выбрана по ID; подождите синхронизацию списка.</p>
          ) : (
            <p className="text-sm text-theme-muted">Выберите клинику в переключателе шапки для контекстных действий.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Link href="/platform/clinics" className="btn-secondary !px-4 !py-2 text-sm">
            Реестр клиник
          </Link>
          <Link href="/platform/dashboard" className="btn-secondary !px-4 !py-2 text-sm">
            Обзор сети
          </Link>
          <Link href="/platform/ai" className="btn-primary !px-4 !py-2 text-sm">
            Центр AI
          </Link>
        </div>
      </div>
    </section>
  );
}
