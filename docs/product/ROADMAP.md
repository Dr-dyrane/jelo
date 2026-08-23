# Product roadmap

Updated: 2026-08-23

The roadmap is ordered by dependency, not novelty.

## Catalogue and evidence debt (2026-08-23)

JeloCare is behind on products, offers, and trends. The cron jobs that should
keep offer evidence fresh have not been running reliably. The catalogue, daily
campaign, and price-story surfaces all depend on fresh evidence, and the
absence of it is now visible to customers.

### Current state (2026-08-23)

- **158 public catalogue products**, but only **60 have any Nigerian offers**
  (38%). **98 products (62%) have zero offers** and cannot show a price, store
  count, or market summary.
- **144 intake candidates** all have `publicationScope: "neutral-reference"` —
  none have bound exact Nigerian offers through the intake pipeline. Offers
  exist only through the separate enrichment/snapshot path.
- **47 Naturium products** (the largest brand cohort) have **zero offers**.
  15 other brands also have zero offers, including Medik8, eos, ESTELIN, ABIB,
  L'Occitane, Fenty Skin, amika, e.l.f., Neutrogena, Aveeno, Saltair, Anessa,
  Beauty of Joseon, Replenix, and Benton.
- Of the 60 products with offers, **46 have exactly 2 offers** and only **8
  have 3+ offers**. The target of ~3 trustworthy stores per product is met for
  only 5% of the catalogue.
- **6 products have only 1 offer** — a single-store monopoly with no comparison.
- The **Daily Desk is unavailable** — the campaign selector finds no eligible
  product with a fresh, shareable Nigerian offer. The `/lagos` page shows the
  "Today's note is being checked" fallback state.
- **8 tests fail** when offers are stale (PanOxyl, Holly's Wellness, Rehmie
  routes leaking or missing) — these are data-freshness failures, not code bugs.
- The **inventory cron** (`/api/cron/inventory`) is configured but the offers
  it should refresh are not being re-verified. The `last_verified_at` field is
  absent from the snapshot offer model, so freshness cannot be assessed from
  the public read model alone.

### What failed

1. **Inventory cron stopped producing fresh offers.** The cron endpoint returns
   401 without the correct `CRON_SECRET`, and there is no evidence that Vercel's
   scheduled invocation has been running successfully. The Neon database may
   have stale or expired offer verifications with no active refresh jobs.
2. **Daily campaign cron finds no eligible candidate.** Every product is
   rejected with `no-fresh-shareable-ng-offer` or `sent-within-14-day-cooldown`.
   The campaign lane correctly fails closed, but the root cause is the missing
   fresh offer evidence.
3. **Offer enrichment stalled.** The 98 products without offers were never
   enriched through the browser-capture or retailer-adapter path. The research
   queue has 48 items, but none have been promoted to candidates with bound
   offers.
4. **Trend and price-history data is absent.** Without fresh observations,
   the trend engine has no comparison windows and the Daily Desk cannot show
   price movement.

### Recovery plan

1. **Verify the inventory cron is running.** Check Vercel cron settings, the
   `CRON_SECRET` environment variable, and the Neon `inventory_refresh_jobs`
   table. Probe `/api/cron/inventory?dry-run` with the correct credential.
2. **Re-verify stale offers.** Use the Playwright MCP browser-capture workflow
   to refresh offers for the 60 products that have them, starting with the
   products that have only 1-2 offers.
3. **Enrich zero-offer products.** Prioritise the 47 Naturium products and
   other zero-offer brands. Use the fast-lane re-verification workflow.
4. **Expand offer breadth.** For products with 1-2 offers, find additional
   Nigerian retailers to reach the ~3-store target.
5. **Resume the daily campaign.** Once fresh offers exist, the campaign
   selector should find eligible products and the Daily Desk should return to
   its ready state.
6. **Monitor cron health.** The inventory cron should enqueue due offers on
   every run. If the backlog grows, investigate retailer adapter failures,
   rate limiting, or database connectivity.

## Now

### Grow the shipped JeloCare Me foundation

- The authenticated `/me` route family, Home/Explore/Shelf/Routine navigation,
  Ask Me and member Product stack routes, adaptive shell, exact catalogue read
  model, honest real-account empty states, and development-only populated
  presentation now ship. Explore partitions the full eligible projection
  without a fixed client cap. The global report helper links to `/contribute`
  from the Account sheet.
- Shelf persistence, Routine persistence, private product requests, complete
  Explore, member-Product OTP continuation, and the global report helper now
  ship. The authoritative capability baseline is
  [`lib/customer/customer-capabilities.ts`](../../lib/customer/customer-capabilities.ts).
- Customer-controlled Concerns, authenticated Ask submission, personalisation,
  lifecycle recovery, basket/refill decisions, and request operating closure
  do not ship. The catalogue snapshot is evidence, not a fixed product limit.
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
Its first candidate slice is a real owner-isolated Shelf plus one global helper
to the existing public `/contribute` intake; it does not create member intake or
private report linkage. Complete eligible-catalogue Explore follows its Phase 5
gate. The roadmap does not authorize implementation. Notifications and public
community remain separately gated deferred options under ADR 0001.

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
