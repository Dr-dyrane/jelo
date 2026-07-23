# Smart store guide

Updated: 2026-07-23

JeloCare should solve “where should I buy this?” with one calm answer set.
It should not make the user compare a longer directory.

## Channel model

A retailer is one business with one or more order paths:

- physical location;
- website;
- Instagram business profile;
- WhatsApp business number or catalogue;
- Facebook business page;
- marketplace storefront.

Channels are not separate retailer identities. Preserve one canonical retailer,
then attach independently reviewed locations and order paths.

## Decision contract

For an exact product, the guide should answer:

1. Which current options match the exact variant and size?
2. What will each option cost, and when was that price observed?
3. Which option best fits pickup, delivery, location, and preferred order channel?
4. Why is an option first?

Do not rank an ambiguous listing. Do not present social activity, a Google result,
followers, or the lowest price as authenticity proof.

## Ranking

Apply hard eligibility before scoring:

- exact product, variant, size, and package match;
- usable order path;
- current enough price and availability for any “today” claim;
- seller identity scoped to the actual seller;
- Nigeria delivery or pickup support.

Then rank the eligible set by:

1. fulfilment fit selected by the user;
2. evidence and freshness confidence;
3. available stock;
4. landed cost, including known delivery;
5. distance or pickup convenience;
6. preferred channel.

Price never overrides an identity or freshness failure.

## Market context

The current product experience already computes:

- lowest observed comparable price;
- median across a multi-store exact set;
- number of compared stores;
- seven- or thirty-day price movement when history supports it.

Extend that system to physical and social sellers only after their observations
carry the same exact-product, timestamp, currency, stock, and seller evidence.
Never compare a remembered community price with a current retailer observation.

## Discovery and verification

Google Search, Maps, Instagram, WhatsApp, Facebook, community submissions, and
retailer applications may reveal a store. They create discovery leads.

Before a store becomes a buying option:

1. resolve the canonical business identity;
2. confirm the channel belongs to that business;
3. confirm the location or delivery area;
4. capture the exact product and current order path;
5. record price, stock, currency, and observation time;
6. preserve the evidence and reviewer;
7. publish only within the supported scope.

Social and search results may disappear or impersonate a business. Recheck them
more often than stable first-party websites.

## Interface

The product page should lead with a small answer set:

- Best fit
- Lowest observed
- Pickup nearby
- Order on WhatsApp

Show only labels that are supported and materially different. One option may
hold more than one label. Explain ranking in a sheet, not in every row.

Each row needs the store, price, stock, observation date, channel, fulfilment
cue, and one clear action such as “Open store”, “Message store”, or “Get
directions”.

The product-page retailer panel already supports optional channel, fulfilment,
and location fields. It hides the channel filter when only one order path is
available, preserving the quiet interface.

## Data system

The durable model should separate:

```text
retailer
  -> channels
  -> physical locations
  -> exact offers
  -> price observations
  -> fulfilment observations
  -> identity and review evidence
```

Retailer applications and community contributions feed moderation. They never
bypass it.

## Delivery order

1. Collect website, physical, Instagram, WhatsApp, and Facebook paths.
2. Add private channel and location verification operations.
3. Normalize approved channels under canonical retailers.
4. Attach exact offers and freshness policies.
5. Add user location and fulfilment preference.
6. Release ranked store guidance and market context.

This work extends retail intelligence. It must not pause exact-product catalogue
research or lower its publication gate.
