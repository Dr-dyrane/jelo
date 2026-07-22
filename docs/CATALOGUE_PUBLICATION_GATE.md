# Catalogue publication gate

Updated: 2026-07-22

## Why the old pipeline drifted

The importer ranked Open Beauty Facts records by source completeness, scan count, recency, validated-photo state, and ingredient availability. It then took the highest `target + reserve` records. The mirror and packshot stages filled a fixed 977-record target from whatever survived. Those signals are useful for review order, but they do not establish Nigerian relevance, product evidence, image rights review, intact packaging, or final presentation quality.

This made availability in the source dataset—and the need to fill a count—act like publication approval.

## New boundary

`data/external-products.json` is a checked-in, publication-gated research artifact. It is visible in the public repository but never enters the public catalogue by itself. Runtime inventory imports only `externalProducts`, the approved subset produced by `gateExternalCatalogue` and `data/external-product-approvals.json`.

This full publication gate governs new intake and community records. The smaller legacy static catalogue has a separate display-quality approval in `data/product-display-approvals.ts`; those records explicitly say `rightsStatus: not-verified` and must not be represented as licensed. A known reuse prohibition still causes an immediate hold.

The gate is fail-closed:

1. Hard gates run before scoring. Score and demand can order only records that already pass.
2. Exact product approval binds the manufacturer's GTIN/EAN/UPC, label/variant and size to a content-addressed official-source snapshot. The evidence records the source URL, observed GTIN, observed variant and size, MIME type, byte size, retrieval time and SHA-256. A retailer's internal SKU is store metadata only and cannot establish canonical identity.
3. A reviewer records a formula archetype and care tier from an evidence URL. Open Beauty Facts ingredients alone are insufficient.
4. Nigerian regulatory status must be matched or explicitly documented as not required. `pending` remains private.
5. Market evidence must use one of two routes: Tier-A identity evidence plus two independent fresh exact Nigerian offers, or brand-confirmed Nigerian authorization plus one fresh exact offer. An offer counts as exact only when the page explicitly exposes the same manufacturer GTIN as the candidate; a retailer SKU, even when it happens to look like a barcode, never substitutes for the observed GTIN.
6. The primary catalogue image has one role: `packshot`. Final packaging must be intact, source-faithful, magazine-ready, genuinely transparent, at least 1,600 × 1,600, and manually compared with the exact product on peach, pink, and dark surfaces. An opaque white canvas, studio canvas, styled scene, or hidden semi-transparent photo plane cannot enter a public product shelf. The display approval is bound to the final file hash, MIME type, byte size and decoded dimensions.
7. Untouched licensed photography, permitted official brand media, owned editorial photography, a reviewed source-pixel isolation, or a JeloCare-owned identity-verified render may pass. Styled composites are not a packshot origin and are rejected even if their background treatment is relabelled.
8. A generated render is a valid route around source-image reuse restrictions, not around identity review. Its canonical content-addressed generation record names the provider, model, full prompt, every input URL and SHA-256, exact output SHA-256 and generation time. The gate recomputes the record hash, requires the immutable source asset among its inputs, rejects an input reused as the output, and enforces source retrieval → generation → full-resolution art review → publication approval. Label, variant, size, packaging geometry and required marks must match the manufacturer product, and packaging cannot be invented.
9. Unreviewed automated output cannot pass. A transparent isolation or generated render needs full-resolution side-by-side review, clean edges on every product surface, and no altered label or chroma fringe.
10. Any source identity, evidence, market observation, or final-image change invalidates approval.

## Deliberate intake queue

New research starts in `data/catalogue-intake.json`, one exact SKU at a time. Run `npm run catalogue:intake:audit` to see the ordered private queue, current gate and next action. The queue is research-only: importing it does not add products to either public catalogue source and even an `approval-ready` result means only that an identity-bound approval can be drafted.

Each candidate must explain the coverage gap, cite demand evidence, lock the exact identity and measured size to an immutable official-source snapshot, complete a care review, record GTIN-bound Nigerian regulatory and listing evidence, document either source-image permission or verifiable owned-generation provenance, and finish a manually checked transparent packshot. A candidate stops at its earliest incomplete gate.

Provisional retailers may remain as dated price and stock observations. They do not count toward the Tier-A route requiring two independent directory-listed Nigerian retailers on distinct hosts. They can support the separate brand-authorization route only when the brand authorization itself is documented.

The count-first Open Beauty Facts importer, mirror, selector and cutout release remain frozen legacy research tools. They may preserve prior research artifacts, but they are not an intake or publication path for new products.

The initial approval manifest is intentionally empty. This preserves the legacy research pool without presenting source availability, attractive imagery, or a high automated score as a finished public catalogue.

## Private publication dossiers

`data/catalogue-publication-dossiers.json` is the source-agnostic handoff for a candidate that has cleared every intake gate. It is intentionally empty. `createCataloguePublicationDossier` binds the exact identity and its official snapshot, demand sources, care review, manufacturer-GTIN-bound Nigerian observations, immutable source-asset bytes, permission or the complete hashed generation record, final packshot URL/hash/type/bytes/dimensions, reviewer and causally ordered approval time into candidate and dossier fingerprints.

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

These dimensions are a publication audit, not a clinical rule. Direct guidance is governed separately by the explicit care-review manifest. Community records remain discovery-only even after publication approval.

## Operational safety

- The legacy mirror writes to `.cache`, not the checked-in public manifest.
- The raw-cutout publisher only supports validation mode and refuses uploads.
- The legacy external production seed exits before opening a database connection until approval-aware persistence replaces the cutout release schema.
- No approval task may alter the bulk source artifact in place; approvals are additive and individually reversible.
