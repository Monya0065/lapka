import { apiRequest } from '@/lib/api';

const SESSION_KEY = 'lapka.ownerFunnel.sessionId';

function readOrCreateSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const generated = `ofs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch {
    return null;
  }
}

interface FunnelOptions {
  source?: string | null;
  clinicId?: string | null;
  petId?: string | null;
}

export function trackOwnerFunnelStep(step: string, options: FunnelOptions = {}): void {
  if (!step || typeof window === 'undefined') return;
  const body = {
    step,
    source: options.source || null,
    clinic_id: options.clinicId || null,
    pet_id: options.petId || null,
    path: window.location?.pathname || null,
    session_id: readOrCreateSessionId(),
  };
  apiRequest('/api/v1/analytics/owner-funnel/track', {
    method: 'POST',
    body,
    queueOnOffline: true,
  }).catch(() => {
    // Funnel tracking is best-effort and must not block owner actions.
  });
}