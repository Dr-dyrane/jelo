# JeloCare Me production roadmap

Updated: 2026-08-09
Status: Shelf, Routine, private requests, complete Explore, member-Product OTP, global report helper, deterministic authenticated Ask, and opt-in order-service notifications ship. Protected activation, account-keyed Ask limiting, request operating closure, and production evidence remain.

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

The baseline was rechecked against the current Phase 1 candidate on 2026-08-04.
It describes code and focused contracts, not an authenticated production smoke,
completed operator activation, or the future requirements recorded below. The
exact release revision is recorded only after the checklist passes.

| Journey | Shipped truth | Missing before production completeness | Evidence |
| --- | --- | --- | --- |
| Entry and authentication | `/me` and every released child route are dynamic and derive a verified customer session. Signed-out member Product routes carry only the exact allowlisted `/me/product/[slug]?from=home\|explore\|shelf\|routine` intent through OTP; other customer entry falls back to `/me`, and nested or external destinations fail closed. Public search, catalogue, product, concern, and `/consult` routes remain account-free. | Expired-session and provider-error recovery plus authenticated production evidence for the complete sign-in-return-sign-out journey remain. | `lib/customer/access.ts`, `lib/auth/sign-in-intent.ts`, `modules/me/customer-access.test.ts` |
| Home | `/me` renders the warm adaptive shell, one Ask Me entry, an exact catalogue feature, and honest Shelf/Routine previews. Real accounts read the durable canonical Shelf and persisted Routine. | Persistent Concern summaries, actionable recovery when one private source fails, and explainable personal context. | `app/(customer)/me/page.tsx`, `components/me/home/me-home.tsx` |
| Explore and member Product | `/me/explore` partitions the full eligible publication projection without a fixed client cap. All 59 products in the 2026-08-05 snapshot are reachable by browse or search, and add/retire fixtures change reachability without a count edit. `/me/product/[slug]` preserves an allowlisted parent, reuses public catalogue identity, and restores that exact safe intent after OTP. | Production smoke, explicit stale/error handling, successor behavior, scale evidence, and future customer-controlled contextual ordering remain. | `components/me/home/me-home.tsx`, `lib/customer/explore-model.ts`, `modules/me/customer-explore-model.test.ts` |
| Ask Me and Concerns | `/me/consult` reuses public `/consult`'s deterministic reviewed safety and guidance authority. Private Concerns and exact Shelf/Routine products are excluded by default, explicitly selected and previewed per session, then server-revalidated; no transcript is persisted and the flow makes zero model calls. Real accounts still have no customer-controlled canonical Concern persistence. | Account-keyed abuse protection, authenticated production smoke and telemetry, persistent customer-controlled Concerns, and a separately accepted cost/privacy policy before any optional model wording. | [Ask Jelo](../ASK_JELO_EXPERIENCE.md), `app/api/consult/route.ts`, `components/me/consult/consult-view.tsx`, `lib/consult/security.ts` |
| Canonical Shelf | The Phase 1 candidate adds immutable-version persistence, owner-derived add/remove/read, lifecycle-aware unavailable rows with individual removal, export, and hard-delete clear. The August 4 slice labels the entry **Add to your Shelf** and exposes add on every canonical search match. It fails closed unless `CUSTOMER_SHELF_DATABASE_URL` uses the exact attested `jelocare_shelf_runtime` role. | Complete the protected role/migration/reconciliation release, datastore isolation evidence, reviewed five-item import, owner-credential removal/rotation, and authenticated production smoke. | `db/migrations/0034_customer_shelf.sql`, `db/migrations/0035_runtime_database_roles.sql`, [ADR 0014](../adr/0014-customer-shelf-data-boundary.md) |
| Private missing-product requests | A zero-match canonical search can create an owner-isolated draft or pending request with bounded identity fields and an optional private photo. Requests remain separate from saved Shelf counts and canonical/public catalogue truth; customers can inspect, edit within lifecycle limits, change photo consent, and delete them. | A governed review-to-closure operating path, customer feedback for matched/published outcomes, per-owner request and upload limits, account-wide request export/clear semantics, protected activation through migration `0036`, and authenticated isolation/photo smoke remain. | `db/migrations/0036_customer_product_requests.sql`, `lib/customer/product-request-service.ts`, `components/me/product-requests/` |
| Routine | `/me/routine` ships owner-isolated named routines with 1–20 ordered steps, optimistic revision conflicts, and create/update/delete server actions. Its route-scoped reader feeds one visual sequence; the structured sheet owns create, reorder, edit, and delete. | Persistence lifecycle evidence and authenticated production smoke remain. | `lib/customer/route-read-models.ts`, `db/migrations/0037_customer_routines.sql`, `app/(customer)/me/actions.ts`, `components/me/routine/` |
| Account and global helpers | The Account sheet now links globally to plain `/contribute`, exports the owner-derived Shelf without identity, and offers confirmed hard-delete clear. It remains a non-tab/non-FAB helper and sends no private state. | Dedicated-role activation, authenticated production smoke, and the future provider-account deletion orchestrator remain. Exact-product intake prefill remains excluded. | `components/me/shell/me-account-sheet.tsx`, `app/(customer)/me/shelf/export/route.ts`, [ADR 0014](../adr/0014-customer-shelf-data-boundary.md) |
| Order-service notifications | Canonical customer-visible assisted-order events create one deduplicated private notification. Signed-in customers have `/me/notifications`; guests and members explicitly opt in per order for generic transactional email; Ops sees delivery state and bounded retry. | Production delivery canary, provider/bounce observability, and downstream payment/fulfilment events remain. Refill, basket, campaign, and treatment reminders are not included. | `db/migrations/0041_assisted_order_notifications.sql`, [Assisted procurement](../commerce/ASSISTED_PROCUREMENT.md), [ADR 0016](../adr/0016-retailer-scoped-assisted-procurement.md) |
| Refill and basket decisions | A product contract describes the possible one-store, split, wait, and urgent-now outcomes. | No route, persisted intent, evaluator, forecast, notification, monitor, or customer result ships. | [JeloCare Me · basket timing](./JELOCARE_ME.md#future-basket-timing-intelligence) |
| Resilience and observability | Me has route-owned loading and retryable error boundaries. Exact offer labels fail closed when current evidence cannot produce a market summary. | Offline/stale recovery, private-safe telemetry, service objectives, alerts, and rollback signals. There is no offline mutation contract. | `app/(customer)/me/loading.tsx`, `app/(customer)/me/error.tsx`, `modules/commerce/market-price-label.ts` |

The synthetic Amara presentation is local development evidence only. It is not
customer persistence, a seed, a production account, or proof of authenticated
production behavior.

## Observable definition of production complete

A customer can enter from any public evidence route, authenticate without losing
safe intent, and return to a coherent Home. Explore exposes every product in the
current authoritative eligible public projection—59 at the 2026-08-05 snapshot,
with no fixed count as the projection changes—and makes each discoverable by
browse or search. The customer can open a member Product without replacing the
public product record, save and remove Shelf items, manage a private
missing-product request through a bounded reviewed outcome, author and reorder a
Routine,
control the Concerns and context that Ask Me may use, receive bounded
non-diagnostic guidance, manage their account data, and recover from expired
sessions or failed operations.

From every authenticated Me surface, the customer can invoke one global helper
to report a price or availability observation through the existing public
`/contribute` experience. That action is not a fifth tab, not a page-owned FAB,
and not a member-only intake. It creates no private contribution relationship to
Shelf, Routine, Concerns, or identity. The current public intake does not accept
an allowlisted canonical slug prefill: its query handoff accepts a bounded label
and marks it custom. Therefore the initial member helper links to plain
`/contribute`. Member Product may pass an allowlisted exact-product slug only
after the public intake contract itself implements and tests that safe canonical
prefill. The helper reuses only the fields that public intake safely supports at
release; this roadmap does not claim that a new structured availability field
ships merely because the helper is labelled for price or availability reports.

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
| Recovery | Expired session, provider outage, conflicting edit, failed write, export, deletion, and either implemented restore or an explicit no-restore boundary each have tested behavior with no cross-owner or silent data loss. |

## Ownership and dependency map

| Owner | Roadmap responsibility |
| --- | --- |
| Customer Experience | Primary owner for `/me`, its models/controllers/views, customer vocabulary, state behavior, and cross-phase integration. |
| Platform Delivery | Authentication, migrations and safe rollout mechanics, service health, rate limits, secrets, telemetry, deployment, recovery, and the scheduled inventory owner. |
| Data Administration | Private datastore constraints, lifecycle operations, auditability, deletion/export execution, and the existing public/community contribution and moderation boundary. A signed-in reporter gains no evidence authority. It does not make `/ops` a customer-data reader. |
| Catalogue Evidence | Immutable exact-product/version provenance, offer and delivery evidence, freshness, and fail-closed eligibility. |
| Public Experience | Public entry, `/consult`, `/contribute`, concern, catalogue, and product continuity. Public routes stay independently useful and own any future safe exact-product prefill contract. |
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

**Current implementation truth.** The August 4 local candidate implements the
bounded canonical Shelf and private missing-product request schemas,
server-derived owner, transaction-local RLS setting, explicit owner predicates,
idempotent actions, lifecycle-aware read models, private request/photo controls,
synthetic fixture, Account helper, canonical Shelf JSON export and clear,
reviewed owner-free 5/9 manifest, and dry-run-by-default importer. It is not
production-ready until the protected operator release provisions and audits
`jelocare_app_runtime` and `jelocare_shelf_runtime`, applies migrations `0034`
through `0036`, removes every owner credential from Vercel, records two-owner
isolation evidence, completes the reviewed one-off import, and passes
authenticated smoke. Private requests additionally need a governed operating
closure and per-owner request/upload limits before broad launch.

**User outcome.** A signed-in customer can save or remove an exact product,
see the result after a new session, export and clear canonical Shelf data, never
see another customer's data, and privately request a product only after a
zero-match canonical search. Pending requests never count as saved products.
One global Me helper reaches the existing public price/availability intake.

**Included.** Session-expiry and sign-in-return recovery; one owner-derived
private storage boundary; Shelf read/add/remove; immutable catalogue identity
version references; bounded private request create/read/edit/delete and optional
photo/consent controls; idempotent mutation and conflict handling; Me-owned
loading/error/offline states; the first Account export/delete controls; and one
shell-global Report price or availability action in the Account/helper or
context sheet that navigates to plain `/contribute`.

**Excluded.** Collections, tags, notes, purchase claims, quantity, Routine,
Concerns, Ask history, recommendations, notifications, analytics profiles,
admin access, any catalogue write, a member-only contribution intake or store,
automatic linkage from private state, a fifth tab, and a duplicate page FAB.

**Owner and dependencies.** Customer Experience owns the slice. Platform
Delivery owns auth, migration, release, recovery, and telemetry. Data
Administration reviews datastore isolation and lifecycle execution and retains
ownership of contribution moderation/evidence. Catalogue Evidence supplies
immutable product-version identity. Public Experience owns `/contribute` and
its privacy, request, and prefill contract.

**Routes, data, and contracts.** Extend `/me/shelf`, `/me/shelf/add`,
`/me/shelf/request/[id]`, `/me/product/[slug]`, and the Account/helper sheet;
use additive migrations `0034` through `0036` and server-only services. One
shared shell action navigates to plain `/contribute`.
It sends no auth, Shelf, Routine, Concern, or customer identifier. The existing
public intake's label-based custom handoff is not an exact-product prefill, so
member Product must also use plain `/contribute` until Public Experience adds an
allowlisted slug contract with focused tests.
Every query and mutation derives the subject on the server, constrains by owner,
references an immutable product identity version or bounded private request,
is idempotent, and returns a small semantic result. No client-supplied owner
field exists, and a private request never becomes a saved or public product.

**Entry gate.** Record the allowed private fields; live and backup retention;
export, deletion, the explicit absence of application restore, and incident
behavior; owner-key strategy; session
expiry behavior; threat model; and catalogue identity transition behavior.
Confirm that the public contribution moderation/evidence/privacy boundary is
unchanged and that signed-in origin confers no verification or trust.
Rehearse the additive migration against a production-shaped empty/customer-free
dataset without running it in production.

**Measurable exit gate.** The isolation corpus produces zero cross-owner reads
or writes; add/remove/request retries produce zero duplicate rows; reload and a
new session reproduce confirmed data; canonical Shelf export/clear and private
request deletion reconcile 100% of release fixtures; signed-out and
expired-session flows reveal zero private fields; one non-FAB/non-tab helper
reaches plain `/contribute` from all eight
released Me surfaces; the contribution contains zero automatic private-state or
identity linkage; request/photo limits fail closed; a reviewed request reaches a
customer-visible bounded outcome; and every affected state in the state
contract has route evidence.

**Quality requirements.** Private payloads stay out of URLs, logs, analytics,
screenshots, public caches, and `/ops`. Mutations announce success/failure,
restore focus, meet 44 px/contrast/reflow requirements, and remain keyboard
complete. Shelf read p95 must be at most 500 ms and mutation p95 at most 800 ms
at the service boundary under the agreed launch load. Emit aggregate latency,
outcome, conflict, and auth-failure counts with trace IDs, never owner or Shelf
contents. Private request fields and photos stay out of default Operations
access, and request/upload limits protect storage and review capacity. The
public intake remains anonymous/community-reported and pending
moderation; authentication never upgrades a report into product, price,
availability, retailer, or clinical truth.

**Test and release evidence.** Pure owner-policy tests; datastore integration
tests with two owners; idempotency, conflict, export, delete, request/photo
isolation, limiter, reviewed-closure, provider-backup boundary, expired session,
offline, keyboard, screen-reader, and 320–1440 px route evidence;
migration dry-run and rollback rehearsal; global-helper source/interaction
contract; existing contribution moderation/privacy tests; `npm run
verify:release`; `npm run build`; exact revision READY; public `/contribute` and
Product plus signed-out `/me` smoke; and authenticated shell-helper and Shelf
smokes before claiming either behavior.

**Rollback.** Preserve the additive schema and written rows, keep the two
restricted runtime roles, and deploy the recorded role-compatible floor or a
forward fix. The current code has no recovery-only export/delete mode: removing
the Shelf connection disables all Shelf operations together, and no activation
flag exists. Never down-migrate, restore an owner credential, or discard
customer data as an application rollback. Remove the helper link without
changing `/contribute` if only its shell integration regresses.

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

**Routes, data, and contracts.** The initial release replaces search-only
behavior at `/me/consult` by rendering the shared `ConsultExperience` and using
the existing bounded `/api/consult` authority. Member context originates in the
authenticated route read model, is off by default, and is sent only after an
explicit selection. The API revalidates Concern slugs against reviewed
knowledge and product slugs against the canonical catalogue; products
contribute only their verified ingredient identifiers. Outputs remain
presentation-safe and exclude internal scores and rule IDs. A future separate
member endpoint is required only if account-keyed policy cannot be added safely
to the shared boundary.

**Entry gate.** Phase 3 passes; public safety and concern parity suites are
green; same-site and bounded-body enforcement remain shared; the zero-retention
default and zero-model cost policy are accepted. Per-account keying and its
authenticated threat-model evidence remain a production-completeness gate.

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

**Rollback.** Disable member context and submission, then provide a truthful
link to public `/consult`; do not restore the obsolete catalogue-search
imitation and do not weaken the public safety or limiter boundary.

**Unlocks.** Explainable context-aware Home/Explore and optional future wording
assistance under a separate gate.

## Phase 5 — contextual Home, Explore, and member Product

**User outcome.** Home surfaces the next useful self-authored task. Explore
preserves complete eligible-catalogue reachability while Explore and member
Product use explicitly selected Shelf, Routine, and Concern context, show why
an item appears, and let the customer clear that context.

**Included.** Server-derived summaries; regression protection for the complete
authoritative eligible publication projection already shipped in the baseline;
explicit context selectors; explainable ordering over already eligible exact
products; normal/empty/loading/error/offline/stale states; pagination,
incremental loading, or virtualization as needed; stable Back and dock behavior.

**Excluded.** Behavioral profiling, popularity as authority, sponsored order,
retailer targeting, purchase inference, opaque ranking, new clinical authority,
public-route personalization that requires an account, a fixed 12-product
sample, and a hard-coded 59-product ceiling.

**Owner and dependencies.** Customer Experience owns composition and ranking
explanations. Catalogue Evidence owns identity and eligibility inputs. Clinical
Safety owns concern/product authority. Platform Delivery owns caching and
private-safe metrics. Public Experience preserves public product continuity.

**Routes, data, and contracts.** Extend the existing `/me`, `/me/explore`, and
`/me/product/[slug]` read models. Explore follows the authoritative publication
projection as products publish, retire, or transition. `63` is the 2026-08-03
acceptance snapshot, never a runtime limit. Derivation stays pure. Context
filters can remove candidates but cannot make an ineligible product eligible.
Every result retains immutable identity and a public evidence link.

**Entry gate.** Baseline complete-catalogue reachability remains green, Phases
2–4 pass, and ranking inputs and explanations are reviewable;
empty and fallback behavior is defined; performance testing uses a projected
catalogue above expected launch size; retirement and successor behavior is
covered without silently replacing an exact product.

**Measurable exit gate.** The shipped 59-of-59 reachability and dynamic
add/retire fixtures remain green with zero fixed-count drift; 100% of
personalised cards name a customer-understandable reason and retain exact identity/public
evidence; zero ineligible products enter through personal context; clearing
context reproduces the complete non-personalised projection; and all affected
state-contract cases pass.

**Quality requirements.** Context stays private and is never a commercial
signal. Meet Core Web Vitals targets in the scorecard, preserve the dock evidence
matrix and accessible product semantics. Pagination/incremental loading/
virtualization may protect performance but cannot hide an eligible product.
Observe authoritative-versus-reachable counts, latency, no-result, stale,
retirement, and fallback rates without private query or context values.

**Test and release evidence.** Pure eligibility/order/explanation properties;
59-of-59 snapshot reachability plus add/retire projection fixtures; exact
identity, successor, public-link, stale-offer and error-state fixtures;
scale/performance test; accessibility and viewport evidence; full release/build
gates; exact READY revision; public catalogue/Product, signed-out
`/me/explore`, and authenticated complete-Explore smokes.

**Rollback.** Turn off contextual derivation and serve the complete unpersonalised
eligible catalogue projection; do not restore an arbitrary 12-product cap.
Preserve Shelf/Routine/Concern data and their controls.

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

## Phase 7 — refill and basket subscriptions, separately gated

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

Each data-bearing phase gets an additive, domain-bounded migration and its own
lifecycle extension. Phase 1 uses `0034` for the canonical Shelf domain, `0035`
for the shared runtime-role/grant boundary and one-off receipt, and `0036` for
bounded private missing-product requests, photos, and their deidentified signal
bridge. Do not create one speculative customer super-schema. Initial phases have no generic backfill or
customer seed; Phase 1 has only ADR 0014's reviewed one-off legacy import. Exact
products reference immutable
catalogue identity versions, not mutable display slugs. Later feature rollbacks
preserve export/deletion only when those controls are independently implemented;
Phase 1 follows ADR 0014's role-compatible floor. Schema rollback is a reviewed
forward migration. The narrow order-service delivery audit ships under ADR
0016; a refill/basket subscription outbox appears only in Phase 7. Basket data
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
- Phase 7: refill/basket channel, provider, cadence, quiet hours, budget, and support policy.
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
| Data correctness and recovery | 0 duplicate/lost confirmed mutations in retry/conflict suites; 100% export/delete reconciliation in release fixtures; provider backup evidence never presented as an application restore | Any unexplained mismatch or unrecoverable confirmed write |
| Route reliability | At least 99.9% successful eligible Me reads and 99.5% successful writes over a rolling 28-day window after minimum traffic is reached | More than 1% eligible 5xx reads or 2% failed writes for 15 minutes, or any sustained auth-loop |
| Customer performance | Per-route p75 LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.10; phase-specific service p95 targets also pass | Any route at p75 LCP > 4 s, INP > 500 ms, or CLS > 0.25 for 24 hours after excluding a measured platform-wide incident |
| Accessibility | 0 critical/serious automated violations; 100% of the primary journey completes by keyboard at 320 px and 200% text | Any blocking keyboard, focus, name/role/value, reflow, or care-first announcement defect |
| Explore completeness | 100% of the authoritative eligible public projection is reachable by browse/search; 59 of 59 at the 2026-08-05 snapshot; zero fixed-count drift | Any eligible exact product silently unreachable, any ineligible/retired product exposed, or any hard-coded catalogue ceiling |
| Private request operations | 100% owner isolation and delete reconciliation; reviewed requests reach a bounded customer-visible outcome; per-owner request/upload limits fail closed | Any cross-owner or photo exposure, unbounded intake, orphaned private data, or request accepted without an operating closure |
| Ask safety and cost | 100% required safety corpus; 0 products on stop routes; 0 unauthorized model calls; 100% limiter fail-closed cases | Any safety-precedence regression, private-context leak, unbounded request, or cost-cap breach |
| Catalogue/basket integrity | 100% displayed decisions bind exact identity and evidence freshness; 0 ambiguous identities; 0 unknown fees treated as zero; 0 ineligible wait recommendations | Any fabricated/ambiguous product, offer, fee, availability, or forecast claim |

## Next executable step — protected Phase 1 activation

The implementation slice is complete locally. The next unit is the ordered
[Customer Shelf release checklist](../operations/RELEASE.md#customer-shelf-release-checklist):
provision the two restricted roles; migrate and reconcile through `0036`; pass
the rehearsal and production acceptance audit; run the receipt-guarded one-off
import and verify its receipt; probe and configure the restricted runtime URLs
while removing every owner credential from Vercel; deploy; smoke; rotate the
former owner; and record the role-compatible rollback floor.

Do not describe Phase 1 as production-active without that evidence. Before
private requests open beyond a controlled cohort, add a governed review-to-
customer closure and fail-closed per-owner request/upload limits. Routine
authoring and persistence, canonical user-controlled Concerns, true AI guidance,
full provider-account deletion, recovery-only export, and new cron or inventory
work remain outside this activation. Complete-catalogue Explore is implemented
locally but still requires authenticated production smoke.
