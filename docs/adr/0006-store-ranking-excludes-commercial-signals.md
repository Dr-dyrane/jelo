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
- Two roadmap sub-dimensions need new data before they can rank: **landed cost** (only an `included` / `excluded` / `unknown` enum today, no numeric delivery amount) and **location distance / pickup** (only free-text `locationLabel`, no geo). They are deferred, not built on fabricated data.
- Fulfilment fit and preferred channel are modeled but also need a user-selected preference input that does not yet exist in `retailer-list.tsx`.
- The purity test makes the boundary a build-time gate, not just prose.

## Alternatives rejected

- **Let conversion or partner status break ties.** Rejected: it is the exact failure mode ADR 0001 and UI_PHILOSOPHY forbid — it turns measurement into a ranking input.
- **Rank by popularity or ratings.** Rejected: popularity is not evidence of safety, authenticity, or authorization.
