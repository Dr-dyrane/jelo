# JeloCare interface contract

Updated: 2026-07-22

This is a build rule, not a mood board. New UI should satisfy it before review.

## Calm, clear, human

- Use peach, blush, pink, and cream for page surfaces. Brown is an accent, never the dominant page field.
- Keep copy short and plain. One thought per line. Remove technical or promotional prose when the interface can explain itself.
- Use regular display and body weights. Semibold is for compact controls and status only; bold is exceptional.
- Use people photography throughout the story, not only in a hero. Show varied skin tones, ages, hair textures, and care contexts.
- Keep text beside photography or on a reliably opaque surface. Never assume a photo will preserve contrast.

## Every action answers

Every click that changes state must make the change understandable.

- Show the applied state immediately or take the person to the changed result.
- Name what changed and show the new result count when relevant.
- Keep URL state for searchable and shareable catalogue views.
- Provide Undo for the last reversible change and Clear for a filter group.
- Preserve keyboard focus and announce concise state changes through a dedicated polite status region.
- Use subtle motion as orientation, never as the only feedback. Respect reduced-motion settings.
- Do not turn an entire result grid into a live region.
- If a surface looks tappable, it must be a real button or link. Otherwise make it visually quieter.
- When a summary card sits directly above its primary task, activate it by moving and focusing the user on that task. Use focused detail only when the card reveals genuinely useful secondary information.

## Progressive disclosure

- Keep the primary task visible. Put secondary detail in a focused modal, side sheet on desktop, or bottom sheet on mobile.
- Do not stack expandable panels inside expandable panels.
- Do not make people scroll past long explanations to reach price, provider, use, or safety information.
- Keep a visible trigger near the decision point and return focus to it when a sheet closes.
- A sheet must have a clear title, close control, primary action, and safe dismissal behavior.

## Surface hierarchy

- Avoid decorative borders. Separate areas with spacing, tone, translucency, and restrained shadow.
- Use glass only for floating controls or depth over imagery. Maintain readable contrast and provide an opaque fallback.
- Use rounded forms consistently. A pill is a control or short status, not a container for paragraphs.
- Hide rail scrollbars while retaining keyboard/touch scrolling, snap behavior, and a visible next-card cue.
- Use Lucide icons already in the system. Never use emoji as interface icons.

## Product truth

- Public product imagery uses a real, traceable packshot with the complete pack visible. It must have a genuinely transparent background, remain centred, be at least 1,000 × 1,000, and have a hash-bound peach/pink/dark surface approval; opaque studio canvases, hidden pale planes, undersized images, and placeholders stay private.
- Background removal may isolate source pixels; it must not redraw packaging, labels, claims, sizes, or ingredients.
- Poor, clipped, mismatched, or untraceable product images are quarantined, not polished into false evidence.
- Company names remain quiet text labels. Do not add decorative brand badges or mixed-quality logo marks.
- Prices appear only for a fresh, exact product offer in the selected market. Search-result prices and stale observations do not count.
- Reviewed and community-sourced records remain visually and functionally distinct.

## Information system, not a shop

- Lead with comparison, provenance, fit, and where an exact product can be found.
- Affiliate value never changes product guidance, ranking, or safety boundaries.
- Do not fabricate ratings, sale states, stock pressure, gender/sex suitability, diagnoses, or treatment claims.
- Concern matching is guidance for reviewed products, not diagnostic proof.

## Release check

Before shipping a new interaction, verify:

1. The action has visible and screen-reader feedback.
2. The change can be reversed or cleared.
3. Focus, keyboard use, mobile sheets, contrast, and reduced motion work.
4. Copy is shorter than the first draft and still clear.
5. No border, badge, weight, icon, image, price, or claim violates this contract.

## Lessons learned — UI and data-flow fixes

Updated: 2026-08-08

Each entry below documents a real bug that shipped, its root cause, and the
rule that prevents recurrence. Follow these before adding new UI or changing
data flow.

### 1. Use design tokens, not generic CSS variables

**Symptom:** Mobile search overlay looked like a blank white canvas with a
slender, unrounded input that did not match the site's warm aesthetic.

**Root cause:** The overlay CSS used generic variable names (`--surface`,
`--text`, `--accent`, `--text-muted`) with hardcoded fallbacks instead of the
project's design tokens (`--cream`, `--ink`, `--wine`, `--paper`, `--muted`,
`--surface-2`, `--border`). The fallbacks resolved to a plain white/grey
palette that ignored the warm peach/cream theme.

**Rule:** Every new CSS module must use the project's design tokens from
`app/globals.css`. Never invent local CSS variable names with hardcoded
fallbacks. The token set is: `--ink`, `--muted`, `--cream`, `--paper`,
`--surface-2`, `--surface-3`, `--card`, `--card-2`, `--card-3`, `--border`,
`--peach`, `--rose`, `--wine`, `--accent-solid`, `--on-accent`, `--band`,
`--on-band`, `--band-muted`, `--shadow`, `--shot-shadow`. These tokens
auto-flip in dark mode — generic variables do not.

### 2. A search surface is never blank

**Symptom:** Mobile search overlay showed nothing before the user typed.
Desktop search (Twitter/X-style) always shows trending topics or popular
categories.

**Root cause:** No `staticSuggestions` prop was passed to the overlay, and
the component had no built-in defaults. The `showPopular` condition required
`staticSuggestions.length > 0`, so the popular section never rendered.

**Rule:** Any search interface must show useful content before the user
types — popular categories, trending concerns, or recent searches. Never
render a blank search page. If no external suggestions are passed, fall back
to built-in defaults.

### 3. Badges must not be clipped by ancestor overflow

**Symptom:** The "verified pick" badge (a circular icon at `top: -10px;
left: -10px`) on the #1 store link was clipped on mobile.

**Root cause:** `.retailer-panel` had `overflow: hidden` at `max-width: 620px`
to prevent horizontal scroll. The badge was absolutely positioned outside the
container's content box, so `overflow: hidden` cut it off.

**Rule:** When a child element is absolutely positioned with negative offsets
(badges, pick markers, decorative elements), no ancestor may have
`overflow: hidden` or `overflow: clip`. Use `overflow-x: hidden` only if
horizontal scroll is a problem, and add padding to the container to
accommodate the negative offset. Test badges at every breakpoint.

### 4. Out-of-stock products should show last known price

**Symptom:** Products with listings but no available stock showed "Current
price unavailable" even when a price had been observed and recorded before
the stockout.

**Root cause:** `observedMarketPrice()` returns `null` when
`offer.available === false`, so the `listing-only` market reading state had
no price information. The old price was in the offer data but never surfaced.

**Rule:** The `listing-only` `MarketReading` state must include
`lastKnownPriceLabel` (e.g. "Was ₦9,850") when a price was previously
recorded. Never show "Current price unavailable" when a historical price
exists. The price label must be prefixed with "Was" to make clear it is not
current.

### 5. Price trends chart must query the database, not just static data

**Symptom:** Price trends graph on the share page showed no data even after
the inventory refresh worker had saved prices to the `offer_price_history`
table for 4+ days.

**Root cause:** `fetchRawObservations()` in `lib/share/product-trends.ts`
only read from `data/price-history.ts` (static, hardcoded anchor points). It
never queried the `offer_price_history` database table. The inventory refresh
worker was correctly inserting rows, but the chart never read them.

**Rule:** Any function that fetches historical data for charts or trends must
query the database (`offer_price_history` table). Static current-offer data is
not temporal evidence and must never be reconstructed into historical points.
If the database is unavailable or the selected window lacks two dated
observations for one exact store series, hide the percentage and line. The data
flow is: inventory refresh worker → `offer_price_history` table →
`getProductPriceHistory()` → share trend read model → event/step renderer.

### 6. Disclaimers should be compact chips, not paragraphs

**Symptom:** The handoff view had a 3-line disclosure paragraph that was
verbose and visually heavy. The retailer list and share card had similarly
long disclaimer text.

**Root cause:** Disclaimers were written as full sentences in `<p>` tags
with no visual hierarchy. The copy repeated across three surfaces with
slightly different wording.

**Rule:** Disclaimers should be compact badge chips — one icon + 2-3 words
per chip, wrapped in a flex row. Use the project's `color-mix` warm tint
background. Keep copy to the minimum: "Prices may change", "Listing ≠
genuine", "Delivery extra". Never write a multi-sentence disclaimer paragraph
when chips communicate the same information.
