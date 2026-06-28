# Spec Generator — Functional & Non-Functional Requirements

**System under specification:** the Spec Generator ("the Generator") — the tool that ingests business
requirements, checks them for coverage gaps, and emits a Claude-Code-ready spec.

**Reading note:** Most functional requirements take the form *"the Generator shall emit / check X."*
Non-functional requirements apply to both the Generator and the specs it produces; the load-bearing one
(NFR-FS-01) is that the Generator's output must pass the same requirement-quality lint the Generator
preaches.

**Conventions used in this document**
- `shall` = mandatory. Each requirement is atomic (one obligation, no "and/or").
- *Acceptance* = the condition that proves the requirement is met, written to map to a test case.
- *Checkability* (where tagged) = High (objective meter / automated test) · Medium (assertable against an
  external standard) · Low (human judgment / UX). Spec detail is spent inversely to checkability.

---

## 1. Functional Requirements

### 1.1 Ingestion & Classification (FR-ING)

**FR-ING-01** — The Generator shall accept a set of business requirements as input and parse it into
discrete, individually addressable requirement items.
*Acceptance:* Given a requirements document of N statements, the Generator produces N (or more, if it
splits compound statements) referenceable items.

**FR-ING-02** — The Generator shall split any compound input requirement containing "and/or" or multiple
obligations into separate atomic items before analysis.
*Acceptance:* No item carried into analysis contains more than one testable obligation.

**FR-ING-03** — The Generator shall classify each input item against the quality taxonomy: ISO/IEC 25010
category, Volere requirement type, owning actor/persona, and lifecycle stage.
*Acceptance:* Every item carries a value (or an explicit "unclassifiable — flag for review") in all four
classification dimensions.

### 1.2 Gap Analysis (FR-GAP)

**FR-GAP-01** — The Generator shall detect empty and thin cells across the eight ISO/IEC 25010 product-
quality categories and report them as candidate gaps.
*Acceptance:* For an input set with zero security-tagged items, the report names "security" as an empty
cell. *Checkability: High.*

**FR-GAP-02** — The Generator shall build a traceability matrix and flag orphans in both directions:
requirements with no source business goal, and business goals with no covering requirement.
*Acceptance:* A goal with no downstream requirement and a requirement with no upstream goal are each
reported with their ID. *Checkability: High.*

**FR-GAP-03** — The Generator shall run structural completeness checks: CRUD-plus-permission completeness
per entity, state-machine transition completeness (including error and timeout transitions) per stateful
entity, happy-path/unhappy-path symmetry, and actor/persona coverage.
*Acceptance:* For an entity specified with only Create and Read, the report flags missing
Update/Delete/List and their permission rules. *Checkability: High.*

**FR-GAP-04** — The Generator shall run an adversarial pass that enumerates ambiguities, implementer
assumptions, and failure modes, and shall convert each into a candidate missing requirement.
*Acceptance:* The pass returns a non-empty list of candidate requirements seeded from the standard
forgotten-NFR cluster (observability, error recovery, data retention/deletion, rate limiting,
i18n, audit, disaster recovery, degraded-mode). *Checkability: Medium.*

**FR-GAP-05** — The Generator shall reference domain-mandated NFR sources relevant to the input
(WCAG 2.2, Australian Privacy Principles, ISM / Essential Eight) and flag categories with no coverage.
*Acceptance:* A UI-bearing input with no accessibility requirement is flagged against WCAG 2.2.
*Checkability: Medium.*

### 1.3 Spec Emission — Anatomy (FR-EMIT)

The emitted spec shall contain each of the following sections. A run that omits any mandatory section is
a defect (see NFR-RE-01).

**FR-EMIT-01** — The Generator shall emit a one-line statement of intent.
*Acceptance:* Spec opens with a single-sentence intent.

**FR-EMIT-02** — The Generator shall emit context and pointers as references, not payload: the stack,
where the feature fits, files/patterns to follow, and what not to touch.
*Acceptance:* Context section cites file paths/modules to follow rather than reproducing their contents.
*Checkability: Medium.*

**FR-EMIT-03** — The Generator shall emit the user-facing goal.
*Acceptance:* Spec states the outcome from the user's perspective, distinct from the intent line.

**FR-EMIT-04** — The Generator shall emit explicit non-goals and an explicit "do not touch" list.
*Acceptance:* Spec contains a non-goals section with ≥1 entry, or an explicit "none" with justification.

**FR-EMIT-05** — The Generator shall emit numbered, atomic functional requirements.
*Acceptance:* Each emitted FR is independently testable and contains one obligation. *Checkability: High.*

**FR-EMIT-06** — The Generator shall emit data-model and interface contracts explicitly: entity shapes
(fields, types, relationships), request/response and DTO shapes, endpoint/interface signatures, and
schema/type definitions — expressed in stack-neutral structural terms and rendered in the target stack's
idiom only at the durable binding point — rather than leaving them to be inferred.
*Acceptance:* Every entity and endpoint referenced by an FR has a defined shape in the contracts section.
*Checkability: High.*

**FR-EMIT-07** — The Generator shall emit non-functional requirements organised by ISO/IEC 25010 category,
each quantified Planguage-style with a scale, meter, and target.
*Acceptance:* No emitted NFR uses an unquantified term ("fast", "user-friendly") without an accompanying
number and unit. *Checkability: High.*

**FR-EMIT-08** — The Generator shall emit a defined failure flow for every success flow, plus edge cases
and error handling.
*Acceptance:* Each happy-path FR has a corresponding unhappy-path FR or an explicit "no failure mode"
justification. *Checkability: High.*

**FR-EMIT-09** — The Generator shall emit acceptance criteria for each requirement, written so each maps
to a test case.
*Acceptance:* Every emitted FR has ≥1 acceptance criterion phrased as a verifiable condition.
*Checkability: High.*

**FR-EMIT-10** — The Generator shall emit a quality-gate definition of done (typecheck clean, lint clean,
tests green, conventions matched).
*Acceptance:* Spec ends with a DoD section enumerating the gates that must pass before merge.

**FR-EMIT-11** — The Generator shall tag each emitted requirement with a checkability score and shall
allocate spec detail inversely to that score (lean where High, richer examples/constraints where Low).
*Acceptance:* Each emitted requirement carries a High/Medium/Low tag; Low-tagged requirements include at
least one worked example or explicit constraint. *Checkability: Medium.*

### 1.4 Routing Signals & Overrides (FR-ROUTE)

**FR-ROUTE-01** — The Generator shall emit routing signals rather than agent instructions — at minimum
`surfaces`, `touches`, and `data_classification` — to be consumed by the pipeline's signal→agent table.
*Acceptance:* A UI feature emits `surfaces: [ui]`; a feature handling personal data emits
`data_classification: personal` and `touches: [pii]`. The spec contains no "run agent X" instruction.
*Checkability: High.*

**FR-ROUTE-02** — The Generator shall provide an optional `additional_review` field for per-spec review
beyond the standard routing.
*Acceptance:* When populated, the field lists named reviewers; when empty, default routing is unaffected.

**FR-ROUTE-03** — The Generator shall provide an optional `waive_review` field, and shall require a non-
empty reason string for every waiver.
*Acceptance:* A waiver without a reason string is rejected as invalid. *Checkability: High.*

### 1.5 Durable/Ephemeral Separation & Decomposition (FR-CTX)

**FR-CTX-01** — The Generator shall reference durable context (CLAUDE.md: stack, conventions, architecture,
gate definitions) rather than re-emitting it into the spec.
*Acceptance:* The emitted spec contains no stack/convention boilerplate already present in CLAUDE.md.
*Checkability: High.*

**FR-CTX-02** — The Generator shall flag any emitted requirement that contradicts the durable layer.
*Acceptance:* A spec asserting a convention different from CLAUDE.md raises a contradiction warning.
*Checkability: Medium.*

**FR-CTX-03** — The Generator shall size each emitted spec unit to fit comfortably in context with room
for the build, and shall mark dependencies and which units are parallelisable.
*Acceptance:* Each unit declares its dependencies (or "none") and a parallelisable flag, enabling safe
concurrent worktree execution. *Checkability: Medium.*

---

## 2. Non-Functional Requirements (by ISO/IEC 25010)

### Functional Suitability

**NFR-FS-01** *(keystone)* — Emitted specs shall conform to INCOSE/ISTQB requirement-quality rules:
atomic, no "and/or", no unbounded quantifiers, no vague terms, no implementation prose.
*Scale/Meter:* lint violations per emitted requirement, by an automated requirement-lint pass.
*Target:* 0 violations across 100% of emitted requirements.

**NFR-FS-02** — Every input business requirement shall be either covered by ≥1 emitted requirement or
explicitly listed as out of scope.
*Scale/Meter:* uncovered, unexplained input requirements per spec.
*Target:* 0.

### Reliability

**NFR-RE-01** — Every emitted spec shall contain all mandatory sections (FR-EMIT-01 … FR-EMIT-11).
*Scale/Meter:* specs missing ≥1 mandatory section, per 100 runs.
*Target:* 0 (mandatory sections are non-skippable; absence is a defect, never a silent opt-out).

**NFR-RE-02** — Given identical input and durable context, repeated runs shall produce structurally
equivalent specs (same sections, same requirement count ±0, same routing signals).
*Scale/Meter:* structural divergence between two runs of identical input.
*Target:* 0 structural divergence (prose wording may vary).

### Interaction Capability (consumability by Claude Code)

**NFR-IC-01** — An emitted spec shall be buildable by Claude Code without a clarifying round-trip.
*Scale/Meter:* forced assumptions — points where Claude must ask or guess — per spec, measured by a
dry-run review pass.
*Target:* 0 forced assumptions.

### Maintainability

**NFR-MA-01** — Routing logic and durable context shall have a single source of truth and shall not be
duplicated into individual specs.
*Scale/Meter:* duplicated boilerplate blocks across a sample of N specs.
*Target:* 0.

**NFR-MA-02** — The signal→agent routing table shall be a separate, versioned config artifact, decoupled
from the spec template, with an explicit documented handoff (the signal block).
*Scale/Meter:* coupling defects — spec changes that require routing edits, or vice versa.
*Target:* 0.

### Security & Privacy (AU-gov context)

**NFR-SE-01** — `data_classification` shall be present and non-default on every spec whose input touches
personal or sensitive data.
*Scale/Meter:* personal-data specs missing a classification, per 100.
*Target:* 0.

**NFR-SE-02** — Every waived verification gate (FR-ROUTE-03) shall be recorded with its reason string in
an audit-retrievable form.
*Scale/Meter:* waivers lacking a logged justification.
*Target:* 0.

### Performance Efficiency *(tune targets to your environment)*

**NFR-PE-01** — The Generator shall produce a complete spec within an acceptable bound for an input set of
typical size.
*Scale/Meter:* wall-clock seconds from input submission to complete spec, for a 30-requirement input.
*Target:* ≤ _[set to your pipeline budget]_ s. *(Placeholder — calibrate against your M5 Pro / pipeline.)*

---

## 3. Verification-Agent Classification *(reference for the pipeline, not the spec)*

To keep gates trustworthy, agents triggered by the routing signals split into two kinds:

- **Blocking verifiers** — assert against an objective external standard with pass/fail (WCAG contrast,
  touch-target size, keyboard nav, focus order; security baselines). These gate the PR.
- **Advisory reviewers** — judgment-based passes (UX feel, product taste). These comment, never block.

*Rationale:* a gate that fails on taste trains the team to ignore gate failures. Only mechanisable checks
get hard gates.

---

*Note: ID prefixes (FR-ING / FR-GAP / FR-EMIT / FR-ROUTE / FR-CTX / NFR-xx) are provisional — renumber to
your M-series convention as needed.*
