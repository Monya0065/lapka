'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';

export default function WorkspaceSecurityStatus() {
  const [meta, setMeta] = useState(null);
  const [acceptances, setAcceptances] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [metaPayload, acceptancePayload] = await Promise.all([
          apiRequest('/api/v1/legal/meta', { auth: false }),
          apiRequest('/api/v1/legal/acceptances'),
        ]);
        if (cancelled) return;
        setMeta(metaPayload || null);
        setAcceptances(Array.isArray(acceptancePayload) ? acceptancePayload : []);
      } catch {
        if (!cancelled) {
          setMeta(null);
          setAcceptances([]);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (!meta) return { total: 0, current: 0 };
    const required = [
      ['privacy', meta.privacy_policy_version],
      ['terms', meta.terms_version],
      ['consent', meta.consent_version],
      ['dpa', meta.dpa_version],
    ].filter(([, version]) => Boolean(version));
    const ackMap = Object.fromEntries((acceptances || []).map((item) => [item.document_type, item.version]));
    const current = required.filter(([doc, version]) => ackMap[doc] === version).length;
    return { total: required.length, current };
  }, [acceptances, meta]);

  return (
    <div className="rounded-xl border border-border bg-surface-muted/70 px-4 py-3 text-sm text-theme">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Security/Privacy статус</p>
        <span className="pill">{stats.current}/{stats.total || 0}</span>
      </div>
      <p className="mt-1 text-xs text-theme-muted">
        Текущие юридические версии и подтверждения по аккаунту.
      </p>
    </div>
  );
}
