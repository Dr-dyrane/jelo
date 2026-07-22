# JeloCare infrastructure

This document is the source of truth for provisioned platform services, environment variables and usage boundaries.

## Runtime map

| Concern | Service | Role |
| --- | --- | --- |
| Public media | Vercel Blob | Canonical product, brand, editorial and campaign assets |
| Durable data | Neon PostgreSQL | Catalogue, offers, clinical metadata and asset records |
| Runtime flags | Vercel Edge Config | Feature flags, campaigns, maintenance state and rollout controls |
| Cache | Upstash Redis | Search, AI, rate-limit and short-lived computed data |
| AI | Vercel AI Gateway | Provider routing for the consultation experience |
| Monitoring | Vercel Observability and Analytics | Requests, functions, compute, traffic and product analytics |

## Rules

1. PostgreSQL is the source of truth for business data.
2. Blob is the source of truth for production media binaries.
3. Redis is disposable and must never be the only copy of data.
4. Edge Config contains no secrets, personal data or catalogue records.
5. Runtime product pages must not depend on third-party image hosts.
6. Credentials are server-only unless a variable is explicitly named `NEXT_PUBLIC_*` and approved for browser use.

## Vercel Blob

Store purpose: public JeloCare catalogue and editorial assets.

Expected paths:

```text
products/{brand-slug}/{product-slug}/packshot.webp
products/{brand-slug}/{product-slug}/thumb.webp
brands/{brand-slug}/logo.svg
campaigns/{campaign-slug}/hero.webp
editorial/{story-slug}/{asset-name}.webp
```

Provisioned variables:

```env
BLOB_STORE_ID=
BLOB_WEBHOOK_PUBLIC_KEY=
BLOB_READ_WRITE_TOKEN=
```

`BLOB_READ_WRITE_TOKEN` is server-only. It must never be included in client components, browser bundles, logs, form fields or public API responses.

### Product asset import

The first operator-only importer is:

```bash
npm run assets:import
```

It reads `data/asset-imports.json`, validates each HTTPS source, rejects non-image and oversized responses, uploads deterministic paths to public Blob storage, and writes `data/asset-import-results.json`.

Load Vercel environment values before running locally:

```bash
vercel env pull .env.local
npm run assets:import
```

The importer is deliberately a command-line operation. The public website has no authentication, so Blob write operations must not be exposed through a browser route yet. The shared implementation in `lib/assets/blob.ts` is server-only and can later power an authenticated Asset Manager.

The checked-in product manifest records the canonical Blob URL, original source, MIME type, byte size, dimensions, alpha state and SHA-256 hash for every published product. Verify the remote binaries and refresh that metadata with:

```bash
npm run assets:verify
npm run assets:verify -- --write
```

Production builds apply the metadata to durable `product_images` and `editorial_assets` rows after database migrations. Homepage editorial media is resolved from the checked-in manifest rather than duplicated URLs. Generated transparent assets remain editorial props; they are never presented as branded product packshots. Their checked-in generated files are runtime fallbacks for the matching editorial Blob, while a neutral JeloCare placeholder remains the last resort for a failed product packshot.

CI runs `npm run assets:verify` against every product and editorial Blob. `/image-audit` independently probes all canonical binaries plus every generated editorial fallback in a real browser.

## Neon PostgreSQL

Preferred application variables:

```env
DATABASE_URL=
DATABASE_URL_UNPOOLED=
```

Use the pooled URL for normal application queries and the unpooled URL for migrations and administrative operations. Other `PG*` and `POSTGRES_*` variables are generated for tooling compatibility.

Neon Auth variables are provisioned, but authentication is not part of the current product surface. Do not introduce login gates into public catalogue flows without an approved product plan.

## Edge Config

Store: `jelocare-runtime`

Use for small, globally read runtime values such as:

```json
{
  "maintenanceMode": false,
  "homepageCampaign": "editorial-v1",
  "assetManagerEnabled": true,
  "consultationEnabled": true,
  "searchVersion": "v1",
  "catalogueVersion": "v1"
}
```

Connection variable:

```env
EDGE_CONFIG=
```

Do not use Edge Config for products, users, offers, consultations or secrets.

## Upstash Redis

Provisioned variables:

```env
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=
REDIS_URL=
```

Approved uses:

- rate limiting;
- search suggestion cache;
- short-lived AI result cache;
- transient recommendation results;
- idempotency and operational locks.

Every Redis-backed feature must work correctly after cache eviction.

## Environment coverage

The Vercel dashboard is authoritative for which environments receive each variable. Production and Preview are currently the primary connected environments for Neon. Developers running locally should use `vercel env pull` or explicitly provision Development values.

## Current state and next stage

- All published packshots use canonical Vercel Blob URLs in both the static fallback and Neon catalogue.
- Product and generated editorial assets have durable metadata records and automated completeness checks.
- `/image-audit` verifies every rendered packshot in a real browser.
- The next media stage is an authenticated Asset Manager with controlled imports and review history; public Blob write routes remain prohibited until authentication is deliberately introduced.
