-- Spec Generator & Reviewer schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    name          TEXT,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS specs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    -- The user's draft requirements (markdown / plain text).
    content       TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_specs_user ON specs(user_id);

-- One row per AI review run against a spec. Keeps full history.
CREATE TABLE IF NOT EXISTS reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_id         UUID NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,            -- "claude" | "openai" | "mock"
    model           TEXT,
    -- Overall coverage score 0-100 returned by the reviewer.
    coverage_score  INTEGER,
    summary         TEXT,
    -- Full structured result from the AI (FR/NFR suggestions, gaps,
    -- traceability, orphans, ISTQB technique mapping, etc.)
    result          JSONB NOT NULL,
    -- Rendered, ready-to-export markdown spec.
    markdown        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_spec ON reviews(spec_id);
CREATE INDEX IF NOT EXISTS idx_reviews_spec_created ON reviews(spec_id, created_at DESC);

-- The AI-rewritten, structured spec generated on demand from a review.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rewritten_markdown TEXT;

-- ---------------------------------------------------------------------------
-- Improvement milestone additions
-- ---------------------------------------------------------------------------

-- FR-6: supplementary project context/constraints grounding the review.
ALTER TABLE specs ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT '';

-- FR-4 / FR-1 / FR-15: clarifying questions shown, the author's answers, and
-- the accept/reject/edit decisions taken against the review's suggestions.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS questions JSONB;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS answers   JSONB;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS decisions JSONB;

-- FR-17: immutable version history of generated specs, with a change summary
-- relative to the previous version so changes can be highlighted to the user.
CREATE TABLE IF NOT EXISTS spec_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_id         UUID NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
    review_id       UUID REFERENCES reviews(id) ON DELETE SET NULL,
    version_no      INTEGER NOT NULL,
    origin          TEXT NOT NULL,          -- 'rewrite' | 'revert'
    markdown        TEXT NOT NULL,
    coverage_score  INTEGER,
    change_summary  JSONB,                  -- { added, removed, modified }
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spec_versions_spec ON spec_versions(spec_id, version_no DESC);

-- FR-8 / NFR-8: stable requirement-ID registry, persisted per spec so IDs
-- survive restarts, re-runs, and exports, and are never reassigned to a
-- different requirement. Identity is keyed by a normalised text fingerprint;
-- numbers are minted monotonically per spec per kind (deleted requirements
-- keep their number claimed, so a new one always gets a fresh number).
CREATE TABLE IF NOT EXISTS requirement_ids (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_id     UUID NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
    stable_id   TEXT NOT NULL,          -- e.g. "FR-3" / "NFR-2"
    fingerprint TEXT NOT NULL,          -- normalised requirement-text key
    kind        TEXT NOT NULL,          -- 'FR' | 'NFR'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (spec_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_requirement_ids_spec ON requirement_ids(spec_id);

-- ---------------------------------------------------------------------------
-- Catalogue milestone additions (Phase 2)
-- ---------------------------------------------------------------------------

-- FR-C1: the curated archetype catalogue, seeded from the catalogue source docs
-- (see backend/src/services/catalogue/catalogue.json). Versioned independently
-- of application code (NFR-C4) — re-seeding upserts by id.
CREATE TABLE IF NOT EXISTS archetypes (
    id                     TEXT PRIMARY KEY,        -- e.g. "foundation.authorisation"
    layer                  TEXT NOT NULL,           -- foundation|surface|operation|pack|delivery|device|blueprint
    axis                   TEXT,                    -- product-surface|operation|quality|delivery|target
    name                   TEXT NOT NULL,
    user_says              JSONB NOT NULL DEFAULT '[]',
    classifier_hints       JSONB NOT NULL DEFAULT '[]',
    brings_fr              JSONB NOT NULL DEFAULT '[]',   -- [{ text, default_prescription, checkability }]
    leans_nfr              JSONB NOT NULL DEFAULT '[]',
    watch_for              JSONB NOT NULL DEFAULT '[]',   -- [{ text, prescription }]
    composes_with          JSONB NOT NULL DEFAULT '[]',   -- archetype ids (soft pairings)
    requires               JSONB NOT NULL DEFAULT '[]',   -- archetype ids (hard deps, auto-pulled)
    signals                JSONB NOT NULL DEFAULT '{}',   -- { surfaces[], touches[], data_classification }
    checkability           TEXT,                    -- High|Mixed|Low
    default_prescription   TEXT,                    -- constraint|advisory|silent-default
    prescription_overrides JSONB NOT NULL DEFAULT '[]',   -- [{ item, level }]
    maturity               TEXT,                    -- battle-tested|mature|experimental
    catalogue_version      TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archetypes_layer ON archetypes(layer);

-- FR-C2 / FR-C3: per-spec archetype selections (Mode A) and free-text matches
-- (Mode B). One table covers both. status='pending' means needs_confirmation —
-- nothing is applied without an explicit user confirmation (NFR-C3).
CREATE TABLE IF NOT EXISTS spec_archetypes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_id       UUID NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
    archetype_id  TEXT NOT NULL REFERENCES archetypes(id) ON DELETE CASCADE,
    mode          TEXT NOT NULL,          -- 'selected' (Mode A) | 'matched' (Mode B)
    raw_text      TEXT,                   -- the free-text requirement that matched (Mode B)
    confidence    NUMERIC,                -- 0..1 match confidence (Mode B)
    status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'confirmed'|'rejected'
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spec_archetypes_spec ON spec_archetypes(spec_id);

-- ---------------------------------------------------------------------------
-- Draft-page redesign additions: project setup + GitHub ingestion
-- ---------------------------------------------------------------------------

-- A spec is either a NEW project (the author states an objective) or an addition
-- to an EXISTING project (the author supplies a public GitHub URL we deep-read).
ALTER TABLE specs ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'new';   -- 'new' | 'existing'
ALTER TABLE specs ADD COLUMN IF NOT EXISTS objective    TEXT NOT NULL DEFAULT '';       -- new project: what the platform should achieve
ALTER TABLE specs ADD COLUMN IF NOT EXISTS repo_url     TEXT NOT NULL DEFAULT '';       -- existing project: public GitHub repo URL

-- Cached result of the GitHub deep-read for an existing project: the derived
-- tech stack and the requirements already delivered. Surfaced read-only and fed
-- to the review as KNOWN-STATE so built capabilities are not re-suggested — it is
-- never auto-merged into the spec (NFR-C3 / the gate still owns every addition).
ALTER TABLE specs ADD COLUMN IF NOT EXISTS repo_analysis JSONB;
