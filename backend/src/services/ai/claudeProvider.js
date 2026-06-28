import Anthropic from '@anthropic-ai/sdk';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  REWRITE_SYSTEM_PROMPT,
  buildRewriteUserPrompt,
  QUESTIONS_SYSTEM_PROMPT,
  buildQuestionsUserPrompt,
  CLASSIFY_SYSTEM_PROMPT,
  buildClassifyUserPrompt,
  INFER_DELIVERED_SYSTEM_PROMPT,
  buildInferDeliveredUserPrompt,
} from './prompt.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

/** Generate clarifying questions for a draft. Returns { provider, model, text }. */
export async function questions(spec) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    system: QUESTIONS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildQuestionsUserPrompt(spec) }],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return { provider: 'claude', model: MODEL, text };
}

/**
 * Run a review using the Claude API.
 * Returns { provider, model, text } where text is the raw JSON string.
 */
export async function review(spec) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // Adaptive thinking is the recommended mode on Opus 4.8 (no budget_tokens).
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(spec) }],
  });

  // Concatenate text blocks (thinking blocks are skipped).
  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return { provider: 'claude', model: MODEL, text };
}

/** Classify free-text requirements against candidate archetypes (FR-CL). */
export async function classify(requirements, candidates) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Classification is a single-call labelling task — it doesn't need extended
  // thinking. With adaptive thinking on, thinking tokens draw from max_tokens
  // and can truncate the JSON mid-array (parse error). Disable it so the whole
  // budget goes to output, and give generous headroom for large candidate sets.
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'disabled' },
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildClassifyUserPrompt(requirements, candidates) }],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return { provider: 'claude', model: MODEL, text };
}

/** Read an existing repo snapshot → stack + already-delivered requirements. */
export async function inferDelivered(spec, snapshot) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: INFER_DELIVERED_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildInferDeliveredUserPrompt(spec, snapshot) }],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return { provider: 'claude', model: MODEL, text };
}

/** Rewrite the spec incorporating the review. Returns { provider, model, markdown }. */
export async function rewrite(spec, reviewResult) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: REWRITE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildRewriteUserPrompt(spec, reviewResult) }],
  });

  const markdown = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return { provider: 'claude', model: MODEL, markdown };
}
