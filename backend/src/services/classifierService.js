/**
 * Mode B — free-text auto-classification (FR-C3/FR-C4).
 *
 * Splits the user's free-text requirements, narrows candidate archetypes with
 * the deterministic keyword pre-filter (FR-CL-04), asks the provider to
 * classify (multi-label), then persists matches to spec_archetypes. Nothing is
 * applied: high-confidence matches are stored 'confirmed' (pre-populated for
 * the gate), low-confidence as 'pending' (needs_confirmation), and the final
 * accept/reject gate (Phase 1) still guards spec entry (NFR-C3 / NFR-4).
 */

import { query } from '../db/pool.js';
import { httpError } from '../middleware/error.js';
import { getSpec } from './specService.js';
import { listArchetypes, resolveRequires, archetypeMap } from './catalogue/index.js';
import { keywordPrefilter } from './catalogue/match.js';
import { runClassify } from './ai/index.js';

/** Confidence at/above which a match is auto-confirmed into the candidate set. */
export const CONFIRM_THRESHOLD = 0.7;

/** Normalise the request payload into [{ id, text }]. */
export function normaliseRequirements(input) {
  let list = [];
  if (Array.isArray(input)) {
    list = input.map((x) => (typeof x === 'string' ? x : x?.text || ''));
  } else if (typeof input === 'string') {
    list = input.split('\n');
  }
  return list
    .map((t) => t.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `R${i + 1}`, text }));
}

/**
 * Post-process raw provider classifications into persisted, enriched matches.
 * Pure given the archetype map — unit-testable without a DB.
 */
export function buildMatches(requirements, classifications, map) {
  const byId = new Map(classifications.map((c) => [c.requirementId, c]));
  return requirements.map((req) => {
    const c = byId.get(req.id) || { matches: [], unmatched: true };
    const matches = (c.matches || [])
      .filter((m) => map.has(m.archetypeId))
      .map((m) => {
        const a = map.get(m.archetypeId);
        const confidence = Math.max(0, Math.min(1, Number(m.confidence) || 0));
        return {
          archetypeId: m.archetypeId,
          name: a.name,
          layer: a.layer,
          defaultPrescription: a.default_prescription,
          checkability: a.checkability,
          confidence,
          status: confidence >= CONFIRM_THRESHOLD ? 'confirmed' : 'pending',
          // FR-C1.3: hard deps this match transitively pulls in (applied at composition).
          pulls: resolveRequires([m.archetypeId], map).filter((id) => id !== m.archetypeId),
        };
      });
    matches.sort((x, y) => y.confidence - x.confidence);
    return { requirementId: req.id, text: req.text, matches, unmatched: matches.length === 0 };
  });
}

/** Classify a spec's free-text requirements (Mode B) and persist the matches. */
export async function classifySpec(userId, specId, { requirements } = {}) {
  await getSpec(userId, specId); // ownership check

  const reqs = normaliseRequirements(requirements);
  if (!reqs.length) throw httpError(400, 'Provide at least one requirement to classify');

  const archetypes = await listArchetypes();
  const { candidateIds } = keywordPrefilter(reqs, archetypes);

  // Send the keyword candidates to the model; if none hit, send all so the
  // model can still match semantically (FR-CL-04 narrows, never blinds).
  const pool = candidateIds.size ? archetypes.filter((a) => candidateIds.has(a.id)) : archetypes;
  const candidates = pool.map((a) => ({
    id: a.id, name: a.name, user_says: a.user_says, classifier_hints: a.classifier_hints,
  }));

  const { provider, model, classifications } = await runClassify(reqs, candidates);
  const map = archetypeMap();
  const results = buildMatches(reqs, classifications, map);

  // Persist: re-classify replaces prior Mode-B matches for this spec.
  await query(`DELETE FROM spec_archetypes WHERE spec_id = $1 AND mode = 'matched'`, [specId]);
  for (const r of results) {
    for (const m of r.matches) {
      await query(
        `INSERT INTO spec_archetypes (spec_id, archetype_id, mode, raw_text, confidence, status)
         VALUES ($1, $2, 'matched', $3, $4, $5)`,
        [specId, m.archetypeId, r.text, m.confidence, m.status]
      );
    }
  }

  const bespoke = results.filter((r) => r.unmatched).map((r) => r.text);
  return { provider, model, results, bespoke };
}

/** List the spec's archetype matches/selections, grouped for the UI. */
export async function listSpecArchetypes(userId, specId) {
  await getSpec(userId, specId);
  const { rows } = await query(
    `SELECT sa.id, sa.archetype_id, sa.mode, sa.raw_text, sa.confidence, sa.status,
            a.name, a.layer, a.default_prescription, a.checkability
     FROM spec_archetypes sa JOIN archetypes a ON a.id = sa.archetype_id
     WHERE sa.spec_id = $1
     ORDER BY sa.confidence DESC NULLS LAST, a.name`,
    [specId]
  );
  return rows;
}

/**
 * Confirm/reject all matches for one archetype on a spec (FR-C4 / bulk-friendly,
 * reused by FR-C6 in Phase 3). status ∈ 'confirmed'|'rejected'|'pending'.
 */
export async function decideArchetype(userId, specId, archetypeId, status) {
  await getSpec(userId, specId);
  if (!['confirmed', 'rejected', 'pending'].includes(status)) {
    throw httpError(400, 'status must be confirmed, rejected, or pending');
  }
  const { rowCount } = await query(
    `UPDATE spec_archetypes SET status = $3 WHERE spec_id = $1 AND archetype_id = $2`,
    [specId, archetypeId, status]
  );
  if (!rowCount) throw httpError(404, 'No such archetype match on this spec');
  return { archetypeId, status, updated: rowCount };
}
