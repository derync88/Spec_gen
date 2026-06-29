import { query } from '../db/pool.js';
import { httpError } from '../middleware/error.js';
import { runReview, runRewrite, runQuestions, runInferDelivered } from './ai/index.js';
import { computeChangeSummary } from '../utils/diff.js';
import { withDefinitionOfDone } from '../utils/definitionOfDone.js';
import { reconcileRequirementIds, fingerprint } from './requirementIds.js';
import { composeForReview } from './compositionService.js';
import { fetchRepoSnapshot } from './githubService.js';

// Columns common to every spec read, so create/get/update return the same shape.
const SPEC_COLUMNS =
  'id, title, content, context, project_type, objective, repo_url, repo_analysis, created_at, updated_at';

export async function listSpecs(userId) {
  const { rows } = await query(
    `SELECT s.id, s.title, s.updated_at,
            (SELECT coverage_score FROM reviews r WHERE r.spec_id = s.id
             ORDER BY r.created_at DESC LIMIT 1) AS latest_score
     FROM specs s
     WHERE s.user_id = $1
     ORDER BY s.updated_at DESC`,
    [userId]
  );
  return rows;
}

export async function createSpec(userId, { title, content, context, projectType, objective, repoUrl }) {
  if (!title || !title.trim()) throw httpError(400, 'A title is required');
  const { rows } = await query(
    `INSERT INTO specs (user_id, title, content, context, project_type, objective, repo_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${SPEC_COLUMNS}`,
    [
      userId, title.trim(), content || '', context || '',
      projectType === 'existing' ? 'existing' : 'new', objective || '', repoUrl || '',
    ]
  );
  return rows[0];
}

/** Fetch a spec the user owns, with its latest review and version history. */
export async function getSpec(userId, specId) {
  const { rows } = await query(
    `SELECT ${SPEC_COLUMNS} FROM specs WHERE id = $1 AND user_id = $2`,
    [specId, userId]
  );
  const spec = rows[0];
  if (!spec) throw httpError(404, 'Spec not found');

  const review = await query(
    `SELECT id, provider, model, coverage_score, summary, result, markdown,
            rewritten_markdown, questions, answers, decisions, created_at
     FROM reviews WHERE spec_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [specId]
  );
  spec.latestReview = review.rows[0] || null;

  const versions = await query(
    `SELECT id, version_no, origin, coverage_score, change_summary, created_at
     FROM spec_versions WHERE spec_id = $1 ORDER BY version_no DESC`,
    [specId]
  );
  spec.versions = versions.rows;
  return spec;
}

export async function updateSpec(userId, specId, { title, content, context, projectType, objective, repoUrl }) {
  const { rows } = await query(
    `UPDATE specs
     SET title = COALESCE($3, title),
         content = COALESCE($4, content),
         context = COALESCE($5, context),
         project_type = COALESCE($6, project_type),
         objective = COALESCE($7, objective),
         repo_url = COALESCE($8, repo_url),
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING ${SPEC_COLUMNS}`,
    [
      specId, userId, title?.trim() ?? null, content ?? null, context ?? null,
      projectType ?? null, objective ?? null, repoUrl ?? null,
    ]
  );
  if (!rows[0]) throw httpError(404, 'Spec not found');
  return rows[0];
}

export async function deleteSpec(userId, specId) {
  const { rowCount } = await query(
    'DELETE FROM specs WHERE id = $1 AND user_id = $2',
    [specId, userId]
  );
  if (!rowCount) throw httpError(404, 'Spec not found');
}

/** FR-4: generate clarifying questions for the draft, before reviewing. */
export async function generateQuestions(userId, specId) {
  const spec = await getSpec(userId, specId);
  const { questions } = await runQuestions({
    title: spec.title,
    content: spec.content,
    context: spec.context,
    objective: spec.objective,
    delivered: deliveredFrom(spec),
  });
  return { questions };
}

/** Already-delivered requirement texts derived from a prior GitHub deep-read. */
function deliveredFrom(spec) {
  const a = spec.repo_analysis;
  if (!a || !Array.isArray(a.deliveredRequirements)) return [];
  return a.deliveredRequirements.map((d) => (typeof d === 'string' ? d : d.text)).filter(Boolean);
}

/**
 * Run an AI review (grounded in context + clarifying answers), persist it,
 * and return the review row.
 */
export async function reviewSpec(userId, specId, { questions, answers } = {}) {
  const spec = await getSpec(userId, specId);

  const { renderMarkdown } = await import('../utils/markdown.js');
  const reviewData = await runReview({
    title: spec.title,
    content: spec.content,
    context: spec.context,
    objective: spec.objective,
    delivered: deliveredFrom(spec),
    answers,
  });

  // Phase 3 (FR-C9): merge candidate suggestions composed from the spec's
  // CONFIRMED archetypes into the review result, so they pass through the same
  // accept/reject gate as model suggestions (never auto-merged). De-duped
  // against the model's own suggestions by fingerprint (FR-CMP-01).
  const composed = await composeForReview(specId);
  if (composed.candidates.length) {
    const result = reviewData.result || (reviewData.result = {});
    const existing = Array.isArray(result.suggestedRequirements) ? result.suggestedRequirements : [];
    const seen = new Set(existing.map((s) => fingerprint(s.text)));
    const fresh = composed.candidates.filter((c) => !seen.has(fingerprint(c.text)));
    result.suggestedRequirements = [...existing, ...fresh];
    result.catalogueProbes = composed.probes;                  // FR-C8 gap probes
    result.silentDefaults = composed.silentDefaults;           // FR-C7.3 referenced, not emitted
    result.packsAttached = composed.packsAttached;             // FR-CMP-02
    result.constraintRatio = composed.constraint;              // NFR-C5 guard
  }

  // FR-8 / FR-3: assign stable IDs + provenance to every existing and
  // suggested requirement before persisting, so identity is consistent across
  // re-runs, the rewrite, and the version history (mutates reviewData.result).
  await reconcileRequirementIds(specId, reviewData.result);

  const markdown = renderMarkdown({
    title: spec.title,
    content: spec.content,
    review: reviewData,
  });

  const { rows } = await query(
    `INSERT INTO reviews
       (spec_id, provider, model, coverage_score, summary, result, markdown, questions, answers)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, provider, model, coverage_score, summary, result, markdown,
               rewritten_markdown, questions, answers, decisions, created_at`,
    [
      specId,
      reviewData.provider,
      reviewData.model,
      reviewData.result?.coverageScore ?? null,
      reviewData.result?.summary ?? null,
      JSON.stringify(reviewData.result),
      markdown,
      questions ? JSON.stringify(questions) : null,
      answers ? JSON.stringify(answers) : null,
    ]
  );
  return rows[0];
}

/**
 * Existing-project ingestion: deep-read the spec's public GitHub repo, derive the
 * tech stack + already-delivered requirements, and cache them on the spec. The
 * result is KNOWN-STATE only — it grounds the review (so built capabilities are
 * not re-suggested) and is shown read-only; it never becomes an accepted
 * requirement without going through the gate (NFR-C3 / no silent injection).
 */
export async function ingestRepo(userId, specId) {
  const spec = await getSpec(userId, specId);
  if (!spec.repo_url || !spec.repo_url.trim()) {
    throw httpError(400, 'Add a public GitHub repository URL before analysing.');
  }

  const snapshot = await fetchRepoSnapshot(spec.repo_url);
  const inferred = await runInferDelivered(
    { title: spec.title, content: spec.content, context: spec.context, objective: spec.objective },
    snapshot
  );

  const analysis = {
    repo: snapshot.repo,
    stack: inferred.stack,
    deliveredRequirements: inferred.deliveredRequirements,
    truncated: snapshot.truncated,
    provider: inferred.provider,
    model: inferred.model,
    fetchedAt: new Date().toISOString(),
  };

  await query('UPDATE specs SET repo_analysis = $3, updated_at = now() WHERE id = $1 AND user_id = $2', [
    specId,
    userId,
    JSON.stringify(analysis),
  ]);
  return analysis;
}

/**
 * FR-1 / NFR-4 (the gate, pure + testable): partition suggestions into the
 * user-accepted set (with edits applied verbatim, AC-1.3) and the rejected set.
 * Defaults to accepting NOTHING — no suggestion is included without an explicit
 * acceptance (AC-1.2 / no silent injection).
 */
export function selectSuggestions(allSuggestions, selectedIds, edits) {
  const list = Array.isArray(allSuggestions) ? allSuggestions : [];
  const accepted = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const editMap = edits && typeof edits === 'object' ? edits : {};

  const selected = list
    .filter((s) => accepted.has(s.id))
    .map((s) => (editMap[s.id] ? { ...s, text: editMap[s.id], edited: true } : s));
  const rejectedIds = list.map((s) => s.id).filter((id) => !accepted.has(id));

  return { selected, rejectedIds, acceptedIds: [...accepted] };
}

/**
 * Apply the human-in-the-loop gate to the author's OWN requirements.
 *
 * Each existing requirement carries an AI `improvedText` rewrite. The improvement
 * is opt-in (the project's "no silent injection" rule): the spec keeps the
 * author's ORIGINAL wording unless they explicitly accepted the rewrite. Accept
 * adopts the rewrite (or the author's edit of it); reject/pending keep the
 * original. The requirement itself is never dropped.
 *
 * Returns the requirements with `text` resolved to the chosen wording (and the
 * raw `improvedText` cleared so downstream providers can't re-apply it), plus
 * the ids whose improvement was adopted (for provenance).
 */
export function resolveExistingRequirements(existing, selectedIds, edits) {
  const accepted = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const editMap = edits && typeof edits === 'object' ? edits : {};
  const list = Array.isArray(existing) ? existing : [];

  const improvementsAccepted = [];
  const resolved = list.map((e) => {
    const hasImprovement = typeof e.improvedText === 'string' && e.improvedText.trim() !== '';
    const adopt = hasImprovement && accepted.has(e.id);
    if (adopt) improvementsAccepted.push(e.id);
    const finalText = adopt ? (editMap[e.id] || e.improvedText) : e.text;
    return {
      ...e,
      originalText: e.text,
      text: finalText,
      improvementAccepted: adopt,
      improvedText: undefined, // authoritative text is now `text`; don't let providers re-improve
    };
  });

  return { resolved, improvementsAccepted };
}

/**
 * FR-1 / NFR-4: generate a rewritten spec folding in ONLY the user-accepted
 * suggestions, record the accept/reject decisions, and append a new version to
 * the spec's history with a change summary vs the previous version (FR-17).
 * Returns { reviewId, markdown, version }.
 */
export async function rewriteSpec(userId, specId, { selectedIds, edits, rejectedIds: rejectedInput } = {}) {
  const spec = await getSpec(userId, specId);
  if (!spec.latestReview) {
    throw httpError(400, 'Run a review before generating an updated spec');
  }

  const result = spec.latestReview.result || {};
  const allSuggestions = Array.isArray(result.suggestedRequirements)
    ? result.suggestedRequirements
    : [];

  const { selected: selectedSuggestions, rejectedIds, acceptedIds } =
    selectSuggestions(allSuggestions, selectedIds, edits);
  const accepted = new Set(acceptedIds);
  const editMap = edits && typeof edits === 'object' ? edits : {};

  // Gate the author's own requirements: adopt an AI rewrite only where accepted.
  const { resolved: resolvedExisting, improvementsAccepted } =
    resolveExistingRequirements(result.existingRequirements, selectedIds, edits);

  const filteredResult = {
    ...result,
    suggestedRequirements: selectedSuggestions,
    existingRequirements: resolvedExisting,
  };

  const { markdown: rewriteMd } = await runRewrite(
    { title: spec.title, content: spec.content, context: spec.context },
    filteredResult
  );

  // Append a self-verifying Definition of Done built from the accepted
  // requirements. Idempotent: regenerating an already-built spec (including
  // historic ones predating this section) replaces any prior copy rather than
  // stacking a second one.
  const markdown = withDefinitionOfDone(rewriteMd, filteredResult);

  // Record decisions on the review (FR-15 / provenance). Accepted spans both new
  // suggestions and adopted improvements; explicit existing-requirement rejects
  // are folded in so the per-card state restores on reload.
  const explicitRejected = Array.isArray(rejectedInput) ? rejectedInput : [];
  const decisions = {
    accepted: [...new Set([...accepted, ...improvementsAccepted])],
    rejected: [...new Set([...rejectedIds, ...explicitRejected])],
    edits: editMap,
    decidedAt: new Date().toISOString(),
  };
  await query('UPDATE reviews SET rewritten_markdown = $2, decisions = $3 WHERE id = $1', [
    spec.latestReview.id,
    markdown,
    JSON.stringify(decisions),
  ]);

  const version = await appendVersion(specId, {
    reviewId: spec.latestReview.id,
    origin: 'rewrite',
    markdown,
    coverageScore: spec.latestReview.coverage_score ?? null,
  });

  return { reviewId: spec.latestReview.id, markdown, version, decisions };
}

/** FR-17: list version history (summaries, no full markdown). */
export async function listVersions(userId, specId) {
  await getSpec(userId, specId); // ownership check
  const { rows } = await query(
    `SELECT id, version_no, origin, coverage_score, change_summary, created_at
     FROM spec_versions WHERE spec_id = $1 ORDER BY version_no DESC`,
    [specId]
  );
  return rows;
}

/** FR-17: fetch a single version's full markdown (for view / diff / export). */
export async function getVersion(userId, specId, versionId) {
  await getSpec(userId, specId); // ownership check
  const { rows } = await query(
    `SELECT id, version_no, origin, coverage_score, change_summary, markdown, created_at
     FROM spec_versions WHERE id = $1 AND spec_id = $2`,
    [versionId, specId]
  );
  if (!rows[0]) throw httpError(404, 'Version not found');
  return rows[0];
}

/**
 * FR-17 (AC-17.4): revert by appending the chosen version's content as a NEW
 * version — prior versions are preserved, never deleted.
 */
export async function revertToVersion(userId, specId, versionId) {
  const spec = await getSpec(userId, specId);
  const target = await getVersion(userId, specId, versionId);

  const version = await appendVersion(specId, {
    reviewId: spec.latestReview?.id ?? null,
    origin: 'revert',
    markdown: target.markdown,
    coverageScore: target.coverage_score ?? null,
  });

  if (spec.latestReview) {
    await query('UPDATE reviews SET rewritten_markdown = $2 WHERE id = $1', [
      spec.latestReview.id,
      target.markdown,
    ]);
  }
  return { version, markdown: target.markdown };
}

/** Insert the next version row with a change summary vs the current latest. */
async function appendVersion(specId, { reviewId, origin, markdown, coverageScore }) {
  const prev = await query(
    `SELECT version_no, markdown FROM spec_versions
     WHERE spec_id = $1 ORDER BY version_no DESC LIMIT 1`,
    [specId]
  );
  const prevRow = prev.rows[0];
  const nextNo = (prevRow?.version_no ?? 0) + 1;
  const changeSummary = computeChangeSummary(prevRow?.markdown ?? '', markdown);

  const { rows } = await query(
    `INSERT INTO spec_versions
       (spec_id, review_id, version_no, origin, markdown, coverage_score, change_summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, version_no, origin, coverage_score, change_summary, created_at`,
    [specId, reviewId, nextNo, origin, markdown, coverageScore, JSON.stringify(changeSummary)]
  );
  return rows[0];
}
