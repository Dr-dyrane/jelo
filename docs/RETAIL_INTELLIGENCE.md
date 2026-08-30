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

Extraction order is conservative, with four fallback layers:

1. **WooCommerce Store API** — structured JSON from `/wp-json/wc/store/v1/products?slug=` for known Woo retailers. Most reliable; 7-day freshness window.
2. **HTTP fetch + structured-data extraction** — JSON-LD `Product`/`Offer` data, product price metadata, and product-scoped WooCommerce stock markers from the HTML response. Confidence-based freshness: 5 days (high), 3 days (medium), 1 day (low).
3. **Browser fetch + structured-data extraction** — headless Chromium via `playwright-core` for hosts that block server-side HTTP (e.g. Jumia/Cloudflare 403). Lazy-loaded so it never affects cold start. Same extraction and confidence rules as HTTP fetch.
4. **AI Gateway extraction** — sends truncated page HTML (50k chars) to the Vercel AI Gateway for structured price/stock extraction when all above strategies fail. Gated by `INVENTORY_AI_EXTRACTION=true` and `INVENTORY_AI_EXTRACTION_MODEL`. Returns confidence 50 (1-day freshness window only). Zero data retention, no prompt training.

Page-wide purchase copy is not stock evidence. Every refresh records the adapter, confidence, evidence labels, observed product title and same-origin canonical URL. High-confidence observations remain fresh longer than incomplete ones.

Production queues and checks a bounded set of exact offers once each day, starting 24 hours before their verification window expires. The cron route is bearer-authenticated, ignores store-search URLs and uses the existing locked job queue so overlapping requests cannot claim the same offer. Public price and availability claims honor both the seven-day maximum and the shorter confidence-based expiry recorded by the worker.

The authenticated `?dry-run` route is read-only: it reports the current backlog
with `writesPerformed: 0` before enqueue, claim, refresh, alert, cache, or sync
logic. During a real run, transient fetch/runtime failures retain bounded retry
and backoff. Missing title/size evidence and an observed size that cannot be
measured are also transient extraction-quality failures. Only a proven route or
canonical redirect, explicit title mismatch, explicit measurable size mismatch,
unverifiable catalogue expected size, or explicit market-currency mismatch is a
terminal contradiction. The worker immediately expires that database offer
without deleting its prior observation or price history, and proposes a static
fallback invalidation on the configured review branch. The dedicated static
integration workflow then semantically validates the exact offer-only diff,
resolves it through the full-history merge-base/current/proposal data trees,
runs the release gates and build, and atomically advances both branches. The
checked-in fallback is not fail-closed
until that workflow succeeds and the resulting production deployment is ready.
Logs
expose only bounded reason counts rather than retailer content or error messages.

Catalogue reconciliation retains expired reviewed offers as non-current history
instead of dropping their exact URLs. They remain excluded by the public
freshness gate, but the inventory queue can claim and re-verify them after a
product is first projected into Neon. This prevents newly reconciled products
from becoming permanently unreachable by the refresh worker.

## Static file sync

After each cron run, refreshed offers are synced back to `data/retail-offers.ts` via the GitHub Contents API. This keeps the static seed data in sync with the live database so that re-seeding does not reintroduce stale prices.

The sync is opt-in (`STATIC_FILE_SYNC_ENABLED=true` + `GITHUB_TOKEN` + an
existing `inventory-sync-review*` `GITHUB_REPO_BRANCH`) and enforces these
anti-overwrite protections:

- **Never touches manual or AI-only offers** — only confidence-60+
  `retailer_page` and `api` observations are eligible for static sync.
- **Freshness gate** — only updates if the refreshed `last_verified_at` is strictly newer than the static offer's `checkedAt`/`observedAt`.
- **Field-level updates only** — updates `priceNgn`, `available`, `stock`, `observedAt`, and `expiresAt`. Never touches `url`, `match`, `trust`, `variant`, `size`, or any other field.
- **Post-update verification** — confirms all requested fields were actually changed before accepting the update.
- **Terminal contradiction proposal** — a typed contradiction proposes
  `available: false`, `stock: "unknown"`, and an immediate `expiresAt` for the
  exact static offer while preserving its URL, price, title, size, observation
  time, and verification provenance. This changes no checked-in fallback until
  the review-branch commit is inspected, merged, and deployed.
- **Actionable configuration state** — enabled sync distinguishes a missing
  token, missing branch variable, invalid branch namespace, and a syntactically
  valid review branch that GitHub reports as absent.
- **Idempotent integration owner** — `.github/workflows/inventory-static-integration.yml`
  serializes review-branch proposals, rejects every changed path except
  `data/retail-offers.ts`, rejects offer additions/removals and identity/evidence
  changes in the proposal, and uses the full Git merge base to replay that safe
  field delta onto current `main`. Newer current evidence and a deliberate exact
  offer removal supersede an older proposal; an independent safe offer edit is
  retained; a changed URL, retailer, trust, variant, size, or same-timestamp
  disagreement stops for evidence review. The workflow reruns the release gates
  and non-mutating build, then uses one atomic push for `main` and the
  review-branch baseline. If either ref moves during validation, the push fails
  without partially advancing either ref; the hourly integration retry safely
  re-evaluates the latest state without invoking the inventory cron.

The cron depends on three production prerequisites: a `CRON_SECRET` of at least 16 characters, the `jelocare_app_runtime` database role provisioned in Neon, and `APP_DATABASE_URL` set in Vercel Production while the owner-capable Neon integration remains disconnected. If any is missing, the cron fails closed. See [Troubleshooting: Inventory cron is not running](./catalogue/TROUBLESHOOTING.md#inventory-cron-is-not-running) and [Runbooks: Inventory cron fails](./operations/RUNBOOKS.md#inventory-cron-fails).

The scheduled worker may service every configured market. A manual maintenance
run must pass an explicit two-letter market when its authorization is narrower;
the same boundary constrains fresh claims, expired-lease recovery, and
exhausted-lease settlement. Market scoping consumes the existing ledger and
never requires duplicate jobs. Routine static proposals likewise belong to the
integration workflow; a product lane opens only for a reported exception, not
for a second manual merge of a passing proposal.

## Implementation order

1. Register canonical retailer records.
2. Add product-level offer URLs.
3. Extract structured prices and availability.
4. Preserve every price observation.
5. Show Nigerian prices on the product page before navigation.
6. Add observation freshness, variant, stock and landed-cost labels.
7. Compute market summaries and price trends.
8. Ground Pulse responses in the same structured data.
