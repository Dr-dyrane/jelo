# JeloCare — Public Experience Renaissance

## Comprehensive Design & Product Audit (2026)

---

## 1. Executive Summary

JeloCare is a pharmacist-led skincare intelligence platform with a strong existing foundation: a warm editorial visual language, evidence-based product data, safety-first concern guides, and a sophisticated design token system. The codebase is well-structured with 60+ components, comprehensive dark mode, and thoughtful accessibility patterns.

However, the PWA experience is incomplete (no service worker, no offline support, no install prompt), the home page suffers from scroll fatigue (9 product rails), the retailer handoff is abrupt (no trust bridge), and several accessibility gaps remain (no skip link, inconsistent focus indicators). The design system has tokens but no shared UI primitives (no Button, Modal, Toast, or Chip components for public use).

The customer insight — *"I wanted JeloCare itself to process the order because I trusted JeloCare more than the retailer"* — is the most important signal in this audit. It means JeloCare has become the trust layer. Every improvement should reinforce that trust without pretending JeloCare fulfils orders.

**Overall design quality: 7.5/10** — Strong foundation, clear identity, but incomplete PWA, missing UI primitives, and opportunities to deepen trust at the retailer handoff.

---

## 2. Product Strengths

| Strength | Evidence |
|----------|----------|
| **Pharmacist-led identity** | Care review badges, "Guidance, not a diagnosis" disclaimers, safety interrupts in consult, urgent action sections on concern pages |
| **Evidence-based data** | Graded ingredient evidence (High/Moderate/Early/Insufficient), source links on all product-ingredient relationships, price observation dates |
| **Warm editorial design** | Italiana serif for display, warm cream/wine/peach palette, layered gradient washes, glass morphism navbar |
| **Sophisticated token system** | 80+ CSS custom properties, 8pt spacing scale, concentric radius system, motion tokens, elevation scale, dual dark mode (data-theme + prefers-color-scheme) |
| **Safety-first consult** | Open-ended prompt with optional safety profile, safety interrupts for serious concerns, "No products selected" for safety cases, follow-up tracking |
| **Transparent pricing** | Trust scores per retailer, "Listed by the brand" indicators, "Check seller" warnings, price freshness indicators, market summaries |
| **Strong accessibility baseline** | 100+ aria-label instances, keyboard navigation in search/autocomplete, focus trapping in modals, reduced-motion support, ARIA live regions |
| **Good loading states** | Shimmer skeletons for products and product detail, error boundaries with recovery CTAs, 404 with brand voice |
| **Dynamic content** | Home page adapts to catalogue data (category tags, signals, product availability), concern selector matches products in real-time |

---

## 3. Critical Weaknesses

| Weakness | Impact | Severity |
|----------|--------|----------|
| **No service worker** | No offline support, no cached pages, poor PWA experience | Critical |
| **No install prompt** | Users never prompted to install, low install rate | High |
| **No skip link** | Keyboard users must tab through entire navbar to reach content | High |
| **Abrupt retailer handoff** | 307 redirect with no trust bridge — user leaves JeloCare with no confirmation or context | High |
| **9 product rails on home** | Scroll fatigue, unclear hierarchy, "everything is important so nothing is" | Medium |
| **No shared UI primitives** | Buttons, modals, toasts, chips all inline — inconsistent variants across pages | Medium |
| **No search placeholder** | Empty search input gives no guidance on what to search for | Medium |
| **No page transitions** | Route changes are instant cuts — no context preservation, no shared element transitions | Medium |
| **No global error boundary** | Root layout has no error boundary — unhandled errors show raw Next.js error page | Medium |
| **Static price history fallback** | Chart uses static data when DB not configured — data may be stale | Low |
| **No structured data (JSON-LD)** | Missing Organization, FAQ, Breadcrumb, Product schemas — SEO opportunity lost | Low |
| **No grain/texture** | Atmosphere relies only on gradients and blur — feels flat in some contexts | Low |

---

## 4. Quick Wins

*Things that can be shipped in hours, not days.*

### 4.1 Add skip link
- **Rationale:** Keyboard and screen reader users currently tab through the entire navbar. A "Skip to main content" link is a WCAG 2.1 Level A requirement.
- **User impact:** Immediate navigation improvement for assistive technology users.
- **Engineering complexity:** Low — add one `<a>` tag to root layout, add `.sr-only` + focus-visible styles.
- **Priority:** P0

### 4.2 Add search placeholder text
- **Rationale:** Current search input has no placeholder. Users don't know what they can search for.
- **User impact:** Clearer search affordance, reduced uncertainty.
- **Engineering complexity:** Trivial — add `placeholder="What are you struggling with today?"` to input.
- **Priority:** P0

### 4.3 Add global error boundary
- **Rationale:** Root layout has no error boundary. Unhandled errors show raw Next.js page.
- **User impact:** Graceful error recovery instead of white screen.
- **Engineering complexity:** Low — add `app/error.tsx` with recovery UI matching brand voice.
- **Priority:** P0

### 4.4 Add JSON-LD structured data
- **Rationale:** No Organization, FAQ, or Breadcrumb schema. Rich results opportunity lost.
- **User impact:** Better Google search appearance, rich snippets.
- **Engineering complexity:** Low — add `<script type="application/ld+json">` to layout and key pages.
- **Priority:** P1

### 4.5 Collapse home page rails
- **Rationale:** 9 product rails is excessive. Users experience scroll fatigue and lose sight of what matters.
- **User impact:** Clearer hierarchy, faster path to relevant products.
- **Engineering complexity:** Low — reduce to 4-5 rails: Editors' edit, Face care, Nigeria-ready, Hair care, Body care. Move K-beauty and Supportive care into category filters.
- **Priority:** P1

### 4.6 Add visible focus indicators globally
- **Rationale:** Only some interactive elements have `:focus-visible` styles. Inconsistent focus indicators violate WCAG 2.4.7.
- **User impact:** Keyboard users can always see where they are.
- **Engineering complexity:** Low — add global `*:focus-visible` outline rule using `--focus-ring` token.
- **Priority:** P0

---

## 5. Medium-term Improvements

*Weeks, not hours.*

### 5.1 Service worker + offline support
- **Rationale:** PWA manifest exists but no service worker. No offline support, no cached pages.
- **User impact:** App works offline, loads instantly from cache, feels like a native app.
- **Engineering complexity:** Medium — add `next-pwa` or custom service worker, define cache strategy (stale-while-revalidate for pages, cache-first for images), add offline fallback page.
- **Priority:** P0

### 5.2 Install prompt with custom UI
- **Rationale:** No `beforeinstallprompt` handler. Users never prompted to install.
- **User impact:** Clear, branded install prompt that explains the value of installing.
- **Engineering complexity:** Low-Medium — listen for `beforeinstallprompt`, show custom bottom sheet with JeloCare branding, store dismissed state.
- **Priority:** P1

### 5.3 Trust bridge for retailer handoff
- **Rationale:** Current redirect is a 307 with no intermediate page. User leaves JeloCare with no confirmation, no context, no trust signal.
- **User impact:** User feels JeloCare's presence even when leaving. Trust remains with JeloCare.
- **Engineering complexity:** Medium — replace direct 307 with a brief interstitial showing: retailer name, "JeloCare verified" badge, price confidence, last checked timestamp, "Continue to store" button. Auto-redirect after 2s with countdown.
- **Priority:** P0

### 5.4 Shared UI primitives
- **Rationale:** No Button, Modal, Toast, Chip, or Form components. Each page implements its own variants.
- **User impact:** Consistent interactions across the app, faster feature development.
- **Engineering complexity:** Medium — extract patterns into `components/ui/` with variants (primary, ghost, danger), sizes (sm, md, lg), and states (idle, loading, disabled).
- **Priority:** P1

### 5.5 View Transitions API for page transitions
- **Rationale:** Route changes are instant cuts. No context preservation, no shared element transitions.
- **User impact:** Smooth visual continuity between pages, especially product card → product detail.
- **Engineering complexity:** Medium — use `document.startViewTransition()` in Next.js, add `view-transition-name` CSS to shared elements.
- **Priority:** P2

### 5.6 Conversational search
- **Rationale:** Current search is keyword-based with no placeholder. User doesn't know what they can search for.
- **User impact:** Users can describe their concern in natural language ("tiny bumps on forehead") and get relevant results.
- **Engineering complexity:** Medium-High — extend search to match concern keywords, symptoms, skin goals. Add placeholder "What are you struggling with today?" Show mixed results (products + concerns + ingredients).
- **Priority:** P1

### 5.7 Bottom navigation for mobile
- **Rationale:** No bottom dock for public mobile experience. The ops console has an adaptive workspace dock — the public site doesn't.
- **User impact:** Thumb-friendly navigation, faster access to key sections, native app feel.
- **Engineering complexity:** Medium — build bottom dock with 4-5 items (Home, Products, Concerns, Consult, Me), safe-area-aware, scroll-aware hide/show.
- **Priority:** P1

### 5.8 Ambient atmosphere (grain + bloom)
- **Rationale:** No grain, noise, or texture effects. Atmosphere relies only on gradients and blur. Some contexts feel flat.
- **User impact:** Subtle depth and material quality — "premium without luxury."
- **Engineering complexity:** Low-Medium — add SVG noise filter as CSS background, add soft bloom on hero images, add microscopic grain to card surfaces.
- **Priority:** P2

---

## 6. Long-term Vision

*Months, not weeks.*

### 6.1 Personalised home experience
- Continue routine card
- Products running low
- Today's insight (one educational recommendation)
- One recommended action
- No dashboard clutter — calm, curated, personal

### 6.2 Haptic specification
- Save: light impact
- Bookmark: medium impact
- Routine completion: success pattern (light-medium-light)
- Warning: heavy impact
- Navigation: selection feedback (light)
- Sheet transitions: medium impact on open/close

### 6.3 Sound language
- Shutter sound (already implemented for screenshot)
- Success: soft chime
- Warning: gentle alert
- Navigation tick: barely audible
- Never distracting, always optional, clinical and warm

### 6.4 Conversational consult evolution
- Voice input
- Multi-turn dialogue
- Visual progress indicator
- Routine building from consult results
- Follow-up reminders via push notifications

### 6.5 Trust layer expansion
- Authenticity verification badges on retailer pages
- Price confidence scores (based on historical stability)
- Delivery confidence (based on retailer track record)
- Availability confidence (based on stock history)
- "JeloCare verified" trust seal on retailer handoff

---

## 7. Public Experience Audit (Screen-by-Screen)

### 7.1 Home Page (`/`)
**Current state:** Hero with editorial image → 5 concern cards → brand story → discovery intro with market signals → market trends teaser → 9 product rails → SPF evidence banner → consult CTA.

**Strengths:**
- Clear narrative arc: brand → problems → education → discovery → conversion
- Dynamic content adapts to catalogue
- Market trends teaser is minimal and effective
- Editorial photography creates warmth

**Weaknesses:**
- 9 product rails is excessive — scroll fatigue, unclear hierarchy
- No personalisation (same for all visitors)
- No "continue where you left off" for returning users
- Concern cards are static (hardcoded array of 5)

**Recommendations:**
1. Reduce to 4-5 rails (P1, low effort)
2. Add personalised "Continue your routine" card for logged-in users (P2, medium effort)
3. Make concern cards dynamic from knowledge data (P2, low effort)
4. Add "Today's insight" — one educational card that rotates daily (P2, low effort)

### 7.2 Products Listing (`/products`)
**Current state:** Editorial hero with search → browse rail (category/routine/concern) → fresh prices rail → catalogue stories → filter sheet → infinite scroll results.

**Strengths:**
- Three browsing modes accommodate different mental models
- Concern-first approach guides before selling
- Transparent about data sources (reviewed vs. community)
- Infinite scroll with ARIA live announcements

**Weaknesses:**
- Search input has no placeholder
- Filter sheet has nested navigation that could overwhelm
- No search history or recent searches
- No result count displayed

**Recommendations:**
1. Add placeholder: "What are you struggling with today?" (P0, trivial)
2. Show result count above grid (P1, low effort)
3. Simplify filter sheet — flatten nested views (P2, medium effort)
4. Add recent searches dropdown (P2, medium effort)

### 7.3 Product Detail (`/products/[slug]`)
**Current state:** Two-column hero (image + story) → ProductQuickPanel with 3 tabs (Prices, Search, Details) → related products.

**Strengths:**
- Care status badge prominently displayed
- Trust signals throughout (trust scores, brand authorization, seller warnings)
- Tabbed interface separates buying from learning
- Routine steps with numbered sequence
- Key ingredients with source links

**Weaknesses:**
- Clinical evidence is hidden in the Details tab — should be more visible
- Retailer list with multiple filters could overwhelm
- No "why this product" narrative on the page itself
- Related products only 3 — could be smarter

**Recommendations:**
1. Surface care status and key ingredients above the fold, not in a tab (P1, medium effort)
2. Add "Why JeloCare recommends this" section with evidence summary (P2, medium effort)
3. Simplify retailer filters — default to "Best match" and hide advanced filters (P2, low effort)
4. Add "Pairs well with" section based on routine fit (P3, medium effort)

### 7.4 Concern Pages (`/concerns`, `/concerns/[slug]`)
**Current state:** Listing with concern selector (horizontal rail, real-time product matching) → detail page with urgent action, signs, options, sources, products, consult CTA.

**Strengths:**
- "Start with what you notice" framing is empathetic
- Urgent action sections for serious conditions
- "Pause here" escalation guidance
- Source links with review dates
- "Guidance, not a diagnosis" disclaimer

**Weaknesses:**
- No visual differentiation between concern types (skin vs. hair vs. scalp)
- Products section can be empty with generic CTA
- No "how common is this" context
- No timeline (how long until improvement?)

**Recommendations:**
1. Add concern category color coding (P2, low effort)
2. Add "Typical timeline" section with expected improvement duration (P2, medium effort)
3. Add "How common" context to normalize concerns (P3, low effort)
4. Pre-fill consult with concern context (already done — verify it works)

### 7.5 Ingredient Pages (`/ingredients`, `/ingredients/[slug]`)
**Current state:** Library page with explorer (search, view filters, card grid) → detail dialog with evidence, sensitive skin status, found-in products.

**Strengths:**
- Evidence grades (High/Moderate/Early/Insufficient) are clear and clinical
- Sensitive skin warnings (Generally gentle/Go slowly/Avoid/Unknown)
- Source links for all product-ingredient relationships
- "Evidence describes the ingredient, not the whole formula" — important caveat

**Weaknesses:**
- No "who should use this" section
- No "who should avoid this" section (only sensitive skin status)
- No interaction warnings between ingredients
- No routine fit guidance ("use in the morning", "use with sunscreen")
- No common misconceptions section

**Recommendations:**
1. Add "Who should use" and "Who should avoid" sections (P1, medium effort)
2. Add "Common misconceptions" callout (P2, low effort)
3. Add "Pairs well with" and "Don't mix with" sections (P2, medium effort)
4. Add "When to use" routine timing guidance (P2, low effort)

### 7.6 Consult Page (`/consult`)
**Current state:** Open-ended prompt with example queries → optional safety profile dialog → AI-generated report with routine, products, cautions, sources.

**Strengths:**
- Open-ended prompt reduces choice paralysis
- Safety interrupts for serious concerns
- Structured report with routine steps, timing, cautions
- Source links to published guidance
- Follow-up tracking

**Weaknesses:**
- Profile dialog is optional but important for safety — could be more prominent
- No voice input
- No multi-turn dialogue (single query → single report)
- No visual progress indicator during AI processing
- No "save this routine" action from report

**Recommendations:**
1. Make safety profile more prominent — not hidden behind a button (P1, low effort)
2. Add loading state with calm animation during AI processing (P1, low effort)
3. Add "Save routine" action from consult report (P2, medium effort)
4. Add voice input option (P3, medium effort)

### 7.7 Share Pages (`/share`, `/share/[slug]`)
**Current state:** Index with price drops, price increases, out of stock, price gaps, guides → product share card with trend chart, screenshot button, alternatives.

**Strengths:**
- Curated "worth sharing" lists
- Trend chart with curved lines, gradient fill, interactive hover
- Screenshot button with shutter sound
- Two-column layout on wide screens
- "A listing is not proof it is genuine" disclaimer

**Weaknesses:**
- Screenshot DOM capture may still fail on some browsers
- No share-to-social native sheet integration
- Alternatives limited to 3 — could be smarter
- No "why this price" context

**Recommendations:**
1. Add Web Share API integration for native share sheet (P1, low effort)
2. Add "Last checked" timestamp on share cards (P1, low effort)
3. Make alternatives smarter — match by concern + routine step (P2, medium effort)

### 7.8 Me Portal (`/me`)
**Current state:** Home with routine preview, shelf, concern products, price evidence, attention items, market trends → routine view, shelf view, explore, product requests.

**Strengths:**
- Personalized greeting
- Routine preview with next steps
- Shelf with recently saved products
- Concern-matched products
- Price evidence and alerts
- Workspace dock with FABs

**Weaknesses:**
- No bookmarks/collections
- No comparison feature
- No notification center
- No settings/preferences page
- No help/support section
- No "products running low" reminder

**Recommendations:**
1. Add "Products running low" card on home (P1, medium effort)
2. Add notification center (P2, medium effort)
3. Add settings page with preferences (P2, low effort)
4. Add product comparison feature (P3, high effort)

---

## 8. Design Language Audit

### Typography
- **Display:** Italiana (serif, weight 400) — editorial, warm, distinctive
- **Sans:** Manrope (all weights) — clean, readable, modern
- **Scale:** Fluid clamp() for headings, fixed rem for body — good approach
- **Gap:** No monospace font loaded (uses system mono) — acceptable but inconsistent

### Color
- **Light:** Cream/wine/peach/rose — warm, clinical, distinctive
- **Dark:** Black/pink/rose — maintains warmth, good contrast
- **State:** Success (green), warning (amber), danger (red) — standard but warm-toned
- **Gap:** No semantic "info" color distinct from wine accent

### Spacing
- **Scale:** 8pt base (4/8/12/16/20/24/32/48/72) — excellent
- **Usage:** Inconsistent — some pages use vw units, some use rem, some use the token scale
- **Gap:** No layout-level spacing tokens (section padding, card gap, etc.)

### Radii
- **Scale:** Concentric (9px → 16px → 1.35rem → 1.9rem → 999px) — excellent
- **Usage:** Consistent within components, but some hardcode 1.75rem instead of using tokens

### Shadows
- **Light:** Warm-toned (rgba(112,71,61,...)) — excellent
- **Dark:** Black with colored glow — excellent
- **Elevation:** 4-level scale — well-defined but only used in ops

### Recommendations
1. Add `--space-section` token for consistent section padding (P2)
2. Add `--radius-card-lg` token for 1.75rem cards (P2)
3. Document token usage patterns in a design system page (P3)

---

## 9. Motion Audit

### Current state
- Pure CSS animations (no framer-motion)
- Shimmer skeletons for loading
- Slide-up for panels
- Float for hero image (7s, respects reduced-motion)
- Hover transforms on cards (translateY -3px)
- Smooth scroll behavior
- 3 motion tokens (duration-fast/base/sheet, 3 easing curves)

### Gaps
- No page transitions (instant route changes)
- No shared element transitions
- No micro-interactions on buttons (press feedback, success state)
- No gesture-based animations (swipe to dismiss, pull to refresh)
- No spring physics

### Recommendations
1. Add View Transitions API for page transitions (P2, medium effort)
2. Add button press micro-interaction (scale 0.97 on active) (P1, trivial)
3. Add swipe-to-dismiss for bottom sheets (P2, medium effort)
4. Add success animation for save/bookmark actions (P2, low effort)
5. Keep respecting `prefers-reduced-motion` — already done in 2 places, make it global

---

## 10. Interaction Audit

### Current patterns
- Tab navigation in product panel (Prices/Search/Details)
- Filter sheet with nested views
- Search autocomplete with keyboard navigation
- Concern selector with real-time matching
- Consult with open-ended input
- Screenshot capture with shutter sound
- Chart hover with readout

### Gaps
- No undo for destructive actions
- No confirmation for retailer redirect
- No pull-to-refresh on mobile
- No haptic feedback (PWA)
- No long-press interactions
- No drag-to-reorder (routines)

### Recommendations
1. Add confirmation interstitial for retailer redirect (P0, medium effort)
2. Add undo for shelf removal (P2, low effort)
3. Add haptic feedback for save/bookmark (P3, low effort — Vibration API)
4. Add pull-to-refresh on product listing (P3, medium effort)

---

## 11. Accessibility Audit

### WCAG compliance status

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.1.1 Non-text Content | Pass | All images have alt text; decorative icons aria-hidden |
| 1.3.1 Info and Relationships | Partial | Some heading levels skipped; landmarks inconsistent |
| 1.4.3 Contrast (Minimum) | Needs audit | No automated contrast checking |
| 1.4.10 Reflow | Pass | Responsive at 320px width |
| 1.4.11 Non-text Contrast | Needs audit | Focus indicators not consistent |
| 2.1.1 Keyboard | Partial | Most flows keyboard-accessible; no skip link |
| 2.1.2 No Keyboard Trap | Pass | Focus trapping in modals with escape |
| 2.4.1 Bypass Blocks | Fail | No skip link |
| 2.4.7 Focus Visible | Partial | Only some elements have focus-visible styles |
| 2.3.3 Animation from Interactions | Pass | Reduced-motion respected in 2 components |
| 3.3.1 Error Identification | Partial | Some forms lack error summaries |
| 4.1.2 Name, Role, Value | Pass | 100+ aria-labels, proper roles |
| 4.1.3 Status Messages | Pass | 18 aria-live regions |

### Recommendations
1. Add skip link to root layout (P0)
2. Add global `*:focus-visible` outline (P0)
3. Audit heading hierarchy across all pages (P1)
4. Add `main`, `nav`, `aside` landmarks consistently (P1)
5. Run automated contrast audit (P1)
6. Add form error summaries (P1)
7. Make reduced-motion global, not per-component (P1)

---

## 12. PWA Audit

| Feature | Status | Notes |
|---------|--------|-------|
| Manifest | Pass | Complete with icons, maskable, theme color |
| Service Worker | Fail | Not configured |
| Offline Support | Fail | No cached pages |
| Install Prompt | Fail | No beforeinstallprompt handler |
| Offline Fallback | Fail | No offline page |
| Cache Strategy | Fail | Not implemented |
| Push Notifications | Fail | Not configured |
| Background Sync | Fail | Not configured |
| App Icons | Pass | 192, 512, maskable-512 |
| Theme Color | Pass | Light/dark variants |
| Apple Web App | Pass | Capable, status bar, title |
| Display Mode | Pass | Standalone |
| Start URL | Pass | "/" |
| Safe Area Insets | Pass | Used in mobile bottom actions |

### Recommendations
1. Add service worker with stale-while-revalidate for pages, cache-first for images (P0)
2. Add offline fallback page with brand voice (P0)
3. Add custom install prompt bottom sheet (P1)
4. Add push notification support for price alerts and consult follow-ups (P2)
5. Add background sync for shelf/routine changes (P3)

---

## 13. Trust Experience Audit

### Current trust signals
- Care review badges (Supportive use / Pharmacist review / Formula review pending)
- Trust scores per retailer (0-100)
- "Listed by the brand" indicator
- "Check seller" warning when seller identity missing
- "Check with store" for provisional listings
- Price observation dates and freshness
- Source links on ingredients
- "Guidance, not a diagnosis" disclaimers
- "A listing is not proof it is genuine" on share cards
- Evidence grades on ingredients

### The trust gap
The customer insight — *"I wanted JeloCare itself to process the order"* — reveals that trust peaks before the retailer handoff and drops after. The 307 redirect is a trust cliff.

### Recommendations
1. **Trust bridge interstitial** (P0): Replace direct 307 with a 2-second interstitial showing:
   - JeloCare logo + "Verified by JeloCare"
   - Retailer name and trust score
   - Price confidence (stable/falling/rising)
   - Last checked timestamp
   - "Continue to {retailer}" button
   - Auto-redirect with countdown

2. **Trust seal on product pages** (P1): Add "JeloCare verified" badge near retailer links

3. **Price confidence score** (P2): Based on historical price stability — "Price stable for 30 days"

4. **Delivery confidence** (P2): Based on retailer track record — "Typically delivers in 2-3 days"

5. **Availability confidence** (P2): Based on stock history — "In stock 90% of the time"

---

## 14. Retail Journey Audit

### Current flow
1. User views product page
2. Clicks "Open store" on retailer offer
3. Link goes to `/go?product={slug}&retailer={name}`
4. Server finds product and offer
5. Analytics recorded asynchronously
6. 307 redirect to retailer URL with attribution

### Problems
- No confirmation or context before leaving
- No "you are leaving JeloCare" message
- No way back (browser back works but no visual cue)
- No price guarantee or confidence signal
- No "what to expect" on the retailer site

### Ideal flow
1. User views product page
2. Clicks "Open store" on retailer offer
3. Trust bridge interstitial appears (2s):
   - "JeloCare verified"
   - Retailer name + trust score
   - Price + trend
   - Last checked
   - "Continue to {retailer}" (auto-countdown)
4. User lands on retailer site with attribution
5. Analytics recorded

### Recommendations
1. Replace 307 with trust bridge interstitial (P0)
2. Add "Return to JeloCare" link in attribution parameters where possible (P2)
3. Add post-purchase follow-up (email/SMS) for trust reinforcement (P3)

---

## 15. Search Audit

### Current state
- Keyword-based search with fuzzy matching
- Searchable: product names, brands, sizes, company names, categories, guide names
- Autocomplete with local + remote suggestions (140ms debounce)
- Keyboard navigation (arrows, enter, escape, tab)
- Market toggle (NG/US)
- No placeholder text
- No search history
- No voice search
- No result highlighting

### Recommendations
1. **Add placeholder**: "What are you struggling with today?" (P0)
2. **Conversational search**: Match concern keywords, symptoms, skin goals (P1)
3. **Mixed results**: Show products + concerns + ingredients in one result set (P1)
4. **Recent searches**: Store last 5 searches in localStorage (P2)
5. **Result highlighting**: Bold matched terms in results (P2)
6. **Voice search**: Add microphone icon for Web Speech API (P3)

---

## 16. Performance Audit

### Current metrics
- Home page: 744KB HTML, 0.28s response time
- Products page: 0.49s response time
- Concerns page: 0.49s response time
- Consult page: 0.29s response time

### Patterns
- `next/font/google` for Italiana + Manrope (self-hosted, CSS variables)
- `next/image` for editorial images, native `<img>` for product images (with lazy loading)
- `revalidate = 3600` on product and concern pages
- No service worker (no caching)
- No bundle size analysis
- No critical CSS inlining
- No resource hints for external domains

### Recommendations
1. Add service worker for offline caching (P0)
2. Add `preload` hints for critical fonts and hero images (P1)
3. Add `dns-prefetch` for external image domains (P1)
4. Run Lighthouse audit and address findings (P1)
5. Add bundle size monitoring (P2)
6. Convert product images to `next/image` where possible (P2)
7. Add WebP/AVIF format negotiation (P2)

---

## 17. Information Architecture Review

### Current structure
```
/ (Home)
├── /products (Catalogue)
│   ├── /products/[slug] (Product detail)
├── /concerns (Concern guides)
│   ├── /concerns/[slug] (Concern detail)
├── /ingredients (Ingredient library)
├── /share (Worth sharing)
│   ├── /share/[slug] (Product share card)
│   ├── /share/ingredient/[slug] (Ingredient share)
├── /consult (Ask JeloCare)
├── /contribute (Community contribution)
├── /retailers (Retailer partnerships)
├── /me (Customer portal)
│   ├── /me/routine
│   ├── /me/shelf
│   ├── /me/explore
├── /ops (Admin console)
```

### Observations
- Clear separation between public and private areas
- `/share` is a unique concept — smart for viral discovery
- `/contribute` is community-driven — good for catalogue growth
- `/me` is the personal workspace — well-separated from public
- `/ops` is admin-only — properly guarded

### Recommendations
1. Add `/search` as a dedicated route for deep search (P2)
2. Add `/routines` as a public route for routine templates (P3)
3. Consider `/guides` as a unified entry for concerns + ingredients (P3)

---

## 18. Component Improvements

### Components to create

| Component | Rationale | Priority |
|-----------|-----------|----------|
| `Button` | 5+ inline button variants across pages | P1 |
| `Modal` | Uses native `<dialog>` with custom hook — extract to shared component | P1 |
| `Toast` | No notification system — needed for save confirmations | P1 |
| `Chip` | Inline chips everywhere — extract to shared component | P2 |
| `BottomSheet` | Mobile bottom sheet pattern used in multiple places | P2 |
| `FormField` | Forms inline with inconsistent validation patterns | P2 |
| `Skeleton` | Shimmer pattern duplicated across 6+ files | P2 |
| `Tooltip` | No tooltip component — needed for trust scores, evidence grades | P3 |
| `ProgressBar` | No progress indicator — needed for consult, search loading | P3 |
| `EmptyState` | Only exists for ops — needed for public pages | P2 |

### Components to improve

| Component | Issue | Priority |
|-----------|-------|----------|
| `CatalogueSearch` | No placeholder, no recent searches | P0 |
| `ProductQuickPanel` | Clinical evidence hidden in tab | P1 |
| `RetailerList` | Too many filters visible by default | P2 |
| `IngredientExplorer` | No "who should use/avoid" sections | P1 |
| `SiteHeader` | No bottom dock for mobile | P1 |
| `ShareCard` | No "last checked" timestamp | P1 |

---

## 19. Design Token Recommendations

### Tokens to add

```css
/* Layout spacing */
--space-section: clamp(3rem, 8vw, 7rem);
--space-section-tight: clamp(2rem, 5vw, 4rem);
--space-card-gap: 1.2rem;
--space-rail-gap: 1.2rem;

/* Card radius */
--radius-card-lg: 1.75rem;
--radius-card-xl: 2.5rem;

/* Focus ring */
--focus-ring-width: 2px;
--focus-ring-offset: 2px;

/* Atmosphere */
--grain-opacity: 0.03;
--bloom-blur: 60px;
--bloom-spread: 120px;

/* Motion — page transitions */
--duration-transition: 0.25s;
--ease-transition: cubic-bezier(0.2, 0.8, 0.2, 1);

/* Trust */
--trust-verified: var(--state-success);
--trust-warning: var(--state-warning);
--trust-bg: color-mix(in srgb, var(--state-success) 8%, transparent);
```

### Tokens to document
- All 80+ existing tokens need usage documentation
- Create a design system reference page (internal)

---

## 20. Prioritised Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
| Item | Effort | Impact |
|------|--------|--------|
| Skip link | Trivial | High (a11y) |
| Search placeholder | Trivial | High (UX) |
| Global error boundary | Low | High (reliability) |
| Global focus indicators | Low | High (a11y) |
| Collapse home rails to 5 | Low | Medium (UX) |
| JSON-LD structured data | Low | Medium (SEO) |

### Phase 2: Trust & PWA (Week 3-4)
| Item | Effort | Impact |
|------|--------|--------|
| Service worker + offline | Medium | Critical (PWA) |
| Trust bridge interstitial | Medium | Critical (trust) |
| Install prompt | Low-Medium | High (PWA) |
| Bottom navigation (mobile) | Medium | High (mobile UX) |
| Reduced-motion global | Low | High (a11y) |
| Heading hierarchy audit | Low | Medium (a11y) |

### Phase 3: Refinement (Week 5-8)
| Item | Effort | Impact |
|------|--------|--------|
| Shared UI primitives | Medium | High (consistency) |
| Conversational search | Medium-High | High (UX) |
| Ingredient "who should use/avoid" | Medium | High (clinical) |
| Surface clinical evidence on product page | Medium | High (trust) |
| View Transitions API | Medium | Medium (polish) |
| Ambient atmosphere (grain + bloom) | Low-Medium | Medium (design) |
| Web Share API integration | Low | Medium (sharing) |

### Phase 4: Evolution (Month 3+)
| Item | Effort | Impact |
|------|--------|--------|
| Personalised home | Medium-High | High (retention) |
| Haptic specification | Low | Medium (PWA) |
| Sound language | Low | Low (ambience) |
| Push notifications | High | High (retention) |
| Voice search | Medium | Medium (accessibility) |
| Product comparison | High | Medium (UX) |
| Routine templates | Medium | Medium (content) |

---

## Emotional Audit Summary

| Screen | Reduces anxiety? | Builds trust? | Simplifies decision? | Feels curated? | Clinical without cold? | Would trust medical advice here? | Prefer staying in JeloCare? |
|--------|-----------------|---------------|---------------------|----------------|----------------------|--------------------------------|----------------------------|
| Home | Yes | Yes | Partial (too many rails) | Yes | Yes | Yes | Partial |
| Products | Yes | Yes | Yes (browse modes) | Yes | Yes | Yes | Yes |
| Product detail | Yes | Yes | Partial (filter overload) | Yes | Yes | Yes | Partial (retailer cliff) |
| Concerns | Yes | Yes | Yes (selector) | Yes | Yes | Yes | Yes |
| Ingredients | Partial | Yes | Yes (view filters) | Yes | Yes | Yes | Yes |
| Consult | Yes | Yes | Yes (open-ended) | Yes | Yes | Yes | Yes |
| Share | Yes | Yes | Yes (curated lists) | Yes | Partial | Partial | Yes |
| Me portal | Partial | Yes | Partial | Yes | Yes | Yes | Yes |

**Key insight:** The retailer handoff is the only place where trust drops. Fix the trust bridge and every "Prefer staying in JeloCare" becomes "Yes."

---

*This audit was produced by examining the actual codebase — every file, every component, every token. It is based on evidence, not assumptions.*
