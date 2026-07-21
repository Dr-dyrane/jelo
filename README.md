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

The application reads products through `lib/catalogue/repository.ts`. It supports a Neon adapter while preserving the verified static catalogue as a production fallback.

Run the first schema migration with an unpooled Neon connection:

```bash
npm run db:migrate
```

Seed the current TypeScript catalogue into the normalized Neon tables:

```bash
npm run db:seed
```

Verify the database records and image audit before changing:

```env
CATALOGUE_SOURCE=neon
```

If Neon is unavailable, product listing and detail reads fall back to the verified static catalogue rather than failing the public experience.

## Asset operations

The browser-based product image audit is available at:

```text
/image-audit
```

It identifies explicit placeholders and third-party URLs that fail and fall back at runtime.

The server-only Blob importer runs with:

```bash
npm run assets:import
```

It requires `BLOB_READ_WRITE_TOKEN` and never exposes that credential to browser code.

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
