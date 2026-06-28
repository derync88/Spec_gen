import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseRequirements, buildMatches, CONFIRM_THRESHOLD } from '../classifierService.js';
import { archetypeMap } from '../catalogue/index.js';

test('normaliseRequirements splits text, strips bullets, and assigns ids', () => {
  const out = normaliseRequirements('- Users can log in\n\n2) Admins manage users\n');
  assert.deepEqual(out.map((r) => r.id), ['R1', 'R2']);
  assert.equal(out[0].text, 'Users can log in');
  assert.equal(out[1].text, 'Admins manage users');
});

test('normaliseRequirements accepts an array of strings', () => {
  const out = normaliseRequirements(['a requirement', '', '  ']);
  assert.equal(out.length, 1);
  assert.equal(out[0].text, 'a requirement');
});

const map = archetypeMap();

test('FR-C3.1/3.2: buildMatches is multi-label and enriches each match', () => {
  const reqs = [{ id: 'R1', text: 'admins manage users' }];
  const classifications = [{
    requirementId: 'R1',
    matches: [
      { archetypeId: 'surface.crud-admin', confidence: 0.9 },
      { archetypeId: 'foundation.authorisation', confidence: 0.8 },
    ],
    unmatched: false,
  }];
  const [r] = buildMatches(reqs, classifications, map);
  assert.equal(r.matches.length, 2);
  assert.ok(r.matches.every((m) => m.name && m.layer));
  // authorisation transitively pulls identity (FR-C1.3 surfaced).
  const authz = r.matches.find((m) => m.archetypeId === 'foundation.authorisation');
  assert.ok(authz.pulls.includes('foundation.identity'));
});

test('FR-C4.1: low-confidence → needs_confirmation; high → confirmed', () => {
  const reqs = [{ id: 'R1', text: 'x' }];
  const classifications = [{
    requirementId: 'R1',
    matches: [
      { archetypeId: 'foundation.identity', confidence: 0.95 },
      { archetypeId: 'foundation.search', confidence: 0.5 },
    ],
  }];
  const [r] = buildMatches(reqs, classifications, map);
  const byId = Object.fromEntries(r.matches.map((m) => [m.archetypeId, m]));
  assert.equal(byId['foundation.identity'].status, 'confirmed');
  assert.equal(byId['foundation.search'].status, 'pending');
  assert.ok(CONFIRM_THRESHOLD > 0.5 && CONFIRM_THRESHOLD <= 0.95);
});

test('FR-C4.2: unknown archetype ids are dropped; no-match requirement is bespoke', () => {
  const reqs = [{ id: 'R1', text: 'bespoke thing' }];
  const classifications = [{ requirementId: 'R1', matches: [{ archetypeId: 'not.real', confidence: 1 }], unmatched: false }];
  const [r] = buildMatches(reqs, classifications, map);
  assert.equal(r.matches.length, 0);
  assert.equal(r.unmatched, true);
});

test('confidence is clamped to 0..1', () => {
  const reqs = [{ id: 'R1', text: 'x' }];
  const [r] = buildMatches(reqs, [{ requirementId: 'R1', matches: [{ archetypeId: 'foundation.identity', confidence: 5 }] }], map);
  assert.equal(r.matches[0].confidence, 1);
});
