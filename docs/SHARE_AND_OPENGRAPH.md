# Share and OpenGraph

Updated: 2026-07-24

Shareable cards let a reader pass on a specific piece of JeloCare — a product's observed prices, or a source-checked ingredient — as a link with a rich preview. Every card is evidence-scoped: it exists only when the underlying evidence supports it, and it never invents a number or a claim.

## Surfaces

| Route | Shows | Data |
| --- | --- | --- |
| `/share` | "Worth sharing" index: price gaps, recent drops, guide topics | `lib/share/worth-sharing.ts` + `modules/commerce/share-insights.ts` |
| `/share/[slug]` | A product's observed Nigerian prices (lowest, spread, offers) | `app/share/[slug]/share-data.ts` (`buildShareData`) |
| `/share/ingredient/[slug]` | A source-checked ingredient card | `data/product-ingredients.ts` (`ingredientSeedBySlug`) |

Products, prices, and ingredients ship; **routines** are the remaining imagined card.

## The shareable gate

A product can make a price card only when it has an offer that `summarizeMarket` would count as *priced*: exact (not a search result), NG, in stock, evidence-bound, fresh, and comparison-eligible (not `priceComparison: 'exclude'`). This single predicate — `isShareableNgOffer` / `hasShareableNgOffer` in `modules/commerce/shareable-offer.ts`, gating on `comparableMarketPrice` — is shared by `buildShareData`, the share index, the product panel's Share affordance, and the OG `generateStaticParams`. Because it is one gate, a share card's lowest and spread always agree with the product page, and a marketplace price the catalogue excluded never surfaces as the "lowest".

## OpenGraph images

Each shareable surface renders its own `opengraph-image.tsx` (products, concerns, ingredients, and the share price card). Shared building blocks live in `lib/og/assets.ts`: the 1200×630 size, self-hosted font loading, naira spelling (the Latin subset has no ₦ glyph), and `loadImage`.

Three properties make previews reliable:

- **Pre-rendered at build.** Each route's `generateStaticParams` pre-renders every image, so a social crawler (WhatsApp, X, iMessage) hits a static, CDN-cached PNG instead of a cold on-demand render. Dynamic on-demand generation was roughly 20 s cold and uncached — past crawler timeouts — so links showed no preview.
- **PNG-normalised.** Satori (next/og) decodes only PNG/JPEG, but many packshots are webp/avif, so `loadImage` converts every image to PNG with `sharp` (and downscales it, shrinking the inlined data URL). Conversion runs at build time where sharp is available; the served PNG needs no sharp at runtime.
- **Resilient.** `loadImage` fetches with a timeout and inlines a data URL; a slow or failing image degrades to a card without the shot rather than hanging the render or breaking the build.

## Constraints

- Never invent a number or a claim. Price cards carry "Prices change. A listing is not proof it is genuine."; ingredient and concern cards carry "education, not a diagnosis".
- The `/share` index ranks by evidence-bound facts (spread size, verified movement, store count, freshness), never popularity or clicks.
- Concern (health-shaped) topics stay a separate lane from the commercial cards.
