# Catalogue publication gate

Updated: 2026-07-22

## Why the old pipeline drifted

The importer ranked Open Beauty Facts records by source completeness, scan count, recency, validated-photo state, and ingredient availability. It then took the highest `target + reserve` records. The mirror and packshot stages filled a fixed 977-record target from whatever survived. Those signals are useful for review order, but they do not establish Nigerian relevance, product evidence, image rights review, intact packaging, or final presentation quality.

This made availability in the source dataset—and the need to fill a count—act like publication approval.

## New boundary

`data/external-products.json` is a checked-in, publication-gated research artifact. It is visible in the public repository but never enters the public catalogue by itself. Runtime inventory imports only `externalProducts`, the approved subset produced by `gateExternalCatalogue` and `data/external-product-approvals.json`.

The gate is fail-closed:

1. Hard gates run before scoring. Score and demand can order only records that already pass.
2. Exact SKU approval binds barcode, label/variant, size, source snapshot, candidate fingerprint, and a distinct public-image URL, hash and dimensions.
3. A reviewer records a formula archetype and care tier from an evidence URL. Open Beauty Facts ingredients alone are insufficient.
4. Nigerian regulatory status must be matched or explicitly documented as not required. `pending` remains private.
5. Market evidence must use one of two routes: Tier-A identity evidence plus two independent fresh exact Nigerian offers, or brand-confirmed Nigerian authorization plus one fresh exact offer.
6. Final packaging must be intact, source-faithful, magazine-ready, and manually compared with the source.
7. Untouched licensed photography, official brand media, owned editorial photography, or an identity-verified styled composite may pass.
8. For a styled composite, packaging cannot be invented and label, variant, and size must remain unchanged.
9. A raw automated cutout cannot pass. Background removal may create a private production input, but approval must point to a different finished editorial composite.
10. Any source identity, evidence, market observation, or final-image change invalidates approval.

The initial approval manifest is intentionally empty. This preserves all 977 records without presenting source availability, attractive imagery, or a high automated score as a finished public catalogue.

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
