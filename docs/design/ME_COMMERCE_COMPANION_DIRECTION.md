# JeloCare Me — Consumer Experience Direction

Updated: 2026-08-05
Status: Direction packet for review — amended after first approval pass

## 1. Current-state reading

### What the existing /me experience currently is

JeloCare Me is a fixed-shell, single-scroll, adaptive-dock workspace at `/me`
with four primary destinations (Home, Explore, Shelf, Routine) and four stack
pages (Ask Me, member Product, Add to Shelf, private request). It renders
inside a `position: fixed; inset: 0` container with one vertical scroll owner,
a topbar that hides on downward scroll, and a bottom dock that transitions
through expanded → compact → navigation modes based on scroll position.

The shell was decomposed in Waves 1–5 from a monolithic `MePortal` god
component into thin view components (`HomeView`, `ExploreView`,
`RoutineView`, `ConsultView`, `MemberProductView`) that receive semantic props
from server-side route read models. Modal/sheet interactions were unified
under `useControlledDialog`. Public discovery was refactored into a
query → model → view pipeline. Seven source-level acceptance contracts
exist in `modules/acceptance/browser-evidence.test.ts`; representative
journeys were manually verified with Playwright MCP. A repeatable
automated browser suite does not yet exist.

### What already works

- **Architecture**: Route-specific server read models (`readMeHome`,
  `readMeExplore`, `readMeShelf`, `readMeRoutine`, `readMeConsult`,
  `readMeProduct`) exist in `lib/customer/route-read-models.ts` with pure
  derivation, thin view components, shared modal/sheet controller, and
  adaptive dock with FAB registration. However, the live Me routes
  (`app/(customer)/me/page.tsx` and `app/(customer)/me/[...route]/page.ts`)
  still call the portal-wide `readCustomerPortal` loader, not the
  route-scoped readers. The route → model → view → controller split is
  designed and partially tested but not yet wired into the live route
  adapters.
- **Shelf**: Owner-isolated immutable-version persistence with add/remove/
  clear, lifecycle-aware unavailable rows, export, hard-delete. Private
  product requests are a separate owner-isolated lifecycle. Synthetic preview
  mode enables local development without a database.
- **Routine**: Owner-isolated named routines with 1–20 ordered steps,
  create/update/delete server actions, a progressive-disclosure step builder
  with time-of-day presets.
- **Explore**: Complete eligible-catalogue reachability (all 59 products in
  the current snapshot), search, category/step/brand/concern/retailer/shelf
  filters, filter sheet with clear/show.
- **Member Product**: Exact catalogue identity, price evidence, retailer
  offers, care details, shelf action, routine context, buy/details panel.
- **Consult**: Public deterministic safety engine with care intent, safety
  gate, clinical product filtering, timeline, profile context. Concern guides
  now link to consult with safe prefill.
- **Dock**: Four-mode adaptive workspace dock with scroll hysteresis, FAB
  registration, back navigation for stack pages, focus management.
- **Boundaries**: Server-derived owner, private data never in public
  routes/logs/analytics, synthetic fixture is dev-only, public routes stay
  account-free.

### Where it falls on the spectrum

The current experience is **between a personal commerce companion and a
public editorial site behind a login**. It leans editorial in its
composition:

- Home leads with a large hero (display heading + featured product image)
  that feels like a magazine cover rather than a personal summary.
- Explore renders as a filtered product grid — functional but not
  continuous with the personal context the customer already has.
- Shelf is a product grid with lifecycle badges — honest but not
  visually distinct from Explore.
- Routine is a numbered list inside cards — administrative rather than
  visual.
- Member Product is a two-column hero (image + story) with evidence
  buttons — good structure but the evidence is behind buttons rather
  than integrated.
- Ask Me is currently catalogue search, not the guided consultation
  the public `/consult` already provides.

The dock, shell mechanics, read models, and data boundaries are
companion-grade. The visual composition and interaction flow are still
editorial-grade.

### Most important UX and architecture constraints

1. **One scroll owner**: The shell is a fixed container with one vertical
   scroll. This is an asset — it creates app-like continuity — but it means
   every route must respect the same scroll context, dock geometry, and
   topbar behavior.
2. **Dock owns navigation**: The four-tab dock is the only persistent
   navigation. Stack pages get Back in the dock's left slot. No route may
   add a fifth tab or a page-body navigation control.
3. **One FAB per route**: Each page registers exactly one primary action.
   The FAB may navigate or focus a field when no truthful mutation exists.
4. **Catalogue truth is public**: `/me` reads the same catalogue, offers,
   and evidence as public routes. It never creates a second product truth.
5. **Private data is owner-isolated**: Shelf, Routine, concerns, and
   requests are owner-derived server-side. Client state improves interaction
   but never authorises access.
6. **Safety authority is public**: The consult safety engine, care intent,
   and clinical product filtering are public-owned. `/me/consult` must
   reuse that authority, not build a parallel one.
7. **State contract**: Every surface must handle normal, empty, loading,
   error, offline, stale, signed-out, authenticated, and recovery states.
8. **Route-scoped loading**: The live Me routes must migrate from the
   portal-wide `readCustomerPortal` boundary to route-scoped readers
   (`readMeHome`, `readMeExplore`, etc.). Each route should load only the
   data it needs, not the entire portal view model. The route-scoped
   readers already exist but are not yet wired into the route adapters.
9. **No catalogue fallback as personal preference**: `catalogue[0]` must
   never be presented as a customer's featured product or preference.
   The current `readCustomerPortal` and `readMeHome` both fall back to
   `catalogue[0]` when no saved product exists. This must be removed.

## 2. Experience thesis

JeloCare Me should become **a personal care companion that makes
continuity its primary feeling** — the sense that the customer's
products, routine, and care context are always present, always honest,
and always one touch away from the next useful decision.

"Shop.app-level" for JeloCare means:

- **Product-first**: Products, packshots, and price evidence lead every
  surface. Controls and chrome recede.
- **Continuous**: Moving between Home, Explore, Shelf, Routine, and Product
  feels like moving through one space, not loading separate pages. Scroll
  position, filter state, and selection survive navigation.
- **Ownership-aware**: Saved products, routine steps, and care context
  appear as personal annotations on catalogue truth — never as a separate
  catalogue. The customer sees "on your Shelf" and "in your routine" as
  immediate visual facts, not badges.
- **Stateful**: Every state (loading, empty, stale, unavailable, error) is
  designed and honest. No spinner masks a missing product; no empty state
  fabricates content.
- **Fluid**: Sheets, panels, and route transitions use motion to explain
  topology — where the customer came from, where they're going, and what
  changed.
- **Calm**: Warm palette, restrained chrome, generous negative space,
  Italiana display for headings, Manrope for everything else. No
  dashboard density, no decorative borders, no urgency theatre.

It explicitly does **not** mean:

- Copying Shop.app's layout, iconography, rewards, social mechanics, or
  checkout flows.
- A wishlist with a skincare skin.
- A dashboard of analytics tiles.
- A chatbot wrapper.
- A fake checkout or order-tracking system.
- A second catalogue or clinical authority.

## 3. Customer journey model

### Home (`/me`)

**Job**: Answer "What should I understand or do for my care now?"

Home is a **personal product-and-care feed**, not a compact metrics
dashboard. It is not a grid of tiles, a chart of activity, or a public
homepage hero. It is a warm, product-first continuation of the
customer's own care journey.

The intended feed order is:

1. **Personal greeting** — the customer's preferred name, quietly.
2. **One Ask/search entry** — a single entry point to Ask Me, not a
   full hero. It links to `/me/consult` and carries any selected
   concern context.
3. **Continue your Routine** — when the customer has a real routine,
   show today's next steps as a visual sequence with product packshots
   and step names. Action-only steps show their label without a product
   image. When no routine exists, this section is absent — not an empty
   placeholder begging the customer to build one.
4. **Recently saved products** — up to 6 saved products from the
   customer's Shelf, shown as a horizontal rail with packshots. Each
   card shows lifecycle state (available/changed/unavailable) as a
   quiet visual cue. When no products are saved, this section is
   absent — not an empty placeholder.
5. **Fresh price evidence** — when eligible saved products have fresh
   market offers, show the current price/range and eligible exact store
   count with freshness. This is a truthful market reading, not a
   recommendation of the cheapest store. When no fresh evidence exists,
   this section is absent.
6. **Needs attention** — only when authoritative state requires it:
   a saved product that has become unavailable, a routine step whose
   product is no longer in the catalogue, a private request that has
   been matched or needs info. This is not a generic notification
   feed; it surfaces only honest lifecycle states that require a
   customer decision. When nothing needs attention, this section is
   absent.
7. **Explore continuation** — a quiet entry point to Explore, shown
   last. Not a hero, not a CTA banner — a link.

**What Home omits**: Analytics, charts, activity feeds, social proof,
urgency signals, decorative imagery that isn't the customer's own
product, dashboard tiles, a permanent analytical inspector, a
public-homepage hero, fake recommendation language, and any catalogue
product presented as customer preference.

**FAB**: Ask Me → `/me/consult`

### Explore (`/me/explore`)

**Job**: Browse or search every eligible exact product effortlessly.

Explore should feel like a continuous product lens, not a filtered grid.

- **Search-first**: The search field is the primary interaction. It
  should feel instant — typing filters the visible products in real
  time, not after a submit.
- **Progressive filters**: Category, step, brand, concern, retailer, and
  shelf-state filters live in a sheet (desktop: side panel, mobile:
  bottom sheet). Active filters show as removable chips above the
  results. Clear-all is always available.
- **Personal context as filter**: "On your Shelf" and "In your routine"
  are filter toggles, not separate views. This keeps Explore as one
  continuous catalogue with personal annotations.
- **Product cards**: Compact cards with packshot, brand, name, size,
  price (when fresh), and a quiet shelf-action button. Cards link to
  member Product with `from=explore` preserved.
- **Nothing matches**: Honest empty state with "Try a different search"
  and "Request a missing product" (links to `/me/shelf/add`).
- **Scroll memory**: Filter state and scroll position survive
  navigation to a product and back.

**FAB**: Search products → focus the search field

### Shelf (`/me/shelf`)

**Job**: Retrieve and organise intentionally saved exact products.

Shelf should feel like a personal product collection, not a grid of
search results.

- **Product-first layout**: Wide cards with large packshots on a warm
  surface. The visual language should feel like a vanity or shelf,
  not a catalogue grid.
- **Lifecycle awareness**: Available products show fresh price and
  retailer evidence. Changed products show a quiet "Product updated"
  cue with a link to the current version. Unavailable products show
  an honest "No longer available" state with a remove action.
- **Private requests separate**: A distinct section below saved
  products, visually quieter, showing request lifecycle (draft,
  pending, in review, matched, published, withdrawn). Never counted
  as saved products.
- **One-tap saving**: The add action is on every Explore card and
  member Product page. Removing is a card-level action with
  immediate visual feedback and undo.
- **Organisation**: Grouping by category or step is a future option,
  not a first-wave requirement. The initial experience is a single
  ordered collection with lifecycle states.

**FAB**: Add to your Shelf → `/me/shelf/add`

### Routine (`/me/routine`)

**Job**: Arrange a customer-authored care sequence.

Routine should feel like a visual care sequence, not a form.

- **One visual Routine representation**: The target is one visual
  Routine component that shows steps as a time-ordered flow (morning
  → evening → weekly) with product packshots, step names, and moment
  labels. Action-only steps show their label in a quiet card without
  a product image.
- **Editing through a structured sheet**: Editing (create, update,
  delete, reorder, add step) happens through the routine builder
  sheet, not through permanent inline reorder/delete controls
  scattered throughout the ordinary reading state. The reading state
  is clean and visual; the editing state is structured and modal.
- **Step states**: Confirmed steps (product in catalogue) show
  packshot and link. Unresolved steps (product no longer available)
  show "Product no longer available" with a remove or replace action
  in the edit sheet. Product-request steps show "Pending review"
  quietly.
- **Remove the duplicate presentation only after its interaction and
  conflict contracts are defined**: The current Routine page renders
  both a visual rail (RoutineRail) and a CRUD manager
  (RoutineManager). The target is one visual representation. The
  duplicate should be removed only after the interaction contract
  (how editing is entered, what conflicts look like, how reorder
  persists) and conflict contract (stale revision, concurrent edit)
  are defined and tested.

**FAB**: Create routine → open the routine builder sheet

**Wave assignment**: Routine restructuring is a separate later wave,
not the first implementation wave. The first wave is Home-only.

### Member Product (`/me/product/[slug]`)

**Job**: Understand one exact product in the customer's personal context.

Member Product should feel like a product page that knows the customer,
not a product page with shelf buttons bolted on.

- **Visual priority**: Large packshot, brand, name, display line,
  fresh price. These lead.
- **Current state**: The page already displays `priceLabel` from the
  portal product. A later wave must improve this to expose a truthful
  market reading consisting of price/range, eligible exact store count,
  and freshness — not merely a retailer name and not an endorsement of
  the cheapest store. The buy panel opens for detailed offer comparison.
- **Personal context**: "On your shelf" / "In your routine" appear
  as quiet visual facts near the product name, not as badges at the
  bottom. The shelf action (add/remove) is immediately accessible.
- **Care details**: Care note, ingredients, and usage appear in a
  progressive disclosure section — visible on scroll, not hidden
  behind a tab.
- **Back context**: `from=home|explore|shelf|routine` is preserved.
  Back returns to the originating surface with its state intact.

**FAB**: Find a store → open the buy panel

**Wave assignment**: Member Product improvements are a later wave,
not the first implementation wave. The first wave is Home-only.

### Ask Me (`/me/consult`)

**Job**: Receive care-first guidance using the customer's private context.

Ask Me should feel like one persistent conversation with clear phases,
not a search box.

- **Phase flow**: Describe → Clarify → Guide → Continue. Each phase
  transitions in-place with motion that explains what changed.
- **Private context**: The customer explicitly chooses which context
  (concerns, profile, current products) Ask Me may use. A context
  preview shows exactly what will be sent before submission.
- **Safety authority**: Reuses the public deterministic safety engine.
  Safety interrupts stop the journey with care-first guidance, not
  products. No parallel clinical authority is created.
- **Current state**: Today `/me/consult` is catalogue/context search.
  The authenticated adapter over the safety engine is Phase 4 of
  the production roadmap. The UI should be designed for that
  progression but not pretend it exists today.
- **Timeline**: Session-only by default. Persistent history is a
  future gate.

**FAB**: Search your care → focus the care field

### Account and helper surfaces

Account remains avatar-owned chrome behind a modal sheet, not a fifth
destination. The sheet contains identity, appearance control, report
link, Shelf export/clear, and sign out. The global "Report price or
availability" helper lives in the Account sheet and links to plain
`/contribute` with no private state attached.

## 4. Spatial and responsive model

### Phone (390 × 844)

- **Shell**: Fixed container, single scroll, topbar hides on scroll,
  dock at bottom.
- **Dock**: Compact mode shows current-page orb + context capsule +
  FAB. Tapping orb reveals four-tab navigation in the same row.
- **Home**: Single column. Personal summary, Shelf rail (horizontal
  scroll), Routine sequence (vertical), Ask Me entry.
- **Explore**: Single column. Search field sticky below topbar.
  Filter sheet is a bottom sheet. Product cards are full-width.
- **Shelf**: Single column. Wide product cards with packshot.
  Private requests in a separate section below.
- **Routine**: Single column. Visual sequence with moment labels.
  Create/edit/reorder/remove/delete happen inside the structured
  adaptive sheet, not inline in the reading state.
- **Product**: Stacked — packshot on top, story below, evidence
  inline, care details on scroll. Buy panel is a bottom sheet.
- **Ask Me**: Single column. Phase transitions in-place. Context
  preview is a collapsible section.

### Tablet (600 × 900)

- **Dock**: Expanded mode with context capsule above navigation.
- **Home**: Two-column asymmetric — greeting and Ask/search entry
  span full width. Continue your Routine and Recently saved products
  arrange adjacently with unequal widths. Feed order is preserved
  top-to-bottom. Not three equal dashboard tiles.
- **Explore**: Two-column product grid. Filter sheet is a side panel.
- **Shelf**: Two-column product cards. Private requests full-width
  below.
- **Routine**: Two-column sequence (morning | evening). Weekly steps
  full-width below.
- **Product**: Two-column — packshot | story + evidence. Care details
  full-width below.
- **Ask Me**: Single column, max-width constrained. Context preview
  is a side panel.

### Laptop (1000 × 800)

- **Dock**: Expanded mode. Navigation always visible.
- **Home**: Two-column asymmetric. Greeting and Ask/search entry
  span full width. Continue your Routine and Recently saved products
  arrange adjacently. Feed order preserved. Not equal dashboard tiles.
- **Explore**: Three-column product grid. Filter sheet is a side panel.
- **Shelf**: Two-column product cards with larger packshots.
- **Routine**: Two-column sequence with moment labels. Editing
  happens through the structured adaptive sheet.
- **Product**: Two-column — packshot | story + evidence + care details.
- **Ask Me**: Two-column — conversation | context preview.

### Wide desktop (1440 × 900)

- **Content**: Max-width 1440px, centered. No permanent density fill.
- **Home**: Asymmetric adjacent sections. Greeting and Ask/search
  entry span full width. Continue your Routine and Recently saved
  products arrange adjacently with unequal widths. Feed order is
  preserved top-to-bottom. Wider screens may arrange adjacent
  sections side by side but must not convert greeting, Shelf and
  Routine into three equal dashboard tiles.
- **Explore**: Three-to-four-column product grid. Filter sheet is a
  side panel.
- **Shelf**: Three-column product cards. Private requests in a
  separate full-width section.
- **Routine**: Three-column sequence (morning | evening | weekly).
- **Product**: Two-column — large packshot | story + evidence + care.
- **Ask Me**: Two-column — conversation | context preview.

### What remains persistent across all widths

- The dock (navigation + FAB + context)
- The topbar (brand + account avatar)
- The scroll container (one vertical scroll owner)
- Filter state, search state, and scroll position within a route

### What transforms

- Filter sheet: bottom sheet (mobile) → side panel (tablet+)
- Buy panel: bottom sheet (mobile) → side panel (tablet+)
- Product grid: 1 → 2 → 3 → 4 columns
- Routine sequence: vertical (mobile) → columns by moment (tablet+)
  Editing always happens in the structured sheet, not inline.
- Home composition: single column → asymmetric adjacent sections
  at wider widths, never three equal dashboard tiles

## 5. Visual language

### Surface hierarchy

1. **Page field** (`--cream`): The shell background. Warm, calm, never
   competes with content.
2. **Raised reading surface** (`--paper`): Cards, sheets, panels.
   Slightly lighter than the field. Depth via shadow, not borders.
3. **Warm section surface** (`--peach`/`--rose` gradients): Used for
   routine surfaces and accent sections. Never dominant.
4. **Floating controls** (`--paper` with glass): Dock, topbar, FAB.
   Backdrop blur with opaque fallback.
5. **Product imagery**: Always on transparent background. The product
   is the hero, not the card.

### Typography roles

- **Display** (Italiana 400): Route headings only. "My care.",
  "My Shelf.", "My Routine.", "My next product." Never used for
  controls, labels, or body.
- **Body** (Manrope regular): Product names, descriptions, care
  notes, guidance text.
- **Control** (Manrope semibold): Buttons, filter labels, dock
  labels, status. Compact, 0.72–0.82rem.
- **Caption** (Manrope regular, `--muted`): Secondary metadata,
  provenance, timestamps, lifecycle states.

### Product imagery

- Packshots always show the complete exact package on true
  transparency.
- Cards use packshots as the primary visual, not decorative
  backgrounds.
- Home Shelf/Routine previews use the same packshots as Explore and
  Product — no separate thumbnail system.
- Unavailable products show a quiet placeholder, not a broken image.

### Tonal hierarchy

- Warm cream/peach/rose surfaces separate sections without borders.
- `--wine` is the accent: text emphasis, focus rings, links, primary
  actions. Never a dominant fill.
- `--ink` is primary text. `--muted` is secondary.
- State colors (success, warning, danger) are signals, never
  decoration.
- Dark mode: black-first with warm hierarchy. Same composition,
  different temperature.

### Motion character

- **Route transitions**: Content fades/slides in the scroll direction.
  The dock and topbar remain stable.
- **Sheet/panel transitions**: Slide in from the side (desktop) or
  bottom (mobile) with a 220ms cubic-bezier(0.32, 0.72, 0, 1) curve.
- **Product card interactions**: Subtle scale on press, not hover
  (touch-first). Packshot lifts slightly on hover (fine pointer only).
- **State transitions**: Loading → ready is a crossfade, not a
  spinner-then-pop. Empty states appear immediately.
- **Reduced motion**: All transitions become instant. State changes
  are still visible through content, not motion.

### Use of glass, shadows, color, negative space

- **Glass**: Dock, topbar, floating sheets. `backdrop-filter: blur()`
  with opaque fallback for reduced transparency.
- **Shadows**: `--shadow` (restrained, warm, wine-tinted). Never
  hard-edged. Depth reads as elevation, not borders.
- **Color**: Warm palette throughout. Brown is accent, not dominant.
  No decorative borders as hierarchy.
- **Negative space**: Generous padding between sections. Content
  breathes. The product is the focus, not the chrome.

## 6. Interaction model

### Selection

- Tapping a product card opens member Product with `from` preserved.
- Tapping a concern selects/deselects it as context.
- Filter selections update the URL and results immediately.
- Selection state is visible (quiet highlight, not a heavy fill).

### Saving

- One-tap add to Shelf from any product card or member Product page.
- Immediate visual feedback: card shows "On your Shelf" state.
- Remove is a card-level action with undo (preview mode) or
  confirmation (production).
- Shelf mutations announce via a polite status region.

### Filtering

- Filter sheet opens from a toolbar button.
- Active filters show as removable chips above results.
- Clear-all resets to the full catalogue.
- Filter state survives navigation to a product and back.
- URL state makes filters shareable.

### Opening detail

- Product cards link to member Product.
- The buy panel opens from a "Find a store" action (FAB or button).
- The details panel opens from a "Details" action.
- On mobile, panels are bottom sheets. On desktop, side panels.
- Focus moves to the panel and returns to the trigger on close.

### Editing a routine

- The routine reading state stays clean and visual — no permanent
  reorder/delete controls in the ordinary reading state.
- Create/edit/reorder/remove/delete happen inside the structured
  adaptive sheet (the routine builder sheet).
- The sheet opens from the FAB or an "Edit routine" control.
- Reorder is a real mutation with server persistence.
- Edit exits with a visible "Routine saved" confirmation.

### Mutation feedback

- Every state-changing action answers immediately:
  - Show what changed (card state, count, message).
  - Announce via polite status region.
  - Preserve focus.
  - Provide undo or clear where reversible.
- No global toasts. Feedback is contextual to the action.

### Conflict

- Shelf add conflict (already saved): Show "Already on your Shelf"
  without error.
- Routine edit conflict (stale revision): Show "Routine was edited
  elsewhere" with a reload option.
- Network failure: Show "Could not save" with a retry action. Input
  is retained.

### Recovery

- Expired session: Redirect to sign-in with continuation. Return to
  the exact route and state.
- Data unavailable: Show honest "Unavailable" state with retry.
- Empty: Show honest empty state with one working next action.
- Error: Show what failed, whether data changed, and a safe retry
  or exit.

### Back and return context

- Stack pages get Back in the dock's left slot.
- Back returns to the parent with state preserved.
- `from` parameter is allowlisted and fails closed to Home.
- Scroll position survives Back navigation within a route.

## 7. Architecture proposal

### Route ownership and loading migration

The intended route/view/read-model architecture has been partially
extracted, but the live Me routes still need to be migrated from the
portal-wide `readCustomerPortal` boundary to route-scoped readers.

**Current state**: Home, Explore, Routine, and member Product now use their
route-scoped readers. Shelf, Consult, and the private request
stack still cross the portal-wide `readCustomerPortal(customer)` boundary
and remain the next migration cells.

**Target state**: Each route adapter calls its dedicated route-scoped
reader:

| Route | Owner | Read model | Current loader |
| --- | --- | --- | --- |
| `/me` | `app/(customer)/me/page.tsx` | `readMeHome()` → `CustomerHomeReadModel` | `readMeHome` |
| `/me/explore` | `app/(customer)/me/[...route]/page.ts` | `readMeExplore()` → `CustomerExploreReadModel` | `readMeExplore` |
| `/me/shelf` | same | `readMeShelf()` → `CustomerShelfReadModel` | `readCustomerPortal` |
| `/me/routine` | same | `readMeRoutine()` → `CustomerRoutineReadModel` | `readMeRoutine` |
| `/me/consult` | same | `readMeConsult()` → `CustomerConsultReadModel` | `readCustomerPortal` |
| `/me/product/[slug]` | same | `readMeProduct()` → `CustomerProductReadModel` | `readMeProduct` |
| `/me/shelf/add` | same | `readMeShelf()` + catalogue | `readCustomerPortal` |
| `/me/shelf/request/[id]` | same | `readMeShelf()` + request | `readCustomerPortal` |

The remaining route-scoped readers already exist in
`lib/customer/route-read-models.ts`; each unfinished route must migrate as
its own bounded release cell rather than restoring a portal-wide loader to
an already migrated surface.

### Feature boundaries

- `components/me/home/` — Home composition and shared view primitives
- `components/me/explore/` — Explore search, filters, and product grid
- `components/me/shelf/` — Shelf state, cards, and actions
- `components/me/routine/` — one visual Routine sequence plus its structured builder
- `components/me/consult/` — Ask Me view (future authenticated adapter)
- `components/me/product/` — Member Product view
- `components/me/product-requests/` — Private request lifecycle
- `components/me/shell/` — Me shell vocabulary, dock model, sheets

### Shared primitives

- `components/ui/use-modal-dialog.ts` — Modal behavior
- `components/ui/use-controlled-dialog.ts` — Controlled dialog adapter
- `components/ui/adaptive-selector.tsx` — Multi-mode selection
- `components/workspace-shell/` — Neutral dock mechanics
- `components/products/` — Shared product cards, images, panels

### Read models

Each route has a dedicated server-side read model in
`lib/customer/route-read-models.ts`. Read models:
- Derive the authenticated owner server-side.
- Load only the data needed for that route.
- Return a typed semantic view model.
- Include synthetic fallbacks for development.
- Never expose private data from other owners.

### Controllers

Client controllers (`useShelfState`, `useAdaptiveWorkspaceDockController`,
etc.) coordinate ephemeral interaction:
- Scroll state, filter state, sheet open/close, FAB registration.
- They invoke named server actions for mutations.
- They never authorise reads or writes.
- They reset on route change.

### State ownership

- **Server-owned**: Identity, Shelf items, Routines, Requests, Concerns.
- **Client-owned (ephemeral)**: Scroll position, filter state, sheet
  open/close, FAB registration, search query, panel tab.
- **Shared (client-mirror)**: Shelf items in preview mode (optimistic
  UI with server sync).

### Data/trust boundaries

- Public catalogue/offer/evidence is the single product truth.
- Private customer data is owner-isolated at service and datastore.
- Public routes stay account-free.
- The consult safety engine is public-owned and reused, not duplicated.
- No private data enters analytics, logs, public cache, or model
  training.
- Client state never authorises access.

## 8. Guardrail evaluation

### Proposed: Replace Home hero with personal product-and-care feed

- **Customer job**: A returning customer should understand their current
  care state immediately, not read a magazine cover or a dashboard.
- **Authoritative source**: Shelf and Routine read models already
  provide the data. `readMeHome()` already exists but is not wired
  into the live route adapter.
- **Does the behavior exist?**: HomeView renders Shelf and Routine
  previews; the hero is the part that feels editorial. The
  `catalogue[0]` fallback in `readCustomerPortal` and `readMeHome`
  presents a generic catalogue product as customer preference — this
  must be removed.
- **Public/private separation**: Preserved. Shelf/Routine are
  owner-derived server-side.
- **Who owns the interaction?**: HomeView in `components/me/home/`.
- **States**: Empty (no Shelf → section absent; no Routine → section
  absent; no attention items → section absent), loading, unavailable,
  ready, partial (one source unavailable).
- **Mobile**: Single column. Feed order preserved.
- **Testing**: Existing acceptance tests + visual verification at
  390, 600, 1000, 1440.

### Proposed: Member Product truthful market reading (later wave)

- **Customer job**: See a truthful market reading (price/range,
  eligible exact store count, freshness) without tapping a button.
- **Authoritative source**: `readProductPanelData()` already provides
  offers and price trends. The page already displays `priceLabel`.
- **Does the behavior exist?**: The buy panel shows detailed offers.
  The improvement is surfacing a truthful market reading inline —
  not merely a retailer name, not an endorsement of the cheapest
  store.
- **Public/private separation**: Preserved. Price evidence is public.
- **Who owns the interaction?**: MemberProductView.
- **States**: No offers → omit market reading. Stale offers → show
  with freshness cue. Fresh offers → show price/range + store count
  + freshness.
- **Mobile**: Market reading appears below product name. Buy panel
  opens for detailed comparison.
- **Testing**: Existing product panel tests + visual verification.
- **Wave assignment**: Later wave, not the first implementation wave.

### Proposed: Routine visual representation with structured sheet editing (later wave)

- **Customer job**: A care sequence should feel visual and authored,
  not administrative. Editing should be structured, not scattered.
- **Authoritative source**: Routine read model already provides steps
  with moments and product references.
- **Does the behavior exist?**: RoutineRail shows a visual preview;
  RoutineManager shows an editable list. The target is one visual
  representation with editing through a structured sheet. The
  duplicate rail+manager presentation should be removed only after
  the interaction and conflict contracts are defined.
- **Public/private separation**: Preserved. Routines are owner-derived.
- **Who owns the interaction?**: RoutineView in `components/me/routine/`.
- **States**: Empty (no routine → section absent), loading,
  unavailable, ready, editing (in sheet), conflict (stale revision).
- **Mobile**: Vertical sequence. Edit sheet is a bottom sheet.
- **Testing**: Existing routine tests + new interaction/conflict
  contract tests.
- **Wave assignment**: Separate later wave, not the first
  implementation wave.

### Proposed: Explore as continuous lens with personal context filters

- **Customer job**: Browse the full catalogue with personal context as
  a filter, not a separate view.
- **Authoritative source**: Explore read model already loads the full
  eligible projection.
- **Does the behavior exist?**: ExploreView already has shelf-state
  filter. The change is making it feel continuous.
- **Public/private separation**: Preserved. Shelf state is a filter,
  not a separate data source.
- **Who owns the interaction?**: ExploreView.
- **States**: Empty (no matches), loading, stale, error, ready.
- **Mobile**: Single column. Filter sheet is a bottom sheet.
- **Testing**: Existing explore model tests + visual verification.

### Proposed: Ask Me phase flow (future Phase 4)

- **Customer job**: Receive care-first guidance using private context.
- **Authoritative source**: Public consult safety engine. Must be
  reused, not duplicated.
- **Does the behavior exist?**: Public `/consult` has the full flow.
  `/me/consult` is currently search only.
- **Public/private separation**: Authenticated adapter must not log
  private context or query text.
- **Who owns the interaction?**: ConsultView + future authenticated
  API.
- **States**: Describe, clarify, guide, continue, safety interrupt,
  error, rate-limited.
- **Mobile**: Single column. Phase transitions in-place.
- **Testing**: Shared public/member safety corpus. Not implemented in
  first wave.

## 9. Chosen first implementation wave

### What it changes

**Wave 1: Home — personal product-and-care feed with route-scoped loading**

The first wave is Home-only. It does not bundle Member Product or
Routine restructuring. It does two things:

1. **Migrate the Home route from `readCustomerPortal` to
   `readMeHome()`** — completing the route-scoped loading pattern
   for `/me` as proof of the architecture migration.
2. **Replace the editorial hero with a personal product-and-care
   feed** — following the feed order defined in section 3.

The Home route must load through:

```
/me
    → readMeHome()
    → Home semantic model
    → HomeView
```

Do not continue using the full `readCustomerPortal` loader for the
Home route.

**Architecture rule**: `readMeHome` must produce a governed semantic
Home feed model. `HomeView` must not derive offer freshness, attention
eligibility, or lifecycle meaning directly from raw arrays. All
eligibility and lifecycle derivation stays server-owned in the read
model. The view renders semantic props — it does not inspect shelf
arrays to decide what needs attention, does not inspect offer arrays
to determine freshness, and does not inspect routine steps to
determine lifecycle state.

Specific changes:

- `app/(customer)/me/page.tsx`: Replace `readCustomerPortal(customer)`
  with `readMeHome(customer)`. Adapt the props passed to `MePortal`
  or `HomeView` to consume `CustomerHomeReadModel` instead of
  `CustomerPortalViewModel`.
- `lib/customer/route-read-models.ts`: Remove the `catalogue[0]`
  fallback from `readMeHome()`. `featuredProduct` must be `null`
  when no saved product exists — never a generic catalogue product.
  Remove `featuredProduct` from the Home read model if it is not
  needed for the personal feed (it was a hero prop; the personal
  feed does not need it).
- `components/me/home/home-view.tsx`: Replace the hero section with
  the personal feed:
  1. Personal greeting (preferred name)
  2. One Ask/search entry (link to `/me/consult`)
  3. Continue your Routine (when real — absent when empty)
  4. Recently saved products (when real — absent when empty)
  5. Fresh price evidence (when eligible — absent when no fresh
     offers)
  6. Needs attention (when authoritative state requires it — absent
     when nothing needs attention)
  7. Explore continuation (quiet link)
- `components/me/home/me-home.module.css`: Remove or repurpose
  `.hero`, `.heroCopy`, `.heroProduct`, `.heroHalo`,
  `.heroProductLabel`, `.heroQuiet`. Add classes for the personal
  feed sections.
- `lib/customer/read-model.ts`: The `readCustomerPortal` function
  remains for routes that still use it (explore, shelf, routine,
  consult, product). It is not deleted in this wave. Its
  `catalogue[0]` fallback should also be removed to prevent any
  route from presenting a generic catalogue product as customer
  preference.

### What it deliberately leaves untouched

- **Member Product**: No changes. The page already displays
  `priceLabel`. The later truthful market reading improvement
  (price/range, eligible exact store count, freshness) is a
  separate wave.
- **Routine**: No changes. The current rail + manager presentation
  remains. The later unification into one visual representation
  with structured sheet editing is a separate wave.
- **Explore**: No changes. The filter system and product grid
  remain. Improvements to continuity and scroll memory are future
  waves.
- **Dock mechanics**: The adaptive workspace dock is working and
  tested. No changes.
- **Shell architecture**: The fixed-shell, single-scroll model is
  sound. No changes.
- **Shelf persistence**: Owner-isolated immutable-version storage is
  working. No changes to the storage boundary.
- **Consult safety engine**: Public `/consult` is the authority. The
  authenticated adapter is Phase 4, not this wave.
- **Product requests**: The private request lifecycle is working. No
  changes.
- **Account sheet**: The helper chrome is working. No changes.
- **Other route adapters**: `app/(customer)/me/[...route]/page.ts`
  continues to use `readCustomerPortal` for non-Home routes. Their
  migration to route-scoped readers is a later wave.

### Likely files and architectural seams

- `app/(customer)/me/page.tsx` — Home route adapter (migrate to
  `readMeHome`)
- `lib/customer/route-read-models.ts` — Remove `catalogue[0]`
  fallback from `readMeHome`; adjust `CustomerHomeReadModel` type
- `lib/customer/read-model.ts` — Remove `catalogue[0]` fallback from
  `readCustomerPortal`
- `components/me/home/home-view.tsx` — Replace hero with personal feed
- `components/me/home/me-home.module.css` — Remove hero classes, add
  feed classes
- `components/me/home/shared-views.tsx` — Shared view primitives
  (RoutineRail, ShelfCard) used by the feed
- `components/me/home/me-home.tsx` — MePortal shell (adapt props for
  Home read model)
- `modules/acceptance/browser-evidence.test.ts` — Acceptance tests
- `modules/me/me-shell-contract.test.ts` — Shell contract tests

### Observable acceptance criteria

1. **No featured generic catalogue product**: Home never renders
   `catalogue[0]` as a customer's featured product. When no saved
   product exists, the featured product section is absent.
2. **No catalogue[0] personalisation**: The `catalogue[0]` fallback
   is removed from both `readMeHome` and `readCustomerPortal`.
3. **Existing actions remain working**: Shelf add/remove, Routine
   create/edit/delete, Account sheet, dock navigation, and FAB
   registration all continue to work.
4. **Home states are designed**: Empty (no Shelf → section absent;
   no Routine → section absent; no attention → section absent),
   partial (one source unavailable), unavailable (Shelf or Routine
   service down), loading, and ready states are all honest and
   offer one working action where applicable.
5. **No private state in URLs, logs, or public cache**: Home feed
   content is owner-derived server-side. No Shelf, Routine, concern,
   or identity data enters URLs, analytics, logs, or public cache.
6. **No new global state library**: The wave uses existing React
   hooks and context patterns.
7. **No changes to Ops or public catalogue truth**: The wave touches
   only `/me` Home route and its read model/view. No public route,
   catalogue, offer, or Ops contract changes.
8. **Responsive evidence**: Home looks correct at 390×844, 600×900,
   1000×800, and 1440×900. Dock behavior unchanged.
9. **Accessibility**: Keyboard navigation, focus management, screen
   reader announcements, 320px reflow, 200% zoom, and reduced motion
   all pass.
10. **Build, lint, typecheck, and focused tests pass**: All existing
    tests pass. New acceptance tests cover the Home feed.

## 10. Alternatives rejected

### Alternative: Keep the hero, add personal widgets below

**Rejected**: The hero is the first thing a returning customer sees.
If it's catalogue content (a featured product), it competes with the
personal summary for attention. Adding widgets below a large hero
creates a long scroll before the customer reaches their own state.
The hero should be replaced, not augmented.

### Alternative: Separate Shelf and Routine as full-screen destinations with their own scroll

**Rejected**: The fixed-shell, single-scroll model is a strength. It
creates app-like continuity. Separate scroll containers would break
the dock's scroll-based mode transitions and the topbar hide/show.
Shelf and Routine should remain routes within the shell.

### Alternative: Bottom tab bar instead of the adaptive dock

**Rejected**: The adaptive dock's four-mode behavior (expanded →
compact → navigation → single) is more sophisticated than a fixed
tab bar. It preserves navigation while reducing chrome on scroll.
A fixed tab bar would be simpler but less polished. The dock is
working and tested.

### Alternative: Server-side rendering for all views (no client controllers)

**Rejected**: The shell's scroll-based dock behavior, sheet
management, and FAB registration require client-side state. The
current hybrid (server read models + client controllers for
ephemeral state) is the right balance. Pure SSR would lose the
app-like continuity.

### Alternative: Global state library (Zustand, Jotai) for cross-route state

**Rejected**: No demonstrated need. Route-scoped ephemeral state with
React's built-in hooks (useState, useContext, useRef) is sufficient.
A global state library would add complexity without solving a real
problem. The current architecture deliberately keeps shell state
route-scoped and ephemeral.

### Alternative: Merge public and member product detail into one component

**Rejected**: Public product detail (`/products/[slug]`) and member
product detail (`/me/product/[slug]`) serve different audiences with
different context. Public is account-free and editorial. Member is
personal and contextual. Merging them would create conditional
branching that obscures both purposes. They should share data sources
and sub-components but remain separate route compositions.

### Alternative: Implement Ask Me authenticated adapter in this wave

**Rejected**: The authenticated Ask Me adapter is Phase 4 of the
production roadmap. It depends on Phase 3 (user-controlled Concerns)
and requires its own privacy review, abuse protection, and cost
policy. Implementing it now would skip the dependency chain and
ship a feature without its safety gates. The UI should be designed
for it but not implement it.

### Alternative: Add collections/tags/notes to Shelf

**Rejected**: The Shelf launch slice deliberately ships a flat
ordered collection. Organisation features are future gates that
require their own design and data decisions. Adding them now would
expand the data boundary without a clear customer job.

### Alternative: Bundle Member Product and Routine into the first wave

**Rejected**: The first wave must be Home-only. Bundling Member
Product and Routine restructuring into the first wave would expand
the review surface, increase regression risk, and conflate three
independent customer jobs. Member Product already displays
`priceLabel`; its later improvement (truthful market reading with
price/range, store count, and freshness) has its own design
contract. Routine has a duplicate presentation (rail + manager)
whose removal depends on defining interaction and conflict contracts
first. Each gets its own wave with its own review point.

### Alternative: Keep `readCustomerPortal` for Home, add route-scoped readers later

**Rejected**: The route-scoped readers already exist but are not
wired into the live route adapters. Continuing to use
`readCustomerPortal` for Home would perpetuate the portal-wide
loading boundary and delay the architecture migration. The Home
route is the simplest route to migrate (it needs the least data)
and serves as proof of the pattern. The `catalogue[0]` fallback in
both `readCustomerPortal` and `readMeHome` must be removed now to
prevent any route from presenting a generic catalogue product as
customer preference.

### Alternative: Dashboard tiles for Home

**Rejected**: A compact metrics dashboard (tile grid with counts,
charts, activity feeds) would make Home feel like an admin console,
not a personal care companion. The objective is a product-and-care
feed, not a metrics summary. No dashboard tiles, no permanent
analytical inspector, no fake recommendation language.
