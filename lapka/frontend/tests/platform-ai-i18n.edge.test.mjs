import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlatformAiI18nMaps } from '../lib/platform-ai-i18n.mjs';

const dictionary = {
  'platform.aiPage.routeOwnerTriageScenario': 'Owner triage',
  'platform.aiPage.routeDocExplainScenario': 'Document explanation',
  'platform.aiPage.routeVetNotesScenario': 'Vet note structuring',
  'platform.aiPage.routeKnowledgeScenario': 'Knowledge search',
  'platform.aiPage.statusOk': 'OK',
  'platform.aiPage.statusBlocked': 'Blocked',
  'platform.aiPage.statusError': 'Error',
  'roles.owner': 'Owner',
  'roles.vet': 'Vet',
  'roles.clinicAdmin': 'Clinic admin',
  'platform.workspaceUi.sidebarRoleTitle': 'Platform',
  'platform.aiPage.ovClinicMode': 'Standard perimeter',
  'platform.aiPage.ovBranchMode': 'Local backup perimeter',
  'platform.aiPage.ovRoleMode': 'Vet assistant',
  'platform.aiPage.ovClinicTarget': 'VetNet',
  'platform.aiPage.ovBranchTarget': 'Inpatient / private cases',
  'platform.aiPage.ovRoleTarget': 'Veterinarian',
  'platform.aiPage.ovRoleLevel': 'Role',
  'platform.aiPage.ovClinicLevel': 'Clinic',
  'platform.aiPage.ovBranchLevel': 'Platform',
};

function t(key) {
  return dictionary[key] ?? key;
}

test('handles empty and null row collections', () => {
  const maps = buildPlatformAiI18nMaps(t, { debug: false });
  assert.deepEqual(maps.localizeRecentUsage(undefined), []);
  assert.deepEqual(maps.localizeRouteHealth(null), []);
  assert.deepEqual(maps.localizeOverrideSummary(undefined), []);
});

test('recent usage keeps unknown status when no status_label', () => {
  const maps = buildPlatformAiI18nMaps(t, { debug: false });
  const [row] = maps.localizeRecentUsage([
    { route_slug: 'owner-triage', status: 'rate_limited', role_scope: 'owner' },
  ]);
  assert.equal(row.scenario, 'Owner triage');
  assert.equal(row.status_label, 'rate_limited');
  assert.equal(row.role_scope, 'Owner');
});

test('route health falls back to provided scenario and role', () => {
  const maps = buildPlatformAiI18nMaps(t, { debug: false });
  const [row] = maps.localizeRouteHealth([
    { scenario: 'Backend custom scenario', role_scope: 'external_role' },
  ]);
  assert.equal(row.scenario, 'Backend custom scenario');
  assert.equal(row.role_scope, 'external_role');
});

test('override summary maps clinic/tenant/role by hints and keeps custom unknowns', () => {
  const maps = buildPlatformAiI18nMaps(t, { debug: false });
  const rows = maps.localizeOverrideSummary([
    {
      id: 'clinic-demo',
      source_type: 'clinic',
      clinic_id: 'c1',
      mode_label: 'default',
      level: '',
      target: '',
    },
    {
      id: 'tenant-custom',
      source_type: 'tenant',
      route_slug: 'inpatient-watch',
      target: 'приватный контур',
      mode_label: 'local backup perimeter',
    },
    {
      id: 'raw',
      source_type: 'unknown',
      level: '',
      target: '',
      mode_label: '',
    },
  ]);

  assert.equal(rows[0].level, 'Clinic');
  assert.equal(rows[0].target, 'VetNet');
  assert.equal(rows[0].mode_label, 'Standard perimeter');

  assert.equal(rows[1].level, 'Platform');
  assert.equal(rows[1].target, 'Inpatient / private cases');
  assert.equal(rows[1].mode_label, 'Local backup perimeter');

  assert.equal(rows[2].level, '');
  assert.equal(rows[2].target, '');
  assert.equal(rows[2].mode_label, undefined);
});

test('debug mode logs unknown values only once per kind/value', () => {
  const originalWarn = console.warn;
  const logs = [];
  console.warn = (...args) => {
    logs.push(args.join(' '));
  };

  try {
    const maps = buildPlatformAiI18nMaps(t, { debug: true });
    maps.localizeOverrideSummary([
      { id: 'r1', source_type: 'unknown', level: 'Lx', target: 'Tx', mode_label: 'Mx' },
      { id: 'r2', source_type: 'unknown', level: 'Lx', target: 'Tx', mode_label: 'Mx' },
    ]);
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(logs.filter((line) => line.includes('unknown level: "Lx"')).length, 1);
  assert.equal(logs.filter((line) => line.includes('unknown target: "Tx"')).length, 1);
  assert.equal(logs.filter((line) => line.includes('unknown mode_label: "Mx"')).length, 1);
});
