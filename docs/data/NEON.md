# Neon and data operations

Updated: 2026-08-13

Neon PostgreSQL is the durable store. Checked-in reviewed data remains a deliberate public fallback.

## Connection roles

| Use                           | Variable and database role                                             | Allowed location                                                    |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| General application runtime   | `APP_DATABASE_URL` as `jelocare_app_runtime`                           | Vercel server runtime and local development                         |
| Private Shelf runtime         | `CUSTOMER_SHELF_DATABASE_URL` as `jelocare_shelf_runtime`              | Vercel server runtime and local development                         |
| Migrations and reconciliation | `MIGRATION_DATABASE_URL` as a protected administrator                  | Operator workstation or protected release runner only; never Vercel |
| Temporary migration rehearsal | `MIGRATION_REHEARSAL_DATABASE_URL` as a protected branch administrator | Verified disposable `rehearsal/...` branch process only             |
| General runtime compatibility | `POSTGRES_URL` as `jelocare_app_runtime`                               | Retain only when required; never point it to the owner              |

Never expose a PostgreSQL connection string through a `NEXT_PUBLIC_` variable.
Never put the database owner or another migration-capable credential in Vercel,
including through provider-generated `POSTGRES_*` or `PG*` aliases. The accepted
role attributes, grants, and credential lifecycle are canonical in
[ADR 0014](../adr/0014-customer-shelf-data-boundary.md#database-role-and-credential-boundary).

`lib/db/postgres.ts` creates a small pooled general-runtime client with prepared
statements disabled. In production it fails closed unless the connection URL
names the exact `jelocare_app_runtime` user. Shelf uses its own attested client;
migration and reconciliation scripts accept only `MIGRATION_DATABASE_URL`.

### Restricted Vercel runtime and the owned Neon resource

The owned Neon `JeloCare` resource is deliberately disconnected from the
Vercel project. It is not deleted: protected database operators still manage it
through Neon, while Vercel cannot reconstruct an owner-bearing `DATABASE_URL`.
Neon Auth base/project variables are configured explicitly in their reviewed
Production and Preview scopes; the database integration is not their authority.

`applicationDatabaseUrl()` in `lib/database/runtime-database-config.ts` resolves
`APP_DATABASE_URL` first. Vercel Production configures only that general-runtime
URL and the separate Shelf URL. `DATABASE_URL`, owner URLs, unpooled aliases,
and split `POSTGRES_*`/`PG*` owner fields must be absent from every Vercel scope.

**Production setup:**

1. Create the `jelocare_app_runtime` role in Neon (see
   [Runbooks §1](../operations/RUNBOOKS.md#1-rehearse-and-provision-the-runtime-roles)).
2. Set `APP_DATABASE_URL` in Vercel Production with the pooled postgres.js URL
   whose username is exactly `jelocare_app_runtime`.
3. Confirm the Neon resource is disconnected from the Vercel project and
   `DATABASE_URL` is absent from every scope.
4. Configure `CUSTOMER_SHELF_DATABASE_URL` only in Production and keep Preview
   without either database URL or the Production-only Auth cookie secret.
5. Verify with the dry-run cron probe (see
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
| Migration history         | Append-only, checksummed `schema_migrations` with execution provenance                                                           |

The ordered files in `db/migrations/` are authoritative.

`moderation_audit_log.event_sequence` is database-owned, non-null, and globally
unique. Use it for newest-event and per-target causal reads. `created_at` remains
the human-facing event time and must not be used with a random UUID to infer
causal order across overlapping transactions.

## Migrations

Create the next contiguous zero-padded file. Do not edit an applied migration.
`npm run db:migrations:validate` rejects malformed names, gaps, and duplicate
versions before any connection opens. The only duplicate accepted is the exact,
digest-pinned historical `0046` pair; it cannot be copied, extended, or edited.

Each migration should:

- be transactional with `begin` and `commit`;
- make constraints explicit;
- add indexes for real query paths;
- preserve existing data or include a reviewed backfill;
- be safe to run once under the migration ledger;
- include application and test changes in the same release.

Run from the protected operator boundary:

```bash
npm run db:migrations:status
npm run db:migrate
```

Inject `MIGRATION_DATABASE_URL` from the protected secret channel into that
process without placing its value in command history. `status` opens a
PostgreSQL `READ ONLY` transaction, reports applied/pending/drift state and
checksums, and exits `2` when ledger repair or drift blocks apply. It creates no
table, lock, or ledger row. Vercel runs neither command.

The runner:

1. acquires a PostgreSQL advisory lock;
2. creates the governed ledger only when no ledger and no durable `public`
   relations exist, and refuses an existing schema without history, a legacy
   ledger, or a partially governed ledger;
3. validates contiguous versions, canonical names, canonical order, and the
   digest-pinned historical `0046` exception before SQL runs;
4. requires existing ledger rows to be an immutable checksummed prefix of the
   checked-in bytes;
5. executes each unwrapped migration body and records version, immutable order,
   SHA-256, database role, timestamps, and `runner_atomic` provenance in the
   same database transaction; and
6. rolls back a failed transaction before releasing the lock.

The ledger rejects `UPDATE`, `DELETE`, and `TRUNCATE`. Its checksum meaning is
explicit: `runner_atomic` attests the exact executed bytes;
`legacy_filename_record` binds current canonical bytes but cannot prove the
bytes used by the old runner; `schema_effect_reconciliation` attests only the
checked catalog effects and deliberately leaves execution time null. Never
describe the latter two as exact-byte execution.

Do not run two manual migration operators against the same database.

### Legacy ledger repair and effects-only reconciliation

`npm run db:migrations:repair` is the only exceptional ledger writer. It
requires the direct protected administrator URL, takes the same advisory lock,
and has no general-purpose "mark applied" option. Governance initialization
works only on the exact old `(filename, applied_at)` table and preserves those
rows with `legacy_filename_record` provenance. Effects reconciliation is
restricted to checked-in contracts for `0048_money_columns_to_numeric.sql` and
`0049_fix_remaining_money_columns.sql`, must target the first pending file, and
requires the operator to confirm the canonical SHA-256. It verifies every
required `numeric(12,2)` catalog result plus the generated quote total before
inserting an effects-only row. It never executes, rewrites, or repairs domain
schema.

The observed production discrepancy on 2026-08-14 is: the `0048` and `0049`
column effects are present without ledger rows, and `0050_payment_integrity.sql`
is absent. This is an observation, not standing write authority. Follow the
[migration repair runbook](../operations/RUNBOOKS.md#reconcile-the-00480049-ledger-gap)
first on a fresh production-derived rehearsal branch. Do not apply `0050`, add
a reconciliation row, or initialize production governance until the release
authority accepts that rehearsal and rechecks the same production status.

### Temporary migration rehearsal and unchanged-byte promotion

Draft SQL belongs under ignored `.migration-rehearsal/`, which the canonical
runner never reads. `db:migrations:rehearse` accepts only the separate
`MIGRATION_REHEARSAL_DATABASE_URL`, rejects every Vercel environment and a
simultaneously present `MIGRATION_DATABASE_URL`, requires a
`rehearsal/...` Neon project/branch identity plus explicit disposable-branch
confirmation, and uses authenticated read-only Neon API calls to require a
non-default, non-protected child whose enabled read-write endpoint matches the
URL. It then applies the draft as the single next version through the same
atomic runner. Use a production-derived Neon branch: Neon documents branches as
isolated copy-on-write environments with distinct connection strings in its
[branching workflow primer](https://neon.com/docs/get-started-with-neon/workflow-primer).

After first-run and idempotent-rerun evidence passes, promote with
`db:migrations:promote -- --source=... --confirm-checksum=...`. The promoter
uses an exclusive byte-for-byte copy, fails if the canonical destination
exists, and re-hashes the result. Do not paste or reformat rehearsed SQL into
`db/migrations/`; promotion is the bytes boundary.

### Protected agent migration when no local admin URL exists

The local dotenv files deliberately do not contain `MIGRATION_DATABASE_URL`.
That does not authorize splitting a migration across auto-committed MCP calls:
doing so can leave a partial schema, and manually inserting `schema_migrations`
would falsely attest atomic application. The checked-in runner remains the only
normal migration path.

On the founder's authenticated operator workstation, resolve the intended
project and branch by name, then keep the direct owner URL in process memory
only. The command text contains no credential and shell tracing must remain off:

```bash
set +x
migration_url="$(neonctl connection-string main \
  --project-id spring-field-93817903 \
  --role-name neondb_owner \
  --database-name neondb \
  --ssl verify-full)"
migration_url="${migration_url/&channel_binding=require/}"

if [[ "$migration_url" == *-pooler.* || "$migration_url" == *channel_binding* ]]; then
  unset migration_url
  echo "Protected migration URL validation failed."
  exit 1
fi

MIGRATION_DATABASE_URL="$migration_url" npm run db:migrations:status
MIGRATION_DATABASE_URL="$migration_url" npm run db:migrate
unset migration_url
```

The runner acquires its advisory lock, unwraps the checked-in outer transaction,
executes the body and records the filename in the same database transaction.
Use `npm run db:reconcile` instead only when the release explicitly includes
the reviewed public-data reconciliation. Neon MCP remains suitable for bounded
read-only inspection; it is not a substitute for this atomic write path.

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
3. run `npm run db:migrations:status` and require a clean immutable prefix;
4. run the smallest normal migration or the exact confirmed repair operator;
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
