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

test('override mode synonyms map to canonical localized labels', () => {
  const maps = buildPlatformAiI18nMaps(t, { debug: false });
  const modeCases = [
    ['standard', 'Standard perimeter'],
    ['default', 'Standard perimeter'],
    ['standard perimeter', 'Standard perimeter'],
    ['стандартный контур', 'Standard perimeter'],
    ['local', 'Local backup perimeter'],
    ['local backup', 'Local backup perimeter'],
    ['local backup perimeter', 'Local backup perimeter'],
    ['локальный резервный контур', 'Local backup perimeter'],
    ['assistant', 'Vet assistant'],
    ['vet assistant', 'Vet assistant'],
    ['ассистент врача', 'Vet assistant'],
  ];

  const rows = modeCases.map(([mode], idx) => ({
    id: `m-${idx}`,
    source_type: 'tenant',
    tenant_key: 'private-cases',
    mode_label: mode,
  }));
  const localized = maps.localizeOverrideSummary(rows);

  localized.forEach((row, idx) => {
    assert.equal(row.mode_label, modeCases[idx][1], `mode case ${modeCases[idx][0]}`);
  });
});

test('override target and level synonyms are localized consistently', () => {
  const maps = buildPlatformAiI18nMaps(t, { debug: false });
  const rows = [
    { id: 'a', source_type: 'unknown', level: 'роль', target: 'Ветеринарный врач', mode_label: 'assistant' },
    { id: 'b', source_type: 'unknown', level: 'клиника', target: 'ветсеть', mode_label: 'default' },
    { id: 'c', source_type: 'unknown', level: 'платформа', target: 'private island', mode_label: 'local backup' },
    { id: 'd', source_type: 'unknown', level: 'raw', target: 'raw target', mode_label: 'raw mode' },
  ];

  const localized = maps.localizeOverrideSummary(rows);
  assert.equal(localized[0].level, 'Role');
  assert.equal(localized[0].target, 'Veterinarian');

  assert.equal(localized[1].level, 'Clinic');
  assert.equal(localized[1].target, 'VetNet');

  assert.equal(localized[2].level, 'Platform');
  assert.equal(localized[2].target, 'Inpatient / private cases');

  assert.equal(localized[3].level, 'raw');
  assert.equal(localized[3].target, 'raw target');
  assert.equal(localized[3].mode_label, 'raw mode');
});
