import { listArchetypes, listBlueprints, loadCatalogue } from '../services/catalogue/index.js';
import { keywordPrefilter } from '../services/catalogue/match.js';

/** GET /api/v1/catalogue — archetypes + blueprints (FR-C2 / Mode A picker). */
export async function get(req, res, next) {
  try {
    const [archetypes, blueprints] = await Promise.all([listArchetypes(), listBlueprints()]);
    res.json({ archetypes, blueprints });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/catalogue/match — deterministic, zero-LLM live lookup used by the
 * draft editor as the user types. Reuses the same keyword pre-filter that narrows
 * candidates before the LLM classify (FR-CL-04), so the inline hints match what a
 * full classify would later consider. Reads the catalogue from the file (no DB,
 * no API key), so it is cheap enough to call per keystroke and works token-free.
 * Body: { requirements: [{ id, text }] }
 * → { perRequirement: [{ requirementId, candidates: [{ archetypeId, name, layer, confidence }] }] }
 */
export async function match(req, res, next) {
  try {
    const requirements = Array.isArray(req.body?.requirements) ? req.body.requirements : [];
    const archetypes = loadCatalogue().archetypes;
    const byId = new Map(archetypes.map((a) => [a.id, a]));
    const { perRequirement } = keywordPrefilter(requirements, archetypes);
    const enriched = perRequirement.map((r) => ({
      requirementId: r.requirementId,
      candidates: r.candidates.slice(0, 5).map((c) => {
        const a = byId.get(c.archetypeId);
        return {
          archetypeId: c.archetypeId,
          name: a?.name || c.archetypeId,
          layer: a?.layer || null,
          confidence: c.confidence,
        };
      }),
    }));
    res.json({ perRequirement: enriched });
  } catch (err) {
    next(err);
  }
}
