# Catalogue operations

Updated: 2026-07-28

Release one exact product at a time. Discovery can run in parallel; evidence and publication cannot be assumed.

Routine exact-SKU work uses the
[catalogue fast lane](./FAST_LANE.md): one product, one atomic direct-to-`main`
commit, focused per-SKU verification, and periodic full release verification.
The fast lane removes repeated global work; it does not weaken publication
evidence.

## The pipeline

```text
Retailer discovery
  -> deterministic research queue
  -> private evidence packet
  -> deliberate per-SKU intake
  -> identity and package evidence
  -> bounded care review
  -> exact Nigerian offer evidence
  -> rights and image review
  -> approval-ready candidate
  -> private dossier
  -> immutable release
  -> public catalogue
  -> production verification
```

The full rules are in [CATALOGUE_PUBLICATION_GATE.md](../CATALOGUE_PUBLICATION_GATE.md). The media standard is in [PRODUCT_IMAGE_WORKFLOW.md](../PRODUCT_IMAGE_WORKFLOW.md).

## 1. Read the live state

```bash
npm run catalogue:pipeline:status
npm run catalogue:intake:audit
npm run catalogue:research:verify
```

Use the generated status, not a remembered count.

With a server database environment loaded, also read the community research order:

```bash
npm run community:research:signals
```

## 2. Choose a candidate

Pending `community-first` tasks precede the bulk discovery leads. The shared private schedule orders them by signal count, then recency, deduplicates exact canonical slugs and complete normalized brand/name/size identities, then appends the deterministic static queue. They are durable community-reported signals described in [COMMUNITY_KNOWLEDGE_INTAKE.md](../COMMUNITY_KNOWLEDGE_INTAKE.md); they reorder research and satisfy no publication gate.

`data/catalogue-research-queue.json` is a deterministic projection. Do not hand-edit its status.

After identity research, record exactly one reviewed outcome. The command is a
dry-run unless `--apply` is present and requires the allowlisted
`MODERATION_OPERATOR_EMAIL`.

```bash
# Bind to an existing canonical product
npm run community:research:resolve -- \
  --task-id <uuid> \
  --outcome existing-canonical-product \
  --canonical-slug <product-slug> \
  --rationale "<review basis>"

# Hand off to deliberate intake authoring
npm run community:research:resolve -- \
  --task-id <uuid> \
  --outcome deliberate-intake-candidate \
  --candidate-id <candidate-id> \
  --rationale "<review basis>"
```

The other terminal outcomes are `ambiguous-family`, `bundle`, and
`dismissed-duplicate`. Add `--apply` only after the dry-run is correct. A
resolution stores the reviewer, rationale, bounded audit metadata, and optional
target reference. It does not create an intake candidate or write a product,
dossier, release, offer, image, or public catalogue record.

Choose a candidate for:

- clinical or routine usefulness;
- recognizable demand or community signal;
- exact identity traceability;
- credible Nigerian availability;
- a feasible exact-package image route;
- category and concern coverage.

The frozen Open Beauty Facts pool and retailer discovery leads are private research. They are not public catalogue products.

### Review source churn before replacing discovery

Discovery reads live retailer inventory, so a new run is not expected to be
byte-stable. It is also not permitted to silently overwrite the checked-in
research universe. First fetch without writing and compare it with the current
snapshot:

```bash
npm run catalogue:discovery:screen -- \
  --target=1000 \
  --baseline=data/catalogue-discovery-screening.json
```

The result includes an exact `refreshReview`: source-count deltas, response
churn, added and removed discovery IDs, and a SHA-256 acceptance token bound to
both complete semantic snapshots. Retrieval timestamps are excluded from that
token; retailer response hashes, record counts, offers, locators, candidates,
and selection are not. Review the complete output. To replace the snapshot,
repeat the fetch with the token:

```bash
npm run catalogue:discovery:screen -- \
  --target=1000 \
  --write=data/catalogue-discovery-screening.json \
  --accept-refresh=<exact-token-from-the-reviewed-run>
```

If the live source changes between runs, the token changes and the write fails.
Review the new delta rather than increasing a threshold.

The 2026-07-27 refresh is intentionally recorded here because its large JSON
diff can otherwise look like accidental data loss:

- source responses changed from 39 to 38;
- source product records changed from 3,794 to 3,731;
- eligible private leads changed from 2,434 to 2,405;
- the bounded selection remained 1,000;
- 928 discovery IDs remained, while 72 left and 72 entered the
  quality-first, category-balanced selection;
- BuyBetter now reported 11 pages. Its former page 12 contained 16 records,
  while its current page 11 contains 47 records; the prior snapshot had 11
  full 100-record pages plus that 16-record final page.

This is live retailer source churn, not a product deletion, publication
decision, or identity change. A lead leaving the top 1,000 remains recoverable
from repository history and never removes an intake candidate, dossier,
release, public product, or price history. The refresh must be followed by the
offline discovery, research-queue, packet, and retained-offer verifiers.

## 3. Prepare a private evidence packet

Use the packet preparer before authoring a new deliberate intake candidate. It makes the missing proofs visible without creating a product, changing `data/catalogue-intake.json`, or granting publication permission.

All current static priorities are packetized as immutable, content-addressed
sources below `data/catalogue-research-evidence-packet-sources/`. The checked-in
`data/catalogue-research-evidence-packets.json` file is their deterministic
index projection. Sources are split into contiguous queue-rank shards of at
most twelve packets; adding a later shard never replaces the bytes or digest
that an earlier capture cites. Every shard retains the discovery response
digests, exact retailer retrieval locators, retailer listings, and
retailer-local code leads for its packets.

```bash
# Inspect one current static priority (writes nothing)
npm run catalogue:research:packets -- --static <discovery-id>

# Inspect or create one deterministic source shard (at most 12 packets).
# --write creates a content-addressed source and recompiles only the private index.
npm run catalogue:research:packets -- --shard 3
npm run catalogue:research:packets -- --shard 3 --write
npm run catalogue:research:packets:verify
```

`--static <discovery-id> --write` resolves the priority's owning shard and
performs that same bounded source write. A source filename is the SHA-256 of
its complete bytes. Existing bytes are never replaced: an exact retry is
idempotent, while changed queue or snapshot evidence creates a different
source digest. The compiler accepts only the complete ordered shard set for the
current queue and snapshot and rejects gaps, overlaps, duplicate packet or
discovery IDs, stale bytes, and more than twelve packets in a shard.

When a server-side aggregate community report has been generated, it can seed an ephemeral private batch. It retains only task-level label, source, signal count and timing; never contributor, draft, submission, contact, or session identifiers.

```bash
npm run community:research:signals -- --json > .cache/community-research-signals.json
npm run catalogue:research:packets -- \
  --community-report .cache/community-research-signals.json \
  --batch 8 --write --out .cache/community-evidence-packets.json
```

Every packet begins with six empty proof slots: official identity, care, exact Nigerian offers, rights/source bytes, final image, and generation. A packet is not a partial `CatalogueIntakeCandidate`; copy verified evidence into a new deliberate candidate only after all applicable gates can be met. Retailer codes remain retailer-local leads even when their shape resembles a GTIN.

### Retain exact retailer responses for the bounded packet batch

The offer capture operator follows only the exact queryless Woo product API
route stored in one selected immutable packet shard. It fetches at most twelve
packets with concurrency three, accepts one same-retailer JSON product record,
and binds its raw bytes, URL, product ID, title, size, price, stock, digest, and
canonical evidence path. It never uses a search result or sibling listing.

```bash
# Networked shard dry run; writes nothing
npm run catalogue:research:offers -- --shard 3 --batch 12

# One packet anywhere in the 48-priority projection
npm run catalogue:research:offers -- --static <discovery-id>

# Explicitly retain the reviewed shard batch
npm run catalogue:research:offers -- --shard 3 --batch 12 --write

# Offline: re-open every immutable capture source, packet-derived plan and byte file
npm run catalogue:research:offers:verify
```

Each retained batch has a content-addressed manifest below
`data/catalogue-research-offer-capture-sources/`.
`data/catalogue-research-offer-captures.json` is the deterministic projection
compiled from those immutable manifests, and
`data/catalogue-offer-source-evidence/<discovery-id>--<retailer>.json` are
private research artifacts. Their policy is
`private-retained-offer-source-evidence-only`, publication authority is
`none`, and publication status is `not-a-catalogue-candidate`. A retailer SKU
is retained only as `retailer-local-code-not-manufacturer-identity`, even when
it is GTIN-shaped. These artifacts do not change `data/catalogue-intake.json`,
create a dossier, create an offer, choose an image, or publish a product.

Raw response retention is a separate, explicit per-source capability. Its only
rationale is to reopen dated factual offer fields and verify response
integrity. A grant is bounded to exact product-response bytes in the private
evidence repository; an absent or denied grant fails before a request is made.
It does not change the source's `link-only` content policy and grants no public
description, page-content, image-download, image-reuse, or redistribution
right. BuyBetter and Slique have this narrow grant for the checked-in evidence;
Lux Beauty remains explicitly denied until a reviewed retained capture needs
one.

Each immutable capture source and the compiled projection may contain
hash-bound source-quality cautions.
These preserve the exact retailer bytes while quarantining a known bad field:
`cross-product-visual` excludes that source image from every use, and
`description-size-conflict` excludes the description from identity, care
review, and public copy. The checked-in batch records both defects found during
the 2026-07-28 retained-response and live-listing review. A recapture carries a
caution forward only when both the capture ID and full response digest remain
unchanged; changed bytes require a new review. Never “fix” the retailer's raw
JSON by hand.

## 4. Lock identity

Record the exact brand, variant, size, package version, and manufacturer identifier.

Preferred evidence order:

1. official manufacturer identity;
2. official structured product data;
3. two independent identifier corroborations when the manufacturer does not publish the code;
4. hash-bound reviewed browser DOM when direct retrieval is blocked.

Use exactly one canonical route. Keep the GTIN route whenever the manufacturer publishes a GTIN/EAN/UPC. When the exact official product record publishes no GTIN but explicitly labels its own `SKU`, `Manufacturer SKU`, or `Product code`, use extraction schema 8 and record the exact package version. Retain a complete rendered DOM at `data/catalogue-identity-source-evidence/<candidate>.html`, or retain the exact same-origin `/products/<handle>.js` response at the corresponding `.json` path. Shopify may serve that JSON body as `text/javascript`; record the response MIME exactly. A captured localization query may contain only `country`, `currency`, and numeric `v` parameters. Never transform the response into synthetic HTML. Bind the representation's exact byte count and SHA-256 and the byte range and fragment hash for one product record. If package appearance is reviewed from official media, bind the human description to the exact versioned media URL present in that retained response and to the already reviewed source-asset hash. This does not grant publication rights.

Verification reopens the retained bytes and requires the manufacturer brand, reviewed aliases, manufacturer SKU, variant, size and package together in that record. Brand and aliases must come from explicit `Brand`, `Vendor`, or `Manufacturer` fields or labels, not descriptive copy. The complete representation is scanned for structured identifier keys; a null-barcode claim cannot coexist with another structured identifier. Persist the exact package and capture binding in the schema-2 manufacturer crosswalk. Duplicate checks use the stable manufacturer-owned key, size and package, with a second official-route/size/package guard against mixed GTIN and manufacturer-SKU admission.

An identity resolution does not imply a release. `catalogue:pipeline:status` keeps candidates whose identity passed but whose care, Nigerian offer, rights, editorial, or approval gates remain open in the `identityResolvedPrivate` lane. This is the durable handoff for terminal research: operators can see that identity work is complete without mistaking the candidate for a public product.

Retailer SKUs remain retailer-local. Never promote one into a manufacturer GTIN or manufacturer SKU. Identity artifacts are checked against their exact retained bytes and hashes. Package revisions must stay distinct.

## 5. Review care

Care review establishes a narrow role, not a marketing claim.

- Use official directions and formula evidence.
- Add independent clinical guidance when the tier requires it.
- Name the advisory boundary.
- Do not infer formula from a title, retailer description, or package appearance.
- NAFDAC status is useful context; pending status is not a publication blocker.
- Keep neutral catalogue references out of clinical matching.

## 6. Capture Nigerian offers

An exact observation binds:

- requested and final listing URL;
- retailer and current status;
- exact title, variant, size, and package version;
- identifier basis;
- NGN price;
- controlled stock state;
- retrieval and review timestamps;
- response bytes, MIME type, digest, locators, and excerpts.

Existing GTIN candidates may keep exact-offer schema 1. A new or reopened
GTIN-bound Woo offer can use schema 4 when its exact raw JSON product response
is retained. Schema 4 requires a queryless same-retailer
`/wp-json/wc/store/v1/products/<positive-id>` response, canonical
`data/catalogue-offer-source-evidence/<candidate>--<retailer>.json` path,
complete response byte count and SHA-256, and one record whose byte range,
source text, and fragment hash cover that complete body. Verification parses
the complete regular, non-symlinked file as one top-level product object and
binds the API product ID and permalink to the listing before checking title,
size, price, stock, and the candidate's already reviewed official GTIN.
Wrappers, arrays, product slices, and invalid surrounding bytes fail. If the
retailer response does not publish the GTIN, the GTIN field must explicitly be
an official-identity correlation; the retailer SKU never fills that role.

Manufacturer-SKU candidates use exact-offer schema 3 and retain the complete
retailer response at
`data/catalogue-offer-source-evidence/<candidate>--<retailer>.html` or `.json`,
plus one exact offer-record byte range and fragment hash. Verification requires
brand, title, size, package, price and stock to occur together in that record
and rechecks the immutable official identity snapshot. Brand must equal the
official manufacturer brand or a reviewed official-record alias and must be an
explicit `Brand`, `Vendor`, or `Manufacturer` field or label. A description
mention does not count. A variant-only title is acceptable only beside that
explicit same-record brand field. Foreign and dual-brand listings fail.
`retailerSku` may remain as retailer operations metadata but is never compared
with the canonical identifier.

Use the rendered browser for stores such as Beauty by Daz when automation is blocked. Search pages, sibling redirects, stale observations, package conflicts, and ambiguous sizes remain excluded evidence.

Slique Beauty is provisional and link-only under the current policy. Do not reuse its images or descriptions.

## 7. Produce the image

The public asset must:

- match the exact package;
- preserve label, claims, size, geometry, and source pixels;
- show the complete package;
- use true transparency;
- be at least 1,000 × 1,000;
- pass peach, pink, and dark-surface review;
- be bound by hash and public Blob metadata.

Generation may create a faithful display render only when its provenance record is present. It must not redesign the package. A raw cutout is not automatically publication quality.

Useful operators:

```bash
npm run catalogue:packshot:tool:check
npm run catalogue:packshot:prepare-reviewed -- --help
npm run catalogue:publication:images:verify
npm run assets:verify
```

## 8. Update the deliberate intake

Each private candidate has one authoritative source envelope at
`data/catalogue-intake-candidates/<candidate-id>.json`. Keep its identity,
care, Nigerian, rights, editorial, and asset fields internally consistent.
Bind a new source to the static research packet or aggregate community packet
that caused the deliberate research; community origins retain only packet and
report hashes, never contributor or session identifiers.
The original 35 records retain their fixed migration origin and ordering. A new
record cannot claim that legacy origin.

`data/catalogue-intake.json` is now the deterministic runtime projection. Do
not hand-edit it. Build is a dry-run unless `--write` is explicit:

```bash
npm run catalogue:intake:build
npm run catalogue:intake:verify

# After reviewing a clean dry-run
npm run catalogue:intake:build -- --write
```

The compiler rejects filename/ID mismatches, unsupported or duplicate origins,
duplicate canonical identities, GTINs and manufacturer-owned product keys,
cross-route package collisions, timestamps that predate evidence, deletions,
and writes larger than 12 changed/new candidates. Before an atomic write it
rechecks source and projection digests and structurally verifies every existing
dossier and release binding. It never creates or changes a dossier, release,
public image, or public product.

The compiler deliberately does not reopen retained evidence bytes: it must stay
deterministic and side-effect free. Production dossier and release commands use
the artifact-aware APIs and fail closed unless every retained official and
retailer response, declared byte count, SHA-256, exact record range, fragment
hash and structured-field proof can be re-opened and verified.

Validate the wider contract:

```bash
npm run catalogue:intake:audit
npm test
```

An approval-ready result means the code gate found no blocker. It is not public yet.

## 9. Create the dossier and release

First run the release operator without `--write`. Supply explicit ISO timestamps and presentation copy.

```bash
npm run catalogue:publication:release -- \
  --candidate <candidate-id> \
  --approved-at <ISO-time> \
  --presentation-reviewed-at <ISO-time> \
  --published-at <ISO-time> \
  --category <Face-or-Hair-or-Body> \
  --routine-step <step> \
  --display-line <short-line> \
  --usage <bounded-directions> \
  --directions-url <official-url>
```

The chronology must be:

```text
dossier approval <= presentation review <= publication
```

Review the fingerprints, then repeat with `--write`. The operator reopens all
retained identity and offer artifacts, writes the dossier and release manifests
atomically, and rejects duplicate canonical identities and cross-route package
collisions.

Regenerate the research projection:

```bash
npm run catalogue:research:build -- --write
npm run catalogue:research:verify
```

## 10. Run publication gates

```bash
npm run catalogue:publication:verify
npm run catalogue:publication:releases:verify
npm run catalogue:publication:images:verify
npm run assets:verify
npm run lint
npm run typecheck
npm test
npm run build
```

Also inspect:

```bash
npm run inventory:audit
npm run inventory:prices
```

## 11. Verify the experience

Check desktop and mobile:

- product search returns the product;
- shelves and filters remain coherent;
- the exact packshot is complete and transparent;
- the product page answers fit, why, and where;
- retailer prices, sizes, stock, and freshness match evidence;
- store sheets and outbound links work;
- no console or network errors appear;
- contrast, focus, reduced motion, and small-screen layout remain sound.

After push, verify the exact production deployment and custom domain before calling the release complete.

## Never do

- Publish a discovery lead because its count is useful.
- Use product-name inference as formula evidence.
- Present a marketplace seller score as authenticity.
- Treat a retailer SKU as the manufacturer barcode.
- Repair a clipped or conflicting image into false evidence.
- Edit a deterministic research projection by hand.
- Add a candidate without one packet-bound per-SKU intake source.
- Use an intake compile to imply approval, release, or public exposure.
- Treat a private evidence packet as an intake candidate, dossier, release, or public product.
- Remove a failing gate to release faster.
