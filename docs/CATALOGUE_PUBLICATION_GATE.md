# Catalogue publication gate

Updated: 2026-07-22

## Why the old pipeline drifted

The importer ranked Open Beauty Facts records by source completeness, scan count, recency, validated-photo state, and ingredient availability. It then took the highest `target + reserve` records. The mirror and packshot stages filled a fixed 977-record target from whatever survived. Those signals are useful for review order, but they do not establish Nigerian relevance, product evidence, image rights review, intact packaging, or final presentation quality.

This made availability in the source dataset—and the need to fill a count—act like publication approval.

## New boundary

`data/external-products.json` is a checked-in legacy research artifact. It is visible in the public repository but never enters the public catalogue by itself. The legacy approval manifest must remain empty: `gateExternalCatalogue` rejects every non-empty manifest. New exact-SKU work can advance only through the private intake dossier described below.

This full publication gate governs new intake. Community bulk approvals are retired and hard-disabled. The smaller legacy static catalogue has a separate display-quality approval in `data/product-display-approvals.ts`; those records explicitly say `rightsStatus: not-verified` and must not be represented as licensed. A known reuse prohibition still causes an immediate hold.

The gate is fail-closed:

1. Hard gates run before scoring. Score and demand can order only records that already pass.
2. Exact product approval binds the manufacturer's GTIN/EAN/UPC, label/variant and size to a checked-in reviewed field extraction. The artifact records the requested and final response URL, an explicit decoded-response-body digest scope, exact field locators and short source text, retrieval and review times, plus response MIME type, byte size and SHA-256. Redirected final responses are rejected. Its canonical JSON bytes are independently hashed and sized. Raw response bytes are not retained, so a changed live source requires a fresh retrieval and review; the artifact is an auditable mapping, not a substitute for the original response. A retailer's internal SKU is store metadata only and cannot establish canonical identity.
3. A reviewer records a formula archetype, care tier, supportive-care scope and explicit advisory boundary. Manufacturer evidence must be the exact identity URL or an explicit candidate-to-care-URL exception; another product page on the same brand host cannot substitute. Independent clinical guidance must be on a separate reviewed host. Manufacturer marketing or Open Beauty Facts ingredients alone are insufficient.
4. Nigerian regulatory clearance is a typed, reviewer-attributed NAFDAC record bound to its final authority response representation and the candidate GTIN. A match must capture an explicit active registration status and reject inactive, revoked or expired records; a recorded expiry must still be current. A `not-required` record must quote an authority-sourced product class and rationale. Regulatory evidence expires after 90 days and must be re-observed; `pending`, stale, arbitrary-host and unrelated-scope records remain private.
5. Market evidence must declare exactly one route: Tier-A identity evidence plus two independent fresh exact Nigerian offers, or brand-confirmed Nigerian authorization plus one fresh exact offer. Conflicting optional route claims fail closed. Every qualifying offer binds its exact listing/final response URL, decoded-body digest metadata, retrieval and review times, and located GTIN/EAN/UPC, title, size, NGN price and stock excerpts. Price currency and amount are parsed together; negated stock cannot count as availability. The brand route also snapshots reviewer-attributed seller/host authorization from a source valid for that candidate's brand and manufacturer identity. Bare hand-entered observations, retailer SKUs, unlabeled numbers and matching digits never qualify.
6. The primary catalogue image has one role: `packshot`. Final packaging must be intact, source-faithful, magazine-ready, genuinely transparent, at least 1,600 × 1,600, and manually compared with the exact product on peach, pink, and dark surfaces. An opaque white canvas, studio canvas, styled scene, or hidden semi-transparent photo plane cannot enter a public product shelf. The display approval is bound to the final file hash, MIME type, byte size and decoded dimensions.
7. Untouched licensed photography, permitted official brand media, owned editorial photography, or a JeloCare-owned identity-verified render may pass. Source-pixel isolation remains private until a checked-in typed record binds the source and output hashes, pipeline, model, runtime, audit and reviewer chronology into the dossier. Styled composites are not a packshot origin and are rejected even if their background treatment is relabelled.
8. A generated render is a valid route around source-image reuse restrictions, not around identity review. Its canonical content-addressed generation record names the provider, model, full prompt, every input URL and SHA-256, exact output SHA-256 and generation time. The gate recomputes the record hash, requires the immutable source asset among its inputs, rejects an input reused as the output, and enforces source retrieval → generation → full-resolution art review → publication approval. Label, variant, size, packaging geometry and required marks must match the manufacturer product, and packaging cannot be invented.
9. Unreviewed automated output cannot pass. A transparent isolation or generated render needs full-resolution side-by-side review, clean edges on every product surface, and no altered label or chroma fringe; manual checks alone do not replace the missing durable isolation record.
10. Any source identity, evidence, market observation, or final-image change invalidates approval.

## Deliberate intake queue

New research starts in `data/catalogue-intake.json`, one exact SKU at a time. Run `npm run catalogue:intake:audit` to see the ordered private queue, current gate and next action. The queue is research-only: importing it does not add products to either public catalogue source and even an `approval-ready` result means only that an identity-bound approval can be drafted.

Research can fan out across independent exact-SKU dossiers in parallel. The gates inside each dossier remain sequential and fail-closed: identity is locked before care, offer and regulatory review, and final art review; approval follows every bound evidence timestamp. Evidence from one SKU cannot satisfy another, and a manifest update is merged only after the checked-in artifact bytes, locators, hashes and decision are verified locally.

Each candidate must explain the coverage gap, cite demand evidence, lock the exact identity and measured size to a checked-in official-source extraction and raw-response digest, complete a care review, record GTIN-bound Nigerian regulatory and listing evidence, document either source-image permission or verifiable owned-generation provenance, and finish a manually checked transparent packshot. A candidate stops at its earliest incomplete gate.

Provisional retailers may remain as dated price and stock observations. They do not count toward the Tier-A route requiring two independent directory-listed Nigerian retailers on distinct hosts. The separate brand-authorization route requires a directory-listed seller explicitly named by that exact reviewed brand source; an unrelated seller cannot borrow the authorization.

The count-first Open Beauty Facts importer, mirror, selector and cutout release remain frozen legacy research tools. They may preserve prior research artifacts, but they are not an intake or publication path for new products.

The initial approval manifest is intentionally empty. This preserves the legacy research pool without presenting source availability, attractive imagery, or a high automated score as a finished public catalogue.

## Private publication dossiers

`data/catalogue-publication-dossiers.json` is the source-agnostic handoff for a candidate that has cleared every intake gate. It is intentionally empty. `createCataloguePublicationDossier` binds the exact identity and its official snapshot, demand sources, care review, typed NAFDAC record, complete exact-offer evidence, current seller-authorization snapshot when used, immutable source-asset bytes, permission or the complete hashed generation record, final packshot URL/hash/type/bytes/dimensions, reviewer and causally ordered approval time into candidate and dossier fingerprints. A retailer-registry authorization change invalidates an existing dossier.

The dossier remains a private, non-recommendation artifact. No public catalogue or inventory module imports it, and the current database schema cannot publish it. Any candidate, evidence, rights, image or approval change invalidates the stored fingerprints. Verify the checked-in structure offline with:

```bash
npm run catalogue:publication:verify
```

The structural verifier does not fetch or approve image bytes. The separate networked verifier accepts only a content-addressed, versioned exact-candidate path on JeloCare's controlled Vercel Blob host, refuses redirects, caps response bytes, and checks the response type, byte size, SHA-256, decoded format and dimensions, animation, genuine alpha, subject padding, edge contact, centring, and background behavior on peach, pink, and dark. The uploader must use `allowOverwrite: false`; changing bytes requires a new versioned, hash-addressed path.

```bash
npm run catalogue:publication:images:verify
```

CI runs both checks. A structurally valid dossier or a passing remote image remains private evidence, never publication permission by itself. Full-resolution manual comparison still owns label, variant, size, packaging fidelity, chroma-fringe, and visual-quality judgment; automated pixels cannot establish those facts.

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
