# Operational runbooks

Updated: 2026-08-31

Lead with evidence. Preserve data. Prefer a forward repair.

## Runtime 500 on every page using next/image (sharp module missing)

**Symptom:** Production returns 500 on `/products`, `/concerns`, `/consult`,
`/contribute`, and any route that renders `next/image`. The root URL (`/`)
works because it does not use `next/image`. Vercel runtime logs show:

```
Error: Failed to load external module sharp-4d49d2c113086808:
  Error: Could not load the "sharp" module using the linux-x64 runtime
  ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file
```

**Root cause:** A `pnpm-lock.yaml` was committed to the repository (for
example, by running `pnpm install` to update Husky or lint-staged
dependencies). Vercel detects `pnpm-lock.yaml` and switches from npm to pnpm.
pnpm 10.x on Vercel does not install the `linux-x64` optional dependencies
for `sharp` (`@img/sharp-linux-x64` and `@img/sharp-libvips-linux-x64`),
so the native `libvips-cpp.so` shared object is absent at runtime.

The project uses npm (`package-lock.json`) as its package manager. The
`package-lock.json` already includes the correct `linux-x64` sharp binaries.
The `pnpm-lock.yaml` was an accidental artifact that overrode the intended
package manager.

**Warning:** Do not run `pnpm install` in this repository. It creates a
`pnpm-lock.yaml` that changes Vercel's package manager and breaks sharp.
Use `npm install` or `npm ci` instead. If a `pnpm-lock.yaml` appears,
delete it and commit the removal.

**Fix:**

1. Delete `pnpm-lock.yaml`: `git rm pnpm-lock.yaml`
2. Commit and push: `git commit -m "Remove pnpm-lock.yaml" && git push`
3. Verify the next Vercel deployment uses npm (build log should say
   `Installing dependencies... npm install`, not `pnpm install`)
4. Verify all routes return 200 after deployment completes

**Prevention:**

- Never commit `pnpm-lock.yaml`. Add it to `.gitignore` if needed.
- If Husky or lint-staged dependencies need updating, use
  `npm install --save-dev husky lint-staged` and let npm update
  `package-lock.json`.
- The `pnpm-workspace.yaml` file is safe to keep (it configures build
  permissions for local pnpm users), but it must not be accompanied by a
  committed `pnpm-lock.yaml`.

**Incident:** 2026-08-08, commits `c764bae` and `da3f2e8` introduced
`pnpm-lock.yaml`. Fixed in commit `945bc96` by removing it. All pages
verified returning 200 after deployment `jelo-dtwu1jb6d`.

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

## Private Me telemetry SLO evaluation and recovery drill

The scorecard command is read-only. It always requests the canonical 28-day
production report and requires both approved traffic-policy values explicitly:

```bash
npm run customer:telemetry:slo -- \
  --minimum-read 1000 \
  --minimum-write 200
```

The approved minimum read and write populations are 1,000 and 200. Keep them
explicit; do not replace them during an incident. Exit `0`
means both signals reached minimum traffic and passed (read at least 99.9%,
write at least 99.5%). Exit `1` means a traffic-qualified signal failed. Exit
`2` means the result is not evaluable because at least one signal lacks minimum
traffic and no qualified signal failed. Exit `3` is a generic fail-closed input
or operational error. The JSON contains only window metadata, policy values,
and aggregate read/write counts, rates, targets, and statuses.

For production evidence, retain the exact JSON and exit status with a UTC
capture time, the report's start and end hour, exact application revision and
deployment, exact command, the recorded approval reference for both minimums,
operator/reviewer references, and a SHA-256 checksum. Never record Redis
credentials or add private dimensions.

The quarter-hour rollback owner runs at minutes 2, 17, 32, and 47 so deferred
telemetry writes can settle before the last completed UTC quarter is read. It
uses minimum populations of 100 reads and 50 writes. Strictly more than 1% read
failures or 2% write failures returns HTTP 503 and requires JeloCare Operations
to inspect the exact deployment and private-safe aggregate before rollback.
`not-evaluable` is HTTP 200 but remains visibly not evaluable; it must not be
recorded as healthy. Report/configuration failure is HTTP 500. Do not manually
invoke the route to manufacture evidence, and do not copy a Redis credential
or any private customer dimension into the incident record. External alert
delivery and deduplication must be bound separately to the structured
`customer_private_telemetry_fast_burn_checked` and
`customer_private_telemetry_fast_burn_failed` signals.

Use this non-destructive operator-report recovery drill contract:

1. With approved read-only production access, capture one successful report and
   evaluation. Do not write, delete, expire, copy, or synthesize a production
   telemetry hash.
2. In a local child process only, remove `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` from that process environment and run the same command.
   Require generic error text, no report JSON, and exit `3`. Do not alter Vercel
   configuration, rotate credentials, or make Redis unavailable.

   ```bash
   env -u KV_REST_API_URL -u KV_REST_API_TOKEN \
     npm run customer:telemetry:slo -- \
       --minimum-read <same-approved-positive-integer> \
       --minimum-write <same-approved-positive-integer>
   ```

3. End the child process, run the unchanged command again with the approved
   read-only environment restored, and require a valid aggregate result. This
   proves only fail-closed operator reporting and recovery after local
   configuration restoration; it does not prove writer recovery, Redis backup
   restore, data reconstruction, or the 15-minute rollback alert.
4. Retain a dated drill receipt containing the two successful aggregate
   artifact checksums, the expected failure exit, timestamps, revision and
   deployment, unchanged configuration attestation, approved traffic-policy
   reference, and operator/reviewer references. Record any hour-boundary change
   rather than expecting byte-identical reports.

No production SLO or recovery-drill evidence exists until both a dated 672-hour
production report and the drill receipt are retained. A code check, local test,
or undated terminal transcript is not production evidence.

## Stripe payment reconciliation reports anomalies

The scheduled `/api/cron/reconcile-payments` owner examines only a bounded
oldest-first batch of stale pending Stripe attempts. Do not invoke it manually
against Production to manufacture evidence, and do not update payment rows with
SQL.

1. Confirm the exact application revision and inspect the structured summary:
   `scanned`, `verified`, `failed`, `abandoned`, `pending`, `reviewRequired`,
   and `retryableErrors`. A `503` means at least one provider/database operation
   remains retryable; it is not authority to abandon that attempt.
2. For a ready attempt, require the stored Checkout Session to be re-retrieved
   before any terminal change. `open` or PaymentIntent `processing` remains
   pending. Exact Session expiry becomes `abandoned`; an exact terminal
   PaymentIntent failure becomes `failed`.
3. A paid Checkout Session is not sufficient polling evidence for the quote
   window. Only a signature-verified `checkout.session.completed` or
   `checkout.session.async_payment_succeeded` Event supplies its own `created`
   time, and only after the stored session/reference/amount plus succeeded,
   paid, fully captured Charge re-verify. Session and Charge `created` values
   are object-creation metadata, not settlement timestamps.
4. Paid polling without the signed success-Event time, a late success Event,
   reference/money/currency mismatch, malformed Charge evidence, or a stale
   reservation without a stored session records an idempotent
   `payment_review_required` event. Preserve the attempt and resolve it through
   provider evidence; never guess a success time.
5. Webhook replays are safe: an already verified payment returns success and a
   repeated review evidence reference does not append another review event.
   Provider/network failure returns non-success for retry and cannot create a
   paid order or silently close an uncertain attempt.

After deployment, use only unauthenticated negative probes of the webhook and
cron routes unless a separate production-payment exercise is explicitly
authorized. Both must reject missing credentials/signatures without touching
payment state.

## Ops Overview assisted-order age looks wrong

The assisted-order count on `/ops` is an Ops-work clock, not a count of every
non-terminal customer order. `awaiting_approval` is intentionally absent while
the customer decides. A delivered order appears only while a return request is
open.

Use approved read-only evidence for one exact order; do not change an order or
append an event merely to test the clock:

1. Confirm the exact application revision, current order state, and retained
   append-only event sequence.
2. For an open delivered return, use the unmatched `return_requested` event
   time. A later notification-preference change must not replace it.
3. For other included states, find the latest event that entered the current
   state. A later `payment_review_required` event in that state is the only
   same-state event that becomes a new Ops wait anchor. If no qualifying event
   exists, treat queue age as unavailable and investigate the ledger gap.
4. Ignore `orders.updated_at`, notification-preference events, and other
   same-state writes. They record real changes but do not restart Ops waiting
   age.
5. If two queues have the same oldest timestamp, the fixed Overview topology
   order decides which queue is recommended. Do not add a hidden priority.

If the projection differs from those facts, retain only the order reference,
state, anchor action, event sequence, event time, application revision, and UTC
capture time needed for a bounded forward fix. Do not rewrite the event ledger,
backdate rows, or invent an escalation threshold.

The approved order-only queue-age policy is read-only and owned by JeloCare
Operations:

| Ops-owned work          |    Warning | Critical |
| ----------------------- | ---------: | -------: |
| General operator action |    4 hours | 24 hours |
| Payment review          | 30 minutes |  2 hours |
| Open return review      |    2 hours |  8 hours |

`/api/cron/ops-order-health` runs at minutes 7, 22, 37, and 52. It reads the
same append-only clocks in a database-enforced read-only transaction, returns
HTTP 503 for warning or critical work, and emits only aggregate counts, oldest
ages, thresholds, status, and `writesPerformed: 0`. A missing immutable wait
clock is critical because an age must never be invented. A query or policy
failure returns HTTP 500. The route does not send mail, append an order event,
or change an order. External alert delivery/deduplication and a read-only
production response drill remain separate release evidence.

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

### Reconcile the 0048/0049 ledger gap

Production was observed on 2026-08-14 with the schema effects of
`0048_money_columns_to_numeric.sql` and
`0049_fix_remaining_money_columns.sql` present but neither filename in the old
ledger; `0050_payment_integrity.sql` was absent. Re-observe before acting. The
sequence below is an exceptional append-only ledger repair, not permission to
rerun `0048`/`0049`, bless arbitrary SQL, or edit domain data.

Prerequisites:

1. Use the exact candidate application revision and require `npm run
db:migrations:validate` to pass.
2. Resolve the intended Neon project, branch ID, branch name, parent, and
   protected/default state without printing a connection string. Create a fresh
   `rehearsal/...` child from production and prove it is non-primary and
   disposable before opening its direct administrator URL.
3. Run every step first on that production-derived branch. The output may
   retain filenames, SHA-256 values, counts, and the non-secret repair
   reference only. Do not retain URLs, payment rows, subjects, or provider
   evidence.
4. Production requires the recorded rehearsal result plus explicit release
   authority for the exact project, branch, revision, and repair reference.

With the selected branch's direct URL present only as
`MIGRATION_DATABASE_URL`, inspect first:

```bash
npm run db:migrations:status
```

The initial command is read-only and should report `ledger=legacy`, a contiguous
legacy prefix through `0047_assisted_order_payments.sql`, then `0048`, `0049`,
`0050`, and `0051` pending. Any unknown filename, later ledgered row, different
first pending file, or partially governed shape is a stop condition.

Convert only that exact legacy table to the immutable checksummed shape:

```bash
npm run db:migrations:repair -- \
  --initialize-governance \
  --reference=migration-ledger-repair-20260814 \
  --confirm=initialize-checksummed-ledger
npm run db:migrations:status
```

This transaction adds governance metadata and append-only triggers. Existing
rows receive `legacy_filename_record`: their checksums bind the current
canonical files but do not claim those were the historical execution bytes.
Require `ledger=governed`, `immutable=true`, and `0048` as the first pending
file.

Reconcile the two observed effects in order, using the hashes printed by the
offline validator/status command and pinned below for this revision:

```bash
npm run db:migrations:repair -- \
  --reconcile=0048_money_columns_to_numeric.sql \
  --confirm-checksum=f86ec32e35b4b76b8b5942f5009e59ea9d7a919fe59300b7bb2f7cce219c06d2 \
  --reference=migration-ledger-repair-20260814
npm run db:migrations:status

npm run db:migrations:repair -- \
  --reconcile=0049_fix_remaining_money_columns.sql \
  --confirm-checksum=fa26472740a688ec8acf41e7e3919bcb2d358e512b109e58b2cb4a5ebc528a6f \
  --reference=migration-ledger-repair-20260814
npm run db:migrations:status
```

Each repair takes the migration advisory lock and a serializable transaction,
requires the target to be first pending, and checks every named column as
`numeric(12,2)`. The `0048` verifier also requires the generated quote total to
include all five components. It inserts only a
`schema_effect_reconciliation` ledger row with null execution time; it neither
executes the migration nor claims the original bytes or actor are known. Any
missing/different catalog result rolls back the ledger insert.

After both reconciliations, status must show exactly these normal pending
migrations, in order:

- `0050_payment_integrity.sql` with checksum
  `1a916728557e7ef9b1d8b8381c30b62811758a0d7e1fbe5ee5a018a54b3e5976`;
- `0051_order_lifecycle.sql` with checksum
  `3ba4cf213d2d71edc5cd6efc36c0ef52ab2f540494cf9018bba7e48a0476c261`.

Before applying it, reconcile provider evidence until all of its checked-in
preconditions are true:

- at most one pending Paystack attempt exists per order and quote;
- every pending Paystack attempt has a nonblank reference, a `reserved` or
  `ready` phase, valid reservation time, and—when ready—authorization/access
  metadata plus a valid initialization time;
- Paystack references are unique, as are normalized verified manual-transfer
  references; and
- verified rows have verification time and evidence reference, every Paystack
  row has a reference, and every verified manual transfer has a nonblank
  reference.

Never choose a surviving payment attempt or invent provider evidence merely to
make the migration pass. Resolve ambiguity against the payment provider under
the payment-integrity runbook. Then, on the rehearsal branch:

```bash
npm run db:migrate
npm run db:migrations:status
npm run db:migrate
```

The first run must apply `0050` followed by `0051`; each body and its exact
`runner_atomic` checksum row must share its own transaction. The second run
must skip every migration. A failure in either migration must leave that
migration's schema body and ledger row absent. Only after that result, the
payment acceptance audit, and the complete lifecycle browser acceptance may
release authority repeat the same status → initialize → `0048` reconcile →
`0049` reconcile → `0050` apply → `0051` apply sequence on production. Never
add a filler migration or mark either normal migration applied.

### Rehearse a temporary migration and promote unchanged bytes

Use this for a not-yet-canonical next migration. The ignored draft directory is
outside the production runner's enumeration:

```bash
mkdir -p .migration-rehearsal
$EDITOR .migration-rehearsal/NNNN_exact_name.sql
```

Create a fresh production-derived `rehearsal/...` Neon branch, verify its ID,
name, parent, and non-protected status with `neonctl branches list`, and derive
only that branch's direct administrator URL. Keep `MIGRATION_DATABASE_URL`
unset. With the URL in process memory as `MIGRATION_REHEARSAL_DATABASE_URL`, run
the exact draft twice:

```bash
npm run db:migrations:rehearse -- \
  --source=.migration-rehearsal/NNNN_exact_name.sql \
  --project-id=spring-field-93817903 \
  --branch-id=br-verified-rehearsal-id \
  --branch-name=rehearsal/exact-name-20260814 \
  --confirm-target=non-production-disposable-branch
npm run db:migrations:rehearse -- \
  --source=.migration-rehearsal/NNNN_exact_name.sql \
  --project-id=spring-field-93817903 \
  --branch-id=br-verified-rehearsal-id \
  --branch-name=rehearsal/exact-name-20260814 \
  --confirm-target=non-production-disposable-branch
```

Before PostgreSQL opens, the command uses the authenticated Neon CLI for
read-only control-plane attestation: the branch must match the project, ID, and
name; have a parent; be non-default and non-protected; and own the enabled
read-write endpoint named by the URL. It also rejects Vercel, a simultaneously
present production migration URL, non-`rehearsal/...` names, noncontiguous
versions, and malformed transaction wrappers. Record its printed SHA-256. The
first run must apply and the second must skip that same filename/hash. After the
schema/data acceptance checks pass, promote by confirmed hash:

```bash
npm run db:migrations:promote -- \
  --source=.migration-rehearsal/NNNN_exact_name.sql \
  --confirm-checksum=the-printed-64-character-sha256
cmp .migration-rehearsal/NNNN_exact_name.sql db/migrations/NNNN_exact_name.sql
npm run db:migrations:validate
```

Promotion fails if the destination exists, copies without transformation, and
re-hashes the destination. Never retype, paste, run a formatter over, or edit
the promoted migration. If review changes one byte, it is a new unrehearsed
digest: return it to the temporary path and rehearse again before production.

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

### Purge expired Ask Jelo generation metadata

`consult_ai_generations` rows become eligible for deletion when their 30-day
`retain_until` boundary passes. They remain stored until the protected manual
operator removes them; no automatic 30-day deletion claim is made. The runtime
role remains denied `DELETE`; expiry does not grant the application or a
scheduled job deletion authority. The protected retention CLI accepts only a
direct administrator `MIGRATION_DATABASE_URL`, never runs in Vercel, and prints
aggregate eligible, selected, deleted, and remaining counts only.

Start with the database-enforced read-only dry run. The default batch is 100;
`--limit` must be an integer from 1 through 500.

```bash
npm run consult:ai:retention -- --limit=100
```

Before production apply, re-resolve the exact Neon project and branch, review
the dry-run aggregate, and obtain fresh action-time production authority for
that target and batch. Then inject the direct administrator URL only into the
protected operator process and use both apply gates:

```bash
npm run consult:ai:retention -- \
  --apply \
  --limit=100 \
  --confirm=purge-expired-consult-ai-generations
unset MIGRATION_DATABASE_URL
```

Apply locks one oldest-currently-unlocked bounded batch with `SKIP LOCKED` and
deletes only rows whose `retain_until <= now()` in one transaction. A repeated
run with zero eligible rows succeeds with zero aggregate deletions. Do not add this
operator to Vercel, cron, queue, or cache work, and never retain row IDs, row
content, prompt or output hashes, provider fields, URLs, emails, secrets,
connection details, or terminal output containing them.

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
where grantee in ('jelocare_app_runtime', 'jelocare_shelf_runtime')
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
    'customer_product_requests',
    'customer_product_request_images',
    'customer_product_request_mutations',
    'customer_product_request_blob_cleanup',
    'customer_product_request_research_mentions',
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
runtime attestation, then its deliberately explicit rolled-back lifecycle and
isolation exercise:

```bash
npm run customer:shelf:audit
npm run customer:shelf:audit -- --exercise-rollback
```

The first command is read-only and requires the exact current and session role,
safe role attributes, no outgoing role membership or relation ownership, and
enabled plus forced RLS. It compares the Shelf role's direct migration-`0036`
table ACLs exactly (including grant options and unexpected PostgreSQL 17
`MAINTAIN`), rejects any effective app-runtime or PUBLIC access to the four
owner-private relations, requires exactly the four app-readable aggregate
mention columns with no private `request_id` or other access, and proves PUBLIC
and the app runtime cannot execute the pinned bridge while the Shelf runtime
can execute it without grant option. An incoming PostgreSQL 17
creator/administrator edge is allowed.

The second command preserves the existing Shelf and Routine exercise and adds
one private product-request lifecycle under random synthetic owners. It proves
request create, mutation-key replay, optimistic update, bounded image metadata,
consent revocation without identity-field change, submit/bridge retry,
withdrawal scrubbing, cleanup enqueue, owner-A visibility, owner-B invisibility,
cross-mutation denial, owner mutation/deletion, and routine-step cascade. It
does not upload or delete a Blob. It deliberately rolls back the entire
transaction, rechecks both synthetic owners for zero rows, prints no subject,
identity, request field, or pathname, and leaves no durable customer or
aggregate-signal row.

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
postgres.js driver. With the candidate URL present only as `APP_DATABASE_URL` in the
protected operator process, run:

```bash
node --input-type=module -e 'import postgres from "postgres"; const url=process.env.APP_DATABASE_URL; if (!url) throw new Error("APP_DATABASE_URL is required."); const sql=postgres(url,{max:1,prepare:false}); try { const [role]=await sql`select current_user, session_user`; if (role.current_user !== "jelocare_app_runtime" || role.session_user !== "jelocare_app_runtime") throw new Error("Application runtime role probe failed."); console.log("Application runtime role probe passed."); } finally { await sql.end({timeout:5}); }'
npm run customer:shelf:audit
```

The first probe must authenticate as exact `current_user = session_user =
jelocare_app_runtime`. The second uses only
`CUSTOMER_SHELF_DATABASE_URL` and must pass the exact read-only Shelf role
attestation. A connection or TLS error is a failed probe, not permission to add
`channel_binding=require`, weaken `sslmode`, or use an owner URL. If
`POSTGRES_URL` will be retained, apply the same URL rules and independently run
the app-role probe against it.

Only after both probes pass, add `APP_DATABASE_URL` and
`CUSTOMER_SHELF_DATABASE_URL` through Vercel's protected prompt or dashboard.
Disconnect the owned Neon resource from the Vercel project without deleting the
resource, then restore only the reviewed Neon Auth variables in their original
scopes. If retained outside Vercel, `POSTGRES_URL` must be another probed
app-role URL. Never paste a URL into a command argument, source file, ticket,
or evidence record.

Remove `DATABASE_URL`, `MIGRATION_DATABASE_URL`,
`JELOCARE_SHELF_IMPORT_OWNER_SUBJECT`, and every owner-bearing or reconstructable
alias from Production, Preview, and Development scopes. This includes old
unpooled URLs and split `POSTGRES_*` or `PG*` fields. If a provider integration
recreates them, disconnect that integration before continuing. Preview must
have no app URL, Shelf URL, or Auth cookie secret.

```bash
vercel env ls
```

Record names and scopes only. The final inventory must prove that Vercel has
the two restricted, probed runtime URLs and no migration administrator or owner
alias.

### 6. Invalidate the former owner, deploy, activate, and smoke

Reset or revoke the database-owner credential that Vercel previously held
before creating the final deployments. Suppress the replacement password,
retain only the safe operation identity, and wait for Neon to report the
operation finished. Do not blindly retry an indeterminate reset. Never reconnect
the Neon resource or restore an owner alias as rollback.

Create fresh Production and Preview deployments from the already verified
revision only after the receipt and URL probes pass and the owner reset
finishes. Wait for both exact Vercel deployments to become `READY`. Vercel
verifies, builds, and may promote bounded staged public assets; it does not
reconcile PostgreSQL or run the import.

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

Preview must render public routes and keep signed-out `/me` behind the sign-in
boundary while remaining unable to persist private state: it has no app URL,
Shelf URL, or Auth cookie secret. A passing Preview build does not grant it
Production authority.

### 7. Declare the floor

Runtime-role credential rotation is a coordinated protected operation: set the
new password interactively, replace only that role's Vercel URL through the
protected prompt, redeploy, and smoke both general and Shelf data paths. Expect
new connections to fail between the password change and updated deployment;
use a bounded maintenance window. Do not change the role name or grants during
a credential-only rotation.

Record the rollback floor as the first exact application revision proven with
the restricted roles, together with the ledger through
`0046_fix_customer_request_signal_bridge.sql` and the passing audit. A failed
later application deployment may roll back only to that revision
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

## Linked market truth and Ops market health

`/ops/market-health` is the authenticated read-only view of the complete market
chain. Read it top to bottom: inventory owner, exact offers and history,
retailer/discovery review, physical-market evidence, Daily Desk, then public
projection health. An empty queue is not a successful refresh, a missing source
is not zero, and a recorded review item is not public evidence.

Two mutation owners write privacy-bounded receipts to the existing Upstash
store:

- `/api/cron/inventory` at minute 17 records `completed`,
  `completed-with-exceptions`, `no-due-work`, or `unexpected-failure` after its
  canonical offer/history work;
- `/api/cron/daily-desk-reconcile` at minute 42 records `accepted`,
  `already-current`, `no-current-candidate`, `disabled`, or
  `reconciliation-failed` after current-offer rebinding. An invalid current
  revision with no eligible replacement records `completed-with-exceptions`
  and bounded invalid/replacement counts.

Receipts contain owner, state, timestamps, fixed outcome code, aggregate counts,
deployment revision and TTL only. They never contain a product payload,
retailer URL, recipient, contact, customer or raw error. Receipt storage failure
before start returns HTTP 503 and prevents market mutation. A final settlement
failure also returns HTTP 503; canonical offer or Desk work that already
completed is not reversed.

Only the same still-`started` generation may settle. A repeated completion or
failure cannot overwrite a terminal receipt, owner-incompatible outcome codes
are invalid, and a future-dated receipt cannot establish current health. An
existing Daily Desk key must still resolve to a current-day `ready` projection
before the reconciler records `already-current`. The accepted evidence set must
equal the complete current exact-offer set; a newly current or removed offer
suppresses the old projection. The owner then archives a new immutable revision
and compare-and-sets the date pointer from the exact prior key; a concurrent
winner is re-read instead of overwritten. With no eligible replacement, the
projection stays suppressed and the exception remains open. A `disabled`
outcome always keeps the owner, Daily Desk layer and public projections in attention.

For an exception:

1. Open its native action from `/ops/market-health` and note the displayed
   source time, threshold, owner and fixed reason.
2. Check the latest natural Vercel run for that exact owner. Do not create a
   duplicate queue, claim, Desk acceptance or manual scheduler.
3. For inventory, use the authenticated `?dry-run` probe to inspect aggregate
   backlog without writes. For Daily Desk, verify the enablement gate and the
   current exact-offer eligibility; do not substitute the stored acceptance.
4. Repair only the named authentication, database, receipt-store, evidence or
   deployment fault. Let the next scheduled owner reconcile it.
5. Confirm a recent settled receipt and that the affected public route now
   projects the same current evidence. If the source remains unavailable, keep
   the exception open and public actions suppressed.

## Inventory cron fails

### Quick diagnosis

1. Probe the dry-run endpoint with the CRON_SECRET:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" \
     "https://www.jelocare.com/api/cron/inventory?dry-run"
   ```
   - **401 Unauthorized:** `CRON_SECRET` is missing, too short (< 16 chars),
     or not propagated to the deployment. See
     [Troubleshooting: CRON_SECRET too short](../catalogue/TROUBLESHOOTING.md#inventory-cron-is-not-running).
   - **500 "Runtime database access is unavailable":** The
     `jelocare_app_runtime` role is missing or `APP_DATABASE_URL` is not set.
     See
     [Troubleshooting: role missing / Neon integration override](../catalogue/TROUBLESHOOTING.md#inventory-cron-is-not-running).
   - **200 with `writesPerformed: 0`:** authentication and the read-only backlog
     query are operational. The probe never enqueues, claims, retries, alerts,
     invalidates caches, or syncs a static file. `backlog.due > 0` means the
     next scheduled non-dry run has due work. Its `capacity` object exposes the
     deployed cadence, batch limit, daily attempt slots, freshness target, and
     enqueue lookahead without starting a refresh.

2. Check the Neon database directly:

   ```sql
   SELECT count(*) FILTER (WHERE verification_expires_at <= now()) as expired,
          count(*) FILTER (WHERE verification_expires_at > now()) as fresh,
          max(last_verified_at) as most_recent
   FROM offers WHERE match_kind = 'exact' AND url ~* '^https://';
   ```

   If `most_recent` is more than 24 hours old and `expired > 0`, the cron has
   not been running.

3. Check the `inventory_refresh_jobs` table:
   ```sql
   SELECT status, count(*) FROM inventory_refresh_jobs GROUP BY status;
   ```
   An empty table means no jobs have been enqueued. The hourly cron's
   `enqueueDueInventoryOffers` step creates jobs for offers whose verification
   has expired or will expire within the one-hour lookahead window. A completed
   run reports `capacity.scheduledRunsPerDay`, `batchAttemptLimit`,
   `attemptSlotsPerDay`, `targetFreshnessHours`, and `enqueueLookaheadHours`;
   compare these values with the exact-offer population before changing cadence.

### Common failures

#### CRON_SECRET too short

`isAuthorizedCronRequest` in `modules/retail-intelligence/cron-auth.ts`
requires the secret to be at least 16 characters. A shorter secret causes
every cron request to return 401 before any database work begins.

**Fix:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" | vercel env add CRON_SECRET production
```

Then trigger a redeployment.

#### `jelocare_app_runtime` role missing

Migration `0035_runtime_database_roles.sql` expects the role to already exist
but does not create it. Without it, the exact-role probe fails and production
runtime database access remains unavailable.

**Fix:** Create the role in Neon and grant the required privileges (see
[§1 Rehearse and provision the runtime roles](#1-rehearse-and-provision-the-runtime-roles)
and migration `0035`).

#### Neon resource reconnected to Vercel

Connecting the owned `JeloCare` Neon resource to the Vercel project can recreate
an owner-bearing `DATABASE_URL`, violating the accepted runtime boundary.

**Fix:** Disconnect the resource from the Vercel project without deleting the
Neon resource. Restore the reviewed Auth names/scopes explicitly, set
`APP_DATABASE_URL` in Production with the probed `jelocare_app_runtime` URL,
remove `DATABASE_URL` and every owner alias, reset the former owner password,
then create fresh Production and Preview deployments. See
[NEON.md § Restricted Vercel runtime](../data/NEON.md#restricted-vercel-runtime-and-the-owned-neon-resource).

### After fixing

1. Trigger a redeployment so the new env vars are picked up.
2. Run the dry-run probe to confirm 200 and `writesPerformed: 0`.
3. Prefer the next scheduled minute-17 owner to process the backlog. Only when
   the incident has explicit protected manual-run authority, invoke the same
   owner once rather than creating a second worker:
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" \
     "https://www.jelocare.com/api/cron/inventory"
   ```
4. Verify that `run.completed > 0` and `run.failed === 0`.
5. Check the database for fresh verifications:
   ```sql
   SELECT count(*) FILTER (WHERE last_verified_at >= now() - interval '1 hour') as just_verified
   FROM offers WHERE match_kind = 'exact' AND url ~* '^https://';
   ```

### Incident: 2026-08-23 — inventory cron blackout

The inventory cron stopped producing fresh offer verifications. The daily
campaign selector rejected every product with `no-fresh-shareable-ng-offer`.
The Lagos Daily Desk showed the "Today's note is being checked" fallback.
98 of 158 catalogue products had zero Nigerian offers. 8 tests failed with
stale retailer data. See
[Troubleshooting: inventory cron failure](../catalogue/TROUBLESHOOTING.md#inventory-cron-failure--stale-offers-and-campaign-blackout-2026-08-23)
for the full diagnosis and recovery plan.

### Runtime diagnosis

1. Verify `CRON_SECRET` and the Authorization header.
2. Inspect the response or `inventory_refresh_cron_completed` log. `run`
   separates completed, retrying, deferred-daily-recheck, failed, discarded,
   lease-recovered,
   and deadline-stopped work. `run.failureReasons` contains only bounded reason
   counts: route scope, product identity, package size, market currency, fetch
   unavailable, incomplete evidence, runtime, claim changed, or eligibility
   changed. It never emits fetched content, credentials, URLs, titles, or error
   messages. `backlog` reports queued, due, processing, and lease-expired counts.
3. Check retailer response status, MIME type, size, redirects, and adapter.
4. Look for product or market scope rejection.
5. Let bounded retries and the two-minute processing lease handle transient
   fetch/runtime failures, missing title or size evidence, and unmeasurable
   observed size; do not create duplicate active jobs or manually reclaim an
   unexpired worker. A proven route/canonical, title, measurable size, catalogue
   expected-size, or market-currency contradiction fails closed immediately,
   expires the persisted database offer, and defers the same active job for one
   recheck per day. It also proposes an unavailable/expired static fallback on
   the configured review branch. Production is not fully fail-closed while that
   proposal remains unmerged or undeployed. Exhausted transient work is not
   hourly re-enqueued: the same job moves to the daily recheck cadence without
   offer invalidation.
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

## Inventory refresh sync paths

The inventory cron has four fetch strategies and one post-run sync step. Each is
opt-in or automatic, and each is designed to never cause unintentional
overwrites of higher-quality data.

### Phase 1: Browser fetch fallback (automatic)

`lib/inventory/browser-fetch.ts` — headless Chromium via `playwright-core`.

- **When:** a retailer host blocks server-side HTTP (e.g. Jumia/Cloudflare 403).
- **How:** launches a headless browser, navigates to the URL, extracts rendered HTML, and passes it through the same structured-data extraction as HTTP fetch.
- **No env vars required** — active whenever `playwright-core` is installed.
- **Lazy-loaded:** the browser binary never affects cold start when unused.
- **Safety:** returns HTML only; no DB writes, no extraction. The caller applies existing confidence-gated logic.

### Phase 2: AI Gateway extraction fallback (opt-in)

`lib/inventory/ai-extraction.ts` — Vercel AI Gateway structured extraction.

- **When:** Woo API, HTTP fetch, and browser fetch all fail or return no usable extraction.
- **How:** sends truncated page HTML (50k chars) to the AI Gateway with a strict Zod schema for price/stock/title/size.
- **Env vars:** `INVENTORY_AI_EXTRACTION=true` + `INVENTORY_AI_EXTRACTION_MODEL=<model-id>`.
- **Confidence:** 50 — lower than any other method; all accepted extraction
  layers now share the same 24-hour maximum freshness boundary.
- **Privacy:** zero data retention, no prompt training, no telemetry inputs/outputs.
- **Safety:** returns `undefined` if price is null or gateway is unavailable. Never writes to DB directly.

### Phase 3: Static file sync (opt-in)

`lib/inventory/static-file-sync.ts` — GitHub Contents API commit.

- **When:** after each cron run, if any offers were successfully refreshed.
- **How:** fetches `data/retail-offers.ts` from GitHub, applies targeted field-level diffs, commits via the Contents API.
- **Env vars:** `STATIC_FILE_SYNC_ENABLED=true` + `GITHUB_TOKEN=<pat>` + required `inventory-sync-review*` `GITHUB_REPO_BRANCH`; owner and repo are optional.
- **Anti-overwrite protections:**
  - Never touches offers with `verification_method = 'manual'`.
  - Never publishes `ai_extraction` or any observation below confidence 60.
  - Only updates if refreshed `last_verified_at` is strictly newer than the static offer's timestamp.
  - Carries retailer-page/API provenance and the actual verification expiry into the static offer.
  - Clamps retailer-page freshness to five days and retailer-API freshness to seven days.
  - Stops price changes above 35% for manual review.
  - Refuses every branch outside the `inventory-sync-review`, `inventory-sync-review-*`, or `inventory-sync-review/*` namespace; every proposed change lands on an explicit review branch.
  - Only updates `priceNgn`, `available`, `stock`, `observedAt`, `expiresAt`, and verification method — never `url`, `match`, `trust`, `variant`, `size`.
  - Post-update verification confirms all requested fields were actually changed.
  - For a typed terminal contradiction, proposes `available: false`,
    `stock: "unknown"`, and an immediate `expiresAt` while preserving the prior
    price, URL, title, size, observation time, and verification method. Exhausted
    transient failures never create this proposal.
  - Treats an already-applied unavailable/unknown/expired terminal projection
    as an idempotent safe skip rather than a sync error.
- **Failure mode:** returns error results, never throws. Enabled-but-invalid
  configuration produces `static_file_sync_misconfigured:<issue>`. A GitHub 404
  produces `static_file_sync_review_branch_not_found`, which means the configured
  review branch does not exist remotely. Rate limiting and network errors are caught.

### Phase 4: Idempotent static integration

`.github/workflows/inventory-static-integration.yml` owns routine integration
from the exact `inventory-sync-review` branch. A branch push starts it
immediately; an hourly schedule retries integration failures caused by a moving
`main` or interrupted runner. The schedule never calls the inventory endpoint,
queues work, claims a lease, retries an offer, or invalidates cache.

The workflow fetches full history for both refs and derives their exact merge
base. `inventory:static-proposal:merge` parses the merge-base, current `main`,
and proposal into exact-offer data trees instead of asking Git's text merger to
guess inside a large object. The original proposal must still have exactly one
changed path and an unchanged exact-offer denominator/order, and may contain
only the bounded price, availability, stock, observation, expiry, and
verification-method mutations produced by the static sync owner.

The learned deterministic conflict classes are:

- a proposal newer than unchanged matching identity is replayed onto current
  `main`, retaining independent offers and current protected metadata;
- current evidence with a newer observation time supersedes a stale proposal;
- a deliberate exact-offer removal on current `main` supersedes its stale
  refresh or invalidation;
- an already-applied proposal is an idempotent no-op;
- changed URL, retailer, trust, variant, size, ambiguous identity,
  same-timestamp disagreement, or malformed history fails closed.

`inventory:static-proposal:validate` then proves the resolved current-to-result
delta again. A passing revision receives the shared release verification,
research-integrity check, and a build with database migrations disabled.

The final push advances `main` and resets `inventory-sync-review` to the same
gated revision atomically, guarded by exact leases for both observed refs. If
either ref moved, neither advances. Do not manually merge a passing routine
proposal. Open a bounded product/platform exception only when the validator,
history resolver, GitHub branch rule/token, release gate, deployment, or
production smoke reports a concrete failure.

If that recurring workflow fails, the native red Actions run and its exact
failing step are the repository-internal operator signal. Automatic public
issue creation and external paging remain unconfigured pending explicit
action-time publication authority; do not publish an incident around the red
gate without that authority.

### Independent inventory health watchdog

`/api/cron/inventory-health` runs hourly at minute 7, separately from the
minute-17 inventory processor. It authenticates with the same cron boundary,
executes aggregate `SELECT` queries only, and reports recent completion,
failure, deferred-recheck, backlog, expired-lease, and stale-offer counts. A
missed state, five or more deferred rechecks, expired leases, or degraded
freshness emits `inventory_health_watchdog_checked` and returns HTTP 503 so the
scheduled run is visibly unhealthy. It never calls the queue, claim, retry,
cache, alert-email, or static-sync paths. Deferred aggregates select only
`last_error` values prefixed with `inventory_refresh_daily_deferred:<reason>:`;
ordinary short-retry errors are excluded.

### Clinical care-evidence review owner

`/api/cron/clinical-review-health` runs daily at 05:53 UTC. It authenticates
with the shared cron boundary, reads only checked-in public catalogue and care
records, and returns `private, no-store`. It performs no database, queue,
notification, cache, care-state, recommendation, approval or patient action.

The successful event is `clinical_review_health_checked`. Its bounded log
contains the schema version, status, manifest digest, aggregate care-state and
reason counts, and `writesPerformed: 0`; product slugs and practitioner details
remain out of runtime logs. `attention_required` is an ordinary HTTP 200 state:
it means a deterministic human-review plan exists. HTTP 500 with
`clinical_review_health_failed` means the static plan itself could not be
generated and is the scheduled-owner failure signal.

The private response includes each exact public slug, its care/evidence digest,
stable idempotency key and reason codes. Repeated identical inputs produce the
same keys. A named licensed clinician, not the scheduler, evaluates and signs
an exact versioned review. Do not manually invoke the route to clear or replay
an item; inspect the next natural run and open a bounded platform exception
only when authentication, routing, deployment identity or plan generation
fails.

Current v1 reason codes are:

- `missing_care_cell`;
- `invalid_review_date`;
- `unattested_pharmacist_context`;
- `legacy_attestation_requires_credential_binding`;
- `supportive_review_requires_credential_binding`;
- `missing_source`;
- `missing_verified_ingredients`; and
- `insufficient_evidence`.

This scheduled owner does not change the accepted non-diagnostic Ask boundary.
The human consultation and diagnosis contract is [ADR 0018](../adr/0018-clinician-led-consultation-and-diagnosis.md).

### Diagnosing sync issues

1. **Check the cron response** for `staticFileSync` in the JSON output:

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" \
     "https://www.jelocare.com/api/cron/inventory"
   ```
   - `staticFileSync.committed: true` — a commit was made to `data/retail-offers.ts`.
   - `staticFileSync.invalidated` — number of terminal-contradiction fallback
     invalidations included in the review-branch proposal.
   - `staticFileSync.errors` — stable configuration/GitHub reason codes plus
     bounded parse failures. `missing_review_branch` means the variable is
     absent; `invalid_review_branch` means it is outside the protected namespace;
     `static_file_sync_review_branch_not_found` means the named safe branch is
     syntactically valid but absent from GitHub.
   - `staticFileSync: null` — sync is disabled or no offers were refreshed or
     invalidated.

2. **Check the `Integrate inventory static proposal` workflow** for the review
   commit. A green run means the semantic offer guard, release gates, build, and
   atomic ref advancement passed. A red run is an exception to diagnose; do not
   duplicate the cron or manually merge around it. Never configure static sync
   against `main`.

3. **Check the GitHub commit history** for sync commits:

   ```bash
   git log --oneline --grep="sync:" -- data/retail-offers.ts
   ```

4. **Check AI extraction** by looking for `verification_method = 'ai_extraction'` in the database. These rows must never appear in a static-sync commit:

   ```sql
   SELECT retailer_id, price_minor, last_verified_at, verification_expires_at
   FROM offers WHERE verification_method = 'ai_extraction';
   ```

5. **Check browser fetch** by looking for Jumia offers that are now fresh:
   ```sql
   SELECT o.url, o.price_minor, o.last_verified_at, o.verification_expires_at
   FROM offers o
   JOIN retailers r ON r.id = o.retailer_id
   WHERE o.url ~* 'jumia\.com\.ng'
     AND o.verification_expires_at > now();
   ```

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

### Promote a physical-only canonical retailer

Use this bounded operator only when reviewed physical-market work needs a
canonical retailer parent and there is no admissible exact online offer. If an
exact product-level online offer exists, admit it through the catalogue
publication release and `db:reconcile`; that established projection creates or
updates its retailer together with the reviewed offer evidence. This physical
path must not be used to bypass that release.

The input must be an active, custom `retailer-identity` research task in
`assigned` state and assigned to the acting admin; `blocked` and `retry` tasks
cannot create a retailer. Claim or assign that exact task through the existing
`community:moderate` workflow first. A current retained, non-rejected task
mention is checked from source rows at execution time; the materialized
`signal_count` alone is not evidence. Keep a private version-1 manifest and its
evidence artifact outside the repository. The manifest binds the task ID,
original task reference and label; an exact normalized identity match or an
explicit reviewed alias mapping; exact retailer ID, slug, name, and reviewed
integer trust score; review rationale and time; and one current identity source,
PII-free opaque `private-ledger:<canonical lowercase non-zero UUID>` source
reference, absolute artifact path,
expected SHA-256, observation time, and expiry. A source reference is a lookup
key only; never place a URL, magic link, contact detail, credential, or raw
evidence in it. Allowed identity sources are `field_visit`,
`retailer_confirmation`, `branch_online_record`, and
`partnership_application`.

Set `provenance.researchTask.identityBinding.method` to
`exact-normalized-task-identity` only when the stored custom reference maps to
the proposed slug and the stored label maps to the proposed name after
normalization. Otherwise use `reviewed-alias` and include the exact stored
`taskAlias`, proposed `canonicalName`, and a bounded mapping `rationale`; the
operator verifies those redundant bindings instead of accepting a free task-to-
retailer pairing. The opaque source reference must match exactly
`private-ledger:<canonical lowercase non-zero UUID>`; URI-, contact-, and
path-like values fail validation.

The existing `retailers.trust_score` column is non-null and has no unrated
state. This operator therefore refuses a missing or out-of-range score. Do not
invent a neutral value: if the retained evidence and rationale do not support an
explicit reviewed `0`–`100` score, canonical retailer creation remains blocked.
The score, evidence digest, and every identity input are bound into the manifest
fingerprint.

Both this operator and the catalogue seed path acquire the same
transaction-scoped canonical-retailer identity lock before identity reads or
writes. Promotion uses explicit `READ COMMITTED`, takes the blocking lock as its
first statement, and performs identity reads afterward so a concurrent writer's
committed identity is visible before the case-insensitive conflict check.

For a proposed create, the evidence artifact path must be absolute, outside the
repository, point directly to a non-empty regular file rather than a symlink, be
no larger than 32 MiB, and still hash to the declared lowercase SHA-256. The
operator recomputes those bytes before returning a create dry run or writing an
apply. It never prints or stores the artifact path or artifact contents. The
private resolution and audit retain the source reference and verified digest;
command output omits them, the rationale, database URL, and admin identity.

Run the read-only preflight first:

```bash
MIGRATION_DATABASE_URL='postgresql://protected-admin@direct-host/database' \
MODERATION_OPERATOR_EMAIL=admin@example.invalid \
npm run market-finder:retailer:promote -- \
  --manifest=/absolute/private/canonical-retailer.json
```

Review the bounded ID, slug, name, trust score, research-task outcome, and
`writes:false` plan. Then repeat the exact command with `--apply`. Apply requires
the protected direct database URL and exactly one active admin. One atomic
`READ COMMITTED` transaction inserts only the canonical retailer, records the
existing `existing-canonical-retailer` private resolution, closes and clears
the task, and appends `community_research_task` / `promote` audit with
`canonical_write=true`. The resolution remains correctly marked
`canonical_write=false` and `private-research-only`; the audit is the distinct
record of the canonical retailer write.

An exact rerun is a no-op only when the retailer identity and score, private
resolution, closed task, and canonical-write audit all match the manifest
fingerprint. Once that complete triad is proved, the no-op does not depend on a
later materialized signal count, evidence freshness, or retained artifact. Any
partial state, extra conflicting task-promotion audit, or conflict on retailer
ID, slug, case-insensitive name, or trust score stops without repair or update.
This operator never creates or changes an offer, price, market, place, retailer
location, channel, physical stock observation, or retailer application. After a
successful promotion, run the separate Market Finder location onboarding below
when its reviewed location evidence is ready. Exact-product evidence is
additionally required only when the onboarding manifest includes an initial
stock observation.

### Market Finder physical evidence

A Market Finder community report remains a private claim even after its typed
child review. It never becomes a shelf observation automatically. Only an active
admin using the protected, direct `MIGRATION_DATABASE_URL` may append physical
product evidence, and every appended observation starts in `pending` review.

Before the first report can exist, onboard one canonical pilot location with a
private version-1 JSON manifest. The manifest must bind an existing canonical
retailer to the reviewed market, optional place, location-identity evidence,
and either reviewed text directions or one verified public channel. A
location-only manifest omits both `product` and `initialObservation`; it creates
no product relation or availability claim. If the manifest includes one
attributable `initialObservation` from `field_visit`,
`retailer_confirmation`, or `branch_online_record`, it must also bind the exact
active published product identity. That observation is inserted as `pending`,
never approved by onboarding. Do not use fixture names, disputed landmarks,
search results, map results, or an unresolved "beside" description.

Run the read-only preflight first, using a manifest outside the repository:

```bash
MIGRATION_DATABASE_URL='postgresql://protected-admin@direct-host/database' \
MODERATION_OPERATOR_EMAIL=admin@example.invalid \
npm run market-finder:onboard -- \
  --manifest=/absolute/private/market-finder-pilot.json
```

Review the bounded plan. It prints canonical IDs and planned states, not source
references, directions, contact destinations, or rationale. Repeat the exact
command with `--apply` only after the manifest and target database are accepted.
The serializable transaction creates pending/lead rows first, applies the
reviewed location decisions in trigger-safe order, appends the optional first
product observation as `pending`, and writes attributable audit events. An exact
rerun is a no-op; a conflicting canonical row stops the transaction. Use the
observation ID returned by a plan that includes `initialObservation` with the
separate `decide` command below. A location-only plan has no observation to
decide.

Record one exact product/place observation with a dry run first:

```bash
MIGRATION_DATABASE_URL='postgresql://protected-admin@direct-host/database' \
MODERATION_OPERATOR_EMAIL=admin@example.invalid \
npm run market-finder:evidence -- record \
  --contribution-id=00000000-0000-4000-8000-000000000000 \
  --availability=in_stock \
  --observed-at=2026-09-01T12:00:00.000Z \
  --expires-at=2026-09-08T12:00:00.000Z \
  --source-method=retailer_confirmation \
  --source-reference='private evidence reference' \
  --observed-title='Exact reviewed product title' \
  --observed-size='50 ml' \
  --price-ngn=12500 \
  --rationale='Why this evidence is attributable to the exact shop and pack.'
```

Review the bounded `writes:false` result, then repeat the identical command with
`--apply`. The insert and its `physical_product_observation` audit event share
one transaction; raw source evidence is not printed. Omit `--price-ngn` when no
price was directly observed.

An inserted observation still cannot appear publicly. A separate active admin
must dry-run and then apply its decision:

```bash
MIGRATION_DATABASE_URL='postgresql://protected-admin@direct-host/database' \
MODERATION_OPERATOR_EMAIL=admin@example.invalid \
npm run market-finder:evidence -- decide \
  --observation-id=00000000-0000-4000-8000-000000000000 \
  --decision=approve \
  --rationale='Exact product, place, source and freshness window verified.'
```

Use `--decision=reject` when the evidence is not publishable. The locked
pending-to-terminal transition writes reviewer attribution and an audit event in
the same transaction. Its applied result returns only the observation ID, next
status and bounded market/location/product cache scope.

Do not apply onboarding or evidence commands until migration
`0053_physical_market_finder.sql`
has passed the protected production migration gate and canonical market,
location, place, channel and location-evidence rows have been separately
reviewed. Do not enable report intake until follow-on migration
`0054_market_finder_report_current_context.sql`, canonical SHA-256
`62081dd7c9936c6a4e1d25f1ff39cf0c9e63d757f8d0b25ad61ea4f2234c1e7f`,
and correction migration `0055_market_finder_atomic_context.sql`, canonical
SHA-256
`e0a5e58ee2e39f54976031d5afc64d9e8a966e76cfe116e5130b2fd5d2bdc22d`,
have both passed that protected production gate. Migration `0055` preserves
the original reviewer attribution when evidence is superseded and makes report
validation and all eight current-context table mutations share one transaction
lock. The application report transaction is explicitly READ COMMITTED; the
database rejects report insertion at another isolation level.

The exact `0055` bytes were rehearsed on 2026-09-02 in Neon project
`spring-field-93817903`, fresh production-derived branch
`rehearsal/market-finder-atomic-context-20260902`
(`br-long-silence-avkudczf`, expiring `2026-09-09T23:59:59Z`). The first run
applied `0053`, `0054`, and `0055`; the second skipped all three unchanged, and
`0055` was then promoted unchanged.
Rollback-safe acceptance preserved evidence and observation attribution,
confirmed all eight context-lock triggers and both blocking directions,
rejected a non-READ-COMMITTED report transaction, and left zero synthetic rows.
On 2026-09-02 the protected production runner applied `0053`, `0054`, and
`0055` in canonical order with their exact rehearsed hashes. Post-apply status
reported a governed immutable ledger with 56 applied, zero pending, and zero
drift; the idempotent rerun skipped all three unchanged. Production acceptance
found all seven tables, all 21 core triggers, all eight context-lock triggers,
and the expected restricted runtime grants. A separate location-only operation
then published the `trade-fair` market and verified Nectar Beauty Hub's
Tradefair outlet without creating any product relation, price, or stock
observation. Public readiness remains fail-closed at
`directory-empty:no-approved-observation`, and public reads and report intake
remain gated. Keep
`MARKET_FINDER_PUBLIC_READ_ENABLED=false`,
`MARKET_FINDER_PUBLIC_MARKET_SLUG` unset, and
`MARKET_FINDER_REPORT_INTAKE_ENABLED=false` through migration, data onboarding,
observation approval, abuse checks, and operator acceptance. Before changing
either public-read variable, place both the protected direct administrator URL
and the restricted `jelocare_app_runtime` application URL in the operator
process without writing either credential to shell history, then run the
bounded production-data preflight from an authenticated `neonctl` session:

```bash
npm run --silent market-finder:readiness
unset MIGRATION_DATABASE_URL APP_DATABASE_URL
```

The command first binds both credentials through Neon's read-only control plane
to the repository-owned production project, primary/default branch, `neondb`
database and enabled endpoint. The administrator connection reads only the
governed migration ledger. Product and location reads authenticate separately
as the exact application runtime role inside one repeatable-read, read-only
snapshot, so owner authority cannot mask a runtime grant failure and a
concurrent catalogue change cannot create a torn pass.

It exits `2` unless migrations `0053`–`0055` are applied unchanged and the
`trade-fair` directory contains only exact published product identities whose
current reads each have at least one usable reviewed location. Product media is
resolved through the canonical public catalogue, with exact slug, brand,
variant, and size equality. A missing or mismatched catalogue product is
reported as unavailable media and renders the native image-unavailable state;
it does not block public reads. Output contains only fixed status labels,
public product slugs and bounded counts; unexpected failures emit one generic
message. A catalogue match does not prove that the deployed asset loads, so the
command deliberately reports `asset-delivery=not-assessed`. Before calling the
release live, use the production browser to verify every matched image
preserves the native transparent presentation and every unmatched product shows
the native unavailable state.
`public-read-data-ready=true` does not approve activation:
founder pilot approval is still required, and the command also reports
`report-intake=not-assessed` because privacy, abuse and Ops acceptance remain a
separate human gate.

After that preflight and approval, set the public market slug to exactly
`trade-fair` and enable public reads for the read-only smoke. Enable report
intake only after that smoke and its separate abuse/Ops acceptance. Create,
save, and submit all close when the report flag is false. While public Market
Finder reads remain inactive, no cache purge is needed: both the route and
repository gates return before cached reads, and the first activated revision
has no older Market Finder cache to clear. For every
later approved evidence, location, or public-action change while reads are live,
verify that the applied command returned `cacheScope.marketSlug` equal to the
reviewed `trade-fair` pilot, then hard-delete the shared market tag from the
linked Vercel project:

```bash
vercel whoami
vercel cache dangerously-delete \
  --tag market-finder:market:trade-fair \
  --project jelo \
  --yes
```

The directory and every exact-product read in that market share this tag. Do
not use `vercel cache invalidate`, which may serve stale data while it
revalidates. Do not use the global `market-finder` tag or `vercel cache purge`.
After deletion, smoke `/markets`, the affected exact-product result, and its
shop record. Never derive a tag from contributor text or use a community report
as canonical location or stock data.

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

For initial Hostinger and Neon Auth setup, read
[Custom authentication email](./CUSTOM_AUTH_EMAIL.md). This runbook starts
after the signed webhook and provider configuration exist.

1. Confirm the application saved before retrying email.
2. Check `GET /api/auth-hooks`; `emailDeliveryConfigured` confirms only that a
   recognized provider credential is present. It does not prove authentication,
   provider acceptance, queue completion, or mailbox receipt, and exposes no
   provider or credential detail.
3. Check `EMAIL_PROVIDER`, sender address, and Production/Preview scope.
   `hostinger-api` uses a configured SMTP mailbox password automatically only
   when the API failure proves that no message was accepted.
4. For `hostinger-api`, confirm `EMAIL_API_TOKEN` is a mailbox-scoped Agentic
   Mail token and that `/api/v1/me` includes the sender.
5. Confirm `EMAIL_SMTP_PASSWORD` is the mailbox password, not an API token,
   when SMTP-only or API-first resilience is expected.
6. Use the resend endpoint only within its rate limit. Do not retry an
   ambiguous API network, timeout, or 5xx send as SMTP; that could duplicate a
   message already accepted by the provider. A Hostinger 2xx is also accepted,
   even if the delivery log still says `Delivering`; inspect the delivery log
   or recipient mailbox rather than sending a second copy.
7. Do not print the private link, OTP, token, password, or provider exception in
   logs.

The application can remain saved even when delivery reports `failed` or `unavailable`.

## Secret exposure

1. Revoke or rotate the credential immediately.
2. Remove it from current files and output.
3. Assess Git history, build logs, screenshots, and copied artifacts.
4. Replace it in every required environment scope.
5. Redeploy and exercise the dependent feature.
6. Add a prevention check if the exposure route was repeatable.
