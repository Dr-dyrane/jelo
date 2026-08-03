# JeloCare Me production roadmap

Updated: 2026-08-03
Status: Planned; this document does not commission feature implementation

This is the canonical delivery roadmap from the shipped JeloCare Me foundation
to production completeness. [JeloCare Me](./JELOCARE_ME.md) remains the canon
for product purpose, routes, vocabulary, and code ownership. This roadmap owns
only delivery order, phase gates, evidence, and the production scorecard.

“Shop.app-level” is a quality bar: fast, coherent, stateful, personalised,
trustworthy, resilient, accessible, observable, and visually polished. It does
not mean copying Shop branding, assets, interface details, or its entire feature
set. The benchmark below is derived from JeloCare's own contracts; no external
Shop or Shopify claim is required.

## Audited baseline: what ships now

The baseline was checked at `2bb3c6941503da66b36fdb545dfdd538ee5c0da7`, a
descendant of the delegated capsule base `735849dab9b1685248fc87731ebd739d7d0959d8`.
It describes code and focused contracts, not an authenticated production smoke.

| Journey | Shipped truth | Missing before production completeness | Evidence |
| --- | --- | --- | --- |
| Entry and authentication | `/me` and every released child route are dynamic and call `requireCustomer()`. A missing Neon Auth session redirects to `/sign-in?next=/me`; the continuation allowlist rejects nested or external destinations. Public search, catalogue, product, concern, and `/consult` routes remain account-free. | Me-owned loading, expired-session, provider-error, retry, and recovery states; production evidence for the complete sign-in-return-sign-out journey; a decided private-data lifecycle before collection begins. | `lib/customer/access.ts`, `lib/auth/sign-in-intent.ts`, `modules/me/customer-access.test.ts` |
| Home | `/me` renders the warm adaptive shell, one Ask Me entry, an exact catalogue feature, and honest Shelf/Routine previews. A real account currently receives empty Shelf and Routine state. | Persistent summaries, actionable recovery when one private source fails, and explainable personal context. | `app/(customer)/me/page.tsx`, `components/me/home/me-home.tsx` |
| Explore and member Product | `/me/explore` searches a server-projected public catalogue in client memory and shows at most 12 exact products. `/me/product/[slug]` preserves an allowlisted parent and reuses public catalogue identity; malformed origins fail to Home. Fresh price evidence may appear and absent evidence is omitted. | Server-backed scale, deliberate personal context, saved-state mutations, explicit stale/error handling, and evidence that retired or superseded product versions never change silently. | `app/(customer)/me/[...route]/page.ts`, `lib/customer/read-model.ts`, `modules/me/me-shell-contract.test.ts` |
| Ask Me and Concerns | `/me/consult` is currently catalogue/context search, not a consultation submission. Real accounts have no stored Concerns. Separately, public `/consult` already returns deterministic, reviewed education with same-site checks, a 64 KiB body limit, and a production-fail-closed 20-request-per-hour network limit; it makes zero model calls and keeps visit context in memory. | An authenticated adapter over the reviewed safety engine, explicit context controls, account-aware abuse protection, cost policy for any optional model wording, and recovery without hiding the public route. | [Ask Jelo](../ASK_JELO_EXPERIENCE.md), `app/api/consult/route.ts`, `lib/consult/security.ts` |
| Shelf | `/me/shelf` is a real authenticated route with a truthful empty state. Only the development-only synthetic customer has populated products. | Owner-isolated persistence, exact-product version references, add/remove behavior, lifecycle controls, mutation states, and cross-owner evidence. | `lib/customer/development-fixture.ts`, `lib/customer/read-model.ts` |
| Routine | `/me/routine` is a real authenticated route with a truthful empty state. The development presentation renders three customer-authored exact products. | Create, edit, order, remove, and recover; routine-specific comprehension and safety boundaries; persistence and lifecycle evidence. | `modules/me/customer-access.test.ts`, `components/me/home/me-home.tsx` |
| Account | The avatar opens an accessible modal with identity, shared appearance control, and Sign out. It is not a fifth navigation destination and has no `/ops` authority. | Session recovery, private-data export/deletion controls once private data exists, status and failure feedback, and support boundaries that do not expose private content. | `components/me/shell/me-account-sheet.tsx`, `modules/me/me-shell-contract.test.ts` |
| Refill and basket decisions | A product contract describes the possible one-store, split, wait, and urgent-now outcomes. | No route, persisted intent, evaluator, forecast, notification, monitor, or customer result ships. | [JeloCare Me · basket timing](./JELOCARE_ME.md#future-basket-timing-intelligence) |
| Resilience and observability | Global errors can retry. Exact offer labels fail closed when current evidence cannot produce a market summary. | Me-owned loading/error/offline/stale/recovery states, private-safe telemetry, service objectives, alerts, and rollback signals. There is no Me-specific `loading` or `error` boundary and no offline mutation contract. | `app/error.tsx`, `modules/commerce/market-price-label.ts`, `app/(customer)/me/` |

The synthetic Amara presentation is local development evidence only. It is not
customer persistence, a seed, a production account, or proof of authenticated
production behavior.

## Observable definition of production complete

A customer can enter from any public evidence route, authenticate without losing
safe intent, and return to a coherent Home. They can explore exact reviewed
products, open a member Product without replacing the public product record,
save and remove Shelf items, author and reorder a Routine, control the Concerns
and context that Ask Me may use, receive bounded non-diagnostic guidance, manage
their account data, and recover from expired sessions or failed operations.

Later, the same customer may express quantities, supply horizon, urgency,
retailer preference, and acceptable wait and receive one of the four
evidence-supported basket outcomes. The product must show uncertainty instead
of creating a fee, price, availability, exact-product match, forecast, or care
claim. Notifications and public community are not required for core Me
production completeness; each remains behind its own post-completeness gate.

Every released phase must cover this state contract on every affected surface:

| State | Observable contract |
| --- | --- |
| Normal | The primary job completes, focus and Back behavior remain coherent, and the UI confirms any change. |
| Empty | The absence is truthful, non-alarming, and offers one working recovery or next action without fabricated content. |
| Loading | A route-owned pending state preserves page identity, prevents duplicate mutation, and does not expose stale private content as current. |
| Error | The customer sees what did not complete, whether data changed, and a safe retry or exit. Input is retained only when its privacy contract permits. |
| Offline | Read-only content is labelled with its last safe sync time when a reviewed private cache exists; otherwise the surface says it is unavailable. Writes never appear committed merely because they were queued locally. |
| Stale | Catalogue, offer, forecast, and derived context show observation or computation freshness. Ineligible evidence is omitted or downgraded to current-options-only. |
| Signed out | Private content is absent, the sign-in continuation is allowlisted, and public evidence remains usable. |
| Authenticated | The server derives the owner for every private read and write. Client owner IDs, route parameters, analytics, or cache keys never authorize access. |
| Recovery | Expired session, provider outage, conflicting edit, failed write, restore, export, and deletion each have a tested path with no cross-owner or silent data loss. |

## Ownership and dependency map

| Owner | Roadmap responsibility |
| --- | --- |
| Customer Experience | Primary owner for `/me`, its models/controllers/views, customer vocabulary, state behavior, and cross-phase integration. |
| Platform Delivery | Authentication, migrations and safe rollout mechanics, service health, rate limits, secrets, telemetry, deployment, recovery, and the scheduled inventory owner. |
| Data Administration | Private datastore constraints, lifecycle operations, auditability, deletion/export execution, and later community moderation data. It does not make `/ops` a customer-data reader. |
| Catalogue Evidence | Immutable exact-product/version provenance, offer and delivery evidence, freshness, and fail-closed eligibility. |
| Public Experience | Public entry, `/consult`, concern, catalogue, and product continuity. Public routes stay independently useful. |
| Clinical Safety | The ADR 0011 Ask Jelo safety lane owns urgency, deterministic guide resolution, product authorization, non-diagnostic language, and its regression corpus. |

Growth Campaigns has no roadmap dependency and receives no private signal.
Retailer and courier roles are not implied implementation owners.

## Sequence decision

The proposed order is directionally correct, with two deliberate changes:

1. Do not ship a data-foundation platform with no customer outcome. Establish
   session hardening, owner isolation, lifecycle behavior, and the first real
   persistent Shelf mutation as one thin vertical slice.
2. Put user-controlled Concerns before authenticated deeper Ask. A customer
   must be able to inspect, correct, omit, and delete persistent context before
   it can influence a guide. The public deterministic Ask route stays available
   throughout, and the authenticated route reuses its safety authority rather
   than replacing it.

The core dependency graph is Phase 1 → Phases 2 and 3; Phase 3 → Phase 4;
Phases 2, 3, and 4 → Phase 5; and Phases 1, 2, 5 plus catalogue evidence →
Phase 6. Phases 7 and 8 are separately funded options, not automatic backlog.

## Phase 1 — private foundation through a real Shelf

**User outcome.** A signed-in customer can save or remove one exact product,
see the result after a new session, export it, delete it, and never see another
customer's Shelf.

**Included.** Session-expiry and sign-in-return recovery; one owner-derived
private storage boundary; Shelf read/add/remove; immutable catalogue identity
version references; idempotent mutation and conflict handling; Me-owned
loading/error/offline states; and the first Account export/delete controls.

**Excluded.** Collections, tags, notes, purchase claims, quantity, Routine,
Concerns, Ask history, recommendations, notifications, analytics profiles,
admin access, and any catalogue write.

**Owner and dependencies.** Customer Experience owns the slice. Platform
Delivery owns auth, migration, release, recovery, and telemetry. Data
Administration reviews datastore isolation and lifecycle execution. Catalogue
Evidence supplies immutable product-version identity.

**Routes, data, and contracts.** Extend `/me/shelf`, `/me/product/[slug]`, and
the Account sheet; add one additive Shelf migration and a server-only service.
Every query and mutation derives the subject on the server, constrains by owner,
references an immutable product identity version, is idempotent, and returns a
small semantic result. No client-supplied owner field exists.

**Entry gate.** Record the allowed private fields; live and backup retention;
export, deletion, restore, and incident behavior; owner-key strategy; session
expiry behavior; threat model; and catalogue identity transition behavior.
Rehearse the additive migration against a production-shaped empty/customer-free
dataset without running it in production.

**Measurable exit gate.** The isolation corpus produces zero cross-owner reads
or writes; add/remove retries produce zero duplicate rows; reload and a new
session reproduce the confirmed Shelf; export and deletion reconcile 100% of
seeded test rows; signed-out and expired-session flows reveal zero private
fields; and every affected state in the state contract has route evidence.

**Quality requirements.** Private payloads stay out of URLs, logs, analytics,
screenshots, public caches, and `/ops`. Mutations announce success/failure,
restore focus, meet 44 px/contrast/reflow requirements, and remain keyboard
complete. Shelf read p95 must be at most 500 ms and mutation p95 at most 800 ms
at the service boundary under the agreed launch load. Emit aggregate latency,
outcome, conflict, and auth-failure counts with trace IDs, never owner or Shelf
contents.

**Test and release evidence.** Pure owner-policy tests; datastore integration
tests with two owners; idempotency, conflict, export, delete, restore, expired
session, offline, keyboard, screen-reader, and 320–1440 px route evidence;
migration dry-run and rollback rehearsal; `npm run verify:release`; `npm run
build`; exact revision READY; public product plus signed-out `/me` smoke; and an
authenticated Shelf smoke before claiming the behavior.

**Rollback.** Disable Shelf mutations and private reads with the smallest
reviewed release toggle, preserve/export already written rows, and ship a
forward fix. Do not down-migrate or discard customer data as an application
rollback.

**Unlocks.** Routine, controlled context, personalised Home/Explore, and refill
intent share a proven owner/lifecycle spine.

## Phase 2 — customer-authored Routine editor

**User outcome.** A customer creates, labels, orders, edits, and removes Routine
steps from exact products they deliberately chose, with a clear saved state and
recovery from conflict or failure.

**Included.** One routine initially; add from Shelf or member Product; reorder;
edit customer-authored moment/label; remove; empty/loading/error/offline states;
product retirement/reformulation decision UI; export/delete extension.

**Excluded.** Prescriptions, automatic routines, dosage, adherence scoring,
streaks, reminders, purchase verification, and silent product substitution.

**Owner and dependencies.** Customer Experience owns the editor. Platform
Delivery and Data Administration extend Phase 1's storage/lifecycle boundary.
Catalogue Evidence owns product-version transition facts; Clinical Safety owns
language constraints, not the customer's ordering choice.

**Routes, data, and contracts.** Extend `/me/routine`, Shelf/member Product
actions, Home preview, and the Account lifecycle. Add routine and ordered-step
records referencing immutable product versions. Server mutations use expected
version or equivalent conflict protection and contiguous deterministic order.

**Entry gate.** Phase 1 passes in production; the routine vocabulary and
successor-product decision contract are approved; conflict, export, deletion,
and rollback designs cover the new tables.

**Measurable exit gate.** Zero cross-owner access; zero silent substitutions;
100% of reorder retry fixtures converge without duplicate/lost steps; a new
session reproduces the authored order; export/deletion reconcile all seeded
rows; and all affected states have observable evidence.

**Quality requirements.** No Routine signal enters ranking, advertising,
clinical authority, or model training. Reordering has keyboard controls,
announcements, visible focus, reduced-motion behavior, and a non-drag
alternative. Initial load p95 is at most 500 ms and save/reorder p95 at most
800 ms. Observe aggregate read/write/conflict/rollback counts without step
content.

**Test and release evidence.** Model and datastore tests for ownership, order,
conflicts, transitions, export/delete and recovery; focused accessibility and
responsive evidence; full release/build gates; exact READY revision; public,
signed-out, and authenticated Routine smoke.

**Rollback.** Disable editing, keep a read-only ordered Routine and export/delete
access, preserve rows, and forward-fix the editor or service.

**Unlocks.** A trustworthy Home summary, explicit routine context for Ask, and
refill quantities/horizons without inferring use from clicks.

## Phase 3 — user-controlled Concerns and care context

**User outcome.** A customer can add, review, correct, omit, archive, and delete
the exact context Ask Me is allowed to use, and can preview that context before
each request.

**Included.** Canonical public concern references; bounded optional customer
text only where approved; provenance (`customer entered`, never inferred);
per-item inclusion; last-updated state; export/delete; and explicit empty,
offline, stale, and recovery behavior.

**Excluded.** Diagnosis, inferred conditions, medical records, images, passive
behavioral profiling, public profiles, community publishing, retailer use,
advertising, rankings, and model training.

**Owner and dependencies.** Customer Experience owns controls and comprehension.
Data Administration owns lifecycle constraints. Clinical Safety owns allowed
fields, escalation language, and canonical concern mapping. Platform Delivery
owns private telemetry and recovery. Public Experience preserves the account-free
concern library.

**Routes, data, and contracts.** Extend `/me/consult`, Home context, and Account;
add owner-isolated context records with source, inclusion state, timestamps, and
schema version. Ask receives only the server-projected, customer-confirmed
subset; no raw client record is trusted as authority.

**Entry gate.** Phase 1 passes; allowed fields, retention, sensitive-data class,
and incident/support boundary are approved; clinical parity covers every
canonical reference; the UI explains use and deletion in plain language.

**Measurable exit gate.** The preview equals the server-projected Ask context in
100% of contract fixtures; excluded or deleted items reach Ask zero times; zero
context enters commercial or public data paths; cross-owner attempts all fail;
and export/deletion reconcile all seeded context rows.

**Quality requirements.** Use native controls and concise non-diagnostic copy;
do not encode private text in URLs or telemetry. Context load/save p95 targets
match Phase 1. Observe only aggregate field class, outcome, latency, and safety
route—not values, owner, or query text.

**Test and release evidence.** Projection/property tests; clinical parity and
abuse-path tests; two-owner datastore tests; lifecycle/recovery evidence;
keyboard, screen-reader, reflow and state matrix; full release/build gates;
exact READY revision and authenticated context smoke.

**Rollback.** Stop context mutation and detach stored context from Ask while
retaining read/export/delete access. Never fall back to silently using all data.

**Unlocks.** Authenticated Ask can become deeper without hiding or inventing
the personal context that shapes it.

## Phase 4 — bounded authenticated Ask Me

**User outcome.** A customer submits an Ask Me request, reviews the context used,
receives deterministic reviewed guidance or a care-first stop, and can retry or
continue without losing control of private state. Public `/consult` remains
available without an account.

**Included.** An authenticated adapter over the existing deterministic safety,
guide, and product-authority core; per-account plus network rate limits; request
size/idempotency controls; explicit context confirmation; session-only results
by default; cost and latency telemetry; recovery and safety-first error states.

**Excluded.** Diagnosis, clinician impersonation, automatic context capture,
public-route login gates, persistent chat transcripts, model-selected urgency,
model-selected products, and an open-ended conversational agent. The initial
member release makes zero model calls. A later language-only model lane requires
its own accepted ADR, privacy review, abuse/cost ceiling, canary, and rollback.

**Owner and dependencies.** Clinical Safety owns every stop, guide, care, and
product decision. Customer Experience owns the member journey. Platform
Delivery owns authenticated request protection, budgets, secrets, observability,
and availability. Public Experience owns compatibility with `/consult`.

**Routes, data, and contracts.** Replace search-only behavior at `/me/consult`
through an authenticated `/api/me/consult`-style boundary that reuses pure
public consult services rather than calling one public HTTP route from another.
Inputs are bounded request text plus the confirmed server-projected context;
outputs remain presentation-safe and exclude internal scores and rule IDs.

**Entry gate.** Phase 3 passes; public safety and concern parity suites are
green; the authenticated threat model, per-account keying, limiter failure mode,
support path, zero-retention default, and cost policy are accepted.

**Measurable exit gate.** 100% of emergency, urgent, condition, medication,
under-18, allergy, and ordinary-care regression fixtures preserve public safety
precedence; stop routes return zero products and zero model calls; excluded
context appears in zero requests; production limiting works for 100% of abuse
fixtures; initial provider cost is exactly $0; deterministic response p95 is at
most 1.5 seconds at the service boundary.

**Quality requirements.** Never log request text, context, direct identifiers,
or returned private guidance. Preserve focus, live-status restraint, 320 px/200%
reflow, reduced motion/transparency, and full keyboard completion. Observe
aggregate route class, safety level, status, rate-limit outcome, latency, and
cost; do not observe concern/query content.

**Test and release evidence.** Shared public/member safety corpus; auth,
same-site, bounded-body, limiter outage, idempotency, timeout, retry, and privacy
tests; accessibility/state evidence; full release/build gates; exact READY
revision; public `/consult`, signed-out `/me/consult`, and authenticated Ask
smokes. No authenticated claim without the last smoke.

**Rollback.** Disable member submission and return `/me/consult` to truthful
catalogue/context search with a link to public `/consult`; do not weaken the
public safety or limiter boundary.

**Unlocks.** Explainable context-aware Home/Explore and optional future wording
assistance under a separate gate.

## Phase 5 — contextual Home, Explore, and member Product

**User outcome.** Home surfaces the next useful self-authored task; Explore and
member Product can use explicitly selected Shelf, Routine, and Concern context,
show why an item appears, and let the customer clear the context.

**Included.** Server-derived summaries; explicit context selectors; explainable
ordering over already eligible exact products; normal/empty/loading/error/offline/
stale states; pagination or bounded server search when catalogue scale requires
it; stable Back and dock behavior.

**Excluded.** Behavioral profiling, popularity as authority, sponsored order,
retailer targeting, purchase inference, opaque ranking, new clinical authority,
and public-route personalization that requires an account.

**Owner and dependencies.** Customer Experience owns composition and ranking
explanations. Catalogue Evidence owns identity and eligibility inputs. Clinical
Safety owns concern/product authority. Platform Delivery owns caching and
private-safe metrics. Public Experience preserves public product continuity.

**Routes, data, and contracts.** Extend the existing `/me`, `/me/explore`, and
`/me/product/[slug]` read models. Derivation stays pure. Context filters can
remove candidates but cannot make an ineligible product eligible. Every result
retains immutable identity and a public evidence link.

**Entry gate.** Phases 2–4 pass; ranking inputs and explanations are reviewable;
empty and fallback behavior is defined; performance testing uses a projected
catalogue above expected launch size.

**Measurable exit gate.** 100% of personalised cards name a customer-understandable
reason; 100% retain exact identity/public evidence; zero ineligible products
enter through personal context; clearing context reproduces the non-personalised
ordering; all affected state-contract cases pass.

**Quality requirements.** Context stays private and is never a commercial
signal. Meet Core Web Vitals targets in the scorecard, preserve the dock evidence
matrix and accessible product semantics, and observe only aggregate result
counts, latency, no-result, and fallback rates.

**Test and release evidence.** Pure eligibility/order/explanation properties;
retired-product and stale-offer fixtures; scale/performance test; accessibility
and viewport evidence; full release/build gates; exact READY revision; public,
signed-out, and authenticated route smokes.

**Rollback.** Turn off contextual derivation and serve the current exact
catalogue projection. Preserve Shelf/Routine/Concern data and their controls.

**Unlocks.** Coherent personal decision support and the explicit products and
preferences required for refill and basket evaluation.

## Phase 6 — refill timing and basket optimisation

**User outcome.** A customer can state quantities, current-supply horizon,
urgency, preferred retailer, and acceptable wait and receive one truthful
outcome: one store now, split now, wait and monitor, or buy urgent items now and
monitor the rest.

**Included.** Explicit intent; quantity-adjusted landed totals; known delivery
fees/policies; number of orders or pickups; current exact-offer observations;
evidence timestamps; uncertainty; current-options-only fallback; and a reviewed
forecast only when history and confidence are sufficient.

**Excluded.** Checkout, payment, courier workflow, retailer promises, invented
fees, guessed availability, purchase verification, scarcity pressure, diagnosis,
automatic routine inference, notification delivery, and a new customer-owned
inventory worker.

**Owner and dependencies.** Customer Experience owns decision presentation.
Catalogue Evidence owns identity, price, stock, fee, and provenance. Platform
Delivery owns evaluator reliability and the existing scheduled inventory lane.
Data Administration owns private intent lifecycle. Retailers and couriers are
not created as product roles by this phase.

**Routes, data, and contracts.** Add a focused Me basket/refill stack surface
only after its route is commissioned; store private intent separately from
canonical offers and price history. Evaluation references evidence snapshots
and returns inputs, freshness, known/unknown costs, outcome, confidence, and
reasons. Unknown delivery is unknown, never zero.

**Scheduled-owner boundary.** Vercel `/api/cron/inventory` at `17 4 * * *` owns
routine queue consumption, leases, retries, and cross-market refresh. This phase
reads its canonical observations and may request a separately reviewed bounded
refresh; it never enqueues the same population, reclaims an unexpired lease,
runs the routine worker, or creates a second refill cron.

**Entry gate.** Phase 1, 2, and 5 data contracts pass; exact identity and offer
freshness are measured in production; fee evidence and forecast eligibility are
defined; the scheduled owner is healthy; founder accepts the objective weights
and uncertainty language; privacy/lifecycle and rollback cover refill intent.

**Measurable exit gate.** Ambiguous identity produces zero recommendations;
unknown fees are treated as zero in zero cases; 100% of recommended outcomes
retain the evidence snapshot and freshness; wait is recommended in zero
ineligible fixtures; current-options-only remains available when forecasts fail;
and evaluator replay returns the same result for the same evidence version.

**Quality requirements.** Private urgency/refill intent never enters advertising,
retailer rank, clinical inference, public analytics, or model training. Totals
are screen-reader understandable and do not rely on color. Evaluation p95 is at
most 1 second after inputs are available. Observe aggregate eligibility,
fallback, evidence-age, outcome-class, and latency—not basket contents or owner.

**Test and release evidence.** Quantity/currency/fee properties; exact-identity,
stale/ambiguous, stock-change, replay, privacy, scheduled-owner, and forecast
backtests; accessibility/state evidence; full release/build gates; exact READY
revision; public and signed-out boundaries plus authenticated basket smoke. Do
not run inventory jobs merely to manufacture release evidence.

**Rollback.** Disable recommendations and show timestamped current options and
known cost components. Preserve customer intent controls and do not alter the
scheduled inventory owner.

**Unlocks.** Only an explicit notification gate; the basket evaluator itself is
production complete without alerts.

## Phase 7 — opt-in notifications, separately gated

**User outcome.** A customer deliberately subscribes to a narrowly described
refill or basket event, sees channel/cadence/freshness, and can pause or
unsubscribe immediately.

**Included.** Explicit opt-in, double confirmation where the selected channel
requires it, preference and consent history, deduplication, cooldown, expiry,
delivery status, unsubscribe, quiet hours, and support-safe observability.

**Excluded.** Marketing, default opt-in, engagement nudges, diagnosis/reminders
about treatment, arbitrary price urgency, campaigns, and community alerts.

**Owner and dependencies.** Platform Delivery owns provider, queue, secrets,
delivery, retries, suppression, and incidents. Customer Experience owns consent
and controls. Catalogue Evidence owns the triggering evidence. Growth Campaigns
has no access to preferences or delivery events.

**Routes, data, and contracts.** Extend Account and the commissioned basket
surface; add preferences, subscriptions, trigger evidence, and delivery audit
records. Use a dedicated scheduled/delivery owner, not the inventory cron.

**Entry gate.** Phase 6 passes; founder selects channel, provider, cadence,
budget, launch cohort, and support policy; consent, retention, abuse, delivery,
and incident decisions are accepted; unsubscribe is available before first send.

**Measurable exit gate.** 100% of sends have active explicit consent and an
eligible fresh trigger; zero duplicate sends per event; unsubscribe suppresses
new sends within 5 minutes; test delivery/retry/dead-letter reconciliation is
100%; and no campaign audience can query subscription state.

**Quality requirements.** Never put sensitive context in lock-screen preview,
subject line, URL, or provider metadata. Controls are keyboard/screen-reader
complete. Observe aggregate send, suppress, retry, bounce, unsubscribe, latency,
and cost; alert on unexpected send volume before budget breach.

**Test and release evidence.** Consent, dedupe, cooldown, expiry, retry,
dead-letter, unsubscribe, provider outage, privacy, accessibility, and cost-cap
tests; delivery dry run to controlled addresses only; full gates; exact READY
revision; controlled production canary and unsubscribe smoke.

**Rollback.** Stop the delivery owner, preserve consent/audit and unsubscribe,
cancel pending sends, and keep the basket evaluator read-only.

**Unlocks.** Nothing in the core Me roadmap; expansion requires demonstrated
decision value without pressure or privacy harm.

## Phase 8 — public community, separately gated

**User outcome.** Only after choosing to publish, a customer can create a
bounded experience record that is visibly separate from private Me data and
from clinical or retailer authority.

**Included.** Only the scope accepted through ADR 0001's re-entry process;
explicit field-by-field publication, preview, edit history, moderation, report,
unpublish, retention, abuse response, and clear community evidence labels.

**Excluded.** Automatic conversion of Concerns/Shelf/Routine/Ask into public
content, public health profiles, direct messages, attention feeds, follower
counts, unmoderated comments, popularity-driven care/ranking, retailer or
courier scope, and campaign reuse.

**Owner and dependencies.** Data Administration owns moderation data and audit.
Public Experience owns the public surface. Customer Experience owns the private
to-public consent boundary. Clinical Safety and Catalogue Evidence own authority
separation. Platform Delivery owns abuse, security, and incidents.

**Routes, data, and contracts.** No route or schema is reserved now. Public
records must be copied through an explicit reviewed publication boundary; they
never expose or directly join private Me tables.

**Entry gate.** All eight ADR 0001 re-entry gates pass; founder explicitly funds
the product and moderation/support model; research demonstrates a need beyond
generic engagement; privacy, safety, threat, retention, and incident decisions
are accepted.

**Measurable exit gate.** 100% of first-release records pass pre-publication
moderation; zero private fields publish without field-level confirmation; zero
community signals influence clinical or commercial ordering; report/unpublish
and audit reconciliation pass 100% of test cases; launch stops on any privacy or
safety incident.

**Quality requirements.** Accessibility covers authoring, preview, moderation
feedback, report, and removal. Performance and observability follow the public
route scorecard without logging private drafts. Abuse and moderation queues have
owned service levels before traffic opens.

**Test and release evidence.** Consent-diff, redaction, moderation, report,
unpublish, abuse, cross-boundary, accessibility, and recovery evidence; full
gates; exact READY revision; controlled author/publisher/public smoke.

**Rollback.** Stop new submissions and publication, unpublish affected records
through the audit path, preserve report/removal access, and retain evidence
according to the accepted incident contract.

**Unlocks.** No automatic follow-on. Ratings, reactions, comments, or profiles
each require another accepted slice.

## Critical path, parallel work, and migrations

The critical path to safe personalised guidance is Phase 1 → Phase 3 → Phase 4
→ Phase 5. Phase 2 can run after Phase 1 in parallel with Phase 3 only in an
isolated worktree with disjoint table, route, component, test, and doc
reservations; shared `lib/customer` and Home/Account composition reconcile once
through Customer Experience. Phase 6 waits for both Phase 2 and Phase 5.

Safe parallel work includes catalogue identity/freshness improvements; Ask
safety corpus expansion that does not change member storage; accessibility
fixtures; performance harnesses; and provider research with no credentials or
external state. Migration, shared customer service, Home/Account integration,
release, and production smoke have one writer and one integration owner.

Each data-bearing phase gets one additive, domain-bounded migration and its own
lifecycle extension. Do not create one speculative customer super-schema.
Initial phases have no backfill or seed. Exact products reference immutable
catalogue identity versions, not mutable display slugs. Feature rollback disables
new behavior and preserves export/deletion; schema rollback is a reviewed
forward migration. A notification outbox appears only in Phase 7. Basket data
references canonical offer observations and never copies or owns the inventory
job ledger.

## Founder decisions and explicit non-goals

Founder decisions genuinely required before their phase:

- Phase 1: private field set, live/backup retention, customer export/deletion
  promise, restore/support expectation, and launch cohort.
- Phase 4: whether a language-only model lane is useful at all; if yes, maximum
  per-response and monthly cost, provider boundary, and canary size. Default is
  the shipped deterministic core and $0 model cost.
- Phase 6: how cost, number of orders/pickups, urgency, preferred retailer, and
  acceptable wait are weighted, plus the customer-facing uncertainty threshold.
- Phase 7: channel, provider, cadence, quiet hours, budget, and support policy.
- Phase 8: whether public community should exist and whether moderation/support
  are funded. The roadmap alone is not approval.

Schema names, indexes, cache shape, component splits, test tools, and trace
implementation are engineering decisions within the accepted contracts, not
founder approvals.

Explicit non-goals across all phases are Shop branding or asset imitation;
making Account a fifth tab; moving admin away from `/ops`; giving `/ops` access
to private customer content; retailer or courier products; campaign activation;
login gates on public evidence; diagnostic or prescriptive care; purchase or
ownership inference; catalogue or offer truth copied into customer tables;
private activity used for advertising, ranking, community, or model training;
and duplicate inventory crons, queues, leases, retries, or manual refreshes.

## Production scorecard

These are launch gates, not vanity metrics. A phase cannot trade correctness or
safety for engagement.

| Signal | Target | Stop or rollback condition |
| --- | --- | --- |
| Owner isolation and privacy | 0 cross-owner reads/writes; 100% of private operations derive owner server-side; 0 private payloads in URLs/logs/analytics/public caches | Any violation or credible exposure |
| Data correctness and recovery | 0 duplicate/lost confirmed mutations in retry/conflict suites; 100% export/delete/restore reconciliation in release fixtures | Any unexplained mismatch or unrecoverable confirmed write |
| Route reliability | At least 99.9% successful eligible Me reads and 99.5% successful writes over a rolling 28-day window after minimum traffic is reached | More than 1% eligible 5xx reads or 2% failed writes for 15 minutes, or any sustained auth-loop |
| Customer performance | Per-route p75 LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.10; phase-specific service p95 targets also pass | Any route at p75 LCP > 4 s, INP > 500 ms, or CLS > 0.25 for 24 hours after excluding a measured platform-wide incident |
| Accessibility | 0 critical/serious automated violations; 100% of the primary journey completes by keyboard at 320 px and 200% text | Any blocking keyboard, focus, name/role/value, reflow, or care-first announcement defect |
| Ask safety and cost | 100% required safety corpus; 0 products on stop routes; 0 unauthorized model calls; 100% limiter fail-closed cases | Any safety-precedence regression, private-context leak, unbounded request, or cost-cap breach |
| Catalogue/basket integrity | 100% displayed decisions bind exact identity and evidence freshness; 0 ambiguous identities; 0 unknown fees treated as zero; 0 ineligible wait recommendations | Any fabricated/ambiguous product, offer, fee, availability, or forecast claim |

## Next smallest executable slice — ready-to-dispatch capsule

Project: JeloCare

Department: Customer Experience

Tier: foundation delivered as one thin vertical slice

Execution surface: visible department task; sole writer and delegated integration owner

Release authority: ship-after-gates

Starting point: current `origin/main`; reconcile the audited baseline before editing
Outcome: one verified customer can add or remove one exact product on My Shelf,
see the confirmed result after sign-out/sign-in, export it, delete it, and never
read or mutate another customer's row.

Reservation request (maximum 12 paths):

1. `db/migrations/0034_customer_shelf.sql`
2. `lib/customer/access-policy.ts`
3. `lib/customer/shelf-repository.ts`
4. `lib/customer/read-model.ts`
5. `lib/customer/portal-model.ts`
6. `app/(customer)/me/actions.ts`
7. `components/me/home/me-home.tsx`
8. `components/me/shell/me-account-sheet.tsx`
9. `modules/me/customer-access.test.ts`
10. `modules/me/customer-shelf.test.ts`
11. `docs/adr/0014-customer-shelf-data-boundary.md`
12. `docs/product/JELOCARE_ME.md`

Entry gate: obtain only the Phase 1 founder decisions; confirm the owner-key and
immutable product-version contract; fetch/reconcile `origin/main`; stop on any
overlapping writer or unresolved migration number. Do not seed customer data.

Acceptance: server-derived owner on every query/mutation; exact identity-version
foreign key; idempotent add/remove; normal, empty, loading, error, offline,
signed-out, expired-session, authenticated, conflict, export, deletion, and
restore evidence; zero cross-owner access in two-owner integration tests; no
private values in URL/log/analytics/cache; Account remains a sheet; `/ops` and
public routes remain unchanged.

Verification and release: focused access/Shelf/migration/lifecycle tests,
accessibility and responsive route evidence, migration dry-run and restore
rehearsal, `npm run verify:release`, `npm run build`, explicit-path staging,
single scoped commit, safe main reconciliation, push, bind the exact revision to
Vercel READY, then smoke public Product, signed-out `/me`, and an authenticated
Shelf add/reload/remove/export/delete test account. Do not claim the
authenticated result without that evidence.

Rollback: disable Shelf writes/reads through the reviewed release boundary,
retain export/deletion, preserve written rows, and forward-fix; never down-migrate
or delete customer data to roll back application behavior.

Exclusions: Routine, Concerns, Ask submission/history, personal ranking,
notifications, community, `/ops`, catalogue writes, inventory cron/queue/manual
refresh, retailers, couriers, campaigns, seeds, and unrelated docs.
