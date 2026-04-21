export function buildPlatformAiI18nMaps(t, options = {}) {
  const isDev = process.env.NODE_ENV !== 'production';
  const debug = options.debug ?? isDev;
  const warned = new Set();

  function warnUnknown(kind, value, rowId = '') {
    if (!debug) return;
    const normalized = String(value ?? '').trim();
    if (!normalized) return;
    const key = `${kind}:${normalized}`;
    if (warned.has(key)) return;
    warned.add(key);
    // eslint-disable-next-line no-console
    console.warn(`[platform-ai-i18n] unknown ${kind}: "${normalized}"${rowId ? ` (row: ${rowId})` : ''}`);
  }

  const scenarioLabelBySlug = {
    'owner-triage': t('platform.aiPage.routeOwnerTriageScenario'),
    'doc-explain': t('platform.aiPage.routeDocExplainScenario'),
    'vet-notes': t('platform.aiPage.routeVetNotesScenario'),
    'knowledge-search': t('platform.aiPage.routeKnowledgeScenario'),
  };

  const statusLabelByCode = {
    ok: t('platform.aiPage.statusOk'),
    blocked: t('platform.aiPage.statusBlocked'),
    error: t('platform.aiPage.statusError'),
  };

  const roleLabelByCode = {
    owner: t('roles.owner'),
    vet: t('roles.vet'),
    clinic_admin: t('roles.clinicAdmin'),
    clinicAdmin: t('roles.clinicAdmin'),
    network_admin: t('platform.workspaceUi.sidebarRoleTitle'),
  };

  const overrideModeLabelByCode = {
    standard: t('platform.aiPage.ovClinicMode'),
    default: t('platform.aiPage.ovClinicMode'),
    'standard perimeter': t('platform.aiPage.ovClinicMode'),
    'стандартный контур': t('platform.aiPage.ovClinicMode'),
    local: t('platform.aiPage.ovBranchMode'),
    'local backup': t('platform.aiPage.ovBranchMode'),
    'local backup perimeter': t('platform.aiPage.ovBranchMode'),
    'локальный резервный контур': t('platform.aiPage.ovBranchMode'),
    assistant: t('platform.aiPage.ovRoleMode'),
    'vet assistant': t('platform.aiPage.ovRoleMode'),
    'ассистент врача': t('platform.aiPage.ovRoleMode'),
  };

  const overrideTargetByHints = {
    'clinic-demo': t('platform.aiPage.ovClinicTarget'),
    'branch-sensitive': t('platform.aiPage.ovBranchTarget'),
    'role-vet': t('platform.aiPage.ovRoleTarget'),
    'private-cases': t('platform.aiPage.ovBranchTarget'),
    vet: t('platform.aiPage.ovRoleTarget'),
  };

  function localizeRecentUsage(rows) {
    return (rows || []).map((row) => ({
      ...row,
      scenario:
        scenarioLabelBySlug[row.route_slug || row.scenario_key || row.slug] || row.scenario || row.route_slug,
      status_label: statusLabelByCode[row.status] || row.status_label || row.status,
      role_scope: roleLabelByCode[row.role_scope] || row.role_scope,
    }));
  }

  function localizeRouteHealth(rows) {
    return (rows || []).map((row) => ({
      ...row,
      scenario:
        scenarioLabelBySlug[row.route_slug || row.scenario_key || row.slug] || row.scenario || row.route_slug,
      role_scope: roleLabelByCode[row.role_scope] || row.role_scope,
    }));
  }

  function localizeOverrideSummary(rows) {
    return (rows || []).map((row) => {
      const rawMode = String(row.mode_label || row.mode || '').trim();
      const modeKey = rawMode.toLowerCase();
      const rawLevel = String(row.level || '').trim();
      const levelKey = rawLevel.toLowerCase();
      const rawTarget = String(row.target || '').trim();
      const targetKey = rawTarget.toLowerCase();
      const hintKey = row.id || row.tenant_key || row.role || '';

      const isRoleOverride = row.source_type === 'role' || !!row.role;
      const isClinicOverride = row.source_type === 'clinic' || !!row.clinic_id;
      const isTenantOverride =
        row.source_type === 'tenant'
        || !!row.tenant_key
        || (row.route_slug && String(row.route_slug).includes('inpatient'));

      const localizedLevel = isRoleOverride
        ? t('platform.aiPage.ovRoleLevel')
        : isClinicOverride
          ? t('platform.aiPage.ovClinicLevel')
          : isTenantOverride
            ? t('platform.aiPage.ovBranchLevel')
            : roleLabelByCode[levelKey]
              || (levelKey === 'роль' ? t('platform.aiPage.ovRoleLevel') : null)
              || (levelKey === 'клиника' ? t('platform.aiPage.ovClinicLevel') : null)
              || (levelKey === 'платформа' ? t('platform.aiPage.ovBranchLevel') : null)
              || rawLevel;

      const localizedTarget =
        overrideTargetByHints[hintKey]
        || (targetKey === 'ветсеть' ? t('platform.aiPage.ovClinicTarget') : null)
        || (targetKey.includes('private') || targetKey.includes('приват')
          ? t('platform.aiPage.ovBranchTarget')
          : null)
        || (targetKey.includes('ветеринар') || targetKey.includes('veterinarian')
          ? t('platform.aiPage.ovRoleTarget')
          : null)
        || rawTarget;

      const localizedMode = overrideModeLabelByCode[modeKey] || rawMode || row.mode_label || row.mode;
      const rowId = row.id || row.route_slug || row.tenant_key || row.role || '';
      if (!isRoleOverride && !isClinicOverride && !isTenantOverride && rawLevel && localizedLevel === rawLevel) {
        warnUnknown('level', rawLevel, rowId);
      }
      if (rawTarget && localizedTarget === rawTarget) {
        warnUnknown('target', rawTarget, rowId);
      }
      if (rawMode && localizedMode === rawMode) {
        warnUnknown('mode_label', rawMode, rowId);
      }

      return {
        ...row,
        level: localizedLevel,
        target: localizedTarget,
        mode_label: localizedMode,
      };
    });
  }

  return {
    localizeRecentUsage,
    localizeRouteHealth,
    localizeOverrideSummary,
  };
}
