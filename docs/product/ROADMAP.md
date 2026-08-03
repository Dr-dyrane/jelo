# Product roadmap

Updated: 2026-08-03

The roadmap is ordered by dependency, not novelty.

## Now

### Establish the JeloCare Me foundation

- Ship the founder-led product and architecture canon for the future `/me`
  customer workspace.
- Keep `/me` equal to Ask, with Ask, Concerns, Shelf, and Routine as the four
  product tabs and Account behind the avatar.
- Land the neutral adaptive workspace dock and thin warm Me adapter without
  creating customer routes, auth, data, AI, or persistence.
- Use [JeloCare Me](./JELOCARE_ME.md), [ADR 0013](../adr/0013-founder-led-jelocare-me.md),
  and the [dock contract](../design/ADAPTIVE_WORKSPACE_DOCK.md) as the DRY canon.

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
nine-approver portal contract. It establishes the customer workspace foundation
without claiming a route or collecting customer data.

1. Commission Ask only with its real evidence/safety controller and owner
   boundary; do not ship a placeholder conversation.
2. Add Concerns with explicit non-diagnostic language and customer ownership.
3. Add Shelf only after immutable exact-product identity and owner-isolated
   storage are implemented and tested.
4. Add Routine only after Shelf and routine-specific safety, comprehension,
   lifecycle, and ownership evidence exist.

Future split-order and wait-for-restock decision support follows the canonical
[basket timing intelligence contract](./JELOCARE_ME.md#future-basket-timing-intelligence);
it is not part of the foundation or current release.

ADR 0001 continues to defer reminders, notification delivery, stock alerts,
public stories, ratings, comments, reactions, profiles, and community features.
Each requires a separate accepted decision and owned privacy, safety,
moderation, or delivery dependencies.

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
