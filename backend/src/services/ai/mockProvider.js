/**
 * Mock reviewer — used when no AI API key is configured, so the whole app
 * runs end-to-end without spending tokens. Returns a realistic, schema-shaped
 * sample derived loosely from the input.
 */
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
        issues: ['Vague ("main task", "should")', 'Not measurable', 'Not independently testable'],
        improvedText: 'The system shall allow an authenticated user to create, view, edit, and delete a {primary entity}, with each operation confirmed within 2 seconds.',
      },
    ],
    suggestedRequirements: [
      {
        id: 'NFR-NEW-1',
        type: 'non-functional',
        category: 'Security',
        text: 'The system shall require authentication for all non-public endpoints and reject unauthenticated requests with HTTP 401.',
        rationale: 'No access-control requirement exists; this is a baseline security gap (ISO 25010 Security).',
        istqbTechnique: 'Decision table testing (auth state × resource sensitivity)',
        standardRef: 'ISO 25010 - Security',
        priority: 'must',
        acceptanceCriteria: ['An unauthenticated request to a protected endpoint returns 401.', 'A valid session can access the resource.'],
      },
      {
        id: 'FR-NEW-1',
        type: 'functional',
        category: 'Input validation',
        text: 'The system shall validate all user-supplied input at the boundary value of each field and reject out-of-range values with a field-level error message.',
        rationale: 'Boundary conditions are a common defect source and are not addressed in the draft.',
        istqbTechnique: 'Boundary value analysis',
        standardRef: '29148 - verifiable, complete',
        priority: 'must',
        acceptanceCriteria: ['Min−1, min, max, max+1 are each handled as specified for every bounded field.'],
      },
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

  const fr = suggested.filter((s) => s.type !== 'non-functional');
  const nfr = suggested.filter((s) => s.type === 'non-functional');

  const bullet = (req) => `- ${req.text || req.improvedText || ''}`;
  const existingFr = existing
    .filter((e) => e.type !== 'non-functional')
    .map((e) => `- ${e.improvedText || e.text}`);

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
    '- Future enhancements identified but not prioritised for this milestone.',
    '',
    '## User-Facing Outcomes',
    '',
    '### Functional Requirements',
    ...(fr.length
      ? fr.map((req) => `- ${req.text}${req.acceptanceCriteria?.[0] ? ` (e.g. ${req.acceptanceCriteria[0]})` : ''}`)
      : ['- Users can complete the primary task end to end.']),
    '',
    '### Non-Functional Requirements',
    ...(nfr.length
      ? nfr.map((req) => `- ${req.text}`)
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
