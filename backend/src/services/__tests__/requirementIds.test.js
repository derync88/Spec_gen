import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fingerprint,
  emptyRegistry,
  registryFromRows,
  assignStableIds,
} from '../requirementIds.js';

test('fingerprint normalises case, punctuation, and whitespace', () => {
  assert.equal(
    fingerprint('The system SHALL  require   auth!!'),
    fingerprint('the system shall require auth')
  );
});

test('assignStableIds mints sequential FR/NFR ids per kind', () => {
  const reg = emptyRegistry();
  const { items } = assignStableIds(
    [
      { type: 'functional', text: 'A' },
      { type: 'non-functional', text: 'B' },
      { type: 'functional', text: 'C' },
    ],
    reg
  );
  assert.deepEqual(items.map((i) => i.id), ['FR-1', 'NFR-1', 'FR-2']);
});

test('AC-8.1/8.3: the same requirement keeps its id across re-runs', () => {
  const reg = emptyRegistry();
  const first = assignStableIds([{ type: 'functional', text: 'users can log in' }], reg);
  assert.equal(first.items[0].id, 'FR-1');

  // A later review of the same spec re-uses the persisted registry.
  const reg2 = registryFromRows(
    first.added.map((a) => ({ stable_id: a.stableId, fingerprint: a.fingerprint, kind: a.kind }))
  );
  const second = assignStableIds(
    [{ type: 'functional', text: 'Users can log in.' }], // trivially reworded
    reg2
  );
  assert.equal(second.items[0].id, 'FR-1');
  assert.equal(second.added.length, 0, 'no new id minted for an existing requirement');
});

test('AC-8.2: a deleted requirement\'s id is never reassigned to a different one', () => {
  // Registry persisted with FR-1 already claimed; the FR-1 requirement is gone.
  const reg = registryFromRows([{ stable_id: 'FR-1', fingerprint: fingerprint('old gone req'), kind: 'FR' }]);
  const { items, added } = assignStableIds([{ type: 'functional', text: 'a brand new requirement' }], reg);
  assert.equal(items[0].id, 'FR-2', 'new requirement gets a fresh number, not the freed FR-1');
  assert.equal(added[0].stableId, 'FR-2');
});

test('registryFromRows restores counters from persisted max (NFR-8)', () => {
  const reg = registryFromRows([
    { stable_id: 'FR-5', fingerprint: 'x', kind: 'FR' },
    { stable_id: 'NFR-2', fingerprint: 'y', kind: 'NFR' },
  ]);
  assert.equal(reg.counters.FR, 5);
  assert.equal(reg.counters.NFR, 2);
});

test('FR-3: provenance source is set server-side by sourceKind', () => {
  const reg = emptyRegistry();
  const ex = assignStableIds([{ type: 'functional', text: 'draft req' }], reg, 'existing');
  const sg = assignStableIds([{ type: 'functional', text: 'new req' }], reg, 'suggested');
  assert.equal(ex.items[0].source, 'user');
  assert.equal(sg.items[0].source, 'model-suggested');
});
