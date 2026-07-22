# Retail Intelligence

JeloCare is building a Nigerian-first skincare retail intelligence layer.

The product page should answer three questions before a shopper leaves JeloCare:

1. Who currently sells this product in Nigeria?
2. What is the visible price at each trusted retailer?
3. Which option is the strongest combination of availability, trust and value?

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
- current price when verified;
- availability state;
- verification freshness;
- trust or quality context;
- a clear outbound purchase action.

A shopper should not have to open several retailer pages merely to discover the price.

## Search experience

Product queries show up to three fresh exact offers for the selected market beside each matching product. Store, price and check date are visible before a shopper opens the product or retailer page. Search-only retailer routes and expired observations never appear in this comparison.

## Ranking

Nigerian offers are ranked using:

1. verified availability;
2. verification freshness;
3. retailer trust;
4. delivered value;
5. current price;
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

For every supported product, JeloCare should eventually compute:

- lowest verified Nigerian price;
- typical Nigerian price;
- highest current price;
- retailer count;
- in-stock retailer count;
- last verified time;
- 7-day and 30-day movement;
- savings versus the current market median;
- confidence score.

The product page computes the current best price, typical price, highest price, stores compared, in-stock count, savings versus typical, latest check and a deterministic confidence score from exact same-market offers. Seven- and 30-day movement compares the same offers at both ends of the window. It stays hidden unless the current observation is fresh and an appropriately dated anchor exists.

## Safety and trust

Retailer inclusion is not an authenticity guarantee. JeloCare should distinguish:

- verified retailer identity;
- recently verified product availability;
- observed price;
- authenticity evidence;
- user or pharmacist review.

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
6. Add freshness and confidence labels.
7. Compute market summaries and price trends.
8. Ground Pulse responses in the same structured data.
