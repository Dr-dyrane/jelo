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

Expected Blob paths:

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

The checked-in product manifest records the canonical Blob URL, original source, MIME type, byte size, dimensions, alpha state and SHA-256 hash for every product source. `data/product-display-approvals.ts` separately binds each public shelf image to its exact brand, name, size, source URL, reviewed hash, source/art reviews, and peach/pink/dark checks. It also records the current legacy set's reuse rights as unverified; display approval is not a licence. Verify the remote binaries and refresh their metadata with:

```bash
npm run assets:verify
npm run assets:verify -- --write
```

An exact official transparent source can be staged without copying a persistent Blob credential into a developer machine. `data/product-asset-promotions.json` binds the source, local fallback, deterministic Blob path, decoded metadata and file hash. `npm run assets:promote:staged` runs only during a credentialed production build and uploads active entries after rechecking every byte. Staging remains private: the public catalogue continues using the old canonical manifest until the uploaded URL has been independently fetched and a later commit updates `data/product-assets.json` plus its identity/art approval.

Production builds apply the metadata to durable `product_images` and `editorial_assets` rows after database migrations. Homepage editorial media is resolved from the checked-in manifest rather than duplicated URLs. Generated imagery may provide editorial scenery or props, but never a redrawn branded package. Product background isolation must preserve official source pixels and pass full-resolution identity review. Checked-in generated editorial files remain runtime fallbacks for the matching editorial Blob, while the neutral JeloCare placeholder is used only after a published product image fails to load.

When `CATALOGUE_SOURCE=neon`, `p.is_published` is only the database-side gate. Every returned row is intersected with the checked-in, hash-approved static catalogue; the approved identity and Blob image replace persisted display fields. Persisted offers flow through only when the row identity and observed retailer title/size match that approved SKU; `/go` resolves through the same reconciled record. A database row cannot publish an opaque, stale, rights-held, or otherwise unapproved image.

CI runs `npm run assets:verify` against every product and editorial Blob. `/image-audit` independently probes every canonical binary and editorial fallback, then shows each public packshot on peach, pink, and dark surfaces.

### Exact-SKU private review runtime

New exact-SKU work begins in one
`data/catalogue-intake-candidates/<candidate-id>.json` source envelope. The
compiler verifies and projects those records into `data/catalogue-intake.json`;
inspect the projection with `npm run catalogue:intake:verify` and
`npm run catalogue:intake:audit`. Build its dedicated environment at a path that
is never shared with the frozen bulk pipeline:

```bash
python3.12 -m venv .cache/reviewed-packshot-venv
.cache/reviewed-packshot-venv/bin/python -m pip install \
  --require-hashes \
  -r scripts/requirements-packshots.lock.txt
.cache/reviewed-packshot-venv/bin/python -m pip check
npm run catalogue:packshot:tool:check
```

If that path already exists but was not created from the current lock, remove that specific virtual environment and recreate it; running `venv` over an existing directory does not remove old packages. Never remove or repurpose `.cache/rembg-venv`, which belongs to the historical bulk pipeline.

`scripts/requirements-packshots.txt` contains the single direct production requirement, `rembg[cpu]==2.0.77`. Its checked-in transitive lock is compiled under Python 3.12 with hashes for every distribution. Do not install the direct input in an operator environment, add unrelated packages to the dedicated virtual environment, or reuse a development environment. The exact-SKU operator refuses a Python minor version, installed distribution set, distribution version, lock hash, CPU provider, or ONNX Runtime session contract that does not match the audited runtime. It constructs `SessionOptions` in code with one intra-op thread, one inter-op thread, sequential execution, deterministic compute, and per-session thread pools. `OMP_NUM_THREADS` and shell wrappers are not part of that contract. Python, platform, architecture, lock hash, dependency versions, provider, and the effective session options are recorded in every private run.

CI builds that full runtime independently of the web job, installs it with `--require-hashes`, runs `pip check`, imports the production imaging stack, resolves `CPUExecutionProvider`, verifies the explicit session options without an npm environment wrapper, and exercises the operator tests. Changing Python, the provider, the session contract, the lock, or any locked dependency creates different provenance and requires a new review.

### Legacy community catalogue packshots

The fixed-count Open Beauty Facts image job is frozen as a legacy research pipeline. It must not be used to add or publish new products. Its existing `.cache/rembg-venv` remains separate from the exact-SKU operator.

The commands below document how existing private artifacts were prepared and reviewed with that historical environment:

```bash
npm run catalogue:packshots:prepare
npm run catalogue:packshots:select
```

`prepare` never generates or redraws package content. It limits treatment to alpha extraction, trimming, resampling, centring and WebP encoding on a transparent 1,000 × 1,000 canvas. Schema-v2 runs bind each output to the exact candidate, source preview, model weights, dependency versions and execution provider. Safe resume requires that complete fingerprint plus unchanged source/output hashes.

`select` refuses an incomplete preparation run or a candidate/audit mismatch. The July 2026 schema-v1 preparation already in flight is compatible only after every current candidate resolves to an audit or recorded failure; the selector then recomputes source, identity and output hashes instead of trusting an early manifest. It prioritises source-photo-validated records within each eligibility tier, excludes quarantine and explicit rejects, and binds the resulting release to the candidate manifest, candidate metadata, source snapshot, complete audit, identity, source preview, output and pipeline provenance.

An operator must inspect product identity, the full source view, the cutout and its edges for every selected item. `select` writes larger contact sheets, a zoomable `review.html`, and `review-template.json`. Rejected barcodes go in `.cache/catalogue-packshot-decisions.json`; rerunning `select` fills those slots from the reserve. Final decisions use schema 2, name the exact `releaseSha256`, reviewer and review time, and contain one approval signature per selected barcode. A global checkbox is never publication approval.

`npm run catalogue:packshots:validate` rechecks the legacy release binding, source-preview/output hashes, byte counts, dimensions and alpha channels without contacting Blob. Successful validation still leaves every cutout private.

The historical upload and seed commands below are retained for provenance only. Do not run them for new catalogue work:

```bash
vercel env pull .cache/vercel-production.env --environment=production
node --env-file=.cache/vercel-production.env --import tsx scripts/publish-catalogue-packshots.ts
node --env-file=.cache/vercel-production.env --import tsx scripts/seed-external-catalogue.ts
```

The legacy publisher preflights the fixed release before any upload, writes deterministic content-addressed Blob paths, reconstructs the manifest from its reviewed selection, and refuses stale resumable progress. This technical integrity check does not satisfy the per-SKU publication gate.

The seed refuses legacy mirrors or partial review metadata before opening a database connection. Its transaction supersedes the prior release, activates one immutable release record, writes all product-level source/review/processing provenance, and compares exact database barcode/image/release membership before commit.

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

- The 24 reviewed source records are mapped to canonical Blob metadata or an explicit rights hold. Only the transparent, identity-safe, at-least-1,000-pixel, identity-and-hash-approved subset enters public shelves. Reuse rights for the legacy visible subset remain explicitly unverified and should move to permissioned media as evidence is obtained.
- The checked-in Open Beauty Facts set remains a private legacy research pool. It is not waiting for bulk publication.
- New exact SKUs remain in the deliberate intake queue until every identity, care, Nigeria, rights and editorial gate passes; approval drafting is still separate from publication.
- `/image-audit` covers reviewed products and editorial assets. Legacy community artifacts remain outside that public audit until individually approved.
- The next media stage is an authenticated Asset Manager with controlled imports and review history; public Blob write routes remain prohibited until authentication is deliberately introduced.
