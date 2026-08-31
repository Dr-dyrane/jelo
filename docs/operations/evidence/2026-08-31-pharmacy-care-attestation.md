# Pharmacy care attestation — 31 August 2026

## Outcome

Dyrane authorized medical/pharmacy review and reported approval by the
`JeloCare pharmacist` on 31 August 2026. The versioned
`pharmacy-care-review/2026-08-31/v1` record binds that approval to the exact 39
public products that were in `pharmacist_review` at approval time. Its
disposition is `reviewed_context_only`.

This resolves the public pending-review wording for this cohort. It does not
promote any product to `supportive_eligible`, make a direct recommendation,
approve a formula or use, or replace pharmacist guidance for a customer's
specific concern. Approved-use labels remain hidden outside
`supportive_eligible`.

## Bound cohort

The attestation names these 39 slugs explicitly; new or changed catalogue
products do not inherit it:

1. `cosrx-salicylic-acid-daily-gentle-cleanser`
2. `some-by-mi-aha-bha-pha-miracle-toner`
3. `anua-niacinamide-10-txa-4-serum`
4. `face-facts-wonder-cream-fragrance-free`
5. `face-facts-bright-clear-face-cream`
6. `b-lab-matcha-hydrating-real-sunscreen`
7. `dove-moroccan-argan-oil-beauty-bar`
8. `lush-hair-mentholated-conditioner`
9. `mediana-leave-in-conditioning-milk`
10. `kuza-indian-hemp-hair-scalp-treatment`
11. `disaar-argan-oil-body-oil-gel`
12. `the-ordinary-azelaic-acid-suspension-10`
13. `panoxyl-acne-foaming-wash-10-benzoyl-peroxide`
14. `skin-by-zaron-vitamin-c-body-lotion-500ml`
15. `c28f590dd2739ea73f1b5ea3`
16. `la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-200ml`
17. `loccitane-almond-softening-shower-oil-250ml`
18. `panoxyl-acne-creamy-wash-4-170g`
19. `naturium-dew-glow-moisturizer-spf-50-1-7fl-oz`
20. `cerave-blemish-control-cleanser`
21. `beauty-formulas-glowing-serum-2-vitamin-c-30ml`
22. `cerave-sa-smoothing-cleanser-473ml`
23. `cerave-acne-foaming-cream-wash-10-150ml`
24. `balance-salicylic-acid-zinc-clarifying-toner-200ml`
25. `keracare-dry-itchy-scalp-conditioner-950ml`
26. `balance-niacinamide-blemish-recovery-serum-30ml`
27. `nineless-a-control-10-azelaic-acid-serum-30ml`
28. `nineless-mela-pro-rice-txa-toner-200ml`
29. `de-la-cruz-acne-treatment-10-sulfur-73-7g`
30. `laroche-posay-mela-b3-serum-30ml`
31. `anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml`
32. `facefacts-ceramide-blemish-gel-moisturiser-50ml`
33. `skin-by-zaron-vitamin-c-body-wash-650ml`
34. `prequel-gleanser-glycolic-acid-cleanser-400ml`
35. `cerave-acne-foaming-cream-cleanser-4-150ml`
36. `saltair-santal-bloom-moisture-bound-hair-oil-rich-50ml`
37. `dang-vitamin-c-concentrated-serum-oil-free-30ml`
38. `dang-azelaic-acid-serum-30ml`
39. `medik8-advanced-night-restore-50ml`

## Evidence boundary

The public catalogue remains 163 products: 22 `supportive_eligible`, 39
`pharmacist_review`, and 102 `insufficient_data`. Direct recommendation remains
limited to `supportive_eligible`.

Within the attested cohort, 35 products retain one or more public source URLs.
Four retain no public source URL:

- `lush-hair-mentholated-conditioner`
- `mediana-leave-in-conditioning-milk`
- `kuza-indian-hemp-hair-scalp-treatment`
- `disaar-argan-oil-body-oil-gel`

The attestation does not fill those source gaps or invent product evidence. The
product-evidence review date and the separate pharmacy approval date remain
distinct in the public care evidence record.

## Enforcement and verification

- `data/product-care-review-attestation.ts` owns the exact cohort and approval
  metadata.
- `modules/clinical/pharmacy-care-attestation.test.ts` proves exact cohort
  equality, the unchanged 163/22/39/102 matrix, state exclusion, and the 35/4
  source boundary.
- `modules/recommendations/clinical-product-filter.ts` continues to exclude all
  `pharmacist_review` products from direct recommendations.
- The public product record renders `Pharmacist-reviewed context` only when the
  exact slug has this attestation. The clinical evidence bridge and product
  decision carry the typed approval metadata for governed consumers; the
  current Ops evidence queue does not add rows or visibly render it.

## Rollback

Remove the v1 attestation data file and its imports, restore the prior
pharmacist-review projection copy, and remove this evidence entry from
`docs/README.md`. No database, migration, environment, product-care state,
source URL, formula, or approved-use rollback is required because none changes
in this attestation.
