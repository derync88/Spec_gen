/**
 * Deterministic keyword matching over the catalogue (FR-CL-04).
 *
 * Pure functions, unit-tested without a DB. Used two ways:
 *  - as the pre-filter that narrows candidate archetypes before the LLM call;
 *  - as the mock provider's whole classification strategy, so token-free dev
 *    runs end-to-end and produces stable matches (NFR-C6).
 */

export function normalise(s) {
  return String(s || '').toLowerCase();
}

/**
 * Score one requirement against one archetype by counting distinct matching
 * phrases from its classifier_hints + user_says. Single-word hints match on a
 * word boundary (so "auth" does not match "author"); multi-word hints match as
 * substrings.
 */
export function scoreArchetype(text, archetype) {
  const t = normalise(text);
  const words = new Set(t.split(/[^a-z0-9]+/).filter(Boolean));
  const phrases = [
    ...(archetype.classifier_hints || []),
    ...(archetype.user_says || []),
  ].map(normalise);

  const matched = new Set();
  for (const p of phrases) {
    if (!p) continue;
    const hit = p.includes(' ') ? t.includes(p) : words.has(p);
    if (hit) matched.add(p);
  }
  return { hits: matched.size, matched: [...matched] };
}

/** Map a keyword-hit count to a 0..1 confidence. 1 hit → 0.55, 2 → 0.75, 3+ → high. */
export function confidenceFromHits(hits) {
  return hits <= 0 ? 0 : Math.min(1, 0.35 + 0.2 * hits);
}

/**
 * Pre-filter: for each requirement, the candidate archetypes with ≥1 keyword
 * hit (ranked), plus the deduped union of candidate ids across all
 * requirements (what gets sent to the LLM). Pure over the provided archetypes.
 */
export function keywordPrefilter(requirements, archetypes) {
  const candidateIds = new Set();
  const perRequirement = (requirements || []).map((req) => {
    const candidates = [];
    for (const a of archetypes) {
      const { hits, matched } = scoreArchetype(req.text, a);
      if (hits > 0) {
        candidates.push({ archetypeId: a.id, hits, confidence: confidenceFromHits(hits), matched });
        candidateIds.add(a.id);
      }
    }
    candidates.sort((x, y) => y.hits - x.hits);
    return { requirementId: req.id, candidates };
  });
  return { perRequirement, candidateIds };
}
