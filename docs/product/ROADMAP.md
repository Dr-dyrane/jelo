# Product roadmap

Updated: 2026-08-03

The roadmap is ordered by dependency, not novelty.

## Now

### Grow the shipped JeloCare Me foundation

- The authenticated `/me` route family, Home/Explore/Shelf/Routine navigation,
  Ask Me and member Product stack routes, adaptive shell, exact catalogue read
  model, honest real-account empty states, and development-only populated
  presentation now ship.
- Shelf/Routine persistence, customer-controlled Concerns, authenticated Ask
  submission, personalisation, lifecycle recovery, and basket/refill decisions
  do not ship.
- Use [JeloCare Me](./JELOCARE_ME.md) for product/route ownership and the
  [production roadmap](./JELOCARE_ME_PRODUCTION_ROADMAP.md) for the single
  detailed shipped-vs-missing baseline, dependency order, phase gates,
  scorecard, and ready-to-dispatch next slice.

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

### JeloCare Me feature delivery

[ADR 0013](../adr/0013-founder-led-jelocare-me.md) supersedes the rejected
nine-approver portal contract. The dependency-aware future sequence, including
the deliberate decision to put user-controlled context before deeper Ask, lives
only in the [JeloCare Me production roadmap](./JELOCARE_ME_PRODUCTION_ROADMAP.md).
Its first candidate slice is a real owner-isolated Shelf; the roadmap does not
authorize implementation. Notifications and public community remain separately
gated deferred options under ADR 0001.

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
