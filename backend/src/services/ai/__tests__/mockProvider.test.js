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
