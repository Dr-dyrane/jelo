# JeloCare agent instructions

Start with [the JeloCare handbook](./docs/README.md). For routine product work,
use [the catalogue fast lane](./docs/catalogue/FAST_LANE.md) and the enforcing
manifests and verifiers instead of reconstructing the workflow from git
history. For a log of errors encountered and their fixes, see
[troubleshooting](./docs/catalogue/TROUBLESHOOTING.md). For UI and data-flow
rules learned from shipped bugs, see the [lessons learned section in
UI_PHILOSOPHY](./docs/UI_PHILOSOPHY.md#lessons-learned--ui-and-data-flow-fixes).

That means do not re-derive the _whole_ workflow from history. It does not mean
avoid history. When a single step is unclear — how an asset is produced, what a
release record contains, which fixtures move — read the last product commit
(`git log --oneline -- data/catalogue-publication-releases.json`, then
`git show --stat <sha>`) before reverse-engineering validator source. One
`git show` is faster and more reliable than inferring the contract from
`lib/catalogue/*.ts`, and it shows what the lane actually permits rather than
what a validator merely allows.

## Applying database migrations

The checked-in migration runner is the only normal application path. It takes
the advisory lock and commits each migration body with its ledger row in one
database transaction. Never split a migration into separately auto-committed
MCP statements and never insert a ledger row by hand.

When `MIGRATION_DATABASE_URL` is not stored locally, use the authenticated Neon
CLI as the protected process-only source for the direct `neondb_owner` URL,
remove the postgres.js-incompatible `channel_binding` parameter, and pass the
result only to `npm run db:migrate` or the documented reconciliation operator.
Do not print, persist, or place the URL in a command argument. Apply migrations
**before** deploying dependent code. Full details live in
[Neon and data operations](./docs/data/NEON.md#protected-agent-migration-when-no-local-admin-url-exists).

## Continuous product loop

Product work is a continuous release loop, not a one-product consultation.
Do not stop after reporting status, presenting a plan, preparing a candidate,
or completing one release. Do not ask “should I continue?”, “may I commit?”,
“may I push?”, or “which product should I take next?” when the answer is
already determined by this file, the fast lane, the priority queue, or a
passing verifier.

Repeat this loop while a ready candidate exists:

1. Fetch the current `origin/main`, inspect the pipeline status and intake
   audit, and select the highest-priority candidate that can pass in the
   current environment.
2. Screen the exact identity, retained source, image dimensions, care boundary,
   and viable market or reference-only route before spending time on downstream
   assembly.
3. Complete the candidate through its existing evidence, asset, dossier,
   release, and derived-projection contracts.
4. Run the focused fast-lane checks. Fix deterministic failures that are within
   the routine SKU scope instead of asking the owner how to proceed.
5. Commit the exact product atomically on `main`, push it, and verify the
   resulting CI and production deployment.
6. Record any candidate-specific enrichment still owed, then immediately begin
   the next ready candidate.

If one candidate is blocked, preserve its exact blocker and next action, move
it out of the active slot, and continue with the next ready product. An image
handoff is also a sublane: prepare the verified brief, hand it off, and keep the
non-image product loop moving.

Do not interrupt the loop for:

- routine file edits already described by a recent passing release;
- generated projection or fixture changes required by the existing contract;
- a missing Nigerian offer when `reference-only` is valid;
- a missing local Blob token when production promotion is already delegated to
  the documented Vercel build;
- permission to commit or push a passing routine SKU; or
- a preference question that the priority queue, evidence, existing UI canon,
  or verifier can answer.

Stop only when no useful ready candidate remains, every available route has a
specific unresolved evidence blocker, the environment enforces a real
credentials or branch-protection failure after safe alternatives are
exhausted, or the necessary work would cross the shared schema, security,
migration, publication-gate, runtime, destructive-action, or public-interface
boundaries below. State the exact blocker once; do not turn a routine release
into an approval conversation.

## Product-image routing

Image generation is one asset route, not the product lane itself.

1. Finish exact identity, care, Nigerian offer research, and source-asset
   evidence independently of the final-art route.
2. Prefer an exact, full-resolution official brand asset when its permission,
   package fidelity, transparency, and presentation quality can pass the
   publication gate. Never substitute a similar size, variant, package, or
   retailer thumbnail.
3. If the exact source is suitable but a faithful owned render is required,
   follow [the exact-SKU packshot generation
   handoff](./docs/catalogue/PACKSHOT_GENERATION_HANDOFF.md). Create a verified
   private generation specification containing the immutable source binding,
   exact prompt, required visible details, prohibited changes, and review
   checklist.
4. If an image-generation tool is available, give it the bound source as
   `Image 1` and use the checked-in prompt unchanged. If no such tool is
   available, stop only the image sublane: verify and report the ready-to-run
   handoff so an image-capable operator can return the output. Continue any
   independent product research that remains useful.
5. Never claim output hashes, generation provenance, art review, rights, or
   publication before the output exists. Never promote a raw automated cutout,
   generated draft, visually similar product, or unreviewed official image.
6. After the image returns, record its actual provenance, perform the
   full-resolution and multi-surface review, retire the open generation brief,
   and resume the normal release lane.

The final public asset must remain the exact package, complete and unclipped,
with true transparency, durable provenance, a content-addressed location, and
an independently reviewed presentation result.

### Asset promotion and git bloat control

Packshot binaries (`data/catalogue-intake-assets/**/*.{png,jpg,webp,avif}`)
are gitignored. The promotion records in
`data/product-asset-promotions.json` are the canonical source — the `blobUrl`
field points to the Vercel Blob store where images are served. When staging a
new packshot:

1. Place the reviewed PNG locally under `data/catalogue-intake-assets/<slug>/`.
2. Add or update the promotion record with `active: true` and the correct hash.
3. `git add -f` the PNG so it travels through git for one deploy cycle.
4. Push — Vercel's `assets:promote:staged` step uploads it to blob.
5. After the deploy succeeds, `git rm --cached` the PNG and commit.

The test suite skips byte verification for promotion records whose local file
is absent (already promoted). See
[OPERATIONS.md §12](./docs/catalogue/OPERATIONS.md) for the full lifecycle.

## How a release actually ships

Verified from `f02eea5` ("Release two verified product references"). Read this
before concluding that anything is structurally blocked.

- **Reference-only is the normal unblocking route.** A release with
  `publicationScope: "neutral-reference"` needs **no** bound Nigerian exact
  offers and no market route. DANG Hydra Glow and Face Facts Soothe + Glow both
  shipped this way with `exactOffers: []`. Missing offers are an enrichment
  constraint, never a reason to hold an otherwise verified product.
- **The image route is official asset + local background removal, not
  generation.** Pull the brand's own full-resolution media (Shopify CDN accepts
  `?width=2048`), run the local rembg venv
  (`npm run catalogue:packshot:prepare-reviewed`, `.cache/reviewed-packshot-venv`),
  write the 2000 x 2000 transparent PNG under
  `data/catalogue-intake-assets/<candidate>/`, then append an `active: true`
  record to `data/product-asset-promotions.json`. The PNG is gitignored — use
  `git add -f` to include it for one deploy cycle, then `git rm --cached` after
  Vercel promotes it to blob. Generation is the exception, for SKUs whose only
  official media is below the 1600 px publication minimum.
- **`BLOB_READ_WRITE_TOKEN` is not needed locally.** It is a placeholder that
  `vercel env pull` will not decrypt. `scripts/vercel-build.ts` runs
  `assets:promote:staged` when `VERCEL_ENV=production`, so the upload happens on
  deploy. A missing local token is never a blocker; do not report it as one.
- **Product commits legitimately touch shared code and test fixtures.** `f02eea5`
  edited `publication-dossier.ts`, `pipeline-status.ts`,
  `release-catalogue-candidate.ts` and six test files. Hard-coded cohort counts
  (candidate totals, identity-artifact totals, reviewed counts) are expected to
  move with a new candidate — update them; they are not a warning sign.
- **Screen for image resolution before picking a candidate.** Check the official
  media's longest side first. Below 1600 px means the generation route and an
  open image sublane; at or above it means a same-session shippable product.
- **Exact-offer binding accepts reviewed browser surfaces.** Two of the three
  accepted evidence methods require a `browserCapture.surface` listed in
  `reviewedBrowserCaptureSurfaces` (Codex, Claude Code, and Playwright MCP
  browsers). The remaining raw-HTTP method needs the retailer response to
  literally name GTIN/EAN/UPC, so a listing that labels the code `sku` cannot
  bind. Take the reference-only route instead of relaxing a matcher.
- **Promoting a research lead cascades.** Adding a candidate restales the
  research queue, then every packet shard, then the offer-capture bindings.
  Expect `research:build --write`, each `research:packets --shard N --write`,
  and one `research:offers --shard N --write`. Retained capture bytes are
  immutable: if a shard's recapture reports a differing retained file, bind a
  different shard rather than forcing an overwrite.
- **Re-verification is a fastlane within the fastlane.** When a released
  product's offers exceed the 7-day freshness window, replace them with fresh
  Playwright MCP browser captures in a single commit. The workflow is:
  `browser_navigate` + `browser_evaluate` to capture DOM hash, price, and
  stock; edit `data/catalogue-intake.json` and the per-candidate source JSON;
  run `npx tsx scripts/release-catalogue-candidate.ts --write`; shift test
  fixture indices; `npm test`; commit and push. 39 products were re-verified
  in one session on 2026-08-08. See the
  [fast lane re-verification section](./docs/catalogue/FAST_LANE.md#re-verification-of-stale-offers)
  for the full workflow and common evidence patterns.

## Standing authority for routine product releases

The repository owner authorizes an agent to finish and ship a routine,
exact-SKU catalogue addition without requesting conversational approval for
each product. When the existing publication contract passes, the agent may:

- complete the candidate, retained evidence, dossier, release, and derived
  search or research projections;
- upload a reviewed final asset to a new content-addressed JeloCare-controlled
  location with overwrite disabled;
- remove that exact released identity from its private research queue or retire
  its completed generation brief as required by the deterministic workflow;
- create one atomic product commit directly on `main`; and
- push `main`, allowing the normal production deployment to run.

This standing authority applies only when the change follows the existing
schema, publication gate, security boundary, runtime contract, and fast-lane
verification set. Seller or brand authorization is product evidence; it is not
a request for permission from the repository owner.

Do not pause a viable pipeline because one candidate is blocked. Record the
candidate-specific blocker and next action, then take the next ready product.
Request direction only when every useful candidate is blocked or the required
change falls outside the routine release contract.

Stop before shipping when the work would weaken or change a shared gate,
schema, migration, security boundary, runtime behavior, or public UI; when
identity, care, rights, source provenance, or final-image integrity remains
uncertain; when an existing public asset would be overwritten or deleted; or
when credentials, branch protection, or the execution environment actually
prevents the documented command. In the last case, finish the safe local work,
leave an atomic verified commit when permitted, and report the exact failing
command and error instead of asking a vague authorization question.
