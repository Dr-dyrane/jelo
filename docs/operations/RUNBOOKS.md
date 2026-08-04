# Operational runbooks

Updated: 2026-08-03

Lead with evidence. Preserve data. Prefer a forward repair.

## Production build fails

1. Identify the exact deployment and commit.
2. Read the first real failing command, not only the final exit code.
3. Reproduce with the same environment boundary.
4. If CI passed but production failed, inspect the build, staged asset
   promotion, and restricted runtime service credentials. Database migrations
   and reconciliation are separate protected operator jobs.
5. Fix the cause in a small commit.
6. Re-run local gates and verify the next exact deployment.

The production pipeline verifies and builds the revision before bounded staged
public-asset promotion. It has no migration administrator credential and does
not reconcile PostgreSQL. Diagnose the exact verification, build, or asset
promotion phase. Do not add migration authority to Vercel to conceal a missed
operator release step.

## A preview lane closes

The lane that creates a preview owns its cleanup. Preview resources are
temporary; production releases and rollback history follow a separate retention
decision.

Protect these before resolving deletion targets:

- Git `main`, `pages-v1-static`, and the `pages-v1.0` tag;
- the Neon primary/default `main` branch;
- the current production deployment;
- `jelocare.com`, `www.jelocare.com`, the stable Vercel project/main aliases,
  and the localhost origins intentionally used by Ops.

Then:

1. Run `git fetch --prune` and prove the feature branch is merged before
   deleting its remote ref.
2. List Vercel Preview deployments and aliases. Remove only the closed lane's
   Preview deployments and branch aliases.
3. List Neon branches. Delete the corresponding non-primary preview branch,
   including its compute and Auth instance.
4. List Neon Auth trusted domains on `main`. Remove immutable deployment
   origins that are no longer current; retain only the approved stable origins,
   localhost development origins, and the current production deployment origin.
5. Re-list Git, Vercel, Neon branches, and trusted domains. A delete request is
   not evidence that cleanup finished.
6. Smoke-test the custom domain and the exact production commit.

Useful read-only inventory commands:

```bash
git ls-remote --heads origin
vercel ls --environment preview --format json --limit 100
vercel alias ls
neonctl branches list --project-id "$NEON_PROJECT_ID" --output json
neonctl neon-auth domain list \
  --project-id "$NEON_PROJECT_ID" \
  --branch main \
  --output json
```

Do not bulk-delete production deployments while cleaning previews. Establish and
record a production retention window first so rollback evidence is preserved.
If the Neon plan refuses branch protection, record that provider limitation;
never unprotect an unrelated project to make room silently.

## Neon is unavailable

Expected public behavior: catalogue reads fall back to reviewed static data.

1. Confirm the failure is Neon, not application query logic.
2. Check project and branch health in Neon.
3. Confirm the production connection variable names and scope.
4. Avoid repeated write operators.
5. Verify the public fallback.
6. After recovery, run inventory, price, clinical, and asset audits.

Community and retailer intake should return a temporary unavailable response rather than pretend to save.

## A migration fails

1. Record the migration filename and PostgreSQL error.
2. The runner requires one outer `begin`/`commit` wrapper, removes that wrapper,
   then executes the migration body and `schema_migrations` insert in one
   transaction. Missing, nested, or empty wrappers fail before SQL runs.
3. Confirm the failed filename is absent from `schema_migrations` and verify its
   body also rolled back. A body-without-ledger discrepancy indicates a legacy
   runner failure: stop and reconcile it explicitly before another deployment.
4. If the migration was never shared or applied, repair it.
5. Otherwise add a new forward migration.
6. Rehearse both the first run and idempotent rerun on a Neon branch before production.

The migration runner accepts only a direct, non-pooled
`MIGRATION_DATABASE_URL` supplied at the protected operator boundary. Do not
fall back to a Vercel runtime URL or copy the administrator URL into Vercel.

Rehearsal evidence for the `0031_community_research_task_shape.sql` rollout
(2026-08-02 UTC): production-fresh Neon branch
`br-rapid-bird-avoceepe` (`rehearsal/research-workflow-operator-lock-20260802`)
in project `spring-field-93817903`
first received an injected failure after the migration body but before the
ledger write. Both the body and ledger row rolled back. On the next first run,
the new shape and audit constraints and the ledger row shared PostgreSQL
transaction ID `888839`; all 37 inherited research tasks satisfied the shape
constraint. A second run skipped ledgered migrations `0030` and `0031`; their
ledger/constraint counts and transaction IDs remained unchanged. The branch is
retained temporarily for independent read-only verification. Delete it only
after that verification is confirmed; no credentials or task contents belong
in the evidence record.

Rehearsal evidence for `0032_moderation_audit_event_sequence.sql` (2026-08-02
UTC): production-derived branch `br-muddy-fog-avrr5205`
(`rehearsal/moderation-audit-sequence-20260802`) in project
`spring-field-93817903` was confirmed non-primary. The first migration run
applied only `0032`; its ledger row was written at
`2026-08-02 06:27:31.827871+00`. The ledger row and unique event-sequence
constraint share transaction ID `891909`. A second migration run skipped
`0032`. The column is non-null with its database sequence default; the unique
constraint and `(queue, target_ref, event_sequence desc)` index are present.
After the real two-client correction race, all 261 audit rows had 261 distinct
non-null event sequences. The synthetic target retained two events (sequence
260 then 261), exactly one correction marker, and pending observation state:
one overlapping writer committed and the serialized duplicate failed closed.
The database verifier then passed. Retain this branch for independent read-only
audit and delete it only after that audit is confirmed. Do not record a
connection string, role credential, operator subject, or retained row content.

### Catalogue identity/version migration and reconciliation

Migration `0033_catalogue_product_identity_versions.sql` creates the public
identity/version ledger before the production catalogue seed runs. The seed is
idempotent and verifies the deterministic identity and active lifecycle state
inside the same per-product transaction.

- A slug, brand presentation, or variant display-copy correction updates the
  existing `products` row. Never delete and recreate that row; its UUID is the
  immutable backfill input.
- A material size, package, or formula change uses a new product row and a new
  identity version. Record one explicit `successor` transition; do not update
  the prior version in place or rewrite a saved reference.
- A reviewed duplicate merge records one explicit `alias` transition. The
  source snapshot and provenance remain append-only.
- Retirement sets `products.is_published` false. The database trigger retains
  the snapshot as a non-purchasable tombstone. Never delete identity or
  transition history during rollback; use a forward correction or disable the
  resolver boundary.

After migration and seed, compare the read-only result below with
`npm run catalogue:search:verify`. `reviewed_public`, `identity_versions`, and
`valid_active_versions` must match; `missing_versions` and
`non_deterministic_versions` must both be zero.

```sql
select
  count(*)::int as reviewed_public,
  count(identity.identity_version_id)::int as identity_versions,
  count(*) filter (
    where identity.lifecycle_state = 'active'
      and identity.provenance = 'jelocare_reviewed'
      and identity.public_eligibility_basis = 'reviewed_catalogue_projection'
  )::int as valid_active_versions,
  count(*) filter (
    where identity.identity_version_id is null
  )::int as missing_versions,
  count(*) filter (
    where identity.identity_version_id is distinct from
      substring(encode(digest(
        'jelocare:catalogue-product-identity-version:v1:' || product.id::text,
        'sha256'
      ), 'hex') from 1 for 32)::uuid
  )::int as non_deterministic_versions
from products product
left join catalogue_product_identity_versions identity
  on identity.product_id = product.id
where product.is_published = true
  and product.source_version in ('static-v1', 'published-intake-v1');
```

## Release the Customer Shelf boundary

Use this runbook for the first Shelf and Routine activation and for a rehearsal on a
disposable production-shaped Neon branch. The mandatory release order is
summarized in the
[Customer Shelf release checklist](./RELEASE.md#customer-shelf-release-checklist);
[ADR 0014](../adr/0014-customer-shelf-data-boundary.md) is authoritative for
stored fields, roles, import dispositions, lifecycle, and rollback limits.
This runbook does not authorize production as a substitute for rehearsal. The
release authority must select the production-shaped rehearsal and explicitly
approve the connected Neon and Vercel resources before any production action.

### 1. Rehearse and provision the runtime roles

Prove the target project and branch by name before opening the protected direct
administrator connection. Keep `MIGRATION_DATABASE_URL` in the protected
operator process only. In `psql`, create the two roles with no password:

```sql
create role jelocare_app_runtime
  login noinherit nosuperuser nocreatedb nocreaterole noreplication
  nobypassrls password null;

create role jelocare_shelf_runtime
  login noinherit nosuperuser nocreatedb nocreaterole noreplication
  nobypassrls password null;
```

Still in the protected interactive session, set distinct generated passwords
without putting them in SQL or terminal history:

```text
\password jelocare_app_runtime
\password jelocare_shelf_runtime
```

Store each resulting runtime URL in the approved secret channel. Do not print
it. Do not reuse the database owner password or derive either runtime password
from it. If either role already exists, stop and audit its attributes, outgoing
role memberships, ownership, grants, and credential provenance instead of
replacing it blindly.

### 2. Apply migrations and reconcile public data

With the direct administrator URL injected into the operator process, run:

```bash
npm run db:reconcile
```

The ledger must include `0034_customer_shelf.sql`, followed by
`0035_runtime_database_roles.sql`, `0036_customer_product_requests.sql`, and
`0037_customer_routines.sql`.
Migration `0035` rejects an absent or unsafe role before applying grants;
`0036` adds the private request boundary and its pinned research bridge;
`0037` adds the forced-RLS Routine boundary and exact runtime grants. The
reconciler runs `db:migrate`, `db:seed`,
`assets:product:seed`, and `assets:editorial:seed` in that order. These are
idempotent public-data operators; none imports a customer Shelf. Do not pass
`--include-external-discovery` unless its separate one-time external-catalogue
release is explicitly in scope; the current external seed remains fail-closed.

Run this sequence first on the rehearsal branch. A second migration run must
skip every ledgered file, and a second reconciliation must not create a new
identity version or change an immutable reviewed snapshot. Record the branch,
revision, migration filenames, counts, and pass/fail result only. Do not retain
connection strings, role passwords, customer identifiers, or row contents.

### 3. Audit roles, grants, and RLS

As the protected administrator, inspect both runtime roles without selecting
password hashes:

```sql
select
  role.rolname,
  role.rolcanlogin,
  role.rolinherit,
  role.rolsuper,
  role.rolcreatedb,
  role.rolcreaterole,
  role.rolreplication,
  role.rolbypassrls,
  exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.member = role.oid
  ) as is_member_of_another_role,
  (
    select count(*)
    from pg_catalog.pg_auth_members membership
    where membership.roleid = role.oid
  ) as incoming_admin_memberships,
  exists (
    select 1
    from pg_catalog.pg_class relation
    where relation.relowner = role.oid
  ) as owns_relations
from pg_catalog.pg_roles role
where role.rolname in ('jelocare_app_runtime', 'jelocare_shelf_runtime')
order by role.rolname;

select relname, relrowsecurity, relforcerowsecurity
from pg_catalog.pg_class
where oid in (
  pg_catalog.to_regclass('public.customer_shelf_items'),
  pg_catalog.to_regclass('public.customer_product_requests'),
  pg_catalog.to_regclass('public.customer_product_request_images'),
  pg_catalog.to_regclass('public.customer_product_request_mutations'),
  pg_catalog.to_regclass('public.customer_product_request_blob_cleanup'),
  pg_catalog.to_regclass('public.customer_routines'),
  pg_catalog.to_regclass('public.customer_routine_steps')
)
order by relname;

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee in ('jelocare_app_runtime', 'jelocare_shelf_runtime')
order by grantee, table_schema, table_name, privilege_type;

select grantee, table_schema, table_name, column_name, privilege_type
from information_schema.role_column_grants
where grantee = 'jelocare_shelf_runtime'
order by table_schema, table_name, column_name, privilege_type;

select
  pg_catalog.has_database_privilege(
    'jelocare_app_runtime', pg_catalog.current_database(), 'CONNECT'
  ) as app_connect,
  pg_catalog.has_database_privilege(
    'jelocare_shelf_runtime', pg_catalog.current_database(), 'CONNECT'
  ) as shelf_connect,
  pg_catalog.has_schema_privilege(
    'jelocare_app_runtime', 'public', 'USAGE'
  ) as app_schema_usage,
  pg_catalog.has_schema_privilege(
    'jelocare_shelf_runtime', 'public', 'USAGE'
  ) as shelf_schema_usage,
  pg_catalog.has_type_privilege(
    'jelocare_shelf_runtime', 'public.customer_shelf_save_origin', 'USAGE'
  ) as shelf_save_origin_usage,
  pg_catalog.has_type_privilege(
    'jelocare_shelf_runtime', 'public.catalogue_identity_lifecycle_state', 'USAGE'
  ) as shelf_lifecycle_usage;

select grantee, table_name, privilege_type
from information_schema.table_privileges
where grantee = 'PUBLIC'
  and table_schema = 'public'
  and table_name in (
    'customer_shelf_items',
    'customer_shelf_import_receipts',
    'customer_routines',
    'customer_routine_steps',
    'schema_migrations'
  )
order by table_name, privilege_type;
```

Require exactly two `LOGIN NOINHERIT` rows with every elevated attribute,
`is_member_of_another_role`, and ownership value false. PostgreSQL 17 may show
an incoming creator/administrator membership; that direction is allowed and is
recorded separately. Require enabled and forced RLS, all six connection/schema/
type booleans true, and no `PUBLIC` row for the Shelf, Routine, or receipt tables. The app
role must have no Shelf, Routine, receipt, or migration-ledger privilege. The Shelf role
must have only `SELECT`, `INSERT`, and `DELETE` on
`public.customer_shelf_items`, the migration-`0036` request/image/idempotency/
cleanup grants, exact CRUD on the migration-`0037` Routine tables, the exact
reviewed catalogue column grants, and execute on the
pinned request-signal bridge. It must have no direct request-research-mention,
community-task, `TRUNCATE`, receipt, Auth, moderation, intake, or other
private-table access. Migrations `0035`, `0036`, and `0037` grant no default privileges
to either runtime role; review each later table explicitly.

Inject only the protected `CUSTOMER_SHELF_DATABASE_URL` and run the checked-in
runtime attestation, then its deliberately explicit rolled-back isolation
exercise:

```bash
npm run customer:shelf:audit
npm run customer:shelf:audit -- --exercise-rollback
```

The first command is read-only and requires the exact current and session role,
safe role attributes, no outgoing role membership or relation ownership, and
enabled plus forced RLS. An incoming PostgreSQL 17 creator/administrator edge
is allowed. The second command inserts Shelf and Routine rows under a random
synthetic owner, proves owner-A visibility, owner-B invisibility and cross-
mutation denial, proves owner update/deletion and routine-step cascade, then
deliberately rolls back the entire transaction. It prints no subject or
identity and leaves no durable customer row.

Run the read-only command on the selected rehearsal branch and production. Run
`--exercise-rollback` on the rehearsal branch. In production, run that exercise
only when the recorded release authority explicitly accepts a transaction that
performs synthetic writes and forces rollback; otherwise run attestation only.
Neither command runs automatically in CI or Vercel. On the rehearsal branch,
supplement them with transactions that prove:

- missing `app.customer_subject` returns zero rows and rejects writes;
- A and B can independently add, list, remove, and clear Shelf plus create,
  list, update, and delete Routine;
- a duplicate add creates one row;
- `set row_security = off` does not expose rows; and
- the Shelf role cannot query the receipt, Auth, moderation, intake, or
  migration-ledger tables.

Roll back the synthetic rehearsal transactions. In production, use read-only
role/grant/RLS inspection plus the verified launch-account smoke unless the
release authority accepted the checked-in rollback exercise. Do not create ad
hoc fake customer rows merely to duplicate the rehearsal.

Finally, run the catalogue identity reconciliation query in
[Catalogue identity/version migration and reconciliation](#catalogue-identityversion-migration-and-reconciliation).
Do not proceed on any missing identity, grant drift, attestation failure, or
cross-owner result.

### 4. Import and verify the receipt before activation

Keep the interactive Shelf revision undeployed and do not add either restricted
runtime URL to Vercel yet. This ordering ensures the initial additive import
finishes before a live customer can remove an item; the import therefore cannot
reverse a live customer removal.

At the protected operator boundary, inject the administrator URL and the one-
off verified owner subject UUID without writing either to disk or history. The
subject must equal the independently reviewed target. Derive its addressed
receipt without printing the subject:

```bash
SHELF_IMPORT_RECEIPT_SHA256="$(node -e "const {createHash}=require('node:crypto'); const value=(process.env.JELOCARE_SHELF_IMPORT_OWNER_SUBJECT ?? '').trim().toLowerCase(); process.stdout.write(createHash('sha256').update('jelocare-shelf-import-receipt-v1\\0pages-v1.0\\0').update(value).digest('hex')); ")"
npm run customer:shelf:import
npm run customer:shelf:import -- --apply "--confirm-receipt-sha256=$SHELF_IMPORT_RECEIPT_SHA256"
unset SHELF_IMPORT_RECEIPT_SHA256 JELOCARE_SHELF_IMPORT_OWNER_SUBJECT MIGRATION_DATABASE_URL
```

The dry run must be database-enforced read-only and report all 14 source
dispositions, exactly five accepted identity resolutions, nine pending request
resolutions, three routines, eleven ordered steps, no deletes, and no fully
reconciled receipt. On apply, the importer
first takes a `SHARE ROW EXCLUSIVE` lock on
`public.customer_shelf_import_receipts` before reading the receipt, then locks
`public.customer_shelf_items`, `public.customer_product_requests`,
`public.customer_routines`, and `public.customer_routine_steps`, so no
competing apply or Shelf write can invalidate its plan. It remains additive and
never deletes a Shelf row. Before writing the receipt, it verifies that the rows
actually inserted equal both planned missing sets. A fresh import must finish
with the exact five accepted identities, nine pending private requests, three
routines, and eleven ordered steps, so require `accepted-final=5` and `pending-final=9`,
plus `routines-final=3` and `routine-steps-final=11`. An upgrade from the earlier
five-item receipt must add no accepted identity: `accepted-final` is the current
surviving count from zero through five after customer removals, while
`pending-final=9` remains mandatory. In both modes, require each inserted count
to equal its planned count; the report prints no subject.

Verify completion without selecting the receipt's owner:

```sql
select count(*) as completed_receipts
from public.customer_shelf_import_receipts
where manifest_id = 'pages-v1.0';
```

Require `completed_receipts = 1`. A later invocation reports
`already-completed` and performs no inserts; do not use it as synchronization.
If the target, identities, counts, or receipt differ, stop: do not delete rows,
forge a receipt, weaken the guard, configure Vercel, or deploy Shelf.

### 4a. Drain failed private Blob deletions

Replace, remove, and request withdrawal try deletion immediately. A failure
leaves the private pathname in the durable owner-isolated cleanup queue. The
protected operator—not Vercel, the inventory cron, or a scheduled owner—drains
that queue. Inject the direct administrator URL and Blob write token only into
the protected process, then run a dry read before an explicitly confirmed batch:

```bash
npm run customer:product-request-blobs:drain -- --limit 20
npm run customer:product-request-blobs:drain -- --apply --limit 20 --confirm drain-private-product-request-blobs
unset MIGRATION_DATABASE_URL BLOB_READ_WRITE_TOKEN
```

The limit is 1–100 and defaults to 20. Apply locks a bounded oldest-first batch
with `SKIP LOCKED`, deletes only validated private product-request pathnames,
and removes an exact queue row only after Blob deletion succeeds. Failed rows
remain for a later idempotent retry, produce a nonzero exit, and are reported
only as aggregate eligible/selected/deleted/failed/remaining counts. Never log
an owner subject or pathname. This operator is manual and adds no cron or
scheduled-owner impact.

### 5. Normalize, probe, and configure the runtime URLs

The application uses postgres.js. Prepare each restricted runtime URL in the
protected secret channel with `sslmode=verify-full` and no `channel_binding`
query parameter; in particular, remove the provider-generated but unsupported
`channel_binding=require`. Do not downgrade TLS to make the driver connect.

Before injecting any URL into Vercel, probe the app-role URL through the same
postgres.js driver. With the candidate URL present only as `DATABASE_URL` in the
protected operator process, run:

```bash
node --input-type=module -e 'import postgres from "postgres"; const url=process.env.DATABASE_URL; if (!url) throw new Error("DATABASE_URL is required."); const sql=postgres(url,{max:1,prepare:false}); try { const [role]=await sql`select current_user, session_user`; if (role.current_user !== "jelocare_app_runtime" || role.session_user !== "jelocare_app_runtime") throw new Error("Application runtime role probe failed."); console.log("Application runtime role probe passed."); } finally { await sql.end({timeout:5}); }'
npm run customer:shelf:audit
```

The first probe must authenticate as exact `current_user = session_user =
jelocare_app_runtime`. The second uses only
`CUSTOMER_SHELF_DATABASE_URL` and must pass the exact read-only Shelf role
attestation. A connection or TLS error is a failed probe, not permission to add
`channel_binding=require`, weaken `sslmode`, or use an owner URL. If
`POSTGRES_URL` will be retained, apply the same URL rules and independently run
the app-role probe against it.

Only after both probes pass, add `DATABASE_URL` and
`CUSTOMER_SHELF_DATABASE_URL` through Vercel's protected prompt or dashboard.
If retained, `POSTGRES_URL` must be another probed app-role URL. Never paste a
URL into a command argument, source file, ticket, or evidence record.

Remove `MIGRATION_DATABASE_URL`, `JELOCARE_SHELF_IMPORT_OWNER_SUBJECT`, and
every owner-bearing or reconstructable alias from Production, Preview, and
Development scopes. This includes old unpooled URLs and split `POSTGRES_*` or
`PG*` fields. If a provider integration recreates them, reconfigure or remove
that integration before continuing.

```bash
vercel env ls
```

Record names and scopes only. The final inventory must prove that Vercel has
the two restricted, probed runtime URLs and no migration administrator or owner
alias.

### 6. Deploy, activate, and smoke

Deploy the already verified revision only after the receipt and URL probes pass,
then wait for the exact Vercel deployment to become `READY`. Vercel verifies,
builds, and may promote bounded staged public assets; it does not reconcile
PostgreSQL or run the import.

Smoke the exact deployment with the verified launch account: sign in, list the
five accepted exact products, add and reload one other eligible product, remove
it, list the three imported routines and eleven ordered steps, create, update,
and delete a temporary routine, export JSON, open and cancel the clear
confirmation, and sign out. Never
clear the imported launch Shelf merely for smoke because the receipt correctly
prevents re-import; exercise the destructive clear result only with an approved
disposable account. Confirm another account cannot see the rows, the public
reporting helper sends no private state, Synthetic Amara is absent, and Concern
remains unpersisted. Prove Routine and Shelf cross-owner denial with the
checked-in deterministic rollback audit when a disposable customer is not
already authorized. Do not claim full provider-account deletion; it is not
implemented.

### 7. Rotate the former owner and declare the floor

After the restricted deployment and smoke pass, rotate or revoke the database
owner credential that Vercel previously held. Update only the protected
operator secret store, remove any provider integration capable of reconstructing
the old owner URL, and repeat the environment inventory, runtime attestation,
and production smoke. Never change a runtime role into an owner or grant it
`BYPASSRLS` to recover access.

Runtime-role credential rotation is a coordinated protected operation: set the
new password interactively, replace only that role's Vercel URL through the
protected prompt, redeploy, and smoke both general and Shelf data paths. Expect
new connections to fail between the password change and updated deployment;
use a bounded maintenance window. Do not change the role name or grants during
a credential-only rotation.

Record the rollback floor as the first exact application revision proven with
the restricted roles, together with the ledger through `0037` and the passing
audit. A failed later application deployment may roll back only to that revision
or another role-compatible revision. Do not down-migrate, restore an owner URL,
or delete Shelf rows. The current code has neither an activation flag nor an
independent recovery-only export/delete path. Disable behavior with a reviewed
role-compatible release; removing `CUSTOMER_SHELF_DATABASE_URL` is an emergency
total fail-closed action that disables Shelf list, add, remove, clear, export,
and Routine persistence together. Preserve rows and forward-fix.

This operation creates no cron and changes no inventory schedule, queue, lease,
worker, or manual-observation behavior.

## Operator access cannot be changed

1. Confirm the signed-in operator is an active admin. Do not bypass the role
   check or edit an auth subject in the browser.
2. Confirm migration `0025_operator_access_lifecycle.sql` is present in
   `schema_migrations`. Before it is applied, the directory intentionally
   remains readable and all access mutations fail closed.
3. For a pending invitation, confirm the normalized invited email exactly
   matches the mailbox Neon Auth verified. Never synthesize a subject from an
   email address.
4. If delivery failed, keep the pending invitation and retry from its inspector
   after checking the configured mail transport. Do not create a duplicate.
5. If a role or pause action is refused, check the self-lockout and last-active-
   admin guards before investigating the database.
6. Confirm the resulting event in `moderation_operator_access_audit`. Corrective
   work is a new audited action; never rewrite the access trail.

## Catalogue count or queue drifts

```bash
npm run catalogue:pipeline:status
npm run catalogue:intake:audit
npm run catalogue:research:verify
npm test
```

If the research queue differs, rebuild it with its operator. Do not hand-edit the projection.

## Product image looks clipped or opaque

1. Remove it from public consideration if identity or package completeness is uncertain.
2. Compare the public Blob bytes with the recorded hash and dimensions.
3. Inspect alpha and silhouette audits.
4. Review on peach, pink, and dark surfaces.
5. Re-run the exact-SKU preparation path from a traceable source.
6. Update the candidate and release only through the normal gate.

Never heal a mismatched package with generation.

## Price or stock looks wrong

1. Open the exact retailer page.
2. Confirm final URL, title, variant, size, seller, currency, price, stock, and observation time.
3. Check whether the public observation is expired.
4. Inspect extraction evidence and response-scope checks.
5. Queue or run the smallest inventory refresh.
6. Preserve the prior price in history.
7. Withhold ambiguous or search-only observations.

## Inventory cron fails

1. Verify `CRON_SECRET` and the Authorization header.
2. Inspect the response or `inventory_refresh_cron_completed` log. `run`
   separates completed, retrying, terminal-failed, discarded, lease-recovered,
   and deadline-stopped work; `backlog` reports queued, due, processing, and
   lease-expired counts.
3. Check retailer response status, MIME type, size, redirects, and adapter.
4. Look for product or market scope rejection.
5. Let bounded retries and the two-minute processing lease work; do not create
   duplicate active jobs or manually reclaim an unexpired worker. An expired
   job below the attempt cap is reclaimed, while one at the cap fails
   terminally.
6. Manually inspect any retailer that blocks automation.

For a bounded manual run, scope claims to the intended market. This filter
applies to queued claims, expired-lease recovery, and exhausted-lease
settlement, so a Nigerian maintenance run cannot mutate interleaved jobs from
another market:

```bash
npm run inventory:work -- --market NG --limit 10
```

Omitting `--market` is reserved for the scheduled cross-market worker or an
explicitly reviewed cross-market maintenance run. Do not enqueue the same
population again merely to obtain a market-scoped worker; consume the existing
job ledger.

An in-flight result is deliberately discarded if another worker or a manual
observation supersedes its claim. An offer that becomes unpublished,
non-exact, or non-HTTPS is cancelled; an exact offer whose URL changes is
queued for a fresh claim. Do not relax those gates to clear a backlog.

### Private manual browser observation

For a retailer that blocks the bounded fetch worker, record an observation only
after opening the exact product page in a browser and confirming its title,
measurable size, stock, and (when supplied) NGN price. This is a private CLI,
not an API. It resolves one pre-existing `exact` offer from product slug,
retailer name, and optionally its exact URL; it never creates an offer, changes
match kind, or approves a product.

An active `operator` or `admin` mapping is required through
`MODERATION_OPERATOR_EMAIL`. The command is a dry run unless `--apply` is
present. It records manual verification timestamps, a 1–168 hour expiry,
structured browser evidence and rationale, price history when a price is given,
an append-only operator audit entry in the same transaction, and completes only
the matching active refresh job. It fails closed if the product is not currently
published or the offer URL, market, or exact-match state changes before apply. It
does not print the email, browser evidence, rationale, URL, or other raw
observation payload.
A passing manual observation may refresh an already approved exact public offer
through the same title, size, route, market, and freshness gates as automation.
It cannot create or approve a product, retailer, or offer identity.

```bash
MODERATION_OPERATOR_EMAIL=operator@example.invalid \
  npm run inventory:observe:manual -- \
  --product-slug exact-product-slug \
  --retailer "Exact Retailer Name" \
  --market-code NG \
  --stock in_stock \
  --price-naira 23500 \
  --observed-title "Exact product title shown by the retailer" \
  --observed-size "473 ml" \
  --evidence-note "Price and stock visible on the browser product page." \
  --rationale "Retailer blocks automated verification." \
  --valid-for-hours 24
```

After reviewing the dry-run result, repeat the same command with `--apply`:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.invalid \
  npm run inventory:observe:manual -- \
  --product-slug exact-product-slug \
  --retailer "Exact Retailer Name" \
  --market-code NG \
  --stock in_stock \
  --price-naira 23500 \
  --observed-title "Exact product title shown by the retailer" \
  --observed-size "473 ml" \
  --evidence-note "Price and stock visible on the browser product page." \
  --rationale "Retailer blocks automated verification." \
  --valid-for-hours 24 \
  --apply
```

Omit `--price-naira` only when the page does not show a reliable whole-naira
price. Supply `--market-code` whenever the product/retailer pair can resolve to
more than one market offer (including duplicate exact URLs); use the canonical
market code such as `NG`. `--url` identifies the retailer listing but does not
replace market scope. Do not use this command for a search result, variant
ambiguity, or a retailer page whose title or size cannot be verified.

## Community submissions arrive

```bash
npm run community:research:signals
```

Use aggregate signals to prioritize research. Review custom vocabulary in the moderation queue. Do not publish prices, outcomes, or retailer claims directly from a community record.

Never report unique contributor counts until a privacy-reviewed stable anonymous identifier exists.

### Private moderation operator

Use `/ops` for item-by-item review. The command-line operator is the private,
aggregate-first fallback for an authenticated operator; it is not an API and must
never be wrapped in a public route.

```bash
MODERATION_OPERATOR_EMAIL=operator@example.com \
  npm run community:moderate
```

The default inspection is read-only and prints aggregate backlog, research-lane,
and integrity counts without raw contribution payloads. Every mutation requires:

- an email matching one active row in `moderation_operators`;
- the capability granted to that operator role;
- an explicit action, target, and rationale;
- `--apply`.

Without `--apply`, a valid command performs a dry run:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.com \
  npm run community:moderate -- \
  --action reject \
  --queue community_contribution \
  --target-id 00000000-0000-4000-8000-000000000000 \
  --rationale "Duplicate test submission."
```

After reviewing the dry run, append `--apply`. Contribution rejection also rejects
its still-pending edges and observations and recalculates affected research signal
counts in the same transaction. The parent decision and cascade counts are written
to `moderation_audit_log`.

Map a custom term only to an existing canonical slug:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.com \
  npm run community:moderate -- \
  --action map \
  --queue community_moderation_value \
  --target-id 00000000-0000-4000-8000-000000000000 \
  --canonical-kind purpose \
  --canonical-ref keratosis-pilaris \
  --rationale "Common-language alias for the existing concern."
```

An admin can reconcile materialized research counters after a retention or recovery
event. This also defaults to a dry run:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.com \
  npm run community:moderate -- \
  --action reconcile \
  --rationale "Scheduled retention reconciliation."
```

Admins can also assign or reassign a task to one active operator, or return it to
the shared queue. Both commands dry-run unless `--apply` is appended:

```bash
MODERATION_OPERATOR_EMAIL=admin@example.com \
  npm run community:moderate -- \
  --action assign \
  --queue community_research_task \
  --target-id 00000000-0000-4000-8000-000000000000 \
  --operator-id 00000000-0000-4000-8000-000000000001 \
  --rationale "Route this exact identity check to the assigned reviewer."

MODERATION_OPERATOR_EMAIL=admin@example.com \
  npm run community:moderate -- \
  --action unassign \
  --queue community_research_task \
  --target-id 00000000-0000-4000-8000-000000000000 \
  --rationale "Return this work to the shared queue."
```

Never copy a connection string, raw payload, operator subject, or contributor text
into a ticket, commit, terminal transcript, or chat. Use queue row IDs for handoff.

If later review shows that a settled observation has the wrong decision, an
admin can correct it without rewriting or hiding the original audit entry.
`defer` returns an approved or rejected observation to private review; `reject`
changes an approved observation to rejected. Pending observations, no-op
transitions, and mapped records are not accepted by this recovery path. The
command is dry-run by default. A child beneath a rejected or expired parent
cannot return to pending review. Stop and review the parent state separately;
this pathway does not provide a contribution-decision correction and must not be
used to improvise one. The web inspector intentionally exposes only **Return to
review**; approved-to-rejected correction remains CLI-only.

```bash
MODERATION_OPERATOR_EMAIL=admin@example.com \
  npm run community:moderate -- \
  --action correct \
  --queue community_observation \
  --target-id 00000000-0000-4000-8000-000000000000 \
  --disposition defer \
  --rationale "Exact product identity still needs review."
```

Repeat with `--apply` only after reviewing the dry run. For a return to pending,
the database locks the active admin, then the retained non-rejected parent, then
the observation. Under the observation lock it reconstructs the latest causal
state from the audit history in durable `event_sequence` order and requires that
state to match the row before it links the new `defer` or `reject` event to that
prior audit ID. Timestamps remain presentation data; never use `created_at` plus
a random audit UUID as causal order. All of this occurs in the same transaction
as the status change. The applied correction never
erases the prior decision and never creates a product, offer, price, outcome,
retailer, or canonical relationship. It fails closed if the database client
cannot open a real transaction. `/ops/activity` links settled observation
decisions to the Observation inspector; admins can use **Return to review** there
with a new, blank-by-default reason.

Insufficient exact identity is not automatically a terminal rejection. When the
retained evidence and prior audit history intentionally quarantined a report for
identity research, keep or return it to private pending review until the exact
SKU is established or evidence supports a terminal decision. Use rejection only
when the report cannot be retained under the evidence policy, and preserve the
incorrect decision as visible audit history when correcting this mistake class.

### Research ownership and outcomes

Use `/ops/research` for the normal manual pathway. Assigning a task records the
active operator; blocking it requires the exact next evidence action. Both are
durable task state and append an attributable audit event. They do not resolve
the identity or change catalogue data.

The private command is available for recovery and scripted adjudication. It is
dry-run by default:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.invalid \
  npm run community:moderate -- \
  --action defer \
  --queue community_research_task \
  --target-id 00000000-0000-4000-8000-000000000000 \
  --rationale "Exact next evidence action or source blocker."
```

Repeat with `--apply` after review. `claim` uses the same command shape and
records `assigned` rather than `blocked`.

The dry run checks the current owner and workflow state. Product-resolution
dry-runs also check the task namespace and outcome, existing published target
or eligible unreleased candidate, and whether the task's current positive
`resolution_cycle` already has a resolution. Apply rechecks those guards inside
the locked transaction and inserts under `(task_id, resolution_cycle)`; a
successful preview is not permission to weaken a later concurrency failure.

Only the current owner may move active research into `retry`, with the next
bounded evidence step recorded. Admin takeover is reserved for work that already
belongs to a different operator and preserves the displaced owner in the audit
trail. Canonical tasks must resolve to the exact product or retailer named by
their namespaced task reference; ambiguous and duplicate outcomes remain
available only for custom identity work.

Product outcomes use `npm run community:research:resolve`. Existing-product
targets must be published, and deliberate-intake targets must already exist in
the checked-in intake manifest, remain unreleased, and originate from a custom
product-identity task. Retailer outcomes use the parallel private
command:

```bash
MODERATION_OPERATOR_EMAIL=operator@example.invalid \
  npm run community:retailer-research:resolve -- \
  --task-id 00000000-0000-4000-8000-000000000000 \
  --outcome existing-canonical-retailer \
  --canonical-slug exact-retailer-slug \
  --rationale "Exact evidence binding the task to the existing retailer."
```

The other retailer outcomes are `ambiguous-retailer` and
`dismissed-duplicate`. Add `--apply` only after the dry-run is correct. A
resolution closes the task but never creates or changes a retailer, offer,
price, product, or publication record.

When genuinely new private product demand reaches a completed or dismissed
product task, the pinned bridge reopens it as pending, increments
`resolution_cycle` exactly once, and clears assignment/work/next-action state.
An already-active mention retry does none of those things. The prior product
resolution row remains immutable and queryable in its earlier cycle; never
delete or rewrite it to make the reopened task resolvable. Assign and resolve
the reopened task normally. Current queues, observation binding, Overview, and
Activity audit projection join only the task's current cycle; historical
Activity outcome totals intentionally retain all product resolution cycles.

## Retailer application email fails

1. Confirm the application saved before retrying email.
2. Check `EMAIL_PROVIDER`, sender address, and Production/Preview scope.
3. For `hostinger-api`, confirm `EMAIL_API_TOKEN` is a mailbox-scoped Agentic
   Mail token and that `/api/v1/me` includes the sender.
4. For `hostinger-smtp`, confirm `EMAIL_SMTP_PASSWORD` is the mailbox password,
   not an API token.
5. Use the resend endpoint only within its rate limit.
6. Do not print the private link or token in logs.

The application can remain saved even when delivery reports `failed` or `unavailable`.

## Secret exposure

1. Revoke or rotate the credential immediately.
2. Remove it from current files and output.
3. Assess Git history, build logs, screenshots, and copied artifacts.
4. Replace it in every required environment scope.
5. Redeploy and exercise the dependent feature.
6. Add a prevention check if the exposure route was repeatable.
