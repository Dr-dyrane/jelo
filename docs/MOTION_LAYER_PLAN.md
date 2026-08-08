# JeloCare Motion Layer Plan

> Status: **Planned** — not yet implemented.
> Reference: [Lusion](https://lusion.co/projects) set the bar for atmospheric,
> scroll-driven, context-aware motion. This plan defines JeloCare's motion layer
> without copying Lusion's style — the goal is to make JeloCare feel _alive_ in a
> way that serves its specific product: price intelligence, care reviews, and
> Nigerian skincare context.

## Design principles

1. **Motion serves meaning.** Every animation communicates something specific —
   price is live intelligence, care status is an earned approval, the consult is
   a human guide. No decorative motion.
2. **Warm, not cold.** The palette is cream/wine/peach — an apothecary, not a
   dashboard. Easing curves are organic (long settle, gentle overshoot). Pacing
   is slower than SaaS.
3. **Progressive enhancement.** Framer Motion everywhere. WebGL only where the
   device can handle it, with graceful fallback to the existing CSS atmosphere.
4. **Trust through restraint.** This is a health site. Motion should feel
   confident and deliberate, not playful or attention-seeking. The care review
   moment is slow and weighted, not bouncy.
5. **Nigerian context.** NGN prices, NAFDAC checks, Nigerian retailers. The
   motion reinforces "this was built for you" — not generic global SaaS polish.

---

## Architecture

### Two layers

| Layer       | Technology       | Scope                                                | Bundle        | Fallback                          |
| ----------- | ---------------- | ---------------------------------------------------- | ------------- | --------------------------------- |
| Interaction | Framer Motion    | Every page                                           | ~15KB gzipped | CSS transitions (already present) |
| Atmosphere  | WebGL via `regl` | Hero, product image, ingredient explorer, share card | ~12KB gzipped | CSS gradients / backdrop-filter   |

### Device capability detection

`lib/device-capability.ts` exports `canUseWebGL()` and `canUseHeavyMotion()`:

- Check `navigator.gpu` or WebGL context creation
- Check `navigator.connection.effectiveType` (skip WebGL on 2g/3g)
- Check `navigator.hardwareConcurrency` (skip on <4 cores)
- Cache result in sessionStorage

WebGL components call `canUseWebGL()` before rendering. If false, the existing
CSS atmosphere remains — no layout shift, no broken states.

---

## Primitives

All in `components/motion/`. All client components. All respect
`useReducedMotion()` from Framer Motion.

### `reveal.tsx` — scroll-triggered entrance

Wraps any content. Fades + slides in when entering viewport.
`whileInView` with `viewport={{ once: true, margin: "-60px" }}`.
Reduced motion: render children directly, no wrapper.

### `stagger.tsx` — orchestrated group entrance

Container with `staggerChildren`. Each child fades/slides in sequence.
Configurable delay, stagger interval, direction.

### `parallax.tsx` — scroll-linked depth

`useScroll` + `useTransform` to translate element based on scroll position.
Subtle range (±20px for backgrounds, ±8px for foregrounds).

### `counter.tsx` — number count-up

`useMotionValue` + `animate()` to count from 0 to value.
Only animates when in viewport. Reduced motion: render final value.

**Context-specific behavior:**

- Price counter: 1.2s duration with settle ease — the price feels _discovered_
- Store count: 0.6s with snappier ease — a quick fact
- Percentage changes: count from 0, arrow draws after number settles

### `stamp.tsx` — trust mark entrance

Scale 1.15 → 0.98 → 1 with a warm radial flash (using `--peach` at low opacity).
0.5s duration. The overshoot is small — it's a _stamp_, not a bounce.
The timing is deliberate — slower than a typical entrance, because trust
should feel earned.

### `magnetic-link.tsx` — cursor gravitation

`useMotionValue` for x/y, `useSpring` for smooth follow.
Strength: 6px (subtle — the button _leans_ toward you).
Spring: stiffness 150, damping 15 (gentle lag, not rigid).
Disabled on touch devices and reduced motion.

---

## Homepage

### Hero — the "morning light" atmosphere

**WebGL morning light shader** (`components/motion/morning-light-canvas.tsx`):

A fullscreen WebGL canvas behind the hero content. A fragment shader renders a
volumetric warm light — a slow-moving gradient that feels like morning sunlight
filtering through a window.

- Base colors shift between `--cream`, `--peach`, `--rose` over a 25s cycle
- A large radial gradient (the "sun") drifts using Perlin/Simplex noise
- Subtle procedural grain texture — like film grain
- Opacity 0.4–0.6 — atmosphere, not background replacement
- Existing `HeroShade` overlay sits on top, text remains readable
- Pauses when hero is out of viewport (IntersectionObserver)
- Resolution halved on mobile for performance

**Fallback:** CSS `HeroAura` radial gradient (already present).

**Hero content entrance:**

| Element              | Animation                         | Timing                                      |
| -------------------- | --------------------------------- | ------------------------------------------- |
| Morning light canvas | Fade in (opacity 0 → 0.5)         | 1.5s on mount                               |
| Kicker               | Slide up + fade                   | 0s delay, 0.6s                              |
| H1                   | Slide up + fade                   | 0.08s delay, 0.7s                           |
| Deck                 | Slide up + fade                   | 0.16s delay, 0.6s                           |
| Action buttons       | Slide up + fade                   | 0.24s delay, 0.5s                           |
| HeroProduct          | Keep existing `heroFloat` CSS     | No change                                   |
| GlassCard (top)      | Slide from right + parallax depth | 0.4s delay, then scroll-linked y 0 → -40px  |
| GlassCard (bottom)   | Slide from right + parallax depth | 0.52s delay, then scroll-linked y 0 → -20px |

**Glass card content (context-specific):**

- Top card shows product name + price → price uses `counter.tsx` to count up from ₦0
- Bottom card shows concern → concern name fades in with slight scale (0.95 → 1)

**Scroll-away behavior:**

- Morning light opacity fades 0.5 → 0 (atmosphere dissolves)
- Hero copy moves up slightly faster than scroll (parallax y 0 → -30px)
- Glass cards move at different rates (depth parallax)
- HeroProduct moves slowest (furthest back element)

### CategoryGrid — the "cards on a table" entrance

Each of the 5 cards enters from a slightly different angle — like cards being
laid on a table from left to right. Subtle angular offset (±8px).
Stagger interval: 0.08s.

### Story section — the editorial moment

- Story text: reveal from left
- Story image: reveal from right + **Ken Burns drift** (scale 1 → 1.08 over 20s,
  slow pan) — makes the photograph feel alive, like looking through a window
- Parallax on scroll (y 0 → -20px)

### DiscoveryRails — the "live feed" feel

- Rail header: reveal when rail enters viewport
- Product cards (first 4 visible): staggered entrance (0.06s interval)
- Product card price: `counter.tsx` count-up
- "See all" link: subtle spring scale (1 → 0.97 → 1) on click

### MarketTrendsSection — the "ticker tape" feel

- Ticker cards: slide in from right like a ticker tape, 0.12s apart
- Price change percentage: `counter.tsx` counts from 0
- Arrow (↓/↑): draws after the number settles — downward for drops, upward for increases

### Consult CTA — the "inviting" moment

- CTA container: reveal with slight scale (0.98 → 1)
- CTA button: **breathing scale** (1 → 1.02 → 1, 4s loop) — a _breath_, not a pulse
- Magnetic hover on desktop (pauses breathing on hover)
- Breathing pauses when scrolled past (IntersectionObserver)

---

## Product page

### Product hero — staggered story

The product story staggers in element by element — curated, not dumped:

| Element                     | Delay                                         |
| --------------------------- | --------------------------------------------- |
| Brand eyebrow               | 0s                                            |
| Product name (h1)           | 0.06s                                         |
| Title meta (size, category) | 0.12s                                         |
| Size selector               | 0.18s                                         |
| Market price                | 0.24s (counter count-up from ₦0, 1.2s settle) |
| Quick panel trigger         | 0.36s                                         |
| Concern links               | 0.42s                                         |

### Care status — the "stamp" moment

- Care status badge: `stamp.tsx` — scale 1.15 → 0.98 → 1 with warm radial flash
- "Why JeloCare" section: reveal with **deliberate slow ease** (0.8s, long settle)
- Evidence sources: staggered entrance (each source 0.1s apart)

The trust pacing is slower than normal reveals (0.8s vs 0.5s). This is the
moment where JeloCare earns trust — it shouldn't feel rushed.

### Product image — the "held in hand" effect

**WebGL product light shift** (`components/motion/product-light-shift.tsx`):

A WebGL overlay on the product image that adds a subtle light response to cursor
movement. As the cursor moves over the product image, a soft warm highlight
shifts — like light hitting a package from different angles.

- Radial gradient highlight follows cursor (smoothed with lerp)
- Warm color (`--peach` at 0.15 opacity)
- Only affects brightness, not colors
- Very subtle — you feel it more than you see it
- Pauses when cursor leaves the image area

**Fallback:** existing `drop-shadow` CSS.

### Ingredient explorer — the "clinical reference" unfold

- Chevron: spring rotation (180°, stiffness 200, damping 18)
- Disclosure content: unfold with spring + slight depth shift (translateZ)
- Ingredient chips: staggered entrance inside disclosure (0.04s interval)

**WebGL particle field** (`components/motion/ingredient-particles.tsx`):

When the ingredient explorer opens, a subtle particle field appears behind the
content — quiet, ambient, suggesting molecular structures.

- 80–120 particles (fewer on mobile)
- Particles drift using Perlin noise (no linear movement)
- Tinted by product category (peach for face, sage for body, rose for hair)
- Small (2–4px), low opacity (0.1–0.2)
- Don't interact with cursor — ambient, not interactive
- Fade in when disclosure opens, fade out when closed

The particle field communicates that JeloCare understands ingredients at a
molecular level. The particles are quiet and slow — present, not aggressive.

### RelatedProducts — the "discovered" entrance

- Section header: reveal when Suspense resolves
- Product cards (3): staggered entrance (0.1s interval — slower than homepage,
  reinforcing the "finding" feeling)
- Card prices: `counter.tsx` count-up

---

## Share page

### Headline — the "news flash" moment

- Headline: reveal with emphasis (slide up + fade + slight scale 0.96 → 1, 0.6s)
- ScreenshotButton: reveal (fade in, 0.2s after headline)

### Price drop animation — the "settling" moment

A 6-step choreography (~2 seconds total):

1. Old price is visible (static)
2. A line strikes through it (left to right, 0.3s)
3. New price slides down from above and settles (y: -20px → 0, 0.4s)
4. Percentage badge counts from 0 to 15.6% (0.8s)
5. Arrow draws downward (0.2s, after number settles)
6. "₦2,237 lower" text fades in (0.2s after arrow)

This tells a story: "this was the price, now this is the price, and here's how
much you save."

### ProductTrendsChart — the "data drawing" moment

- SVG line: `pathLength` animation — draws itself left to right (1.2s)
- Data points: pop in (scale 0 → 1) staggered along the line
- Time window tabs: fade in after chart draws
- Axis labels: fade in before the line draws

When switching time windows (7D → 14D):

- Old line retracts (pathLength 1 → 0, right to left, 0.3s)
- New line draws in (pathLength 0 → 1, left to right, 0.6s)

### ShareCard — WebGL glass refraction

**`components/motion/glass-refraction.tsx`**:

The ShareCard already uses `backdrop-filter: blur()`. The WebGL layer adds a
subtle refractive distortion — the product image behind the glass shifts very
slightly based on scroll position, like looking through a real glass panel.

- Procedural displacement map (Perlin noise)
- Very small displacement (±3px) — a hint of glass
- Shifts slowly as you scroll

**Fallback:** existing CSS `backdrop-filter: blur()`.

### ShareAlternatives

- Alternative cards (3): staggered entrance (0.1s interval)
- Card prices: `counter.tsx` count-up

---

## Products listing

### Hero stage

- Hero copy: reveal on load
- Editorial image: parallax (±20px) + Ken Burns drift
- Search bar: reveal (0.15s after hero copy) + focus glow on focus

### Browse rail

- Browse tabs: reveal (fade in)
- Browse rail pills: staggered entrance (horizontal slide-in from left, 0.05s)
  — direction matches interaction direction (horizontal scroll)

### Catalogue stories

- Story cards (3): staggered entrance (0.1s interval)
- Story images: subtle parallax (±15px)

### Product grid — the "filter transition"

- Initial load: staggered entrance in batches of 6 (0.04s within batch, 0.1s between)
- Filter change: old items fade out + scale down (0.3s) → new items stagger in
  — the grid _transforms_, not a hard cut

### Filter sheet

- Open: spring slide-up (stiffness 300, damping 30)
- Close: spring slide-down
- Filter options: staggered entrance inside sheet (0.03s interval)

---

## Shared elements

### SiteHeader

- Header background: keep existing `.scrolled` CSS transition
- Menu dialog: replace CSS animation with Framer Motion spring
- Menu links: staggered entrance (0.04s interval, slide from right)

### Theme toggle — the "sunset to dusk" transition

- Toggle icon: spring rotation (sun rotates 180° → moon)
- Color transition: `transition: background-color 0.4s ease, color 0.4s ease` on body
- WebGL hero: shader colors shift from warm cream/peach to deep wine/ink over 0.8s

Light mode is morning. Dark mode is evening. The transition feels like
sunset → dusk — gradual, warm, not a harsh switch.

### Page transitions

- Route exit: fade out + slight scale down (0.2s)
- Route enter: fade in + slight scale up (0.3s)
- Via `AnimatePresence` in site layout
- Only between `(site)` routes

### Screenshot button

- Keep existing flash + shutter sound
- Card after capture: subtle settle (scale 1 → 0.98 → 1, 0.4s) — like a photo being taken

### Product quick panel

- Panel slide-in: keep existing CSS animation
- Backdrop: subtle blur increase (backdrop-filter 0 → 8px, 0.2s)
- Tab content: staggered entrance when switching tabs (0.04s interval)
- Retailer list items: staggered entrance (slide from right, 0.05s interval)

---

## Magnetic hover (desktop only)

| Element                       | Strength                        |
| ----------------------------- | ------------------------------- |
| Hero "Browse products" button | 6px                             |
| Hero "Ask JeloCare" button    | 6px                             |
| Consult CTA button            | 6px (pauses breathing on hover) |
| Share button                  | 4px                             |
| "See all" links               | 3px                             |

Disabled on touch devices, reduced motion, and low-end mobile.

---

## Reduced motion strategy

Every primitive checks `useReducedMotion()`. When reduced motion is preferred:

| Component           | Behavior                           |
| ------------------- | ---------------------------------- |
| Reveal              | Children render directly           |
| Stagger             | Children render directly           |
| Parallax            | No transform                       |
| Counter             | Final value rendered immediately   |
| Stamp               | Badge renders at scale 1, no flash |
| Magnetic            | No cursor tracking                 |
| WebGL shaders       | Do not render, CSS fallback        |
| Ken Burns           | No drift                           |
| Chart path draw     | Line renders at full pathLength    |
| Price drop sequence | New price renders immediately      |

---

## WebGL performance budget

| Shader           | Resolution                  | FPS target                  | Pauses when                |
| ---------------- | --------------------------- | --------------------------- | -------------------------- |
| Morning light    | 0.5x DPR mobile, 1x desktop | 30fps mobile, 60fps desktop | Hero out of viewport       |
| Product light    | 1x DPR                      | 60fps                       | Cursor not over image      |
| Particles        | 0.5x DPR                    | 30fps mobile, 60fps desktop | Disclosure closed          |
| Glass refraction | 1x DPR                      | 60fps                       | Share card out of viewport |

---

## Implementation order

| Priority | Phase | What                                                                           | Impact           |
| -------- | ----- | ------------------------------------------------------------------------------ | ---------------- |
| 1        | 0     | Install Framer Motion, device capability detection                             | Foundation       |
| 2        | 1     | Create 6 primitives                                                            | Foundation       |
| 3        | 2     | Homepage hero — staggered entrance + parallax + WebGL morning light            | First impression |
| 4        | 3     | Homepage body — category fan-out, Ken Burns, ticker tape, consult breathing    | Homepage         |
| 5        | 4     | Product page — staggered story, price counter, care stamp, WebGL product light | Product page     |
| 6        | 4     | Ingredient explorer — disclosure unfold + WebGL particles                      | Clinical depth   |
| 7        | 5     | Share page — price drop sequence, chart path draw, WebGL glass                 | Shareable moment |
| 8        | 6     | Products listing — grid stagger, filter transition, hero parallax              | Browse           |
| 9        | 7     | Shared — header, theme sunset, page transitions, quick panel, screenshot       | Polish           |
| 10       | 8     | Magnetic hover on all CTAs                                                     | Desktop polish   |
| 11       | 9     | Mobile full-screen search overlay with live results                            | Mobile core      |
| 12       | 10    | Mobile swipeable rails (related products, share alternatives)                  | Mobile polish    |
| 13       | 10    | Mobile filter bottom sheet with live preview                                   | Mobile polish    |
| 14       | 10    | Mobile full-screen menu with staggered links                                   | Mobile polish    |
| 15       | 11    | Mobile consult full-screen guided flow                                         | Mobile app feel  |

---

## What this plan does NOT include

| Excluded                      | Reason                                                                    |
| ----------------------------- | ------------------------------------------------------------------------- |
| Custom cursor                 | Gimmicky on a health/trust site. Magnetic hover is enough.                |
| Sound design (beyond shutter) | Intrusive on websites. Shutter works because it's a deliberate action.    |
| Lottie animations             | SVG path animation and CSS keyframes cover the use cases.                 |
| Lenis/smooth-scroll           | Native `scroll-behavior: smooth` is sufficient.                           |
| Full 3D product viewer        | Product images are 2D. A 3D viewer would require assets that don't exist. |
| Page-wide particle background | Too aggressive for a health site. Particles only in ingredient explorer.  |

---

## Testing plan

| Layer                    | How                                                             |
| ------------------------ | --------------------------------------------------------------- |
| Framer Motion primitives | Playwright snapshot comparison before/after                     |
| Scroll reveals           | Playwright: scroll to element, check computed opacity/transform |
| Counter                  | Playwright: check final rendered text matches expected value    |
| WebGL shaders            | Manual: Chrome, Safari, Firefox. Verify fallback on mobile.     |
| Reduced motion           | Playwright: set prefers-reduced-motion, verify no transforms    |
| Performance              | Lighthouse: verify LCP, CLS, TBT don't regress                  |

---

## Immersive mobile functional experiences

Mobile is not a smaller desktop. The interaction model is different: no
hover, no keyboard, smaller viewport, touch-first. This section defines
mobile-specific experiences that go beyond responsive CSS — they change
the interaction pattern itself.

### Mobile full-screen search

**Current state:** The search component
(`components/products/catalogue-search.tsx`) uses the same component on
desktop and mobile. On mobile, the suggestions dropdown becomes a
fixed bottom sheet (`position: fixed, inset: auto .6rem .6rem`). To see
full search results, the user must tap the "Go" submit button, which
reloads the page to `/products?q=...`. The dropdown shows up to 7
suggestions, but the full product grid only appears after form
submission.

**Problem:** The bottom-sheet dropdown is cramped on mobile. The
"press Enter to get results" pattern feels like a 2010 web form. Users
expect instant results as they type — the way Instagram, Spotify, or
Apple's App Store work. The page reload on submit breaks the flow.

**Solution: A full-screen search overlay for mobile.**

When the user taps the search input on mobile (viewport < 640px), a
full-screen search experience slides up from the bottom. It is not a
dropdown — it takes over the entire viewport. The experience is:

1. **Open:** User taps search input. The full-screen overlay slides up
   with a spring animation (y: 100% → 0, stiffness 320, damping 34).
   The search input is auto-focused and the keyboard opens. The
   background dims (opacity 0 → 1, 0.2s).

2. **Search as you type:** As the user types, results appear instantly
   below the input — no page reload, no "Go" button required. The
   existing 140ms debounce is kept. Results are fetched from
   `/api/products/suggestions` and rendered as a scrollable list.

3. **Result sections:** Results are grouped into sections:
   - **Products** (top 8) — product image, name, brand, price, tap to
     navigate to product page
   - **Companies** (top 3) — brand name, tap to filter products page
   - **Categories** (top 3) — category name, tap to filter products page
   - **Guides** (top 3) — concern name, tap to navigate to concern page

   Each section header is sticky within the scroll container. Sections
   appear with a subtle stagger as they populate (0.04s interval).

4. **Live product grid:** Below the grouped suggestions, a "See all
   products" section shows a 2-column grid of matching products that
   loads lazily (Suspense). This gives the user a visual sense of the
   full result set without leaving the search screen.

5. **Empty state:** When the query has no matches, show a warm empty
   state: "We couldn't find that. Try a brand name, ingredient, or
   concern." Plus a "Ask us to find it" link to the consult flow.

6. **Recent searches:** When the input is empty and focused, show
   recent searches (stored in localStorage, max 5). Each is tappable
   to re-run. A "Clear recent" button appears below.

7. **Close:** User taps the back arrow or presses the hardware back
   button. The overlay slides down (y: 0 → 100%, 0.3s) and the
   background undims. The previous page state is preserved — no reload.

8. **Navigation:** Tapping any result navigates to the destination.
   The overlay closes with a fade-out (opacity 1 → 0, 0.15s) before
   navigation, so the transition feels seamless.

**Component:** `components/search/mobile-search-overlay.tsx` (client
component, lazy-loaded on mobile only)

**Detection:** Use `matchMedia("(max-width: 640px)")` to determine
whether to show the overlay vs the existing dropdown. The existing
`CatalogueSearch` component renders the overlay trigger on mobile and
the dropdown on desktop. No separate route — the overlay is a
client-side layer.

**Motion:**

| Element                  | Animation                                                            |
| ------------------------ | -------------------------------------------------------------------- |
| Overlay entrance         | Slide up from bottom (y: 100% → 0, spring stiffness 320, damping 34) |
| Background dim           | Fade in (opacity 0 → 1, 0.2s)                                        |
| Search input             | Auto-focus on open, cursor blinks                                    |
| Result sections          | Stagger in as they populate (0.04s interval, slide up + fade)        |
| Product grid items       | Stagger in (0.03s interval, 2-column)                                |
| Empty state              | Fade in with slight scale (0.96 → 1, 0.4s)                           |
| Overlay close (back)     | Slide down (y: 0 → 100%, 0.3s, ease-in)                              |
| Overlay close (navigate) | Fade out (opacity 1 → 0, 0.15s)                                      |
| Recent searches          | Slide in from left (0.05s interval)                                  |

**Accessibility:**

- The overlay traps focus while open (focus returns to the search
  input). Escape key closes the overlay. `aria-modal="true"` on the
  overlay container. `role="dialog"` with `aria-label="Search"`.
- The hardware back button (Android) closes the overlay using the
  History API (`history.pushState` on open, `popstate` listener to
  close).
- Reduced motion: overlay appears instantly (no slide), results render
  without stagger.

**Performance:**

- The overlay component is lazy-loaded (`next/dynamic` with
  `ssr: false`) so it doesn't affect initial page weight on mobile.
- The existing `/api/products/suggestions` endpoint is reused — no new
  API route needed.
- The live product grid uses `Suspense` with a skeleton loader.
- The overlay is unmounted when closed (not hidden) to free memory.

**What this replaces on mobile:**

- The bottom-sheet dropdown (`@media (max-width: 640px)` in
  `catalogue-search.module.css`) is no longer rendered on mobile.
- The "Go" submit button is removed on mobile — search is live.
- The form submission to `/products?q=...` is replaced by client-side
  navigation from the overlay.

**What stays the same on desktop:**

- The existing dropdown with keyboard navigation (Arrow keys, Enter,
  Escape, Tab) remains unchanged. Desktop has a keyboard, so the
  "type → arrow → enter" pattern is natural and fast.

### Mobile product page: swipeable related products

**Current state:** Related products render as a 3-column grid below the
product story. On mobile, this becomes a vertical stack of 3 cards.

**Improvement:** On mobile, related products become a horizontal
swipeable rail with scroll-snap. Each card is 80% viewport width, so
the next card peeks from the right edge — signaling that there's more
to explore. A subtle haptic feedback (navigator.vibrate, 10ms) fires
when a card snaps into place.

This is not a new component — it reuses the existing `ProductRail`
pattern but applies it to related products on mobile only.

### Mobile share page: swipeable alternatives

**Current state:** Share alternatives render as a 3-column grid.

**Improvement:** On mobile, alternatives become a swipeable rail (same
pattern as related products above). The first card is the primary
share card, and alternatives slide in from the right.

### Mobile consult: full-screen guided flow

**Current state:** The consult experience is a page with a product
carousel and chat input.

**Improvement:** On mobile, the consult becomes a full-screen guided
flow — each step takes the full viewport, with smooth horizontal slide
transitions between steps. The product carousel becomes a swipeable
horizontal rail. The chat input is fixed at the bottom with a safe-area
inset. This makes the consult feel like a native app experience, not a
web page with a chat box.

**Motion:**

| Element                 | Animation                                                           |
| ----------------------- | ------------------------------------------------------------------- |
| Step transition         | Horizontal slide (x: ±100% → 0, spring stiffness 300, damping 30)   |
| Product carousel        | Swipeable rail with scroll-snap (existing pattern)                  |
| Chat input              | Fixed bottom with safe-area inset, subtle slide up on keyboard open |
| Step progress indicator | Animated dots at top, current dot scales (1 → 1.3 → 1)              |

### Mobile filter sheet: bottom sheet with live preview

**Current state:** The inventory filter sheet opens as a dialog.

**Improvement:** On mobile, the filter sheet becomes a bottom sheet
that slides up from the bottom (spring animation). As the user toggles
filters, the product grid behind the sheet updates live (dimmed). When
the sheet is dismissed, the grid is already filtered — no reload.

**Motion:**

| Element          | Animation                                                |
| ---------------- | -------------------------------------------------------- |
| Sheet open       | Slide up (y: 100% → 0, spring stiffness 320, damping 34) |
| Backdrop         | Fade in + blur (backdrop-filter 0 → 4px, 0.2s)           |
| Filter toggles   | Spring scale on tap (1 → 0.95 → 1)                       |
| Live grid update | Items fade out + fade in behind the sheet (0.2s)         |
| Sheet close      | Slide down (y: 0 → 100%, 0.3s)                           |
| Haptic feedback  | navigator.vibrate(10ms) on filter toggle                 |

### Mobile navigation: full-screen menu with staggered links

**Current state:** The site header menu opens as a dialog with
`backdrop-filter: blur(12px)`.

**Improvement:** On mobile, the menu becomes a full-screen overlay
that slides in from the right. Links stagger in from right to left
(0.04s interval). The close button is a large touch target in the top
right. The footer (theme toggle, social links) is pinned at the bottom.

**Motion:**

| Element     | Animation                                                        |
| ----------- | ---------------------------------------------------------------- |
| Menu open   | Slide from right (x: 100% → 0, spring stiffness 320, damping 34) |
| Links       | Stagger in from right (0.04s interval, slide left + fade)        |
| Footer      | Fade in after links (0.2s delay)                                 |
| Menu close  | Slide right (x: 0 → 100%, 0.3s, ease-in)                         |
| Bundle size | `next build` output — Framer Motion ~15KB expected               |
