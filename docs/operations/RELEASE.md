# Release process

Updated: 2026-08-03

Release small, auditable changes. A push is not complete until CI and the exact production deployment are verified.

## Branches

- `main` is the active Vercel application branch.
- `pages-v1-static` preserves the earlier GitHub Pages release.
- `feature/jelocare-platform` is historical feature work.

Do not rewrite or repurpose `pages-v1-static`. GitHub Pages history is separate from the active application.

Use a `codex/` or focused feature branch for reviewable work unless direct `main` delivery is explicitly authorized. Never force-push shared branches.

## Before editing

```bash
git status --short
git fetch origin
git pull --ff-only
```

Preserve unrelated local changes. Do not stage another lane's work.

## Commit

One commit should explain one outcome.

```text
feat(catalogue): release exact product
fix(retail): reject mismatched offer scope
docs(ops): add Neon recovery guide
```

Before staging:

```bash
git diff --check
git diff --stat
```

Stage explicit paths. Review the staged patch. Never stage `.env*`, `.vercel/`, `.cache/`, database dumps, or private captures.

## Required validation

At minimum:

```bash
npm run verify:release
npm run build
```

`verify:release` is the shared, non-building preflight for CI and production.
It runs lint, typecheck, all Node tests, documentation checks, catalogue
publication and research checks, publication image verification, and canonical
asset verification. Run every additional domain gate touched by the change.
Private research packet and retained response integrity is deliberately separate:
run `npm run verify:research-integrity` for research changes. CI runs it as an
independent check, but Vercel production deploys do not, so unrelated mutable
research captures cannot block a reviewed public release.
Catalogue publication requires the full sequence in
[Catalogue operations](../catalogue/OPERATIONS.md).

## CI

`.github/workflows/validate.yml` runs on pull requests and pushes to `main`.

The validation job runs:

1. `npm ci`
2. the shared `verify:release` preflight
3. the separate private `verify:research-integrity` check
4. the non-production Next build path, which has no database mutation steps

A second job installs the hash-locked Python 3.12 CPU runtime and verifies the exact-SKU packshot operator.

Do not merge around a red gate. Read the exact failing log.

## Vercel

Production builds run through `scripts/vercel-build.ts`.

```text
release verification
  -> next build
  -> promote staged assets
```

Production verification and the Next build must both pass before staged Blob
promotion can mutate external state. Vercel never receives
`MIGRATION_DATABASE_URL` and never applies migrations, seeds or database
reconciliation. Those are explicit protected operator jobs completed before a
dependent application deployment. Preview and local builds stay on the fast
Next-only path. CI runs the shared preflight explicitly and does not mutate
external state.

## Customer Shelf release checklist

This order is mandatory for the first private Shelf activation. The detailed
commands and evidence queries live in
[Release the Customer Shelf boundary](./RUNBOOKS.md#release-the-customer-shelf-boundary);
[ADR 0014](../adr/0014-customer-shelf-data-boundary.md) owns the security and
lifecycle decision. A passing local build does not waive the production-shaped
rehearsal or the release authority's explicit decision about which connected
Neon and Vercel resources may be used.

1. **Provision.** On the intended production database, create
   `jelocare_app_runtime` and `jelocare_shelf_runtime` as `LOGIN NOINHERIT
   NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` with
   `PASSWORD NULL`. Set two independent passwords interactively through the
   protected secret channel; never place either password in SQL, source,
   history, logs, or evidence.
2. **Migrate and reconcile.** From the protected operator boundary, inject the
   direct administrator `MIGRATION_DATABASE_URL` and run `npm run
   db:reconcile`. Require the ordered ledger through
   `0034_customer_shelf.sql`, `0035_runtime_database_roles.sql`, and
   `0036_customer_product_requests.sql` plus the
   reviewed public catalogue and asset-metadata reconciliation required by that
   exact revision. Do not run the Shelf import yet or opt into external
   discovery.
3. **Run the acceptance audit.** On a production-shaped rehearsal branch first,
   then production, prove the migration ledger, exact role attributes, that
   neither runtime belongs to another role or owns a relation, grants and
   denials, forced RLS, denial with missing subject context, and the reconciled
   catalogue identity versions. On the selected rehearsal branch, run `npm run
   customer:shelf:audit` followed by `npm run customer:shelf:audit --
   --exercise-rollback` to prove exact runtime attestation and rolled-back two-
   owner isolation. In production, run the read-only attestation; run the
   rollback exercise only if the release authority explicitly accepts its
   transient writes and forced rollback. Record counts and pass/fail evidence,
   never URLs, passwords, mailboxes, or subjects.
4. **Import dry run before activation.** Keep the interactive Shelf revision
   undeployed and its restricted URLs out of Vercel. At the protected operator
   boundary, inject
   `MIGRATION_DATABASE_URL` and `JELOCARE_SHELF_IMPORT_OWNER_SUBJECT`, then run
   `npm run customer:shelf:import`. Require a read-only result of 14 complete
   dispositions, five exact accepted identities, nine pending requests, and no
   fully reconciled receipt.
5. **Import apply and verify its receipt.** Independently derive and compare the
   owner-addressed import receipt SHA-256, then repeat with `--apply` and the exact
   `--confirm-receipt-sha256` value. Apply takes a brief Shelf/request write lock. Require
   its actual inserted identity set to equal the dry-run plan and the final
   pending set to contain all nine private requests. A fresh import must have
   all five exact accepted identities. An upgrade from the earlier five-item
   receipt must add no accepted identities and reports the current surviving
   accepted count after customer removals instead. Require one atomic one-off
   receipt. Do not activate Shelf until the receipt is independently verified.
6. **Normalize and probe the restricted runtime URLs.** Each postgres.js URL
   must use `sslmode=verify-full` and omit the unsupported
   `channel_binding=require` parameter. Through postgres.js, prove the general
   URL logs in with exact `current_user = session_user = jelocare_app_runtime`;
   run the read-only Shelf attestation against the Shelf URL. Do not print a URL.
7. **Configure restricted Vercel runtime environment.** Only after the probes
   pass, set `DATABASE_URL` to the app-role URL and
   `CUSTOMER_SHELF_DATABASE_URL` to the Shelf-role URL. If `POSTGRES_URL` is
   retained, apply the same driver and exact-role requirements. Remove
   `MIGRATION_DATABASE_URL`, the database-owner URL, unpooled owner aliases,
   split `POSTGRES_*`/`PG*` owner fields, and the one-off import subject. Verify
   names and usernames without printing values.
8. **Deploy and activate.** Push the verified revision and require CI success
   plus the exact Vercel deployment at `READY`. Vercel may verify, build, and
   promote reviewed staged public assets; it must not reconcile PostgreSQL or
   run the import.
9. **Smoke.** Through the exact production deployment and one verified account,
   prove sign-in, Shelf read/add/reload/remove, missing-product create/edit/
   delete, private-photo owner isolation, JSON export, the clear
   confirmation flow, sign-out isolation, and the public reporting helper. Do
   not clear the imported launch Shelf merely for smoke; exercise the destructive
   result only with an approved disposable account. Confirm Synthetic Amara is
   absent and Routine/Concern persistence is absent.
10. **Rotate the former owner.** Rotate or revoke every owner/admin credential
   that Vercel previously held, remove any provider integration that can
   reconstruct it, and re-run restricted runtime and production smoke checks.
   Keep only the protected operator copy of `MIGRATION_DATABASE_URL`.
11. **Declare the rollback floor.** Record the exact compatible application
    revision, the ledger through `0036`, the two runtime role names, and the
    passing audit. Older owner-dependent deployments are no longer rollback
    candidates.

Failed private product-request Blob deletions are drained only through the
protected, bounded `customer:product-request-blobs:drain` operator with
`MIGRATION_DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`; it is dry-run by default
and requires explicit apply confirmation. This release creates no cron and
changes no inventory schedule, queue, lease, worker, scheduled owner, or
manual-observation workflow.

## After push

1. Confirm the pushed commit SHA.
2. Inspect GitHub Actions for that SHA.
3. Inspect the Vercel deployment created from that SHA.
4. Wait for `READY`.
5. Confirm the custom domain points to that deployment.
6. Exercise the changed journey in production.
7. Check console, network, data freshness, and visual behavior.
8. Record any rollback or follow-up need.

For a catalogue release, search the product, open its page, inspect the packshot, open retailer options, and verify every displayed price and size.

## Rollback

- Prefer a forward fix for database and manifest changes.
- A Vercel deployment rollback does not reverse a migration.
- Do not use `git reset --hard` or rewrite shared history.
- If application code must roll back while schema remains forward, confirm backward compatibility first.
- If a new public product is wrong, remove exposure through a reviewed forward change while preserving the evidence trail.
- After the Shelf rollback floor is declared, deploy only revisions compatible
  with `jelocare_app_runtime` and `jelocare_shelf_runtime`. Never restore the
  owner credential to make an older deployment work.
- The current Shelf boundary has no separate recovery-only export/delete mode.
  It also has no activation flag. Disable behavior through a reviewed role-
  compatible release; removing `CUSTOMER_SHELF_DATABASE_URL` is an emergency
  total fail-closed action that disables all Shelf access, including export and
  clear. Preserve rows and forward-fix instead of promising those controls
  remain available while the connection is disabled.
