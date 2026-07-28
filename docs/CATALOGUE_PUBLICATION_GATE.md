# Catalogue publication gate

Updated: 2026-07-23

## Why the old pipeline drifted

The importer ranked Open Beauty Facts records by source completeness, scan count, recency, validated-photo state, and ingredient availability. It then took the highest `target + reserve` records. The mirror and packshot stages filled a fixed 977-record target from whatever survived. Those signals are useful for review order, but they do not establish Nigerian relevance, product evidence, image rights review, intact packaging, or final presentation quality.

This made availability in the source dataset—and the need to fill a count—act like publication approval.

## New boundary

`data/external-products.json` is a checked-in legacy research artifact. It is visible in the public repository but never enters the public catalogue by itself. The legacy approval manifest must remain empty: `gateExternalCatalogue` rejects every non-empty manifest. New exact-SKU work can advance only through the private intake dossier described below.

This full publication gate governs new intake. Community bulk approvals are retired and hard-disabled. The smaller legacy static catalogue has a separate display-quality approval in `data/product-display-approvals.ts`; those records explicitly say `rightsStatus: not-verified` and must not be represented as licensed. A known reuse prohibition still causes an immediate hold.

The gate is fail-closed:

1. Hard gates run before scoring. Score and demand can order only records that already pass.
2. Exact product approval binds one canonical manufacturer identity route, label/variant, measured size and package version to checked-in reviewed evidence. The established route remains the manufacturer's GTIN/EAN/UPC. Its extraction records the requested and final response URL, decoded-response-body digest scope, exact field locators and excerpts, retrieval and review times, response MIME type, byte size and SHA-256. When an official brand page blocks unattended HTTP retrieval but renders in the reviewed browser, the browser-DOM route may bind the complete rendered `document.outerHTML`, page title, complete-document state and browser surface. It cannot use a partial page, non-HTML response or redirected final response. Existing GTIN candidates and fingerprints remain unchanged. A retailer's internal SKU is store metadata only and cannot establish canonical identity.

   A manufacturer-SKU route is additive and allowed only when the exact official product record explicitly labels a manufacturer-owned `SKU`, `Manufacturer SKU`, or `Product code` and publishes no GTIN. It requires extraction schema 8, an exact variant, measured size, package version, an attributed review, and machine-recheckable no-GTIN proof. A complete rendered DOM is retained as `data/catalogue-identity-source-evidence/<candidate>.html`; an exact official JSON product response is retained byte-for-byte at the corresponding `.json` path. The structured route is allowed only for the same-origin canonical `/products/<handle>.js` endpoint derived from the reviewed human product page, with either JSON MIME or Shopify's `text/javascript` JSON response. A captured localization query must contain only `country`, `currency`, and numeric `v` parameters. The response is never transformed into synthetic HTML. The evidence binds the exact byte count and SHA-256 plus the byte range and fragment hash for the one product record used. Verification reopens those exact bytes. Manufacturer brand, accepted aliases, manufacturer SKU, variant, size and package must occur together in that record, and the brand or alias must be an explicit `Brand`, `Vendor`, or `Manufacturer` field or label rather than descriptive prose. A visually reviewed package description may bind to a versioned official media URL in that same response and its already hash-bound source asset; this is identity evidence, not an image-rights claim.

   The verifier scans the complete retained representation for structured identifier keys such as `gtin13`, `ean8`, `upca`, `barcode_value` and camel-case equivalents without mistaking ordinary editorial prose for a published identifier. A null-barcode field must be attached to the same manufacturer SKU and remains invalid if another structured identifier occurs anywhere in the retained response. Numeric GTIN-shaped values, generic sentinels, unlabeled IDs, retailer SKUs, mixed GTIN/SKU routes, changed URLs, missing package versions, digest mismatches and contradicted absence claims fail closed. A schema-2 crosswalk binds the official capture and exact package to a stable manufacturer-owned product key. Duplicate detection uses that stable key, size and package; a second normalized official-route/size/package guard prevents the same package crossing between GTIN and manufacturer-SKU routes while allowing distinct manufacturer SKUs on one multi-variant page.
3. A reviewer records a formula archetype, care tier, supportive-care scope and explicit advisory boundary. Manufacturer evidence must be the exact identity URL or an explicit candidate-to-care-URL exception; another product page on the same brand host cannot substitute. Independent clinical guidance must be on a separate reviewed host. Manufacturer marketing or Open Beauty Facts ingredients alone are insufficient.
4. NAFDAC research is contextual, never a catalogue publication gate. When a match is recorded, it remains typed, reviewer-attributed and bound to the authority response and exact candidate so JeloCare does not overstate what was observed. Missing, pending or stale NAFDAC evidence does not hide an otherwise verified product, price or image. It also cannot create a clinical claim, recommendation or seller-authenticity claim.

An unresolved public registry search is durable context. The intake record may retain the exact query, decoded response hash, MIME type, byte size, retrieval and review time, and zero-result counts. Its caveat must state that no active public match is not proof of non-registration.
5. Market evidence must declare exactly one route: Tier-A identity evidence plus two independent fresh exact Nigerian offers, or brand-confirmed Nigerian authorization plus one fresh exact offer. Conflicting optional route claims fail closed. Every qualifying offer binds its exact listing/final response URL, decoded-body digest metadata, retrieval and review times, title, size, package when required, NGN price and stock excerpts. GTIN candidates retain explicit GTIN/EAN/UPC correlation. A product-gallery back label may supply that identifier only when the exact image response, byte hash, MIME type, listing locator, barcode symbology and decoded digits are bound to the listing; title, size, price and stock still come from the listing response.

   Manufacturer-SKU candidates use exact-offer schema 3. The complete retailer response is retained at `data/catalogue-offer-source-evidence/<candidate>--<retailer>.html` or the corresponding `.json` path, with its byte count and SHA-256 plus the byte range and fragment hash for one exact offer record. Brand, title, size, package, price and stock must all occur in that same record. The correlation binds the offer to the immutable official identity snapshot and canonical manufacturer SKU. Retailer brand evidence must be an explicit `Brand`, `Vendor`, or `Manufacturer` field or label, equal to the official manufacturer brand or an alias retained inside the official product record. Incidental prose and unreviewed candidate aliases cannot authorize an offer. A variant-only retailer title is accepted only beside that explicit same-record brand field; foreign and dual-brand listings fail even when their variant, size and package happen to match. The retailer's own SKU remains untrusted local metadata and never participates in equality.

   Price currency and amount are parsed together; negated stock cannot count as availability. The brand route also snapshots reviewer-attributed seller/host authorization from a source valid for that candidate's brand and manufacturer identity. Bare hand-entered observations, retailer SKUs, unlabeled numbers and matching digits never qualify.
6. The primary catalogue image has one role: `packshot`. Final packaging must be intact, source-faithful, magazine-ready, genuinely transparent, at least 1,600 × 1,600, and manually compared with the exact product on peach, pink, and dark surfaces. An opaque white canvas, studio canvas, styled scene, or hidden semi-transparent photo plane cannot enter a public product shelf. The display approval is bound to the final file hash, MIME type, byte size and decoded dimensions.
7. Untouched licensed photography, permitted official brand media, owned editorial photography, or a JeloCare-owned identity-verified render may pass. Source-pixel isolation remains private until a checked-in typed record binds the source and output hashes, pipeline, model, runtime, audit and reviewer chronology into the dossier. Styled composites are not a packshot origin and are rejected even if their background treatment is relabelled.
8. A generated render is a valid route around source-image reuse restrictions, not around identity review. Its canonical content-addressed generation record names the provider, model, full prompt, every input URL and SHA-256, exact output SHA-256 and generation time. The gate recomputes the record hash, requires the immutable source asset among its inputs, rejects an input reused as the output, and enforces source retrieval → generation → full-resolution art review → publication approval. Label, variant, size, packaging geometry and required marks must match the manufacturer product, and packaging cannot be invented.
9. Unreviewed automated output cannot pass. A transparent isolation or generated render needs full-resolution side-by-side review, clean edges on every product surface, and no altered label or chroma fringe; manual checks alone do not replace the missing durable isolation record.
10. Any source identity, evidence, market observation, or final-image change invalidates approval.

## Batch discovery screen

Discovery is batched before dossier work.
`npm run catalogue:discovery:screen -- --target=1000 --baseline=data/catalogue-discovery-screening.json`
reads bounded WooCommerce Store API pages from reviewed Nigerian sources,
binds every decoded JSON response to its final URL, retrieval time, SHA-256,
MIME type and byte size, then reports source and candidate churn against the
checked-in snapshot. Replacing that snapshot requires the exact reported
`--accept-refresh` token, so changed bytes or selection cannot be silently
overwritten. The screen rejects records without an exact product route,
measurable size, positive NGN price or usable category. Selection is
quality-first and category-balanced; it does not fill a category with weaker
records merely to meet its target.

The checked-in screen currently holds 1,000 private leads selected from 3,794 retailer records and 39 response captures. It records retailer price, stock, image URL and SKU fields only as discovery observations. A checksum-valid number in a retailer `sku` field is explicitly labelled `retailer-sku-is-not-manufacturer-identity`; it can prioritize official research but cannot satisfy identity, exact-offer, regulatory, rights, care or publication gates. Slique remains provisional and cannot gain Tier-A status through volume or duplication with another store.

Run the offline integrity audit before using the batch:

```bash
npm run catalogue:discovery:audit
```

Only a deliberately selected lead is authored into its own packet-bound
`data/catalogue-intake-candidates/<candidate-id>.json` source. The compiler
preserves the existing exact-SKU chronology in the generated
`data/catalogue-intake.json` runtime projection.

### Research priority queue

`data/catalogue-research-queue.json` is a deterministic 48-item working set derived from the checked-in discovery snapshot. It ranks traceability and high-utility skincare lanes—sun protection, cleansing, moisture/barrier support, acne care, pigment support, hair/scalp and body care—while excluding makeup, fragrance, personal care, provisional-only observations and exact products already represented in the reviewed catalogue or deliberate intake.

The queue keeps retailer numbers labelled as unverified identity leads. Claim-heavy whitening language, abrasive products, single-retailer observations and unavailable listings remain visible as cautions and are deprioritized rather than silently rewritten or presented as facts. A three-item-per-brand cap prevents one retailer brand taxonomy from consuming the whole review cohort. None of these rankings establish formula quality, authenticity, clinical suitability, regulatory status or publication approval.

```bash
npm run catalogue:research:verify
```

The verifier recomputes the queue from the exact discovery snapshot bytes and fails if its source digest, ordering, lane coverage or evidence projection changes outside the deterministic builder.

## Deliberate intake queue

New research starts in one packet-bound
`data/catalogue-intake-candidates/<candidate-id>.json` source envelope per exact
SKU. `data/catalogue-intake.json` is its generated runtime projection; verify it
with `npm run catalogue:intake:verify` and never hand-edit it. Run
`npm run catalogue:intake:audit` to see the ordered private queue, current gate
and next action. The queue is research-only: importing it does not add products
to either public catalogue source and even an `approval-ready` result means only
that an identity-bound approval can be drafted.

Research can fan out across independent exact-SKU dossiers in parallel. The gates inside each dossier remain sequential and fail-closed: identity is locked before care, exact-offer review and final art review; approval follows every bound publication-evidence timestamp. NAFDAC research may continue in parallel as context. Evidence from one SKU cannot satisfy another, and a manifest update is merged only after the checked-in artifact bytes, locators, hashes and decision are verified locally.

Each candidate must explain the coverage gap, cite demand evidence, lock the exact identity and measured size to a checked-in official-source extraction and raw-response digest, complete a care review, bind any displayed Nigerian price to the exact product, document either source-image permission or verifiable owned-generation provenance, and finish a manually checked transparent packshot. A candidate stops at its earliest incomplete publication gate.

Provisional retailers may remain as dated price and stock observations. They do not count toward the Tier-A route requiring two independent directory-listed Nigerian retailers on distinct hosts. The separate brand-authorization route requires a directory-listed seller explicitly named by that exact reviewed brand source; an unrelated seller cannot borrow the authorization.

The count-first Open Beauty Facts importer, mirror, selector and cutout release remain frozen legacy research tools. They may preserve prior research artifacts, but they are not an intake or publication path for new products.

The initial approval manifest is intentionally empty. This preserves the legacy research pool without presenting source availability, attractive imagery, or a high automated score as a finished public catalogue.

## Private publication dossiers

`data/catalogue-publication-dossiers.json` is the source-agnostic handoff for candidates that clear every publication gate. It contains one immutable neutral-reference dossier per approved exact SKU. `createCataloguePublicationDossier` remains the deterministic structural compiler primitive. Production release tooling uses `createVerifiedCataloguePublicationDossier` and `verifyCataloguePublicationDossierManifestWithArtifacts`, which reopen every retained official and retailer representation before allowing the dossier boundary. The dossier binds the canonical identity and crosswalk, official snapshot, demand sources, care review, optional NAFDAC context, complete exact-offer evidence, current seller-authorization snapshot when used, immutable source-asset bytes, permission or the complete hashed generation record, final packshot URL/hash/type/bytes/dimensions, reviewer and causally ordered approval time into candidate and dossier fingerprints. A retailer-registry authorization change invalidates an existing dossier.

The dossier remains a private, non-recommendation artifact. No dossier publishes itself. Any candidate, evidence, rights, image or approval change invalidates the stored fingerprints. Verify the checked-in structure offline with:

```bash
npm run catalogue:publication:verify
```

## Explicit release boundary

`data/catalogue-publication-releases.json` is the only handoff from a verified private dossier to the public catalogue. A release binds the current dossier fingerprint, mapped public category, concise routine step and display line, manufacturer-sourced usage directions, presentation reviewer, publication reviewer and causally ordered timestamps into a separate immutable release fingerprint.

The release verifier always re-verifies the candidate and dossier first. Production release and verification commands use the artifact-aware APIs, so retained official and retailer bytes are re-opened before a release can pass. A missing artifact or dossier, stale offer evidence, changed byte range or hash, candidate or image change, unsupported category, unreviewed usage source, changed presentation or publication chronology fails closed. Dossier identity, final image and exact Nigerian offers are materialized directly; they cannot be rewritten by the release record. Suitability arrays remain empty, `sensitiveFriendly` remains false and `recommendationEligible` remains false until a separate clinical recommendation review exists.

`npm run catalogue:publication:release` removes manual JSON assembly from this boundary. It requires the exact candidate, public category, routine step, display line, manufacturer-bound directions URL, usage copy and ordered approval/review/publication timestamps. The command creates the dossier and release together, rejects existing candidate records, verifies both complete next-state manifests in memory, and writes only with `--write`.

```bash
npm run catalogue:publication:releases:verify
```

The public repository consumes only the verified materialized release output. A release can appear from the checked-in source of truth before its optional database projection exists; if the projection exists, only exact identity-bound persisted offer evidence may enhance it. This avoids a deployment dead end without allowing arbitrary database rows or private dossiers to bypass release approval.

The structural verifier does not fetch or approve image bytes. The separate networked verifier accepts only a content-addressed, versioned exact-candidate path on JeloCare's controlled Vercel Blob host, refuses redirects, caps response bytes, and checks the response type, byte size, SHA-256, decoded format and dimensions, animation, genuine alpha, subject padding, edge contact, centring, and background behavior on peach, pink, and dark. The uploader must use `allowOverwrite: false`; changing bytes requires a new versioned, hash-addressed path.

```bash
npm run catalogue:publication:images:verify
```

CI runs the dossier, release and remote-image checks. A structurally valid dossier or a passing remote image remains private evidence, never publication permission by itself. Full-resolution manual comparison still owns label, variant, size, packaging fidelity, chroma-fringe, and visual-quality judgment; automated pixels cannot establish those facts.

## Shared audit dimensions

The deterministic quality assessment works across community candidates and JeloCare-reviewed products:

- traceable identity;
- formula completeness;
- product evidence level;
- exact Nigerian listing evidence;
- image rights;
- final presentation quality.

These dimensions are a publication audit, not a clinical rule. Direct guidance is governed separately by the explicit care-review manifest. Legacy community records remain private research; their non-empty approval manifest is hard-disabled.

## Operational safety

- The legacy mirror writes to `.cache`, not the checked-in public manifest.
- The raw-cutout publisher only supports validation mode and refuses uploads.
- The legacy external production seed exits before opening a database connection until approval-aware persistence replaces the cutout release schema.
- No approval task may alter the bulk source artifact in place; approvals are additive and individually reversible.
