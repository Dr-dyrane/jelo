# Retail Intelligence

JeloCare is building a Nigerian-first skincare retail intelligence layer.

The product page should answer three questions before a shopper leaves JeloCare:

1. Who currently sells this product in Nigeria?
2. What price, variant, size and stock state did JeloCare observe, and when?
3. What is known about the listing, seller identity, regulator record and brand authorization?

## Launch reference retailers

| Retailer | Reference URL | Market | Role |
| --- | --- | --- | --- |
| Beauty by Daz | https://beautybydaz.com/ | NG | Primary catalogue and offer reference |
| Lux Beauty NG | https://www.luxbeautyng.com/ | NG | Premium Nigerian beauty reference |
| Teeka4 | https://teeka4.com/ | NG | Nigerian skincare and beauty reference |

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

Nigerian offers are ranked using:

1. verified availability;
2. verification freshness;
3. listing evidence;
4. retailer source status;
5. observed price for the exact variant;
6. data completeness.

A missing price must be labelled as pending verification rather than represented as zero or silently omitted.

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

One qualifying store is labelled `Observed`, never `Best`, `Fair` or `Typical`. Two or more qualifying stores may be labelled `Lowest observed` and `Median`, always scoped to the compared set. Delivery can change the total unless a landed-cost observation explicitly says it is included. Seven- and 30-day movement compares the same offers at both ends of the window and stays hidden unless the current observation is fresh and an appropriately dated anchor exists.

## Safety and trust

Retailer inclusion is not an authenticity guarantee. The runtime model keeps these dimensions separate:

- `listingEvidence`: exact page or API record checked, with source and timestamp;
- `sellerIdentityEvidence`: seller identity checked, with its own source and timestamp;
- `retailerEvidence.identity`: self-published or independently checked retailer identity;
- `retailerEvidence.regulatorMatch`: authority, registration number and independent-register source;
- `brandAuthorizationEvidence`: brand-specific authorization from a brand source;
- `priceObservation`: timestamp, variant, size, stock state and landed-cost status.

Missing evidence stays missing. A seller name, rating, `officialStore` label, regulator registration or retailer claim cannot be promoted into another evidence dimension. None of these fields proves the physical item received by a shopper is authentic.

Private catalogue intake is stricter than a runtime price observation. A qualifying exact offer records the requested and final listing URL, SHA-256/MIME/byte size of the decoded response body, retrieval and reviewer timestamps, and field-level excerpts for the explicit manufacturer GTIN/EAN/UPC label, title, size, adjacent NGN price and controlled stock state. Regulatory evidence uses the same response binding on an exact NAFDAC host and expires after 90 days. Brand-source seller authorization records share one capture timestamp when they cite the same response digest; changing that registry evidence invalidates a bound dossier.

Slique Beauty is provisional and link-only. Its public catalogue may supply dated factual offer observations, but its images and descriptions are not reused. No regulator-number match or brand-authorization evidence is recorded.

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

## Implementation order

1. Register canonical retailer records.
2. Add product-level offer URLs.
3. Extract structured prices and availability.
4. Preserve every price observation.
5. Show Nigerian prices on the product page before navigation.
6. Add observation freshness, variant, stock and landed-cost labels.
7. Compute market summaries and price trends.
8. Ground Pulse responses in the same structured data.
