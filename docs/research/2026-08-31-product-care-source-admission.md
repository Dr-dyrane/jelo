# Product care source admission and global review queue

Date: 2026-08-31
Status: research and source-admission contract; no automatic care promotion

## Outcome

Every public product now has a deterministic care cell and one explicit,
editable handoff into Ask Jelo's assessment. The handoff carries the public
product name and asks the customer to add what they are noticing; it does not
claim that Ask Jelo already knows how the product fits them. The research
boundary remains claim-specific: a product page can prove the exact identity,
formula, directions and warnings it publishes, while independent clinical
guidance can support a condition-level statement. Neither source may silently
stand in for the other.

The current 163-product matrix contains:

- 22 `supportive_eligible` cells;
- 39 `pharmacist_review` cells in the exact
  `pharmacy-care-review/2026-08-31/v1` context-only cohort; and
- 102 `insufficient_data` cells awaiting verified formula or ingredient
  binding and a named human care decision.

Source coverage is 113 claim-scoped pairs, 41 single-role records and nine
records without a care source. All 267 current source entries are HTTPS. This
describes coverage, not topical relevance or approval.

## Source hierarchy

No single source is treated as proof of identity, legal status, safety and
effectiveness together.

1. An exact regulator record or current label may establish identifiers,
   strength, allowed use, directions, warnings and jurisdiction. A DailyMed
   record is label evidence, not proof that FDA approved the product.
2. An exact official manufacturer page or physical pack may establish the
   manufacturer's current identity, formula, directions, warnings and claims.
   It is not independent efficacy evidence or Nigerian registration.
3. An evidence-based guideline or public-health authority may establish
   condition-level care, cautions and referral boundaries. It does not endorse
   a catalogue SKU.
4. A systematic review or ingredient risk assessment may support an active or
   formulation statement within the studied concentration, route and use. It
   does not prove an unstudied finished product.
5. Retailer pages, snippets, user reviews, social posts and ingredient
   aggregators are discovery inputs only.

Source roles fail closed. Only an explicit manufacturer or brand-owner host
may count as product evidence, and only an explicit clinical, research, label
or regulator host may count as claim context. A new or unknown host is marked
pending review and cannot satisfy the claim-scoped pair gate.

Primary reference points:

- [NAFDAC Greenbook](https://greenbook.nafdac.gov.ng/) and
  [NAPAMS verification](https://registration.nafdac.gov.ng/);
- [DailyMed](https://dailymed.nlm.nih.gov/) and
  [Drugs@FDA](https://www.fda.gov/drugs/drug-approvals-and-databases/about-drugsfda);
- [FDA OTC monographs](https://www.accessdata.fda.gov/scripts/cder/omuf/index.cfm),
  including [M006 for topical acne products](https://www.accessdata.fda.gov/drugsatfda_docs/omuf/monographs/OTC%20Monograph_M006-Topical%20Acne%20drug%20products%20for%20OTC%20Human%20Use%2011.23.2021.pdf);
- [AAD clinical guidelines](https://www.aad.org/member/clinical-quality/guidelines),
  [NICE guidance](https://www.nice.org.uk/guidance), and
  [WHO health topics](https://www.who.int/health-topics);
- [Cochrane evidence](https://www.cochrane.org/evidence) and
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/);
- [SCCS opinions](https://health.ec.europa.eu/scientific-committees/scientific-committee-consumer-safety-sccs/sccs-opinions_en).

## Admission rules

A product-level source packet is admissible only when it records:

- exact brand, product, size, dosage form, strength or SPF, market and package
  identifiers where available;
- jurisdiction, source role, retrieval time, version or effective date, and a
  content digest;
- the complete relevant directions and warnings alongside any claim;
- an exact-product or exact-formula source plus claim-matched independent
  context; and
- the reviewer decision and unresolved conflicts.

Ingredient-to-product, leave-on-to-rinse-off, concentration, regional formula,
adult-to-child or cosmetic-to-disease scope promotion is prohibited. A changed
page, redirect, ambiguous package, missing regulator status or formulation
conflict fails closed. A missing Greenbook result is recorded as "not located,"
not "unregistered."

## First exact-label cohort

The first bounded evidence packet covers five declared-strength U.S. OTC acne
products already in the catalogue. Exact manufacturer identity and DailyMed
labels were checked on 2026-08-31.

| Product                                                       | Exact public evidence                                                                                                                                                                                                           | Review boundary                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| PanOxyl Acne Foaming Wash 10%, 156 g                          | [Manufacturer](https://panoxyl.com/acne-products/acne-foaming-wash-benzoyl-peroxide/); [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1660f219-e789-91f1-e063-6294a90a7664)                                | Exact identity and label-bound acne context admitted. Product and label inactive-ingredient lists differ.                           |
| PanOxyl Acne Creamy Wash 4%, 170 g                            | [Manufacturer](https://panoxyl.com/acne-products/acne-creamy-wash/); [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7b301b94-3cc8-b05b-e053-2991aa0aa561)                                                  | Exact identity and label context admitted. The structured SPL strength conflicts with the Drug Facts panel and must be reconciled.  |
| CeraVe Acne Foaming Cream Cleanser 4%, 150 mL                 | [Manufacturer](https://www.cerave.com/skincare/cleansers/acne-benzoyl-peroxide-cleanser); [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d9c11b75-14ee-46e3-9b1d-c349a102e2fd)                             | Exact identity and label context admitted. Current manufacturer and submitted label frequency differ.                               |
| CeraVe Acne Foaming Cream Wash 10%, 150 mL                    | [Manufacturer](https://www.cerave.com/skincare/cleansers/facial-cleansers/benzoyl-peroxide-face-wash); [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=06950d35-daa8-4ea3-bd33-6e9c162e2a63)                | Exact identity and label context admitted. Current manufacturer and submitted label frequency differ.                               |
| De La Cruz Maximum Strength Acne Treatment 10% Sulfur, 73.7 g | [Manufacturer](https://dlclabs.com/products/de-la-cruz-acne-treatment-maximum-strength-with-10-sulfur-2-6-oz-73-7-g); [DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4a1591e8-6135-4b22-b54c-5553c2dc0540) | Exact identity, wash-off directions and label-bound acne context admitted. Do not conflate the 73.7 g jar with other presentations. |

Exact public identifier bindings:

- PanOxyl 10%: GTIN `00303160228551`, package NDC `0316-0228-55`;
- PanOxyl 4%: GTIN `00303160227066`, package NDC `0316-0227-06`;
- CeraVe 4%: GTIN `3606000512238`, package NDC `49967-238-01`;
- CeraVe 10%: GTIN `3606000604520`, package NDC `49967-604-01`; and
- De La Cruz 10% sulfur: GTIN `024286150426`, package NDC
  `24286-1574-3`.

The following SHA-256 values bind the 2026-08-31 decoded manufacturer-page
response and current DailyMed SPL XML response used for this review:

| Product               | Manufacturer response                                              | DailyMed SPL XML                                                   |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| PanOxyl 10%           | `08f5be55fce28b7fd675bf0fc4e5ce72f06a6548ef276a19a0418a9db73e6c8d` | `69c2b92e53d0ded9e0cc23a801fea1257c4338aeca8abe3daf11a918e641b7d7` |
| PanOxyl 4%            | `7d4dcd523712b26f048bfe2ccb521386018aab14e5ec53b43d55f2529f73e1d1` | `ea9cad10db8d9feb0886105c31b6a9ca1cbb9bf078ebf0b2c3b9086081242460` |
| CeraVe 4%             | `8369f7228e66c2efdb8f481a33f2ffc8b1aee20a15c77e86980f660feab06c2c` | `a66b19d55dca662a0741f3e59c9cc13955569335877eeb9915ce03f96c1f817e` |
| CeraVe 10%            | `92ee4b949bb167e5be1f1a116aa718afabc33686bb04728bcf21d29fd8996679` | `7813f876fb5f1e2d227ffad640db71d03913a03b691ea0a5954da4f57238581a` |
| De La Cruz 10% sulfur | `0514d23754f090ac559c919d32a44168aa27fccc67dc42416848fb67bb3dd358` | `f935961143e34dcd79c87d1d295202762b7508dab1dc8778dc899d743e1a47d9` |

The declared benzoyl peroxide and sulfur strengths fall within M006 ranges,
but that is not individual FDA approval or a complete conformance
certification. No exact NAFDAC Greenbook row was located for these five during
normal public searches; no access control or CAPTCHA was bypassed.

All five remain context only. No skin-type inference, personalized suitability,
Nigerian registration claim, dosing normalization or recommendation promotion
is admitted until the named reviewer resolves the recorded conflicts and binds
an exact decision to the exact product evidence digest.

## Next cohorts

The next independently reviewable cohorts are sunscreens, dandruff and scalp
actives, barrier and dry-skin products, then tone and texture actives. The 36
intake-to-care source differences should be reconciled first; the ten existing
cross-ledger guidance divergences require human adjudication rather than a
blind copy.

Automation may assemble, hash, diff and queue packets. It may not attest,
diagnose, prescribe, dispense, infer suitability or promote a care state.
