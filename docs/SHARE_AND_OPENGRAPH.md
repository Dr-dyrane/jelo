# Share and OpenGraph

Updated: 2026-08-04

Shareable cards let a reader pass on a specific piece of JeloCare — a product's observed prices, or a source-checked ingredient — as a link with a rich preview. Every card is evidence-scoped: it exists only when the underlying evidence supports it, and it never invents a number or a claim.

## Surfaces

| Route                      | Shows                                                         | Data                                                                |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/share`                   | "Worth sharing" index: price gaps, recent drops, guide topics | `lib/share/worth-sharing.ts` + `modules/commerce/share-insights.ts` |
| `/share/[slug]`            | A product's observed Nigerian prices (lowest, spread, offers) | `app/share/[slug]/share-data.ts` (`buildShareData`)                 |
| `/share/ingredient/[slug]` | A source-checked ingredient card                              | `data/product-ingredients.ts` (`ingredientSeedBySlug`)              |
| `/share/concern/[slug]`    | A downloadable, source-reviewed concern guide story           | `data/knowledge.ts` + reviewed concern-product links                |

Products, prices, and ingredients ship; **routines** are the remaining imagined card.

## The shareable gate

A product can make a price card only when it has an offer that `summarizeMarket` would count as _priced_: exact (not a search result), NG, in stock, evidence-bound, fresh, and comparison-eligible (not `priceComparison: 'exclude'`). This single predicate — `isShareableNgOffer` / `hasShareableNgOffer` in `modules/commerce/shareable-offer.ts`, gating on `comparableMarketPrice` — is shared by `buildShareData`, the share index, the product panel's Share affordance, and the OG `generateStaticParams`. Because it is one gate, a share card's lowest and spread always agree with the product page, and a marketplace price the catalogue excluded never surfaces as the "lowest".

Price movement has a second, stricter binding. Every trend snapshot carries the rendered market, retailer, URL, price, currency, observation time, observed variant, and observed size. History is admitted only when the current database offer and the latest history endpoint match that complete snapshot. A static/Neon mismatch, partial refresh, sibling SKU, duplicate store series, or changed listing therefore hides the arrow instead of pairing movement with the wrong displayed price.

## OpenGraph images

Every public route family uses the shared contextual renderer at `/og`. Route metadata is built by `lib/og/social-card.tsx`, so the canonical URL, Open Graph fields, Twitter large-card fields, meaningful image alt text, and 1200×630 PNG URL come from one model. The root layout intentionally has no fallback social image: a new public page must join the route coverage matrix and choose its own truthful context.

Product and share routes build the card from the same published product object as the page. Brand, concise product name, size, category, and repository-bound packshot therefore stay on the exact SKU. The social card never carries price, availability, popularity, diagnosis, or retailer claims. If the existing published packshot is absent or cannot be decoded, the renderer keeps the product identity and shows a branded text fallback instead of substituting another image.

Three properties make previews reliable:

- **Content-versioned.** Metadata URLs carry a deterministic hash of the card copy, route context, theme, and product image binding. Matching versions receive an immutable one-year cache header; unversioned or stale requests receive a short CDN cache. A route or SKU content change therefore creates a new image URL without coupling the card to price freshness.
- **PNG-normalised.** Satori (next/og) decodes only PNG/JPEG, but many packshots are webp/avif, so `loadImage` converts each fetched packshot to a downscaled PNG data URL before rendering. The content-versioned response is then cached at the CDN.
- **Resilient.** `loadImage` fetches with a timeout and inlines a data URL; a slow or failing image degrades to a card without the shot rather than hanging the render or breaking the build.

Private `/me` and `/ops` layouts are explicit noindex/no-store boundaries and set Open Graph and Twitter metadata to `null`. `/sign-in` and the internal `/image-audit` route are also noindex and carry no social metadata. Route inventory tests fail when a public page is not represented or when a covered page does not call the contextual metadata builder.

## Constraints

- Never invent a number or a claim. Price cards carry "Prices change. A listing is not proof it is genuine."; ingredient and concern cards carry "education, not a diagnosis".
- The `/share` index ranks by evidence-bound facts, never popularity or clicks. Recent drops lead the queue and rank by percentage movement, then distinct-retailer evidence, freshness and naira impact. A 30-day window is preferred only when it passes the public evidence threshold; otherwise a valid seven-day window may lead. The visible signal stays compact (`↓ 8% · 30d`); unsupported or flat movement stays quiet.
- Concern (health-shaped) topics stay a separate lane from the commercial cards.
- Concern story summaries and reviewed signal/guidance cues render at story-safe
  type sizes in one naturally flowing stack. The renderer wraps complete cue
  text instead of truncating it or placing fixed rows on top of each other.
