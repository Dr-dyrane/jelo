# Inventory catalogue benchmark

**Date:** 2026-07-26; revalidated 2026-07-27
**Scope:** Apple Store catalogue pages, the Shop/Shop app discovery model, and JeloCare `/products`
**Status:** Research contract; P0 continuation, contextual refinement, and bounded full-catalogue typeahead implemented

## Executive decision

JeloCare should borrow the catalogue structure, not the commerce pressure.

- From Apple: clear editorial shelves, restrained product metadata, category-led
  discovery, and an optional quick-look path.
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

- first-party Apple and Shop pages retrieved on 2026-07-26;
- first-party Apple App Store listings and Shop help documentation;
- the active JeloCare route and components in this repository.

The interactive browser was unavailable in this lane, so no claim below is
based on visual breakpoint testing. Mobile behavior is taken only from
first-party app/help documentation and the current JeloCare responsive code.
Before implementation is accepted, the responsive matrix in this document
must be tested in a real browser.

“Observed” means directly present in a retrieved page, first-party
documentation, or current code. “Inference” means a proposed JeloCare
translation.

## Source evidence

| Source | Observed | JeloCare inference |
| --- | --- | --- |
| [Apple accessories catalogue](https://www.apple.com/shop/accessories/all) | The page begins with “Browse by Product” and “Browse by Category”, then uses named editorial shelves such as College Essentials, Charging Essentials, Travel Essentials, AirTag, and Health & Fitness. Items expose image, name, colors, selected status labels, and price. Each shelf has a category continuation link. No filter or sort labels appeared in the retrieved accessible content. | Let the first screen help people choose a path. Keep shelf titles factual and give each shelf one clear continuation. Do not make a large filter panel the first experience. |
| [Apple iPhone catalogue](https://www.apple.com/shop/buy-iphone) | The inventory is presented under “All models. Take your pick.” Each model has a restrained identity/price block, “Take a closer look”, and “Buy”. Guidance, savings, accessories, setup, and support follow the inventory. | A dedicated secondary quick-look control can shorten decisions, but the product card itself should still have one primary destination. Guidance should remain adjacent to inventory, not embedded as dense card copy. |
| [Apple Store app listing](https://apps.apple.com/us/app/apple-store/id375380948) | The Products tab includes recommendations, compatible accessories, categories, and seasonal offerings. “For You” contains saved items, recent activity, and order status. The listing declares support for VoiceOver, Voice Control, 200%+ text, non-color differentiation, sufficient contrast, reduced motion, and captions. | Treat accessibility states as catalogue acceptance criteria. Saves and recent activity are later systems, not small card additions. |
| [Apple saved items help](https://www.apple.com/shop/help/shopping_experience) | Items can be saved from a product or bag, organized into named lists, shared, and accessed online or in the Apple Store. Configuration progress persists. | If JeloCare later adds collections, build one durable cross-surface collection system rather than isolated “heart” buttons. |
| [Shop home](https://shop.app/) | Global destinations include Home, Explore, Deals, Saved, and cart. Search is prominent and includes suggested searches. | Search should remain a first-class catalogue control. “Deals” and cart are not JeloCare concepts. |
| [Shop Beauty category](https://shop.app/categories/5/beauty) | Beauty has subcategories, goal-led editorial collections, and shelves such as Top rated, What’s new, Scent & body, and Favorites for a reason. Product entries expose title, review count, price, and sometimes discount; store shelves expose store ratings. | Borrow subcategory and goal-led discovery. Reject ratings, popularity shelves, and discount treatment until JeloCare has independent, publishable evidence for those claims. |
| [Shop discovery help](https://help.shop.app/en/shop/shopping/discover) | Search accepts product, brand, or category keywords. Some queries receive extra filters. Results can be personalized from history/activity/settings and restricted to stores shipping to the user's location. The home feed can include recent views, saved-item price drops/restocks, reorders, and promotions. | Query-aware facets are useful. Hidden behavioral ranking is not. JeloCare ordering must remain explainable and independent of affiliate or conversion value. |
| [Shop recommendation controls](https://help.shop.app/en/shop/shopping/discover/manage-recommendations) | A product press-and-hold menu includes Visit shop, Show similar, Share, Not interested, and Report. Store controls include Visit, Follow, Not interested, and Report. | When personalization eventually exists, give people explicit controls. Do not use long-press as the only way to discover an important action. |
| [Shop saves and follows](https://help.shop.app/en/shop/shopping/discover/save-products-and-follow-stores) | Shop supports unlimited saved products, private/public collections, collaborators, sharing, price-drop and restock alerts, and followed-store updates. | Collections and alerts are a coherent later platform capability. They should wait for identity, privacy, and evidence contracts rather than enter the current catalogue sprint. |
| [Shop on the web](https://help.shop.app/en/shop/shopping/shop-on-the-web) | Guests can browse and search. Sign-in is required for account-bound actions such as save, follow, cart, and purchase. Not all app features exist on the web. | Keep core JeloCare search, clinical guidance, and price comparison anonymous. Ask for identity only when a durable user-owned capability requires it. |

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
