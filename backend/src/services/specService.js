import { query } from '../db/pool.js';
import { httpError } from '../middleware/error.js';
import { runReview, runRewrite } from './ai/index.js';

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

export async function createSpec(userId, { title, content }) {
  if (!title || !title.trim()) throw httpError(400, 'A title is required');
  const { rows } = await query(
    `INSERT INTO specs (user_id, title, content)
     VALUES ($1, $2, $3)
     RETURNING id, title, content, created_at, updated_at`,
    [userId, title.trim(), content || '']
  );
  return rows[0];
}

/** Fetch a spec the user owns, with its latest review (if any). */
export async function getSpec(userId, specId) {
  const { rows } = await query(
    'SELECT id, title, content, created_at, updated_at FROM specs WHERE id = $1 AND user_id = $2',
    [specId, userId]
  );
  const spec = rows[0];
  if (!spec) throw httpError(404, 'Spec not found');

  const review = await query(
    `SELECT id, provider, model, coverage_score, summary, result, markdown, rewritten_markdown, created_at
     FROM reviews WHERE spec_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [specId]
  );
  spec.latestReview = review.rows[0] || null;
  return spec;
}

export async function updateSpec(userId, specId, { title, content }) {
  const { rows } = await query(
    `UPDATE specs
     SET title = COALESCE($3, title),
         content = COALESCE($4, content),
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING id, title, content, created_at, updated_at`,
    [specId, userId, title?.trim() ?? null, content ?? null]
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

/** Run an AI review, persist it, and return the review row. */
export async function reviewSpec(userId, specId) {
  const spec = await getSpec(userId, specId);

  const { renderMarkdown } = await import('../utils/markdown.js');
  const reviewData = await runReview({ title: spec.title, content: spec.content });
  const markdown = renderMarkdown({
    title: spec.title,
    content: spec.content,
    review: reviewData,
  });

  const { rows } = await query(
    `INSERT INTO reviews (spec_id, provider, model, coverage_score, summary, result, markdown)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, provider, model, coverage_score, summary, result, markdown, rewritten_markdown, created_at`,
    [
      specId,
      reviewData.provider,
      reviewData.model,
      reviewData.result?.coverageScore ?? null,
      reviewData.result?.summary ?? null,
      JSON.stringify(reviewData.result),
      markdown,
    ]
  );
  return rows[0];
}

/**
 * Generate a rewritten, structured spec from the latest review and persist it
 * on that review row. Returns { reviewId, markdown }.
 */
export async function rewriteSpec(userId, specId) {
  const spec = await getSpec(userId, specId);
  if (!spec.latestReview) {
    throw httpError(400, 'Run a review before generating an updated spec');
  }

  const { markdown } = await runRewrite(
    { title: spec.title, content: spec.content },
    spec.latestReview.result
  );

  await query('UPDATE reviews SET rewritten_markdown = $2 WHERE id = $1', [
    spec.latestReview.id,
    markdown,
  ]);

  return { reviewId: spec.latestReview.id, markdown };
}
