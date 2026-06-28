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
