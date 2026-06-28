# Specification: Spec Generator — Improvement Milestone

## Milestone Goal
Evolve the Spec Generator from a single-shot auto-merge tool into a controllable, grounded,
trustworthy requirements partner — so the spec a user hands to a coding agent is high-coverage,
scope-disciplined, change-tracked, and **approved by the user, not silently authored by the model**.
The experience is designed to UX and behavioural-science principles with a hard ethical floor.

## Scope Boundaries

### In Scope
- Human-in-the-loop control over which suggestions enter the spec.
- A clarifying-question dialogue before review.
- Grounding the review in user-supplied context.
- Stable requirement identity, provenance, and change tracking across versions.
- Quantified, testable acceptance criteria and scope discipline.
- A UX/behavioural-science layer (Nielsen, Hick's, Fogg B=MAP, EAST, Prospect Theory,
  Mental Accounting, Goal-Setting, SDT, Peak-End) with a no-dark-patterns ethical floor.

### Out of Scope (this milestone)
- Deep two-way ticketing integrations (Jira/Linear) beyond a single export target.
- Multi-user real-time collaboration and formal sign-off workflows.
- Team-level standards configuration profiles.

---

## Functional Requirements

### FR-1 — Human-in-the-loop review gate *(Must)*
**The system shall** allow the user to accept, reject, or edit each suggested requirement
individually before it is incorporated into the generated specification.
- **AC-1.1** — Given a completed review with N suggestions, when the user opens the rewrite step, then each suggestion presents distinct Accept, Reject, and Edit controls and defaults to a non-accepted state.
- **AC-1.2** — Given the user has accepted a subset of suggestions, when the spec is generated, then only accepted (and accepted-then-edited) suggestions appear in the output, and rejected ones are absent.
- **AC-1.3** — Given a suggestion was edited, when the spec is generated, then the edited text is used verbatim, not the original.

### FR-2 — Draft-to-spec diff *(Must)*
**The system shall** present a visual difference between the original draft and the generated specification.
- **AC-2.1** — Given a generated spec, when the user opens the diff view, then added, changed, and unchanged content are visually distinguished.
- **AC-2.2** — Given a requirement originated from an accepted suggestion, when shown in the diff, then it is marked as added (not pre-existing in the draft).

### FR-3 — Provenance of every requirement *(Must)*
**The system shall** label each requirement in the output as either user-authored or model-introduced.
- **AC-3.1** — Given the final spec, when any requirement is displayed, then it carries a source label of "user" or "model-suggested".
- **AC-3.2** — Given a model-introduced requirement, when listed, then the review finding and standard/technique that surfaced it are retrievable.

### FR-4 — Clarifying-question pre-pass *(Must)*
**The system shall** generate and present clarifying questions about the draft to the user before producing the review.
- **AC-4.1** — Given a submitted draft, when the user starts a review, then the system presents between 3 and 8 clarifying questions targeting the highest-ambiguity gaps before any suggestions are generated.
- **AC-4.2** — Given the user answers some or all questions, when the review runs, then the answers are incorporated and the resulting suggestions reflect them.
- **AC-4.3** — Given the user skips the questions, when the review runs, then the system proceeds and records that assumptions were made in their absence.

### FR-5 — Stated assumptions *(Should)*
**The system shall** output an explicit list of assumptions it made where the draft or answers were silent.
- **AC-5.1** — Given an unanswered ambiguity, when the review completes, then a corresponding assumption appears in an "Assumptions" section phrased as a falsifiable statement.

### FR-6 — Context inputs *(Must)*
**The system shall** accept supplementary context — domain description, constraints, and existing documents — and ground the review in them.
- **AC-6.1** — Given the user provides a domain/context description, when the review runs, then at least one suggestion or gap references that context specifically rather than generically.
- **AC-6.2** — Given the user attaches a constraints document, when the spec is generated, then no suggested requirement contradicts a stated constraint.
- **AC-6.3** — Given no context is provided, when the review runs, then the system completes and flags that suggestions are ungrounded.

### FR-7 — Constraints and out-of-scope sections in output *(Should)*
**The system shall** emit a dedicated Constraints section and an explicit Out-of-Scope section in the generated specification.
- **AC-7.1** — Given tech/constraint context was provided, when the spec is generated, then a Constraints section lists those constraints as discrete items.
- **AC-7.2** — Given the spec is generated, when the Out-of-Scope section renders, then it contains at least the items the user marked excluded or the model deferred.

### FR-8 — Stable requirement identifiers *(Must)*
**The system shall** assign each requirement a unique identifier that persists across review passes, re-runs, and exports.
- **AC-8.1** — Given a requirement assigned ID FR-12, when the spec is regenerated without that requirement being deleted, then it retains ID FR-12.
- **AC-8.2** — Given a requirement is deleted, when the review is re-run, then its ID is not reassigned to a different requirement.
- **AC-8.3** — Given the review and the rewritten spec, when the same requirement appears in both, then it carries the same ID in both.

### FR-9 — Verification method per requirement *(Should)*
**The system shall** assign each requirement a verification method of test, analysis, inspection, or demonstration.
- **AC-9.1** — Given any requirement in the output, when displayed, then exactly one verification method is present.
- **AC-9.2** — Given a requirement with no quantifiable check, when assigned a method, then "analysis" or "inspection" is used rather than "test".

### FR-10 — Quantified, testable acceptance criteria *(Must)*
**The system shall** express every acceptance criterion as a checkable statement with concrete values, emitting an explicit `VALUE NEEDED` placeholder where a threshold cannot be determined.
- **AC-10.1** — Given a generated acceptance criterion, when rendered, then it is structured as Given/When/Then or an assertable predicate with observable outcomes.
- **AC-10.2** — Given a non-functional requirement, when its acceptance criterion is generated, then it contains a numeric threshold, a measurement method, or the literal token `VALUE NEEDED`.
- **AC-10.3** — Given the output contains any `VALUE NEEDED` token, when the spec is displayed, then those tokens are surfaced to the user as items requiring input.

### FR-11 — NFR relevance gate *(Should)*
**The system shall** suppress or down-prioritise non-functional suggestions not justified by the draft or context, defaulting unjustified NFRs to a MoSCoW priority of Could or Won't.
- **AC-11.1** — Given a draft describing a simple single-user CRUD application, when the review runs, then no NFR is assigned Must priority without an explicit triggering statement in the draft or context.
- **AC-11.2** — Given each suggested NFR, when displayed, then a one-line justification ties it to a specific draft element or context item.

### FR-12 — Coverage score transparency *(Should)*
**The system shall** present the coverage score together with the per-category rubric that produced it.
- **AC-12.1** — Given a coverage score, when displayed, then each contributing category shows its status and the factors that set it.
- **AC-12.2** — Given the same draft and context submitted twice with identical answers, when reviewed, then the overall coverage score varies by no more than 5 points (see NFR-2).

### FR-13 — Audience modes / progressive disclosure *(Could)*
**The system shall** let the user toggle standards/methodology jargon between a hidden default and a fully sourced view.
- **AC-13.1** — Given default mode, when the review is displayed, then standards acronyms (ISTQB, ISO 29148, INCOSE, etc.) are collapsed behind a "show sources" control.
- **AC-13.2** — Given the user enables sourced view, when a finding is displayed, then its originating standard and technique are shown inline.

### FR-14 — MVP slicing *(Could)*
**The system shall** classify each requirement into a delivery phase (Now / Next / Later) and emit a thin first-slice specification.
- **AC-14.1** — Given a generated spec, when phases are assigned, then every requirement carries exactly one of Now, Next, or Later.
- **AC-14.2** — Given the user requests the first slice, when it is generated, then it contains only Now-phase requirements and remains internally consistent (no Now requirement depends on a Next/Later one).

### FR-15 — Value-measurement loop *(Could)*
**The system shall** record which suggestions the user kept versus rejected per spec.
- **AC-15.1** — Given a completed rewrite, when persisted, then the count and identity of accepted vs rejected suggestions are stored against that spec.
- **AC-15.2** — Given multiple specs over time, when the user views metrics, then an acceptance rate is reported.

### FR-16 — Export and handoff integrations *(Could)*
**The system shall** export the approved specification to at least one external destination beyond local Markdown download.
- **AC-16.1** — Given an approved spec, when the user chooses an integration target (e.g. GitHub issue), then the spec content is transmitted and a reference/link to the created artifact is returned.
- **AC-16.2** — Given a transient integration failure, when export is attempted, then the user receives an actionable error and the local Markdown export remains available.

### FR-17 — Change tracking and highlighting *(Must)*
**The system shall** track changes to a specification across versions and visibly highlight what changed since the previous version to the user.
- **AC-17.1** — Given a spec that has been reviewed or regenerated more than once, when the user opens it, then the system displays a version history with a timestamp and origin (re-run, manual edit, accepted suggestion) for each version.
- **AC-17.2** — Given two versions of a spec, when the user views the later one, then added, removed, and modified requirements are visually distinguished, not merely re-rendered.
- **AC-17.3** — Given a change between versions, when highlighted, then the affected requirement's stable ID (FR-8) is shown so the change is attributable to a specific requirement.
- **AC-17.4** — Given the user requests it, when viewing history, then they can revert to or export any prior version without losing later versions.
- **AC-17.5** — Given a new version is created, when displayed, then a concise change summary (count of added / removed / modified requirements) is shown before the user inspects the detail.

---

## UX & Behavioural-Science Requirements

*Grounded in Nielsen heuristics, Hick's Law, Cognitive Load Theory, Fogg B=MAP, EAST,
Prospect Theory, Mental Accounting, Goal-Setting & Self-Determination Theory, Peak-End —
with a hard ethical floor (no dark patterns).*

### FR-18 — Single primary action per screen *(Should)* — *Cognitive load / Hick's Law*
**The system shall** present exactly one visually dominant primary action per screen, with secondary actions de-emphasised.
- **AC-18.1** — Given any screen in the review→accept→generate flow, when rendered, then exactly one control carries primary styling and all others are visually subordinate.
- **AC-18.2** — Given a screen with more than five available actions, when displayed, then actions beyond the primary and its immediate alternatives are placed behind progressive disclosure.

### FR-19 — Surface highest-impact suggestions first *(Should)* — *Hick's Law / choice architecture*
**The system shall** order and group suggestions so the user is first presented with the smallest set of highest-impact items rather than the full list at once.
- **AC-19.1** — Given a review with more than ten suggestions, when displayed, then the top items are ranked by severity/priority and the remainder are collapsed under a clear "show all" affordance.
- **AC-19.2** — Given suggestions of differing MoSCoW priority, when listed, then Must items appear above Should, Could, and Won't by default.

### FR-20 — Honest, non-manipulative framing *(Must)* — *Prospect Theory / ethical floor*
**The system shall** frame the risk of omitting a requirement truthfully and shall not employ dark patterns to drive acceptance.
- **AC-20.1** — Given a model-introduced suggestion, when its rationale is shown, then the stated risk is specific and factual, with no fabricated urgency, scarcity, or countdowns.
- **AC-20.2** — Given the user rejects a suggestion, when they confirm, then no confirmshaming language is used; the reject path is neutral and frictionless.
- **AC-20.3** — Given the accept and reject controls, when rendered, then they are presented with equal visual weight (no roach-motel asymmetry making rejection harder than acceptance).

### FR-21 — Progress and competence feedback *(Should)* — *Goal-Setting / SDT competence / Peak-End*
**The system shall** give the user visible feedback on how their specification's coverage improves as they accept suggestions and answer clarifying questions.
- **AC-21.1** — Given the user accepts suggestions or answers clarifying questions, when the state updates, then the coverage indicator updates to reflect the improvement.
- **AC-21.2** — Given a review cycle completes, when the result is shown, then the user sees a clear before→after change in coverage, not only an absolute score.

### FR-22 — Make the next action easy and timely *(Should)* — *Fogg B=MAP / EAST*
**The system shall** present the recommended next step in context at the moment it becomes relevant, requiring minimal user effort to act.
- **AC-22.1** — Given a completed review, when displayed, then the single most valuable next action is surfaced inline rather than requiring the user to discover it.
- **AC-22.2** — Given a clarifying question or suggestion, when presented, then the user can act on it in one interaction without navigating away.

### FR-23 — Preserve user mental-accounting buckets *(Could)* — *Mental Accounting / behavioural economics*
**The system shall** keep functional and non-functional requirements, and user-authored versus model-introduced items, visually separated rather than collapsed into a single undifferentiated list.
- **AC-23.1** — Given the review and spec views, when requirements are listed, then FR/NFR and user/model-suggested groupings are visually distinct and independently scannable.

---

## Non-Functional Requirements

### NFR-1 — Review latency *(Should)* — *ISO 25010: Performance Efficiency*
**The system shall** return a completed review within a bounded time for typical drafts.
- **AC-N1.1** — Given a draft of ≤ 2,000 words, when a review is requested, then the result is returned within `VALUE NEEDED` seconds (recommended target: 30s) at the 95th percentile.

### NFR-2 — Scoring determinism *(Should)* — *ISO 25010: Reliability*
**The system shall** produce stable coverage scores for unchanged inputs.
- **AC-N2.1** — Given identical draft, context, and answers submitted 5 times, when reviewed, then the overall coverage score has a spread of ≤ 5 points across runs.
- **AC-N2.2** — Given identical inputs, when reviewed twice, then no requirement present in one run is wholly absent in category coverage of the other.

### NFR-3 — Output schema validity *(Must)* — *ISO 25010: Functional Suitability*
**The system shall** return review output that conforms to the published result schema.
- **AC-N3.1** — Given any review response, when validated against the schema, then it passes with zero violations.
- **AC-N3.2** — Given a malformed model response, when received, then the system retries or fails gracefully without surfacing a broken UI state.

### NFR-4 — No silent scope injection *(Must)* — *ISO 25010: Functional Suitability*
**The system shall** ensure no requirement reaches the final spec without an explicit user acceptance.
- **AC-N4.1** — Given any requirement in the exported spec, when audited, then it traces to either original draft text or a user-accepted suggestion.

### NFR-5 — Accessibility *(Should)* — *ISO 25010: Interaction Capability*
**The system shall** meet WCAG 2.2 AA for all review, accept/reject, and diff interfaces.
- **AC-N5.1** — Given the review and diff screens, when audited with an automated accessibility checker, then zero Level A or AA violations are reported.
- **AC-N5.2** — Given keyboard-only navigation, when a user accepts/rejects a suggestion, then the action is fully operable without a pointer.

### NFR-6 — Output readability *(Could)* — *ISO 25010: Interaction Capability*
**The system shall** render the generated specification as formatted Markdown rather than unstyled monospace text.
- **AC-N6.1** — Given a generated spec, when displayed, then headings, lists, and emphasis render as styled output and a one-click copy control is available.

### NFR-7 — Context confidentiality *(Should)* — *ISO 25010: Security*
**The system shall** isolate each user's drafts, context attachments, and reviews from other users.
- **AC-N7.1** — Given user A's spec, when user B requests it by ID, then the system returns a not-found/forbidden response and no content.
- **AC-N7.2** — Given an attached context document, when stored, then it is associated only with the owning user's account.

### NFR-8 — ID-registry maintainability *(Should)* — *ISO 25010: Maintainability*
**The system shall** persist the requirement-ID registry per spec so identity survives application restarts and redeployments.
- **AC-N8.1** — Given a spec with assigned IDs, when the application is restarted, then a subsequent re-run preserves all prior IDs (supports FR-8).

### NFR-9 — Graceful provider fallback *(Should)* — *ISO 25010: Reliability*
**The system shall** continue to operate when the primary AI provider is unavailable.
- **AC-N9.1** — Given the configured provider returns an error, when a review is requested, then the system either fails over to the mock/secondary provider or returns an actionable error without data loss.

### NFR-10 — Export portability *(Could)* — *ISO 25010: Portability*
**The system shall** produce exports in a format consumable without the application.
- **AC-N10.1** — Given an exported spec, when opened in any standard Markdown viewer, then it renders with the intended structure and no proprietary dependencies.

### NFR-11 — Usability heuristics conformance *(Should)* — *ISO 25010: Interaction Capability / Nielsen*
**The system shall** maintain visibility of system status and favour error prevention over error recovery throughout the review and generation flow.
- **AC-N11.1** — Given any long-running operation (review, rewrite, export), when in progress, then a status indicator communicates that the system is working.
- **AC-N11.2** — Given a destructive action (reject-all, revert, delete a version), when initiated, then the system requires confirmation or provides an undo path.
- **AC-N11.3** — Given the interface, when evaluated against the 10 Nielsen heuristics by a reviewer, then no heuristic is rated as a severe violation.

### NFR-12 — No dark patterns (ethical floor) *(Must)* — *ISO 25010: Interaction Capability / ethics*
**The system shall** be free of confirmshaming, fake scarcity or urgency, forced continuity, hidden costs, and roach-motel asymmetries.
- **AC-N12.1** — Given a heuristic audit against a published dark-patterns taxonomy, when the review, accept/reject, and export flows are assessed, then zero dark patterns are identified.
- **AC-N12.2** — Given any default setting that affects what enters the spec, when audited, then it is defensible as "what a reasonable, fully-informed user would choose".

### NFR-13 — User autonomy and control *(Should)* — *ISO 25010: Interaction Capability / SDT autonomy*
**The system shall** explain why each suggestion is made and allow the user to opt out of any automated behaviour.
- **AC-N13.1** — Given any model-introduced suggestion, when displayed, then a plain-language "why" is available without leaving the screen.
- **AC-N13.2** — Given automated behaviours (clarifying-question pass, NFR generation), when offered, then the user can disable or skip each one and the system honours that choice.

### NFR-14 — Behavioural-design review gate *(Could)* — *ISO 25010: Maintainability / process*
**The system shall** be assessed against a documented UX and behavioural-design checklist before each release affecting user-facing flows.
- **AC-N14.1** — Given a release touching user-facing components, when prepared, then a completed behavioural-design checklist is attached to the release record.

---

## Success Criteria
- No requirement can reach the exported spec without explicit user acceptance (NFR-4).
- Clarifying questions are offered before every review and their answers measurably change output (FR-4).
- Every spec carries a version history with highlighted, ID-attributed changes (FR-17).
- Requirement IDs are stable across re-runs (FR-8).
- Every acceptance criterion is checkable or explicitly marked `VALUE NEEDED` (FR-10).
- The review, accept/reject, and export flows pass a dark-patterns audit with zero findings (NFR-12).

---

## Traceability
FR-1/2/3 ← accept-reject-gate finding · FR-4/5 ← clarifying-questions finding · FR-6/7 ← context-grounding finding ·
FR-8/9 ← stable-ID & verification-method findings · FR-10/11 ← quantified-AC & scope-inflation findings ·
FR-12 ← coverage-score-distrust finding · FR-13 ← jargon/audience finding · FR-14 ← MVP-slicing finding ·
FR-15/16 ← prove-the-promise & integration findings · FR-17 ← change-tracking request ·
FR-18–23 / NFR-11–14 ← UI/UX + behavioural-science + economics request.
