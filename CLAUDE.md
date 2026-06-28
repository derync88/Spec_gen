# CLAUDE.md — Spec Generator & Reviewer

The durable layer for this project: stack, conventions, gates, and the
target-stack profile concept. Ephemeral feature specs reference this file rather
than restating it.

## What this app is

A tool that turns a user's draft requirements into a high-coverage,
**human-approved** Claude-Code-ready specification. The defining invariant: the
model *suggests*, the user *decides* — nothing reaches a generated spec without
an explicit acceptance event.

It evolved (per `docs/IMPROVEMENT-SPEC.md` and `CATALOGUE-MILESTONE-SPEC.md`)
from a draft reviewer into a catalogue-driven composer, in three sequenced
phases (all three now built):

1. **Human-in-the-loop gate + provenance + stable IDs** (the control floor) — done.
2. **Catalogue store + free-text auto-classification** (a new *source* of suggestions) — done.
3. **Composition, the prescription dial, gap-probes, bulk accept/reject** — done.

Key modules: `services/catalogue/` (catalogue.json store, ingest, keyword
match), `services/classifierService.js` (Mode B classify + confirmation gate),
`services/compositionService.js` (archetype → candidate suggestions, prescription
dial, cross-cutting packs, gap probes, ratio guard). Composition output is merged
into the review result in `reviewSpec`, so catalogue candidates pass through the
same accept/reject gate as model suggestions.

The catalogue (phases 2–3) is a new source feeding the phase-1 gate — never a
parallel path that bypasses it. Wiring catalogue suggestions onto an auto-merge
path would inject requirements silently; that is the exact failure this design
exists to prevent.

## Stack

- **Backend:** Node + Express, plain ESM JavaScript (no TypeScript). PostgreSQL
  via `pg`. JWT auth (access token in memory, not localStorage by convention).
- **Frontend:** React 19 + Vite, React Router. Access token kept in module scope.
- **AI:** a pluggable provider layer (`backend/src/services/ai/`) — Claude,
  OpenAI, and a **mock** provider. The app must run end-to-end on the mock with
  **no API key** so token-free dev always works.

## Conventions (load-bearing)

- **AI provider contract.** Each provider in `services/ai/` exports the same
  operations — currently `questions(spec)`, `review(spec)`,
  `rewrite(spec, reviewResult)` — dispatched by `run*` helpers in
  `services/ai/index.js`. Adding an operation (e.g. `classify`) means adding it
  to **every** provider including the mock, plus a `run*` dispatcher.
- **Suggestions live in `reviews.result` (JSONB), not a table.** There is no
  `suggestions` table. New per-suggestion fields (`source`, and later
  `sourceArchetypeId`, `prescription`, `checkability`) are added to the
  `suggestedRequirements[]` shape documented in
  `services/ai/prompt.js` (`OUTPUT_SCHEMA_DESCRIPTION`) and produced by the mock
  — **not** via `ALTER TABLE`.
- **Schema changes go in `backend/src/db/schema.sql`** and must be idempotent
  (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Apply with
  `npm run migrate`. New reference/join tables (e.g. `archetypes`,
  `spec_archetypes`, `requirement_ids`) belong here.
- **The gate is the control floor.** `specService.selectSuggestions()` accepts
  *nothing* by default; `rewriteSpec()` folds in only accepted suggestions and
  records accept/reject/edit decisions on the review. Do not add a path that
  reaches a spec/version without going through it.
- **Stable requirement IDs.** `services/requirementIds.js` assigns IDs
  (`FR-n`/`NFR-n`) keyed by a normalised text fingerprint, persisted in
  `requirement_ids`, minted monotonically per spec so an ID is never reassigned
  to a different requirement.
- **Provenance (`source`) is server-authoritative**, set during ID
  reconciliation — never trusted from the model.

## Gates (Definition of Done, every phase)

- **lint clean** — ESLint is the static-analysis gate (`npm run lint` in both
  `backend/` and `frontend/`). We deliberately do **not** run `tsc`/`checkJs`:
  this is annotation-free plain JS, where ESLint is the high-signal static gate
  and TS-checking would be noise or ceremony.
- **tests green** — backend uses the Node built-in test runner (`npm test` →
  `node --test`); frontend uses Vitest + Testing Library (`npm test`).
- **mock end-to-end** — the full flow (questions → review → accept subset →
  rewrite → version) runs against the mock provider with no API key.
- **no silent injection** — no requirement reaches an exported spec or a version
  without an acceptance event.

## Target-stack profile (for EMITTED specs, not this app)

Specs this tool emits must name **no** framework, language, or datastore. The
target platform's stack is a single durable parameter the user sets once (in the
*generated* platform's own CLAUDE.md). Emitted contracts are structural —
entities/fields/relationships, endpoints/operations, request/response shapes,
state transitions — and bind to a concrete stack only at that one durable point.
This keeps one spec valid for a Django, Rails, .NET, Spring, Phoenix, or Node
target unchanged.

## Source-of-truth docs

- `docs/IMPROVEMENT-SPEC.md` — the human-in-the-loop milestone (phase 1).
- `CATALOGUE-MILESTONE-SPEC.md` — the catalogue/composer milestone (phases 2–3).
- `spec-generator-build-spec.md` — overall engine design.
- `spec-generator-service-catalogue.md`, `spec-generator-catalogue-audit.md`,
  `spec-generator-prescription-dial.md` — catalogue **seed data** the tool
  ingests (not code to reimplement).
- `spec-generator-requirements.md` — the quality bar for emitted output.
