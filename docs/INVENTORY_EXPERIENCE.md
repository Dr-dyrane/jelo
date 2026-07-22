# Inventory experience

Updated: 2026-07-22

## References studied

- [Apple Store](https://www.apple.com/store)
- [Apple accessories catalogue](https://www.apple.com/shop/accessories/all)
- [Shop Explore](https://shop.app/categories)
- [Shop Beauty](https://shop.app/categories/5/beauty)
- [Open Beauty Facts data exports](https://world.openbeautyfacts.org/data)
- [Open Beauty Facts API notes](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/)

## What the references do well

Apple makes one task dominant at a time. Search is prominent, browse modes are explicit, visual categories are easy to scan, and curated shelves come before the full catalogue. Service reassurance follows the products instead of interrupting discovery.

Shop makes a large catalogue feel current. It uses compact visual category rails, human-led editorial collections, dense product signals, and repeated horizontal shelves instead of one endless grid.

## JeloCare direction

JeloCare combines that hierarchy with information the references do not provide:

- browse by concern, routine, or category;
- Nigeria-first verified price and availability when known;
- a visible distinction between JeloCare-reviewed and community-sourced records;
- source, barcode, and update provenance for imported records;
- clinical matching only for products that JeloCare has actually reviewed;
- paged server-side catalogue results instead of sending 1,000 records to the browser.

The page order is:

1. concise photographic introduction;
2. persistent search task;
3. browse-mode rail;
4. editorial people-led collection stories;
5. curated reviewed-product shelves;
6. paged all-products catalogue with a filter sheet;
7. source, review, price, and affiliate disclosure.

## Visual rules

- Peach, blush pink, and cream are the primary surfaces. Brown is not a page background.
- People photography appears through the page, not only in the hero.
- Text never depends on a busy image for contrast. It sits beside the image or on an opaque/high-contrast surface.
- Glass is reserved for depth over photography or a floating command surface. It has no decorative border.
- Product and editorial rails hide scrollbars, retain keyboard scrolling, use snap points, and show an edge cue.
- Typography remains light. Semibold is reserved for compact controls and status labels.
- Icons come from the existing Lucide set. No emoji icons.
- Company identity stays a quiet text label. Avoid decorative badges and inconsistent third-party logo marks.
- Every filter change lands on the results and shows what changed, the result count, removable filters, Undo, and Clear.

The complete cross-site interaction contract is in [UI_PHILOSOPHY.md](./UI_PHILOSOPHY.md).

## Filter model

The compact catalogue view exposes browse rails and a single filter trigger. The responsive sheet may combine source, category, company, reviewed function, reviewed concern, market, fresh exact price, and order. It must not infer sale status, gender/sex suitability, stock, or clinical fit from missing data.

Brand/company filtering uses the product brand as the accurate current entity. Parent-company ownership is a separate future provenance field and must not be guessed.

## Catalogue trust model

The catalogue keeps candidate count, public approval, and recommendation eligibility separate:

- 23 `reviewed` records remain browsable;
- 2 records currently pass the explicit supportive-care gate for direct guidance;
- 5 require pharmacist review and 16 remain guidance-ineligible pending better formula evidence;
- 977 barcode-linked Open Beauty Facts records are a private candidate pool, not a publication target;
- a community candidate becomes public only through an identity-bound approval in `data/external-product-approvals.json`;
- approving a community record for discovery never makes it recommendation-eligible.

Imported records must have a barcode, product name, brand, mapped beauty category, source record URL, source-hosted product image, and source update timestamp. They are deduplicated against reviewed records and each other.

The Open Beauty Facts `qualityScore` only prioritizes private review after hard gates. It cannot compensate for missing exact-SKU identity, formula/care review, Nigerian regulatory evidence, or market evidence, and must never be described as product quality, evidence, Nigerian availability, or market demand.

Community publication requires a reviewed formula archetype and care tier plus Nigerian regulatory status. `pending` stays private. Market evidence must be either Tier-A identity evidence with two independent fresh exact Nigerian offers, or brand-confirmed Nigerian authorization with one fresh exact offer. Open Beauty Facts data, ingredients, or photography alone can never satisfy these gates.

Public image approval requires documented rights, intact packaging, exact label/variant/size, catalogue fit, and a magazine-ready final image. An untouched licensed photograph, official brand asset, or owned editorial photograph may pass. A generated or composited scene may also pass when the source package identity is exact, packaging is not invented, label/variant/size are unchanged, and a reviewer compares source and final output. Raw background-extracted cutouts remain private production inputs.

Approvals bind the barcode, source snapshot, raw candidate fingerprint, final image hash, reviewer, timestamp, rights source, and final-image attestations. Any candidate or image change invalidates the approval.

The same deterministic audit dimensions—identity, formula completeness, evidence level, exact Nigerian listing, image rights, and final presentation—can be applied to the 23 reviewed products. Publication quality and direct-care eligibility remain separate gates.

Open Beauty Facts asks bulk reusers to use the nightly export instead of repeated search calls. The ingestion job therefore streams the official JSONL export. The database is ODbL 1.0, individual contents use the Database Contents License, and product photos use CC BY-SA 3.0. Attribution and source links remain visible in the product catalogue.

## Anti-patterns

- no fabricated products, prices, ratings, reviews, ingredients, or diagnoses;
- no count target or automated quality score can publish a candidate;
- no raw background-removed cutout can become final public imagery;
- no imported product is labelled evidence-led or sensitive-friendly without a JeloCare review;
- no remote source price is treated as current without a fresh exact-product check;
- no client-side rendering of all 1,000 records;
- no filter panel that permanently pushes the catalogue down;
- no copy placed directly over uncontrolled image detail.
