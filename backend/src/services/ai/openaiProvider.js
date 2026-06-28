import OpenAI from 'openai';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  REWRITE_SYSTEM_PROMPT,
  buildRewriteUserPrompt,
} from './prompt.js';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

/**
 * Run a review using the OpenAI API.
 * Returns { provider, model, text } where text is the raw JSON string.
 */
export async function review(spec) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(spec) },
    ],
  });

  const text = completion.choices[0]?.message?.content || '';
  return { provider: 'openai', model: MODEL, text };
}

/** Rewrite the spec incorporating the review. Returns { provider, model, markdown }. */
export async function rewrite(spec, reviewResult) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: REWRITE_SYSTEM_PROMPT },
      { role: 'user', content: buildRewriteUserPrompt(spec, reviewResult) },
    ],
  });

  const markdown = completion.choices[0]?.message?.content || '';
  return { provider: 'openai', model: MODEL, markdown };
}
