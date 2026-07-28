# Inventory catalogue benchmark

**Date:** 2026-07-26; revalidated 2026-07-27
**Scope:** Apple Store catalogue pages, the Shop/Shop app discovery model, and JeloCare `/products`
**Status:** Research contract; P0 continuation, contextual refinement, and bounded full-catalogue typeahead implemented

## Executive decision

JeloCare should borrow the catalogue structure, not the commerce pressure.

- From Apple: distinct browse and constrained-results grammars, restrained
  product metadata, grouped search intentions, and a decision ladder from
  closer look to comparison to guided help.
- From Shop: strong search, query-aware refinement, saved collections, and
  explicit controls over recommendations.
- Keep JeloCare's differentiator: verified Nigerian price observations and
  bounded care context. Do not copy ratings, sale urgency, popularity ranking,
  stock pressure, or opaque personalization.

The current catalogue already has most of the right primitives. The highest
value changes for a much larger inventory are bounded progressive continuation
and contextual refinement, not a redesign.

## P0 implementation checkpoint

The active `/products` path now server-renders the first 24 results and uses
`components/products/inventory-results.tsx` for bounded progressive
continuation. Two pages may load automatically before the explicit **Load
more** control becomes the only continuation. URL state records the deepest
page, refresh/back restoration fetches the missing bounded server pages, and
pending, retry, appended-count, and terminal states remain explicit. The
legacy client explorer, dense search results, and numbered-pagination paths
were removed after confirming they had no active imports.

The same canonical path now derives an exact price-band projection beside its
existing server facets. A deterministic policy promotes at most four useful
groups for the current search or explicit category/routine/concern browse mode.
Every active group stays in the first view even when its current count reaches
zero. Other useful groups remain behind one quiet **All refinements**
disclosure. Query text changes only non-clinical group order; it never creates
or promotes a concern relationship. The existing right sheet, mobile bottom
sheet, URL state, applied-filter removal, Undo, Clear and focus return remain
unchanged.

The search control now keeps only compact category, guide, and company starting
points in the initial page payload. Once a person types two characters, a
same-origin endpoint returns at most seven deterministic product/company
matches. The Neon query is bounded before ranking and falls back to the
verified public snapshot. This removes the former first-24-product suggestion
ceiling without hydrating the eventual 1,000-product catalogue into the
browser.

## Method and limits

This is a dated comparison of:

- first-party Apple and Shop pages retrieved on 2026-07-26 and rechecked on
  2026-07-27;
- first-party Apple App Store listings and Shop help documentation;
- the active JeloCare route and components in this repository.

The recheck used Apple's accessible page content and embedded first-party
catalogue data. It did not visually verify Apple's responsive breakpoints,
animation, modal geometry, or touch behavior. The constrained Made by Apple
page exposed its sort and facet model in first-party page data even though the
retrieved accessible body did not render the result list. Mobile behavior is
taken only from first-party app/help documentation and the current JeloCare
responsive code. Before implementation is accepted, the responsive matrix in
this document must be tested in a real browser.

“Observed” means directly present in a retrieved page, first-party
documentation, or current code. “Inference” means a proposed JeloCare
translation.

## Source evidence

| Source | Observed | JeloCare inference |
| --- | --- | --- |
| [Apple accessories catalogue](https://www.apple.com/shop/accessories/all) | The landing page begins with “Browse by Product” and “Browse by Category”, then uses named editorial shelves such as College Essentials, Charging Essentials, Travel Essentials, AirTag, and Health & Fitness. Items expose image, name, colors, selected status labels, and price. Each shelf has a category continuation link. No filter or sort labels appeared in the retrieved accessible content. | Treat open-ended discovery as a browse grammar. Let the first screen help people choose a path, keep shelf titles factual, and give each shelf one clear continuation instead of leading with a filter wall. |
| [Apple Made by Apple results](https://www.apple.com/shop/accessories/all/made-by-apple) | This constrained collection uses a results grammar rather than the editorial landing grammar. Its first-party page data declares Featured, Newest, and price sorting; Product Type; device-compatibility facets; an Only at Apple facet; pagination; selected-filter state; loading, error, and no-results messages. | Once intent is constrained, filters and sorting become appropriate. JeloCare should keep one catalogue system while allowing browse and results pages to use different compositions and the same recoverable state contract. |
| [Apple site search](https://www.apple.com/us/search/iphone?src=globalnav) | Search groups the same query into Explore, Accessories, Support, and Find a Store intentions. A leading iPhone result offers Explore, Shop, and Compare; model results can offer Learn more, Shop, and Support. The remaining results include buying help, switching guidance, specifications, comparison, accessories, and refurbished inventory rather than one undifferentiated product grid. | Group JeloCare results by the task a person is trying to complete: Products, Companies, Guides, Ingredients, and Stores. Do not let a matching care phrase silently become a product recommendation. |
| [Apple iPhone catalogue](https://www.apple.com/shop/buy-iphone) and [iPhone comparison](https://www.apple.com/iphone/compare/) | The catalogue presents “All models. Take your pick.” with a restrained identity/price block, “Take a closer look”, and “Buy”. Shopping guides lead to model comparison and Specialist support. The comparison surface keeps durable specifications together, distinguishes models sold by Apple from older models available through authorized resellers, and offers chat and a guided tour. | Use a decision ladder: compact card, explicit quick look, structured comparison where the data merits it, then human guidance. A product's identity and care record must not change merely because a current retailer offer expires. |
| [Apple delivery and pickup](https://www.apple.com/shop/shipping-pickup) | Delivery claims are explicitly conditional on in-stock and eligible items; pickup and setup have their own process and notifications. | Treat price, stock, fulfillment, market, and observed time as offer evidence, not product identity. Current availability must expire independently and must name its market and source. |
| [Apple Store app listing](https://apps.apple.com/us/app/apple-store/id375380948) | The Products tab includes tailored recommendations, compatible accessories, categories, and seasonal offerings. “For You” contains saved items, recent activity, and order status. Apple discloses that personalization uses device, account, shopping-activity, and subscription data and points to Account > Settings. The listing also declares support for VoiceOver, Voice Control, 200%+ text, non-color differentiation, sufficient contrast, reduced motion, and captions. | Treat accessibility states as catalogue acceptance criteria. If JeloCare later personalizes, every recommendation needs an understandable reason and a control; anonymous search and comparison remain the default. |
| [Apple Store app launch note](https://www.apple.com/in/newsroom/2025/01/apple-launches-apple-store-app-in-india/) | Apple describes Products, For You, and Go Further as distinct jobs: discovery and retail programs; timely recommendations and saved items; then post-purchase setup, learning, and Specialist support. Delivery and pickup are separate capabilities. | Do not make one JeloCare page carry discovery, comparison, evidence review, and aftercare at once. Page grammar should follow the user's current job. |
| [Apple Store landing](https://www.apple.com/store) and [Certified Refurbished](https://www.apple.com/shop/refurbished) | The store presents products first, then help, “The Apple Store difference”, delivery, personalization, and savings. Refurbished inventory has its own named channel and places functional testing, certification, warranty, price, delivery, and environmental claims beside that channel. | Put trust where it qualifies a decision: freshness beside price, retailer identity beside an offer, and review state beside the claim it governs. Do not use a footer logo bank or repeated card badges as a substitute for evidence. |
| [Apple Store app lookup](https://itunes.apple.com/lookup?id=375380948&country=us) | On 2026-07-27 the first-party lookup reported version 6.9, released 2026-07-22, with iOS 18 as the minimum. This confirms source recency, not the visual behavior of the app. | Record the date and boundary of every benchmark. Current metadata cannot prove a breakpoint, interaction, or layout that was not directly observed. |
| [Apple saved items help](https://www.apple.com/shop/help/shopping_experience) | Items can be saved from a product or bag, organized into named lists, shared, and accessed online or in the Apple Store. Configuration progress persists. | If JeloCare later adds collections, build one durable cross-surface collection system rather than isolated “heart” buttons. |
| [Shop home](https://shop.app/) | Global destinations include Home, Explore, Deals, Saved, and cart. Search is prominent and includes suggested searches. | Search should remain a first-class catalogue control. “Deals” and cart are not JeloCare concepts. |
| [Shop Beauty category](https://shop.app/categories/5/beauty) | Beauty has subcategories, goal-led editorial collections, and shelves such as Top rated, What’s new, Scent & body, and Favorites for a reason. Product entries expose title, review count, price, and sometimes discount; store shelves expose store ratings. | Borrow subcategory and goal-led discovery. Reject ratings, popularity shelves, and discount treatment until JeloCare has independent, publishable evidence for those claims. |
| [Shop discovery help](https://help.shop.app/en/shop/shopping/discover) | Search accepts product, brand, or category keywords. Some queries receive extra filters. Results can be personalized from history/activity/settings and restricted to stores shipping to the user's location. The home feed can include recent views, saved-item price drops/restocks, reorders, and promotions. | Query-aware facets are useful. Hidden behavioral ranking is not. JeloCare ordering must remain explainable and independent of affiliate or conversion value. |
| [Shop recommendation controls](https://help.shop.app/en/shop/shopping/discover/manage-recommendations) | A product press-and-hold menu includes Visit shop, Show similar, Share, Not interested, and Report. Store controls include Visit, Follow, Not interested, and Report. | When personalization eventually exists, give people explicit controls. Do not use long-press as the only way to discover an important action. |
| [Shop saves and follows](https://help.shop.app/en/shop/shopping/discover/save-products-and-follow-stores) | Shop supports unlimited saved products, private/public collections, collaborators, sharing, price-drop and restock alerts, and followed-store updates. | Collections and alerts are a coherent later platform capability. They should wait for identity, privacy, and evidence contracts rather than enter the current catalogue sprint. |
| [Shop on the web](https://help.shop.app/en/shop/shopping/shop-on-the-web) | Guests can browse and search. Sign-in is required for account-bound actions such as save, follow, cart, and purchase. Not all app features exist on the web. | Keep core JeloCare search, clinical guidance, and price comparison anonymous. Ask for identity only when a durable user-owned capability requires it. |

## 2026-07-27 Apple findings translated for JeloCare

### Browse and results are different grammars

Apple's accessories landing is a broad discovery surface: paths and editorial
shelves come before filters. The Made by Apple collection is a constrained
results surface: sortable, faceted, paginated, and explicit about loading,
failure, and empty states.

JeloCare should preserve that distinction without creating two catalogue
engines:

- `/products` with no active intent remains editorial and browse-led;
- a search, shelf continuation, barcode match, or explicit filter enters the
  constrained-results grammar;
- both grammars use the same canonical product records, URL state, evidence
  boundaries, result cards, and continuation behavior;
- switching grammar must not reset active selections or invent a second card
  implementation.

### Search should route intentions, not flatten matches

Apple search distinguishes exploring a product family, shopping, comparing,
support, accessories, store finding, specifications, and refurbished stock.
JeloCare's equivalent is not a longer mixed suggestion list. It is a small,
stable set of grouped intentions:

1. **Products** — exact product and approved company/alias matches;
2. **Guides** — reviewed concern, routine, and ingredient education;
3. **Stores** — retailer discovery and current eligible offers;
4. **Companies and ingredients** — canonical reference destinations.

A query may retrieve several groups. It must not use guide-language similarity
as evidence that a product suits a condition.

### Decision support should escalate only when needed

Apple separates the scan of a compact model card, a closer-look action,
structured comparison, and live Specialist guidance. JeloCare can translate
that into:

- a truth-first catalogue card;
- a restrained quick look when it shortens the next decision;
- comparison only for normalized facts such as size, ingredients, current
  market offers, and approved care context;
- Ask JeloCare or a professional-care route when the decision exceeds
  catalogue evidence.

Comparison must not turn community outcomes into rankings or clinical
recommendations.

### Product identity and fresh availability are separate

Apple's compare surface can retain a model's identity and specifications while
describing its purchase channel differently. Delivery and pickup claims are
conditional on current stock or eligibility. JeloCare needs the same separation
with stricter provenance:

- canonical product, package, ingredient, and image identity are durable;
- each retailer, price, stock, market, channel, and observed time belongs to an
  expiring offer observation;
- an expired or removed offer changes where a product can be bought, not what
  the product is;
- a retailer SKU or barcode-shaped value cannot establish manufacturer
  identity by itself.

### Offer provenance belongs in the decision

Apple distinguishes Apple-direct, authorized-reseller, and Certified
Refurbished channels and attaches the relevant warranty, testing, delivery, or
availability language to the channel. JeloCare must name the retailer and
market, show checked time/freshness where price is shown, and preserve the
exact listing behind the offer. “Verified” cannot float as a general product
badge when it actually describes one retailer observation.

### Personalization must explain itself

Apple describes compatible-accessory and For You recommendations and discloses
the account, device, activity, subscription, and location data that may support
them, with settings to change the behavior. JeloCare should not copy that data
scope. If personalization is introduced later, the public interface must say
why an item appears — for example, “Matches your saved routine step” — and
offer Hide, Show similar, and reset controls. Affiliate value, paid placement,
and hidden conversion ranking remain prohibited.

### Camera input is a bounded opportunity

The Apple Store app documents camera-assisted accessory self-checkout inside an
Apple Store. It does **not** establish that Apple's general catalogue search is
a universal barcode-identification system. The transferable opportunity for
JeloCare is narrower:

- offer **Scan packaging** as an optional input beside typing;
- route an exact recognized code to an exact reviewed package;
- show an identity check before opening or attaching an offer;
- send an unknown code to private intake without publishing a product;
- keep manual search available when camera permission is denied or scanning
  fails.

A scan is retrieval evidence, not publication authority, Nigerian availability,
or proof that two packages are the same SKU.

### Trust should sit beside the claim

Apple's trust language appears in the relevant flow: certification and
warranty in Refurbished, eligibility in delivery, and help beside a difficult
choice. JeloCare should place source, retailer, market, checked time, review
state, and care boundary next to the price or guidance they qualify. Product
cards remain quiet. Institutional logos in a footer must never imply
endorsement.

### Limitations

- No Apple responsive breakpoint or sheet geometry was visually verified in
  this recheck.
- Embedded page data confirms the constrained result model but not how every
  facet is progressively disclosed on each device.
- Apple sells within a first-party retail ecosystem; its channel trust cannot
  be transferred to a multi-retailer Nigerian catalogue without JeloCare's
  independent source and freshness rules.
- Apple's personalization disclosure describes Apple, not a recommended data
  collection scope for JeloCare.
- Apple self-checkout supports a bounded in-store task. It is not evidence that
  a scanned value is globally canonical or safe to publish.

## Current JeloCare baseline

This section is an **observed code snapshot**, not a proposed redesign.

- The active route is `app/(site)/products/page.tsx`.
- The active catalogue is assembled through
  `lib/catalogue/inventory-repository.ts` and
  `lib/catalogue/inventory-query.ts`.
- The static public snapshot contains **52 reviewed products, zero external
  products, and 52 total products**. This count was evaluated from
  `data/catalogue.ts` and `data/external-catalogue.ts` on 2026-07-27.
- The server returns **24 products per page** and binds search, category,
  source/care state, concern, routine step, company, current-price
  availability, price band, order, market, and page to the URL.
- With no active intent, the page presents:
  - an editorial hero;
  - search with product, company, category, guide, and barcode-aware matching;
  - category/routine/concern browse rails;
  - people-led editorial stories;
  - “Fresh price checks”, an accessible-price shelf, supportive care, face
    care, and hair/scalp shelves;
  - the full inventory.
- Filters open as a right sheet on desktop and a bottom sheet on mobile.
  Applied state is visible and supports removing one filter, Undo, and Clear
  all. The first filter view is ordered by current search or explicit browse
  context, while **All refinements** reveals the remaining useful groups.
- The concern facet only matches approved supportive product relationships;
  it does not infer a diagnosis from a condition keyword.
- Product cards show packshot, company, exact product identity, size, and a
  fresh exact market price/store-count label when one exists.
- `lib/catalogue/inventory-shelves.ts` excludes search-result listings, stale
  prices, and wrong-market offers from its price shelves.
- The current result grid is four columns on wide screens, then three and two.
  The compact two-column grammar is preserved on phones. Horizontal shelves
  use snap scrolling with hidden scrollbars.
- Results continue progressively in bounded server pages. Two pages may append
  automatically before the explicit **Load more** fallback becomes the only
  continuation.

### Active-path integrity

The earlier client explorer and dense search-result implementations have been
removed. `components/products/product-quick-panel.tsx` is used on product
detail pages, not the inventory page.

This matters because adding a third catalogue result implementation would
create divergent behavior. The active `/products` route and its current
search/filter/card components must be declared canonical before further
inventory work.

## What is already strong

| JeloCare behavior | Benchmark fit |
| --- | --- |
| Editorial shelves before the complete grid | Matches Apple's browse-first catalogue hierarchy without copying commerce badges. |
| One search spanning products, companies, categories, and guides | Stronger for JeloCare's information-system role than a product-only search. |
| URL-bound filters and result feedback | More explainable and recoverable than hidden client state. |
| Desktop side sheet and mobile bottom sheet | Preserves context while avoiding an in-page form stack. |
| Current exact price and store count | Answers “where should I buy today?” without inventing popularity. |
| Approved supportive concern matching | Protects the boundary between catalogue discovery and diagnosis. |
| Factual freshness and price-bound shelves | Useful discovery without sale, rating, or affiliate pressure. |
| Editorial images beyond the hero | Gives the catalogue a human story while packshots remain the product spotlight. |

## Explicit deltas

| Priority | Status | Delta | Why it matters |
| --- | --- | --- | --- |
| P0 | Implemented | Replace numbered result pages with bounded progressive continuation. | At hundreds of products, repeated page replacement interrupts comparison and loses spatial continuity. |
| P0 | Implemented | Declare and remove alternatives to the canonical active result path. | New work can otherwise accidentally fix an unused path or create conflicting interaction rules. |
| P0 | Implemented | Make comprehensive facets contextual while preserving active selections. | Query- and browse-aware ordering keeps the first filter view useful without hiding reversible state. |
| P0 | Implemented | Replace the first-24-product suggestion payload with bounded server-backed search. | Every reviewed product remains findable while the initial route stays compact enough for a 1,000-product catalogue. |
| P1 | Open | Inventory has no dedicated quick look. | Apple's model demonstrates a secondary “closer look” path that can reduce unnecessary product-page navigation. |
| P1 | Open | Search suggestions are grouped but do not expose canonical alias provenance. | Community vocabulary can improve search without turning unknown language into an unreviewed clinical claim. |
| P1 | Open | Shelf rules are factual but not presented as a reusable shelf contract. | More products will tempt teams to add popularity-like shelves without evidence. |
| P2 | Deferred | Saves, collections, alerts, and recent activity are deferred rather than systematized. | Apple and Shop show their value, but they require identity, privacy, and durable evidence infrastructure. |

## Patterns to transfer

1. **Browse first, refine second.** Keep category, routine, concern, price, and
   editorial entry points visible before asking people to configure filters.
2. **One clear continuation per shelf.** A shelf title, a short factual
   eyebrow, and one “View all” destination are enough.
3. **Query-aware refinement.** Reveal facets that have meaning for the current
   query or category. Keep every active facet visible even when its current
   result count reaches zero.
4. **Secondary quick look, not card overload.** If tested, give quick look its
   own explicit control. Card activation still opens the product page.
5. **Collections as a system.** A future save action must lead to durable,
   shareable collections across products, ingredients, routines, and deals.
6. **User-controlled recommendations.** If recommendation ranking is added
   later, disclose why an item appears and offer controls such as “Show
   similar” and “Not interested”.
7. **Accessibility as release evidence.** Verify screen-reader names, focus
   return, 200% zoom, non-color selection, contrast, reduced motion, and
   keyboard completion.

## Patterns to reject

- Star ratings, review counts, “top rated”, “favorites”, or retailer scores
  without a governed JeloCare evidence model.
- Sale badges, countdowns, low-stock urgency, or “deal” copy inferred from one
  observed price.
- Affiliate value, conversion, or paid placement in product or store order.
- Opaque purchase-history personalization.
- Apple-specific status badges such as “Only at Apple” translated into
  ungrounded JeloCare badges.
- A full filter wall before users see products.
- Loading the eventual catalogue as one large client-side array.
- Infinite scroll that hides the footer, breaks back navigation, or cannot be
  retried.
- Long-press as the only route to an important action.
- More controls, brand logos, badges, or nested surfaces inside product cards.
- Condition-keyword matching presented as product suitability.
- Treating publication count as the quality target.

## Prioritized implementation contract

### P0 — Scale without losing state

**Outcome**

The first 24 results remain server-rendered. Approaching the end of the visible
grid requests and appends the next server page.

**Invariants**

- Filters, market, sort, and the deepest loaded page remain represented in the
  URL.
- Back/forward restores the same result state and a sensible scroll position.
- A visible, keyboard-operable **Load more** control is always available as the
  accessible fallback.
- Automatic continuation is bounded so the footer remains reachable.
- A failed request leaves existing results intact and offers Retry.
- Loading uses the same product-card skeleton geometry as the ready state.
- The live region announces how many products were added and whether the end
  has been reached.
- No unbounded static product array is hydrated to the client.

**Acceptance evidence**

- First render contains no more than the server page size.
- Filter changes reset continuation to page one and receive immediate visible
  feedback.
- Refreshing and opening a shared URL reproduces the loaded state.
- Keyboard and screen-reader users can load, retry, and identify the terminal
  state.
- The footer is reachable on touch and keyboard.

### P0 — Declare one canonical catalogue path

**Outcome**

`app/(site)/products/page.tsx`,
`components/products/catalogue-search.tsx`,
`components/products/inventory-filter-sheet.tsx`,
`components/products/inventory-card.tsx`, and the inventory repository/query
become the documented active contract.

**Invariants**

- Do not add behavior to `CatalogueExplorer` or `ProductSearchResults` unless
  those components are deliberately reconciled with the active route.
- Retire or archive dormant catalogue implementations after an import audit.
- Product-detail quick-panel behavior must not be assumed to exist in the
  inventory route.

### P0 — Make refinements contextual

**Outcome**

The base facets stay server-derived, but the filter sheet prioritizes groups
relevant to the query or current browse path.

**Invariants**

- Counts come from the same server projection that produces the result set.
- Active filters remain visible and removable even if their count is zero.
- The interaction remains a desktop side sheet and mobile bottom sheet.
- Selection is URL-bound and produces visible applied-state, Undo, and Clear.
- Concern matches remain approved supportive relationships only.
- Search aliases improve retrieval; they do not create clinical suitability.

**Current implementation**

- `lib/catalogue/inventory-refinements.ts` owns one deterministic group plan.
- Search context may promote company, category, current-price, source and order
  groups; it never promotes concern from query language.
- Explicit category, routine and concern browse modes promote their own group.
- A group is promoted only when its exact server facet can narrow the current
  shelf, unless it is active and therefore must remain visible.
- Price-band counts and the priceable scope are computed by
  `lib/catalogue/inventory-query.ts` from the same records and evidence rules as
  the result set.
- Active company, category, routine, concern, source, current-price, price and
  order selections remain visible at zero.

### P0 — Preserve the truth-first card

Each product card may show only:

- exact company and product identity;
- size;
- the approved display image;
- a current exact market price and store count when eligible;
- one clear primary destination.

No rating, sale, stock urgency, trust badge, logo avatar, or popularity cue
enters the card without a separate evidence decision.

### P1 — Test a restrained quick look

**Hypothesis**

A dedicated secondary action can show enough information to decide whether to
open the full product page.

**Proposed content**

- exact package identity;
- one to three current exact Nigerian store observations;
- a simple care-state label or concern-guide link;
- **View product** and, when evidence exists, **Find a store**.

**Interaction**

- desktop: contextual side sheet;
- mobile: bottom sheet;
- primary card activation: product page;
- quick look: separate labeled control, never hidden behind long-press.

Do not release if the extra control competes visually with the packshot or
causes card geometry to wrap.

### P1 — Govern every new shelf

Every shelf must declare:

1. the exact inclusion rule;
2. the source fields used;
3. the ordering rule;
4. the market and freshness boundary;
5. the empty behavior;
6. the “View all” query it maps to.

Acceptable examples include recently verified Nigerian prices, current prices
below a declared threshold, and recently published reviewed products.
“Popular”, “trending”, “best”, and “top rated” are prohibited until evidence
and governance exist.

### P1 — Improve search with governed aliases

- Preserve Product, Company, Category, and Guide suggestion types.
- Include canonical and approved alias matches from community moderation.
- Keep the original community language for research, but label the canonical
  destination in the public suggestion.
- Continue exact barcode routing for exact product identity.
- Never turn an unknown concern phrase into a product recommendation.

### P2 — Defer account-bound systems

Saved collections, recent activity, follows, price-drop alerts, and restock
alerts belong to one later platform capability. They must satisfy
`docs/adr/0001-deferred-trust-collections-community-and-stock-alerts.md` before
implementation.

If personalization follows, it must be optional, explainable, and controllable.
Anonymous access to search, guidance, and price comparison remains the default.

## Responsive acceptance matrix

The implementation lane must record screenshots and interaction evidence for:

| View | Required proof |
| --- | --- |
| 390 × 844 | Stable two-column inventory cards; reachable bottom sheet; explicit Load more; no horizontal page overflow; footer reachable; tap targets at least 44px. |
| 768 × 1024 | Stable two-column inventory; sheet does not become an awkward in-page panel; rails expose continuation without showing a scrollbar. |
| 1280 × 800 | Four-column inventory where space permits; right sheet preserves catalogue context; no card compression during continuation. |
| 200% browser zoom | No clipped search, filters, card identity, pagination/continuation, or sheet footer. |
| Keyboard only | Search suggestions, filter sheet, product cards, quick look if present, Load more, retry, and focus return are complete. |
| Reduced motion/transparency | No required feedback depends on animation or glass; surfaces remain distinct and readable. |

## Relationship to existing JeloCare contracts

This benchmark does not replace:

- `docs/INVENTORY_EXPERIENCE.md`;
- `docs/product/NORTH_STAR.md`;
- `docs/product/ROADMAP.md`;
- `docs/catalogue/OPERATIONS.md`;
- `docs/adr/0009-ui-ux-lane-contract.md`.

Those documents govern product truth, publication quality, clinical bounds,
and UI lane behavior. This document adds a dated external benchmark and the
catalogue-scaling implementation order.
