'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useClinicScope } from '@/lib/clinic-scope';

function buildScopedHref(pathname, clinicId, branchId) {
  const params = new URLSearchParams();
  if (clinicId) params.set('clinic_id', clinicId);
  if (branchId) params.set('branch_id', branchId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default function ClinicScopeSwitcher({ showBranchHint = false }) {
  const router = useRouter();
  const pathname = usePathname() || '/clinic/schedule';
  const { clinicId, branchId, clinics, branches, selectedClinic, selectedBranch, setClinicId, setBranchId, scopeMode } = useClinicScope();

  useEffect(() => {
    if (typeof window === 'undefined' || !clinicId) return;
    const params = new URLSearchParams(window.location.search);
    const currentClinicId = params.get('clinic_id') || '';
    const currentBranchId = params.get('branch_id') || '';
    const nextBranchId = branchId || '';
    if (currentClinicId === clinicId && currentBranchId === nextBranchId) return;
    const nextHref = buildScopedHref(pathname, clinicId, nextBranchId);
    router.replace(nextHref, { scroll: false });
  }, [branchId, clinicId, pathname, router]);

  if (!clinics.length) return null;

  const helperHref = scopeMode === 'platform'
    ? (branchId
      ? `/platform/branches/${encodeURIComponent(branchId)}`
      : clinicId
        ? `/platform/clinics/${encodeURIComponent(clinicId)}`
        : '/platform/clinics')
    : buildScopedHref('/clinic/schedule', clinicId, branchId);
  const helperLabel = scopeMode === 'platform'
    ? (branchId ? 'Карточка филиала' : clinicId ? 'Карточка клиники' : 'Открыть реестр сети')
    : 'Открыть операционный календарь';

  return (
    <div className="inline-flex max-w-full items-center gap-3 rounded-2xl border border-lapka-200 bg-white px-3 py-2 shadow-soft">
      <div className="hidden min-w-0 xl:block">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lapka-500">
          {scopeMode === 'platform'
            ? (showBranchHint ? 'Сеть, клиника и филиал' : 'Сетевой контур')
            : (showBranchHint ? 'Клиника и филиал' : 'Контур клиники')}
        </p>
        <p className="truncate text-sm font-semibold text-lapka-800">{selectedClinic?.name || 'Клиника'}</p>
        {selectedBranch ? (
          <p className="truncate text-xs text-lapka-500">{selectedBranch.city} · {selectedBranch.address}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1 text-[11px] font-semibold text-lapka-700">
            {clinics.length} {clinics.length === 1 ? 'клиника' : clinics.length < 5 ? 'клиники' : 'клиник'}
          </span>
          <span className="inline-flex items-center rounded-full border border-lapka-200 bg-lapka-50 px-2.5 py-1 text-[11px] font-semibold text-lapka-700">
            {branches.length || 1} {branches.length === 1 ? 'филиал' : branches.length < 5 ? 'филиала' : 'филиалов'}
          </span>
        </div>
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        <select
          className="min-w-[180px] rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm font-semibold text-lapka-700 focus:outline-none focus:ring-2 focus:ring-lapka-300"
          value={clinicId}
          onChange={(event) => {
            const nextClinicId = event.target.value;
            setClinicId(nextClinicId);
          }}
        >
          {clinics.map((clinic) => (
            <option key={clinic.id} value={clinic.id}>
              {clinic.name}{clinic.role_label ? ` · ${clinic.role_label}` : ''}
            </option>
          ))}
        </select>
        <select
          className="min-w-[180px] rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm font-semibold text-lapka-700 focus:outline-none focus:ring-2 focus:ring-lapka-300 disabled:cursor-not-allowed disabled:opacity-60"
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
          disabled={!branches.length}
        >
          {branches.length ? branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.is_primary ? 'Главный филиал' : 'Филиал'} · {branch.address}
            </option>
          )) : <option value="">Филиал не указан</option>}
        </select>
      </div>
      <Link href={helperHref} className="hidden rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm font-semibold text-lapka-700 transition hover:border-lapka-300 hover:bg-lapka-100 2xl:inline-flex">
        {helperLabel}
      </Link>
    </div>
  );
}
