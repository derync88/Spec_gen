# Build Spec — The Spec Generator

*A Claude-Code-ready specification for building the spec generator. Written to the anatomy the generator
itself emits: intent → pointers → non-goals → contracts → atomic requirements → NFRs → edge cases →
acceptance criteria → gates → build sequence. Each requirement is tagged `[checkability]` and
`{prescription}`.*

---

## 1. Intent

Build a tool that turns a small amount of user input into a full-coverage, appropriately-restrained,
Claude-Code-ready platform spec — by composing curated archetypes from a service catalogue, auto-matching
free-text requirements to those archetypes, checking for gaps, and emitting requirements at the right
level of firmness.

## 2. Context & pointers

- **Target stack — parameterised, not assumed.** The generator is stack-agnostic. The target platform's
  stack (language, framework, client, datastore, deploy target) is a single durable parameter — a *target
  profile* the user sets once in the generated platform's CLAUDE.md. All emitted contracts are expressed
  in stack-neutral structural terms and rendered into a concrete framework only at that one durable point,
  so the same spec serves a Django, Rails, .NET, Spring, Phoenix, or Node platform unchanged. The
  classifier (§FR-CL) requires an LLM
  endpoint; assume the existing Claude/local-model setup.
- **Seed data (this tool's dataset — ingest, do not re-specify):**
  - `spec-generator-service-catalogue.md` — archetypes, blueprints, device axis.
  - `spec-generator-catalogue-audit.md` — the added layers (Delivery, Authorisation, Eventing, External
    API, deepened packs).
  - `spec-generator-prescription-dial.md` — per-archetype `constraint`/`advisory`/`silent-default` tags.
- **Durable layer (reference, never re-emit):** the generated specs assume a CLAUDE.md carrying stack,
  conventions, the standing pipeline, and gate definitions. The generator emits *ephemeral* feature specs
  against that durable layer.
- **Follow:** the spec anatomy and the three dials (checkability, prescription, provenance/ledger).

## 3. User-facing goals

1. A non-technical user describes a platform with minimal input and receives a spec that covers the
   foundations they didn't know to ask for.
2. The emitted spec is **full-coverage** (nothing material silently omitted) yet **not over-prescriptive**
   (Claude Code keeps its judgment).
3. The user can add context two ways — pick from the catalogue, **or** write plain requirements and have
   each auto-matched to the catalogue.
4. Every injected requirement is visible and removable; the user is never surprised by what the spec
   assumed.

## 4. Non-goals (do not build)

- The generator **does not build the apps/platforms**. It emits a spec; the existing Claude Code pipeline
  builds. No code generation, no deployment.
- Not a hosting platform, not a project manager, not a replacement for CLAUDE.md.
- Does not re-implement the catalogue content as code — the catalogue is *data*.
- Does not invent requirements with no provenance — every emitted item traces to user input, a selected
  archetype, or an injected default logged in the ledger.

## 5. Architecture & data flow

```
            ┌── Mode A: catalogue selection ──┐
 user input ┤                                 ├─► COMPOSITION ─► GAP-CHECK ─► PRESCRIPTION ─► EMITTER ─► spec
            └── Mode B: free-text + classify ──┘     │  engine      pass        filter         │
                                                     └──────────── assumption ledger ──────────┘
```

Stages: **Ingest** catalogue → **Input** (Mode A and/or B) → **Compose** (union + de-dupe + signal-routing
+ device multiply) → **Gap-check** (generic 25010 empty-cell + archetype watch-for probes) → **Prescribe**
(apply the dial) → **Emit** (anatomy, tagged) — with the **ledger** recording every non-user-supplied item
throughout.

## 6. Data model & contracts (the durable interface)

**Archetype** (one catalogue entry):
```
Archetype {
  id                     // "foundation.authorisation"
  layer                  // foundation | surface | operation | crosscutting | device | blueprint
  axis                   // product-surface | operation | quality | delivery | target
  name
  user_says[]            // plain-language phrases (also classifier matching hints)
  classifier_hints[]     // keywords/signals that indicate this archetype (Mode B)
  brings_fr[]            // { text, default_prescription, checkability }
  leans_nfr[]            // 25010 category refs
  watch_for[]            // { text, prescription }   (mostly advisory; some constraint)
  composes_with[]        // archetype ids (soft pairings)
  requires[]             // archetype ids (hard dependencies — auto-pulled)
  signals                // { surfaces[], touches[], data_classification }
  checkability           // High | Mixed | Low
  default_prescription   // constraint | advisory | silent-default
  prescription_overrides // [{ item, level }]
  maturity               // battle-tested | mature | experimental
}
```

**UserRequirement** (Mode B input):
```
UserRequirement {
  id; raw_text;
  matches[]    // [{ archetype_id, confidence, status: auto|confirmed|rejected }]
  unmatched    // bool — bespoke/novel, no archetype fits
}
```

**LedgerEntry**:
```
LedgerEntry { requirement_id; source: user|selected|inferred|injected; provenance; removable: true; confidence? }
```

**EmittedRequirement** (output unit):
```
EmittedRequirement {
  text;                  // outcome/constraint phrasing — never implementation
  source;                // user | selected | inferred | injected
  prescription;          // constraint | advisory | silent-default
  checkability;
  acceptance_criteria[]; // verifiable, test-shaped
}
```

**EmittedSpec** = the anatomy sections, each populated with `EmittedRequirement`s, plus the merged
"be cautious of" panel, the assumption ledger, the routing `signals` block, and the computed checkability
profile.

## 7. Functional requirements

### Catalogue store (FR-CAT)
- **FR-CAT-01** Parse the three seed docs into the `Archetype` schema on load. `[High]{silent-default}`
  *Acceptance:* every archetype in the source docs is loaded with all schema fields populated or defaulted.
- **FR-CAT-02** Resolve `requires` transitively so selecting one archetype auto-pulls its hard
  dependencies (e.g. Authorisation requires Identity). `[High]{advisory}`
  *Acceptance:* selecting "External API surface" pulls in API/contract + Authorisation.

### Mode A — catalogue selection (FR-SEL)
- **FR-SEL-01** Let the user pick a blueprint; pre-fill its foundations + starter surfaces + default
  device targets. `[High]{advisory}` *Acceptance:* picking "Two-sided marketplace" loads its full bundle.
- **FR-SEL-02** Let the user add/remove surfaces and toggle device targets. `[High]{advisory}`
- **FR-SEL-03** Surface each blueprint's maturity rating so the user knows how far to trust autopopulation.
  `[Mixed]{advisory}`

### Mode B — free-text auto-classification (FR-CL)  ← the centrepiece
- **FR-CL-01** Accept a list of free-text requirements (typed or pasted) and, on a single action, classify
  each one. `[High]{advisory}` *Acceptance:* a list of 10 plain requirements returns 10 classification
  results.
- **FR-CL-02** Classify **multi-label** — one requirement may map to several archetypes ("admins manage
  users" → CRUD admin + Authorisation). `[Mixed]{advisory}` *Acceptance:* a requirement implying two
  archetypes returns both.
- **FR-CL-03** For each match, pre-populate the contributed FRs, NFRs, watch-fors, and prescription tags
  from that archetype — so the user does not select them manually. `[High]{advisory}`
  *Acceptance:* a matched requirement carries the archetype's full bundle into the working set.
- **FR-CL-04** Narrow candidates with a deterministic keyword pre-filter over `classifier_hints` before
  the LLM classification call, for efficiency. `[High]{silent-default}`
- **FR-CL-05** Attach a confidence to each match; matches below threshold are marked
  `needs_confirmation` and routed to the ledger for the user to confirm or reject — **never auto-applied
  silently**. `[High]{constraint}` *Acceptance:* a low-confidence match does not enter the spec until
  confirmed.
- **FR-CL-06** Flag requirements that match **no** archetype as `unmatched` / bespoke, and mark them
  Low-checkability so the emitter spends extra detail and examples there. `[Mixed]{advisory}`
  *Acceptance:* a novel product requirement is flagged bespoke and not force-fitted to a wrong archetype.

### Composition (FR-CMP)
- **FR-CMP-01** Union the FR/NFR clusters of all selected + inferred archetypes and de-duplicate
  overlaps. `[High]{advisory}`
- **FR-CMP-02** Auto-attach cross-cutting packs from the merged `signals` (e.g. `data_classification:
  personal` → Privacy pack; any UI surface → Accessibility pack). `[High]{constraint}`
  *Acceptance:* a personal-data platform always pulls the Privacy pack regardless of what the user typed.
- **FR-CMP-03** Multiply the NFR set by each selected device target, de-duplicating. `[High]{advisory}`

### Gap-check — the full-coverage guarantee (FR-GAP)
- **FR-GAP-01** Run the generic 25010 empty-cell detection over the composed set and report thin/empty
  categories. `[High]{advisory}`
- **FR-GAP-02** Run each composed archetype's `watch_for` items as **mandatory probes**; report any not
  addressed. `[High]{advisory}` *Acceptance:* a migration with no reconciliation step is flagged.
- **FR-GAP-03** Run structural checks (CRUD completeness, state-machine completeness, happy/unhappy
  symmetry, actor coverage, goal↔requirement traceability). `[High]{advisory}`

### Prescription filter — the not-too-prescriptive guarantee (FR-PR)
- **FR-PR-01** Apply each item's prescription level: `constraint` → emit as binding requirement + DoD gate;
  `advisory` → emit to the "be cautious of" panel, non-blocking; `silent-default` → omit from the spec,
  reference the durable layer. `[High]{constraint}`
- **FR-PR-02** Enforce constraint phrasing as **outcome/boundary, never implementation**; reject/ reword a
  constraint written as a how. `[Mixed]{constraint}` *Acceptance:* "enforce authz server-side on every
  endpoint" passes; "write an authz middleware" is reworded.
- **FR-PR-03** Compute the constraint ratio; if it exceeds ~20% of emitted requirements, warn that
  something advisory is likely mis-tagged. `[High]{advisory}`

### Assumption ledger (FR-LG)
- **FR-LG-01** Record every non-user-supplied requirement with source + provenance; make each removable.
  `[High]{constraint}` *Acceptance:* an injected foundation requirement appears in the ledger and can be
  removed.
- **FR-LG-02** For expert mode, offer to bulk-strip `advisory` items the user would supply themselves;
  never offer to strip `constraint` items. `[High]{advisory}`

### Emitter (FR-EM)
- **FR-EM-01** Emit the spec in the standard anatomy (intent, context/pointers, user goal, non-goals,
  atomic FRs, data/interface contracts, NFRs by 25010, edge cases/error handling, acceptance criteria,
  DoD gate). `[High]{constraint}`
- **FR-EM-02** Tag every emitted requirement with source, prescription, and checkability; emit the
  routing `signals` block and the computed checkability profile. `[High]{advisory}`
- **FR-EM-03** Emit only ephemeral feature content; reference the durable layer rather than restating it.
  `[High]{constraint}` *Acceptance:* no stack/convention boilerplate already in CLAUDE.md appears.

## 8. Non-functional requirements (by ISO/IEC 25010)

- **Functional suitability:** emitted requirements pass the INCOSE/ISTQB lint (atomic, no "and/or", no
  vague terms, no implementation prose). *Meter:* 0 violations across 100% of emitted requirements.
  `{constraint}`
- **Functional suitability:** every user requirement is covered or explicitly out-of-scope. *Meter:* 0
  uncovered-unexplained. `{constraint}`
- **Reliability:** every emitted spec contains all mandatory anatomy sections. *Meter:* 0 specs missing a
  section. `{constraint}`
- **Interaction capability:** an emitted spec is buildable with 0 forced assumptions (no undefined choice
  Claude must guess). *Meter:* 0. `{advisory}`
- **Security/privacy:** `data_classification` present whenever input touches personal data; waivers carry
  a reason. *Meter:* 0 missing. `{constraint}`
- **Maintainability:** catalogue, routing, and durable context each have one source of truth; no
  boilerplate duplicated into specs. *Meter:* 0 duplications. `{advisory}`
- **Performance efficiency:** classify + compose + emit within an acceptable bound for a ~30-requirement
  input. *Target:* `[set to your pipeline budget]`. `{advisory}`

## 9. Edge cases & error handling

- Empty input → prompt for a blueprint or at least one requirement; never emit an empty spec.
- All input low-confidence → present as confirmations, emit nothing unconfirmed.
- Contradictory user requirements → flag the conflict; do not silently pick one.
- Requirement contradicts the durable layer → raise a contradiction warning (don't override CLAUDE.md).
- Catalogue version drift → stamp the spec with the catalogue version used.
- Bespoke (unmatched) requirement → emit as a Low-checkability, detail-rich, advisory-by-default section.

## 10. Acceptance criteria (key flows, test-shaped)

- *Minimal input, full coverage:* given 3 free-text requirements implying auth, the emitted spec includes
  password-reset and session handling (gap-check filled them) and logs them in the ledger as injected.
- *Not over-prescriptive:* in a generated CRUD spec, per-operation authz is a binding constraint; field
  layout and empty-state copy are advisory; conventions are absent (silent-default). Constraint ratio ≤20%.
- *Auto-classify replaces selection:* "let providers list services and buyers enquire" classifies to
  Marketplace + Messaging + Identity and pre-populates all three bundles without manual picking.
- *Loud assumptions:* every injected requirement is visible in the ledger and removable; removing one
  removes its downstream emitted requirements.

## 11. Definition of done (gates)

Typecheck clean · lint clean · tests green · emitted-spec lint passes (NFR functional-suitability) ·
seed-catalogue ingests without dropped archetypes · ledger covers 100% of non-user requirements ·
constraint-ratio check active.

## 12. Build sequence (decomposition for Claude Code)

1. **Data model + catalogue ingest** (FR-CAT) — foundation for everything; build and test first.
2. **Composition + gap-check + prescription filter** (FR-CMP, FR-GAP, FR-PR) — the engine; parallelisable
   after the model exists.
3. **Emitter + ledger** (FR-EM, FR-LG) — produces output; depends on the engine.
4. **Mode A selection UI** (FR-SEL) — depends on catalogue + composition.
5. **Mode B auto-classify** (FR-CL) — build last; depends on a structured catalogue (its `classifier_hints`
   and `user_says`) and the LLM endpoint. The highest-value, highest-risk piece — isolate it.

*Phases 2–3 can run in parallel worktrees once Phase 1's contracts are fixed. Phase 5 is the one to harden
hardest: classification accuracy is the difference between "saves the user selecting" and "silently picks
the wrong archetype."*

---

*Note on "one doc": this build spec is the single source of build truth; the three catalogue files are its
dataset. If you want a literal single file, append them as appendices — but architecturally they are seed
data the tool ingests (FR-CAT-01), versioned independently so improving an archetype doesn't require
editing this spec.*
