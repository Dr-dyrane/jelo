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
# After the release write, rebuild the public search projection.
npm run catalogue:search:build

# Remove the released identity from the private research queue and refresh its
# deterministic evidence-packet shard.
npm run catalogue:research:build -- --write
npm run catalogue:research:packets -- --shard <owning-shard> --write

git diff --check
npm run catalogue:intake:verify
npm run catalogue:publication:releases:verify
npm run catalogue:search:verify
npm run catalogue:research:verify
npm run catalogue:research:packets:verify
npm run catalogue:research:offers:verify
```

Run `npm run catalogue:publication:images:verify` when a new publication image
is uploaded or its binding changes. Run the release command as a dry run before
using `--write`.

Never omit the projection rebuilds. The release manifests and public catalogue
can be current while the checked-in search artifact is one product behind or
the private queue still asks agents to research an identity that was released.
If rebuilding the queue changes the packet plan, create a new content-addressed
packet shard and recapture only the affected retailer responses before
publication. Earlier shard and capture sources remain immutable. The compiled
projections must then be reconciled to the new source hashes and proved with
`catalogue:research:offers:verify`.

Do not rerun the full lint, type, test, and production-build suite after every
routine SKU. Run `npm run verify:release`:

- after a small batch of three to five data-only SKUs;
- before a production milestone or handoff;
- whenever shared code, schema, security, migrations, or publication logic
  changes; or
- when a focused verifier exposes an unexpected failure.

CI remains the independent full check after a direct push.

## Choose the identity route before building the candidate

- Use a manufacturer-published GTIN when the official source binds it to the
  exact variant, size, and current package.
- When the official source publishes the exact product but no GTIN, the
  independently corroborated GTIN route is valid only when two reviewed,
  candidate-scoped sources agree on the identifier and exact variant/size.
  Adding those URLs to the candidate corroboration allowlist is an evidence
  admission, so run the full release verification once for that change.
- Use the manufacturer-SKU route only when current retailer responses can bind
  the official manufacturer variant under that route's exact title, brand,
  size, and package contract.
- Do not rewrite the official variant, pretend a retailer SKU is a manufacturer
  identifier, or relax a title matcher to rescue one product. Preserve the
  candidate as blocked and move to the next lane when neither route is proven.

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
