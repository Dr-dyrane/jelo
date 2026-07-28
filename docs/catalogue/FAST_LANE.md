# Catalogue fast lane

Updated: 2026-07-28

Use this lane for a routine exact-SKU addition that follows the already proven
catalogue contract. Faster means removing repeated global verification, not
removing identity, price, care, or image evidence.

## Default operating mode

1. Take the highest-priority community or research candidate.
2. Reuse the nearest released SKU as the structural example.
3. Finish one exact product from source candidate through release.
4. Commit that product as one atomic change directly to `main`.
5. Push, then take the next candidate.

Do not open a PR for a routine data-only SKU. Use a PR when the change alters a
shared schema, publication gate, security boundary, migration, or runtime
contract.

## Token and agent budget

- The primary operator owns the routine SKU from start to finish.
- Do not spawn an agent merely to repeat a known candidate, dossier, release,
  or image pattern.
- Use at most one bounded research agent when an official identity, retailer
  page, or source artifact is genuinely unresolved. Stop the lane when the
  requested evidence returns.
- Read the candidate, its retained evidence, the closest released exemplar, and
  the enforcing verifier. Do not reread broad history or unrelated ADRs for
  every product.
- Prefer deterministic status and verifier output over prose summaries:
  `npm run catalogue:pipeline:status`, `npm run catalogue:intake:audit`, and
  the checked-in manifests.

## Per-SKU checks

For a data-only product, run the smallest checks that cover the changed
contract:

```bash
git diff --check
npm run catalogue:intake:verify
npm run catalogue:publication:releases:verify
```

Run `npm run catalogue:publication:images:verify` when a new publication image
is uploaded or its binding changes. Run the release command as a dry run before
using `--write`.

Do not rerun the full lint, type, test, and production-build suite after every
routine SKU. Run `npm run verify:release`:

- after a small batch of three to five data-only SKUs;
- before a production milestone or handoff;
- whenever shared code, schema, security, migrations, or publication logic
  changes; or
- when a focused verifier exposes an unexpected failure.

CI remains the independent full check after a direct push.

## Never fast-path these decisions

Stop and resolve the evidence when:

- manufacturer identity, variant, size, or package is ambiguous;
- a retailer listing does not bind the exact product, current NGN price, and
  stock state;
- care copy exceeds the reviewed supportive-care boundary;
- image rights, label fidelity, alpha, or package integrity are uncertain;
- a source or artifact hash changed unexpectedly; or
- progress would require weakening a publication gate.

NAFDAC context can guide research but is not a publication blocker.

## Commit boundary

One product commit may include its:

- per-SKU intake source and deterministic projection;
- retained official and retailer evidence;
- identity extraction and crosswalk;
- owned or permitted packshot and promotion record;
- dossier and explicit release;
- narrow product fixture or test updates required by that release.

Keep framework work, bulk discovery refreshes, and unrelated UI changes out of
that commit. If a direct push is wrong, revert the atomic product commit rather
than repairing multiple products in place.

## Keep this lane current

When a repeated manual step becomes deterministic, or history proves a smaller
verification set is sufficient for a routine data-only SKU, update this file
in the same commit. If the publication contract itself changes, update
[Catalogue operations](./OPERATIONS.md) and the
[Catalogue publication gate](../CATALOGUE_PUBLICATION_GATE.md) instead of
quietly changing this fast lane.
