# Application architecture

Updated: 2026-08-13

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
  -> verification
  -> canonical retailer and offer records

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

## Retail refresh

The daily Vercel cron calls `/api/cron/inventory`.

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
10. Successful product slugs invalidate the affected product, share, and list
    surfaces. The response and log contain separate run and active-backlog
    summaries.

The cron is a freshness operator. It does not replace deliberate publication evidence.

## External services

- Neon PostgreSQL: durable application data.
- Vercel Blob: canonical public product and editorial media.
- Upstash Redis: rate limiting, coordination, the private immutable campaign
  ledger, the separate immutable Daily Desk acceptance record, and
  identifier-free Daily Desk aggregate counters.
- Hostinger Agentic Mail API, with SMTP fallback: retailer magic links.
- Vercel Analytics: public usage analytics.

Detailed configuration lives in [Environments](../operations/ENVIRONMENTS.md).
