# ADR 0005: Structured observation and behavioural events

Status: Accepted; shipped (community observations and the store_click event)

Date: 2026-07-24

## Context

Two "structured event" needs sit on the roadmap and had been conflated:

1. **Community observations.** Community intake (`submitCommunityDraft`) already preserves the original submission immutably in `community_contributions.payload` and emits typed `community_knowledge_edges` (product / retailer / price / purpose / outcome triples, `pending`). But price and outcome live only as blob fields and ephemeral edges — there is no first-class, queryable observation row.
2. **Behavioural / commerce events.** `docs/ANALYTICS.md` defines a taxonomy (`store_click`, `share_click`, `offer_impression`, …) as *proposed*. Today only cookieless Vercel page traffic and the `/go` UTM attribution ship; no structured behavioural event is recorded.

Both are unblocked; both must obey the same trust and privacy boundaries.

## Decision

Build both as strict, enum-and-bounded-int structured events, **community observations first**, each cloning an existing proven pattern (`community_intake_events`, `retailer_partnership_events`): a Zod schema with `.strict()` and no free-text fields as the single source of the shape, a Neon table with no `ip` / `user_agent` / query columns by construction, and an idempotent insert.

1. **Community observations (first).** A `community_observations` table (kind enum, `contribution_id` FK, defaults `pending` / `community_reported`) plus a `communityObservations()` emitter slotted into the same transaction as `communityKnowledgeEdges`. Start with price and outcome — the two not represented as rows anywhere. It is a **moderation input only** and never writes canonical catalogue records — the boundary enforced by the architecture test, which the new layer must keep green.

   *Shipped* in migration `0018_community_observations.sql` and `lib/community-intake/`: a strict `communityObservationSchema` (enums and bounded ints, no free text) is the single source of shape; the emitter parses every row through it; a `check` constraint pins a price row to an amount and an outcome row to an outcome; and `modules/community-intake/architecture.test.ts` now asserts the table has no contributor-identifying columns and writes nothing canonical.
2. **Behavioural events (second).** A `commerce_events` table and a `store_click` event recorded server-side inside `app/go/route.ts`, deriving `priceRank` from `summarizeMarket` over the offer set `/go` already resolves. Ship `store_click` alone first.

   *Shipped* in migration `0019_commerce_events.sql`, `lib/analytics/commerce-events.ts`, and `modules/commerce/price-rank.ts`: the event is written through `next/server` `after`, so measurement never delays the outbound redirect; `recordStoreClick` no-ops without Neon and swallows its own errors; a strict `storeClickEventSchema` keeps the payload to enums and bounded ints; and `commerce_events` has no name, account, network-identifier, or query columns. It is measurement only and, per [ADR 0006](0006-store-ranking-excludes-commercial-signals.md), never re-enters ranking — `offer-selection.ts` does not import it.

## Consequences

- Community price/outcome become queryable rows for moderation and research without touching the canonical catalogue.
- Behavioural data is captured cookielessly, with no PII, IP, user-agent, or query text, per the [analytics privacy boundary](../ANALYTICS.md).
- **Hard constraint:** affiliate/outbound value and behavioural events are *measurement only* and never an input to store ranking, guidance, or safety ([ADR 0006](0006-store-ranking-excludes-commercial-signals.md)). Health-shaped behaviour (concern, Ask Jelo) is never joined to commercial or retailer targeting.
- Popularity/engagement counts must never proxy for safety, efficacy, authenticity, or authorization ([ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md)).

## Alternatives rejected

- **One generic events table for both.** Rejected: community observations and commerce behaviour have different schemas, retention, and trust lineages; keeping them separate stops health-shaped data leaking into commercial signals.
- **Free-text event payloads.** Rejected: strict enums plus bounded ints are the existing intake pattern and keep PII out by construction.
