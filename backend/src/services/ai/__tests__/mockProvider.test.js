import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mock from '../mockProvider.js';

test('mock questions returns 3-8 clarifying questions (FR-4)', async () => {
  const { text } = await mock.questions({ title: 'Demo' });
  const { questions } = JSON.parse(text);
  assert.ok(questions.length >= 3 && questions.length <= 8);
  assert.ok(questions.every((q) => q.id && q.question));
});

test('mock review emits suggestions carrying provenance (FR-3)', async () => {
  const { text } = await mock.review({ title: 'Demo' });
  const result = JSON.parse(text);
  assert.ok(Array.isArray(result.suggestedRequirements));
  assert.ok(result.suggestedRequirements.length > 0);
  assert.ok(result.suggestedRequirements.every((s) => s.source === 'model-suggested'));
});

test('mock rewrite includes ONLY the suggestions it is given (the gate)', async () => {
  const accepted = {
    summary: 'x',
    suggestedRequirements: [
      { id: 'FR-1', type: 'functional', text: 'ACCEPTED requirement text' },
    ],
  };
  const { markdown } = await mock.rewrite({ title: 'Demo', context: '' }, accepted);
  assert.match(markdown, /ACCEPTED requirement text/);
  // A requirement the user did not accept must not appear.
  assert.doesNotMatch(markdown, /reject unauthenticated requests/);
});

test('rewrite groups requirements under capability headings and never leaks archetype IDs', async () => {
  const accepted = {
    suggestedRequirements: [
      { id: 'FR-1', type: 'functional', text: 'Sign-in works', sourceArchetypeId: 'foundation.identity', sourceArchetypeName: 'Identity & Access' },
      { id: 'FR-2', type: 'functional', text: 'Inputs are validated', category: 'Input validation' },
    ],
  };
  const { markdown } = await mock.rewrite({ title: 'Demo', context: '' }, accepted);
  // Capability heading uses the human-readable name; the model-only item lands under Core.
  assert.match(markdown, /#### Identity & Access/);
  assert.match(markdown, /#### Core requirements/);
  // The internal archetype slug is never emitted.
  assert.doesNotMatch(markdown, /foundation\.identity/);
});

test('rewrite stays flat (no capability sub-headings) when nothing has a catalogue capability', async () => {
  const accepted = { suggestedRequirements: [{ id: 'FR-1', type: 'functional', text: 'Just a plain requirement' }] };
  const { markdown } = await mock.rewrite({ title: 'Demo', context: '' }, accepted);
  assert.doesNotMatch(markdown, /#### /);
});
