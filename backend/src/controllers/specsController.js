import * as specService from '../services/specService.js';
import * as classifierService from '../services/classifierService.js';
import { httpError } from '../middleware/error.js';

export async function list(req, res, next) {
  try {
    res.json({ specs: await specService.listSpecs(req.userId) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    let { title, content, context, projectType, objective, repoUrl } = req.body;
    // File upload (multer) takes precedence for content.
    if (req.file) {
      content = req.file.buffer.toString('utf8');
      if (!title) title = req.file.originalname.replace(/\.[^.]+$/, '');
    }
    const spec = await specService.createSpec(req.userId, {
      title, content, context, projectType, objective, repoUrl,
    });
    res.status(201).json({ spec });
  } catch (err) {
    next(err);
  }
}

export async function get(req, res, next) {
  try {
    res.json({ spec: await specService.getSpec(req.userId, req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    let { title, content, context, projectType, objective, repoUrl } = req.body;
    if (req.file) content = req.file.buffer.toString('utf8');
    const spec = await specService.updateSpec(req.userId, req.params.id, {
      title, content, context, projectType, objective, repoUrl,
    });
    res.json({ spec });
  } catch (err) {
    next(err);
  }
}

/** Existing-project (FR): deep-read the spec's public GitHub repo as known-state. */
export async function ingestRepo(req, res, next) {
  try {
    const analysis = await specService.ingestRepo(req.userId, req.params.id);
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await specService.deleteSpec(req.userId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function questions(req, res, next) {
  try {
    const result = await specService.generateQuestions(req.userId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function review(req, res, next) {
  try {
    const { questions, answers } = req.body || {};
    const result = await specService.reviewSpec(req.userId, req.params.id, { questions, answers });
    res.json({ review: result });
  } catch (err) {
    next(err);
  }
}

export async function rewrite(req, res, next) {
  try {
    const { selectedIds, edits, rejectedIds } = req.body || {};
    const result = await specService.rewriteSpec(req.userId, req.params.id, { selectedIds, edits, rejectedIds });
    res.json({ rewrite: result });
  } catch (err) {
    next(err);
  }
}

/** Mode B (FR-C3): classify free-text requirements against the catalogue. */
export async function classify(req, res, next) {
  try {
    const { requirements } = req.body || {};
    const result = await classifierService.classifySpec(req.userId, req.params.id, { requirements });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** List a spec's archetype matches/selections. */
export async function archetypes(req, res, next) {
  try {
    res.json({ archetypes: await classifierService.listSpecArchetypes(req.userId, req.params.id) });
  } catch (err) {
    next(err);
  }
}

/** Confirm/reject all matches for one archetype on a spec (FR-C4 / FR-C6). */
export async function decideArchetype(req, res, next) {
  try {
    const { status } = req.body || {};
    const result = await classifierService.decideArchetype(
      req.userId, req.params.id, req.params.archetypeId, status
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listVersions(req, res, next) {
  try {
    res.json({ versions: await specService.listVersions(req.userId, req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function getVersion(req, res, next) {
  try {
    res.json({ version: await specService.getVersion(req.userId, req.params.id, req.params.versionId) });
  } catch (err) {
    next(err);
  }
}

export async function revertVersion(req, res, next) {
  try {
    const result = await specService.revertToVersion(req.userId, req.params.id, req.params.versionId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function exportRewrite(req, res, next) {
  try {
    const spec = await specService.getSpec(req.userId, req.params.id);
    const md = spec.latestReview?.rewritten_markdown;
    if (!md) {
      throw httpError(400, 'No updated spec yet — run a review, then "Update spec with review feedback"');
    }
    const filename = `${(spec.title || 'spec').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-spec.md`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(md);
  } catch (err) {
    next(err);
  }
}

export async function exportMarkdown(req, res, next) {
  try {
    const spec = await specService.getSpec(req.userId, req.params.id);
    const md = spec.latestReview?.markdown;
    if (!md) {
      throw httpError(400, 'No review yet — run a review before exporting');
    }
    const filename = `${(spec.title || 'spec').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(md);
  } catch (err) {
    next(err);
  }
}
