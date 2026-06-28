import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalogue, archetypeMap, resolveRequires } from '../index.js';

test('FR-CAT-01: catalogue loads every archetype with required schema fields', () => {
  const cat = loadCatalogue();
  assert.ok(cat.archetypes.length >= 50);
  for (const a of cat.archetypes) {
    for (const f of ['id', 'layer', 'name', 'classifier_hints', 'brings_fr', 'requires', 'signals', 'default_prescription', 'maturity']) {
      assert.ok(f in a, `${a.id} missing ${f}`);
    }
  }
});

test('catalogue references are internally consistent', () => {
  const cat = loadCatalogue();
  const ids = new Set(cat.archetypes.map((a) => a.id));
  for (const a of cat.archetypes) {
    for (const r of a.requires) assert.ok(ids.has(r), `${a.id} requires unknown ${r}`);
    for (const r of a.composes_with) assert.ok(ids.has(r), `${a.id} composes_with unknown ${r}`);
  }
  for (const b of cat.blueprints) {
    for (const m of [...b.composedOf, ...b.defaultDevices]) assert.ok(ids.has(m), `${b.id} references unknown ${m}`);
  }
});

test('FR-C1.3: resolveRequires pulls hard dependencies transitively', () => {
  const map = archetypeMap();
  const resolved = resolveRequires(['foundation.external-api'], map);
  // external-api → api-contract + authorisation → identity
  assert.ok(resolved.includes('foundation.api-contract'));
  assert.ok(resolved.includes('foundation.authorisation'));
  assert.ok(resolved.includes('foundation.identity'));
});

test('device archetypes pull their required foundations', () => {
  const map = archetypeMap();
  const resolved = resolveRequires(['device.native-mobile'], map);
  assert.ok(resolved.includes('foundation.sync-offline'));
  assert.ok(resolved.includes('foundation.notifications'));
});
