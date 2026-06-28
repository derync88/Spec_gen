# Spec Generator — Service Catalogue of Archetypes

**Purpose:** let someone who doesn't build software describe a *platform* in plain language, and have the
generator pre-populate correct functional and non-functional requirements, cross-device, while clearly
surfacing every assumption it made and every gap it couldn't fill.

**The core idea:** a platform is not one big feature. It is composed from four independent axes. The user
mostly picks a **blueprint** and **device targets**; everything else is unioned in and shown for review.

```
PLATFORM  =  Foundations (backbone)
           + Surfaces    (what users see/do)
           + Cross-cutting packs (qualities sliced across everything)
           × Device targets (orthogonal — multiplies the NFRs)
```

Archetypes are **stackable tags whose requirement sets union and de-duplicate** — never a one-of menu.
"Admin console" = CRUD + Auth/RBAC + Audit. The generator merges those bundles rather than treating
"Admin console" as a monolith.

**Stack-agnostic by design.** This catalogue names *no* implementation framework, language, or datastore.
Every archetype describes capabilities and quality concerns, and every contract it emits is expressed in
**stack-neutral structural terms** — entities, fields, relationships, endpoints, operations, request/
response shapes, event/message shapes, state transitions, and types-as-data-shapes — never "EF Core
entity" or "TypeScript interface". The platform's actual stack is a **single durable parameter** the user
sets once (a *target profile* recorded in the generated platform's CLAUDE.md: language, framework, client,
datastore, deploy target). The emitted spec references "the target stack" abstractly; binding to a
concrete framework happens only at that one durable point, so the same archetype serves a Django, Rails,
.NET, Spring, Phoenix, or Node platform without change. Where a card lists a framework, it is an
illustrative *e.g.*, never a requirement.

**Card legend**
- *User says* — the plain-language phrase a non-technical user would actually use to select it.
- *Brings (FR)* — the functional-requirement cluster it injects.
- *Leans on (NFR)* — the quality categories this archetype disproportionately needs (25010 + domain).
- *Watch for* — the archetype-specific things that get forgotten; feeds the "be cautious of" panel.
- *Composes with / requires* — dependencies and natural pairings.
- *Checkability* — how much of this spec is objectively verifiable (High = safe to hand to the loop;
  Mixed/Low = needs human review). Drives how much detail the generator spends.

---

## How a non-technical user navigates it

1. **Pick a blueprint** (or "start blank"). Pre-fills Foundations + a starter Surface set.
2. **Answer only what can't be defaulted.** The generator asks the minimum disambiguating questions, not
   a form — everything answerable from the blueprint is pre-filled.
3. **Tick device targets.** This multiplies the NFR set automatically.
4. **Add/remove surfaces** from the catalogue.
5. **Review the assumption ledger.** Every prepopulated requirement is tagged with provenance ("assumed
   from Marketplace blueprint") and is one click to remove.
6. **Review the "be cautious of" panel** — the merged Watch-for lists plus anything the gap-checker found
   empty.
7. **Generate.** Emits the Claude-Code-ready spec, tagged by checkability.

---

## 0. Platform Blueprints (pre-composed — the "instant platform" entry point)

A blueprint is a curated union of Foundations + Surfaces + default device targets for a recognisable
platform shape. Non-technical users start here. Each carries a maturity rating.

| Blueprint | Composed of | Default devices | Maturity |
|---|---|---|---|
| **Two-sided marketplace** | Identity, Tenancy, Billing, Search, Notifications, Storage + Onboarding, Listings, Profile, Messaging, Dashboard, Admin console | Responsive web + native mobile | Battle-tested |
| **SaaS workspace / admin tool** | Identity, Tenancy, Audit, Config + Onboarding, Dashboard, CRUD admin, Settings, Reporting | Responsive web + PWA | Battle-tested |
| **Consumer service app** | Identity, Notifications, Storage, Sync + Onboarding, Feed, Profile, Messaging, Settings | Native mobile + responsive web | Battle-tested |
| **Internal/government operations console** | Identity (SSO), RBAC, Audit, Observability, Privacy pack + Dashboard, List+detail, Workflow, Reporting | Responsive web (desktop-first) | Mature |
| **Content / publishing platform** | Identity, Storage, Search, CDN/Config + CMS, Feed, Landing, Profile, Admin console | Responsive web + PWA | Mature |
| **Booking / scheduling platform** | Identity, Notifications, Billing, Sync + Onboarding, Calendar, Workflow, Dashboard, Admin | Responsive web + native mobile | Mature |
| **Data / insights platform** | Identity, Data layer, Search, Observability + Dashboard, Reporting, List+detail, Admin | Responsive web (desktop-first) | Experimental |

*A blueprint is itself a spec that rots — each needs an owner, a version, and the maturity rating shown to
the user so they know how far to trust the autopopulation.*

---

## 1. Foundations (Layer 0 — the backbone; what makes it a platform)

These are nearly always required and are the layer a non-technical user wouldn't know to ask for. The
blueprint pulls them in; the catalogue lets an advanced user adjust.

**Identity & Access** — *"users can sign in"*
- Brings (FR): registration, login/logout, password reset, session lifecycle, SSO/OIDC, MFA, role
  assignment, account recovery, email verification.
- Leans on (NFR): security (ISM/Essential Eight), privacy (APP), reliability (session integrity).
- Watch for: token expiry/refresh, account lockout, session-across-devices, deletion vs deactivation,
  permission checks on *every* endpoint (not just the UI).
- Composes with: required by almost everything; pairs with Tenancy, Audit.
- Checkability: High.

**Tenancy & Org model** — *"separate companies/teams keep their data apart"*
- Brings (FR): org/workspace creation, member invite, data isolation boundary, role-per-tenant.
- Leans on (NFR): security (cross-tenant leakage), maintainability.
- Watch for: cross-tenant data leakage is the #1 platform security bug; row-level vs schema vs DB
  isolation decision; "user belongs to many orgs".
- Composes with: requires Identity.
- Checkability: High.

**Data layer & persistence** — *"the system remembers things"*
- Brings (FR): schema, entity contracts, migration strategy (expand/contract), seed/reference data.
- Leans on (NFR): reliability, data quality (25012), performance.
- Watch for: migration rollback, referential integrity, soft vs hard delete, PII fields and retention.
- Composes with: underpins every Surface.
- Checkability: High.

**API / contract layer** — *"all the devices talk to one backend"*
- Brings (FR): endpoint contracts, DTOs, versioning policy, error envelope, pagination convention.
- Leans on (NFR): compatibility (this is the cross-device contract), maintainability.
- Watch for: one contract serving web + mobile; versioning before you have v2; consistent error shape.
- Composes with: required for any multi-device platform.
- Checkability: High.

**Sync & offline** — *"works on my phone with no signal, then catches up"*
- Brings (FR): local cache, change queue, conflict resolution policy, sync status, optimistic updates.
- Leans on (NFR): reliability, compatibility, interaction (offline UX states).
- Watch for: conflict resolution is genuinely hard — last-write-wins vs merge vs prompt; clock skew;
  partial-sync states. This is the single most under-estimated platform feature.
- Composes with: needed by any native-mobile or offline-PWA target.
- Checkability: Mixed (sync logic High; conflict UX Low).

**Notifications** — *"tell users when something happens"*
- Brings (FR): push, email, in-app inbox, preferences/opt-out, delivery tracking, templating.
- Leans on (NFR): reliability, privacy (consent), compatibility (per-device delivery).
- Watch for: per-device push tokens, quiet hours, unsubscribe compliance, dedupe across channels.
- Composes with: pairs with Notification-centre surface.
- Checkability: Mixed.

**File & media storage** — *"users upload photos/documents"*
- Brings (FR): upload, virus scan, thumbnail/transform, access control, CDN delivery, quota.
- Leans on (NFR): security, performance, privacy.
- Watch for: signed URLs, file-type validation, orphaned files, large-file/resumable upload on mobile.
- Checkability: High.

**Search** — *"find anything quickly"*
- Brings (FR): index, query, filters, facets, ranking, typo tolerance, permission-aware results.
- Leans on (NFR): performance, functional suitability.
- Watch for: search must respect permissions (don't return what the user can't see); index freshness.
- Checkability: Mixed.

**Audit & logging** — *"we can see who did what"* — Brings: immutable event log, actor/action/timestamp,
query/export. Leans on: security, compliance. Watch for: tamper-evidence, PII in logs, retention. (Gov
default.) Checkability: High.

**Observability** — *"we know when it breaks"* — Brings: metrics, tracing, health checks, alerting hooks,
structured logs. Leans on: reliability, maintainability. Watch for: this is the most-skipped foundation;
seed it by default. Checkability: High.

**Configuration & feature flags** — *"turn features on/off without redeploying"* — Brings: flag store,
environment config, gradual rollout. Leans on: maintainability. Checkability: High.

**Billing & subscriptions** — *"users pay / partners subscribe"* — Brings: plans, payment provider
integration, invoicing, dunning, entitlement checks, tax handling. Leans on: security, reliability,
compliance. Watch for: failed-payment recovery, proration, tax/GST, entitlement enforcement server-side.
Checkability: Mixed.

---

## 2. Surfaces (Layer 1 — what users see and do)

**Onboarding / signup flow** — *"new users get set up"*
- Brings: account creation, progressive profiling, guided setup, empty-state seeding, progress indicator.
- Leans on: interaction/usability, accessibility.
- Watch for: abandonment/resume, skip-and-return, the empty first-run state.
- Checkability: Mixed (flow High; "does it feel welcoming" Low).

**Dashboard / analytics view** — *"see key numbers at a glance"*
- Brings: metric tiles, charts, date-range filter, drill-down, refresh, export.
- Leans on: performance (query budgets), interaction, accessibility (chart alternatives).
- Watch for: empty/loading/error/stale states for *every* widget; query-performance budget; what "no data
  yet" looks like; timezone of aggregates.
- Composes with: Reporting, Data layer.
- Checkability: Mixed (data correctness High; layout/insight Low).

**CRUD admin / management console** — *"manage the records"*
- Brings: create/read/update/delete/list per entity, validation, bulk actions, permissions per operation.
- Leans on: security (per-op authz), functional suitability.
- Watch for: per-operation permissions (not just per-screen); optimistic-concurrency conflicts;
  cascade-delete behaviour; bulk-action partial failure.
- Composes with: Auth/RBAC, Audit.
- Checkability: High.

**List + detail (master–detail)** — *"browse a list, click into one"*
- Brings: paginated list, sort, filter, detail view, prev/next navigation, deep-linkable URLs.
- Leans on: performance, interaction.
- Watch for: pagination + filter state in URL; empty/zero-result state; deep-link to a deleted item.
- Checkability: High.

**Workflow / multi-step process** — *"something moves through stages"*
- Brings: state model, transitions, guards, assignments, status history, notifications on transition.
- Leans on: reliability, functional suitability.
- Watch for: state-machine completeness — *every* transition including error, timeout, and reversal;
  who can move what; what happens to in-flight items on rule change.
- Composes with: Notifications, Audit.
- Checkability: High (this archetype is defined by its state machine — very testable).

**Form / data capture & wizards** — *"users fill in information"*
- Brings: field validation, conditional fields, multi-step with save-draft, review-before-submit.
- Leans on: interaction, accessibility (labels, errors, focus order), data quality.
- Watch for: inline vs submit validation; save-and-resume; accessible error messaging; autosave loss.
- Checkability: Mixed.

**Settings / preferences** — *"users change how it works"* — Brings: preference store, per-user/per-org
scope, defaults, reset. Watch for: which settings are per-device vs synced. Checkability: High.

**Profile / account management** — *"manage my account"* — Brings: view/edit profile, avatar, password
change, connected devices, delete account, data export. Leans on: privacy (data-rights: export/delete).
Watch for: account deletion + data-retention obligations. Checkability: High.

**Feed / timeline** — *"a stream of recent things"* — Brings: chronological/ranked feed, infinite scroll,
read state, refresh. Watch for: pagination stability, real-time updates, empty state. Checkability: Mixed.

**Messaging / chat** — *"users talk to each other"* — Brings: threads, send/receive, read receipts,
attachments, presence. Leans on: reliability, real-time, privacy. Watch for: delivery guarantees,
ordering, blocking/abuse, notification fan-out. Checkability: Mixed.

**Calendar / scheduling** — *"book and see times"* — Brings: availability, slot booking, conflict
detection, reminders, timezone handling. Watch for: timezones and DST (perennial source of bugs);
double-booking races. Checkability: Mixed.

**Map / location** — *"see things on a map"* — Brings: map render, markers, geosearch, clustering,
directions. Leans on: performance, privacy (location consent). Watch for: location permission UX, offline
tiles. Checkability: Mixed.

**Marketplace / two-sided listings** — *"providers list, buyers browse"* — Brings: listing CRUD,
discovery/search, detail, enquiry/booking, reviews, two distinct role journeys. Leans on: search,
trust/safety, privacy. Watch for: the two sides have *different* requirement sets — spec both; review
moderation; payment-on-platform. Composes with: Identity, Billing, Messaging. Checkability: Mixed.

**Content / CMS / publishing** — *"create and publish content"* — Brings: authoring, draft/publish
workflow, versioning, media embed, scheduling. Watch for: preview, rollback, SEO metadata. Checkability:
Mixed.

**Reporting / export** — *"download the data"* — Brings: report builder/templates, CSV/PDF/XLSX export,
scheduled reports. Leans on: performance (large exports), data quality. Watch for: large-export timeouts,
PII in exports, format correctness. Checkability: High.

**Notification centre / inbox** — *"a place to see all alerts"* — Brings: inbox list, read/unread,
mark-all, per-type filtering, deep-link to source. Composes with: Notifications foundation. Checkability:
High.

**Landing / marketing page** — *"the public front door"* — Brings: hero, sections, CTA, signup hook,
responsive layout, basic SEO. Leans on: performance (load speed), accessibility, compatibility. Watch
for: this is mostly Low-checkability (taste) — spend detail on examples, not rules. Checkability: Low.

**Search & filter results** — *"a results page with filters"* — Brings: query input, facet filters, sort,
result cards, pagination, no-result state. Composes with: Search foundation. Checkability: Mixed.

---

## 3. Operations (Layer 2 — doing something to an existing codebase)

These are defined by an **invariant + a regression gate**, not by new features. Mostly High checkability,
which is why they're safe to automate aggressively.

**Data migration** — *"move the data to the new system"*
- Invariant: no data loss; source and target reconcile.
- Brings (FR): dry-run mode, idempotent runner, batching, row-count + checksum reconciliation, rollback,
  audit trail, error quarantine for bad rows.
- Leans on (NFR): data quality (25012), reliability, security.
- Watch for: idempotency (re-run safely), partial-failure resume, source-changing-during-migration,
  encoding/locale, reconciliation report as the definition of done.
- Checkability: High.

**Refactoring** — *"clean it up without changing what it does"*
- Invariant: observable behaviour unchanged.
- Brings (FR): almost none. The spec is a **constraint set** — "public contract must not change" — plus a
  strong regression-test gate and a "do not touch" boundary.
- Leans on (NFR): maintainability; reliability via regression suite.
- Watch for: the test suite *is* the spec; if coverage is thin, refactoring isn't safe to automate.
- Checkability: High (behaviour) — assuming tests exist.

**Integration / third-party connect** — *"connect to <external service>"* — Brings: auth to external,
data mapping, retry/backoff, rate-limit handling, webhook receipt, failure/degraded mode. Watch for:
external outages, credential rotation, idempotent webhook handling. Checkability: Mixed.

**Bulk import/export** — *"load a spreadsheet of records"* — Brings: file parse, validation report,
partial-accept, dedupe, dry-run preview. Watch for: malformed rows, encoding, large-file streaming.
Checkability: High.

**Performance optimisation** — *"make it faster"* — Invariant: behaviour unchanged, metric improved.
Brings: baseline measurement, target, regression guard. Watch for: define the meter *before* optimising.
Checkability: High.

**Deprecation / sunset** — *"retire the old feature safely"* — Brings: usage check, migration path,
comms, phased disable, removal. Watch for: who still depends on it. Checkability: Mixed.

---

## 4. Cross-cutting Packs (Layer 3 — qualities sliced across everything; NFR-heavy)

These inject mostly **non-functional** requirements and are auto-attached based on what the platform
touches (the `surfaces`/`touches`/`data_classification` signals from the routing config).

**Accessibility (WCAG 2.2)** — contrast, keyboard nav, focus order, touch-target size, labels, screen-
reader semantics, motion/animation control. Auto-attached when any UI surface is present. *Blocking-gate
eligible* (the mechanisable parts). Checkability: High.

**Internationalisation / localisation** — string externalisation, locale formats (date/number/currency),
RTL, timezone handling, translation pipeline. Attach when multi-locale is a target. Checkability: Mixed.

**Security hardening** — input validation, authz on every endpoint, secrets management, dependency
scanning, rate limiting, OWASP coverage, ISM/Essential Eight alignment. Auto-attached when `touches`
includes auth or data. Checkability: High.

**Privacy / data rights (APP-aligned)** — consent capture, purpose limitation, data export, deletion/
erasure, retention schedule, breach-notification readiness, PII inventory. Auto-attached when
`data_classification: personal`. Critical for your gov + AU consumer context. Checkability: Mixed.

**Observability / telemetry** — structured logging, metrics, traces, health/readiness, alert thresholds,
dashboards. Attach by default for any platform. Checkability: High.

**Resilience / degraded-mode** — timeouts, retries, circuit breakers, graceful degradation, fallback UX,
backup/restore, disaster-recovery target (RPO/RTO). Watch for: what the platform does when a dependency
is down. Checkability: Mixed.

**Compliance / audit pack** — audit trail completeness, evidence retention, role-segregation, waiver log.
Attach for regulated/government contexts. Checkability: High.

---

## 5. Device / Target Axis (orthogonal — multiplies the NFR set)

Selecting these does **not** add features; it adds device-specific NFRs and constraints on top of every
chosen surface. This is what "compatible on different devices" means concretely.

**Responsive web** — breakpoint behaviour, viewport adaptation, progressive enhancement, browser-support
matrix. NFR: compatibility, performance (page-load budget). Checkability: Mixed.

**PWA (installable / offline)** — service worker, install prompt, offline cache, background sync, app
manifest. Requires the **Sync & offline** foundation. NFR: reliability, compatibility. Checkability:
Mixed.

**Native mobile (iOS / Android)** — platform UI conventions, push tokens, deep
links, app-store compliance, permissions model, offline-first, OTA updates. Requires Sync, Notifications.
NFR: compatibility, interaction, performance. Watch for: app-store review requirements, per-platform
permission UX. Framework is a target-stack choice (e.g. React Native, Flutter, native Kotlin/Swift).
Checkability: Mixed.

**Tablet** — adaptive multi-pane layout, larger touch targets, orientation handling, split-view. NFR:
interaction, compatibility. Checkability: Mixed.

**Desktop** — window management, native menus, file-system access, auto-update,
OS-notification integration. Framework is a target-stack choice (e.g. Electron, Tauri, native). NFR:
compatibility, security (native surface). Checkability: Mixed.

**Kiosk / embedded** — locked-down mode, idle reset, single-purpose UX, offline tolerance. NFR:
reliability, security. Checkability: Mixed.

*Each target injects its NFRs into the merged set; the generator de-dupes. "Dashboard" + native mobile +
PWA = dashboard FRs once, plus mobile + PWA + offline NFRs unioned.*

---

## 6. How a selection feeds the generator

For every archetype the user selects (directly or via blueprint), the generator:

1. **Unions** its FR cluster and NFR cluster into the working set; de-duplicates overlaps.
2. **Attaches cross-cutting packs** automatically from the `touches` / `data_classification` signals.
3. **Multiplies** by each device target's NFRs.
4. **Runs the archetype-specialised gap-check** — the generic 25010 empty-cell pass *plus* this
   archetype's Watch-for list as mandatory probes (a migration with no reconciliation step is flagged;
   a dashboard with no empty-state is flagged).
5. **Logs every injected requirement in the assumption ledger** with provenance, all removable.
6. **Computes the checkability profile** — e.g. "82% High (safe for the loop), 18% Low (review the
   onboarding feel and the landing page)".
7. **Emits the spec** in the standard anatomy, tagged, with the merged "be cautious of" panel up front.

**Maintenance note:** every archetype and blueprint is curated content with an owner, a version, and a
maturity rating shown to the user. Each improvement to a bundle improves every future spec that uses it —
the catalogue compounds. Start with the Battle-tested blueprints fully worked; let Experimental ones
carry a visible "review carefully" flag.
