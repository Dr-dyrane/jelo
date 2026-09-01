# ADR 0019: Product-to-place Market Finder

- **Status:** Accepted for prototype; production data activation pending
- **Date:** 2026-09-01
- **Decision owner:** Founder
- **Extends:** [ADR 0002](0002-anonymous-community-knowledge-intake.md),
  [ADR 0003](0003-retailer-partnership-intake.md),
  [ADR 0005](0005-structured-observation-events.md),
  [ADR 0006](0006-store-ranking-excludes-commercial-signals.md), and
  [ADR 0007](0007-internal-moderation-operations-console.md)
- **Preserves:** [ADR 0016](0016-retailer-scoped-assisted-procurement.md) and
  [ADR 0017](0017-private-saved-locations-and-optional-geocoding.md)
- **Related guidance:** [Smart store guide](../retailers/SMART_STORE_GUIDE.md),
  [Retail Intelligence](../RETAIL_INTELLIGENCE.md), and
  [Catalogue publication gate](../CATALOGUE_PUBLICATION_GATE.md)

## Outcome

JeloCare will prototype a product-to-place Market Finder: a customer starts
with one exact JeloCare product and sees the smallest useful set of physical
places where that exact product has sufficiently current, reviewed evidence.
The first prototype is scoped to Trade Fair and tests whether a product-led,
section-aware journey is more useful than a directory of market names and
shops.

The unit of guidance is not "this retailer may sell skincare." It is:

> This exact product identity was observed at this reviewed shop, inside this
> market place, at this time, with this availability and evidence state.

Field searching exposed the missing structure. A landmark can be absent or
misnamed, and a successful product find can happen at an unnamed shop beside a
known business. Those are research leads, not facts that JeloCare may turn
into a public pin. Market Finder therefore connects products to reviewed
places through evidence; it does not publish remembered directions or import
search and map results as truth.

This decision accepts a development-only fixture prototype, including a
contextual report preview inside the existing `/contribute` route. It does not
authorize a database migration, canonical market data, production route
activation, a persistent Market Finder contribution mode, user-location
collection, retailer stock automation, or checkout integration.

## Product-to-place journey

The first question is "What are you looking for?", not "Which market do you
want to browse?" A product slug is a navigation hint. The server resolves it
against the permitted exact-product set before showing any result.

The journey is:

```text
exact product
  -> physical market
  -> verified place hierarchy
  -> canonical retailer location
  -> current physical observation
  -> one clear next action
```

Results should prefer a calm list with place breadcrumbs, shop label,
observation time, availability state, and directions or a verified contact
path. A map may support the list only when a reviewed public-business
coordinate has an explicit precision. It is not the source of truth, and a
plaza- or entrance-level coordinate must not be presented as an exact stall
pin.

A `Report an update` action stays within the existing anonymous contribution
system. It carries bounded market, exact-product, and shop navigation hints to
`/contribute`; the server re-resolves all three before showing a fixed-outcome
journey. It never posts to a Market Finder-specific public API.

A future multi-product journey may return two different result types:

- **One shop:** one retailer location has fresh eligible observations for
  every exact product.
- **Market trip:** a bounded two- or three-stop plan covers the requested
  products.

A market trip is not a basket, bundle, quote, reservation, or order. It must
not weaken the one-retailer commerce contract in
[ADR 0016](0016-retailer-scoped-assisted-procurement.md) or the operational
boundary in [Assisted procurement](../commerce/ASSISTED_PROCUREMENT.md).

## Exact-SKU identity boundary

Every production physical product observation must reference the immutable
`catalogue_product_identity_versions` record for the exact reviewed brand,
variant, size, package, and formula version. Mutable names, search text,
retailer-local SKUs, and product slugs are not durable observation identity.

The boundary is fail-closed:

- only a current published product identity may receive an actionable public
  physical observation;
- an observation remains historical against the identity version seen at the
  time;
- retiring or succeeding an identity does not move observations to the new
  size, variant, package, or formula;
- a successor identity requires new physical evidence;
- an ambiguous or missing identity produces no buying-location claim; and
- a physical observation does not independently prove authenticity, product
  suitability, retailer authorization, or stock reservation.

This preserves the exact-product and publication rules in the
[Catalogue publication gate](../CATALOGUE_PUBLICATION_GATE.md). Market Finder
may enrich an already reviewed exact identity; it cannot create or repair one.

## Separate physical-market domain

The existing catalogue `offers` domain remains the source for exact online
listings and their web-refresh history. Its country-level market code, listing
URL, and retailer-level uniqueness do not identify a Trade Fair plaza, branch,
or stall. Physical shelf evidence also expires and contradicts differently
from a retailer website. The two domains must not be collapsed.

The production contract proposes exactly seven additive tables. These names
and relationships are accepted as architecture, not as an authorized
migration. The next migration number, SQL, grants, indexes, backfill, and
activation plan must be reviewed and rehearsed separately under the
[Neon data operating guide](../data/NEON.md).

```text
physical_markets
  -> physical_market_places
  -> retailer_locations <- retailers
       -> retailer_location_channels
       -> retailer_location_evidence
       -> physical_product_observations
            <- catalogue_product_identity_versions

community_contributions
  -> market_finder_reports
       -> retailer_locations
       -> catalogue_product_identity_versions
```

### 1. `physical_markets`

One reviewed real-world market identity. It owns a stable slug, public name,
city, state, country, publication state, and review timestamps. A search
result or colloquial name is not sufficient to create it.

### 2. `physical_market_places`

A same-market hierarchy for entrances, zones, plazas, sections, floors, and
landmarks. Parent and child must belong to the same market; cycles are invalid.
Only reviewed aliases are searchable. Optional latitude and longitude describe
public business geography and require bounds, source, verification time, and
an `exact`, `building`, `entrance`, or `approximate` precision.

### 3. `retailer_locations`

One physical branch or shop belonging to the existing canonical `retailers`
identity. It may reference a market and primary place, normalized shop number,
floor, bounded public directions, and a `lead`, `verified`, `disputed`, or
`retired` state. A retailer remains one business; branches and stalls do not
become duplicate retailer identities.

Unknown shops remain private research leads until the business and location
are resolved. A description such as "beside Cyncel" cannot become a canonical
retailer or public location by itself.

### 4. `retailer_location_channels`

Independently reviewed order or contact paths for a location, such as physical
visit, phone, WhatsApp, website, or social business profile. Each channel owns
its public destination, state, source, verification time, and expiry. Private
contact details from a partnership application are never copied into this
table without a separate publication decision.

### 5. `retailer_location_evidence`

Append-oriented evidence for location identity, channel ownership, and public
directions. Evidence identifies its method, source reference, observed time,
expiry, reviewer, and decision. Field visit, retailer confirmation, online
listing, partnership application, and community report remain distinct source
classes. Settled evidence is retained; a correction supersedes rather than
rewrites it.

### 6. `physical_product_observations`

One exact identity version observed at one retailer location. The immutable
fact includes controlled availability, optional positive NGN price, observed
and expiry times, source method, structured title and size evidence, review
state, and an idempotent source reference. An observation's evidence fields do
not change after creation; an attributable moderation decision may approve,
reject, or supersede it while preserving history.

The physical availability vocabulary is `in_stock`, `low_stock`,
`out_of_stock`, `unknown`, and `not_carried`. Price cannot be represented as
zero or inferred from memory. Expiry must be later than observation time.
Indexes must support the newest reviewed observation for one identity and one
location without deleting older observations.

### 7. `market_finder_reports`

A one-to-one typed projection of the existing anonymous intake. Its
`contribution_id` is a unique, non-null reference to
`community_contributions.id`, so one immutable contribution can produce at
most one Market Finder report. It is not a draft, edit capability, public API,
retention owner, or parallel moderation queue.

The projection carries a fixed outcome such as `found_bought`,
`shop_exists_no_stock`, `location_wrong`, or `shop_closed`, plus the
server-resolved exact product, market, and retailer-location context required
for review. It inherits parent retention and rejection lineage. It is not a
canonical observation and cannot update public stock, directions, or location
state directly.

The first production form, if separately accepted, contains no free text,
photo, receipt, account identifier, phone, email, raw device coordinate, or
persistent network identifier. Unknown-shop discovery continues through
private research until a safe structured lead contract is accepted.

The shipped `community_observations` table remains the general price and
experience-outcome projection decided in
[ADR 0005](0005-structured-observation-events.md). It does not receive Market
Finder outcomes, physical-place identity, directions, or stock state.
`physical_product_observations` is also separate: an authorized operator may
append one only after a distinct physical-evidence decision. Neither accepting
a contribution nor resolving its Market Finder projection converts an existing
community observation into physical evidence.

## Evidence, moderation, and freshness machines

Location identity and product availability are independent state machines.
Fresh product evidence cannot repair a disputed location, and a verified shop
cannot imply that it currently carries every product.

### Location identity

```text
lead -> verified -> disputed -> retired
          |             |
          +-> needs recheck <-+  (derived when verification expires)
```

Expiry creates a recheck requirement; it does not silently retire or renew a
location. A new source appends evidence, and an authorized operator records the
resulting transition.

### Physical product observation

```text
pending -> approved -> expired from public actionability
       \-> rejected

approved old observation -> superseded by newer approved observation
```

The current read selects the newest approved observation for one exact identity
and location. It may support a buying action only before `expires_at`. An
expired record remains useful history but changes the customer claim to
"stock not confirmed" or "call first." A terminal contradiction appends a new
`out_of_stock` or `not_carried` observation instead of editing the prior row.

Freshness policy is source-specific and server-owned. A field shelf check,
retailer confirmation, branch-scoped online record, and moderated customer
report may receive different maximum lifetimes. A generic retailer website,
Google result, map pin, social post, or old receipt can create a lead but cannot
establish current physical shelf stock.

### User report

```text
anonymous draft -> immutable community contribution
  -> typed Market Finder projection
  -> parent review in /ops/contributions
  -> child resolved, corroborated, or rejected
  -> separate canonical physical-evidence decision
```

No number of reports automatically promotes a shop or stock state. The
moderation system resolves the canonical retailer, place, exact identity, and
scope in the contribution context, then records any physical evidence as a
separate attributable decision. Approval of the parent contribution does not
approve the child report. This preserves the boundaries in
[ADR 0002](0002-anonymous-community-knowledge-intake.md),
[ADR 0005](0005-structured-observation-events.md), and
[Community knowledge intake](../COMMUNITY_KNOWLEDGE_INTAKE.md).

## Moderation and ingestion boundary

Search, Maps, social profiles, retailer applications, community reports, and
field notes are discovery inputs. They pass through this sequence:

```text
private lead
  -> canonical retailer resolution
  -> market and place resolution
  -> exact product resolution where applicable
  -> evidence review
  -> attributable approval
  -> public read model and targeted cache invalidation
```

They never synchronize directly into a public shop, pin, channel, price, or
stock claim. Canonical location and observation decisions require explicit
Operations capabilities, server-derived operator identity, and transactionally
coupled audit under [ADR 0007](0007-internal-moderation-operations-console.md).
Market Finder reporting reuses `/contribute`, its draft and submission
endpoints, HttpOnly edit capability, optimistic revisions, idempotent
finalization, retention, same-site checks, and abuse controls under
[ADR 0002](0002-anonymous-community-knowledge-intake.md) and
[ADR 0008](0008-public-surface-abuse-and-browser-hardening.md). There is no
`/api/markets/reports` endpoint. Review stays in `/ops/contributions`, with a
separate typed child decision and physical-evidence action.

The existing online inventory queue remains unchanged. A later physical
recheck queue may reuse its lease, idempotency, retry, and append-history
patterns, but it must be a separate machine keyed by exact identity and
retailer location. No new cron or automated retailer write is accepted here.

## Privacy boundary

Public market geography is reviewed business information. It is not customer
location data.

- Market Finder must not read from or write to `customer_saved_locations`.
- A saved delivery address, account, order address, or Ask JeloCare context is
  never used to infer a nearby shop.
- Device location is deferred. If later accepted, it requires explicit
  permission and ephemeral, no-store distance computation without route logs.
- Public business coordinates carry precision and evidence. They are not
  silently upgraded from approximate to exact.
- Partnership applications remain private until separately reviewed under
  [ADR 0003](0003-retailer-partnership-intake.md).
- Anonymous media remains deferred until private quarantine, metadata
  stripping, malware handling, redaction, retention, and deletion exist.
- Finder query text, raw coordinates, route traces, and report contents do not
  enter behavioural analytics.

These rules extend, but do not weaken, the private address boundary in
[ADR 0017](0017-private-saved-locations-and-optional-geocoding.md) and the
measurement boundary in [Behavioural analytics](../ANALYTICS.md).

## Ranking boundary

Hard eligibility runs before ordering:

1. exact active product identity;
2. verified, non-disputed retailer location;
3. reviewed observation with supported scope;
4. freshness sufficient for the wording shown; and
5. a usable verified physical or contact action.

Eligible results may then use evidence freshness, supported availability,
user-selected fulfilment fit, landed cost when completely known, place
convenience, and bounded stop count. Without reviewed walking topology, the UI
may group results by plaza or section but cannot claim the shortest route.

Affiliate value, commission, margin, outbound clicks, conversion, popularity,
ratings, retailer partnership, and featured status are permanently forbidden
inputs. [ADR 0006](0006-store-ranking-excludes-commercial-signals.md) remains
the governing ranking decision.

## Development-only fixture prototype

The accepted prototype uses clearly fictional or explicitly non-authoritative
fixture observations to test information architecture, language, responsive
layout, and transitions. Fixture content is not source evidence and must never
be copied into canonical catalogue or market data.

The only prototype routes are:

- `/markets`
- `/markets/trade-fair?product=<slug>`
- `/markets/trade-fair/shops/<shopSlug>?product=<slug>`
- `/contribute?mode=market-report&market=<marketSlug>&product=<productSlug>&shop=<shopSlug>`

The product query is re-resolved against the bounded fixture catalogue; an
unknown or ambiguous slug fails closed. The contextual contribution preview
also resolves one exact, non-repeated `mode`, market, product, and shop through
the fixture helpers. Missing, repeated, unknown, or production Market Finder
context returns `notFound()`; the normal `/contribute` journey remains
unchanged.

The preview locks the resolved market, exact product, and shop, then shows only
the four fixed report outcomes. It creates no draft and makes no fetch, API,
analytics, or durable write. Feedback on the shop page also remains local
client state.

Every fixture-backed route and contextual contribution mode must call
`notFound()` outside development. Preview and production must not render
fixture shops, stock, prices, directions, feedback, or the Market Finder report
preview. A deployed 404 is the expected production behavior until the data
activation gates below are satisfied; it is not evidence that Market Finder is
live.

## Activation phases

### Phase 0: accepted prototype

- Build and review the three Market Finder routes and the contextual
  `/contribute` report preview.
- Test the product-to-place flow with fixture data only.
- Exercise narrow mobile and desktop layouts, keyboard use, back/refresh,
  loading, unknown product, empty result, stale result, and disputed-place
  states.
- Collect founder decisions about language, place hierarchy, result density,
  evidence cues, and whether list-first navigation solves the field-search
  problem.

Phase 0 creates no migration, production data, public route, map integration,
report endpoint, analytics stream, or order behavior.

### Phase 1: governed data foundation

- Review the seven-table contract and authorize a separately numbered
  migration.
- Rehearse the exact migration bytes against a production-shaped Neon branch.
- Add explicit grants, constraints, indexes, moderation capabilities, audit,
  and a rollback-safe activation boundary.
- Extend the existing contribution transaction with a strict Market Finder
  schema and one-to-one projection; reuse the current draft security,
  idempotency, rejection cascade, and retention behavior.
- Resolve and approve one canonical market, its initial place hierarchy,
  canonical retailer locations, public channels, and exact product
  observations.
- Implement the current read model, source-specific freshness policy, targeted
  cache tags, and operator recheck workflow.

No seed may turn fixture names, field memory, search results, or disputed
landmarks into public facts.

### Phase 2: bounded Trade Fair pilot

- Activate the production routes only for the reviewed Trade Fair dataset.
- Start list-first; expose only stable reviewed plaza or entrance geometry.
- Activate the contextual `/contribute` mode only after its typed projection,
  `/ops/contributions` child review, abuse, retention, and privacy gates pass.
- Measure aggregate task outcomes only through a separately accepted enum-only
  contract that cannot affect ranking.

### Later options

Multiple markets, device-distance ranking, walking topology, PostGIS,
retailer self-confirmation, a leased physical refresh queue, governed
shopfront media, shareable trips, and assisted-procurement location snapshots
remain separate decisions. Split-shop checkout, inventory reservation, and a
claim of real-time stock are not implied by Market Finder.

## Acceptance and release gates

### Prototype acceptance

The prototype is accepted only when:

- all three Market Finder routes and the contextual `/contribute` preview
  render and behave correctly in development;
- the three Market Finder routes and contextual report mode return `notFound()`
  in production mode;
- the product and shop URL state survives refresh and browser navigation;
- exact, stale, missing, disputed, and empty evidence states are visibly
  different;
- actions and feedback are keyboard-operable and meet the existing mobile tap
  target and contrast floor;
- feedback and report preview produce no network request or durable state;
- focused tests prove production gating and fixture-only data ownership; and
- no migration, canonical offer, catalogue record, order, analytics event, or
  external publication is changed.

### Production data acceptance

Production activation additionally requires:

- founder approval of the canonical market name and the reviewed pilot set;
- an accepted migration plan with exact constraints, privileges, retention,
  and append-history behavior;
- successful validation, production-shaped rehearsal, and protected operator
  application under the [Operations runbooks](../operations/RUNBOOKS.md);
- exact identity-version coverage for every surfaced product;
- attributable location, channel, and stock evidence for every public claim;
- `/ops/contributions` support for the typed report, with separate child,
  location, and physical-observation capabilities and audit;
- server-side freshness enforcement and fail-closed stale behavior;
- targeted cache invalidation that cannot expose fixture or unreviewed rows;
- security and abuse review before accepting any public write; and
- a reviewed rollback that disables public reads without deleting evidence or
  history.

### Release proof

Prototype completion is local or test evidence only. It is never described as
live. A future production release requires the exact authorized revision to
pass focused and integration gates, the exact Vercel deployment to become
ready, and affected-route smoke tests to read the reviewed database records.
The release record must distinguish local, pushed, deployed-unverified, and
live-verified states.

## Consequences

JeloCare gains a coherent path from exact product intent to real-world Lagos
places without pretending that a directory, map pin, old recommendation, or
online listing is current shelf evidence. The separate domain costs more than
adding free-text location labels to offers, but it preserves retailer identity,
physical-place hierarchy, observation history, moderation, privacy, and honest
freshness.

Reusing `/contribute` avoids a second anonymous security and retention system.
Keeping the typed report projection separate from both `community_observations`
and `physical_product_observations` preserves clear evidence lineage from a
community claim to an attributable public-data decision.

The development prototype can now answer the interaction question quickly.
Production remains closed until the evidence system, migration, operator
authority, and reviewed Trade Fair data exist.
