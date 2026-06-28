import * as specService from '../services/specService.js';
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
    let { title, content } = req.body;
    // File upload (multer) takes precedence for content.
    if (req.file) {
      content = req.file.buffer.toString('utf8');
      if (!title) title = req.file.originalname.replace(/\.[^.]+$/, '');
    }
    const spec = await specService.createSpec(req.userId, { title, content });
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
    let { title, content } = req.body;
    if (req.file) content = req.file.buffer.toString('utf8');
    const spec = await specService.updateSpec(req.userId, req.params.id, { title, content });
    res.json({ spec });
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

export async function review(req, res, next) {
  try {
    const result = await specService.reviewSpec(req.userId, req.params.id);
    res.json({ review: result });
  } catch (err) {
    next(err);
  }
}

export async function rewrite(req, res, next) {
  try {
    const result = await specService.rewriteSpec(req.userId, req.params.id);
    res.json({ rewrite: result });
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
