/**
 * Mock reviewer — used when no AI API key is configured, so the whole app
 * runs end-to-end without spending tokens. Returns a realistic, schema-shaped
 * sample derived loosely from the input.
 */

import { scoreArchetype, confidenceFromHits } from '../catalogue/match.js';

/**
 * Mock classification (FR-CL). Deterministic keyword scoring over the supplied
 * candidate archetypes, so token-free dev classifies end-to-end and produces
 * stable matches (NFR-C6). Multi-label: every candidate with a keyword hit is
 * returned.
 */
export async function classify(requirements, candidates) {
  const classifications = (requirements || []).map((req) => {
    const matches = [];
    for (const a of candidates || []) {
      const { hits } = scoreArchetype(req.text, a);
      if (hits > 0) matches.push({ archetypeId: a.id, confidence: confidenceFromHits(hits) });
    }
    matches.sort((x, y) => y.confidence - x.confidence);
    return { requirementId: req.id, matches, unmatched: matches.length === 0 };
  });
  return { provider: 'mock', model: 'mock-reviewer', text: JSON.stringify({ classifications }) };
}

/**
 * Mock repo ingestion — deterministic, keyless, network-free (the caller passes
 * the already-fetched snapshot). Derives the stack from detected languages and a
 * small set of evidence-based delivered capabilities by scanning file paths, so
 * token-free dev exercises the existing-project flow end to end.
 */
export async function inferDelivered(spec, snapshot) {
  const s = snapshot || {};
  const paths = (s.files || []).map((f) => f.path.toLowerCase());
  const tree = (s.fileTree || []).map((p) => p.toLowerCase());
  const all = [...new Set([...paths, ...tree])];
  const has = (re) => all.some((p) => re.test(p));

  const SIGNALS = [
    [/(^|\/)(auth|login|session|jwt)/, 'The system provides user authentication.'],
    [/(route|controller|api|endpoint)/, 'The system exposes an HTTP API.'],
    [/(model|schema|migration|entity)/, 'The system persists data via a defined data model.'],
    [/(test|spec)\.[jt]sx?$|_test\.|\/tests?\//, 'The system has an automated test suite.'],
    [/(component|page|view|\.tsx?$|\.jsx$)/, 'The system has a user-facing interface.'],
  ];
  const deliveredRequirements = SIGNALS.filter(([re]) => has(re)).map(([re, text]) => ({
    text,
    evidence: (all.find((p) => re.test(p)) || 'codebase'),
  }));

  const result = { stack: s.stack || [], deliveredRequirements };
  return { provider: 'mock', model: 'mock-reviewer', text: JSON.stringify(result) };
}

/** Mock clarifying questions (FR-4). */
export async function questions(spec) {
  const title = spec.title || 'your spec';
  const result = {
    questions: [
      { id: 'Q1', question: `Who are the primary users/actors of "${title}", and do any have elevated privileges (e.g. admin)?`, why: 'Drives authentication, authorisation, and role-based requirements.' },
      { id: 'Q2', question: 'What data does the system store, and is any of it personal, financial, or otherwise regulated?', why: 'Determines privacy, retention, and compliance requirements.' },
      { id: 'Q3', question: 'What should happen on the main failure paths (invalid input, no network, downstream error)?', why: 'Surfaces error-handling and reliability requirements the happy path hides.' },
      { id: 'Q4', question: 'What scale must it support (users, requests/sec, data volume) at launch?', why: 'Sets concrete performance and capacity targets instead of vague "fast".' },
      { id: 'Q5', question: 'Are there fixed constraints — existing stack, integrations, deadlines, or budget?', why: 'Bounds the solution space and avoids contradicting reality.' },
    ],
  };
  return { provider: 'mock', model: 'mock-reviewer', text: JSON.stringify(result) };
}

export async function review(spec) {
  const title = spec.title || 'Untitled spec';
  const result = {
    coverageScore: 52,
    summary: `Mock review of "${title}". This is sample output produced because no AI provider key is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in backend/.env to get a real, standards-grounded review.`,
    coverageByCategory: [
      { category: 'Functional Suitability', standard: 'ISO 25010', status: 'partial', score: 60, notes: 'Core happy-path requirements present; alternate and error flows under-specified.' },
      { category: 'Security', standard: 'ISO 25010', status: 'missing', score: 20, notes: 'No authn/authz, data protection, or audit requirements found.' },
      { category: 'Performance Efficiency', standard: 'ISO 25010', status: 'missing', score: 25, notes: 'No measurable response-time or throughput targets.' },
      { category: 'Reliability', standard: 'ISO 25010', status: 'partial', score: 45, notes: 'No availability target or failure-recovery behaviour defined.' },
      { category: 'Usability / Interaction', standard: 'ISO 25010', status: 'partial', score: 55, notes: 'Accessibility (WCAG) and error-prevention requirements absent.' },
    ],
    existingRequirements: [
      {
        id: 'FR-1',
        text: 'The system should let users do the main task.',
        type: 'functional',
        smart: { specific: false, measurable: false, achievable: true, relevant: true, testable: false },
        improvedSmart: { specific: true, measurable: true, achievable: true, relevant: true, testable: true },
        issues: ['Vague ("main task", "should")', 'Not measurable', 'Not independently testable'],
        improvedText: 'The system shall allow an authenticated user to create, view, edit, and delete a {primary entity}, with each operation confirmed within 2 seconds.',
      },
    ],
    suggestedRequirements: [
      {
        id: 'NFR-NEW-1',
        source: 'model-suggested',
        type: 'non-functional',
        category: 'Security',
        text: 'The system shall require authentication for all non-public endpoints and reject unauthenticated requests with HTTP 401.',
        rationale: 'No access-control requirement exists; this is a baseline security gap (ISO 25010 Security).',
        justification: 'The draft describes user-specific data but states no access-control rule.',
        istqbTechnique: 'Decision table testing (auth state × resource sensitivity)',
        standardRef: 'ISO 25010 - Security',
        verification: 'test',
        priority: 'must',
        acceptanceCriteria: [
          'Given no valid session, when a protected endpoint is called, then the response status is 401 and no resource data is returned.',
          'Given a valid session, when the same endpoint is called, then the resource is returned with status 200.',
        ],
      },
      {
        id: 'FR-NEW-1',
        source: 'model-suggested',
        type: 'functional',
        category: 'Input validation',
        text: 'The system shall reject out-of-range field values at the boundary and return a field-level error identifying the field and the accepted range.',
        rationale: 'Boundary conditions are a common defect source and are not addressed in the draft.',
        justification: 'The draft accepts user input but specifies no validation behaviour.',
        istqbTechnique: 'Boundary value analysis',
        standardRef: '29148 - verifiable, complete',
        verification: 'test',
        priority: 'must',
        acceptanceCriteria: [
          'Given a bounded field with range [min, max], when min−1 or max+1 is submitted, then the request is rejected with a field-level error.',
          'Given the same field, when min or max is submitted, then the value is accepted.',
        ],
      },
      {
        id: 'NFR-NEW-2',
        source: 'model-suggested',
        type: 'non-functional',
        category: 'Performance Efficiency',
        text: 'The system shall return the primary read operation within a defined latency budget under expected load.',
        rationale: 'No measurable performance target exists; "fast" is not verifiable (INCOSE GtWR).',
        justification: 'No scale or latency figures were provided in the draft or context.',
        istqbTechnique: 'Experience-based testing',
        standardRef: 'ISO 25010 - Performance Efficiency',
        verification: 'test',
        priority: 'could',
        acceptanceCriteria: [
          'Given expected load of VALUE NEEDED requests/sec, when the primary read is called, then p95 latency is ≤ VALUE NEEDED ms.',
        ],
      },
    ],
    assumptions: [
      { text: 'No project context was supplied, so these suggestions are domain-generic and may not reflect real constraints.' },
      { text: 'The system is assumed to be multi-user with per-user data; if single-user, the authentication requirement may be over-scoped.' },
    ],
    gaps: [
      { area: 'Error & alternate flows', description: 'Only the happy path is described; failure and edge cases are undefined.', severity: 'high' },
      { area: 'Non-functional requirements', description: 'No performance, security, reliability, or accessibility targets.', severity: 'high' },
    ],
    ambiguities: [
      { text: '"fast", "easy to use", "should"', problem: 'Subjective / non-verifiable wording (violates INCOSE GtWR).', suggestion: 'Replace with measurable criteria and the imperative "shall".' },
    ],
    traceability: {
      orphans: [
        { item: 'FR-1', issue: 'No parent business goal and no acceptance criteria — not traceable or verifiable.' },
      ],
      notes: 'Establish a goal → requirement → acceptance-criterion chain so every requirement is justified and testable.',
    },
  };

  return { provider: 'mock', model: 'mock-reviewer', text: JSON.stringify(result) };
}

/** Mock rewrite — builds a structured spec from the spec + review result. */
export async function rewrite(spec, reviewResult) {
  const title = spec.title || 'Untitled spec';
  const r = reviewResult || {};
  const suggested = Array.isArray(r.suggestedRequirements) ? r.suggestedRequirements : [];
  const existing = Array.isArray(r.existingRequirements) ? r.existingRequirements : [];

  // FR-C7 prescription routing: silent-defaults are never emitted; constraints
  // become binding Constraints; the rest flow to FR/NFR by type.
  const emittable = suggested.filter((s) => s.prescription !== 'silent-default');
  const constraints = emittable.filter((s) => s.prescription === 'constraint');
  const nonConstraint = emittable.filter((s) => s.prescription !== 'constraint');
  const fr = nonConstraint.filter((s) => s.type !== 'non-functional');
  const nfr = nonConstraint.filter((s) => s.type === 'non-functional');

  const bullet = (req) => `- ${req.text || req.improvedText || ''}`;
  // `text` is already gate-resolved (original wording unless the author accepted
  // the rewrite), so use it verbatim — do not re-apply improvedText here.
  const existingFr = existing
    .filter((e) => e.type !== 'non-functional')
    .map((e) => `- ${e.text || e.improvedText || ''}`);

  const md = [
    `# ${title}`,
    '',
    '## Milestone Goal',
    '',
    r.summary
      ? r.summary.replace(/^Mock review of [^.]+\.\s*/i, '')
      : `Deliver ${title} so that users can accomplish the core task reliably and securely. (Mock rewrite — configure an AI key for a real, tailored rewrite.)`,
    '',
    '## Scope Boundaries',
    '',
    '### In Scope',
    ...(fr.length || existingFr.length
      ? [...existingFr, ...fr.map(bullet)]
      : ['- The core functionality described in the original draft.']),
    '',
    '### Out of Scope',
    '- Anything not listed under In Scope above.',
    '- Review suggestions the author chose not to accept.',
    '',
    '## Constraints',
    ...(constraints.length
      ? constraints.map((req) => `- ${req.id ? `${req.id} — ` : ''}${req.text}`)
      : []),
    ...(spec.context && spec.context.trim()
      ? spec.context.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => `- ${l.replace(/^[-*]\s*/, '')}`)
      : []),
    ...(constraints.length || (spec.context && spec.context.trim()) ? [] : ['- None specified.']),
    '',
    '## User-Facing Outcomes',
    '',
    '### Functional Requirements',
    ...(fr.length
      ? fr.map((req) => `- ${req.id ? `${req.id} — ` : ''}${req.text}${req.acceptanceCriteria?.[0] ? ` (e.g. ${req.acceptanceCriteria[0]})` : ''}`)
      : ['- Users can complete the primary task end to end.']),
    '',
    '### Non-Functional Requirements',
    ...(nfr.length
      ? nfr.map((req) => `- ${req.id ? `${req.id} — ` : ''}${req.text}`)
      : ['- The system responds promptly and protects user data.']),
    '',
    '## Success Criteria',
    ...buildSuccessCriteria(r),
    '',
  ].join('\n');

  return { provider: 'mock', model: 'mock-reviewer', markdown: md };
}

function buildSuccessCriteria(r) {
  const lines = [];
  const all = Array.isArray(r.suggestedRequirements) ? r.suggestedRequirements : [];
  for (const req of all) {
    if (Array.isArray(req.acceptanceCriteria)) {
      for (const ac of req.acceptanceCriteria) lines.push(`- ${ac}`);
    }
  }
  if (!lines.length) {
    lines.push('- All in-scope functional requirements pass their acceptance tests.');
    lines.push('- Non-functional targets (performance, security) are measured and met.');
  }
  return lines;
}
