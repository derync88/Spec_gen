/**
 * Composition (FR-C9 / FR-CMP / FR-PR / FR-C8).
 *
 * Turns a spec's CONFIRMED archetypes (Mode A selections + Mode B matches),
 * their transitive `requires`, and signal-triggered cross-cutting packs into
 * candidate suggestions — tagged with provenance (source + sourceArchetypeId),
 * prescription, and checkability. These candidates are MERGED INTO THE REVIEW
 * RESULT so they pass through the existing accept/reject gate (Phase 1). They
 * are never auto-merged into a spec (NFR-C3 / NFR-4).
 *
 * The transform helpers are pure and unit-tested; composeForReview wraps them
 * with DB access.
 */

import { query } from '../db/pool.js';
import { getArchetypesByIds, resolveRequires, archetypeMap } from './catalogue/index.js';
import { keywordPrefilter } from './catalogue/match.js';
import { fingerprint } from './requirementIds.js';

// A single strong keyword hit (confidence 0.55) is enough to suggest a capability;
// the label is a hint on the review card, not a binding classification.
const MIN_CAPABILITY_CONFIDENCE = 0.55;

/**
 * Tag each requirement with its best-matching catalogue capability NAME via the
 * zero-LLM keyword match (same signal the draft editor shows live). Used to label
 * the author's own requirements on the review's compared cards. Requirements that
 * already carry a capability (catalogue-derived) or match nothing are left as-is.
 */
export function attachCapabilities(requirements, archetypes = [...archetypeMap().values()]) {
  const list = Array.isArray(requirements) ? requirements : [];
  if (!list.length) return list;
  const map = new Map(archetypes.map((a) => [a.id, a]));
  const { perRequirement } = keywordPrefilter(
    list.map((r, i) => ({ id: i, text: r.text })),
    archetypes
  );
  return list.map((req, i) => {
    if (req.sourceArchetypeName) return req;
    const top = perRequirement[i]?.candidates?.[0];
    if (!top || top.confidence < MIN_CAPABILITY_CONFIDENCE) return req;
    const name = map.get(top.archetypeId)?.name;
    return name ? { ...req, sourceArchetypeName: name } : req;
  });
}

/** Map a prescription level onto the existing MoSCoW model (FR-C7). */
export function prescriptionToPriority(prescription) {
  if (prescription === 'constraint') return 'must';
  if (prescription === 'advisory') return 'should';
  return 'could';
}

/** Heuristic: does a constraint read as an implementation step rather than an
 *  outcome/boundary? (FR-C10 / FR-PR-02). */
export function isImplementationPhrased(text) {
  return /^\s*(add|write|implement|create|build|install|configure|set up|use)\b/i.test(String(text || ''));
}

/** Verification method from checkability. */
function verificationFor(checkability) {
  return checkability === 'High' ? 'test' : 'analysis';
}

function acFor(item, checkability) {
  return checkability === 'High'
    ? [`Given the platform, when tested, then "${item.text}" holds.`]
    : [`Given the platform, when assessed, then "${item.text}" is satisfied (threshold: VALUE NEEDED).`];
}

/**
 * Expand one archetype into candidate suggestions from its non-silent
 * brings_fr. silent-default items are NOT surfaced (FR-C7.3) — returned
 * separately as referenced durable context.
 */
export function archetypeToCandidates(archetype) {
  const isPack = archetype.layer === 'pack';
  const candidates = [];
  const silentDefaults = [];

  for (const item of archetype.brings_fr || []) {
    const prescription = item.default_prescription || archetype.default_prescription || 'advisory';
    if (prescription === 'silent-default') {
      silentDefaults.push({ text: item.text, sourceArchetypeId: archetype.id });
      continue;
    }
    const checkability = item.checkability || archetype.checkability || 'Mixed';
    candidates.push({
      type: isPack ? 'non-functional' : 'functional',
      category: archetype.name,
      text: item.text,
      rationale: `Contributed by the ${archetype.name} archetype.`,
      justification: `Implied by your catalogue match/selection of "${archetype.name}".`,
      standardRef: (archetype.leans_nfr && archetype.leans_nfr[0]) || '',
      verification: verificationFor(checkability),
      priority: prescriptionToPriority(prescription),
      acceptanceCriteria: acFor(item, checkability),
      source: 'model-suggested',          // FR-C5.1: catalogue items are model-suggested…
      sourceArchetypeId: archetype.id,     // …with the originating archetype retrievable
      sourceArchetypeName: archetype.name, // human-readable capability (for review + spec grouping)
      prescription,
      checkability,
    });
  }
  return { candidates, silentDefaults };
}

/** De-duplicate candidates by normalised text (FR-CMP-01), keeping the firmest. */
export function dedupeCandidates(candidates) {
  const order = { constraint: 0, advisory: 1, 'silent-default': 2 };
  const byFp = new Map();
  for (const c of candidates) {
    const fp = fingerprint(c.text);
    const prev = byFp.get(fp);
    if (!prev || (order[c.prescription] ?? 9) < (order[prev.prescription] ?? 9)) byFp.set(fp, c);
  }
  return [...byFp.values()];
}

/**
 * FR-CMP-02 / AC-C8.2: cross-cutting packs auto-attached from the merged
 * signals, regardless of what the user typed. Returns pack archetype ids.
 */
export function crossCuttingPackIds(archetypes) {
  const touches = new Set();
  let surfacesUi = false;
  let personal = false;
  for (const a of archetypes) {
    const s = a.signals || {};
    for (const t of s.touches || []) touches.add(t);
    if ((s.surfaces || []).includes('ui')) surfacesUi = true;
    if (s.data_classification === 'personal' || (s.touches || []).includes('pii')) personal = true;
  }
  const packs = new Set();
  if (personal) packs.add('pack.privacy');
  if (surfacesUi) packs.add('pack.accessibility');
  if (touches.has('auth') || touches.has('data')) packs.add('pack.security');
  return [...packs];
}

/** Constraint share of a candidate set, with a >20% mis-tag warning (NFR-C5). */
export function constraintRatio(candidates) {
  if (!candidates.length) return { ratio: 0, count: 0, total: 0, warning: null };
  const count = candidates.filter((c) => c.prescription === 'constraint').length;
  const ratio = count / candidates.length;
  const warning = ratio > 0.2
    ? `Constraints are ${Math.round(ratio * 100)}% of composed requirements (>20%) — re-check for advisory items mis-tagged as binding.`
    : null;
  return { ratio, count, total: candidates.length, warning };
}

/** Constraint-phrasing findings (FR-C10): constraints written as a "how". */
export function constraintPhrasingWarnings(candidates) {
  return candidates
    .filter((c) => c.prescription === 'constraint' && isImplementationPhrased(c.text))
    .map((c) => ({ text: c.text, issue: 'Constraint reads as an implementation step; reword as an outcome/boundary.' }));
}

/**
 * Build composition output for a spec from its confirmed archetypes.
 * Returns { candidates, silentDefaults, probes, packsAttached, constraint }.
 */
export async function composeForReview(specId) {
  const { rows } = await query(
    `SELECT DISTINCT archetype_id, mode FROM spec_archetypes
     WHERE spec_id = $1 AND status = 'confirmed'`,
    [specId]
  );
  if (!rows.length) {
    return { candidates: [], silentDefaults: [], probes: [], packsAttached: [], constraint: { ratio: 0, warning: null } };
  }

  const map = archetypeMap();
  const seedIds = rows.map((r) => r.archetype_id);
  // FR-C1.3: pull hard dependencies transitively.
  const withDeps = resolveRequires(seedIds, map);
  // FR-CMP-02: attach cross-cutting packs from the merged signals.
  const seedArchetypes = await getArchetypesByIds(withDeps);
  const packIds = crossCuttingPackIds(seedArchetypes);
  const allIds = [...new Set([...withDeps, ...packIds])];
  const archetypes = await getArchetypesByIds(allIds);

  let candidates = [];
  let silentDefaults = [];
  const probes = [];
  for (const a of archetypes) {
    const { candidates: c, silentDefaults: s } = archetypeToCandidates(a);
    candidates.push(...c);
    silentDefaults.push(...s);
    for (const w of a.watch_for || []) {
      probes.push({ text: w.text, prescription: w.prescription, sourceArchetypeId: a.id, archetypeName: a.name });
    }
  }
  candidates = dedupeCandidates(candidates);

  const constraint = constraintRatio(candidates);
  return {
    candidates,
    silentDefaults,
    probes,
    packsAttached: packIds,
    constraint: { ...constraint, phrasingWarnings: constraintPhrasingWarnings(candidates) },
  };
}
