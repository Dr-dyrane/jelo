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
```

Server-side importing and uploading additionally requires:

```env
BLOB_READ_WRITE_TOKEN=
```

The read/write token has not been provisioned yet. Do not add upload routes that fail open or expose this token to the browser.

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

## Next implementation stages

1. Create the catalogue schema in Neon.
2. Introduce database access behind a repository layer while preserving the static catalogue fallback.
3. Provision `BLOB_READ_WRITE_TOKEN` before enabling server-side media imports.
4. Import failing third-party product images into Blob and replace runtime hotlinks.
5. Convert `/image-audit` into an authenticated operational asset manager when authentication is deliberately introduced.
