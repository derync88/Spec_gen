import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveExistingRequirements } from '../specService.js';

const EXISTING = [
  { id: 'FR-1', type: 'functional', text: 'Users do the main task.', improvedText: 'The system shall let an authenticated user create, view, edit, and delete a record.' },
  { id: 'FR-2', type: 'functional', text: 'Already a crisp requirement.', improvedText: '' }, // no rewrite offered
];

test('default (no decision) keeps the author original wording — improvements are opt-in', () => {
  const { resolved, improvementsAccepted } = resolveExistingRequirements(EXISTING, [], {});
  assert.equal(resolved[0].text, 'Users do the main task.');
  assert.equal(resolved[0].improvementAccepted, false);
  assert.equal(resolved[0].originalText, 'Users do the main task.');
  assert.deepEqual(improvementsAccepted, []);
});

test('accepting an existing requirement adopts the AI rewrite', () => {
  const { resolved, improvementsAccepted } = resolveExistingRequirements(EXISTING, ['FR-1'], {});
  assert.equal(resolved[0].text, EXISTING[0].improvedText);
  assert.equal(resolved[0].improvementAccepted, true);
  assert.deepEqual(improvementsAccepted, ['FR-1']);
});

test('an edit on an accepted requirement wins over the AI rewrite', () => {
  const { resolved } = resolveExistingRequirements(EXISTING, ['FR-1'], { 'FR-1': 'My own tightened wording.' });
  assert.equal(resolved[0].text, 'My own tightened wording.');
});

test('an edit without acceptance does not change the spec text (still opt-in)', () => {
  const { resolved } = resolveExistingRequirements(EXISTING, [], { 'FR-1': 'Edited but not accepted.' });
  assert.equal(resolved[0].text, 'Users do the main task.');
});

test('a requirement with no rewrite is never altered, even if its id is accepted', () => {
  const { resolved, improvementsAccepted } = resolveExistingRequirements(EXISTING, ['FR-2'], {});
  assert.equal(resolved[1].text, 'Already a crisp requirement.');
  assert.equal(resolved[1].improvementAccepted, false);
  assert.ok(!improvementsAccepted.includes('FR-2'));
});

test('raw improvedText is cleared so downstream providers cannot re-apply it', () => {
  const { resolved } = resolveExistingRequirements(EXISTING, ['FR-1'], {});
  assert.equal(resolved[0].improvedText, undefined);
});

test('handles missing/invalid input safely', () => {
  assert.deepEqual(resolveExistingRequirements(undefined, undefined, undefined).resolved, []);
});
