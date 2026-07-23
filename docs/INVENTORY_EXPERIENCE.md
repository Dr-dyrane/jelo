# Inventory experience

Updated: 2026-07-23

## References studied

- [Apple Store](https://www.apple.com/store)
- [Apple accessories catalogue](https://www.apple.com/shop/accessories/all)
- [Shop Explore](https://shop.app/categories)
- [Shop Beauty](https://shop.app/categories/5/beauty)
- [Shop customer search and discovery](https://help.shopify.com/en/manual/online-sales-channels/shop/customer-experience)
- [Shop products and collections](https://help.shopify.com/en/manual/online-sales-channels/shop/manage-shop-store/products-and-collections)
- [Shop product reviews](https://help.shopify.com/en/manual/online-sales-channels/shop/product-reviews)
- [Open Beauty Facts data exports](https://world.openbeautyfacts.org/data)
- [Open Beauty Facts API notes](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/)

## What the references do well

Apple makes one task dominant at a time. Search is prominent, browse modes are explicit, visual categories are easy to scan, and curated shelves come before the full catalogue. Service reassurance follows the products instead of interrupting discovery.

Shop makes a large catalogue feel current. It uses compact visual category rails, human-led editorial collections, dense product signals, and repeated horizontal shelves instead of one endless grid.

The live catalogue review on 2026-07-22 also set useful limits. Apple does not lead with a large filter system on its all-accessories page; clear taxonomy and short curated shelves do most of the work. Shop starts search with concrete suggestions and puts company, current price, meaningful discount, and purchase-linked review evidence on cards. JeloCare can borrow the discovery hierarchy, but not ratings, sale claims, or personalization signals it cannot independently verify.

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

Current cards keep evidence compact: exact fresh comparable offers render as a lowest observed price plus the number of stores in that comparison. A single observation is not presented as a multi-store comparison. Search assistance provides reversible company and category suggestions with keyboard support. On desktop and tablet it remains a sticky command surface beneath the main navigation; on mobile it stays in normal flow so it does not consume the small viewport. Category, routine, and concern are separate browse modes. Routine uses only the neutral `step` metadata on reviewed products; it does not establish suitability or clinical evidence. Switching market preserves the current catalogue intent and resets only pagination. Filtered result anchors reserve clearance beneath both surfaces. Broader multi-select facets remain later work. Every facet must stay auditable, hide zero-result choices, and never turn a condition pattern into product matching.

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

- JeloCare's original 14 products from `pages-v1-static` are the required foundational cohort in `data/jelo-core-products.ts`; every product must remain in the reviewed catalogue with its original category and routine-step classification, while public display still fails closed until its exact transparent packshot passes the image gate;
- 23 reviewed source records remain in the research set;
- public shelves are derived only from records whose canonical packshot is transparent, at least 1,000 × 1,000, identity-safe, not under a rights hold, and approved by exact file hash after peach/pink/dark surface review;
- generated packshot repairs fail before upload when the lower silhouette is flat or when a long high-contrast seam near the base still makes the package read as sliced; the same repair-specific check runs again against the public Blob bytes;
- 2 source records currently pass the explicit supportive-care gate for direct guidance, but they appear publicly only when they also pass the image gate;
- 5 require pharmacist review and 16 remain guidance-ineligible pending better formula evidence;
- the checked-in barcode-linked Open Beauty Facts records are a frozen legacy research pool, not a target or intake queue;
- the Nigerian batch screen is a private discovery queue whose retailer SKU, price, stock and image fields remain unverified leads;
- new candidates enter the private per-SKU queue in `data/catalogue-intake.json` and advance only through explicit identity, care, Nigeria, rights, editorial, and approval-draft gates;
- `data/external-product-approvals.json` remains empty and every non-empty legacy manifest is rejected;
- legacy community records cannot become public or recommendation-eligible through that retired path.

Current derived state is 23 reviewed research records, 23 public products, 977 frozen private bulk candidates, 1,000 screened Nigerian retailer leads, 12 deliberate per-SKU intake candidates, 12 canonical identity artifacts, 8 approval-ready intake candidates, 8 private publication dossiers and 8 explicit public releases. CeraVe Hydrating Cleanser 473 ml is the first neutral-reference release: its official EAN, bounded care review, ₦15,265 BuyBetter listing and 2,000 × 2,000 transparent display image are bound into the release. CeraVe Moisturising Cream 454 g is the second: its official EAN and directions, bounded care review, current ₦22,500 Nectar Beauty Hub listing and identity-matched generated transparent packshot are bound together. Eucerin Oil Control Sun Gel-Cream SPF 50+ 50 ml is the third: its official GTIN, care guidance, current ₦18,850 in-stock Beauty by Daz listing, ₦17,363 out-of-stock Nectar listing and generated transparent packshot are bound together. Eucerin UreaRepair PLUS 10% Urea Body Lotion 250 ml is the fourth: its official GTIN and directions, bounded dry-skin care review, current ₦25,000 BuyBetter and ₦27,410 Jumia listings, and identity-matched transparent packshot are bound into one release. Dove Melanin Even Tone 5% Body Wash 547 ml is the fifth: its official GTIN and manufacturer directions, bounded daily-care review, current ₦22,600 low-stock BuyBetter listing, ₦17,800 out-of-stock Teeka4 listing, and identity-matched transparent packshot are bound into one release. KeraCare Dry & Itchy Conditioner 950 ml is the sixth: its current official 32 oz GTIN, revisioned DailyMed 950 ml label, bounded 1% pyrithione-zinc care review, ₦38,485 BuyBetter offer, ₦43,485 Ediths Essentials offer and identity-matched transparent packshot are bound together. Balance Active Formula Salicylic Acid + Zinc Clarifying Toner 200 ml is the seventh: its official GTIN and directions, bounded targeted-care review, current ₦8,400 BuyBetter offer, ₦9,200 24Eleven offer and identity-matched transparent packshot are bound together. CeraVe Acne Foaming Cream Wash 10% Benzoyl Peroxide 150 ml is the eighth: its official GTIN and directions, bounded targeted-care review, current ₦23,850 Beauty by Daz and ₦24,500 Teeka4 offers, and identity-matched transparent packshot are bound together. Exact variant-and-size retailer pages may correlate to the official identity while their separately labelled local SKUs remain local and are never presented as manufacturer barcodes. NAFDAC searches remain contextual research and do not block an otherwise verified product, price or image. The two exact Aqua Rich 500 ml identities have narrow daily-moisturising reviews; sunscreen and treatment claims remain excluded, and their Nigerian retailer pages remain research observations until those pages expose the exact manufacturer identity. The Garnier Vitamin C Brightening Day Cream 50 ml now has an official GTIN and current BuyBetter and Slique observations, but those retailer pages do not yet bind an exact manufacturer identifier, so no comparison price is published. Dove’s official identity is bound through a hash-reviewed browser DOM capture; its BuyBetter and Teeka4 pages independently resolve to the same exact 547 ml presentation, while Slique remains excluded because its EAN conflicts and the retailer is provisional. The `publicCatalogueCount` value inside the frozen legacy bulk metadata describes the retired count-first release target; neither that value nor the discovery-lead count is current public inventory or suitable UI copy.

Run `npm run catalogue:pipeline:status` for the current live, discovery, prioritized-research, intake, exact-offer, almost-ready, dossier and explicit-release counts. “Almost ready” means a candidate already has a fresh exact Nigerian offer and exactly one publication blocker left.

Anonymous community submissions feed a separate research-signal report. With a server database environment loaded, run `npm run community:research:signals` to see aggregate product, retailer, purpose, price and pending-vocabulary signals. The report contains no contributor identity and labels every result `community_reported`; it can change research order but cannot satisfy identity, exact-offer, care, rights, image or publication gates.

The verified ingestion path no longer ends at a private dossier. A separate immutable release manifest now binds presentation and publication review, re-verifies the full candidate and dossier, materializes identity, final image and exact offers from the dossier, and keeps the product recommendation-ineligible by default. An empty release manifest publishes nothing; a dossier without a release remains private.

The discovery batch is regenerated with `npm run catalogue:discovery:screen -- --target=1000 --write=data/catalogue-discovery-screening.json` and verified offline with `npm run catalogue:discovery:audit`. Its selection balances categories after hard preflight checks. It never upgrades a retailer SKU into a manufacturer GTIN, a product image URL into reuse permission, or a current listing into regulatory or clinical evidence.

Imported records must have a barcode, product name, brand, mapped beauty category, source record URL, source-hosted product image, and source update timestamp. They are deduplicated against reviewed records and each other.

The Open Beauty Facts `qualityScore` only prioritizes private review after hard gates. It cannot compensate for missing exact-SKU identity, formula/care review or market evidence, and must never be described as product quality, evidence, Nigerian availability, or market demand.

New publication research uses the private per-SKU intake path, not the frozen community approval path. It requires candidate-scoped manufacturer care evidence and either two independently reviewed exact Nigerian offer representations or one exact offer plus a reviewer-attributed brand-source seller authorization. NAFDAC research is retained as non-blocking context. Open Beauty Facts data, ingredients, photography or score can never satisfy publication gates.

Provisional seller observations may help a reviewer understand availability and price spread, but they do not count as either of the two independent Tier-A retailers. The intake audit keeps that distinction machine-readable.

The current static subset has a display approval, not a reuse licence. Each record binds exact brand/name/size, source URL, final hash, source review, art review, and peach/pink/dark checks, while explicitly recording `rightsStatus: not-verified`. Known prohibitions are withheld; permission provenance remains open and must not be implied in the UI or docs.

New intake image approval requires documented rights, intact packaging, exact label/variant/size, catalogue fit, and a magazine-ready final image. An untouched licensed photograph, permitted official brand asset, owned editorial photograph, or polished transparent isolation may pass. Background removal must retain source package pixels; it cannot redraw the label, colour, materials, geometry, claims, or size. Generated or composited scenery may pass only when the package itself remains source-faithful and a reviewer compares source and final output. Unreviewed extraction output remains private.

New intake approvals bind the barcode, source snapshot, raw candidate fingerprint, final image hash, reviewer, timestamp, rights source, and final-image attestations. Any candidate or image change invalidates the approval.

The same deterministic audit dimensions—identity, formula completeness, evidence level, exact Nigerian listing, image rights, and final presentation—apply to all 23 reviewed source records. Publication quality and direct-care eligibility remain separate gates.

Open Beauty Facts asks bulk reusers to use the nightly export instead of repeated search calls. The ingestion job therefore streams the official JSONL export. The database is ODbL 1.0, individual contents use the Database Contents License, and product photos use CC BY-SA 3.0. Attribution and source links remain visible in the product catalogue.

## Anti-patterns

- no fabricated products, prices, ratings, reviews, ingredients, or diagnoses;
- no count target or automated quality score can publish a candidate;
- no unreviewed background-removal output can become final public imagery;
- no imported product is labelled evidence-led or sensitive-friendly without a JeloCare review;
- no remote source price is treated as current without a fresh exact-product check;
- no client-side rendering of all 1,000 records;
- no filter panel that permanently pushes the catalogue down;
- no copy placed directly over uncontrolled image detail.
