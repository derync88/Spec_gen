import * as claude from './claudeProvider.js';
import * as openai from './openaiProvider.js';
import * as mock from './mockProvider.js';

/**
 * Pick the active provider based on env config and available API keys.
 * Falls back to the mock reviewer when the chosen provider has no key, so the
 * app always works out of the box.
 */
function pickProvider() {
  const choice = (process.env.AI_PROVIDER || 'claude').toLowerCase();

  if (choice === 'openai') {
    return process.env.OPENAI_API_KEY ? openai : mock;
  }
  if (choice === 'mock') return mock;

  // default: claude
  return process.env.ANTHROPIC_API_KEY ? claude : mock;
}

/** Extract a JSON object from a model response that may contain stray prose/fences. */
function parseJson(text) {
  if (!text) throw new Error('Empty response from AI provider');

  // Strip ```json ... ``` fences if present.
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to the first {...} span.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('AI response was not valid JSON');
  }
}

/** Strip ```...``` fences a model may wrap around markdown output. */
function stripFences(text) {
  if (!text) return '';
  const t = text.trim();
  const fence = t.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : t;
}

/**
 * Generate clarifying questions for a draft (FR-4).
 * Returns { provider, model, questions }.
 */
export async function runQuestions(spec) {
  const provider = pickProvider();
  const { provider: name, model, text } = await provider.questions(spec);
  const parsed = parseJson(text);
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return { provider: name, model, questions };
}

/**
 * Run a requirements review for a spec.
 * `spec` may carry { title, content, context, answers }.
 * Returns { provider, model, result } where result is the parsed analysis.
 */
export async function runReview(spec) {
  const provider = pickProvider();
  const { provider: name, model, text } = await provider.review(spec);
  const result = parseJson(text);
  return { provider: name, model, result };
}

/**
 * Author a full requirement set for a spec from its title + objective (+ optional
 * already-delivered context) — the generation workflow. `spec` may carry
 * { title, objective, context, delivered }. Returns { provider, model, result }
 * where result.suggestedRequirements are the authored requirements.
 */
export async function runGenerate(spec) {
  const provider = pickProvider();
  const { provider: name, model, text } = await provider.generate(spec);
  const result = parseJson(text);
  if (!Array.isArray(result.suggestedRequirements)) result.suggestedRequirements = [];
  return { provider: name, model, result };
}

/**
 * Classify free-text requirements against candidate archetypes (FR-CL).
 * Returns { provider, model, classifications }.
 */
export async function runClassify(requirements, candidates) {
  const provider = pickProvider();
  const { provider: name, model, text } = await provider.classify(requirements, candidates);
  const parsed = parseJson(text);
  const classifications = Array.isArray(parsed.classifications) ? parsed.classifications : [];
  return { provider: name, model, classifications };
}

/**
 * Read an existing project's repo snapshot and derive its tech stack + the
 * requirements it already delivers (existing-project ingestion).
 * Returns { provider, model, stack, deliveredRequirements }.
 */
export async function runInferDelivered(spec, snapshot) {
  const provider = pickProvider();
  const { provider: name, model, text } = await provider.inferDelivered(spec, snapshot);
  const parsed = parseJson(text);
  return {
    provider: name,
    model,
    stack: Array.isArray(parsed.stack) ? parsed.stack : [],
    deliveredRequirements: Array.isArray(parsed.deliveredRequirements) ? parsed.deliveredRequirements : [],
  };
}

/**
 * Rewrite a spec, incorporating a prior review's findings, into a structured
 * Markdown document. Returns { provider, model, markdown }.
 */
export async function runRewrite(spec, reviewResult) {
  const provider = pickProvider();
  const { provider: name, model, markdown } = await provider.rewrite(spec, reviewResult);
  return { provider: name, model, markdown: stripFences(markdown) };
}
