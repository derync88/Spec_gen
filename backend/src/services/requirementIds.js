/**
 * Stable requirement identifiers (FR-8 / NFR-8).
 *
 * Each requirement gets an ID (e.g. "FR-3" / "NFR-2") that is stable across
 * review re-runs, rewrites, and exports, and is NEVER reassigned to a different
 * requirement. Identity is keyed by a normalised fingerprint of the requirement
 * text; numbers are minted monotonically per spec per kind, so a deleted
 * requirement's number stays claimed and a new one always gets a fresh number.
 *
 * This file is split into a PURE core (fingerprint / assignStableIds) that is
 * unit-tested without a database, and a thin DB-backed wrapper
 * (reconcileRequirementIds) used by the review flow.
 */

import { query } from '../db/pool.js';

/** Prefix per requirement type. */
const PREFIX = { functional: 'FR', 'non-functional': 'NFR' };

/** Provenance labels set server-side (FR-3) — never trusted from the model. */
const SOURCE = { existing: 'user', suggested: 'model-suggested' };

/**
 * Normalise requirement text into a stable matching key. Lower-cases, strips
 * punctuation, and collapses whitespace so trivial rewording maps to the same
 * fingerprint while genuinely different requirements do not collide.
 */
export function fingerprint(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** A fresh, empty in-memory registry. */
export function emptyRegistry() {
  return { map: new Map(), counters: { FR: 0, NFR: 0 } };
}

/**
 * Rebuild the registry from persisted rows so numbering survives restarts
 * (NFR-8). `rows` = [{ stable_id, fingerprint, kind }].
 */
export function registryFromRows(rows) {
  const reg = emptyRegistry();
  for (const r of rows || []) {
    reg.map.set(r.fingerprint, r.stable_id);
    const kind = r.kind === 'NFR' ? 'NFR' : 'FR';
    const n = parseInt(String(r.stable_id).replace(/^\D+/, ''), 10);
    if (Number.isFinite(n) && n > reg.counters[kind]) reg.counters[kind] = n;
  }
  return reg;
}

/**
 * Assign stable IDs to a list of requirement items, reusing existing IDs from
 * the registry and minting new monotonic ones for unseen requirements. Mutates
 * the passed registry (so callers can thread one registry across several lists)
 * and returns the items with `id` + `source` set, plus the entries minted.
 *
 * @param {Array} items - requirement objects with { type, text|improvedText }
 * @param {object} registry - from emptyRegistry()/registryFromRows()
 * @param {string} sourceKind - 'existing' | 'suggested' (sets provenance)
 */
export function assignStableIds(items, registry, sourceKind = 'suggested') {
  const added = [];
  const source = SOURCE[sourceKind] || SOURCE.suggested;
  const out = (items || []).map((item) => {
    const kind = PREFIX[item.type] || 'FR';
    const fp = fingerprint(item.text || item.improvedText || item.id || '');
    let stableId = registry.map.get(fp);
    if (!stableId) {
      registry.counters[kind] += 1;
      stableId = `${kind}-${registry.counters[kind]}`;
      registry.map.set(fp, stableId);
      added.push({ stableId, fingerprint: fp, kind });
    }
    return { ...item, id: stableId, source };
  });
  return { items: out, added };
}

/**
 * DB-backed reconciliation: load the spec's ID registry, assign stable IDs and
 * provenance to the review result's existing + suggested requirements, persist
 * any newly minted IDs, and mutate `result` in place. Existing requirements are
 * processed first so they and the suggestions share one per-spec number space.
 */
export async function reconcileRequirementIds(specId, result) {
  if (!result || typeof result !== 'object') return result;

  const { rows } = await query(
    'SELECT stable_id, fingerprint, kind FROM requirement_ids WHERE spec_id = $1',
    [specId]
  );
  const registry = registryFromRows(rows);

  const existing = assignStableIds(result.existingRequirements, registry, 'existing');
  const suggested = assignStableIds(result.suggestedRequirements, registry, 'suggested');
  result.existingRequirements = existing.items;
  result.suggestedRequirements = suggested.items;

  const added = [...existing.added, ...suggested.added];
  for (const entry of added) {
    await query(
      `INSERT INTO requirement_ids (spec_id, stable_id, fingerprint, kind)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (spec_id, fingerprint) DO NOTHING`,
      [specId, entry.stableId, entry.fingerprint, entry.kind]
    );
  }
  return result;
}
