# ADR 0019: Product-to-place Market Finder

- **Status:** Phase 2 Trade Fair pilot live for reviewed evidence
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

The original decision accepted a development-only fixture prototype, including
a contextual report preview inside the existing `/contribute` route. A later
founder-authorized Phase 1 implementation added the governed local data and
moderation foundation described below. It still does not authorize production
database application, canonical market data, production route activation,
user-location collection, retailer stock automation, or checkout integration.

### Phase 1 implementation checkpoint

Migration `0053_physical_market_finder.sql` was promoted byte-for-byte after a
first-run and idempotent-rerun rehearsal on the production-derived, expiring
Neon branch `rehearsal/market-finder-terminal-insert-20260902`
(`br-snowy-pine-avu7n6wq`). The rehearsed SHA-256 is
`9f959c3431b6a1b62912e6fe1b7e5e06e62f28a7956d26c5691ec74703c8f078`.
The branch audit found exactly the seven accepted empty tables, all 21 named
acceptance triggers enabled, the committed `market_report` enum value, no
runtime `DELETE` grant, and the exact ledger checksum. Rollback-safe negative
probes also proved that neither location evidence nor a physical product
observation can be inserted already approved.

Migration `0054_market_finder_report_current_context.sql` then closed the
report-intake race and eligibility gap on fresh production-derived branch
`rehearsal/market-finder-report-current-context-final-20260902`
(`br-curly-sea-avsiv3xz`). The exact promoted SHA-256 is
`62081dd7c9936c6a4e1d25f1ff39cf0c9e63d757f8d0b25ad61ea4f2234c1e7f`.
The replacement trigger requires the newest approved, non-superseded, current
positive observation and the same reviewed public-action predicate used by the
read model. It also serializes report creation with parent moderation and pins
authoritative relations to the public schema. First-run, idempotent rerun,
rollback-safe result cases, action-parser parity, and a two-session parent-lock
probe passed on that disposable branch.

Correction migration `0055_market_finder_atomic_context.sql` closes the
remaining current-context mutation race while preserving original reviewer
attribution when approved evidence or observations are superseded. Exact
SHA-256
`e0a5e58ee2e39f54976031d5afc64d9e8a966e76cfe116e5130b2fd5d2bdc22d`
was rehearsed on 2026-09-02 in Neon project `spring-field-93817903`, fresh
production-derived branch
`rehearsal/market-finder-atomic-context-20260902`
(`br-long-silence-avkudczf`, expiring `2026-09-09T23:59:59Z`). The first run
applied `0053`, `0054`, and `0055`; the second skipped all three unchanged, and
`0055` was then promoted unchanged.
Rollback-safe acceptance found all eight statement-level context-lock triggers,
proved blocking in both directions, rejected non-READ-COMMITTED report
transactions, preserved evidence and observation attribution, and left zero
synthetic rows.

The application foundation now includes the fail-closed database read model,
database-backed public route adapters, strict contextual contribution
transaction, typed child review in `/ops/contributions`, separately audited
physical-evidence operations, a dry-run-first pilot onboarding operator, and
targeted cache tags. Public reads require both
`MARKET_FINDER_PUBLIC_READ_ENABLED=true` and the exact
`MARKET_FINDER_PUBLIC_MARKET_SLUG=trade-fair` allowlist. Anonymous Market
report create, save, and submit additionally require the default-off
`MARKET_FINDER_REPORT_INTAKE_ENABLED=true` gate. On 2026-09-02 the protected
production runner applied migrations `0053`, `0054`, and `0055` in canonical
order with `runner_atomic` provenance; the post-apply ledger reported 56
applied, zero pending, and zero drift. The schema application seeded no rows.
A separate reviewed, location-only onboarding then published the `trade-fair`
market and verified Nectar Beauty Hub's Tradefair outlet, directions, and
public phone without creating a product relation, price, or stock observation.
The governed schema is applied in production. The Trade Fair public read is
active only for reviewed current records, and the navigation entry appears only
when that bounded market is ready. Report intake retains its separate feature
gate and the existing Contribute moderation path; activating the read does not
grant a report or evidence record publication authority.

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

### Experience architecture and complete decision tree

Market Finder is one JeloCare journey, not a self-contained mini-application.
Its public composition reuses the catalogue and retailer language already
present in the product card, directory search, retailer profile, back
navigation, and Contribute surfaces.

```text
product profile "Find a store" sheet (when an eligible market path exists)
                         |
                         v
/markets -> exact-product search and ProductCard selection
   |
   +-- exact identity missing or ambiguous
   |      -> no result route
   |      -> identity queue
   |      -> private My Shelf exact-pack request
   |
   +-- exact identity resolved
          -> reviewed market scope
          -> current read / fixture rehearsal
                 |
                 +-- one or more eligible places
                 |      -> best current place first
                 |      -> shop record
                 |      -> reviewed direction or contact action
                 |
                 +-- no eligible place
                        -> calm no-route state
                        -> stale, disputed, unavailable, and research
                           records remain visibly separate from travel guidance

shop record
   |
   +-- continue journey -> text directions for an eligible route only
   |
   +-- report a change
          -> development fixture: preview one fixed outcome; no write
          -> after the report-intake activation gate: existing /contribute
             draft lifecycle with product, market, and retailer location
             locked by the server
          -> parent Contributions review
          -> typed Market Finder child review
          -> separate attributable physical-evidence decision
          -> targeted cache invalidation
          -> next current read
```

The customer decision matrix is:

| Decision state                                   | Visible answer                                            | Primary action                                |
| ------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------- |
| Exact product is unresolved                      | Show the named request and what identity is missing       | Share the exact pack through My Shelf         |
| Exact product is resolved but no place qualifies | Show no confirmed place; keep research records separate   | Change product                                |
| Current reviewed place exists                    | Show one best place, freshness, and location              | Open the shop record                          |
| Location or directions are disputed              | Show the warning only                                     | No travel action                              |
| Product evidence is stale                        | Keep the shop history visible as research                 | No travel action                              |
| Exact product was reported unavailable           | Keep the negative observation product-scoped              | No travel action                              |
| Eligible shop record is open                     | Keep exact pack, market, shop, and observed date visible  | Follow reviewed text directions               |
| Shopper knows the record changed                 | Preserve locked context and accept one controlled outcome | Preview in the fixture; send after activation |

The route and component ownership is:

| Surface                                  | Native JeloCare composition                                                                     | Truth owner                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Product profile                          | Existing product quick-panel Store search with an optional Physical market row                  | Exact catalogue product plus activation gate      |
| `/markets`                               | `DirectoryTypeahead`, `ProductCardGrid`, exact packshots, and one reviewed market scope         | Published exact-product and market discovery read |
| `/me/shelf/add`                          | Existing private missing-product request with exact pack fields and optional private photo      | Customer-owned identity request                   |
| `/markets/[marketSlug]`                  | Editorial market hero, locked exact-product stage, best result, then collapsed research records | Market Finder read model                          |
| `/markets/[marketSlug]/shops/[shopSlug]` | `SmartBackLink`, retailer-profile rhythm, text directions, one evidence disclosure              | Eligible location/action evidence                 |
| Contextual `/contribute`                 | Existing draft, capability, retention, submission, and moderation lifecycle                     | Server-resolved locked report context             |
| `/ops/contributions`                     | Existing parent row plus typed child decision and separate physical-evidence action             | Attributable Operations decisions                 |

The UI contract is deliberately strict:

- full-width warm editorial surfaces and existing type scale, not a centered
  feature shell;
- real exact-product imagery is the dominant recognition cue;
- one vertical decision path, with the current action visible before secondary
  evidence;
- one disclosure layer at a time and no disclosure nested inside another;
- status is carried by concise chips, iconography, freshness, and action
  availability instead of explanatory paragraphs;
- product and market remain in the URL, back navigation uses
  `SmartBackLink`, and changing product returns to the exact-product picker;
- every card that looks actionable is a link or control, all touch targets are
  at least 44 px, and light, dark, keyboard, reduced-motion, and 320 px reflow
  remain release gates; and
- the Market Finder stylesheet owns one definition per component. A
  route-scoped late cascade may not reskin an existing Market component.

The development fixture exercises this complete visual decision tree. The
production read adapters, locked report context, location-correction and
physical-evidence operations, targeted cache invalidation, and rollback-safe
public-read gate are implemented and the protected production schema is
applied, but that does not make the production loop complete. Activation still
requires an exact active published product identity, attributable review of the
first location-bound product observation, and the explicit flag sequence
below. Those release requirements must not be
represented as finished merely because the local journey is visually complete.

Canonical onboarding may stop at a reviewed retailer location without choosing
an unrelated product. In that location-only mode the manifest omits both
`product` and `initialObservation`, performs no catalogue or observation lookup,
and records no product identity in its audit. Supplying an
`initialObservation` always requires the exact active published product
identity. A verified location is therefore reusable groundwork, never an
implicit stock claim.

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

Market Finder owns no second product-media schema. It may project an image only
when the physical observation's product slug, brand, variant, and size exactly
match a product already admitted by the canonical public catalogue projection.
That projection remains the single owner of publication release, rights holds,
asset review, transparency, minimum dimensions, and display approval. A missing
or mismatched catalogue product fails closed to the native image-unavailable
state without withholding otherwise truthful location guidance. Market Finder
cannot publish, approve, transform, or repair a product image.

## Separate physical-market domain

The existing catalogue `offers` domain remains the source for exact online
listings and their web-refresh history. Its country-level market code, listing
URL, and retailer-level uniqueness do not identify a Trade Fair plaza, branch,
or stall. Physical shelf evidence also expires and contradicts differently
from a retailer website. The two domains must not be collapsed.

The production contract uses exactly seven additive tables. These names and
relationships are implemented by locally checked-in migration `0053`; the
report-current-context guard is implemented by follow-on migration `0054`, and
its attribution-preserving atomic context correction by migration `0055`.
All three unchanged byte sets passed governed rehearsal under the
[Neon data operating guide](../data/NEON.md). Rehearsal and local promotion do
not authorize applying them to production or inserting canonical rows.

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

When exact reviewed physical evidence resolves such a lead to a business that
has no admissible exact online offer, a protected physical-only promotion may
create the missing canonical `retailers` parent from its active, assigned custom
retailer-identity research task. The task must have a current retained,
non-rejected source mention and its custom identity must match the proposed
canonical name and slug after normalization, unless the manifest records an
explicit reviewed alias mapping. The operation requires an external private
evidence artifact whose bytes match the reviewed digest and a PII-free opaque
`private-ledger:<canonical lowercase non-zero UUID>` lookup key rather than raw
evidence, URI, path, or contact data, the exact retailer ID, slug, and name, and
an explicit evidence-supported trust score because the current retailer schema
has no unrated state. It atomically records the existing
private `existing-canonical-retailer` resolution, closes the task, and appends a
`community_research_task` `promote` audit with `canonical_write=true`. It does
not create a location, offer, price, channel, stock observation, or application
decision. If a reviewed trust score is unavailable, the schema limitation keeps
promotion blocked rather than allowing an invented default.

All runtime canonical-retailer identity writers share one transaction-scoped
advisory lock. Promotion uses explicit `READ COMMITTED`, acquires the blocking
lock as its first statement, and performs identity reads afterward so a
concurrent writer's committed identity is visible before the case-insensitive
name-conflict check.

This is not the retailer path for an exact online offer. An online-offer
retailer remains coupled to catalogue publication release and reconciliation so
the canonical retailer and product-level offer evidence land together. The
physical-only promotion exists solely to unblock a truthful parent for later,
separately reviewed Market Finder location evidence.

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

## Development fixture and production boundary

The accepted prototype uses clearly fictional or explicitly non-authoritative
fixture observations to test information architecture, language, responsive
layout, and transitions. Fixture content is not source evidence and must never
be copied into canonical catalogue or market data.

The only prototype routes are:

- `/markets`
- `/markets/trade-fair?product=<slug>`
- `/markets/trade-fair/shops/<shopSlug>?product=<slug>`
- `/contribute?mode=market-report&market=<marketSlug>&product=<productSlug>&shop=<shopSlug>`

In development, the product query is re-resolved against the bounded fixture
catalogue; an unknown or ambiguous slug fails closed. The contextual
contribution preview also resolves one exact, non-repeated `mode`, market,
product, and shop through the fixture helpers. Missing, repeated, unknown, or
invalid context returns `notFound()`; the normal `/contribute` journey remains
unchanged.

The preview locks the resolved market, exact product, and shop, then shows only
the four fixed report outcomes. It creates no draft and makes no fetch, API,
analytics, or durable write. Feedback on the shop page also remains local
client state.

Production never imports a fixture result as a fallback. With the public-read
gate off, Market Finder returns `notFound()`. With it on, the exact Trade Fair
allowlist resolves only published database identities supported by an approved
physical observation. A current shop additionally requires current location,
location-identity, product-observation, and usable-action evidence. Repository
failure reaches the route error boundary; stale or missing authority cannot
become a fixture or catalogue-only result. The contextual production report
uses the existing Contribute draft lifecycle only after all three URL hints are
re-resolved by the application to that current database result. Migration
`0054` makes the database insert trigger require the same newest approved,
non-superseded, current positive exact-product observation and usable public
action, in addition to the `0053` parent, market, location, and product-identity
checks. Migration `0055` then serializes report validation with statement-level
mutation of every eligibility relation, preserves original superseded-review
attribution, and rejects report insertion at another isolation level; the
application starts an explicit READ COMMITTED transaction. Report intake
remains a separate production gate. It may open only while the current report
contract, abuse controls, canonical data, and Ops acceptance pass are all
attested; a live public Market Finder read does not imply that write authority
is enabled.

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

The schema, read model, public route, contribution, moderation, protected
onboarding code, and shared application/database report-context guard in this
phase are implemented. Migrations `0053` through `0055` were rehearsed and
applied through the protected runner before the bounded Trade Fair activation.

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
- When a physical-only business lacks the canonical retailer parent, use the
  protected retailer-promotion manifest only from an assigned custom retailer
  identity task with verified retained evidence and a reviewed trust score. Its
  retailer create, private resolution, task closure, and canonical-write audit
  are one atomic unit; exact online-offer retailers continue through catalogue
  release and reconciliation instead.
- Use the protected onboarding manifest to resolve an existing canonical
  retailer, create the reviewed place and location rows, and stop there when
  only location evidence is ready. Bind an active published product identity
  only when appending the first attributable product observation as `pending`.
  Approve that observation only through the separate audited evidence-decision
  command.
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
  outside development while the default-off production gates are disabled;
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
- every rendered product image comes from the exact canonical public catalogue
  intersection used by both readiness and presentation, and uses the native
  catalogue `contain` treatment rather than a crop, transformed URL, or opaque
  fallback; a product without that exact match renders the native
  image-unavailable state and does not withhold truthful location guidance;
- attributable location, channel, and stock evidence for every public claim;
- `/ops/contributions` support for the typed report, with separate child,
  location, and physical-observation capabilities and audit;
- protected production application of rehearsed migrations `0054` and `0055`:
  the former's
  database trigger rejects a report target without the newest approved,
  non-superseded, current in-stock or low-stock observation and a current
  reviewed public action, while the latter preserves superseded-review
  attribution and makes that current-context decision atomic against all eight
  eligible relation mutations;
- server-side freshness enforcement and fail-closed stale behavior;
- no cache purge before first activation, because disabled reads return before
  a cache can be populated; later public evidence changes hard-delete only the
  exact reviewed market tag through the authenticated Vercel CLI;
- security and abuse review before accepting any public write;
- a reviewed rollback that disables public reads without deleting evidence or
  history; and
- the exact activation order: migrate, onboard and review data, enable the
  Trade Fair public read, smoke the read-only journey, then separately enable
  reporting only after its abuse and Ops gates pass.

### Release proof

Application and schema release are distinct from public data activation. The
route remains fail-closed while its release flags are off or the reviewed data
contract is incomplete. A public activation requires the exact authorized
revision to pass focused and integration gates, the exact Vercel deployment to
become ready, and affected-route smoke tests to read reviewed database records.
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

The development fixture answered the interaction question and remains isolated
from production. Production contains migrations `0053`, `0054`, and `0055`
plus the reviewed Trade Fair pilot. Public reads fail closed per exact product,
location, action and observation; only currently eligible records appear. The
online offer and price-history chain is linked at the product and retailer
identity boundaries under [ADR 0020](0020-linked-market-truth-system.md), but
it never substitutes for physical evidence.
