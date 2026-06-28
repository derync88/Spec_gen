import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectSuggestions } from '../specService.js';

const SUGGESTIONS = [
  { id: 'FR-1', text: 'first' },
  { id: 'FR-2', text: 'second' },
  { id: 'NFR-1', text: 'third' },
];

test('AC-1.2 / NFR-4: default selection accepts nothing', () => {
  const { selected, rejectedIds } = selectSuggestions(SUGGESTIONS, undefined, undefined);
  assert.equal(selected.length, 0);
  assert.deepEqual(rejectedIds, ['FR-1', 'FR-2', 'NFR-1']);
});

test('AC-1.2: only accepted suggestions are included; the rest are rejected', () => {
  const { selected, rejectedIds, acceptedIds } = selectSuggestions(SUGGESTIONS, ['FR-2'], {});
  assert.deepEqual(selected.map((s) => s.id), ['FR-2']);
  assert.deepEqual(acceptedIds, ['FR-2']);
  assert.deepEqual(rejectedIds, ['FR-1', 'NFR-1']);
});

test('AC-1.3: an edit replaces the accepted suggestion text verbatim and flags it', () => {
  const { selected } = selectSuggestions(SUGGESTIONS, ['FR-1'], { 'FR-1': 'rewritten text' });
  assert.equal(selected[0].text, 'rewritten text');
  assert.equal(selected[0].edited, true);
});

test('an edit on a NON-accepted suggestion does not smuggle it in', () => {
  const { selected } = selectSuggestions(SUGGESTIONS, ['FR-1'], { 'FR-2': 'sneaky' });
  assert.deepEqual(selected.map((s) => s.id), ['FR-1']);
});
