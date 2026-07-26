# Release process

Updated: 2026-07-23

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
Catalogue publication requires the full sequence in
[Catalogue operations](../catalogue/OPERATIONS.md).

## CI

`.github/workflows/validate.yml` runs on pull requests and pushes to `main`.

The validation job runs:

1. `npm ci`
2. the shared `verify:release` preflight
3. build with migrations disabled

A second job installs the hash-locked Python 3.12 CPU runtime and verifies the exact-SKU packshot operator.

Do not merge around a red gate. Read the exact failing log.

## Vercel

Production builds run through `scripts/vercel-build.ts`.

```text
release verification
  -> next build
  -> promote staged assets
  -> apply pending migrations
  -> optional one-time catalogue seed
  -> seed product asset metadata
  -> seed editorial asset metadata
```

Production verification and the Next build must both pass before staged Blob
promotion, migrations, or seeds can mutate external state. This protects
production even when Vercel receives a commit before GitHub Actions finishes.
Preview and local builds stay on the fast Next-only path. CI runs the shared
preflight explicitly and does not run migrations.

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
