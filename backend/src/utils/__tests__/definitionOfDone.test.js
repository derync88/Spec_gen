import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefinitionOfDone,
  stripDefinitionOfDone,
  withDefinitionOfDone,
} from '../definitionOfDone.js';

const result = {
  suggestedRequirements: [
    {
      id: 'FR-1',
      type: 'functional',
      text: 'Users can sign in with email and password',
      verification: 'test',
      acceptanceCriteria: ['Given valid credentials, when submitted, a session is created'],
      prescription: 'advisory',
    },
    {
      id: 'NFR-1',
      type: 'non-functional',
      text: 'Authentication responds within 500ms at p95',
      verification: 'analysis',
      acceptanceCriteria: ['p95 latency < 500ms under nominal load'],
      prescription: 'advisory',
    },
    {
      id: 'NFR-2',
      type: 'non-functional',
      text: 'Passwords are stored using a slow hash',
      prescription: 'constraint',
    },
    {
      id: 'FR-9',
      type: 'functional',
      text: 'A silently-defaulted requirement that should never be emitted',
      prescription: 'silent-default',
    },
  ],
};

test('DoD lists each accepted FR as a checkable gate with its acceptance criteria', () => {
  const md = buildDefinitionOfDone(result);
  assert.match(md, /## Definition of Done/);
  assert.match(md, /- \[ \] \*\*FR-1\*\* — Users can sign in/);
  assert.match(md, /Pass when: Given valid credentials/);
  assert.match(md, /Verify by: test/);
});

test('DoD routes constraints and NFRs to their own sections', () => {
  const md = buildDefinitionOfDone(result);
  assert.match(md, /### 3\. Constraints[\s\S]*\*\*NFR-2\*\* — Passwords are stored/);
  assert.match(md, /### 2\. Non-functional gates[\s\S]*\*\*NFR-1\*\* — Authentication responds/);
});

test('DoD never emits silent-default requirements', () => {
  const md = buildDefinitionOfDone(result);
  assert.doesNotMatch(md, /should never be emitted/);
});

test('DoD carries the self-verification protocol and settled-decisions guidance', () => {
  const md = buildDefinitionOfDone(result);
  assert.match(md, /Self-verification protocol/);
  assert.match(md, /produce the evidence/i);
  assert.match(md, /do not ask the user to confirm completion/i);
  assert.match(md, /Settled decisions \(do not re-open or ask about\)/);
});

test('DoD names no concrete stack (target-stack profile rule)', () => {
  const md = buildDefinitionOfDone(result).toLowerCase();
  for (const banned of ['npm', 'eslint', 'vitest', 'jest', 'pytest', 'postgres', 'react', 'django']) {
    assert.doesNotMatch(md, new RegExp(`\\b${banned}\\b`), `should not mention ${banned}`);
  }
});

test('withDefinitionOfDone is idempotent — regenerating replaces, never stacks', () => {
  const base = '# Spec\n\n## Milestone Goal\n\nDeliver it.\n';
  const once = withDefinitionOfDone(base, result);
  const twice = withDefinitionOfDone(once, result);
  assert.equal(once, twice);
  assert.equal((twice.match(/## Definition of Done/g) || []).length, 1);
  // The original body survives.
  assert.match(twice, /## Milestone Goal/);
});

test('stripDefinitionOfDone preserves a following section', () => {
  const md = '# Spec\n\n## Definition of Done\n\nstuff\n\n## After\n\ntail\n';
  const stripped = stripDefinitionOfDone(md);
  assert.doesNotMatch(stripped, /Definition of Done/);
  assert.match(stripped, /## After[\s\S]*tail/);
});

test('DoD provides fallbacks when no requirements were accepted', () => {
  const md = buildDefinitionOfDone({ suggestedRequirements: [] });
  assert.match(md, /Every in-scope functional requirement/);
  assert.match(md, /Non-functional targets/);
  assert.match(md, /No constraint in the Constraints section/);
});
