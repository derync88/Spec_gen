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
 * Run a requirements review for a spec.
 * Returns { provider, model, result } where result is the parsed analysis.
 */
export async function runReview(spec) {
  const provider = pickProvider();
  const { provider: name, model, text } = await provider.review(spec);
  const result = parseJson(text);
  return { provider: name, model, result };
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
