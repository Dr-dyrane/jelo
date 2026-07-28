# Inventory experience

Updated: 2026-07-27

## References studied

- [Apple Store](https://www.apple.com/store)
- [Apple accessories catalogue](https://www.apple.com/shop/accessories/all)
- [Apple Store app](https://apps.apple.com/us/app/apple-store/id375380948)
- [Shop discovery](https://help.shop.app/en/shop/shopping/discover)
- [Shop saved products and stores](https://help.shop.app/en/shop/shopping/discover/save-products-and-follow-stores)
- [Shop recommendation controls](https://help.shop.app/en/shop/shopping/discover/manage-recommendations)
- [Shop customer search and discovery](https://help.shopify.com/en/manual/online-sales-channels/shop/customer-experience)
- [Shop products and collections](https://help.shopify.com/en/manual/online-sales-channels/shop/manage-shop-store/products-and-collections)
- [Shop product reviews](https://help.shopify.com/en/manual/online-sales-channels/shop/product-reviews)
- [Open Beauty Facts data exports](https://world.openbeautyfacts.org/data)
- [Open Beauty Facts API notes](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/)
- [2026 catalogue benchmark](./research/2026-07-26-inventory-catalogue-benchmark.md)

## What the references do well

Apple makes one task dominant at a time. Search is prominent, browse modes are explicit, visual categories are easy to scan, and curated shelves come before the full catalogue. Service reassurance follows the products instead of interrupting discovery.

Shop makes a large catalogue feel current. Search accepts product, brand and
category intent; relevant refinements appear in context; and the home feed
combines recommendations, recent activity, saved-item changes and followed
stores. Its recommendation controls are immediate and reversible. JeloCare
borrows the explicit state feedback and repeated discovery shelves, not opaque
purchase-history ranking.

The live catalogue review on 2026-07-22 also set useful limits. Apple does not lead with a large filter system on its all-accessories page; clear taxonomy and short curated shelves do most of the work. Shop starts search with concrete suggestions and puts company, current price, meaningful discount, and purchase-linked review evidence on cards. JeloCare can borrow the discovery hierarchy, but not ratings, sale claims, or personalization signals it cannot independently verify.

## JeloCare direction

JeloCare combines that hierarchy with information the references do not provide:

- browse by concern, routine, or category;
- Nigeria-first verified price and availability when known;
- a visible distinction between JeloCare-reviewed and community-sourced records;
- source, barcode, and update provenance for imported records;
- clinical matching only for products that JeloCare has actually reviewed;
- progressive server-side catalogue results instead of sending the full inventory to the browser.

The page order is:

1. concise photographic introduction;
2. persistent search task;
3. browse-mode rail;
4. editorial people-led collection stories;
5. curated reviewed-product shelves;
6. progressively continued all-products catalogue with a filter sheet;
7. source, review, price, and affiliate disclosure.

Current cards keep evidence compact: exact fresh comparable offers render as a lowest observed price plus the number of stores in that comparison. A single observation is not presented as a multi-store comparison. Search assistance provides reversible company and category suggestions with keyboard support. On desktop and tablet it remains a sticky command surface beneath the main navigation; on mobile it stays in normal flow so it does not consume the small viewport. Category, routine, and concern are separate browse modes. Routine uses only the neutral `step` metadata on reviewed products; it does not establish suitability or clinical evidence. Switching market preserves the current catalogue intent and resets only pagination. Filtered result anchors reserve clearance beneath both surfaces. Broader multi-select facets remain later work. Every facet must stay auditable, hide zero-result choices, and never turn a condition pattern into product matching.

The first filter view is contextual. Search prioritizes only useful
non-clinical refinements; explicit category, routine and concern browse modes
lead with their corresponding group. The policy derives usefulness from the
same server projection as the result set, including exact current-price bands.
It never interprets query words as concern suitability. Active groups stay
visible even at zero, and one quiet **All refinements** control exposes the
remaining useful groups without turning the sheet into a permanent filter
wall.

The all-products result path renders 24 products on the server. Near the end of
the grid it may append at most two pages automatically; a visible,
keyboard-operable **Load more** control remains available after that boundary.
Each request is limited to four server pages, appends by stable product ID, and
leaves settled cards in place on failure. Pending requests use matching card
skeletons; retry, appended-count, and terminal states are announced through one
polite status. The deepest loaded page is written to the existing catalogue URL
without creating a new history entry. Returning, refreshing, or sharing that
URL rebuilds the cumulative state from the bounded server pages. Filters and
market changes continue to reset pagination, and automatic continuation stops
before it can make the public footer unreachable.

`app/(site)/products/page.tsx` and `components/products/inventory-results.tsx`
are the canonical inventory result path. The earlier client-only explorer,
dense search result, and numbered pagination implementations were removed so
future catalogue work cannot accidentally target a dormant experience.

Two inventory shelves now use explicit, testable rules. **Fresh price checks**
orders public reviewed products by the newest still-valid exact-market
observation. **Under ₦10,000** (or **Under $15** in the US view) includes a
product only when its lowest current comparable observation is below that
ceiling. Search matches, stale pages, unavailable offers, excluded prices and
wrong-market observations cannot enter either shelf. Neither rule uses
affiliate value, clicks, popularity, stock pressure or a product-quality score.

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

The compact catalogue view exposes browse rails and a single filter trigger.
The responsive sheet combines source, category, company, routine, reviewed
concern, fresh exact price, price band, and order only when each group can help
with the current context or is already active. Remaining useful groups sit
behind **All refinements**. Counts are exact server-derived projections; active
zero-count values remain removable. The sheet must not infer sale status,
gender/sex suitability, stock, or clinical fit from missing data.

Brand/company filtering uses the product brand as the accurate current entity. Parent-company ownership is a separate future provenance field and must not be guessed.

## Catalogue trust model

The catalogue keeps candidate count, public approval, and recommendation eligibility separate:

- JeloCare's original 14 products from `pages-v1-static` are the required foundational cohort in `data/jelo-core-products.ts`; every product must remain in the reviewed catalogue with its original category and routine-step classification, while public display still fails closed until its exact transparent packshot passes the image gate;
- 24 reviewed source records remain in the research set;
- public shelves are derived only from records whose canonical packshot is transparent, at least 1,000 × 1,000, identity-safe, not under a rights hold, and approved by exact file hash after peach/pink/dark surface review;
- generated packshot repairs fail before upload when the lower silhouette is flat or when a long high-contrast seam near the base still makes the package read as sliced; the same repair-specific check runs again against the public Blob bytes;
- 2 source records currently pass the explicit supportive-care gate for direct guidance, but they appear publicly only when they also pass the image gate;
- 5 require pharmacist review and 17 remain guidance-ineligible pending better formula evidence;
- the checked-in barcode-linked Open Beauty Facts records are a frozen legacy research pool, not a target or intake queue;
- the Nigerian batch screen is a private discovery queue whose retailer SKU, price, stock and image fields remain unverified leads;
- new candidates enter through one packet-bound source in `data/catalogue-intake-candidates/`; the compiler projects the private queue into `data/catalogue-intake.json`, and candidates advance only through explicit identity, care, Nigeria, rights, editorial, and approval-draft gates;
- `data/external-product-approvals.json` remains empty and every non-empty legacy manifest is rejected;
- legacy community records cannot become public or recommendation-eligible through that retired path.

The authoritative 2026-07-26T08:21Z pipeline state is 24 reviewed research records, 46 live products, 977 frozen private bulk candidates, 1,000 screened Nigerian retailer leads, 48 prioritized research records, 31 deliberate per-SKU intake candidates, 30 canonical identity artifacts, 30 approval-ready candidates, 30 private publication dossiers and 30 explicit releases. The thirtieth release is the community-requested La Roche-Posay Mela B3 Serum 30 ml. The official L’Oréal catalogue binds the purple serum pack to GTIN `3337875890021`; Lux Beauty contributes a current ₦48,500 in-stock observation, while BuyBetter contributes a current ₦43,100 out-of-stock reference. Its content-addressed transparent 2,000 × 2,000 packshot records the official source bytes, complete image-generation prompt, provider, model, output hash and review chronology. Nigerian regulatory research remains useful context, not a publication gate. The separate post-publication care decision keeps the targeted serum in pharmacist review, so it may support neutral discovery without becoming a direct concern recommendation. The chronological release paragraphs below retain their earlier count snapshots; `npm run catalogue:pipeline:status` is the source of truth for current totals.

The fourteenth release is the original NINELESS A-Control 10% Azelaic Acid Serum 30 ml dropper, bound to two independent EAN sources, its official renewal comparison, current Beauty by Daz and BuyBetter offers, and a generated transparent packshot. The fifteenth is the original NINELESS Mela-Pro Rice & TXA Toner 200 ml: Qudo Beauty and Shop Apotheke corroborate EAN `8809875270172`; the official renewal image distinguishes the original translucent orange-cap bottle from the renewed opaque formula; BuyBetter and Muna Cosmetics provide current exact Nigerian offers; and the care boundary prevents the renewed 82% rice-bran formula from being attributed to older stock. The sixteenth is Face Facts Ceramide Oil Control Foaming Cleanser 400 ml: the manufacturer verifies the current pump and directions; SIAN Wholesale and eBay UK independently corroborate EAN `5031413953923`; BuyBetter and 24Eleven provide current exact Nigerian offers; and the generated transparent packshot is bound to the reviewed package version. The seventeenth is Face Facts Ceramide Hydrating Gentle Cleanser 400 ml: the manufacturer verifies the current green-label pump and directions; Lami Fragrance and eBay UK independently corroborate EAN `5031413928662`; Beauty by Daz, Teeka4 and 24Eleven provide current exact Nigerian offers; and the transparent packshot is bound to the reviewed package version. The eighteenth is Face Facts Ceramide Foaming Cleanser 400 ml: Lami Fragrance and Beauty Free independently corroborate EAN `5031413936636`; BuyBetter and 24Eleven provide current-pack offers at ₦6,450 and ₦6,800; Allure and Slique remain durable market observations but are excluded because they show the older green-collar package; and the neutral copy avoids repeating the manufacturer page's conflicting skin-type claims. Its identity-verified transparent packshot is 2,000 × 2,000 and bound by exact hash.

The earlier thirteen-release checkpoint contained 23 reviewed research records, 28 public products, 977 frozen private bulk candidates, 1,000 screened Nigerian retailer leads, 13 deliberate per-SKU intake candidates, 13 canonical identity artifacts, 13 approval-ready intake candidates, 13 private publication dossiers and 13 explicit public releases. CeraVe Hydrating Cleanser 473 ml is the first neutral-reference release: its official EAN, bounded care review, ₦15,265 BuyBetter listing and 2,000 × 2,000 transparent display image are bound into the release. CeraVe Moisturising Cream 454 g is the second: its official EAN and directions, bounded care review, current ₦22,500 Nectar Beauty Hub listing and identity-matched generated transparent packshot are bound together. Eucerin Oil Control Sun Gel-Cream SPF 50+ 50 ml is the third: its official GTIN, care guidance, current ₦18,850 in-stock Beauty by Daz listing, ₦17,363 out-of-stock Nectar listing and generated transparent packshot are bound together. Eucerin UreaRepair PLUS 10% Urea Body Lotion 250 ml is the fourth: its official GTIN and directions, bounded dry-skin care review, current ₦25,000 BuyBetter and ₦27,410 Jumia listings, and identity-matched transparent packshot are bound into one release. Dove Melanin Even Tone 5% Body Wash 547 ml is the fifth: its official GTIN and manufacturer directions, bounded daily-care review, current ₦22,600 low-stock BuyBetter listing, ₦17,800 out-of-stock Teeka4 listing, and identity-matched transparent packshot are bound into one release. KeraCare Dry & Itchy Conditioner 950 ml is the sixth: its current official 32 oz GTIN, revisioned DailyMed 950 ml label, bounded 1% pyrithione-zinc care review, ₦38,485 BuyBetter offer, ₦43,485 Ediths Essentials offer and identity-matched transparent packshot are bound together. Balance Active Formula Salicylic Acid + Zinc Clarifying Toner 200 ml is the seventh: its official GTIN and directions, bounded targeted-care review, current ₦8,400 BuyBetter offer, ₦9,200 24Eleven offer and identity-matched transparent packshot are bound together. CeraVe Acne Foaming Cream Wash 10% Benzoyl Peroxide 150 ml is the eighth: its official GTIN and directions, bounded targeted-care review, current ₦23,850 Beauty by Daz and ₦24,500 Teeka4 offers, and identity-matched transparent packshot are bound together. CeraVe SA Smoothing Cleanser 473 ml is the ninth: its official UK/EU GTIN and directions, bounded rough-and-bumpy-skin care review, current ₦20,900 Teeka4 and ₦23,800 24Eleven offers, and identity-matched transparent packshot are bound together. Garnier Vitamin C Brightening Day Cream 50 ml is the tenth: its official GTIN and directions, bounded daily-moisture review, current ₦11,833 Teeka4 and ₦12,728 BuyBetter offers, and identity-matched transparent packshot are bound together. Aqua Rich Hydrate + Protect Body Lotion 500 ml is the eleventh: its official EAN and ceramide variant, bounded daily-body-moisture review, current ₦12,800 BuyBetter and ₦13,000 CSi Grocery offers, and identity-matched transparent pump-bottle packshot are bound together. Aqua Rich Turmeric and Vitamin C Body Lotion 500 ml is the twelfth: its official EAN and exact Hydrating Bright variant, narrow daily-body-moisture review, current ₦10,750 BuyBetter and ₦12,000 Kadimez Essentials offers, and identity-matched transparent orange pump-bottle packshot are bound together. Balance Active Formula Niacinamide Blemish Recovery Serum 30 ml is the thirteenth: its official GTIN, complete manufacturer formula, narrow non-diagnostic niacinamide review, current ₦8,400 BuyBetter and ₦10,700 CSi Grocery offers, and identity-matched transparent amber-bottle packshot are bound together. Exact variant-and-size retailer pages may correlate to the official identity while their separately labelled local SKUs remain local and are never presented as manufacturer barcodes. NAFDAC searches remain contextual research and do not block an otherwise verified product, price or image. The Aqua Rich lotions remain neutral catalogue references: the ceramide variant is not presented as a sunscreen, and the turmeric and vitamin C variant is not presented as treatment for dark marks or another condition. The Balance serum remains a neutral reference and is not presented as acne treatment. Dove’s official identity is bound through a hash-reviewed browser DOM capture; its BuyBetter and Teeka4 pages independently resolve to the same exact 547 ml presentation, while Slique remains excluded because its EAN conflicts and the retailer is provisional. The `publicCatalogueCount` value inside the frozen legacy bulk metadata describes the retired count-first release target; neither that value nor the discovery-lead count is current public inventory or suitable UI copy.

Run `npm run catalogue:pipeline:status` for the current live, discovery, prioritized-research, intake, exact-offer, almost-ready, dossier and explicit-release counts. “Almost ready” means a candidate already has a fresh exact Nigerian offer and exactly one publication blocker left.

Anonymous community submissions feed a separate research-signal report. With a server database environment loaded, run `npm run community:research:signals` to see aggregate product, retailer, purpose, price and pending-vocabulary signals. The report contains no contributor identity and labels every result `community_reported`; it can change research order but cannot satisfy identity, exact-offer, care, rights, image or publication gates.

The verified ingestion path no longer ends at a private dossier. A separate immutable release manifest now binds presentation and publication review, re-verifies the full candidate and dossier, materializes identity, final image and exact offers from the dossier, and keeps the product recommendation-ineligible by default. An empty release manifest publishes nothing; a dossier without a release remains private.

The discovery batch is first reviewed with
`npm run catalogue:discovery:screen -- --target=1000 --baseline=data/catalogue-discovery-screening.json`.
Its source and candidate churn must be accepted with the exact reported token
before replacing the snapshot with
`--write=data/catalogue-discovery-screening.json --accept-refresh=<token>`,
then verified offline with `npm run catalogue:discovery:audit`. Its selection
balances categories after hard preflight checks. It never upgrades a retailer
SKU into a manufacturer GTIN, a product image URL into reuse permission, or a
current listing into regulatory or clinical evidence.

Imported records must have a barcode, product name, brand, mapped beauty category, source record URL, source-hosted product image, and source update timestamp. They are deduplicated against reviewed records and each other.

The Open Beauty Facts `qualityScore` only prioritizes private review after hard gates. It cannot compensate for missing exact-SKU identity, formula/care review or market evidence, and must never be described as product quality, evidence, Nigerian availability, or market demand.

New publication research uses the private per-SKU intake path, not the frozen community approval path. It requires candidate-scoped manufacturer care evidence and either two independently reviewed exact Nigerian offer representations or one exact offer plus a reviewer-attributed brand-source seller authorization. NAFDAC research is retained as non-blocking context. Open Beauty Facts data, ingredients, photography or score can never satisfy publication gates.

Provisional seller observations may help a reviewer understand availability and price spread, but they do not count as either of the two independent Tier-A retailers. The intake audit keeps that distinction machine-readable.

The current static subset has a display approval, not a reuse licence. Each record binds exact brand/name/size, source URL, final hash, source review, art review, and peach/pink/dark checks, while explicitly recording `rightsStatus: not-verified`. Known prohibitions are withheld; permission provenance remains open and must not be implied in the UI or docs.

New intake image approval requires documented rights, intact packaging, exact label/variant/size, catalogue fit, and a magazine-ready final image. An untouched licensed photograph, permitted official brand asset, owned editorial photograph, or polished transparent isolation may pass. Background removal must retain source package pixels; it cannot redraw the label, colour, materials, geometry, claims, or size. Generated or composited scenery may pass only when the package itself remains source-faithful and a reviewer compares source and final output. Unreviewed extraction output remains private.

New intake approvals bind the barcode, source snapshot, raw candidate fingerprint, final image hash, reviewer, timestamp, rights source, and final-image attestations. Any candidate or image change invalidates the approval.

The same deterministic audit dimensions—identity, formula completeness, evidence level, exact Nigerian listing, image rights, and final presentation—apply to all 24 reviewed source records. Publication quality and direct-care eligibility remain separate gates.

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
