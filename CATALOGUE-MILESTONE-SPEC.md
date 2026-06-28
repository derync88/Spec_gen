# Specification: Spec Generator — Catalogue & Auto-Classification Milestone

## Milestone Goal
Extend the Spec Generator from a draft **reviewer** into a catalogue-driven **composer** — so a user can
describe a *platform* with minimal input and receive high-coverage, appropriately-firm candidate
requirements drawn from a curated archetype catalogue, while every item still passes through the existing
human-in-the-loop acceptance gate. This milestone adds *where suggestions come from* (composition); it does
**not** alter *what is allowed into a spec* (the existing control floor stands).

**Reconciliation principle:** a catalogue archetype is a new *source of suggestions*, not a parallel
pipeline. Every catalogue-derived item enters as a suggestion with provenance and flows through the
existing accept/reject/edit gate (FR-1), the provenance label (FR-3), and the no-silent-injection
guarantee (NFR-4). This milestone reuses those rather than re-implementing them.

## Scope Boundaries

### In Scope
- A curated archetype catalogue (foundations, surfaces, operations, cross-cutting packs, device targets,
  blueprints) as a versioned knowledge base grounding suggestion generation.
- **Mode A** — user selects blueprint / archetypes / device targets to scope the review.
- **Mode B** — user writes free-text requirements and, on one action, each is auto-matched to the correct
  archetype(s) and pre-populated, removing manual selection.
- A prescription level (constraint / advisory / silent-default) per catalogue suggestion, mapped onto the
  existing MoSCoW model.
- Archetype-specialised gap probes feeding the existing coverage score.
- Platform composition (union + de-dupe + signal-routed cross-cutting packs + device-target NFR multiply).
- Bulk accept/reject by archetype, to preserve human control at platform scale without click-fatigue.

### Out of Scope (this milestone)
- Building the platforms themselves — the user's existing Claude Code pipeline consumes the exported spec.
- New AI-provider integrations beyond the existing pluggable Claude/OpenAI/mock layer.
- Anything already deferred by the Improvement Milestone (real-time collaboration, deep ticketing).

---

## Functional Requirements

### FR-C1 — Catalogue knowledge base *(Must)*
**The system shall** load a curated archetype catalogue as structured, versioned data that grounds
suggestion generation.
- **AC-C1.1** — Given the catalogue source files, when the backend initialises, then every archetype is
  loaded with fields: `brings_fr`, `leans_nfr`, `watch_for`, `composes_with`, `requires`, `signals`,
  `checkability`, `default_prescription`, `prescription_overrides`, `maturity`, `classifier_hints`.
- **AC-C1.2** — Given a catalogue version, when a review is run, then the spec records the catalogue
  version used (supports reproducibility, complements NFR-2).
- **AC-C1.3** — Given an archetype with a `requires` dependency, when it is selected or matched, then its
  hard dependencies are resolved transitively (e.g. Authorisation pulls Identity).

### FR-C2 — Catalogue selection (Mode A) *(Must)*
**The system shall** let the user select a blueprint, individual archetypes, and device targets to scope
the review, and shall treat those selections as grounding context (extends FR-6).
- **AC-C2.1** — Given the user picks a blueprint, when scoping completes, then its foundations, starter
  surfaces, and default device targets are loaded as the working archetype set.
- **AC-C2.2** — Given each blueprint/archetype, when presented, then its `maturity` rating is shown so the
  user knows how far to trust autopopulation (complements FR-13 sourced view).

### FR-C3 — Auto-classification of free-text requirements (Mode B) *(Must)*
**The system shall**, on a single user action, match each free-text requirement to one or more catalogue
archetypes and pre-populate that archetype's contributed suggestions — so the user need not select
archetypes manually.
- **AC-C3.1** — Given a list of free-text requirements, when the user triggers classification, then each
  requirement returns one or more archetype matches, each with a confidence score.
- **AC-C3.2** — Given a requirement implying multiple archetypes (e.g. "admins manage users"), when
  classified, then all applicable archetypes are returned (multi-label), not only the top one.
- **AC-C3.3** — Given a match, when pre-population runs, then that archetype's `brings_fr`/`leans_nfr`/
  `watch_for` enter the candidate-suggestion set carrying their prescription and checkability tags.

### FR-C4 — Classification confidence and confirmation *(Must)*
**The system shall** present low-confidence matches for explicit confirmation and shall flag requirements
that match no archetype as bespoke — never silently applying or force-fitting.
- **AC-C4.1** — Given a match below the confidence threshold, when classification completes, then it is
  marked `needs_confirmation` and does not enter the candidate set until the user confirms (upholds NFR-4).
- **AC-C4.2** — Given a requirement matching no archetype, when classified, then it is marked
  `unmatched`/bespoke, routed to the standard review path, and tagged Low checkability so the spec spends
  extra detail there (complements FR-9/FR-10).

### FR-C5 — Catalogue suggestions flow through the existing gate *(Must)*
**The system shall** route every catalogue-derived item through the existing suggestion accept/reject/edit
gate, with provenance identifying the originating archetype.
- **AC-C5.1** — Given a catalogue-derived suggestion, when displayed, then its provenance (FR-3) reads
  "model-suggested" and the originating archetype and standard/technique are retrievable (FR-3.2).
- **AC-C5.2** — Given the exported spec, when audited, then every catalogue-derived requirement traces to
  a user-accepted suggestion (satisfies NFR-4 for the catalogue path).

### FR-C6 — Bulk accept/reject by archetype *(Should)*
**The system shall** let the user accept or reject all suggestions originating from one archetype in a
single action, with each remaining individually overridable.
- **AC-C6.1** — Given an archetype contributing N suggestions, when the user chooses "accept all from
  this archetype", then all N move to accepted and each can still be individually edited or rejected.
- **AC-C6.2** — Given bulk controls, when rendered, then accept-all and reject-all carry equal visual
  weight (upholds FR-20 no roach-motel) and are grouped by archetype (supports FR-23 mental-accounting).

### FR-C7 — Prescription level per suggestion *(Should)*
**The system shall** assign each catalogue suggestion a prescription level — constraint, advisory, or
silent-default — and treat each accordingly, mapped onto the existing MoSCoW model.
- **AC-C7.1** — Given a `constraint` item, when surfaced, then it defaults toward Must, is phrased as an
  outcome/boundary, and on acceptance is emitted into the Constraints section (FR-7) and the verification
  set (FR-9).
- **AC-C7.2** — Given an `advisory` item, when surfaced, then it defaults to Should/Could and carries a
  one-line justification tying it to a draft element or context item (consistent with FR-11.2).
- **AC-C7.3** — Given a `silent-default` item, when scoping completes, then it is *not* surfaced as a
  suggestion but recorded as assumed durable context (kept out of the emitted spec body).

### FR-C8 — Archetype-specialised gap probes *(Should)*
**The system shall** run the composed archetypes' `watch_for` items as mandatory coverage probes and feed
unaddressed ones into the existing coverage score and findings.
- **AC-C8.1** — Given a composed set including Data Migration, when the gap pass runs, then absence of a
  reconciliation requirement is reported as a finding and lowers the relevant coverage category (FR-12).
- **AC-C8.2** — Given any `data_classification: personal` signal in the composed set, when scoping
  completes, then the Privacy pack is attached regardless of what the user typed.

### FR-C9 — Platform composition and device targets *(Should)*
**The system shall** union the selected and matched archetype bundles, de-duplicate, attach cross-cutting
packs by signal, and multiply the NFR set by each selected device target — producing a platform-scoped
requirement set rather than a single-app one.
- **AC-C9.1** — Given two archetypes contributing overlapping requirements, when composed, then the
  overlap appears once.
- **AC-C9.2** — Given a selected device target, when composition completes, then its device-specific NFRs
  are present in the working set, de-duplicated against existing NFRs.

### FR-C10 — Constraint phrasing discipline *(Should)*
**The system shall** emit constraint-level requirements as outcomes or boundaries, never as implementation
steps.
- **AC-C10.1** — Given a constraint suggestion, when emitted, then it states a verifiable outcome
  ("authorisation is enforced server-side on every endpoint") rather than a how ("add an authz
  middleware"); the latter form is reworded before emission.

---

## Non-Functional Requirements

### NFR-C1 — Classification accuracy *(Should)* — *ISO 25010: Functional Suitability*
**The system shall** match free-text requirements to archetypes at a reliable rate on a labelled set.
- **AC-NC1.1** — Given a labelled validation set, when classified, then top-1 archetype accuracy ≥
  `VALUE NEEDED` (recommended ≥ 85%) and multi-label recall ≥ `VALUE NEEDED`.

### NFR-C2 — Classification latency *(Should)* — *ISO 25010: Performance Efficiency*
**The system shall** classify a typical requirement list within a bounded time (extends NFR-1).
- **AC-NC2.1** — Given ≤ 30 free-text requirements, when classification is requested, then results return
  within `VALUE NEEDED` seconds (recommended target: 20s) at the 95th percentile.

### NFR-C3 — No silent catalogue injection *(Must)* — *ISO 25010: Functional Suitability*
**The system shall** ensure no catalogue-derived requirement reaches the exported spec without explicit
user acceptance (restates NFR-4 for the catalogue path).
- **AC-NC3.1** — Given the exported spec, when audited, then every catalogue item traces to a user
  acceptance or confirmation event.

### NFR-C4 — Catalogue maintainability *(Should)* — *ISO 25010: Maintainability*
**The system shall** version the catalogue independently of application code so improving an archetype
requires no code change.
- **AC-NC4.1** — Given an edited archetype bundle, when redeployed, then no application code change is
  required for the new content to take effect.

### NFR-C5 — Prescription-ratio guard *(Should)* — *ISO 25010: Functional Suitability*
**The system shall** warn when constraint-tagged items exceed a defined share of emitted requirements,
signalling likely mis-tagging.
- **AC-NC5.1** — Given a generated spec, when constraint-tagged requirements exceed ~20% of the total,
  then a warning is surfaced for review.

### NFR-C6 — Classification grouping stability *(Should)* — *ISO 25010: Reliability*
**The system shall** return stable archetype matches for unchanged inputs (extends NFR-2).
- **AC-NC6.1** — Given identical requirement text and catalogue version submitted 5 times, when
  classified, then the set of matched archetypes is identical across runs.

---

## Reconciliation with the Improvement Milestone (reuse, do not duplicate)

*These FRs are **planned** in IMPROVEMENT-SPEC.md, not yet shipped (see sequencing below). This milestone
co-designs with them and treats the acceptance gate as a prerequisite.*

| Capability | Owned by Improvement Milestone FR/NFR (planned) | This milestone |
|---|---|---|
| Accept/reject/edit gate | FR-1 | Catalogue items flow through it (FR-C5) |
| Provenance labelling | FR-3 | Adds archetype to the label (FR-C5.1) |
| Stated assumptions | FR-5 | `silent-default` + low-confidence feed it (FR-C4, FR-C7.3) |
| Context grounding | FR-6 | Mode A selections are context (FR-C2) |
| Constraints / out-of-scope sections | FR-7 | Constraint items populate them (FR-C7.1) |
| Stable IDs | FR-8 | Catalogue items receive stable IDs on acceptance |
| Verification method | FR-9 | Inherited per accepted catalogue item |
| Quantified ACs / VALUE NEEDED | FR-10 | Catalogue NFRs emit thresholds or VALUE NEEDED |
| NFR relevance gate (MoSCoW) | FR-11 | Prescription maps onto it (FR-C7) |
| Coverage score | FR-12 | Archetype probes feed it (FR-C8) |
| No silent injection | NFR-4 | Restated for catalogue (NFR-C3) |

---

## Integration points (grounded to the live code @ derync88/Spec_gen)

**Data model (current schema is `users`, `specs`, `reviews` only):** add one reference table `archetypes`
(seeded from the catalogue files) and one join table `spec_archetypes`
(`spec_id`, `archetype_id`, `mode` = selected|matched, `confidence`, `status` = pending|confirmed|rejected)
— this single table covers both Mode A selections and Mode B matches. There is **no `suggestions` table**:
suggestions live inside `reviews.result` (JSONB) as `suggestedRequirements[]`. So the new per-suggestion
fields (`sourceArchetypeId`, `prescription`, `checkability`) are added to that array's shape in
`services/ai/prompt.js` (`OUTPUT_SCHEMA_DESCRIPTION`) — not via `ALTER TABLE`.

**API (existing routes: `/:id/review`, `/:id/rewrite`, `/:id/export`, `/:id/export-spec`):** add
`GET /api/catalogue` (archetypes + blueprints), `POST /api/specs/:id/archetypes` (Mode A),
`POST /api/specs/:id/classify` (Mode B). Classification runs **before** review so its matched archetypes
ground the review prompt.

**AI engine (`services/ai/`):** the provider contract is currently `review(spec)` and
`rewrite(spec, reviewResult)`, dispatched by `runReview`/`runRewrite` in `index.js`. Add a third operation
`classify(requirements, catalogue)` to each provider (claude / openai / **mock**) and a `runClassify` in
`index.js`, reusing the existing `parseJson` helper. Run a deterministic keyword pre-filter over
`classifier_hints` before the model call. The **mock provider must gain a `classify`** so token-free dev
still runs end-to-end.

**Emitted-spec anatomy:** the rewrite output structure is fixed in `REWRITE_SYSTEM_PROMPT`
(Milestone Goal → Scope → User-Facing Outcomes → FR → NFR → Success Criteria) and deliberately strips
implementation detail — which already enforces "leave the how to Claude". It has **no Constraints or
Out-of-Scope-provenance section**, so FR-C7 (constraints) and the Improvement Milestone's FR-7 require
extending this prompt's heading set.

**Frontend (`pages/SpecEditor.jsx`, `components/ReviewView.jsx`):** SpecEditor has edit/review tabs and
runReview/runRewrite actions with **no accept/reject UI today**. Add a catalogue picker and a "classify"
action on the editor; render archetype provenance + a prescription badge in `ReviewView`; add per-archetype
bulk accept/reject — which depends on the acceptance gate existing first (see sequencing).

**Seed data:** `spec-generator-service-catalogue.md`, `spec-generator-catalogue-audit.md`,
`spec-generator-prescription-dial.md` are the seed corpus for `archetypes` (FR-C1.1).

---

## Confirmed against source — and the sequencing this forces

All three earlier unknowns are now resolved against the live code:
- **Review-result schema:** confirmed — `reviews.result` JSONB carrying `suggestedRequirements[]`
  (id, type, category, text, rationale, istqbTechnique, standardRef, priority, acceptanceCriteria). New
  fields slot into that array.
- **Provider interface:** confirmed — `review` / `rewrite`; `classify` is the clean third operation.
- **Improvement-Milestone status:** **not yet built.** The live app is single-shot — draft → review →
  *auto-merged* rewrite (the rewrite prompt incorporates must/should suggestions automatically) → export.
  No accept/reject gate, no provenance store, no stable-ID registry, no clarifying-question pass.

**Consequence — sequencing.** This milestone's reconciliation principle ("catalogue items flow through the
acceptance gate") assumed that gate exists. It does not. So the dependency is explicit:

> The Improvement Milestone's human-in-the-loop gate (FR-1), provenance (FR-3), and stable IDs (FR-8) are a
> **prerequisite** for this milestone, not a backdrop. Build that gate first; then catalogue suggestions
> become *a source feeding it*. If the catalogue ships against today's auto-merge flow, it would inject
> archetype requirements silently — the exact failure the whole design exists to prevent.

Recommended order: **(1)** Improvement Milestone gate + provenance + stable IDs; **(2)** catalogue store +
`classify`; **(3)** composition, prescription, and bulk-accept on top. Phases 2–3 are independent once (1)
fixes the suggestion/acceptance contract.

---

## Success Criteria
- A user can describe a platform via Mode A or Mode B and receive composed, full-coverage candidate
  requirements without manually authoring each one.
- No catalogue-derived requirement reaches the exported spec without explicit acceptance (NFR-C3 ⇒ NFR-4).
- Low-confidence and unmatched requirements are surfaced for decision, never silently applied (FR-C4).
- Constraint items are phrased as outcomes and stay within the prescription-ratio guard (FR-C10, NFR-C5).
- Catalogue content is improvable without code changes (NFR-C4).

## Traceability
FR-C1 ← catalogue knowledge-base need · FR-C2 ← Mode-A selection request · FR-C3/C4 ← auto-classify
request · FR-C5/C6 ← reconciliation with FR-1/NFR-4 + platform-scale control · FR-C7 ← prescription dial ·
FR-C8 ← archetype-specialised coverage · FR-C9 ← platform composition + device axis · FR-C10 ← outcome-not-
implementation discipline · NFR-C1–C6 ← classification quality, performance, safety, maintainability.
