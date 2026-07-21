# JeloCare

JeloCare is a pharmacist-led skincare and haircare discovery platform.

## Product principles

- Concern-led discovery
- Price visible early
- Trust-first retailer ranking
- Location-aware availability
- AI guidance with deterministic safety rules
- Guidance, not diagnosis
- Editorial-first, clinically grounded presentation
- Runtime independence from third-party product-image hosts

## Platform foundation

- **Vercel Blob** for canonical public catalogue and editorial assets
- **Neon PostgreSQL** for durable catalogue and clinical data
- **Vercel Edge Config** for runtime flags and campaign selection
- **Upstash Redis** for cache, rate limiting and short-lived state
- **Vercel AI Gateway** for consultation model routing
- **Vercel Observability and Analytics** for production monitoring

See [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) for environment variables, service boundaries and operational rules.

## Catalogue migration

The application now reads products through `lib/catalogue/repository.ts`. The current adapter deliberately preserves the verified static catalogue while the Neon schema is introduced.

The first database migration is:

```text
db/migrations/0001_catalogue_foundation.sql
```

Do not switch production reads to Neon until the migration, seed data and image records have been verified against the static catalogue.

## Operations

The browser-based product image audit is available at:

```text
/image-audit
```

It identifies explicit placeholders and third-party URLs that fail and fall back at runtime.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local`, or pull connected Vercel variables:

```bash
vercel env pull
```

## Validation

```bash
npm run typecheck
npm run build
```
