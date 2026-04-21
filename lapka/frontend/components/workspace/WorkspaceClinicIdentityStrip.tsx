'use client';

import Link from 'next/link';

/**
 * Крупный операционный блок: реальные поля клиники из /clinics/my/scopes (selectedClinic).
 */
export default function WorkspaceClinicIdentityStrip({ clinic, branch, tone = 'clinic' }) {
  const gradientClass =
    tone === 'vet'
      ? 'from-teal-500/15 via-sky-500/10 to-surface-muted/90 dark:from-teal-400/12 dark:via-sky-500/08'
      : 'from-emerald-500/14 via-cyan-500/10 to-surface-muted/90 dark:from-emerald-400/10 dark:via-cyan-500/08';

  if (!clinic) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface-muted/50 px-5 py-6 md:px-8">
        <p className="text-sm font-semibold text-theme-muted">Контекст клиники загружается…</p>
        <p className="mt-1 text-xs text-theme-muted">Если так и остаётся, проверьте вход и привязку к клинике.</p>
      </div>
    );
  }

  const branchCount = Array.isArray(clinic.locations) ? clinic.locations.length : 0;
  const line1 = [clinic.city, clinic.address].filter(Boolean).join(' · ');
  const lineBranch = branch
    ? [branch.city, branch.address].filter(Boolean).join(' · ')
    : clinic.primary_location
      ? [clinic.primary_location.city, clinic.primary_location.address].filter(Boolean).join(' · ')
      : '';

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${gradientClass} shadow-card`}
      data-testid="workspace-clinic-identity"
    >
      <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-lapka-gradient opacity-[0.12] blur-3xl dark:opacity-[0.18]" />
      <div className="relative grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:gap-8 md:p-8">
        <div className="min-w-0 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-theme-muted">
            {clinic.access_label || clinic.role_label || 'Активная клиника'}
          </p>
          <h2 className="text-2xl font-black tracking-tight text-theme md:text-3xl lg:text-[2rem]">{clinic.name}</h2>
          {line1 ? <p className="max-w-3xl text-sm leading-relaxed text-theme md:text-base">{line1}</p> : null}
          {lineBranch && (!branch || lineBranch !== line1) ? (
            <p className="text-sm text-theme-muted">
              <span className="font-semibold text-theme">Филиал: </span>
              {lineBranch}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {clinic.role_label ? (
              <span className="inline-flex rounded-full border border-border bg-surface/90 px-3 py-1 text-xs font-semibold text-theme shadow-sm">
                {clinic.role_label}
              </span>
            ) : null}
            {branchCount > 0 ? (
              <span className="inline-flex rounded-full border border-border bg-surface/90 px-3 py-1 text-xs font-semibold text-theme shadow-sm">
                Филиалов: {branchCount}
              </span>
            ) : null}
            {clinic.emergency_available ? (
              <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-900 dark:text-amber-100">
                Приём экстренных случаев
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex min-w-[200px] flex-col gap-2 md:items-end">
          {clinic.phone ? (
            <a href={`tel:${String(clinic.phone).replace(/\s/g, '')}`} className="btn-secondary w-full !justify-center md:w-auto md:min-w-[200px]">
              {clinic.phone}
            </a>
          ) : null}
          {clinic.website ? (
            <a
              href={clinic.website.startsWith('http') ? clinic.website : `https://${clinic.website}`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost w-full !justify-center border border-border text-sm md:w-auto"
            >
              Сайт клиники
            </a>
          ) : null}
          <Link
            href={tone === 'vet' ? '/vet/appointments' : '/clinic/schedule'}
            className="btn-primary w-full !justify-center md:w-auto md:min-w-[200px]"
          >
            {tone === 'vet' ? 'Мои записи' : 'Расписание'}
          </Link>
        </div>
      </div>
    </section>
  );
}
