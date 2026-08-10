# JeloCare Me

Updated: 2026-08-09

JeloCare Me is the authenticated customer workspace for asking, discovering,
saving, and organising care. It ships the real `/me` route family,
verified-session guard, warm adaptive shell, truthful empty states, and a
development-only synthetic presentation. Shipped capabilities include
owner-isolated canonical Shelf persistence, owner-isolated Routine persistence
with create/update/delete actions, private missing-product requests, complete
eligible-catalogue Explore reachability, exact member-Product OTP continuation,
the global public reporting helper, and an authenticated Ask Me adapter over
the same deterministic reviewed guidance authority as public `/consult`.

The single authoritative record of what currently ships is
[`lib/customer/customer-capabilities.ts`](../../lib/customer/customer-capabilities.ts).
This document owns product purpose, vocabulary, and route/code ownership; it
does not independently describe shipped feature state.

[ADR 0013](../adr/0013-founder-led-jelocare-me.md) owns the decision and code
boundaries. The [adaptive workspace dock](../design/ADAPTIVE_WORKSPACE_DOCK.md)
owns the shell mechanics. This file owns product purpose, vocabulary, and
route/code ownership. The [production roadmap](./JELOCARE_ME_PRODUCTION_ROADMAP.md)
owns phased delivery, gates, evidence, and the production scorecard.

## The customer goal

One workspace should answer: **What should I understand or do for my care now?**

Home begins with one Ask Me entry rather than a dashboard. Explore keeps member
catalogue discovery separate from customer-owned Shelf and Routine context.
Evidence and exact products carry the experience; controls do not compete with
them. JeloCare Me remains continuous with JeloCare's public warmth while
becoming quieter and more task-led.

Customer-owned surfaces speak in the first person: **My care, My Shelf, My
Routine**. Stable navigation stays Home, Explore, Shelf, and Routine. Route
headers do not explain what imagery, exact-product cards, fields, and working
actions already show; prose is reserved for necessary evidence, safety, or an
honest empty recovery.

Shelf is a cosmetics/product surface, not a library metaphor. Its navigation
uses skincare-product iconography, and wide cards give exact packshots a larger
standing media field with a restrained vanity/shelf plinth. Mobile keeps the
compact product row.

## Information architecture

| Primary destination | Canonical route | Customer job | Page-owned FAB |
| --- | --- | --- | --- |
| Home | `/me` | Return to the customer's care overview and Ask Me entry | Ask Me → `/me/consult` |
| Explore | `/me/explore` | Browse or search every currently eligible exact public catalogue product without treating it as owned | Search products → focus the real catalogue field |
| Shelf | `/me/shelf` | Retrieve and organise intentionally saved exact products without counting private requests as saved | Add to your Shelf → `/me/shelf/add` |
| Routine | `/me/routine` | Arrange a customer-authored routine without turning it into a prescription | Create routine → open the routine builder sheet |

Four authenticated stack pages sit above that primary model:

| Stack page | Canonical route | Parent semantics | Page-owned FAB |
| --- | --- | --- | --- |
| Ask Me | `/me/consult` | Home; reuses public `/consult` safety and guidance authority while keeping its session and opt-in member context separate | Search your care → focus the real care field |
| Member product | `/me/product/[slug]` | The originating primary destination (or Ask Me with Home selected); reuses exact public catalogue identity while preserving `/products/[slug]` | Find a store → open exact public offer evidence |
| Add to Shelf | `/me/shelf/add` | Shelf; search the canonical catalogue first and open a private request only when no identity matches | Search exact catalogue → focus the real catalogue field |
| Private request | `/me/shelf/request/[id]` | Shelf; inspect or manage one owner-isolated missing-product request without treating it as saved or canonical | Request another product → `/me/shelf/add` |

Account and future real helper destinations belong behind the customer avatar
in one modal helper sheet, not a popover or fifth destination. The current sheet
contains the private account identity, shared appearance control, public report
link, canonical Shelf export and confirmed clear, and Sign out. Private requests
are managed individually and are not counted by those canonical Shelf controls.
The sheet traps focus, closes by Escape/backdrop/control, restores avatar focus,
and is absent while closed. Product identity links inside Me open the member
product route; in-context Shelf mutation controls remain on their owning cards.
Public catalogue and product routes remain independently usable without a
customer session.

The production shell also requires one global **Report price or availability**
helper that reaches the existing public `/contribute` experience. It may live in
the extensible Account/helper sheet or a global context sheet; it is never a
fifth tab or a duplicate page FAB. The current helper links to plain
`/contribute` because its query handoff accepts a bounded product label as a
custom value, not an allowlisted canonical slug. Member
Product may pass an exact-product slug only after Public Experience adds and
tests that safe prefill in the public intake contract. A report remains
anonymous/community intake under its existing moderation, evidence, and privacy
boundary: being signed in never turns it into price, availability, product,
retailer, or clinical proof, and no Shelf/Routine/Concern state is attached. The
helper uses only the fields `/contribute` safely supports; it does not itself
add or imply a new structured availability field.

The primary navigation is exactly Home, Explore, Shelf, and Routine. Ask Me,
Product, Add to Shelf, and Private request are stack pages with a meaningful Back
destination and the correct parent destination selected in the persistent shell. Back belongs to the
shell's stable left dock slot, replaces the compact current-page orb, and never
appears as a primary tab or loose page-body control. Consult returns to Home.
Member Product returns to an allowlisted `from=home|explore|shelf|routine`
parent; missing, malformed, array, or external values fail closed to Home. Shelf
add and request detail return to Shelf. Do not add a navigation entry,
placeholder, or mutation until its destination and behavior are truthful.

## Workspace composition

The page order is:

1. one tab-specific question or answer;
2. concise reason or evidence;
3. one next decision;
4. supporting customer-owned context; and
5. history or configuration only when it helps the current task.

On warm customer canvases, content may use a restrained Italiana display
heading. Navigation, account chrome, controls, dock, labels, values, and status
use Manrope. Cream, paper, peach, blush, rose, wine, and warm ink remain the
palette. Operations mineral grey and `--ops-*` tokens are prohibited.

The [adaptive workspace dock](../design/ADAPTIVE_WORKSPACE_DOCK.md#view-anatomy)
owns expanded, compact, navigation, and single anatomy. Me supplies only the
active tab, truthful context, warm semantic palette, and exactly one page-owned
working FAB. The context capsule opens a route-owned summary sheet with truthful
counts and working shortcuts as context grows; it never mutates. A FAB may
navigate or focus a real field when no truthful mutation exists and always uses
an explicit accessible label.

## Adaptive behavior

The intended route evidence matrix is `390 × 844`, `600 × 900`, `1000 × 800`,
and `1440 × 900`, in light and dark, at the top, scrolled/contracted, and
navigation-revealed states. Geometry, scroll ownership, 320 px/200% text
behavior, focus, and accessibility-preference requirements live only in the
[dock evidence contract](../design/ADAPTIVE_WORKSPACE_DOCK.md#evidence-matrix).
The Me identity header consumes that same route-scoped scroll state: it restores
at top, route reset, upward travel, sheet open, or header focus and never owns a
second listener. Shelf and Routine keep compact single-column rows below 900 px;
their standalone route lists become two balanced columns at wider viewports,
while Home previews retain their editorial section composition.

## Current release boundary

- Any verified Neon identity receives baseline customer access; Operations
  authorization remains independent and additive.
- Every shared public page exposes one concise **Me** link in its desktop
  navigation and mobile menu, while the existing footer keeps the descriptive
  **My JeloCare** label. Each link goes directly to `/me`; signed-out customers
  continue through the server-owned `/sign-in?next=/me` redirect without public
  session checks.
- Production derives identity from the verified server session. The synthetic
  Amara presentation is server-only, requires development plus its explicit
  local flag, performs no network or database work, and fails closed elsewhere.
- Explore and member Product reuse current exact catalogue records and assets.
  Explore partitions the full eligible projection without a fixed client cap;
  all 59 products in the 2026-08-05 snapshot are reachable by browse or search,
  and add/retire fixtures prove the count follows publication state.
  A fresh price/store line may appear only through the existing public offer
  evidence boundary; absent or stale evidence is omitted.
- The global reporting helper is implemented as an Account-sheet link to plain
  `/contribute`; it sends no identity or private state.
- Shelf has one additive immutable-version store, owner-derived reads and
  mutations, lifecycle-aware unavailable rows, individual removal, export, and
  hard-delete clear. Private missing-product requests use a separate
  owner-isolated lifecycle and remain visibly distinct from saved canonical
  products; their optional photos remain private.
- The 2026-08-04 Shelf launch slice labels the entry **Add to your Shelf**,
  exposes the existing add action on every canonical search result, reserves
  **Request this missing product** for a zero-match search, and preserves focus
  and announcement when a changed or unavailable saved item is removed.
- Signed-out member Product routes preserve only the exact allowlisted
  `/me/product/[slug]?from=home|explore|shelf|routine` continuation through OTP;
  all other customer entry falls back to the bounded `/me` continuation.
- Private storage fails closed without the exact restricted Shelf database
  connection. Production activation remains an operator release, not a Vercel build side
  effect. The protected migrations, role audit, reviewed 5-Shelf/9-request
  import, deployment, and authenticated smoke remain incomplete. Request review
  closure and per-owner request/upload limits also remain incomplete.
- Routine persistence ships with owner-isolated named routines, 1–20 ordered
  steps, optimistic revision conflicts, and create/update/delete server actions.
  `/me/routine` now reads through its route-scoped model and renders one visual
  time-ordered sequence; create, reorder, edit, and delete remain inside the
  structured builder sheet. Canonical user-controlled
  Concerns remain unshipped and appear only in the local Synthetic Amara preview.
- Ask Me submits to the same deterministic, reviewed safety and guidance
  authority as public `/consult`; it creates no second recommendation engine
  and makes zero model calls. Saved Concerns and exact products from Shelf or
  Routine are excluded by default, may be included only through explicit
  per-session controls, are previewed before submission, and are never saved as
  a transcript. Product context contributes only canonical verified ingredient
  identifiers after the server revalidates each exact slug. Unknown Concern or
  product slugs are ignored. Public `/consult` remains account-free and keeps
  its existing request-protection authority.

## Production progression

The shipped-vs-missing baseline, dependency graph, per-phase owner and gates,
state coverage, critical path, migration boundaries, scorecard, and exactly one
next executable slice live only in the
[JeloCare Me production roadmap](./JELOCARE_ME_PRODUCTION_ROADMAP.md). In short,
Shelf persistence, Routine persistence, private product requests, complete
Explore, member-Product OTP continuation, and the global report helper now ship.
The deterministic authenticated Ask adapter also ships. User-controlled
canonical Concerns, true AI wording, account-keyed Ask rate limits, contextual
discovery, request operating closure and rate limits,
refill/basket decisions, notifications, and public community follow only through
their recorded gates. The current catalogue snapshot is evidence, never a
hard-coded limit.

## Future basket timing intelligence

JeloCare may eventually support an evidence-bound decision about when and where
to buy a basket of care products. This capability is not shipped, and this
contract does not commission a route, prediction, monitor, or notification.
Its dependency and release gates are owned by
[Phase 6 of the production roadmap](./JELOCARE_ME_PRODUCTION_ROADMAP.md#phase-6--refill-timing-and-basket-optimisation).

For example, a customer may need exact products A, B, C, and D. Their preferred
retailer usually carries all four, but currently has only A and B while another
retailer has C and D. The decision is not which item has the lowest price. It is
which truthful option best balances the **total landed basket cost** and the
customer's convenience: one or more quantity-adjusted basket totals, known
delivery fees or policies for each order, number of orders or pickups, urgency,
and acceptable wait. An unstated delivery fee is unknown, never zero.

The minimum decision inputs are:

- immutable exact product/version identity and verified store identity;
- timestamped stock and price observations for those exact offers, with the
  freshness of each observation;
- delivery-fee or delivery-policy evidence, including its source and freshness,
  or a fee explicitly supplied by the customer; and
- customer-provided quantities, urgency, refill intent or current-supply
  horizon, preferred retailer, and acceptable wait.

Only sufficiently fresh and consistent history can support a forecast. Restock
and stock-out estimates must be expressed as a probability or time window with
confidence and evidence freshness, never as a certain event or date. Monitoring
must consider both sides of waiting: C and D may return at the preferred store,
while its currently available A and B may deplete. Each material observation
must re-evaluate the options, including before A or B is likely to stock out.
Customer notifications require explicit opt-in and a separately commissioned
delivery and lifecycle contract.

The comparison may resolve to one of four truthful outcomes:

1. buy the complete basket from one store now, when that option exists;
2. split the basket across stores now;
3. wait and monitor the preferred store; or
4. buy urgent items now and monitor the rest.

Waiting is recommendable only when exact identity, history, fees, customer
intent, and forecast quality support it. If identity is ambiguous, history is
insufficient or stale, or delivery evidence is missing or stale, show the
current options, observation times, known cost components, and uncertainty.
Do not fabricate a fee or prediction, and do not recommend waiting.

The primary risks are false confidence, changing delivery fees, volatile
availability, and a missed restock window. The product must preserve per-user
privacy for basket, urgency, refill, monitoring, and notification data; it must
not use those signals for advertising or retailer ranking. It must make no
medical or clinical inference from a care-product choice, refill intent,
urgency, purchase timing, or response to a recommendation.

## Data and trust ceiling

JeloCare Me does not create clinical or commercial authority from customer
activity.

- A question, concern, save, or routine step is never a diagnosis, verified
  purchase, endorsement, product-safety decision, popularity signal, retailer
  ranking input, or availability claim.
- Future exact-product references preserve immutable identity and original
  provenance across merge, retirement, reformulation, or package change.
- A product successor is presented for an explicit customer decision; it never
  silently replaces a Shelf item or Routine step.
- Private contents do not feed advertising, retailer targeting, rankings,
  catalogue promotion, clinical training, community research, or model training.
- Public search, catalogue, product, concern, and evidence journeys stay usable
  without a customer account.

The concise security and lifecycle invariants are authoritative in
[ADR 0013](../adr/0013-founder-led-jelocare-me.md#privacy-and-security-invariants).
A data-bearing feature adds a focused, implementation-specific decision and
evidence rather than copying a speculative portal runbook.

## Implementation contract

Routes are thin adapters. A feature controller owns interaction and named
actions; a pure model owns derivation; a view renders semantic props; a server
service derives the authenticated owner and constrains every private query and
mutation. Shell scroll, reveal, context, and FAB state are route-scoped and
ephemeral.

This document is the canonical route, navigation, and filesystem ownership map:

- `app/(customer)/me/page.tsx` owns the thin Home adapter;
- `app/(customer)/me/[...route]/page.ts` owns the authenticated primary and
  stack route grammar and rejects unknown paths;
- `components/me/home/` owns portal composition and customer interaction;
- `components/me/shell/` owns Me destinations, parent semantics, and warm shell
  vocabulary;
- `lib/customer/` owns verified access plus server-only customer presentation;
  and
- `lib/workspace-shell/` with `components/workspace-shell/` owns neutral dock
  mechanics and rendering.

Routes remain thin adapters. The customer read boundary reuses canonical public
catalogue identity and offer-label logic; it does not copy product truth.

## Release non-goals

This release does not add customer seeds, catalogue writes, Routine mutation,
canonical Concern persistence, AI/model calls, reminders, notifications, cron,
queues, campaigns, retailer or courier workflows, or any change to `/ops`,
operator authorization, public product ownership, or public-route session ownership.

It also does not implement full provider-account deletion or a recovery-only
Shelf export path. Those lifecycle limits remain explicit in ADR 0014.

[ADR 0014](../adr/0014-customer-shelf-data-boundary.md) owns the Shelf fields,
owner/RLS contract, reviewed legacy import, retention, export, deletion,
recovery, and private-data exclusions.
