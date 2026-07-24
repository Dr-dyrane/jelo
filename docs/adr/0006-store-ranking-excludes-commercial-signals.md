# ADR 0006: Store ranking excludes commercial and popularity signals

Status: Accepted

Date: 2026-07-24

## Context

The roadmap calls for a "smarter" store ranking. Ranking is where commercial pressure is most tempting: the store that converts better, pays a commission, or is a partner is exactly what a shop would surface first. JeloCare is an information system, not a shop. The invariant that affiliate/outbound value never influences ranking, guidance, or safety is asserted in three places — `docs/UI_PHILOSOPHY.md`, the `docs/ANALYTICS.md` privacy boundary, and [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) — but was never its own decision record, and the measurement pipeline (`/go` attribution, the proposed `store_click` with `priceRank` / `position`) now captures conversion-shaped data that a future change could wire back into the score.

## Decision

Store ranking is a transparent, additive score over **evidence-bound signals only**. Today (`modules/commerce/offer-selection.ts` `rankOffers`) that is: static identity trust, a provisional-source penalty, exact-listing evidence, location, availability with freshness, seller-identity and brand-authorization evidence, and a **consumer-favouring** price term (cheaper ranks higher). Search-only and unverified listings are filtered out before ranking.

The following are **permanently forbidden** as ranking inputs: affiliate / commission / margin; outbound clicks or conversion rate (from `/go` or any `store_click` event); popularity, engagement, or rating counts as a proxy for safety, authenticity, or authorization; and retailer partnership or "featured" status.

Enforcement: a ranking-purity test asserts that `offer-selection.ts` references no click, conversion, affiliate, partnership, or popularity field, and a code-review invariant treats any such reference as a blocker.

## Consequences

- "Smarter ranking" is a scoring wire-up over data already present (e.g. weighting the seller-identity / brand-authorization evidence that is modeled but under-scored), not new commercial inputs.
- **Landed cost now ranks by the total a shopper would pay** via an optional numeric `deliveryNgn` / `deliveryUsd` seam on the offer: `landedMarketPrice` sums an `excluded` observation with a stated delivery fee, treats an `included` observation as already total, and otherwise falls back to the bare observed price — never a guessed total. It is dormant until a listing states a numeric fee, exactly like price history is dormant until Neon fills it.
- **Fulfilment fit is a shopper-chosen preference**, not a hidden filter: a `Prefer` control in `retailer-list.tsx` adds a small `+5` tie-breaker to offers that already declare the chosen `FulfilmentMethod`. The preference only nudges; it never removes a store.
- **Location distance / pickup stays deferred**: `locationLabel` is still free-text with no geo, and true distance ranking needs a retailer-coordinate dataset (and, for device location, a consent surface) that does not exist yet. Not built on fabricated data.
- Confidence is surfaced as **compared-set coverage** (`Based on N of M stores`), never a grade.
- The purity test makes the boundary a build-time gate, not just prose.

## Alternatives rejected

- **Let conversion or partner status break ties.** Rejected: it is the exact failure mode ADR 0001 and UI_PHILOSOPHY forbid — it turns measurement into a ranking input.
- **Rank by popularity or ratings.** Rejected: popularity is not evidence of safety, authenticity, or authorization.
