/**
 * Definition of Done (DoD) builder.
 *
 * Appended to every built/regenerated spec (all providers, including the mock)
 * so the emitted document carries a binary, self-checkable completion contract.
 *
 * The audience is an autonomous coding agent (e.g. Claude Code). The section is
 * written to do two things the rest of the spec does not:
 *   1. Minimise prompting — settle the decisions an agent would otherwise stop
 *      and ask about (scope, finality of accepted requirements, which gates to
 *      run), so it can proceed without a round-trip to the user.
 *   2. Drive self-verification — every requirement becomes a gate with an
 *      explicit pass condition and a "produce the evidence, not a claim"
 *      protocol, so the agent verifies its own work before declaring done.
 *
 * Like the rest of an emitted spec, the DoD names no framework, language, or
 * datastore (target-stack profile rule): quality gates are described
 * structurally and defer to the target project's own CLAUDE.md / tooling.
 *
 * It is built deterministically from the *accepted* requirements so it always
 * matches what was actually folded into the spec body, and it is idempotent —
 * `stripDefinitionOfDone()` removes any prior copy before a fresh one is added,
 * so regenerating never stacks duplicate sections.
 */

const HEADING = '## Definition of Done';

const clean = (s) => String(s == null ? '' : s).trim();

/** Accepted suggestions that actually reach the spec body, routed like the rewrite. */
function partition(result) {
  const all = Array.isArray(result?.suggestedRequirements) ? result.suggestedRequirements : [];
  const emittable = all.filter((s) => s.prescription !== 'silent-default');
  const constraints = emittable.filter((s) => s.prescription === 'constraint');
  const nonConstraint = emittable.filter((s) => s.prescription !== 'constraint');
  return {
    constraints,
    fr: nonConstraint.filter((s) => s.type !== 'non-functional'),
    nfr: nonConstraint.filter((s) => s.type === 'non-functional'),
  };
}

function gateLines(req) {
  const id = clean(req.id);
  const label = id ? `**${id}** — ` : '';
  const criteria = (Array.isArray(req.acceptanceCriteria) ? req.acceptanceCriteria : [])
    .map(clean)
    .filter(Boolean);
  const passWhen = criteria.length
    ? criteria.join('; ')
    : 'the described behaviour is observable end-to-end without manual patching';
  const verify = clean(req.verification) || 'demonstration';
  return [
    `- [ ] ${label}${clean(req.text)}`,
    `  - Pass when: ${passWhen}`,
    `  - Verify by: ${verify} — produce the evidence (test name, command output, or \`file:line\`), not a claim`,
  ];
}

/**
 * Build the Definition of Done markdown section from the accepted review result.
 * `result.suggestedRequirements` should already be the accepted/edited subset.
 */
export function buildDefinitionOfDone(result) {
  const { constraints, fr, nfr } = partition(result || {});
  const lines = [];

  lines.push(HEADING, '');
  lines.push(
    '> Audience: an autonomous coding agent (e.g. Claude Code). Every item below is a',
    '> binary, self-checkable gate. Verify each gate yourself and report concrete',
    '> evidence — do not ask the user to confirm completion. Surface a question only',
    '> when a gate is blocked by a decision that cannot be resolved from this spec or',
    '> the existing codebase.',
    '',
  );

  lines.push('### 1. Functional gates', '');
  if (fr.length) {
    for (const req of fr) lines.push(...gateLines(req));
  } else {
    lines.push('- [ ] Every in-scope functional requirement runs end-to-end and passes its acceptance criteria.');
  }
  lines.push('');

  lines.push('### 2. Non-functional gates', '');
  if (nfr.length) {
    for (const req of nfr) lines.push(...gateLines(req));
  } else {
    lines.push('- [ ] Non-functional targets (performance, security, reliability, accessibility) are measured and meet their stated values.');
  }
  lines.push('');

  lines.push('### 3. Constraints (binding — a violation fails the milestone)', '');
  if (constraints.length) {
    for (const req of constraints) {
      const id = clean(req.id);
      lines.push(`- [ ] ${id ? `**${id}** — ` : ''}${clean(req.text)} — no code path violates this.`);
    }
  } else {
    lines.push('- [ ] No constraint in the Constraints section above is violated.');
  }
  lines.push('');

  lines.push(
    '### 4. Project quality gates',
    '',
    "Run the gates defined in the target project's CLAUDE.md / tooling. Do not invent",
    'new commands, and do not skip a gate because it looks unrelated to the change.',
    '- [ ] Static analysis / linter: passes with no new errors or warnings.',
    '- [ ] Automated tests: all green, and every functional gate above is exercised by at least one test.',
    '- [ ] Build / compile / type-check: succeeds.',
    '- [ ] Primary user path: runs end-to-end without manual intervention.',
    '',
  );

  lines.push(
    '### 5. Self-verification protocol (run before declaring done)',
    '',
    '1. Walk gates 1–4 in order. For each, capture the evidence that proves it passes —',
    '   a test name, command output, or `file:line`. An unverified assertion does not count.',
    '2. Any gate you cannot evidence is FAILED: the milestone is not done. Fix it, then restart from step 1.',
    '3. After the final change, re-run the entire list — a later fix must not break an earlier gate.',
    '4. Emit one pass/fail table keyed by the gate IDs above as the final report.',
    '',
  );

  lines.push(
    '### 6. Settled decisions (do not re-open or ask about)',
    '',
    '- Scope is exactly the In-Scope list in this spec; Out-of-Scope items are excluded by choice.',
    '- The accepted requirements above are final; rejected suggestions must not be reintroduced.',
    '- The Constraints above are non-negotiable.',
  );

  return lines.join('\n');
}

/**
 * Remove any existing Definition of Done section from a markdown document
 * (from its heading up to the next `## ` heading or end of document). Keeps
 * regeneration idempotent and strips any DoD a provider may have emitted itself.
 */
export function stripDefinitionOfDone(markdown) {
  const md = String(markdown == null ? '' : markdown);
  const idx = md.indexOf(HEADING);
  if (idx === -1) return md;
  const after = md.indexOf('\n## ', idx + HEADING.length);
  const head = md.slice(0, idx).replace(/\s+$/, '');
  if (after === -1) return head ? `${head}\n` : '';
  const tail = md.slice(after + 1); // keep the next "## …" heading
  return `${head}\n\n${tail}`;
}

/** Append (or replace) the Definition of Done section on a built spec markdown. */
export function withDefinitionOfDone(markdown, result) {
  const base = stripDefinitionOfDone(markdown).replace(/\s+$/, '');
  return `${base}\n\n${buildDefinitionOfDone(result)}\n`;
}
