# JeloCare

JeloCare is a skincare and haircare education platform combining cautious guidance with Nigerian-first retail intelligence.

The operating handbook starts at [docs/README.md](docs/README.md). It covers product direction, design, architecture, catalogue publication, Neon, environments, releases, incidents, and team handoff.

## Product principles

- Concern-led discovery
- Price visible before retailer navigation
- Nigerian retailers before international alternatives
- Trust-first retailer ranking
- Location-aware availability
- Historical price and inventory evidence
- Deterministic guidance with reviewed safety rules
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
  -> Buying guidance
```

See [docs/RETAIL_INTELLIGENCE.md](docs/RETAIL_INTELLIGENCE.md) for the product experience and ranking rules, and [docs/NIGERIA_RETAILERS.md](docs/NIGERIA_RETAILERS.md) for the reviewed store set and exact-match policy.

## Platform foundation

- **Vercel Blob** for canonical public catalogue and editorial assets
- **Neon PostgreSQL** for durable catalogue, retail and clinical data
- **Vercel Edge Config** for runtime flags and campaign selection
- **Upstash Redis** for cache, rate limiting and short-lived state
- **Vercel Observability and Analytics** for production monitoring

Ask Jelo currently runs entirely through reviewed deterministic guidance. It
does not call a language model or require an AI Gateway credential.

See [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) for environment variables, service boundaries and operational rules.

## Catalogue migration

The application reads products through `lib/catalogue/repository.ts`. It supports a Neon adapter while preserving the verified static catalogue as a production fallback.

Validate the canonical migration inventory offline, then inspect and apply from
the protected operator boundary with a direct, non-pooled Neon connection:

```bash
npm run db:migrations:validate
npm run db:migrations:status
npm run db:migrate
```

The status command is read-only. Migration application is advisory-locked and
records exact-byte checksums atomically; it never runs in Vercel. Legacy ledger
repair and production-shaped rehearsal are documented in
[`docs/operations/RUNBOOKS.md`](docs/operations/RUNBOOKS.md#reconcile-the-00480049-ledger-gap).

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
