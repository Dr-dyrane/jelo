# Behavioural analytics

Updated: 2026-07-24

We measure behaviour to answer one question: does JeloCare help someone choose better before buying skincare. Every event serves that. None of it profiles a person.

## What exists today

- Page traffic through Vercel Analytics, mounted in [app/layout.tsx](../app/layout.tsx).
- A single outbound choke point for store links: `/go?product=<slug>&retailer=<name>` in [app/go/route.ts](../app/go/route.ts). It resolves the exact offer and attributes the destination through [redirect-attribution.ts](../modules/commerce/redirect-attribution.ts) (`utm_content=<product>:<retailer>`). Every "Open store" already passes through here, so store-click behaviour has one place to record it.

The custom event taxonomy below is roadmap. Only page traffic and outbound attribution exist now.

## What we want to understand

Per product:

- Which store link gets clicked most.
- Whether people take the lowest price, a middle price, or a pricier or marketplace listing. This is the price-preference signal you asked for.
- The search, browse, and concern paths that lead to a product, and then to a store.
- Whether a shared link brings someone back to a product and onward to a store.

Across the app:

- Where people drop before finding an exact product.
- Which concerns and browse modes drive real decisions, not just views.
- Whether fresh exact offers change click-through.

## Event taxonomy (proposed)

A small typed set. Every click that changes state or leaves the app is one event. Names are stable; payloads carry only what a decision needs.

| Event | Payload | Answers |
| --- | --- | --- |
| `search` | resultCount, market, mode | Does search find the exact product |
| `filter_change` | facet, value, resultCount | Which filters people actually use |
| `browse_mode` | mode (category / routine / concern) | How people prefer to browse |
| `market_switch` | from, to | Nigeria-first behaviour |
| `product_view` | productSlug, source | What discovery paths convert |
| `offer_impression` | productSlug, retailer, priceRank | What store options were seen |
| `store_click` | productSlug, retailer, priceNgn, priceRank, market, position, freshnessDays | Which store, and cheap vs pricey |
| `share_click` | productSlug, surface | Whether share drives return visits |
| `consult_step` | step, outcome (no query text) | Where guidance helps or stalls |
| `contribute_step` | step, mode, result | Reuses the community intake rule |

`store_click` is the highest-value event. `priceRank` is derived from the same market summary the product page shows: `lowest`, `median`, `higher`, `only`, or `marketplace`. That single field answers "do people prefer cheap or expensive" without profiling anyone.

## Privacy boundary

This is a hard boundary, not a preference.

- No personal data: no legal name, email, account, raw IP address, or user-agent string is stored. Same rule as [community intake](./COMMUNITY_KNOWLEDGE_INTAKE.md).
- No search-query text is stored. Events record counts and modes, never what was typed.
- Identifiers used for abuse limits are HMACed and short-lived; analytics is aggregate.
- Concern and Ask Jelo activity is never joined to advertising or retailer targeting. Health-shaped behaviour stays out of commercial signals. See [ADR 0001](./adr/0001-deferred-trust-collections-community-and-stock-alerts.md).
- Affiliate and outbound value is a measurement, never an input to ranking, guidance, or safety. A store is never ranked higher because it converts.
- Honour target-market data-protection duties before collection. Starting reference: [Nigeria Data Protection Act 2023](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf).

## Implementation direction

- Keep `/go` the only outbound path. Record `store_click` server-side there, deriving `priceRank` from the offer set already resolved for the redirect.
- Send client events through Vercel Analytics custom events, or a thin typed wrapper, with no free text.
- Aggregate privately, the same boundary as `npm run community:research:signals`. Do not expose a public analytics endpoint.
- Ship `store_click` first. It carries the most signal for the least surface. Add funnel events after.

## Source of truth

| Question | Source |
| --- | --- |
| Outbound attribution | [modules/commerce/redirect-attribution.ts](../modules/commerce/redirect-attribution.ts) |
| Outbound route | [app/go/route.ts](../app/go/route.ts) |
| Page analytics | `@vercel/analytics` in [app/layout.tsx](../app/layout.tsx) |
| Decision measures | [Product roadmap](./product/ROADMAP.md) |
| Privacy posture | [ADR 0001](./adr/0001-deferred-trust-collections-community-and-stock-alerts.md), [community intake](./COMMUNITY_KNOWLEDGE_INTAKE.md) |

Measure decision quality, never attention. If an event cannot improve how someone chooses a product, do not collect it.
