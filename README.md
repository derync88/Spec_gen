# Spec Generator & Reviewer

A web app that takes your **draft requirements** and uses AI to review them against
established requirements-engineering and testing standards, then suggests the
**functional** and **non-functional** requirements you're missing — so the spec you
hand to Claude Code is high-coverage and unambiguous from the start.

The review engine is grounded in:

- **ISTQB** test design techniques (equivalence partitioning, boundary value analysis,
  decision tables, state transition, error guessing, etc.)
- **ISO/IEC/IEEE 29148:2018** (requirements engineering)
- **ISO/IEC 25010 (SQuaRE)** — the non-functional quality model
- **INCOSE** Guide for Writing Requirements (GtWR)
- **Volere** (Robertson & Robertson)
- **IREB CPRE** & **BABOK** practices
- **SMART** requirements (Specific, Measurable, Achievable, Relevant, Testable)
- **Traceability & orphan detection**

## Stack

| Layer    | Tech                                  |
|----------|---------------------------------------|
| Frontend | React 19 + Vite                       |
| Backend  | Node + Express (REST)                 |
| Database | PostgreSQL 16                         |
| Auth     | JWT (bcrypt-hashed passwords)         |
| AI       | Pluggable — Claude (Anthropic) or OpenAI |

## Prerequisites

- Node 20+ (tested on 24)
- Docker (for Postgres) — or your own Postgres instance

## Quick start

```bash
# 1. Start Postgres
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # then add your ANTHROPIC_API_KEY or OPENAI_API_KEY
npm install
npm run migrate               # create tables
npm run dev                   # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173, register an account, paste or upload a draft spec,
click **Review**, and export the reviewed spec as Markdown.

## Choosing the AI provider

Set in `backend/.env`:

```
AI_PROVIDER=claude   # or "openai"
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

If no API key is configured the backend falls back to a **mock reviewer** so you can
run and explore the whole app without spending tokens.

## API overview

| Method | Route                          | Purpose                          |
|--------|--------------------------------|----------------------------------|
| POST   | `/api/auth/register`           | Create account                   |
| POST   | `/api/auth/login`              | Log in, get JWT                  |
| GET    | `/api/specs`                   | List your specs                  |
| POST   | `/api/specs`                   | Create a spec                    |
| GET    | `/api/specs/:id`               | Get a spec + its latest review   |
| PUT    | `/api/specs/:id`               | Update a spec                    |
| DELETE | `/api/specs/:id`               | Delete a spec                    |
| POST   | `/api/specs/:id/review`        | Run an AI review                 |
| GET    | `/api/specs/:id/export`        | Download reviewed spec as `.md`  |
