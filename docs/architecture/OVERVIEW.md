# Application architecture

Updated: 2026-09-04

JeloCare is a Next.js App Router application deployed on Vercel. It keeps reviewed clinical guidance, retail observations, community signals, and retailer applications in separate trust lanes.

## Runtime map

```text
Browser
  -> Next.js pages and server components
  -> route handlers
       -> deterministic clinical engine
       -> catalogue repository
       -> Neon PostgreSQL
       -> Upstash rate limits
       -> Hostinger Mail
       -> Vercel Blob
```

## Repository map

| Path             | Responsibility                                                                  |
| ---------------- | ------------------------------------------------------------------------------- |
| `app/`           | Routes, metadata, route handlers, and route-level styles                        |
| `components/`    | Reusable UI and client interactions                                             |
| `modules/`       | Pure domain logic and most automated tests                                      |
| `lib/`           | Server repositories, infrastructure adapters, and publication policies          |
| `data/`          | Checked-in reviewed data, private manifests, and generated research projections |
| `db/migrations/` | Ordered PostgreSQL schema history                                               |
| `scripts/`       | Migration, seed, ingestion, audit, image, and release operators                 |
| `docs/`          | Product, architecture, and operations handbook                                  |
| `public/`        | Stable local public assets and fallbacks                                        |

## Public journeys

| Route                              | Purpose                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `/`                                | Editorial discovery                                                              |
| `/products`                        | Search, browse shelves, filters, and paged inventory                             |
| `/products/[slug]`                 | Fit, evidence, care, and exact retailer options                                  |
| `/concerns` and `/concerns/[slug]` | Observable-pattern education                                                     |
| `/ingredients`                     | Ingredient library                                                               |
| `/consult`                         | Ask Jelo guided assessment                                                       |
| `/contribute`                      | Anonymous community knowledge intake                                             |
| `/retailers`                       | Retailer guide and partnership entry                                             |
| `/share` and `/share/[slug]`       | Current exact offers and evidence-qualified price movement                       |
| `/markets` and `/markets/[slug]`   | Reviewed physical-market product-to-place guidance                               |
| `/lagos`                           | One accepted, evidence-checked Nigerian campaign story for the current Lagos day |
| `/basket`, `/checkout`, `/order`   | Guest-first one-retailer assisted procurement and private status                 |
| `/image-audit`                     | Browser-facing media audit                                                       |

## Catalogue reads

`lib/catalogue/repository.ts` is the public catalogue boundary.

- `CATALOGUE_SOURCE=static` reads the checked-in reviewed catalogue.
- `CATALOGUE_SOURCE=neon` reads published normalized rows when PostgreSQL is configured.
- A Neon read failure falls back to the verified static catalogue.
- Explicitly released intake products are merged through the publication boundary.
- `listRecommendationEligibleProducts()` applies the separate care eligibility gate.

Never read bulk or community candidate files directly into recommendations.

## Trust lanes

```text
Reviewed catalogue
  -> may become public after explicit release
  -> may become recommendation-eligible after care review

Community contribution
  -> community_reported
  -> moderation and research priority
  -> never direct publication

Retailer partnership application
  -> private business submission
  -> private verification or research handoff
  -> separate reviewed retailer and exact-offer admission

Discovery and frozen bulk data
  -> private research only
  -> deliberate per-SKU intake
```

## Clinical boundary

The consult route keeps deterministic safety, care, guide, and product
authority.

- Safety stops return zero products.
- Insufficient detail returns deterministic clarification.
- Condition guides return reviewed care with zero products.
- Ordinary-care products require matching canonical concern, reviewed use, area, and requested product step.
- Displayed care, pattern, routine, product selection, and referral copy is built deterministically.
- Concern condition-patterns never supply product terms.
- Only an already-resolved clarification path may call AI Gateway to select a
  missing-detail enum. JeloCare renders the reviewed question; disabled or
  failed model calls fall back to the original deterministic clarification.

Any future model-backed language lane needs a separate reviewed boundary. It
must not choose guides or products, change urgency, create care, or receive
authority that belongs to deterministic code and reviewed data.

See [Ask Jelo](../ASK_JELO_EXPERIENCE.md), [concern knowledge](../CONCERN_KNOWLEDGE.md), and [ingredient review](../INGREDIENT_REVIEW.md).

## Linked market truth

Retailer, offer, observation, history and public projections form one governed
chain. The inventory worker refreshes only already-reviewed exact offers; it
does not discover or admit a retailer, listing or product. Discovery produces a
private `new-product` or `additional-offer-for-known-product` review candidate,
and partnership approval remains noncanonical.

Physical-market observations stay separate from online listing evidence. They
join through the exact product and reviewed retailer, but neither lane can
prove facts owned by the other. Public price actions, product market summaries,
Share, market trends and Daily Desk all require the same current exact-offer
predicate. Movement comes only from append-only `offer_price_history`; a
current snapshot is never manufactured into a past observation.

See [ADR 0020](../adr/0020-linked-market-truth-system.md) for the identity,
freshness, projection and exception contract.

## Retail refresh

The hourly Vercel cron calls `/api/cron/inventory` at minute 17.

1. Bearer authentication checks `CRON_SECRET`.
2. Only due, published, exact HTTPS offers enter `inventory_refresh_jobs`; active
   jobs that lose that eligibility are withdrawn.
3. Workers repeat the eligibility gate and claim with `FOR UPDATE SKIP LOCKED`.
   A processing job older than the two-minute lease can be reclaimed below the
   attempt cap; an expired job at the cap becomes terminal.
4. The route stops claiming at an absolute 270-second deadline, before the
   300-second Vercel limit. A 100-job cap lets the daily run drain the current
   catalogue when retailers respond quickly; the deadline remains the primary
   bound when they do not.
5. Retailer HTML is bounded by time, type, and byte size.
6. Structured product evidence is extracted.
7. Response scope must match product, size, market, and currency.
8. Current offer state and immutable price history update in one transaction
   only while the claim generation and offer publication, match, and URL still
   agree, and the offer has not received a newer manual or administrative
   update.
9. Failures retry with bounded exponential backoff.
10. Successful observations and terminal contradictions invalidate the exact
    product and Share projections plus their catalogue lists.
11. Static integration binds a database offer ID back to one checked-in
    product + retailer + normalized URL + NG/NGN source slot. Zero or multiple
    matches stop for review.
12. The response and log contain separate run, active-backlog and bounded
    exception summaries. Private scheduled-owner receipts distinguish a
    successful, empty, disabled or failed run without storing raw errors or
    listing data.

The cron is a freshness operator. It does not replace deliberate publication evidence.

The Daily Desk reconciler runs hourly at minute 42. It may accept the first
evidence-qualified Market record for the Lagos day after fresh observations
arrive, even when the 07:00 operator campaign run had no candidate. It also
archives and promotes a new immutable revision when the current revision no
longer matches exact-offer truth. Promotion compare-and-sets the date pointer;
`/lagos` suppresses the old story until a qualified replacement wins.

## External services

- Neon PostgreSQL: durable application data.
- Vercel Blob: canonical public product and editorial media.
- Upstash Redis: rate limiting, coordination, the private immutable campaign
  ledger, immutable Daily Desk revisions with their current-date pointer, and
  identifier-free Daily Desk aggregate counters.
- Hostinger Agentic Mail API, with SMTP fallback: retailer magic links.
- Vercel Analytics: public usage analytics.

Detailed configuration lives in [Environments](../operations/ENVIRONMENTS.md).
