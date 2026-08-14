# Neon and data operations

Updated: 2026-08-13

Neon PostgreSQL is the durable store. Checked-in reviewed data remains a deliberate public fallback.

## Connection roles

| Use                           | Variable and database role                                                 | Allowed location                                                    |
| ----------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| General application runtime   | `APP_DATABASE_URL` (preferred) or `DATABASE_URL` as `jelocare_app_runtime` | Vercel server runtime and local development                         |
| Private Shelf runtime         | `CUSTOMER_SHELF_DATABASE_URL` as `jelocare_shelf_runtime`                  | Vercel server runtime and local development                         |
| Migrations and reconciliation | `MIGRATION_DATABASE_URL` as a protected administrator                      | Operator workstation or protected release runner only; never Vercel |
| General runtime compatibility | `POSTGRES_URL` as `jelocare_app_runtime`                                   | Retain only when required; never point it to the owner              |

Never expose a PostgreSQL connection string through a `NEXT_PUBLIC_` variable.
Never put the database owner or another migration-capable credential in Vercel,
including through provider-generated `POSTGRES_*` or `PG*` aliases. The accepted
role attributes, grants, and credential lifecycle are canonical in
[ADR 0014](../adr/0014-customer-shelf-data-boundary.md#database-role-and-credential-boundary).

`lib/db/postgres.ts` creates a small pooled general-runtime client with prepared
statements disabled. In production it fails closed unless the connection URL
names the exact `jelocare_app_runtime` user. Shelf uses its own attested client;
migration and reconciliation scripts accept only `MIGRATION_DATABASE_URL`.

### Neon Vercel integration and `APP_DATABASE_URL`

The Vercel Neon integration ("JeloCare" resource) auto-generates `DATABASE_URL`
using the `neondb_owner` role on every deployment. This system-managed variable
overrides any user-set `DATABASE_URL` in the Production environment, preventing
the application from connecting via the restricted `jelocare_app_runtime` role.

`APP_DATABASE_URL` is the precedence-first env var that bypasses the integration
override. `applicationDatabaseUrl()` in `lib/database/runtime-database-config.ts`
resolves `APP_DATABASE_URL` before `DATABASE_URL` and `POSTGRES_URL`, so the
restricted runtime credential reaches the application even when the integration
re-creates `DATABASE_URL` with the owner role.

**Production setup:**

1. Create the `jelocare_app_runtime` role in Neon (see
   [Runbooks §1](../operations/RUNBOOKS.md#1-rehearse-and-provision-the-runtime-roles)).
2. Set `APP_DATABASE_URL` in Vercel Production with the pooled postgres.js URL
   whose username is exactly `jelocare_app_runtime`.
3. The integration-managed `DATABASE_URL` may remain; it is ignored when
   `APP_DATABASE_URL` is present and valid.
4. Verify with the dry-run cron probe (see
   [Inventory cron recovery](../operations/RUNBOOKS.md#inventory-cron-is-not-running)).

The restricted application URLs are consumed by postgres.js. Their query
strings must use `sslmode=verify-full` and omit the unsupported
`channel_binding` parameter, including provider-generated
`channel_binding=require`. Before either URL enters Vercel, connect through
postgres.js and prove exact `current_user` plus `session_user`: app requests must
be `jelocare_app_runtime`, and the read-only Shelf audit must attest
`jelocare_shelf_runtime`. The commands live in the
[Shelf release runbook](../operations/RUNBOOKS.md#release-the-customer-shelf-boundary).

## Schema map

| Area                      | Tables                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue                 | `brands`, `products`, `product_images`, `concerns`, product relation tables                                                      |
| Retail                    | `retailers`, `offers`, `offer_price_history`, `inventory_refresh_jobs`                                                           |
| Clinical                  | `ingredients`, `ingredient_synonyms`, `ingredient_concerns`, `ingredient_relations`, `product_ingredients`                       |
| Editorial                 | `editorial_assets`                                                                                                               |
| Frozen external catalogue | `external_catalogue_products`, `external_catalogue_releases`                                                                     |
| Community intake          | `community_intake_drafts`, `community_contributions`, moderation, observation, research-task, event, and edge tables             |
| Retailer partnerships     | `retailer_partnership_applications`, `retailer_partnership_events`                                                               |
| Operations                | `moderation_operators`, append-only `moderation_audit_log` (`event_sequence` is causal order; `created_at` is presentation time) |
| Customer Shelf            | `customer_shelf_items`; private one-off `customer_shelf_import_receipts`                                                         |
| Migration history         | `schema_migrations`                                                                                                              |

The ordered files in `db/migrations/` are authoritative.

`moderation_audit_log.event_sequence` is database-owned, non-null, and globally
unique. Use it for newest-event and per-target causal reads. `created_at` remains
the human-facing event time and must not be used with a random UUID to infer
causal order across overlapping transactions.

## Migrations

Create the next zero-padded file. Do not edit an applied migration.

Each migration should:

- be transactional with `begin` and `commit`;
- make constraints explicit;
- add indexes for real query paths;
- preserve existing data or include a reviewed backfill;
- be safe to run once under the migration ledger;
- include application and test changes in the same release.

Run from the protected operator boundary:

```bash
npm run db:migrate
```

Inject `MIGRATION_DATABASE_URL` from the protected secret channel into that
process without placing its value in command history. Vercel does not run this
command.

The runner:

1. acquires a PostgreSQL advisory lock;
2. creates `schema_migrations` if needed;
3. sorts `.sql` files by filename;
4. skips recorded files;
5. executes each unwrapped migration body and records its ledger row in the same
   database transaction;
6. rolls back a failed transaction before releasing the lock.

Do not run two manual migration operators against the same database.

### Applying migrations via Neon MCP (when `MIGRATION_DATABASE_URL` is not available locally)

The local environment does not carry the admin `MIGRATION_DATABASE_URL`
credential. When an agent session needs to apply a migration and the local
runner cannot connect, use the **Neon MCP server** instead:

1. **Find the project.** Call `list_projects` on the `devin/mcp-server-neon`
   server. The JeloCare production project is named `JeloCare` under the
   Vercel-managed organization (`org-tiny-silence-96254522`). The project ID
   is `spring-field-93817903`.
2. **Verify the target.** Run a read-only `run_sql` query to confirm the
   expected tables exist and the new migration's table does not yet:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_name LIKE 'assisted_order%' ORDER BY table_name;
   ```
3. **Apply each statement individually.** The `run_sql` tool executes a single
   statement. Split the migration `begin`/`commit` block into individual
   `CREATE TABLE`, `CREATE INDEX`, `REVOKE`, and `GRANT` statements and run
   each one through `run_sql` against the same project ID. Do **not** pass
   `begin` or `commit` as separate statements — `run_sql` auto-commits each
   call.
4. **Verify the result.** Re-run the `information_schema.columns` query to
   confirm the new table has the expected columns, indexes, and grants.
5. **Record the ledger row.** Insert a row into `schema_migrations` so the
   local runner does not re-apply the migration later:
   ```sql
   INSERT INTO schema_migrations (filename, applied_at)
   VALUES ('0045_assisted_order_line_verifications.sql', now())
   ON CONFLICT (filename) DO NOTHING;
   ```

This path is the standard way agent sessions apply additive migrations to
production Neon. It does not require the admin URL to be present locally and
keeps the credential boundary intact.

A production release normally uses the ordered wrapper instead of invoking
individual steps:

```bash
npm run db:reconcile
```

It requires the same protected administrator URL and runs migrations, reviewed
catalogue sync, product-asset metadata, and editorial-asset metadata in order.
External discovery remains excluded unless the separately reviewed
`--include-external-discovery` option is explicit. Its current seed still fails
closed, so the option does not make that pathway release-ready.

## Production build behavior

`scripts/vercel-build.ts` runs on every build.

- Preview, local, and CI builds skip migrations.
- Vercel production builds run the shared release preflight and the Next build,
  then may promote already-reviewed staged public assets through the bounded
  asset operator.
- Vercel has no `MIGRATION_DATABASE_URL`; it does not apply migrations, seed or
  reconcile PostgreSQL, or run the private Shelf import.
- Database reconciliation is an explicit protected operator job completed and
  audited before the application deployment that depends on it.
- For first Shelf activation, the dry run, additive apply, actual-insert and
  final-accepted-set checks, and receipt verification also finish before the
  interactive Shelf deployment.

The canonical production order is the
[release checklist](../operations/RELEASE.md#customer-shelf-release-checklist).
It does not waive the production-shaped rehearsal or the release authority's
decision about the connected Neon and Vercel resources.

## Seeds are not migrations

```bash
npm run db:seed
npm run db:seed:external
npm run assets:product:seed
npm run assets:editorial:seed
```

Seeds materialize reviewed checked-in data. They require the protected
`MIGRATION_DATABASE_URL` boundary and are never Vercel build steps. They must
not weaken publication state, overwrite verified Blob metadata with hotlinks,
or make private candidates public.

## Safe operating sequence

Before a data-changing operation:

```bash
git status --short
npm run typecheck
```

Then:

1. confirm the intended Neon project and branch outside the connection string;
2. inject the direct, non-pooled `MIGRATION_DATABASE_URL` only into the protected
   operator process;
3. inspect the migration ledger;
4. run the smallest migration or reconciliation operator;
5. audit the affected domain with restricted runtime credentials; and
6. remove the administrator secret from the process and verify the application
   through the repository boundary.

Useful audits:

```bash
npm run inventory:audit
npm run inventory:prices
npm run clinical:audit
npm run assets:audit
npm run community:research:signals
npm run community:moderate
npm run customer:shelf:audit
```

The Shelf audit requires only the restricted Shelf URL and is read-only by
default. Its explicit `-- --exercise-rollback` acceptance mode performs the
synthetic isolation exercise described in the
[Shelf release runbook](../operations/RUNBOOKS.md#release-the-customer-shelf-boundary)
and rolls the transaction back.

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
