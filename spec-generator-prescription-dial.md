# Spec Generator — The Prescription Dial (Overlay)

**Problem it solves:** a comprehensive catalogue risks becoming over-prescriptive — injecting hundreds of
requirements and reducing Claude Code to box-ticking. The dial keeps the catalogue *exhaustive as an
instrument* while keeping the emitted spec *restrained as an output*. Every archetype item carries a
prescription level that tells the generator what to *do* with it.

This is the third dial. The three are orthogonal:
- **Checkability** (High/Mixed/Low) — how much *detail* to spend.
- **Prescription** (this doc) — whether an item *binds, guides, or hides*.
- **Provenance / ledger** — whether it's *shown and removable* (audience-facing safety valve).

---

## The three levels

**`constraint`** — binds. Emitted as a hard requirement; **blocks the quality gate** if violated.
- Phrasing rule: always stated as an *outcome or boundary*, never an implementation. "Authorisation is
  enforced server-side on every endpoint" ✅ — not "write a middleware that checks roles" ❌.
- Reserved for the few. Over-using `constraint` recreates the prescription problem.

**`advisory`** — guides. Surfaces in the "be cautious of" panel as a *prompt to consider*; **never
blocks**. Claude exercises judgment; the gap-checker confirms it was considered, not how.
- The default for the large middle. This is where Claude's judgment is the point.

**`silent-default`** — hidden. Handled by the **durable layer** (CLAUDE.md, conventions, your standing
pipeline). *Not emitted into the spec at all* — referenced, assumed. Keeps the spec lean and avoids
contradicting CLAUDE.md.

---

## Assignment rule

```
prescription rises with  BLAST RADIUS   (cost of a silent wrong choice)
prescription falls with  CHECKABILITY   (can Claude / the tests catch it?)

constraint      = high blast radius AND (low checkability OR silent failure mode)
silent-default  = durable architecture/convention — identical every build
advisory        = everything else  (the majority)
```

**Audience interaction — the key subtlety:**
- `constraint` is **audience-invariant**. Blast radius doesn't care who's holding the catalogue. Same set
  for the beginner and for you.
- `advisory` is **where audience changes behaviour**. Beginner → inject generously, show in the ledger.
  Expert (you) → offer to auto-strip what you'd supply yourself.
- `silent-default` is **audience-invariant** — it's the durable layer either way.

So "too prescriptive" is never a property of the catalogue; it's the size of the *advisory* layer you
inject, and the ledger is what makes that safe.

---

## Emergent pattern (the sanity check)

When the rule is applied honestly, `constraint` lands almost entirely on four clusters — and nowhere else:

1. **Security** — server-side authz, isolation, input validation, secrets, encryption.
2. **Privacy / legal** — consent, deletion/export rights, retention, unsubscribe, tax correctness.
3. **Data integrity** — migration reconciliation, idempotency, referential integrity, concurrency races.
4. **Behaviour-preserving invariants** — "don't change the public contract / observable behaviour".

If a proposed `constraint` doesn't fall in one of these, it's probably an `advisory` in disguise. That's
the test that keeps the firm tier honest.

---

## Re-tagged catalogue

Format: **Archetype** — *default level*. `constraint:` deviating items that bind · `silent:` items handled
by the durable layer. (Items not listed inherit the default.)

### Foundations

- **Identity & Access** — *silent-default*. `constraint:` permission check on every endpoint; secure
  session/token handling. `silent:` library choice, login flow conventions.
- **Authorisation & access control** — *constraint*. `constraint:` server-side enforcement everywhere,
  deny-by-default, permission change applies to live sessions. `advisory:` role-model shape (RBAC/ABAC).
- **Tenancy & org model** — *constraint*. `constraint:` cross-tenant isolation (no leakage).
  `advisory:` isolation strategy (row/schema/DB).
- **Data layer & persistence** — *advisory*. `constraint:` referential integrity; migration rollback.
  `silent:` schema conventions, naming.
- **Data & analytics architecture** — *advisory*. `constraint:` no PII in the analytics store without
  basis. `advisory:` OLTP/OLAP split, caching.
- **API / contract layer** — *silent-default*. `advisory:` versioning policy. `silent:` error envelope,
  pagination convention.
- **External / partner API surface** — *advisory*. `constraint:` rate limiting, key rotation, authz on
  every endpoint. `advisory:` SDK, docs, sandbox.
- **Sync & offline** — *advisory*. `constraint:` a conflict-resolution policy is chosen and stated
  (silent data loss otherwise). `advisory:` offline UX states.
- **Background processing & eventing** — *advisory*. `constraint:` idempotent consumers; dead-letter
  handling for failed jobs. `advisory:` ordering guarantees, retry tuning.
- **Notifications** — *advisory*. `constraint:` consent + working unsubscribe (legal). `advisory:` dedupe,
  quiet hours.
- **File & media storage** — *advisory*. `constraint:` file-type validation; access control on retrieval.
  `advisory:` thumbnails, CDN.
- **Search** — *advisory*. `constraint:` permission-aware results (never return what the user can't see).
  `advisory:` ranking, typo tolerance.
- **Audit & logging** — *advisory*. `constraint:` no PII in logs; tamper-evident audit trail (gov).
  `silent:` log format.
- **Observability** — *silent-default*. `advisory:` health/readiness checks exist. `silent:` the rest
  (standing practice).
- **Configuration & feature flags** — *silent-default*.
- **Billing & subscriptions** — *advisory*. `constraint:` entitlement enforced server-side; tax/GST
  correctness. `advisory:` proration, dunning.

### Surfaces

- **Onboarding / signup** — *advisory* (flow + feel are low-checkability; guide, don't bind).
- **Dashboard / analytics** — *advisory*. (Empty/loading/error states are strong advisories — commonly
  forgotten, but verifiable, so they prompt rather than block.)
- **CRUD admin / console** — *advisory*. `constraint:` per-operation authorisation.
- **List + detail** — *advisory* (high checkability, low blast radius — say little).
- **Workflow / multi-step** — *advisory*. `constraint:` transition authorisation (who may move what).
- **Form / data capture & wizards** — *advisory*. `constraint:` accessible error messaging (WCAG-gated).
- **Settings / preferences** — *advisory*.
- **Profile / account** — *advisory*. `constraint:` data export + deletion (privacy rights).
- **Feed / timeline** — *advisory*.
- **Messaging / chat** — *advisory*. `constraint:` block/abuse handling (trust & safety).
- **Calendar / scheduling** — *advisory*. `constraint:` no double-booking (concurrency); correct timezone
  handling.
- **Map / location** — *advisory*. `constraint:` location-permission consent.
- **Marketplace / listings** — *advisory*. `constraint:` both role journeys specified; payment handled on
  platform.
- **Content / CMS** — *advisory*.
- **Reporting / export** — *advisory*. `constraint:` no PII in exports without basis.
- **Notification centre / inbox** — *advisory*.
- **Landing / marketing page** — *advisory* (pure taste — lowest prescription of all).
- **Search & filter results** — *advisory*. `constraint:` permission-aware results (inherits Search).

### Operations

- **Data migration** — *constraint-heavy*. `constraint:` no data loss; idempotent runner; row-count/
  checksum reconciliation; rollback. `advisory:` batching, dry-run ergonomics.
- **Refactoring** — *constraint* (the invariant *is* the spec). `constraint:` observable behaviour
  unchanged; public contract untouched; regression suite must exist (precondition/gate). Almost no FRs.
- **Integration / third-party** — *advisory*. `constraint:` idempotent webhook handling.
  `advisory:` retry/backoff.
- **Bulk import/export** — *advisory*. `constraint:` validation before commit (no partial corruption).
- **Performance optimisation** — *advisory*. `constraint:` behaviour unchanged; meter defined before.
- **Deprecation / sunset** — *advisory*. `constraint:` dependency/usage check before removal.

### Cross-cutting packs

- **Accessibility (WCAG 2.2)** — *mixed*. `constraint:` mechanisable checks (contrast, touch-target,
  keyboard nav, focus order) — blocking-gate. `advisory:` judgment aspects.
- **Internationalisation** — *advisory* (unless a locale is legally mandated → `constraint`).
- **Security (deepened)** — *constraint-heavy*. `constraint:` authz, input validation, encryption in
  transit + at rest, secrets management, dependency/supply-chain scanning. `advisory:` threat-model
  process, pen-test cadence.
- **Privacy / data rights (APP)** — *constraint*. `constraint:` consent, export, deletion, retention
  schedule. `advisory:` consent-UX wording.
- **Observability** — *silent-default*.
- **Resilience / SRE** — *advisory*. `constraint:` backups are restore-tested; RPO/RTO stated.
  `advisory:` timeouts, retries, SLO targets.
- **Compliance / audit** — *constraint* (gov). `constraint:` audit completeness; waiver log with reason.
- **Testing & QA** — *silent-default* (your standing pipeline). `advisory:` coverage target per feature.
- **Product analytics** — *advisory*. `constraint:` consent-aware tracking only.
- **Documentation & ADRs** — *advisory*.
- **Cost / FinOps** — *advisory*.

### Delivery & Operations (Layer 4)

- *silent-default* across the board — this is your standing pipeline, owned by CLAUDE.md/conventions,
  referenced not re-emitted. **Exceptions that bind per-spec:** `constraint:` backward-compatible
  migrations during rollout; least-privilege deploy credentials; restore-tested backups.

### Device targets

- *advisory* across the board (NFRs to consider). **Exceptions:** `constraint:` app-store compliance
  (native mobile); WCAG touch-target/contrast (inherits Accessibility).

---

## How the generator acts on the tag

| Level | Emitted into spec? | Blocks gate? | Where it appears |
|---|---|---|---|
| `constraint` | Yes, as outcome/boundary | **Yes** | Requirements + DoD gate |
| `advisory` | As a prompt | No | "Be cautious of" panel; assumption ledger |
| `silent-default` | No | No (governed by durable gates) | Referenced via CLAUDE.md |

**Net effect on the balance:** the spec a beginner gets is mostly advisory-with-a-firm-spine; the spec you
get is the same spine with the advisory layer thinned to what you didn't already encode. The catalogue
stays comprehensive as a *checker* and lean as an *emitter* — which is the balance you were after.

*Tuning guidance: if the constraint set for a given spec exceeds ~15–20% of its requirements, re-audit —
something advisory has likely been mis-tagged as binding. Firm tier should stay small by design.*
