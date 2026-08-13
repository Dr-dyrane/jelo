# Retail Intelligence

JeloCare is building a Nigerian-first skincare retail intelligence layer.

The product page should answer three questions before a shopper leaves JeloCare:

1. Who currently sells this product in Nigeria?
2. What price, variant, size and stock state did JeloCare observe, and when?
3. What is known about the listing, seller identity, regulator record and brand authorization?

An exact identifier may come from a retailer's product-gallery back label when the image response is hash-bound to that listing and the printed EAN/UPC is reviewed against the manufacturer identity. A retailer `SKU` field never becomes manufacturer evidence merely because its digits match.

## Launch reference retailers

| Retailer      | Reference URL                | Market | Role                                   |
| ------------- | ---------------------------- | ------ | -------------------------------------- |
| Beauty by Daz | https://beautybydaz.com/     | NG     | Primary catalogue and offer reference  |
| Lux Beauty NG | https://www.luxbeautyng.com/ | NG     | Premium Nigerian beauty reference      |
| Teeka4        | https://teeka4.com/          | NG     | Nigerian skincare and beauty reference |

Tracking parameters must not be stored as canonical retailer URLs. Product-level URLs should replace homepage references as they are verified.

## Product-page experience

Nigeria is the default market on product pages. International options remain available as a secondary market.

Each retailer row should show, before navigation:

- retailer name;
- observed price, variant and size;
- observed stock state and timestamp;
- whether delivery or other landed costs are known;
- listing, seller, regulator and brand-authorization evidence as separate facts;
- a clear outbound purchase action.

A shopper should not have to open several retailer pages merely to discover the price.

## Search experience

Product queries show up to three fresh exact offers for the selected market beside each matching product. Store, observed price and observation date are visible before a shopper opens the product or retailer page. Search-only retailer routes, expired observations and price fields without complete observation evidence never appear in this comparison.

## Ranking

Nigerian offers are ranked using evidence-bound signals only ([ADR 0006](./adr/0006-store-ranking-excludes-commercial-signals.md)):

1. verified availability;
2. verification freshness;
3. listing evidence;
4. retailer source status;
5. seller-identity and brand-authorization evidence;
6. the landed total for the exact variant — observed price plus any stated numeric delivery, so cheaper-to-receive ranks higher and a bare price is used only when no total is knowable;
7. a shopper's fulfilment preference, as a small tie-breaker over offers that already declare that method.

Affiliate value, outbound clicks, conversion, popularity, ratings and partner status are never ranking inputs, and a build-time purity test enforces it. A missing price must be labelled as pending verification rather than represented as zero or silently omitted.

## Data model

The retail intelligence chain is:

```text
products
  -> retailers
  -> offers
  -> inventory verification
  -> offer price history
  -> market summaries
  -> AI purchasing context
```

Current prices live on offers. Historical observations live in `offer_price_history`. Refresh workers must preserve previous observations whenever they update a current price.

## Market summaries

For every supported product, JeloCare may compute across the stores actually compared:

- lowest observed Nigerian price;
- median observed price when at least two stores qualify;
- highest current price;
- retailer count;
- in-stock retailer count;
- last verified time;
- 7-day and 30-day movement;
- difference from the compared set's median;
- confidence score.

One qualifying store is labelled `Observed`, never `Best`, `Fair` or `Typical` — a lone price is not representative. Two or more qualifying stores are labelled `Lowest observed` and, for the median of the compared set, `Typical` (a genuine middle of several observations, which a single price can never be). Both are always scoped to the compared set. `Typical` is the reader-facing label; the underlying measure is the median, not the mean. Delivery can change the total unless a landed-cost observation explicitly says it is included. Seven- and 30-day movement compares the same offers at both ends of the window and stays hidden unless the current observation is fresh and an appropriately dated anchor exists.

Price movement is presented as a single up or down arrow beside the price it
describes. `Typical` uses the compared market set; each store row uses only that
exact store offer. A store increase can therefore appear beside a market
decrease without contradiction. Flat movement is silent. The percentage,
evidence window, and compared-offer count remain in the arrow's accessible
label instead of adding visible copy. A retailer SKU, search result, stale
listing, or different store is never used as a substitute history anchor. If
one retailer card currently represents more than one exact offer, its movement
stays hidden until the displayed offer identity is unambiguous.

The UI prefers a valid 30-day comparison, then seven days. While a new history
is still growing, it may compare the latest two checks of the same exact offer
when they are at least 12 hours apart, no more than 14 days apart, and the
current observation is fresh. Rapid retries never become a trend.

When two history rows carry the same observation time, their database recording
time establishes the causal order. Reads then use the immutable history ID only
to keep equal-price rows stable. A conflicting price at the same observation
and recording time is irreducibly ambiguous, so movement for that exact offer
fails closed instead of allowing query or array order to choose a value.

## Safety and trust

Retailer inclusion is not an authenticity guarantee. The runtime model keeps these dimensions separate:

- `listingEvidence`: exact page or API record checked, with source and timestamp;
- `sellerIdentityEvidence`: seller identity checked, with its own source and timestamp;
- `retailerEvidence.identity`: self-published or independently checked retailer identity;
- `retailerEvidence.regulatorMatch`: authority, registration number and independent-register source;
- `brandAuthorizationEvidence`: brand-specific authorization from a brand source;
- `priceObservation`: timestamp, variant, size, stock state and landed-cost status.

Missing evidence stays missing. A seller name, rating, `officialStore` label, regulator registration or retailer claim cannot be promoted into another evidence dimension. None of these fields proves the physical item received by a shopper is authentic.

Private catalogue intake is stricter than a runtime price observation. A qualifying exact offer records the requested and final listing URL, SHA-256/MIME/byte size of the decoded response body, retrieval and reviewer timestamps, and field-level excerpts for the explicit manufacturer GTIN/EAN/UPC label, title, size, adjacent NGN price and controlled stock state. Regulatory evidence uses the same response binding on an exact NAFDAC host and expires after 90 days. Greenbook can bind a GTIN directly; a NAPAMS cosmetics check instead requires an exact-package image that binds the candidate EAN/UPC to the NAFDAC registration number before the active authority result can qualify. Brand-source seller authorization records share one capture timestamp when they cite the same response digest; changing that registry evidence invalidates a bound dossier.

Slique Beauty is provisional and link-only. Its public catalogue may supply dated factual offer observations, but its images and descriptions are not reused. No regulator-number match or brand-authorization evidence is recorded.

Beauty by Daz pages that reject automated fetches are reviewed in a rendered browser. The current original-14 audit lives in `data/retailer-verification/beauty-by-daz-core-14.json`: three exact current matches publish price and stock, while unresolved size or variant pages, a package-image conflict, a sibling redirect, and empty searches remain recorded but withheld. A store's historical presence in the original dossier is a research lead, not proof that it still lists the same product today.

Claims should remain specific to the evidence available.

## Retailer extraction

The refresh worker selects a retailer adapter by canonical hostname. Beauty by Daz, Lux Beauty NG, Teeka4, Perona Beauty and Care to Beauty are registered first.

Extraction order is conservative:

1. JSON-LD `Product` and `Offer` data;
2. product price metadata;
3. a product-scoped WooCommerce stock marker;
4. unknown when no reliable product evidence exists.

Page-wide purchase copy is not stock evidence. Every refresh records the adapter, confidence, evidence labels, observed product title and same-origin canonical URL. High-confidence observations remain fresh longer than incomplete ones.

Production queues and checks a bounded set of exact offers once each day, starting 24 hours before their verification window expires. The cron route is bearer-authenticated, ignores store-search URLs and uses the existing locked job queue so overlapping requests cannot claim the same offer. Public price and availability claims honor both the seven-day maximum and the shorter confidence-based expiry recorded by the worker.

The cron depends on three production prerequisites: a `CRON_SECRET` of at least 16 characters, the `jelocare_app_runtime` database role provisioned in Neon, and `APP_DATABASE_URL` set in Vercel Production (bypassing the Neon integration's auto-generated `DATABASE_URL`). If any is missing, the cron silently fails. See [Troubleshooting: Inventory cron is not running](./catalogue/TROUBLESHOOTING.md#inventory-cron-is-not-running) and [Runbooks: Inventory cron fails](./operations/RUNBOOKS.md#inventory-cron-fails).

The scheduled worker may service every configured market. A manual maintenance
run must pass an explicit two-letter market when its authorization is narrower;
the same boundary constrains fresh claims, expired-lease recovery, and
exhausted-lease settlement. Market scoping consumes the existing ledger and
never requires duplicate jobs.

## Implementation order

1. Register canonical retailer records.
2. Add product-level offer URLs.
3. Extract structured prices and availability.
4. Preserve every price observation.
5. Show Nigerian prices on the product page before navigation.
6. Add observation freshness, variant, stock and landed-cost labels.
7. Compute market summaries and price trends.
8. Ground Pulse responses in the same structured data.
