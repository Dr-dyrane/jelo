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
2. Exact SKU approval binds barcode, label/variant, size, source snapshot, candidate fingerprint, and a distinct public-image URL, hash and dimensions.
3. A reviewer records a formula archetype and care tier from an evidence URL. Open Beauty Facts ingredients alone are insufficient.
4. Nigerian regulatory status must be matched or explicitly documented as not required. `pending` remains private.
5. Market evidence must use one of two routes: Tier-A identity evidence plus two independent fresh exact Nigerian offers, or brand-confirmed Nigerian authorization plus one fresh exact offer.
6. Final packaging must be intact, source-faithful, magazine-ready, genuinely transparent, at least 1,000 × 1,000, and manually compared with the source on peach, pink, and dark surfaces. An opaque white canvas, studio canvas, or hidden semi-transparent photo plane cannot enter a public product shelf. The display approval is bound to the final file hash.
7. Untouched licensed photography, permitted official brand media, owned editorial photography, or an identity-verified styled composite may pass.
8. For a styled composite, packaging cannot be invented and label, variant, and size must remain unchanged.
9. Unreviewed automated output cannot pass. A polished transparent isolation may pass only when it retains the official source pixels, contains no redraw or chroma fringe, and a reviewer compares the full-resolution source and final image. Generation may create non-identity scenery, never the branded package.
10. Any source identity, evidence, market observation, or final-image change invalidates approval.

## Deliberate intake queue

New research starts in `data/catalogue-intake.json`, one exact SKU at a time. Run `npm run catalogue:intake:audit` to see the ordered private queue, current gate and next action. The queue is research-only: importing it does not add products to either public catalogue source and even an `approval-ready` result means only that an identity-bound approval can be drafted.

Each candidate must explain the coverage gap, cite demand evidence, lock the exact identity and measured size, complete a care review, record Nigerian regulatory and listing evidence, document image rights, and finish a manually checked editorial image. A candidate stops at its earliest incomplete gate.

Provisional retailers may remain as dated price and stock observations. They do not count toward the Tier-A route requiring two independent directory-listed Nigerian retailers on distinct hosts. They can support the separate brand-authorization route only when the brand authorization itself is documented.

The count-first Open Beauty Facts importer, mirror, selector and cutout release remain frozen legacy research tools. They may preserve prior research artifacts, but they are not an intake or publication path for new products.

The initial approval manifest is intentionally empty. This preserves the legacy research pool without presenting source availability, attractive imagery, or a high automated score as a finished public catalogue.

## Private publication dossiers

`data/catalogue-publication-dossiers.json` is the source-agnostic handoff for a candidate that has cleared every intake gate. It is intentionally empty. `createCataloguePublicationDossier` binds the exact identity, official and demand sources, care review, registry-reconciled Nigerian observations, rights evidence, final image URL/hash/dimensions, reviewer and approval time into candidate and dossier fingerprints.

The dossier remains a private, non-recommendation artifact. No public catalogue or inventory module imports it, and the current database schema cannot publish it. Any candidate, evidence, rights, image or approval change invalidates the stored fingerprints. Verify the checked-in structure offline with:

```bash
npm run catalogue:publication:verify
```

This verifier does not fetch or approve image bytes. Remote byte, alpha, edge and surface verification remains mandatory in a later publication boundary; a structurally valid dossier is never publication permission by itself.

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
