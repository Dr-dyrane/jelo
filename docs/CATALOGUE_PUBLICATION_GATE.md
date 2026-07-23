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
2. Exact product approval binds the manufacturer's GTIN/EAN/UPC, label/variant and size to a checked-in reviewed field extraction. The preferred artifact records the requested and final response URL, an explicit decoded-response-body digest scope, exact field locators and short source text, retrieval and review times, plus response MIME type, byte size and SHA-256. When an official brand page blocks unattended HTTP retrieval but renders in the reviewed browser, a separate schema may bind the complete rendered `document.outerHTML` bytes, page title, complete document state and browser surface instead. It cannot be used for a partial page or non-HTML response. Redirected final responses are rejected. The canonical extraction JSON is independently hashed and sized. Raw response or DOM bytes are not retained, so a changed live source requires a fresh retrieval and review; the artifact is an auditable mapping, not a substitute for the original representation. A retailer's internal SKU is store metadata only and cannot establish canonical identity.
3. A reviewer records a formula archetype, care tier, supportive-care scope and explicit advisory boundary. Manufacturer evidence must be the exact identity URL or an explicit candidate-to-care-URL exception; another product page on the same brand host cannot substitute. Independent clinical guidance must be on a separate reviewed host. Manufacturer marketing or Open Beauty Facts ingredients alone are insufficient.
4. NAFDAC research is contextual, never a catalogue publication gate. When a match is recorded, it remains typed, reviewer-attributed and bound to the authority response and exact candidate so JeloCare does not overstate what was observed. Missing, pending or stale NAFDAC evidence does not hide an otherwise verified product, price or image. It also cannot create a clinical claim, recommendation or seller-authenticity claim.

An unresolved public registry search is durable context. The intake record may retain the exact query, decoded response hash, MIME type, byte size, retrieval and review time, and zero-result counts. Its caveat must state that no active public match is not proof of non-registration.
5. Market evidence must declare exactly one route: Tier-A identity evidence plus two independent fresh exact Nigerian offers, or brand-confirmed Nigerian authorization plus one fresh exact offer. Conflicting optional route claims fail closed. Every qualifying offer binds its exact listing/final response URL, decoded-body digest metadata, retrieval and review times, and located GTIN/EAN/UPC, title, size, NGN price and stock excerpts. A product-gallery back label may supply the identifier only when the exact image response, byte hash, MIME type, listing locator, barcode symbology and decoded digits are all bound to the listing; the title, size, price and stock still come from the listing response. Price currency and amount are parsed together; negated stock cannot count as availability. The brand route also snapshots reviewer-attributed seller/host authorization from a source valid for that candidate's brand and manufacturer identity. Bare hand-entered observations, retailer SKUs, unlabeled numbers and matching digits never qualify.
6. The primary catalogue image has one role: `packshot`. Final packaging must be intact, source-faithful, magazine-ready, genuinely transparent, at least 1,600 × 1,600, and manually compared with the exact product on peach, pink, and dark surfaces. An opaque white canvas, studio canvas, styled scene, or hidden semi-transparent photo plane cannot enter a public product shelf. The display approval is bound to the final file hash, MIME type, byte size and decoded dimensions.
7. Untouched licensed photography, permitted official brand media, owned editorial photography, or a JeloCare-owned identity-verified render may pass. Source-pixel isolation remains private until a checked-in typed record binds the source and output hashes, pipeline, model, runtime, audit and reviewer chronology into the dossier. Styled composites are not a packshot origin and are rejected even if their background treatment is relabelled.
8. A generated render is a valid route around source-image reuse restrictions, not around identity review. Its canonical content-addressed generation record names the provider, model, full prompt, every input URL and SHA-256, exact output SHA-256 and generation time. The gate recomputes the record hash, requires the immutable source asset among its inputs, rejects an input reused as the output, and enforces source retrieval → generation → full-resolution art review → publication approval. Label, variant, size, packaging geometry and required marks must match the manufacturer product, and packaging cannot be invented.
9. Unreviewed automated output cannot pass. A transparent isolation or generated render needs full-resolution side-by-side review, clean edges on every product surface, and no altered label or chroma fringe; manual checks alone do not replace the missing durable isolation record.
10. Any source identity, evidence, market observation, or final-image change invalidates approval.

## Batch discovery screen

Discovery is batched before dossier work. `npm run catalogue:discovery:screen -- --target=1000 --write=data/catalogue-discovery-screening.json` reads bounded WooCommerce Store API pages from reviewed Nigerian sources, binds every decoded JSON response to its final URL, retrieval time, SHA-256, MIME type and byte size, then rejects records without an exact product route, measurable size, positive NGN price or usable category. Selection is quality-first and category-balanced; it does not fill a category with weaker records merely to meet its target.

The checked-in screen currently holds 1,000 private leads selected from 3,794 retailer records and 39 response captures. It records retailer price, stock, image URL and SKU fields only as discovery observations. A checksum-valid number in a retailer `sku` field is explicitly labelled `retailer-sku-is-not-manufacturer-identity`; it can prioritize official research but cannot satisfy identity, exact-offer, regulatory, rights, care or publication gates. Slique remains provisional and cannot gain Tier-A status through volume or duplication with another store.

Run the offline integrity audit before using the batch:

```bash
npm run catalogue:discovery:audit
```

Only a deliberately selected lead is copied into `data/catalogue-intake.json`. The existing exact-SKU chronology starts there and remains unchanged.

### Research priority queue

`data/catalogue-research-queue.json` is a deterministic 48-item working set derived from the checked-in discovery snapshot. It ranks traceability and high-utility skincare lanes—sun protection, cleansing, moisture/barrier support, acne care, pigment support, hair/scalp and body care—while excluding makeup, fragrance, personal care, provisional-only observations and exact products already represented in the reviewed catalogue or deliberate intake.

The queue keeps retailer numbers labelled as unverified identity leads. Claim-heavy whitening language, abrasive products, single-retailer observations and unavailable listings remain visible as cautions and are deprioritized rather than silently rewritten or presented as facts. A three-item-per-brand cap prevents one retailer brand taxonomy from consuming the whole review cohort. None of these rankings establish formula quality, authenticity, clinical suitability, regulatory status or publication approval.

```bash
npm run catalogue:research:verify
```

The verifier recomputes the queue from the exact discovery snapshot bytes and fails if its source digest, ordering, lane coverage or evidence projection changes outside the deterministic builder.

## Deliberate intake queue

New research starts in `data/catalogue-intake.json`, one exact SKU at a time. Run `npm run catalogue:intake:audit` to see the ordered private queue, current gate and next action. The queue is research-only: importing it does not add products to either public catalogue source and even an `approval-ready` result means only that an identity-bound approval can be drafted.

Research can fan out across independent exact-SKU dossiers in parallel. The gates inside each dossier remain sequential and fail-closed: identity is locked before care, exact-offer review and final art review; approval follows every bound publication-evidence timestamp. NAFDAC research may continue in parallel as context. Evidence from one SKU cannot satisfy another, and a manifest update is merged only after the checked-in artifact bytes, locators, hashes and decision are verified locally.

Each candidate must explain the coverage gap, cite demand evidence, lock the exact identity and measured size to a checked-in official-source extraction and raw-response digest, complete a care review, bind any displayed Nigerian price to the exact product, document either source-image permission or verifiable owned-generation provenance, and finish a manually checked transparent packshot. A candidate stops at its earliest incomplete publication gate.

Provisional retailers may remain as dated price and stock observations. They do not count toward the Tier-A route requiring two independent directory-listed Nigerian retailers on distinct hosts. The separate brand-authorization route requires a directory-listed seller explicitly named by that exact reviewed brand source; an unrelated seller cannot borrow the authorization.

The count-first Open Beauty Facts importer, mirror, selector and cutout release remain frozen legacy research tools. They may preserve prior research artifacts, but they are not an intake or publication path for new products.

The initial approval manifest is intentionally empty. This preserves the legacy research pool without presenting source availability, attractive imagery, or a high automated score as a finished public catalogue.

## Private publication dossiers

`data/catalogue-publication-dossiers.json` is the source-agnostic handoff for a candidate that has cleared every publication gate. It contains the CeraVe Hydrating Cleanser neutral-reference dossier. `createCataloguePublicationDossier` binds the exact identity and its official snapshot, demand sources, care review, optional NAFDAC context, complete exact-offer evidence, current seller-authorization snapshot when used, immutable source-asset bytes, permission or the complete hashed generation record, final packshot URL/hash/type/bytes/dimensions, reviewer and causally ordered approval time into candidate and dossier fingerprints. A retailer-registry authorization change invalidates an existing dossier.

The dossier remains a private, non-recommendation artifact. No dossier publishes itself. Any candidate, evidence, rights, image or approval change invalidates the stored fingerprints. Verify the checked-in structure offline with:

```bash
npm run catalogue:publication:verify
```

## Explicit release boundary

`data/catalogue-publication-releases.json` is the only handoff from a verified private dossier to the public catalogue. A release binds the current dossier fingerprint, mapped public category, concise routine step and display line, manufacturer-sourced usage directions, presentation reviewer, publication reviewer and causally ordered timestamps into a separate immutable release fingerprint.

The release verifier always re-verifies the candidate and dossier first. A missing dossier, stale offer evidence, candidate or image change, unsupported category, unreviewed usage source, changed presentation or publication chronology fails closed. Dossier identity, final image and exact Nigerian offers are materialized directly; they cannot be rewritten by the release record. Suitability arrays remain empty, `sensitiveFriendly` remains false and `recommendationEligible` remains false until a separate clinical recommendation review exists.

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
