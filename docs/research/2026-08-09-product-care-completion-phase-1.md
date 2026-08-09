# Product-care completion · Phase 1

Reviewed: 2026-08-09T23:43:07Z

This is a dated, exact-SKU audit and cohort ledger. It is not permission to
infer care from product titles, catalogue copy, retailer descriptions,
ingredients or sibling products. Each product is one atomic review cell.

## Matrix

The canonical source manifests contain 160 records, but the current public
catalogue contains exactly 158 unique products. Two legacy source products do
not pass the public display boundary. Every public slug has one care record and
there are no orphaned public cells.

| Snapshot                  | `supportive_eligible` | `pharmacist_review` | `insufficient_data` | Total |
| ------------------------- | --------------------: | ------------------: | ------------------: | ----: |
| Phase 1 baseline          |                    22 |                  20 |                 116 |   158 |
| After the admitted cohort |                    22 |                  28 |                 108 |   158 |

`pharmacist_review` remains a review-required context tier. It does not make a
product a direct recommendation or claim that a pharmacist endorsed the SKU.
The exact 158-cell coverage and state counts are enforced in
`modules/recommendations/clinical-product-filter.test.ts`.

## Phase 1 decisions

Eight cells passed the fresh exact-product and independent-guidance check. All
eight remain excluded from direct recommendations.

| Decision | Exact public SKU                                                      | Bounded reviewed relationship                                                                                             | Sources                                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admitted | `panoxyl-acne-creamy-wash-4-170g`                                     | 4% benzoyl-peroxide wash; acne and breakouts                                                                              | [PanOxyl](https://panoxyl.com/acne-products/acne-creamy-wash/) · [NHS](https://www.nhs.uk/medicines/benzoyl-peroxide/about-benzoyl-peroxide/)                                                   |
| Admitted | `dang-vitamin-c-concentrated-serum-oil-free-30ml`                     | Vitamin C serum; dark-spot review                                                                                         | [DANG!](https://danglifestyle.co/products/vitamin-c-serum-for-oily-skin) · [AAD](https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots)                            |
| Admitted | `c28f590dd2739ea73f1b5ea3`                                            | Simple 125 ml rich moisturiser; dry or sensitive-feeling facial skin                                                      | [Simple](https://www.simple.co.uk/p/kind-to-skin-replenishing-rich-moisturiser.html/05011451103948) · [AAD](https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer)     |
| Admitted | `medik8-advanced-night-restore-50ml`                                  | 50 ml night moisturiser; dry facial skin                                                                                  | [Medik8](https://www.medik8.com/products/advanced-night-restore) · [AAD](https://www.aad.org/public/everyday-care/skin-care-basics/dry/pick-moisturizer)                                        |
| Admitted | `la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-200ml` | Exact 200 ml emollient balm; dry or rough body skin                                                                       | [La Roche-Posay](https://www.laroche-posay.fr/lipikar-baume-ap-max/3337875930048.html) · [NHS](https://www.nhs.uk/tests-and-treatments/emollients/)                                             |
| Admitted | `loccitane-almond-softening-shower-oil-250ml`                         | Exact 250 ml fragranced shower oil; dry-body cleansing context                                                            | [L'Occitane](https://no.loccitane.com/products/almond-amande-shower-oil-250ml) · [AAD](https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin)      |
| Admitted | `saltair-santal-bloom-moisture-bound-hair-oil-rich-50ml`              | Exact rich 50 ml finishing oil; dry or frizzy hair                                                                        | [Saltair](https://saltair.com/products/hair-oil-for-thick-hair?variant=44047707898063) · [AAD](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips)                 |
| Admitted | `naturium-dew-glow-moisturizer-spf-50-1-7fl-oz`                       | Exact 50 ml SPF 50 moisturiser; daily sun-protection review                                                               | [Naturium](https://naturium.com/products/dew-glow-moisturizer-spf-50-original) · [AAD](https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen) |
| Rejected | `replenix-bp-10-acne-wash-aloe-vera-7oz`                              | Current exact-product binding fails: the manufacturer page now presents 6.7 oz while the catalogue atom and slug say 7 oz | Obtain an exact official 7 oz source, or resolve the public identity in its owning catalogue lane before care review                                                                            |

The post-review concern partition is: acne 0 direct / 13 reviewed, dark spots
0 / 7, sensitive barrier 3 / 1, dry face 5 / 2, dry body 6 / 2,
sweat/odour 1 / 0, oily skin 3 / 2, daily sun protection 1 / 1,
dandruff 0 / 1, and dry hair 5 / 1. Condition-pattern guides remain entirely
product-ineligible.

## Pending cohort A · two-source packet present (63)

Blocker: a URL pair is not a care decision. Reopen the exact current
manufacturer variant/size/formula, then confirm that the independent source
supports the proposed use and its cautions. Retinoids, acids, medicated washes,
sunscreens and pigmentation products need formula-specific safety review; a
generic adjacent article is insufficient.

```text
11d3a6116ccfc1cbce191430
abib-clear-spot-serum-7-325-30ml
abib-heartleaf-foam-cleanser-150ml
advanced-clinicals-vitamin-c-face-serum-52ml
anessa-perfect-uv-sunscreen-skincare-milk-na-60ml
anua-zero-cast-moisturizing-finish-sunscreen-50ml
aveeno-daily-moisturizing-body-oil-mist-200ml
beauty-of-joseon-glow-serum-propolis-niacinamide-30ml
dang-beauty-water-toner-100ml
dang-collagen-hydrating-serum-ceramides-30ml
dang-everyday-gentle-foaming-face-wash-120ml
dang-hyaluronic-cream-hydrating-face-cleanser-200ml
dang-hydra-glow-sun-protection-gel-60ml
dang-niacinamide-n-acetyl-glucosamine-serum-30ml
dang-retinal-cream-005-30ml
dang-snail-mucin-repair-serum-100ml
dang-snail-secretion-filtrate-repair-face-cream-50g
elf-suntouchable-invisible-sunscreen-spf-35-50ml
eos-coconut-waters-body-wash-473ml
eos-pink-champagne-body-wash-473ml
eos-vanilla-cashmere-body-wash-473ml
estelin-vitamin-c-turmeric-face-oil-30ml
facefacts-soothe-glow-niacinamide-serum-30ml
facefacts-vitamin-c-brightening-jelly-cleanser-150ml
fenty-skin-butta-drop-fenty-fresh-standard-200ml
la-roche-posay-effaclar-purifying-foaming-gel-400ml
la-roche-posay-lipikar-apmax-triple-repair-moisturizing-cream-400ml
medik8-crystal-retinal-3-30ml
medik8-crystal-retinal-6-30ml
naturium-alpha-arbutin-serum-2-percent-1fl-oz
naturium-azelaic-acid-derivative-complex-10-1fl-oz
naturium-barrier-bounce-bi-phase-mist-100ml
naturium-bha-liquid-exfoliant-2-4oz
naturium-bio-lipid-restoring-body-lotion-14oz
naturium-brightener-vitamin-c-body-wash-500ml
naturium-energizer-mandelic-acid-body-wash-500ml
naturium-fermented-camellia-creamy-cleansing-oil-3-5oz
naturium-fermented-rice-enzyme-cleanser-4oz
naturium-glow-getter-body-oil-100ml
naturium-glow-getter-multi-oil-body-butter-7-7oz
naturium-glow-getter-multi-oil-hydrating-body-wash-500ml
naturium-intense-overnight-sleeping-cream-1-7oz
naturium-marshmallow-root-barrier-balm-1-7oz
naturium-multi-peptide-advanced-body-wash-500ml
naturium-niacinamide-cleansing-gelee-3-7-1oz
naturium-niacinamide-serum-12-percent-1fl-oz
naturium-phyto-glow-lip-balm-clear-0-34oz
naturium-purifier-niacinamide-body-wash-500ml
naturium-quadruple-hyaluronic-acid-serum-5-1fl-oz
naturium-retinol-complex-cream-1-7oz
naturium-retinol-complex-serum-1fl-oz
naturium-salicylic-acid-serum-2-percent-1fl-oz
naturium-skin-renewing-retinol-body-lotion-8oz
naturium-the-perfector-salicylic-acid-body-wash-500ml
naturium-the-smoother-glycolic-acid-exfoliating-body-wash-500ml
naturium-tranexamic-topical-acid-5-1fl-oz
naturium-uv-reflect-antioxidant-spf-50-1-7fl-oz
naturium-vitamin-bright-illuminating-eye-cream-0-5oz
naturium-vitamin-c-complex-serum-1fl-oz
naturium-vitamin-c-complex-serum-jumbo-2fl-oz
naturium-vitamin-c-super-serum-plus-1fl-oz
neutrogena-light-sesame-body-oil-8-5oz
nineless-a-control-azelaic-acid-cream-50ml
```

## Pending cohort B · manufacturer source only (28)

Blocker: add a separate authoritative clinical source that directly fits the
proposed use and warnings, then perform the exact formula/use review. Do not
turn manufacturer efficacy copy into clinical authority.

```text
aqua-rich-licorice-mulberry-body-lotion-500ml
aqua-rich-licorice-mulberry-body-wash-1000ml
aqua-rich-niacinamide-alpha-arbutin-body-wash-1000ml
aqua-rich-turmeric-vitamin-c-body-lotion-500ml
aqua-rich-turmeric-vitamin-c-body-wash-1000ml
dove-calming-moisture-body-wash-547ml
dove-melanin-even-tone-body-wash-18-5oz
dr-teals-nourish-protect-coconut-oil-body-wash-710ml
estelin-ultra-light-hydrating-invisible-sunscreen-spf-50-50g
facefacts-ceramide-foaming-cleanser-400ml
garnier-pure-active-tea-tree-salicylic-acid-tissue-mask
garnier-vitamin-c-brightening-day-cream-50ml
naturium-azelaic-acid-emulsion-10-1fl-oz
naturium-dew-glow-mineral-spf-50-1-7fl-oz
naturium-glow-getter-multi-oil-body-scrub-8oz
naturium-kp-body-scrub-mask-8oz
naturium-multi-active-exosome-serum-1fl-oz
naturium-multi-peptide-advanced-serum-1fl-oz
naturium-multi-peptide-eye-cream-0-5oz
naturium-multi-peptide-moisturizer-1-7oz
naturium-niacinamide-gel-cream-5-1-7oz
naturium-plant-ceramide-rich-moisture-cream-1-7oz
naturium-purple-ginseng-cleansing-balm-3oz
naturium-retinaldehyde-cream-serum-0-05-1-7oz
naturium-retinaldehyde-cream-serum-0-10-1-7oz
naturium-smoother-glycolic-acid-body-lotion-8oz
nineless-mela-pro-tranexamic-acid-sunscreen-100ml
olay-super-serum-body-wash-normal-skin-547ml
```

## Pending cohort C · no accepted care sources (16)

Blocker: first bind the exact official variant, size and current formula or
label page, then add separate authoritative clinical guidance. Retailer copy,
catalogue prose and product names cannot fill either source. The current LUSH
370 ml page is an identity/product lead, but its marketing claim does not prove
an active dandruff treatment; the dandruff relationship therefore remains
blocked pending exact formula/label evidence.

```text
amika-the-kure-conditioner-275ml
b-lab-matcha-hydrating-real-sunscreen
cosrx-salicylic-acid-daily-gentle-cleanser
disaar-argan-oil-body-oil-gel
dove-moroccan-argan-oil-beauty-bar
face-facts-bright-clear-face-cream
face-facts-wonder-cream-fragrance-free
facefacts-enhance-gel-cream-cleanser-150ml
kuza-indian-hemp-hair-scalp-treatment
la-roche-posay-anthelios-uvmune-400-oil-control-fluid
la-roche-posay-toleriane-double-repair-matte
la-roche-posay-toleriane-double-repair-spf30
lush-hair-mentholated-conditioner
mediana-leave-in-conditioning-milk
skin-by-zaron-vitamin-c-body-lotion-500ml
some-by-mi-aha-bha-pha-miracle-toner
```

## Next cohorts

1. Review the lower-risk exact moisturiser, cleanser, sunscreen and hair-care
   cells in cohort A, keeping targeted-actives separate.
2. Add independent guidance to cohort B before changing any state.
3. Re-establish exact official formula/label evidence for cohort C before
   spending time on concern mapping.
4. Resolve Replenix identity/size outside this care lane; do not relabel it from
   the stale 7 oz atom.
