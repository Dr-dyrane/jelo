# ADR 0020: Linked market-truth system

- **Status:** Accepted; implementation complete, release verification pending
- **Date:** 2026-09-04
- **Decision owner:** Founder
- **Extends:** [ADR 0002](0002-anonymous-community-knowledge-intake.md),
  [ADR 0003](0003-retailer-partnership-intake.md),
  [ADR 0005](0005-structured-observation-events.md),
  [ADR 0006](0006-store-ranking-excludes-commercial-signals.md),
  [ADR 0007](0007-internal-moderation-operations-console.md), and
  [ADR 0019](0019-product-to-place-market-finder.md)
- **Related:** [Retail Intelligence](../RETAIL_INTELLIGENCE.md),
  [Catalogue operations](../catalogue/OPERATIONS.md), and
  [Operations runbooks](../operations/RUNBOOKS.md)

## Decision

JeloCare's market layer is one governed evidence chain:

```text
Retailer
  -> exact offer
  -> verified observation
  -> append-only price history
  -> product market summary and evidence-qualified movement
  -> Share / Products / Markets / Daily Desk
```

The system is not a scraper and no public surface owns an independent price.
Discovery may find a candidate; only reviewed identity and evidence may admit
it. A current public action requires a current exact offer. Historical rows may
describe movement only while they remain bound to that same current offer.

Physical Market Finder observations remain a separate evidence domain joined
through the exact catalogue product and canonical retailer. An online listing
does not prove shelf stock, and a physical observation does not prove online
authorization, delivery, or authenticity.

## Truth units

| Unit                    | Canonical responsibility                                                     | What it cannot prove                                     |
| ----------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| Product identity        | Exact released product, size and package                                     | Current stock or retailer authority                      |
| Retailer identity       | Reviewed public business identity and trust state                            | A particular offer, service or location without evidence |
| Exact online offer      | Product + retailer + normalized HTTPS listing URL + market + currency        | Historical movement or physical stock                    |
| Verified observation    | Current title, size, URL, price, availability, stock and verification window | Earlier prices                                           |
| Price-history row       | Append-only observed price for one offer ID and time                         | A new URL or a current actionable listing                |
| Physical observation    | Exact product at one reviewed retailer location and time                     | Online availability or fulfilment                        |
| Daily Desk acceptance   | Immutable editorial receipt for one evidence-qualified Lagos-day selection   | Continuing validity after its underlying offer changes   |
| Scheduled-owner receipt | Safe operational outcome, aggregate counts and revision                      | Product, customer, URL or raw-error evidence             |

## Identity and freshness contract

An exact online offer is not identified by retailer name alone. Static refresh
may mutate a checked-in offer only when product, retailer, normalized URL,
market and currency select exactly one record. Zero matches, duplicate matches,
or a non-NG/NGN result fail closed. Terminal invalidation is a truth change and
must invalidate the same product and Share projections as a successful price
observation.

Public current-price actions use one predicate: a non-search Nigerian offer
with complete exact listing evidence, an observed comparable naira price,
available stock state, and an unexpired verification window. This governs the
product Share affordance, `/share`, `/share/[slug]`, product market summaries,
market-trend candidates and Daily Desk selection.

The legacy offers table does not persist the checked-in
`priceComparison: "exclude"` decision. Until a separately governed migration
does so, the Ops aggregate queries apply that decision by the same product,
retailer and raw-or-normalized listing URL identity. An excluded or unmatched
identity is not counted as a current comparable offer, product or retailer.
The catalogue reconciliation uses the same exact identity to carry the
checked-in decision onto a newer persisted observation, so Neon freshness
cannot make an excluded offer shareable.

Products may retain an explicitly dated last-known row after expiry, with no
current-price or store-opening claim. Markets may retain stale, disputed or
unavailable research records, but only a current approved physical observation
with a reviewed action becomes travel guidance.

## Price-history contract

Movement comes only from append-only observations. Current offer snapshots are
not reconstructed into past points, and absence of a prior observation is not
called a flat price. A trend requires:

1. one unambiguous current exact offer identity;
2. current persisted URL, price, currency, title, size, availability and
   verification state matching the rendered offer;
3. the latest history row matching that current observation; and
4. at least two time-distinct rows in the selected comparison window.

The legacy `offer_price_history` schema does not retain the URL/title/size
version on each historical row. Until a separately rehearsed migration can add
immutable observation identity, a URL replacement cannot inherit a movement
claim. Missing or mismatched lineage shows no percentage or line. Migration
`0056` is already reserved by customer-retention work, so this decision neither
reuses nor skips that number.

## Discovery and admission

Discovery has two private outcomes:

- `new-product`: the exact product identity is not released;
- `additional-offer-for-known-product`: the product exists but the exact
  retailer/listing key does not.

The second outcome must not be discarded merely because its product is known.
Candidates are deduplicated by exact product identity, normalized retailer and
normalized listing URL, retained in the existing evidence packet/capture
workflow, and reviewed through the existing publication dossier. Discovery has
no direct database or public-write authority.

Admission remains one path:

```text
immutable source capture
  -> private candidate and exact identity review
  -> seller/brand authorization review where applicable
  -> checked-in offer release
  -> protected catalogue reconciliation
  -> scheduled observation refresh
```

Retailer partnership approval is not canonical admission. It may create a
private, PII-free retailer-identity research handoff. Creating the retailer,
publishing contact/location/service facts, and admitting an exact offer remain
separate reviewed operations.

## Retailer truth

For checked-in public and discovery data, `data/retailers.ts` owns matched
retailer review status and trust. A duplicated discovery-source status may only
mirror that registry; unexplained drift is a validation error. Unmatched source
retailers remain private/provisional.

Current exact-offer activity and reviewed Market Finder location/channel
evidence may be projected as dated retailer facts. Free-text notes and private
partnership submissions do not establish current delivery, service, contact,
authorization or location claims. Those dimensions remain visibly unknown or
review-required until a versioned, expiring retailer-evidence schema is
separately approved and migrated.

## Projection matrix

| Surface                | Reads                                                                      | Required behavior                                                                                                |
| ---------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Products               | Exact current offers plus dated last-known rows                            | Current actions only from the shared current predicate; stale rows say check stock/last known                    |
| Share index/detail     | Current offers and qualifying append-only history                          | No stale outbound offer, invented point, flat inference or mismatched series                                     |
| Product market summary | Same current offer set                                                     | Lowest/range/store count recompute from current exact evidence                                                   |
| Market trends          | Current offer identities plus their history                                | Hide movement when lineage or comparison depth is insufficient                                                   |
| Markets                | Exact products with at least one current actionable physical observation   | Directory and destination use the same visit-ready gate; never fall back to an online offer or unreviewed report |
| Retailers              | Reviewed retailer identity plus dated current evidence                     | Never promote private intake or prose notes into current facts                                                   |
| Daily Desk             | Immutable accepted campaign checked against the complete current offer set | Suppress the story after expiry, invalidation, replacement, price mismatch or offer-set change                   |
| Ops market health      | Safe receipts and aggregate canonical health reads                         | Distinguish no evidence, source unavailable, stale, failed and review-required                                   |

## Scheduled owners and reconciliation

The existing owners stay single-purpose and replay-safe:

1. `:17` hourly inventory refreshes known reviewed offers and writes history.
2. `:42` hourly Daily Desk reconciliation creates the day's record when
   evidence becomes eligible after the 07:00 campaign run.
3. `:47` hourly GitHub static integration validates and integrates exact
   checked-in offer proposals.
4. `:07` hourly inventory health evaluates the preceding inventory window.

Each applicable Vercel owner records a bounded private receipt: owner, started
and completed/failed time, fixed outcome code, aggregate counts, deployment
revision and TTL. It stores no raw exception, listing URL, product payload,
recipient, contact, customer or free text. A missing receipt is different from
an empty candidate set; an empty candidate set is different from a source
failure.

Receipt start must succeed before canonical mutation. Settlement is accepted
only for the same still-started generation, so a duplicate completion or
failure cannot rewrite an already terminal receipt. Receipt parsing rejects
owner-incompatible outcomes and future timestamps beyond bounded clock skew.
An existing Daily Desk acceptance is never treated as already current until
the current-day public projection validates one-to-one equality with the full
current exact-offer set. A disabled reconciliation owner remains an attention
state even when an older accepted Desk record still validates.

There is no second refresh queue and no public manual-run button. Ops receives
one read-only native monitor with source time, threshold, responsible owner and
direct recovery path. Public routes remain calm and fail closed.

## UI and operator flow

The market-health surface follows the existing Ops shell and its Monitor mode:
a vertical chain first, exceptions second, progressive detail on demand. It is
not a grid of decorative dashboard cards. Status uses existing typography,
spacing, icons, color semantics and responsive behavior. Copy names the state
and next action; it does not explain the architecture to the operator.

```text
Current
  -> all required owners recent and projections aligned

Review
  -> new offer / retailer / report / partnership evidence awaits a person

Attention
  -> missed owner, stale offer, identity ambiguity, invalid Desk evidence,
     disputed physical record, or unavailable source
  -> open the owning queue or runbook
```

## Security and privacy

- All cron routes retain exact bearer authentication and production-only
  scheduling.
- Receipt error codes are fixed or cryptographically derived; raw errors never
  cross the response, Redis or UI boundary.
- Private retailer contact and partnership data never enters public read
  models or receipts.
- Community reports remain claims until separately reviewed.
- Commercial signals, clicks, partnership status and affiliate value never
  affect ranking.
- No implementation in this decision writes production schema or canonical
  evidence automatically.

## Acceptance passes

The implementation is accepted only after one integration pass proves:

1. **Identity:** duplicate retailer slots are rejected and static refresh
   changes only the exact URL/market/currency record it observed.
2. **Observation:** a successful refresh updates the current offer and appends
   history atomically; terminal contradiction invalidates every affected public
   cache path.
3. **Trend:** no snapshot, seed or missing-history fallback creates a dated
   point; mismatched/current-stale history yields no movement.
4. **Discovery:** a new retailer offer for a known exact product survives
   prioritization and enters private review without auto-publication.
5. **Retailer:** registry/source drift fails validation; authorization evidence
   survives release; private application data stays private/noncanonical.
6. **Projection:** Products, Share, market summaries and Desk agree on current
   offer eligibility; Markets stays physical-evidence-only.
7. **Operations:** authenticated owner receipts distinguish success, empty,
   disabled, degraded and failure; Ops exposes actionable exceptions without a
   mutation control.
8. **Experience:** relevant public and Ops journeys pass mobile and desktop
   rendered behavior, focus, refresh, empty, degraded and recovery checks.
9. **Release:** focused tests, one broad repository gate, exact commit/push,
   READY deployment and affected-route production smoke are recorded
   separately.

## Consequences

JeloCare gains one explainable market system while preserving distinct online,
physical, community, partnership and editorial authority. Some screens will
show less trend or price content when lineage is insufficient; that is the
intended cost of truthful projections. Durable historical offer-version and
general retailer service/delivery evidence remain follow-on migrations, not
fields silently inferred into the current model.
