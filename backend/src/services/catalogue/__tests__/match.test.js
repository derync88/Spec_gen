import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreArchetype, confidenceFromHits, keywordPrefilter } from '../match.js';

const AUTH = {
  id: 'foundation.identity', name: 'Identity',
  classifier_hints: ['login', 'sign in', 'password', 'auth'], user_says: ['users can sign in'],
};
const CRUD = {
  id: 'surface.crud-admin', name: 'CRUD admin',
  classifier_hints: ['manage records', 'admin console', 'manage users'], user_says: [],
};

test('single-word hints match on a word boundary, not as a substring', () => {
  assert.equal(scoreArchetype('the author wrote it', AUTH).hits, 0, '"auth" must not match "author"');
  assert.ok(scoreArchetype('users auth here', AUTH).hits >= 1);
});

test('multi-word hints match as substrings', () => {
  assert.ok(scoreArchetype('admins manage users in the console', CRUD).hits >= 1);
});

test('confidenceFromHits rises with hits and is bounded to 1', () => {
  assert.equal(confidenceFromHits(0), 0);
  assert.ok(confidenceFromHits(1) < confidenceFromHits(2));
  assert.ok(confidenceFromHits(10) <= 1);
});

test('keywordPrefilter is multi-label and collects the candidate union (FR-CL-04)', () => {
  const reqs = [{ id: 'R1', text: 'users can sign in with a password and admins manage users' }];
  const { perRequirement, candidateIds } = keywordPrefilter(reqs, [AUTH, CRUD]);
  const ids = perRequirement[0].candidates.map((c) => c.archetypeId);
  assert.ok(ids.includes('foundation.identity'));
  assert.ok(ids.includes('surface.crud-admin'));
  assert.ok(candidateIds.has('foundation.identity') && candidateIds.has('surface.crud-admin'));
});
