# Product roadmap

Updated: 2026-08-02

The roadmap is ordered by dependency, not novelty.

## Now

### Make product decisions excellent

- Release deliberate, exact-SKU catalogue candidates.
- Improve Nigerian retailer coverage, price freshness, and offer identity.
- Collect physical, website, Instagram, WhatsApp, and Facebook order paths
  without treating discovery as verification.
- Keep high-quality transparent product imagery as a publication gate.
- Polish search, filters, shelves, and product pages with progressive disclosure.
- Expand condition-pattern coverage without creating diagnostic or product-matching paths.

### Complete the knowledge foundation

- Expand complete formula and ingredient evidence.
- Keep recommendation eligibility separate from catalogue visibility.
- Strengthen routine, safety, referral, and concern parity tests.
- Ground Ask Jelo in the same reviewed catalogue and clinical rules.

### Learn from real submissions

- Moderate anonymous community vocabulary.
- Use community reports to prioritize research, never to publish facts directly.
- Launch the retailer partnership path for physical, social, and web stores.
- Turn approved retailer submissions into canonical retailers and exact offers through the existing verification lane.

## Shipped (2026-07-24)

- Evidence-scoped share cards and dynamic OpenGraph images for products, prices, and ingredients (routines remain, below). See [Share and OpenGraph](../SHARE_AND_OPENGRAPH.md).
- Dark mode with a pinned light default. See [Design system · Theme](../design/SYSTEM.md#theme) and [ADR 0004](../adr/0004-default-light-theme.md).
- Retailer freshness surfaced on the market summary, with the contract's `Observed` / `Lowest observed` / `Typical` vocabulary and an honest median.
- Retailer **confidence** surfaced as compared-set coverage (`Based on N of M stores`), never an authenticity grade.
- Store ranking scores seller-identity and brand-authorization evidence, the **landed total** (observed price plus any stated numeric delivery), and a shopper's **fulfilment preference** — all evidence-bound, no commercial signal. See [ADR 0006](../adr/0006-store-ranking-excludes-commercial-signals.md).
- Structured **community observations**: first-class, queryable price and outcome rows for moderation, community-first — see [ADR 0005](../adr/0005-structured-observation-events.md).
- Cookieless **`store_click`** measurement recorded server-side in `/go`, deriving price rank from the market summary — the behavioural half of [ADR 0005](../adr/0005-structured-observation-events.md). Measurement only; never a ranking input.

## Next

- Price-history summaries with sufficient same-offer observations.
- Rank by **location distance / pickup** — the one ranking dimension still deferred: `locationLabel` is free-text with no geo, so this needs a retailer-coordinate dataset (and a consent surface for device location) before it can rank ([ADR 0006](../adr/0006-store-ranking-excludes-commercial-signals.md)).
- The rest of the behavioural taxonomy (`offer_impression`, `product_view`, `share_click`, `search`, `market_switch`, and the other funnel events) plus its private aggregation — `store_click` shipped first. See [ADR 0005](../adr/0005-structured-observation-events.md) and [Analytics](../ANALYTICS.md).
- The remaining share card: **routines** (products, prices, and ingredients already ship).
- An internal moderation and operations console for community and retailer queues — decided in [ADR 0007](../adr/0007-internal-moderation-operations-console.md).

## Later

### Private member portal, after current catalogue and Ops commitments

[ADR 0012](../adr/0012-private-member-shelf-and-routine-portal.md) accepts a dependency-ordered private portal contract; it does not claim that portal routes exist or displace the current catalogue and operations work.

1. Complete the immutable exact-product identity, member-data lifecycle, separate consumer authorization, abuse, accessibility, and observability prerequisites.
2. Release **Phase 1: private Shelf v1** through its bounded alpha, beta, and staged-public gates.
3. After Shelf v1 operates at full release for 28 days without a stop condition and reaches the accepted evidence floor, release **Phase 2: user-created Routine v1** through its own gates.

ADR 0001 continues to defer reminders, notification delivery, stock alerts, public stories, ratings, comments, reactions, profiles, and community features. Do not pull those capabilities into either private phase; each requires a separate accepted decision and owned privacy, safety, moderation, or delivery dependencies.

## Measures

Prefer measures that show decision quality:

- exact-product search success;
- percentage of public products with fresh exact Nigerian offers;
- time since each price observation;
- product pages that answer fit, why, and where without excessive scrolling;
- community and retailer signals that become verified catalogue knowledge;
- safety routes that stop products and models correctly;
- returning users who check a product before buying.

Catalogue count is a coverage indicator, not the north star.
