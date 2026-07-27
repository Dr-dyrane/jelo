# Neon and data operations

Updated: 2026-07-23

Neon PostgreSQL is the durable store. Checked-in reviewed data remains a deliberate public fallback.

## Connection roles

| Use | Preferred variable |
| --- | --- |
| Application runtime | `DATABASE_URL` |
| Migrations and bulk operators | `DATABASE_URL_UNPOOLED` |
| Compatibility fallback | `POSTGRES_URL`, then `POSTGRES_URL_NON_POOLING` where supported |

Never expose a PostgreSQL connection string through a `NEXT_PUBLIC_` variable.

`lib/db/postgres.ts` creates a small pooled runtime client with prepared statements disabled. Migration and seed scripts prefer the unpooled URL.

## Schema map

| Area | Tables |
| --- | --- |
| Catalogue | `brands`, `products`, `product_images`, `concerns`, product relation tables |
| Retail | `retailers`, `offers`, `offer_price_history`, `inventory_refresh_jobs` |
| Clinical | `ingredients`, `ingredient_synonyms`, `ingredient_concerns`, `ingredient_relations`, `product_ingredients` |
| Editorial | `editorial_assets` |
| Frozen external catalogue | `external_catalogue_products`, `external_catalogue_releases` |
| Community intake | `community_intake_drafts`, `community_contributions`, moderation, observation, research-task, event, and edge tables |
| Retailer partnerships | `retailer_partnership_applications`, `retailer_partnership_events` |
| Operations | `moderation_operators`, append-only `moderation_audit_log` |
| Migration history | `schema_migrations` |

The ordered files in `db/migrations/` are authoritative.

## Migrations

Create the next zero-padded file. Do not edit an applied migration.

Each migration should:

- be transactional with `begin` and `commit`;
- make constraints explicit;
- add indexes for real query paths;
- preserve existing data or include a reviewed backfill;
- be safe to run once under the migration ledger;
- include application and test changes in the same release.

Run:

```bash
npm run db:migrate
```

The runner:

1. acquires a PostgreSQL advisory lock;
2. creates `schema_migrations` if needed;
3. sorts `.sql` files by filename;
4. skips recorded files;
5. executes each file and records it;
6. rolls back a failed transaction before releasing the lock.

Do not run two manual migration operators against the same database.

## Production build behavior

`scripts/vercel-build.ts` runs on every build.

- Preview, local, and CI builds skip migrations.
- Vercel production builds first run the shared release preflight and complete
  the Next build. Only then may they promote staged assets, apply pending
  migrations, and seed product and editorial asset metadata.
- Reviewed public catalogue sync runs in every normal production release.
  `SEED_EXTERNAL_CATALOGUE_ON_BUILD=1` is the separate, one-time external
  discovery pathway; it must never be enabled by the legacy
  `SEED_CATALOGUE_ON_BUILD` flag.
- `SKIP_DATABASE_MIGRATIONS=1` suppresses production mutations but never skips
  production verification or the Next build. This is an emergency control, not
  the normal release path.

## Seeds are not migrations

```bash
npm run db:seed
npm run db:seed:external
npm run assets:product:seed
npm run assets:editorial:seed
```

Seeds materialize reviewed checked-in data. They must not weaken publication state, overwrite verified Blob metadata with hotlinks, or make private candidates public.

## Safe operating sequence

Before a data-changing operation:

```bash
git status --short
npm run typecheck
```

Then:

1. confirm the intended Neon project and branch outside the connection string;
2. use the unpooled URL for migrations;
3. inspect the migration ledger;
4. run the smallest operator;
5. audit the affected domain;
6. verify the application through the repository boundary.

Useful audits:

```bash
npm run inventory:audit
npm run inventory:prices
npm run clinical:audit
npm run assets:audit
npm run community:research:signals
npm run community:moderate
```

`community:moderate` requires `MODERATION_OPERATOR_EMAIL` to match one active
allowlisted operator. Its default is an aggregate-only read. All decisions are
dry-runs unless `--apply` is explicit, and every applied action requires a rationale
and writes its audit row in the same transaction. It never writes canonical
catalogue tables.

## Recovery

- Application catalogue reads fall back to static data if Neon fails.
- A failed migration should remain unapplied and block the deployment.
- Fix with a new forward migration unless the failed file never committed anywhere.
- Use Neon branch and restore capabilities for database recovery; the repository does not implement its own backup scheduler.
- Never delete or rewrite production rows to “make the seed match” without a reviewed recovery plan.

## Retention

- Community drafts expire after 30 days and have a purge operator.
- Submitted community contributions currently retain for 24 months.
- Retailer partnership applications currently retain for 24 months.
- Edit-secret hashes remain one-way.

Run the community draft purge with:

```bash
npm run community:intake:purge
```
