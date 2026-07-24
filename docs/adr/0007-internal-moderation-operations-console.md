# ADR 0007: Internal moderation and operations console

Status: Accepted (design); build sequenced

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

## Authentication

*Where identity is verified* and *where auth state lives* are separate decisions. The console builds no credential storage of its own.

- **Identity: Neon Managed Better Auth, already provisioned.** `NEON_AUTH_BASE_URL` is in the environment template — this is the "infrastructure-level" authentication [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) refers to. It is Neon's current managed auth (`@neondatabase/auth`, which wraps Better Auth), **not** the retired Stack Auth, so the mirror table is `neon_auth."user"` (not `users_sync`), and the stable id is `neon_auth."user".id` (the JWT `sub`, equal to `getSession().user.id`). Sign-in uses whichever method the Neon console has enabled — here the SMTP email magic-link/OTP the operator configured. JeloCare stores no passwords, and operator identity is queryable in SQL. (`VITE_NEON_AUTH_URL` is a Vite leftover the Next SDK does not read.)
- **Durable auth state lives in Neon — the deciding reason to prefer it.** The audit log (actor, action, target, timestamp, rationale) and the operator role list are Neon tables, so a promotion to a canonical record and its audit row commit in the **same transaction** (decision #2). Operator identity is a plain-text soft reference to `neon_auth."user".id` (no FK — the console works before the auth schema exists). Redis is the wrong home for this because it is ephemeral.
- **Authorization is an explicit allowlist.** Neon Auth proves who a person is; a small operator-role table decides what they may triage or promote. Default deny, no self-service signup.
- **Ephemeral state stays in the existing Upstash Redis** (rate limits, short-lived caches), reusing the HMAC pattern in `lib/community-intake/security.ts` — never as the durable session or audit store.
- **Edge gate for defense in depth.** The console is a separate internal surface (its own route or subdomain) and may additionally sit behind Vercel deployment protection, so it is never reachable from the public app even before app-level auth runs.

Rejected here: a bespoke email/password system (needless credential storage and reset surface, weaker than the provisioned Neon Auth); Redis-only sessions (no durable, transactional audit trail); and reusing the public magic-link intake primitive for operators (it authenticates a *draft*, not a person, and carries no role model).

## Consequences

- The intake, observation, and partnership pipelines become operable at scale instead of operator-only database tooling.
- Moderation actions become auditable and attributable — a precondition several ADR 0001 re-entry gates name (owned moderation model, privacy and audit reviews).
- New dependencies (see [Authentication](#authentication)): wiring the already-provisioned Neon Auth, a Neon audit-log table keyed to `neon_auth.users_sync`, and an operator-role allowlist. No new auth vendor and no password storage.
- It does **not** authorize any public community feature. [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) stays in force: no public accounts, ratings, comments, stories, or alerts. This is an internal operations tool only.

## Build status

- **Increment 1 (shipped):** the safety spine. Migration `0020_moderation_operations.sql` adds the `moderation_operators` allowlist and the append-only `moderation_audit_log`. `lib/moderation/` holds a strict action schema, a transaction-scoped `recordModerationAction` audit writer, a deny-by-default access guard (`operatorAuthSubject` returns null until Neon Auth is wired; authorization is an active-allowlist lookup), and the first read-only queue view (`listPendingObservations`). `modules/moderation/architecture.test.ts` enforces that the module writes only the audit log, never a canonical record, and defaults access to deny. No route is exposed yet.
- **Increment 2 (read-only console shipped):** the public app moved into an `app/(site)/` route group with its own root layout, and a separate `app/(ops)/` root layout gives the console its own shell (no public header, footer, or Analytics). `/ops` and its six queue pages (contributions, edges, observations, vocabulary, retailers, and a read-only commerce-signals view) each call `requireConsoleOperator` first — a `notFound()` on deny, so the console 404s for everyone until Neon Auth is wired. The read layer (`lib/moderation/queues.ts`) and gated status-change writers (`lib/moderation/transitions.ts`) back it. Triage *actions* (the write forms/server actions) are the remaining increment-2 slice.
- **Increment 3 (core wired):** `@neondatabase/auth` (Managed Better Auth, pinned `0.4.2-beta`) is wired against its real types — `lib/auth/server.ts` (`createNeonAuth`, lazy so an unconfigured env stays deny-by-default), `lib/auth/subject.ts` (`getAuthSubject` via `getSession()`), the catch-all `app/api/auth/[...path]/route.ts` (404s until configured), and `operatorAuthSubject` now delegates to the verified session. It only comes alive once **you** set `NEON_AUTH_COOKIE_SECRET` + the real `NEON_AUTH_BASE_URL` in Vercel and enable auth in the Neon console. Remaining: the sign-in surface (Neon's `NeonAuthUIProvider`) and seeding the first operator row.

## Alternatives rejected

- **Continue operator-only database tooling.** Does not scale, leaves no audit trail, and makes every canonical promotion an error-prone manual query.
- **Fold moderation into the public app behind a flag.** Mixes a privileged internal surface with the public trust boundary; the public surfaces stay account-free and health-data-minimal.
- **One generic admin that edits canonical records directly.** Rejected: promotions must pass the same evidence gates as any other; direct canonical edits would bypass the ADR 0002 trust boundary and the catalogue publication gate.
