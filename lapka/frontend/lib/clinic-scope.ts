'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { getStoredSession } from '@/lib/auth';

const STORAGE_KEY = 'lapka.selected_clinic_id';
const BRANCH_STORAGE_PREFIX = 'lapka.selected_branch_id.';
const LOCATION_EVENT = 'lapka-location-change';

declare global {
  interface Window {
    __lapkaLocationEventsPatched?: boolean;
  }
}

interface Clinic {
  id: string;
  locations?: Branch[];
  [key: string]: unknown;
}

interface Branch {
  id: string;
  is_primary?: boolean;
  [key: string]: unknown;
}

export function getStoredClinicId(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(STORAGE_KEY) || '';
}

export function getStoredBranchId(clinicId: string): string {
  if (typeof window === 'undefined' || !clinicId) return '';
  return window.localStorage.getItem(`${BRANCH_STORAGE_PREFIX}${clinicId}`) || '';
}

export function saveStoredBranchId(clinicId: string, branchId: string): void {
  if (typeof window === 'undefined' || !clinicId) return;
  const key = `${BRANCH_STORAGE_PREFIX}${clinicId}`;
  if (branchId) {
    window.localStorage.setItem(key, branchId);
  } else {
    window.localStorage.removeItem(key);
  }
  window.dispatchEvent(new CustomEvent('lapka-clinic-branch-change', { detail: { clinicId, branchId: branchId || '' } }));
}

export function saveStoredClinicId(clinicId: string): void {
  if (typeof window === 'undefined') return;
  if (clinicId) {
    window.localStorage.setItem(STORAGE_KEY, clinicId);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent('lapka-clinic-scope-change', { detail: clinicId || '' }));
}

function readScopeFromLocation(): { clinicId: string; branchId: string } {
  if (typeof window === 'undefined') return { clinicId: '', branchId: '' };
  const params = new URLSearchParams(window.location.search);
  return {
    clinicId: params.get('clinic_id') || '',
    branchId: params.get('branch_id') || '',
  };
}

function ensureLocationEvents(): void {
  if (typeof window === 'undefined' || window.__lapkaLocationEventsPatched) return;
  const originalPushState = window.history.pushState.bind(window.history) as (...args: unknown[]) => unknown;
  const originalReplaceState = window.history.replaceState.bind(window.history) as (...args: unknown[]) => unknown;

  function notifyLocationChange() {
    window.dispatchEvent(new CustomEvent(LOCATION_EVENT));
  }

  window.history.pushState = function pushStatePatched(...args: unknown[]) {
    const result = originalPushState(...args);
    notifyLocationChange();
    return result;
  };

  window.history.replaceState = function replaceStatePatched(...args: unknown[]) {
    const result = originalReplaceState(...args);
    notifyLocationChange();
    return result;
  };

  window.addEventListener('popstate', notifyLocationChange);
  window.__lapkaLocationEventsPatched = true;
}

function resolveScopeIds({
  rows,
  defaultClinicId,
  requestedClinicId,
  requestedBranchId,
}: {
  rows: Clinic[];
  defaultClinicId: string;
  requestedClinicId: string;
  requestedBranchId: string;
}): { clinicId: string; branchId: string } {
  const storedClinicId = getStoredClinicId();
  const clinicFromRequest = requestedClinicId && rows.some((row) => row.id === requestedClinicId) ? requestedClinicId : '';
  const clinicFromStorage = storedClinicId && rows.some((row) => row.id === storedClinicId) ? storedClinicId : '';
  const nextClinicId = clinicFromRequest || clinicFromStorage || defaultClinicId || rows[0]?.id || '';

  const nextClinic = rows.find((row) => row.id === nextClinicId) || rows[0] || null;
  const branchRows = Array.isArray(nextClinic?.locations) ? nextClinic.locations : [];
  const storedBranchId = getStoredBranchId(nextClinicId);
  const branchFromRequest = requestedBranchId && branchRows.some((row) => row.id === requestedBranchId) ? requestedBranchId : '';
  const branchFromStorage = storedBranchId && branchRows.some((row) => row.id === storedBranchId) ? storedBranchId : '';
  const nextBranch = branchRows.find((row) => row.id === branchFromRequest)
    || branchRows.find((row) => row.id === branchFromStorage)
    || branchRows.find((row) => row.is_primary)
    || branchRows[0]
    || null;

  return {
    clinicId: nextClinicId,
    branchId: nextBranch?.id || '',
  };
}

export function useClinicScope() {
  const [requestedScope, setRequestedScope] = useState(readScopeFromLocation);
  const [clinicId, setClinicId] = useState(getStoredClinicId);
  const [branchId, setBranchIdState] = useState('');
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [scopeMode, setScopeMode] = useState('public');
  const requestedClinicId = requestedScope.clinicId || '';
  const requestedBranchId = requestedScope.branchId || '';

  useEffect(() => {
    ensureLocationEvents();

    function onLocationChange() {
      setRequestedScope(readScopeFromLocation());
    }

    window.addEventListener(LOCATION_EVENT, onLocationChange);
    return () => {
      window.removeEventListener(LOCATION_EVENT, onLocationChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadClinics() {
      try {
        const session = getStoredSession();
        const role = session.role || '';
        const isScopedRole = role === 'clinic_admin' || role === 'vet' || role === 'network_admin';
        const payload = isScopedRole
          ? await apiRequest('/api/v1/clinics/my/scopes').catch(() => null)
          : await apiRequest('/api/v1/clinics').catch(() => null);

        if (cancelled) return;
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { clinics?: Clinic[] })?.clinics)
            ? (payload as { clinics: Clinic[] }).clinics
            : [];
        const defaultClinicId = Array.isArray(payload)
          ? ''
          : (payload as { default_clinic_id?: string })?.default_clinic_id || '';
        setScopeMode(Array.isArray(payload) ? 'public' : ((payload as { scope_mode?: string })?.scope_mode || 'public'));
        setClinics(rows);
        const resolvedScope = resolveScopeIds({
          rows,
          defaultClinicId,
          requestedClinicId,
          requestedBranchId,
        });

        if (getStoredClinicId() !== resolvedScope.clinicId) {
          saveStoredClinicId(resolvedScope.clinicId);
        }
        if (getStoredBranchId(resolvedScope.clinicId) !== resolvedScope.branchId) {
          saveStoredBranchId(resolvedScope.clinicId, resolvedScope.branchId);
        }

        setClinicId(resolvedScope.clinicId);
        setBranchIdState(resolvedScope.branchId);
      } catch {
        if (!cancelled) {
          setClinics([]);
          setScopeMode('public');
        }
      }
    }

    loadClinics();

    function onScopeChange(event: Event) {
      const customEvent = event as CustomEvent;
      const nextClinicId = customEvent?.detail || getStoredClinicId();
      setClinicId(nextClinicId);
      setBranchIdState(getStoredBranchId(nextClinicId));
    }

    function onBranchChange(event: Event) {
      const customEvent = event as CustomEvent;
      const detail = customEvent?.detail || {};
      if (!detail.clinicId || detail.clinicId === getStoredClinicId()) {
        setBranchIdState(detail.branchId || getStoredBranchId(getStoredClinicId()));
      }
    }

    window.addEventListener('lapka-clinic-scope-change', onScopeChange);
    window.addEventListener('lapka-clinic-branch-change', onBranchChange);
    return () => {
      cancelled = true;
      window.removeEventListener('lapka-clinic-scope-change', onScopeChange);
      window.removeEventListener('lapka-clinic-branch-change', onBranchChange);
    };
  }, [requestedBranchId, requestedClinicId]);

  useEffect(() => {
    if (!clinics.length && !requestedClinicId && !requestedBranchId) return;
    const resolvedScope = resolveScopeIds({
      rows: clinics,
      defaultClinicId: '',
      requestedClinicId,
      requestedBranchId,
    });
    if (resolvedScope.clinicId && resolvedScope.clinicId !== clinicId) {
      if (getStoredClinicId() !== resolvedScope.clinicId) {
        saveStoredClinicId(resolvedScope.clinicId);
      }
      setClinicId(resolvedScope.clinicId);
    }
    if (resolvedScope.clinicId && getStoredBranchId(resolvedScope.clinicId) !== resolvedScope.branchId) {
      saveStoredBranchId(resolvedScope.clinicId, resolvedScope.branchId);
    }
    if (resolvedScope.branchId !== branchId) {
      setBranchIdState(resolvedScope.branchId);
    }
  }, [branchId, clinicId, clinics, requestedBranchId, requestedClinicId]);

  const selectedClinic = useMemo(
    () => clinics.find((row) => row.id === clinicId) || clinics[0] || null,
    [clinicId, clinics]
  );
  const resolvedClinicId = clinics.length ? (selectedClinic?.id || '') : '';
  const branches = useMemo(() => Array.isArray(selectedClinic?.locations) ? selectedClinic.locations : [], [selectedClinic]);
  const selectedBranch = useMemo(
    () => branches.find((row) => row.id === branchId) || branches.find((row) => row.is_primary) || branches[0] || null,
    [branchId, branches]
  );
  const resolvedBranchId = selectedBranch?.id || '';

  return {
    clinicId: resolvedClinicId,
    branchId: resolvedBranchId,
    scopeMode,
    clinics,
    branches,
    selectedClinic,
    selectedBranch,
    setClinicId: saveStoredClinicId,
    setBranchId: (nextBranchId: string) => saveStoredBranchId(resolvedClinicId, nextBranchId),
  };
}