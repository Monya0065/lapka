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

test('localizeRecentUsage maps scenario/status/role with fallback', () => {
  const maps = buildPlatformAiI18nMaps(t, { debug: false });
  const rows = [
    { route_slug: 'owner-triage', status: 'ok', role_scope: 'owner' },
    { route_slug: 'unknown-route', status: 'mystery', status_label: 'Custom', role_scope: 'custom' },
  ];

  const localized = maps.localizeRecentUsage(rows);
  assert.equal(localized[0].scenario, 'Owner triage');
  assert.equal(localized[0].status_label, 'OK');
  assert.equal(localized[0].role_scope, 'Owner');

  assert.equal(localized[1].scenario, 'unknown-route');
  assert.equal(localized[1].status_label, 'Custom');
  assert.equal(localized[1].role_scope, 'custom');
});

test('localizeRouteHealth maps scenario and role', () => {
  const maps = buildPlatformAiI18nMaps(t, { debug: false });
  const rows = [{ route_slug: 'vet-notes', role_scope: 'vet', scenario: 'Raw scenario' }];
  const localized = maps.localizeRouteHealth(rows);

  assert.equal(localized[0].scenario, 'Vet note structuring');
  assert.equal(localized[0].role_scope, 'Vet');
});

test('localizeOverrideSummary maps by source_type and hints', () => {
  const maps = buildPlatformAiI18nMaps(t, { debug: false });
  const rows = [
    {
      id: 'role-vet',
      source_type: 'role',
      role: 'vet',
      level: 'роль',
      target: 'Ветеринарный врач',
      mode_label: 'ассистент врача',
    },
    {
      id: 'branch-sensitive',
      source_type: 'tenant',
      tenant_key: 'private-cases',
      target: 'private anything',
      mode_label: 'local backup',
    },
    {
      id: 'custom',
      source_type: 'unknown',
      level: 'Custom level',
      target: 'Custom target',
      mode_label: 'Custom mode',
    },
  ];

  const localized = maps.localizeOverrideSummary(rows);
  assert.equal(localized[0].level, 'Role');
  assert.equal(localized[0].target, 'Veterinarian');
  assert.equal(localized[0].mode_label, 'Vet assistant');

  assert.equal(localized[1].level, 'Platform');
  assert.equal(localized[1].target, 'Inpatient / private cases');
  assert.equal(localized[1].mode_label, 'Local backup perimeter');

  assert.equal(localized[2].level, 'Custom level');
  assert.equal(localized[2].target, 'Custom target');
  assert.equal(localized[2].mode_label, 'Custom mode');
});
