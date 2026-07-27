# Catalogue operations

Updated: 2026-07-26

Release one exact product at a time. Discovery can run in parallel; evidence and publication cannot be assumed.

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

## 3. Prepare a private evidence packet

Use the packet preparer before authoring a new deliberate intake candidate. It makes the missing proofs visible without creating a product, changing `data/catalogue-intake.json`, or granting publication permission.

The checked-in first batch is deliberately limited to eight traceable static priorities. Its discovery response digests, retailer listings, and retailer-local code leads live in `data/catalogue-research-evidence-packets.json`.

```bash
# One current static priority
npm run catalogue:research:packets -- --static <discovery-id>

# A bounded static batch (1–12); --write only updates the private packet manifest
npm run catalogue:research:packets -- --batch 8 --write
npm run catalogue:research:packets:verify
```

When a server-side aggregate community report has been generated, it can seed an ephemeral private batch. It retains only task-level label, source, signal count and timing; never contributor, draft, submission, contact, or session identifiers.

```bash
npm run community:research:signals -- --json > .cache/community-research-signals.json
npm run catalogue:research:packets -- \
  --community-report .cache/community-research-signals.json \
  --batch 8 --write --out .cache/community-evidence-packets.json
```

Every packet begins with six empty proof slots: official identity, care, exact Nigerian offers, rights/source bytes, final image, and generation. A packet is not a partial `CatalogueIntakeCandidate`; copy verified evidence into a new deliberate candidate only after all applicable gates can be met. Retailer codes remain retailer-local leads even when their shape resembles a GTIN.

## 4. Lock identity

Record the exact brand, variant, size, package version, and manufacturer identifier.

Preferred evidence order:

1. official manufacturer identity;
2. official structured product data;
3. two independent identifier corroborations when the manufacturer does not publish the code;
4. hash-bound reviewed browser DOM when direct retrieval is blocked.

Use exactly one canonical route. Keep the GTIN route whenever the manufacturer publishes a GTIN/EAN/UPC. When the exact official product record publishes no GTIN but explicitly labels its own `SKU`, `Manufacturer SKU`, or `Product code`, use extraction schema 8 and record the exact package version. Retain the complete official response at `data/catalogue-identity-source-evidence/<candidate>.html`, plus its exact byte count and SHA-256 and the byte range and fragment hash for one product record.

Verification reopens the retained bytes and requires the manufacturer brand, reviewed aliases, manufacturer SKU, variant, size and package together in that record. Brand and aliases must come from explicit `Brand`, `Vendor`, or `Manufacturer` fields or labels, not descriptive copy. The complete representation is scanned for structured identifier keys; a null-barcode claim cannot coexist with another structured identifier. Persist the exact package and capture binding in the schema-2 manufacturer crosswalk. Duplicate checks use the stable manufacturer-owned key, size and package, with a second official-route/size/package guard against mixed GTIN and manufacturer-SKU admission.

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

GTIN candidates keep exact-offer schema 1. Manufacturer-SKU candidates use exact-offer schema 3 and retain the complete retailer response at `data/catalogue-offer-source-evidence/<candidate>--<retailer>.html` or `.json`, plus one exact offer-record byte range and fragment hash. Verification requires brand, title, size, package, price and stock to occur together in that record and rechecks the immutable official identity snapshot. Brand must equal the official manufacturer brand or a reviewed official-record alias and must be an explicit `Brand`, `Vendor`, or `Manufacturer` field or label. A description mention does not count. A variant-only title is acceptable only beside that explicit same-record brand field. Foreign and dual-brand listings fail. `retailerSku` may remain as retailer operations metadata but is never compared with the canonical identifier.

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
