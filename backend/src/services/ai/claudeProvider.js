import Anthropic from '@anthropic-ai/sdk';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  REWRITE_SYSTEM_PROMPT,
  buildRewriteUserPrompt,
} from './prompt.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

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
