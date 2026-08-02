# ADR 0007: Internal moderation and operations console

Status: Accepted; build sequenced

Date: 2026-07-24

## Context

Three accepted ADRs converge on the same missing capability, and none of them decides it:

- **[ADR 0002](0002-anonymous-community-knowledge-intake.md)** leaves community contributions, `community_knowledge_edges`, and `community_moderation_values` `pending` "until an authenticated moderation system exists." Review is operator-only through controlled database tooling.
- **[ADR 0005](0005-structured-observation-events.md)** adds `community_observations` (first-class price and outcome rows) as a moderation input, deepening that queue, plus a `store_click` `commerce_events` stream that needs a private aggregation surface.
- **[ADR 0003](0003-retailer-partnership-intake.md)** produces private retailer applications that need a review queue before canonical retailer or offer publication.

Today all four queues are worked by hand in the database. Authentication is provisioned at the infrastructure level but is deliberately absent from the public surface ([ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md)). Without a console the intake and observation pipelines accumulate data no one can triage at scale, and every promotion to a canonical record is a manual SQL action with no audit trail. This is also a precondition for reopening ADR 0001 (its re-entry gate #6 requires an owned moderation operating model).

## Decision

Build an internal, authenticated moderation and operations console as a surface separate from the public application. First release scope:

1. **Read and triage queues** for: community contributions and knowledge edges (`pending` / `community_reported`), `community_observations` (price and outcome), `community_moderation_values` (custom vocabulary), and retailer partnership applications.
2. **Promotion stays gated and attributable.** Turning any submission into a canonical record (product, brand, retailer, offer, concern, ingredient, alias, or clinical relation) remains an explicit moderation action that passes the existing evidence gates. The console records actor, timestamp, and rationale in an audit log and never bypasses a gate — it enforces the [ADR 0002](0002-anonymous-community-knowledge-intake.md) trust boundary and the [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) rule that popularity is never a proxy for safety, authenticity, or authorization.
3. **A private, measurement-only analytics view** over `commerce_events` (`store_click` `priceRank` / `position`) and the existing `community:research:signals` report. Never joined to health-shaped behaviour and never fed back into store ranking ([ADR 0005](0005-structured-observation-events.md) + [ADR 0006](0006-store-ranking-excludes-commercial-signals.md)).
4. **Access is gated by the provisioned authentication** (see below). The console is not linked from, or reachable through, the public product, concern, or Ask Jelo surfaces.
5. **The console uses a neutral private-shell colour context.** It shares JeloCare geometry and interaction grammar with future authenticated surfaces, but uses low-chroma mineral canvas, workspace, and lucent instrument layers rather than the public peach and rose product palette. Muted umber is reserved for active selection and focus; semantic colours communicate operational state only. The decision is implemented through the `--ops-*` token family and documented in [the operations shell guide](../design/OPS_SHELL.md).

## Operator parity

Automation can collect, refresh, or propose. It cannot become the only way to
change JeloCare. Every automated pathway needs a private, attributable operator
equivalent before it can make a governed change or publish a result. The
equivalent may be a console workflow or a controlled runbook while its console
workflow is not yet shipped; it is never an undocumented database edit.

| Pathway | Operator equivalent |
| --- | --- |
| Product catalogue | Create, correct, archive, and restore a product through identity and publication gates. |
| Retailer catalogue | Create, correct, archive, and restore a retailer with its verification record intact. |
| Price observations and refresh | Inspect the source, add or correct an observation, replace a stale value, and preserve the freshness record. |
| Catalogue publishing | Review evidence, publish or unpublish deliberately, and see the resulting public state. |
| Contributions and vocabulary | Review, link, keep for research, or mark not useful without erasing the original report. |

Every consequential action has role checks, validation, an attributable audit
entry, honest failure feedback, and an explicit reversal path. A reversal is a
new audited action with a reason; it restores or retires a published state
without deleting the original report or audit history. This rule does not
authorize generic canonical-record editing or bypass existing evidence gates.

### Manual control surface: complete operational baseline

`/ops` is the human control surface for every automated pathway. Automation is
allowed to discover, enrich, queue, refresh, retry, or recommend work; an
operator must be able to inspect the same input, make the equivalent governed
decision, and understand its public effect. A worker result is a proposal or a
recorded observation, never an unreviewable source of truth.

The baseline is deliberately specific. It is not satisfied by a generic
database editor or an undifferentiated "admin" screen.

| Domain | Manual capability required | Automation may do | Operator boundary |
| --- | --- | --- | --- |
| Product catalogue | Create, inspect, correct, archive, restore, publish, and unpublish an exact product identity. | Discover candidate products, enrich evidence, prepare assets, and suggest changes. | Creation and correction validate brand, identity, package/formula evidence, image provenance, and publication gates. Archive and restore retain history. |
| Retailer catalogue | Create, inspect, correct, archive, restore, and verify a retailer, including its public channels and verification record. | Discover retailer details, check public destinations, and propose refreshes. | A retailer record never becomes trusted merely because a crawler found it or a community member named it. |
| Offers and prices | Inspect the exact product/retailer match, add or correct an offer observation, mark availability, refresh, supersede, retire, and review a queued retry. | Fetch public listings, record bounded observations, detect staleness, and queue retries. | Operators see source, observed time, market, matching evidence, exclusions, and the resulting public price state before accepting it. They cannot attach an ambiguous listing to a product. |
| Catalogue publication | See the proposed public projection, publish or unpublish it deliberately, and reverse a publication decision. | Assemble eligible projections and flag incomplete evidence. | Publication remains an explicit evidence-gated action; neither a successful job nor a queue count publishes a product, retailer, or offer. |
| Contributions, vocabulary, edges, and observations | Review, accept, reject, link, defer, keep for research, reopen, and correct the decision when new evidence changes it. | Classify, deduplicate, suggest aliases, and create review work. | The original submission stays intact. Approving a parent contribution never silently approves every child claim. |
| Failures and retries | Inspect why a refresh or import stopped, retry a safe bounded operation, cancel a pending retry, and record a manual resolution. | Back off, retry within explicit limits, and surface a terminal failure. | Retry must not duplicate offers, overwrite stronger evidence, or hide the earlier failure. Unsafe matches require research, not repeated automation. |
| Audit and reversal | See actor, action, target, rationale, source reference, time, and resulting state; reverse with a reason. | Write machine-attributable attempt and outcome records. | Audit history is append-only. Correction, retirement, restore, and reversal are new events; none delete the original decision or observation. |

The console must keep the distinction between **reviewing evidence** and
**editing a canonical record** visible. It should name the operator task in
plain language (for example, `Check price`, `Publish product`, or `Restore
retailer`) rather than exposing database terms, payload keys, queues, or worker
internals. Raw identifiers and diagnostics may appear only in intentional
Metadata or audit disclosure.

### Operations interaction contract

Manual parity does not permit a dense generic back office. Every manual path
uses the private operations shell and its interaction law:

- At desktop width, sidebar, workspace, and contextual inspector are sibling
  planes. The inspector owns evidence scrolling and has an anchored decision
  region; it is never nested in a workspace card.
- At tablet width, selected context opens in a temporary right side sheet. On
  mobile and touch, it opens in a bottom sheet. The primary queue remains
  visible beneath temporary context whenever possible.
- A list row selects context immediately and marks itself busy while the
  inspector skeleton appears. The UI never waits silently for a full detail
  mount.
- The decision surface states the proposed change, source/evidence, resulting
  public state, and the safe next action. Confirmation replaces the anchored
  decision region in place; it does not open a modal inside an inspector.
- Every action has visible and assistive feedback, a concise failure state, a
  safe retry when retry is valid, and focus restoration after a sheet closes.
- Product, price, retailer, and clinical labels remain consumer-safe. The
  operator UI may be denser, but it does not leak raw implementation language
  into task labels or imply clinical certainty.

The detailed geometry, one-owner scrolling rule, responsive breakpoints, and
loading behaviour remain governed by
[the operations shell guide](../design/OPS_SHELL.md) and
[ADR 0010](0010-operations-interface-and-overview-contract.md). This section
defines what every route must be able to do; those documents define how the
operator experiences it.

## Authentication

*Where identity is verified* and *where auth state lives* are separate decisions. The console builds no credential storage of its own.

- **Identity: Neon Managed Better Auth, already provisioned.** `NEON_AUTH_BASE_URL` is in the environment template — this is the "infrastructure-level" authentication [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) refers to. It is Neon's current managed auth (`@neondatabase/auth`, which wraps Better Auth), **not** the retired Stack Auth, so the mirror table is `neon_auth."user"` (not `users_sync`), and the stable id is `neon_auth."user".id` (the JWT `sub`, equal to `getSession().user.id`). The project uses a JeloCare-branded email one-time code. JeloCare stores no passwords, and operator identity is queryable in SQL. (`VITE_NEON_AUTH_URL` is a Vite leftover the Next SDK does not read.)
- **Durable auth state lives in Neon — the deciding reason to prefer it.** The audit log (actor, action, target, timestamp, rationale) and the operator role list are Neon tables, so a promotion to a canonical record and its audit row commit in the **same transaction** (decision #2). Operator identity is a plain-text soft reference to `neon_auth."user".id` (no FK — the console works before the auth schema exists). Redis is the wrong home for this because it is ephemeral.
- **Audit causality is database-ordered.** `moderation_audit_log.event_sequence` is a database-owned monotonic sequence used for latest-event and per-target state reconstruction. `created_at` remains presentation time; transaction-start timestamps and random UUIDs cannot safely order overlapping writes.
- **Authorization is an explicit allowlist.** Neon Auth proves who a person is; a small operator-role table decides what they may triage or promote. Default deny, no self-service signup.
- **Ephemeral state stays in the existing Upstash Redis** (rate limits, short-lived caches), reusing the HMAC pattern in `lib/community-intake/security.ts` — never as the durable session or audit store.
- **Edge gate for defense in depth.** The console is a separate internal surface (its own route or subdomain) and may additionally sit behind Vercel deployment protection, so it is never reachable from the public app even before app-level auth runs.

Rejected here: a bespoke email/password system (needless credential storage and reset surface, weaker than the provisioned Neon Auth); Redis-only sessions (no durable, transactional audit trail); and reusing the public magic-link intake primitive for operators (it authenticates a *draft*, not a person, and carries no role model).

## Consequences

- The intake, observation, and partnership pipelines become operable at scale instead of operator-only database tooling.
- Moderation actions become auditable and attributable — a precondition several ADR 0001 re-entry gates name (owned moderation model, privacy and audit reviews).
- New dependencies (see [Authentication](#authentication)): wiring the already-provisioned Neon Auth, a Neon audit-log table keyed to the stable subject from `neon_auth."user".id`, and an operator-role allowlist. No new auth vendor and no password storage.
- It does **not** authorize any public community feature. [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) stays in force: no public accounts, ratings, comments, stories, or alerts. This is an internal operations tool only.
- The shell can be reused by future authenticated account work without importing the public product palette. Operations may remain slightly cooler and denser; account surfaces may warm slightly while preserving the same low-chroma private-shell hierarchy.

## Build status

- **Increment 1 (shipped):** the safety spine. Migration `0020_moderation_operations.sql` adds the `moderation_operators` allowlist and the append-only `moderation_audit_log`. `lib/moderation/` holds a strict action schema, a transaction-scoped `recordModerationAction` audit writer, a deny-by-default access guard (`operatorAuthSubject` returns null until Neon Auth is wired; authorization is an active-allowlist lookup), and the first read-only queue view (`listPendingObservations`). `modules/moderation/architecture.test.ts` enforces that the module writes only the audit log, never a canonical record, and defaults access to deny. No route is exposed yet.
- **Increment 2 (console triage shipped):** the public app moved into an `app/(site)/` route group with its own root layout, and a separate `app/(ops)/` root layout gives the console its own shell (no public header, footer, or Analytics). `/ops` and its six queue pages (contributions, edges, observations, vocabulary, retailers, and a read-only commerce-signals view) each call `requireConsoleOperator` first — a `notFound()` on deny. The read layer (`lib/moderation/queues.ts`) and gated status-change writers (`lib/moderation/transitions.ts`) back it. Attributable triage actions are shipped for contributions, edges, observations, vocabulary (including canonical mapping), and retailer applications; commerce signals remains measurement-only.
- **Increment 3 (wired end to end):** `@neondatabase/auth` (Managed Better Auth, pinned `0.4.2-beta`) is wired against its real types — `lib/auth/server.ts` (`createNeonAuth`, lazy so an unconfigured env stays deny-by-default), `lib/auth/subject.ts` (`getAuthSubject` via `getSession()`), the catch-all `app/api/auth/[...path]/route.ts` (404s until configured), and `operatorAuthSubject` delegates to the verified session. The operator sign-in surface lives in its own `app/(auth)/` shell at `/sign-in`: `emailOtp.sendVerificationOtp` sends a one-time code, `signIn.emailOtp` verifies it, and the browser then performs a full navigation to `/ops` so the server guard can claim any pending invitation for that exact verified email. `npm run ops:seed-operator` remains the bootstrap path for the first allowlisted operator. It all comes alive once the Neon Auth and JeloCare transactional-email environment are configured.
- **Increment 4 (accountability shell shipped):** `/ops/activity` reads the append-only decision trail with operator identity, action, target, rationale, and time. Admins can read `/ops/operators`, a role-gated operator directory with active status and recent decision activity.
- **Increment 5 (operator access lifecycle):** migration `0025_operator_access_lifecycle.sql` adds pending email invitations and a separate append-only access audit. An invitation grants no access. Neon Auth must first verify the exact normalized mailbox and provide its stable subject; only then may the server transaction create an active operator and accept the invitation. Admins can invite, resend, change another operator's role, pause or restore access, and revoke a pending invitation. The server prevents duplicate access, self-demotion, self-deactivation, and removal of the last active admin. Delivery failure is recorded and shown honestly. The directory remains readable during migration rollout while every mutation fails closed until the lifecycle schema exists.
- **Next delivery sequence:** [Operations console delivery](../operations/console/README.md) turns this accepted architecture into dependency-ordered workspace, triage, retailer-workflow, and governance phases. It does not authorize any new data mutation or access-management capability by itself.

## Alternatives rejected

- **Continue operator-only database tooling.** Does not scale, leaves no audit trail, and makes every canonical promotion an error-prone manual query.
- **Fold moderation into the public app behind a flag.** Mixes a privileged internal surface with the public trust boundary; the public surfaces stay account-free and health-data-minimal.
- **One generic admin that edits canonical records directly.** Rejected: promotions must pass the same evidence gates as any other; direct canonical edits would bypass the ADR 0002 trust boundary and the catalogue publication gate.
