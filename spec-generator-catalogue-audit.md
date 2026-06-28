# Service Catalogue — Best-Practice Audit & Missing Layers (Addendum)

**Verdict:** the catalogue is structurally sound but **product-heavy and platform-light**. It models *what
the platform is* (surfaces, feature-level foundations, device reach) well, and under-models *how the
platform is built, delivered, run, secured in depth, and evolved*. The gaps below close that.

**Through-line:** the deeper the layer, the more it should be **blueprint-default, not user-selected** — a
non-technical user will never ask for a message queue or a deploy pipeline, so these attach automatically
and surface in the assumption ledger. Foundations were "what beginners don't know to ask for"; these new
layers are that, squared.

---

## Part A — Alignment audit

Mapped against three recognised yardsticks. Status: ✅ covered · ⚠️ thin · ❌ missing.

### AWS Well-Architected (six pillars)

| Pillar | Status | Notes |
|---|---|---|
| Operational Excellence | ❌ | No delivery/CI-CD, no runbooks/incident practice. Biggest gap. |
| Security | ⚠️ | Hardening pack + identity exist; authz-depth, encryption, key mgmt, supply-chain thin. |
| Reliability | ⚠️ | Resilience pack + sync exist; no SLO/SLI, error budgets, explicit backup/DR targets. |
| Performance Efficiency | ✅ | Performance NFRs, query budgets, device targets all present. |
| Cost Optimisation | ❌ | Nothing on cost/resource budgets/FinOps. |
| Sustainability | ❌ | Not addressed (low priority for your stage, but note it). |

### 12-factor (delivery hygiene)

Config ✅ (feature flags) · Backing services ✅ · **Build/release/run ❌** (no delivery layer) ·
**Processes/concurrency ❌** (no async/eventing) · Logs ⚠️ (observability present, practice thin) ·
**Dev/prod parity ❌** (no environments model).

### SDLC stages

Plan ✅ (the generator itself) · Build ✅ (surfaces) · **Test ⚠️** (checkability exists, but no explicit
test *strategy*) · **Release/Deploy ❌** · **Operate ⚠️** · Monitor ⚠️ · Evolve ✅ (Operations layer
handles code-change archetypes well).

**Reading:** the right-hand half of the lifecycle — test strategy, deploy, operate, monitor — is where the
catalogue is weakest. That's the "engineering system," and it's what separates a hobby app from a
platform.

---

## Part B — New Layer: Delivery & Operations (Layer 4)

The headline missing layer. Not runtime (not a Foundation), not user-facing (not a Surface) — it's the
build/release/run system. Blueprint-default; an advanced user (you) tunes it.

**CI/CD pipeline** — *"changes ship safely and automatically"*
- Brings: build, test-gate ordering (ISTQB pyramid), lint/typecheck gates, branch protection, PR checks,
  automated deploy, rollback trigger.
- Leans on: operational excellence, reliability.
- Watch for: gate ordering (fast tests first), required reviewers, deploy-on-green only.
- Checkability: High.

**Environments & promotion** — *"separate dev, test, and live"*
- Brings: environment definitions, config-per-environment, secrets management, promotion path, parity.
- Leans on: reliability, security.
- Watch for: dev/prod parity, secrets never in code, seed/anonymised data per environment.
- Checkability: High.

**Infrastructure-as-Code** — *"the servers are defined in code, not clicked"*
- Brings: declarative infra, provisioning, environment reproducibility, drift detection.
- Leans on: operational excellence, maintainability.
- Watch for: state management, least-privilege deploy credentials.
- Checkability: High.

**Release strategy** — *"roll out without breaking everyone"*
- Brings: blue-green/canary, feature-flag-gated release, gradual rollout, instant rollback, expand/contract
  migration coupling.
- Leans on: reliability.
- Watch for: backward-compatible migrations during rollout; rollback that doesn't lose data.
- Checkability: Mixed.

**Incident response & runbooks** — *"when it breaks, there's a plan"*
- Brings: alert routing, on-call/escalation, runbooks, post-incident review, status page.
- Leans on: operational excellence, reliability.
- Watch for: undocumented tribal knowledge; no defined severity levels.
- Checkability: Mixed.

**Backup & disaster recovery** — *"we can recover from a catastrophe"*
- Brings: backup schedule, restore test, RPO/RTO targets, failover.
- Leans on: reliability, security.
- Watch for: backups never restore-tested; RPO/RTO undefined; backup encryption.
- Checkability: High.

---

## Part C — New Foundations (Layer 0 additions)

**Authorisation & access control** — *split out from Identity* — *"control what each user can do"*
- Brings: permission model (RBAC / ABAC / ReBAC), policy definition, least-privilege defaults, per-
  resource checks, permission audit.
- Leans on: security, compliance.
- Watch for: authz enforced server-side on every endpoint, not just hidden in UI; role explosion (your 25
  roles); deny-by-default; permission changes taking effect on live sessions.
- Composes with: requires Identity; pairs with Audit.
- Checkability: High.
- *Why separate from Identity:* authentication (who you are) and authorisation (what you may do) fail
  differently and are tested differently. Bundling them hides the harder problem.

**Background processing & eventing** — *the runtime "orchestration"* — *"things happen in the background"*
- Brings: async job queue, scheduled/cron tasks, event bus / pub-sub, outbound webhooks, retry/dead-
  letter handling, saga/long-running coordination, idempotent consumers.
- Leans on: reliability, performance, maintainability.
- Watch for: at-least-once vs exactly-once delivery; idempotency on every consumer; poison messages;
  ordering guarantees; what happens when a job fails mid-way.
- Composes with: underpins Notifications, Integration, bulk Operations, Workflow.
- Checkability: Mixed (queue mechanics High; coordination logic Mixed).
- *This is the "orchestration" most platforms mean at runtime — distinct from deploy orchestration above.*

**External / partner API surface** — *APIs as a product* — *"other developers/systems integrate with us"*
- Brings: API gateway, API keys/OAuth clients, rate limiting + quotas, OpenAPI spec, versioning policy,
  outbound webhooks, SDK/docs, sandbox.
- Leans on: compatibility, security, maintainability.
- Watch for: versioning before breaking changes; rate-limit fairness; key rotation; deprecation comms.
- Composes with: requires API/contract layer + Authorisation; relevant to two-sided platforms (Village
  Partners).
- Checkability: High.

**Data & analytics architecture** — *expands the thin Data foundation* — *"raw data becomes insight"*
- Brings: OLTP/OLAP separation, caching strategy, ingestion/ETL, warehouse/lake, retention tiers,
  read-model/materialised views.
- Leans on: performance, data quality (25012), cost.
- Watch for: don't run analytics on the transactional DB; cache invalidation; PII in the warehouse.
- Composes with: Data layer, Dashboard, Reporting.
- Checkability: Mixed.

---

## Part D — New & strengthened Cross-cutting Packs (Layer 3)

**Testing & QA strategy** *(new)* — test pyramid (unit → integration → contract → e2e), contract testing
between services, test-data management, UAT plan, coverage targets. Auto-attached always. *Note:* this
makes the Operations "Refactoring" archetype's precondition explicit — no test suite, no safe refactor.
Checkability: High.

**Product analytics & instrumentation** *(new — distinct from Observability)* — event taxonomy, funnels,
A/B framework, consent-aware tracking. Observability answers "is it up?"; this answers "what are users
doing?". Leans on: privacy (consent). Checkability: Mixed.

**Documentation & decision records** *(new)* — architecture decision records (ADRs), API docs, runbooks,
onboarding docs. The catalogue's own bundles are documentation that rots; the platforms it generates need
the same discipline. Checkability: Mixed.

**Security — deepened** *(strengthen existing pack)* — add: threat modelling, encryption at rest and in
transit, key/secret management, dependency + supply-chain scanning (SBOM), SAST/DAST, security incident
response, pen-test readiness. The single "Security hardening" entry is too thin for government-adjacent
work; for that context this is mandatory-depth, not optional. Checkability: Mixed.

**Cost / FinOps awareness** *(new, light)* — resource budgets, cost observability, cache-to-reduce-spend.
Minor at your stage, but a pre-revenue platform should at least see its own cost shape. Checkability: High.

**Reliability/SRE specifics** *(strengthen Resilience pack)* — SLO/SLI definitions, error budgets,
graceful-degradation contracts. Turns "be reliable" into a number. Checkability: High.

---

## Part E — One blueprint-level decision to name explicitly

**Architecture shape** — monolith vs modular monolith vs microservices, service boundaries, data
ownership, sync-vs-async boundaries. A non-technical user can't make this call, so the **blueprint encodes
it** (e.g. "SaaS workspace → modular monolith"; "data platform → separate analytics service"). It should
be a visible, assumption-ledgered default rather than an invisible one, because it constrains everything
downstream. For most beginner platforms, modular monolith is the correct default — surface that as the
assumption, not microservices.

---

## Revised layer model

```
PLATFORM = Foundations (backbone)
              + Identity · Authorisation · Tenancy · Data layer · Data/analytics architecture
              + API/contract · External-API surface · Sync/offline · Background processing/eventing
              + Notifications · Storage · Search · Audit · Observability · Config · Billing
         + Surfaces (what users see/do)            ← unchanged
         + Operations (code-change archetypes)     ← unchanged
         + Cross-cutting packs
              + Accessibility · i18n · Security(deepened) · Privacy · Observability
              + Resilience/SRE · Compliance · Testing/QA · Product analytics · Docs/ADR · Cost
         + Delivery & Operations (NEW Layer 4)
              + CI/CD · Environments · IaC · Release strategy · Incident/runbooks · Backup/DR
         × Device targets                          ← unchanged
   pre-composed as → Blueprints (now also encode architecture shape)
```

**Net change:** +1 layer (Delivery & Operations), +4 foundations (Authorisation, Eventing, External-API,
Data-architecture), +4 packs (Testing, Analytics, Docs, Cost), 2 packs deepened (Security, Resilience),
+1 named blueprint decision (architecture shape). The original surfaces and device axis stand as-is.
