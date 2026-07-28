# Application architecture

Updated: 2026-07-27

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

| Path | Responsibility |
| --- | --- |
| `app/` | Routes, metadata, route handlers, and route-level styles |
| `components/` | Reusable UI and client interactions |
| `modules/` | Pure domain logic and most automated tests |
| `lib/` | Server repositories, infrastructure adapters, and publication policies |
| `data/` | Checked-in reviewed data, private manifests, and generated research projections |
| `db/migrations/` | Ordered PostgreSQL schema history |
| `scripts/` | Migration, seed, ingestion, audit, image, and release operators |
| `docs/` | Product, architecture, and operations handbook |
| `public/` | Stable local public assets and fallbacks |

## Public journeys

| Route | Purpose |
| --- | --- |
| `/` | Editorial discovery |
| `/products` | Search, browse shelves, filters, and paged inventory |
| `/products/[slug]` | Fit, evidence, care, and exact retailer options |
| `/concerns` and `/concerns/[slug]` | Observable-pattern education |
| `/ingredients` | Ingredient library |
| `/consult` | Ask Jelo guided assessment |
| `/contribute` | Anonymous community knowledge intake |
| `/retailers` | Retailer guide and partnership entry |
| `/image-audit` | Browser-facing media audit |

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

The consult route is fully deterministic.

- Safety stops return zero products.
- Insufficient detail returns deterministic clarification.
- Condition guides return reviewed care with zero products.
- Ordinary-care products require matching canonical concern, reviewed use, area, and requested product step.
- Displayed care, pattern, routine, product selection, and referral copy is built deterministically.
- Concern condition-patterns never supply product terms.
- No current route calls a model or requires an AI Gateway credential.

Any future model-backed language lane needs a separate reviewed boundary. It
must not choose guides or products, change urgency, create care, or receive
authority that currently belongs to deterministic code and reviewed data.

See [Ask Jelo](../ASK_JELO_EXPERIENCE.md), [concern knowledge](../CONCERN_KNOWLEDGE.md), and [ingredient review](../INGREDIENT_REVIEW.md).

## Retail refresh

The daily Vercel cron calls `/api/cron/inventory`.

1. Bearer authentication checks `CRON_SECRET`.
2. Due exact offers enter `inventory_refresh_jobs`.
3. Workers claim jobs with `FOR UPDATE SKIP LOCKED`.
4. Retailer HTML is bounded by time, type, and byte size.
5. Structured product evidence is extracted.
6. Response scope must match product, size, market, and currency.
7. Current offer state and immutable price history update in one transaction.
8. Failures retry with bounded exponential backoff.

The cron is a freshness operator. It does not replace deliberate publication evidence.

## External services

- Neon PostgreSQL: durable application data.
- Vercel Blob: canonical public product and editorial media.
- Upstash Redis: rate limiting and transient coordination only.
- Hostinger Agentic Mail API, with SMTP fallback: retailer magic links.
- Vercel Analytics: public usage analytics.

Detailed configuration lives in [Environments](../operations/ENVIRONMENTS.md).
