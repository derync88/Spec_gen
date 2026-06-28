import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  prescriptionToPriority,
  isImplementationPhrased,
  archetypeToCandidates,
  dedupeCandidates,
  crossCuttingPackIds,
  constraintRatio,
  constraintPhrasingWarnings,
} from '../compositionService.js';

const ARCHETYPE = {
  id: 'foundation.authorisation', name: 'Authorisation', layer: 'foundation',
  checkability: 'High', default_prescription: 'constraint', leans_nfr: ['Security'],
  brings_fr: [
    { text: 'Access is denied by default and granted explicitly.', default_prescription: 'constraint', checkability: 'High' },
    { text: 'A permission model governs access.', default_prescription: 'advisory', checkability: 'High' },
    { text: 'Library choice follows conventions.', default_prescription: 'silent-default', checkability: 'High' },
  ],
  watch_for: [],
};

test('FR-C7: prescription maps onto MoSCoW', () => {
  assert.equal(prescriptionToPriority('constraint'), 'must');
  assert.equal(prescriptionToPriority('advisory'), 'should');
  assert.equal(prescriptionToPriority('silent-default'), 'could');
});

test('FR-C7.3: silent-default items are not surfaced as candidates', () => {
  const { candidates, silentDefaults } = archetypeToCandidates(ARCHETYPE);
  assert.equal(candidates.length, 2);
  assert.equal(silentDefaults.length, 1);
  assert.ok(candidates.every((c) => c.prescription !== 'silent-default'));
});

test('FR-C5/C7: candidates carry provenance, prescription, and checkability', () => {
  const { candidates } = archetypeToCandidates(ARCHETYPE);
  const constraint = candidates.find((c) => c.prescription === 'constraint');
  assert.equal(constraint.sourceArchetypeId, 'foundation.authorisation');
  assert.equal(constraint.source, 'model-suggested');
  assert.equal(constraint.priority, 'must');
  assert.equal(constraint.checkability, 'High');
  assert.ok(constraint.acceptanceCriteria.length >= 1);
});

test('pack archetypes contribute non-functional candidates', () => {
  const pack = { id: 'pack.privacy', name: 'Privacy', layer: 'pack', checkability: 'Mixed', default_prescription: 'constraint',
    brings_fr: [{ text: 'Consent, export, deletion, retention exist.', default_prescription: 'constraint', checkability: 'Mixed' }], watch_for: [] };
  const { candidates } = archetypeToCandidates(pack);
  assert.equal(candidates[0].type, 'non-functional');
});

test('FR-CMP-01: dedupe keeps the firmest prescription for identical text', () => {
  const out = dedupeCandidates([
    { text: 'Results are permission-aware.', prescription: 'advisory' },
    { text: 'Results are permission-aware.', prescription: 'constraint' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].prescription, 'constraint');
});

test('FR-CMP-02 / AC-C8.2: cross-cutting packs auto-attach from signals', () => {
  const packs = crossCuttingPackIds([
    { signals: { surfaces: ['ui'], touches: ['auth', 'pii'], data_classification: 'personal' } },
  ]);
  assert.ok(packs.includes('pack.privacy'));     // personal data
  assert.ok(packs.includes('pack.accessibility')); // ui surface
  assert.ok(packs.includes('pack.security'));    // auth/data
});

test('NFR-C5: constraint ratio warns above 20%', () => {
  const many = [
    { prescription: 'constraint' }, { prescription: 'constraint' },
    { prescription: 'advisory' }, { prescription: 'advisory' },
  ];
  assert.ok(constraintRatio(many).warning);
  const few = [
    { prescription: 'constraint' }, { prescription: 'advisory' }, { prescription: 'advisory' },
    { prescription: 'advisory' }, { prescription: 'advisory' }, { prescription: 'advisory' },
  ];
  assert.equal(constraintRatio(few).warning, null);
});

test('FR-C10: implementation-phrased constraints are flagged', () => {
  assert.ok(isImplementationPhrased('Add an authz middleware'));
  assert.ok(!isImplementationPhrased('Authorisation is enforced server-side on every endpoint'));
  const warnings = constraintPhrasingWarnings([
    { prescription: 'constraint', text: 'Write a validation layer' },
    { prescription: 'constraint', text: 'No data is lost during migration' },
  ]);
  assert.equal(warnings.length, 1);
});
