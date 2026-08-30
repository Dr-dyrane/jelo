# Behavioural analytics

Updated: 2026-08-30

We measure behaviour to answer one question: does JeloCare help someone choose better before buying skincare. Every event serves that. None of it profiles a person.

## What exists today

- Page traffic through Vercel Analytics, mounted in [app/layout.tsx](../app/layout.tsx).
- Anonymous contribution drafts keep one bounded first-touch campaign record in
  `community_intake_attributions`. It stores only normalized source, medium,
  campaign, creative label, and `/contribute` landing path. The aggregate is
  available through `/ops/signals` and
  `npm run community:research:signals`.
- A single successful exact-offer outbound choke point: the trust bridge at `/go?product=<slug>&retailer=<name>` continues through `/go/continue` in [app/(site)/go/continue/route.ts](<../app/(site)/go/continue/route.ts>). It re-resolves the exact offer and attributes the destination through [redirect-attribution.ts](../modules/commerce/redirect-attribution.ts) (`utm_content=<product>:<retailer>`).
- The `store_click` event, recorded server-side there exactly once for the exact-offer branch. `priceRank`, `position`, and `freshnessDays` come from the same ranking and market summary the product page shows ([price-rank.ts](../modules/commerce/price-rank.ts)); the write goes through `next/server` `after` so it never delays the redirect, no-ops without Neon, and is bounded by a strict schema ([commerce-events.ts](../lib/analytics/commerce-events.ts), table `commerce_events` in `db/migrations/0019_commerce_events.sql`). See [ADR 0005](./adr/0005-structured-observation-events.md).
- Trust-bridge view, alternative-selection, cancellation, and pre-navigation continue events are not collected. The former unauthenticated `/api/handoff` collector and invalid `handoff_*` `commerce_events` writer were removed because migration `0019` permits only the complete `store_click` shape. This leaves an explicit measurement gap: current evidence can count successful exact-offer outbound continuations, but cannot measure trust-bridge impressions, abandonment, alternative selection, or cancellation. Closing that gap requires a separately governed, abuse-resistant aggregate design and is deferred to the business-evidence register; it must not be inferred from `store_click`.
- Two write-only Lagos Daily Desk counters, `view` and `compare_click`. The
  client sends only the current public campaign id and enum event, with cookies
  omitted and referrer suppressed. The server re-resolves today's accepted
  production campaign before an aggregate Redis increment. Keys contain only
  Lagos date, public campaign id, and event; they expire after 90 days and have
  no public read endpoint.
- Authenticated JeloCare Me reads and mutations emit only fixed surface,
  operation, success/failure, and coarse latency enums. Server-side
  `next/server` `after` scheduling keeps measurement off the response path.
  Environment-separated UTC-hour Redis hashes expire no later than 35 days
  after their hour begins. They contain no owner, account, session, or request
  identifier and no product, concern,
  query, routine, location, order, device, referrer, path, URL, or free-text
  value. No client event or public reader exists. The operator command
  `npm run customer:telemetry:report` reads only the 672 exact production
  hashes in the rolling 28-day window and reports aggregate
  read/write success plus counts by the fixed enums. Preview or development
  reporting requires explicitly choosing `--environment preview` or
  `--environment development`.
  Read success describes the authenticated route operation: thrown errors,
  non-success API responses, and already-exposed Shelf, Routine, or Location
  unavailable states count as failures. The current read-model contract
  collapses an unavailable Concern source to an empty set, so a successfully
  rendered empty Concern state remains a successful route read rather than a
  per-source health signal.

The rest of the custom event taxonomy below is still roadmap. Page traffic,
anonymous contribution starts and completions, outbound attribution, and
`store_click`, the two Daily Desk aggregate counters, and private-safe Me
route-operation telemetry exist now.

## Campaign response

`/ops/signals` reports two independent facts:

- **Started** means a person answered the first contribution prompt and a
  private remote draft was created.
- **Completed** means the contribution was submitted.

The page groups only bounded campaign labels. It does not join a campaign to
products, concerns, prices, routines, accounts, devices, or individual
contributors. Submissions collected before attribution existed remain
`Not recorded`; they are never relabelled `Direct`.

Bounded tags such as `utm_source=tiktok`, `utm_medium=paid-social`, and a
non-identifying campaign label preserve the richest source context. When those
tags are absent, JeloCare recognizes the presence of TikTok's automatically
appended click marker as `TikTok · Paid` and immediately discards the marker
value. It is never stored or sent back to TikTok. TikTok-reported clicks,
impressions, spend, and CTR are not JeloCare events and are not inferred by
this monitor. No TikTok Pixel or Events API is installed.

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

| Event              | Payload                                                                     | Answers                            |
| ------------------ | --------------------------------------------------------------------------- | ---------------------------------- |
| `search`           | resultCount, market, mode                                                   | Does search find the exact product |
| `filter_change`    | facet, value, resultCount                                                   | Which filters people actually use  |
| `browse_mode`      | mode (category / routine / concern)                                         | How people prefer to browse        |
| `market_switch`    | from, to                                                                    | Nigeria-first behaviour            |
| `product_view`     | productSlug, source                                                         | What discovery paths convert       |
| `offer_impression` | productSlug, retailer, priceRank                                            | What store options were seen       |
| `store_click`      | productSlug, retailer, priceNgn, priceRank, market, position, freshnessDays | Which store, and cheap vs pricey   |
| `share_click`      | productSlug, surface                                                        | Whether share drives return visits |
| `consult_step`     | step, outcome (no query text)                                               | Where guidance helps or stalls     |
| `contribute_step`  | step, mode, result                                                          | Reuses the community intake rule   |

`store_click` is the highest-value event. `priceRank` is derived from the same market summary the product page shows: `lowest`, `median`, `higher`, `only`, or `marketplace`. That single field answers "do people prefer cheap or expensive" without profiling anyone.

## Privacy boundary

This is a hard boundary, not a preference.

- No personal data: no legal name, email, account, raw IP address, or user-agent string is stored. Same rule as [community intake](./COMMUNITY_KNOWLEDGE_INTAKE.md).
- Daily Desk measurement reads and stores no cookie, session, referrer, raw IP,
  user-agent, or fingerprint. Its abuse ceiling is one global minute bucket,
  not a visitor key, and its private counters cannot be joined to a person.
- Contribution attribution never stores a full referrer, query string,
  `utm_term`, ad-network click ID, or person/session identifier. It is
  first-touch campaign context, not identity and never a trust signal.
- No search-query text is stored. Events record counts and modes, never what was typed.
- Identifiers used for abuse limits are HMACed and short-lived; analytics is aggregate.
- Concern and Ask Jelo activity is never joined to advertising or retailer targeting. Health-shaped behaviour stays out of commercial signals. See [ADR 0001](./adr/0001-deferred-trust-collections-community-and-stock-alerts.md).
- Me service counters are global aggregates within a fixed deployment
  environment and UTC hour. They contain no identity or private payload, have
  no per-user correlation, and never enter product, advertising, or care
  ranking.
- Affiliate and outbound value is a measurement, never an input to ranking, guidance, or safety. A store is never ranked higher because it converts.
- Honour target-market data-protection duties before collection. Starting reference: [Nigeria Data Protection Act 2023](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf).

## Implementation direction

- Keep `/go/continue` as the successful outbound path after the `/go` trust bridge. Record `store_click` server-side there exactly once for an exact offer, deriving `priceRank` from the offer set re-resolved for the redirect.
- Send client events through Vercel Analytics custom events, or a thin typed wrapper, with no free text.
- Aggregate privately, the same boundary as `npm run community:research:signals`. Do not expose a public analytics endpoint.
- Keep Me measurement enum-only and server-side. Production reporting defaults
  to the rolling 28-day production partition; non-production partitions must be
  selected explicitly and never count toward the production scorecard.
- Keep Daily Desk counters separate from share selection and every product,
  retailer, offer, care, and advertising ranking input.
- Keep contribution starts and completions derived from the intake records
  already required to save and submit the form. Do not add a parallel
  person-level advertising event stream.

## Source of truth

| Question                      | Source                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Outbound attribution          | [modules/commerce/redirect-attribution.ts](../modules/commerce/redirect-attribution.ts)                                              |
| Outbound route                | [app/(site)/go/continue/route.ts](<../app/(site)/go/continue/route.ts>)                                                              |
| Page analytics                | `@vercel/analytics` in [app/layout.tsx](../app/layout.tsx)                                                                           |
| Daily Desk aggregate response | `lib/campaigns/campaign-archive.ts`, written by `/api/campaigns/daily-desk/events`                                                   |
| Private Me route operations   | `lib/customer/private-telemetry.ts`, reported by `npm run customer:telemetry:report`                                                 |
| Anonymous contribution source | `community_intake_attributions`, aggregated by `/ops/signals` and `npm run community:research:signals`                               |
| Decision measures             | [Product roadmap](./product/ROADMAP.md)                                                                                              |
| Privacy posture               | [ADR 0001](./adr/0001-deferred-trust-collections-community-and-stock-alerts.md), [community intake](./COMMUNITY_KNOWLEDGE_INTAKE.md) |

Measure decision quality, never attention. If an event cannot improve how someone chooses a product, do not collect it.
