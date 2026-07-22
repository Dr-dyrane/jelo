# JeloCare

JeloCare is a skincare and haircare education platform combining cautious guidance with Nigerian-first retail intelligence.

## Product principles

- Concern-led discovery
- Price visible before retailer navigation
- Nigerian retailers before international alternatives
- Trust-first retailer ranking
- Location-aware availability
- Historical price and inventory evidence
- AI guidance with deterministic safety rules
- Guidance, not diagnosis
- Editorial-first, clinically grounded presentation
- Runtime independence from third-party product-image hosts

## Core product pillars

### Clinical intelligence

JeloCare helps users understand products, ingredients, concerns, routines, contraindications and safe usage without presenting guidance as diagnosis.

### Retail intelligence

JeloCare shows where an exact product listing was checked in Nigeria, the price and stock state observed there, and when that observation was made. It keeps seller identity, regulator records, brand authorization and physical authenticity as separate questions.

Initial Nigerian retail references:

- [Beauty by Daz](https://beautybydaz.com/)
- [Lux Beauty NG](https://www.luxbeautyng.com/)
- [Teeka4](https://teeka4.com/)

The retail intelligence pipeline is:

```text
Products
  -> Retailers
  -> Offers
  -> Inventory verification
  -> Price history
  -> Market summaries
  -> AI purchasing context
```

See [docs/RETAIL_INTELLIGENCE.md](docs/RETAIL_INTELLIGENCE.md) for the product experience and ranking rules, and [docs/NIGERIA_RETAILERS.md](docs/NIGERIA_RETAILERS.md) for the reviewed store set and exact-match policy.

## Platform foundation

- **Vercel Blob** for canonical public catalogue and editorial assets
- **Neon PostgreSQL** for durable catalogue, retail and clinical data
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

## Retail operations

Queue stale offers, process retailer pages and audit inventory and price quality:

```bash
npm run inventory:queue
npm run inventory:work
npm run inventory:audit
npm run inventory:prices
```

## Asset operations

The browser-based product image audit is available at:

```text
/image-audit
```

It verifies all canonical product and homepage editorial images in the browser, including the generated local fallback for each editorial asset.

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
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run assets:verify` is also enforced in CI. It fetches every canonical Blob binary, checks recorded metadata and confirms that generated cutouts retain visible transparency.
