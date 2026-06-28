import OpenAI from 'openai';
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

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

/** Generate clarifying questions for a draft. Returns { provider, model, text }. */
export async function questions(spec) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: QUESTIONS_SYSTEM_PROMPT },
      { role: 'user', content: buildQuestionsUserPrompt(spec) },
    ],
  });

  const text = completion.choices[0]?.message?.content || '';
  return { provider: 'openai', model: MODEL, text };
}

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

/** Classify free-text requirements against candidate archetypes (FR-CL). */
export async function classify(requirements, candidates) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
      { role: 'user', content: buildClassifyUserPrompt(requirements, candidates) },
    ],
  });

  const text = completion.choices[0]?.message?.content || '';
  return { provider: 'openai', model: MODEL, text };
}

/** Read an existing repo snapshot → stack + already-delivered requirements. */
export async function inferDelivered(spec, snapshot) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: INFER_DELIVERED_SYSTEM_PROMPT },
      { role: 'user', content: buildInferDeliveredUserPrompt(spec, snapshot) },
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
