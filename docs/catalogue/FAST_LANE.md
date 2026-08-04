# Catalogue fast lane

Updated: 2026-08-04

Use this lane for a routine exact-SKU addition that follows the already proven
catalogue contract. Faster means removing repeated global verification, not
removing identity, care, rights, provenance, or final-image evidence. Missing
current Nigerian price or store evidence is an enrichment constraint, not a
reason to keep an otherwise verified product private.

## Default operating mode

1. Take the highest-priority community or research candidate.
2. Reuse the nearest released SKU as the structural example.
3. Finish one exact product from source candidate through release.
4. Commit that product as one atomic change directly to `main`.
5. Push, then take the next candidate.

Do not open a PR for a routine data-only SKU. Use a PR when the change alters a
shared schema, publication gate, security boundary, migration, or runtime
contract.

## Multi-product fast lane

For two or more requested products, use one parent lane with five bounded
subdepartments. Do not give the whole batch and repository history to one
worker.

| Subdepartment | Owns | Finishes when |
| --- | --- | --- |
| Identity/evidence | Exact brand, variant, size, package form, manufacturer identifier, retained source digest | One exact SKU is admitted or has one explicit evidence blocker. |
| Media | Source rights, immutable source/final bytes, package fidelity, transparent packshot, crop/padding/artifact QA | The exact SKU has one publishable asset or one explicit media blocker. |
| Stores/prices | Fresh direct Nigerian listing, exact title/size/package, stock, retailer identity, price, expiry | Each observation is admitted, rejected, or pending with the exact reason. |
| Care/content | Manufacturer directions, neutral presentation, supportive-care boundary | Public copy is reviewed without diagnosis or unsupported efficacy claims. |
| Integration | Release matrix, projection rebuilds, focused gates, commit/push, exact deployment, route smoke, client links | Every passing cell is released and every remaining cell has one next action. |

The integration owner creates the matrix before deep work. The row is one
exact SKU, not a brand or product name. At minimum record `pending`, `blocked`,
`admitted`, or `released` for identity, media, offers, care, and integration.

Preflight the critical path immediately: official source availability, exact
target identity, image/upload access, release credentials, production target,
and rollback boundary. Discovering one of these after all content work is a
process defect.

Run subdepartments in parallel only when their files are disjoint. One worker
owns a path at a time. Workers return compact outcomes and never commit, push,
deploy, or migrate unless the integration capsule explicitly grants that
authority.

Treat each SKU as an independent release cell:

1. Release a reference-only product as soon as identity, care, provenance, and
   media pass; missing Nigerian offers continue as enrichment.
2. Add each passing exact offer without reopening unrelated products.
3. Never hold a passing SKU for the slowest sibling.
4. Run focused checks per cell and one broad `verify:release` gate per release
   wave, not per research or media correction.
5. Allow one independent review and one bounded correction pass. Continue only
   for a concrete new release-stopping defect.
6. Freeze optional framework expansion once the current cells can be safely
   admitted or rejected.

After each wave, return the usable product/share links immediately, then list
only the exact blockers for pending rows. This partial handback is the normal
fast-lane outcome, not a failure.

### Exact-size and image-family rule

Concurrently sold sizes remain independent exact SKUs with distinct slugs,
identifiers, images, offers, and identity-version rows. A reviewed product
family may provide UI navigation between released siblings, but it must never
merge them. Bottle and refill are separate package forms. Old/new package
evidence may prove continuity only for the same exact size and package form.
Selectors resolve only released family members and load each member's own
route, image, offer evidence, metadata, and structured data.

## Standing operator authority

Routine exact-SKU releases that satisfy this guide are pre-authorized for
direct completion, one atomic commit on `main`, and push. The operator does not
need to ask whether it may publish each passing product. A routine release may
include the candidate and retained evidence, a new non-overwriting
content-addressed final asset, dossier and release records, removal of that
released identity from the private queue, and deterministic projection
rebuilds.

This is operator authority, not retailer or brand authorization. Retailer and
brand authorization remain evidence questions enforced by the publication
gate.

When a candidate hits an identity, care, rights, image, or retained-evidence
blocker, preserve its state and next action, then continue with the next ready
candidate. Do not let one blocked SKU stop the product lane. Escalate only when
all useful candidates are blocked, the environment rejects an otherwise
authorized command, or shipping would require changing a shared schema, gate,
security boundary, migration, runtime contract, or public interface.

## Choose the publication route

- Use the full market route when exact Nigerian offers pass. Those approved
  offers may support price, store, stock, ranking, and sharing signals.
- Use `--reference-only` when the exact identity and package, bounded care
  review, rights/provenance, and reviewed final image pass, and the only
  remaining blockers are missing or unbound Nigerian offers or an insufficient
  Nigerian market route.

Choose the image route independently:

- Use exact official brand media, licensed original photography, or owned
  editorial photography when its rights, source bytes, package fidelity, and
  final presentation pass.
- Use an owned identity-verified render only when the exact source is bound and
  a faithful render is genuinely needed.
- When the operator has no image-generation capability, prepare and verify the
  private [exact-SKU packshot generation
  handoff](./PACKSHOT_GENERATION_HANDOFF.md). Do not block unrelated research
  and do not pretend that the handoff is completed art.

A reference-only release writes `marketRoute: "reference-only"` and
`exactOffers: []`. It publishes the product reference without price, store,
stock, offer ranking, or share-priority claims. Exact identity-bound persisted
offers may enrich it later through the existing publication boundary.

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
using `--write`. For a product whose only open evidence is Nigerian market
enrichment, append `--reference-only` to both the dry run and write:

```bash
npm run catalogue:publication:release -- \
  --candidate <candidate-id> \
  <presentation-and-timestamp-options> \
  --reference-only
```

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
- Use the manufacturer-SKU route only when the official source binds the exact
  manufacturer variant, brand, size, package, and manufacturer-owned code and
  publishes no GTIN. Retailer binding is required for market claims, not for a
  reference-only product.
- Do not rewrite the official variant, pretend a retailer SKU is a manufacturer
  identifier, or relax a title matcher to rescue one product. Preserve the
  candidate as blocked and move to the next lane when neither route is proven.

## Never fast-path these decisions

Stop and resolve the evidence when:

- manufacturer identity, variant, size, or package is ambiguous;
- care or safety copy exceeds the reviewed supportive-care boundary;
- image rights or source provenance are uncertain;
- final-image integrity, hash, label fidelity, alpha, or package integrity are
  uncertain;
- a source or artifact hash changed unexpectedly; or
- a retained artifact required by the chosen scope is contradictory or cannot
  be reopened.

Do not weaken those gates. Missing Nigerian price, store, or stock evidence is
not in this list: use reference-only and continue market research as
enrichment. NAFDAC context can guide research but is not a publication blocker.

## Commit boundary

One product commit may include its:

- per-SKU intake source and deterministic projection;
- retained official and retailer evidence;
- identity extraction and crosswalk;
- owned or permitted packshot and promotion record (PNG is gitignored —
  `git add -f` for the deploy cycle, `git rm --cached` after blob promotion);
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
