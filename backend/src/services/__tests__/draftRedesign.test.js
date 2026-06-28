import { test } from 'node:test';
import assert from 'node:assert/strict';

import { keywordPrefilter } from '../catalogue/match.js';
import { loadCatalogue } from '../catalogue/index.js';
import { inferDelivered } from '../ai/mockProvider.js';
import { parseRepoUrl } from '../githubService.js';

// Phase 1 — the live, zero-LLM catalogue lookup the draft editor calls per row.
test('live keyword match maps a sign-in requirement to the identity archetype', () => {
  const archetypes = loadCatalogue().archetypes;
  const { perRequirement } = keywordPrefilter([{ id: 'R1', text: 'Users sign in and reset their password' }], archetypes);
  const ids = perRequirement[0].candidates.map((c) => c.archetypeId);
  assert.ok(ids.includes('foundation.identity'), `expected foundation.identity in ${ids.join(', ')}`);
});

test('live keyword match returns no candidates for an off-catalogue requirement', () => {
  const archetypes = loadCatalogue().archetypes;
  const { perRequirement } = keywordPrefilter([{ id: 'R1', text: 'zzzz qqqq wibble' }], archetypes);
  assert.equal(perRequirement[0].candidates.length, 0);
});

// Phase 3 — mock ingestion is deterministic, keyless, and evidence-based.
test('mock inferDelivered derives stack + delivered requirements from a snapshot', async () => {
  const snapshot = {
    stack: ['JavaScript'],
    fileTree: ['src/auth/login.js', 'src/routes/api.js', 'src/models/user.js', 'tests/user.test.js'],
    files: [{ path: 'src/auth/login.js', content: 'export function login() {}' }],
  };
  const out = await inferDelivered({ title: 'X' }, snapshot);
  const parsed = JSON.parse(out.text);
  assert.deepEqual(parsed.stack, ['JavaScript']);
  assert.ok(parsed.deliveredRequirements.some((d) => /authentication/i.test(d.text)));
  assert.ok(parsed.deliveredRequirements.every((d) => d.evidence));
});

// Phase 3 — repo URL parsing accepts common forms and rejects junk.
test('parseRepoUrl handles URL, .git suffix, and owner/repo shorthand', () => {
  assert.deepEqual(parseRepoUrl('https://github.com/acme/widgets'), { owner: 'acme', repo: 'widgets' });
  assert.deepEqual(parseRepoUrl('https://github.com/acme/widgets.git'), { owner: 'acme', repo: 'widgets' });
  assert.deepEqual(parseRepoUrl('acme/widgets'), { owner: 'acme', repo: 'widgets' });
  assert.throws(() => parseRepoUrl('not a repo'));
});
