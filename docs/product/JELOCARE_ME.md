# JeloCare Me

Updated: 2026-08-03

JeloCare Me is the authenticated customer workspace for asking, discovering,
saving, and organising care. Its first release ships the real `/me` route
family, verified-session guard, warm adaptive shell, truthful empty states, and
a development-only synthetic presentation. Shelf and Routine persistence and
AI-generated guidance are not part of this release.

[ADR 0013](../adr/0013-founder-led-jelocare-me.md) owns the decision and code
boundaries. The [adaptive workspace dock](../design/ADAPTIVE_WORKSPACE_DOCK.md)
owns the shell mechanics. This file owns product purpose, vocabulary, and
feature progression.

## The customer goal

One workspace should answer: **What should I understand or do for my care now?**

Home begins with one Ask Me entry rather than a dashboard. Explore keeps member
catalogue discovery separate from customer-owned Shelf and Routine context.
Evidence and exact products carry the experience; controls do not compete with
them. JeloCare Me remains continuous with JeloCare's public warmth while
becoming quieter and more task-led.

## Information architecture

| Primary destination | Canonical route | Customer job | Page-owned FAB |
| --- | --- | --- | --- |
| Home | `/me` | Return to the customer's care overview and Ask Me entry | Ask Me → `/me/consult` |
| Explore | `/me/explore` | Discover exact reviewed catalogue products without treating them as owned | Search products → focus the real catalogue field |
| Shelf | `/me/shelf` | Retrieve and organise intentionally saved exact products | Explore products → `/me/explore` |
| Routine | `/me/routine` | Arrange a customer-authored routine without turning it into a prescription | Explore products → `/me/explore` until routine mutation ships |

Two authenticated stack pages sit above that primary model:

| Stack page | Canonical route | Parent semantics | Page-owned FAB |
| --- | --- | --- | --- |
| Ask Me | `/me/consult` | Home; combines the guidance entry and customer concern context without reusing public `/consult` state | Search your care → focus the real care field |
| Member product | `/me/product/[slug]` | The originating primary destination (or Ask Me with Home selected); reuses exact public catalogue identity while preserving `/products/[slug]` | View public product evidence → matching `/products/[slug]` |

Account and future real helper destinations belong behind the customer avatar
in one modal helper sheet, not a popover or fifth destination. The current sheet
contains only the private account identity, the shared appearance control, and
Sign out. It traps focus, closes by Escape/backdrop/control, restores avatar
focus, and is absent while closed. Every visible product action inside Me opens
the member product route. Public catalogue and product routes remain
independently usable without a customer session.

The primary navigation is exactly Home, Explore, Shelf, and Routine. Ask Me and
Product are stack pages with a meaningful Back destination and the correct
parent destination selected in the persistent shell. Do not add a navigation
entry, placeholder, or mutation until its destination and behavior are truthful.

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
working FAB. The capsule never mutates; a FAB may navigate or focus a real field
when no truthful mutation exists and always uses an explicit accessible label.

## Adaptive behavior

The intended route evidence matrix is `390 × 844`, `600 × 900`, `1000 × 800`,
and `1440 × 900`, in light and dark, at the top, scrolled/contracted, and
navigation-revealed states. Geometry, scroll ownership, 320 px/200% text
behavior, focus, and accessibility-preference requirements live only in the
[dock evidence contract](../design/ADAPTIVE_WORKSPACE_DOCK.md#evidence-matrix).
The Me identity header consumes that same route-scoped scroll state: it restores
at top, route reset, upward travel, sheet open, or header focus and never owns a
second listener.

## Current release boundary

- Any verified Neon identity receives baseline customer access; Operations
  authorization remains independent and additive.
- Production derives identity from the verified server session. The synthetic
  Amara presentation is server-only, requires development plus its explicit
  local flag, performs no network or database work, and fails closed elsewhere.
- Explore and member Product reuse current exact catalogue records and assets.
  A fresh price/store line may appear only through the existing public offer
  evidence boundary; absent or stale evidence is omitted.
- Shelf and Routine render persisted customer data when it exists and otherwise
  show honest empty states. The development presentation is not persistence.
- Ask Me supports truthful discovery over customer context and exact products;
  it does not claim an AI answer, consultation submission, or saved mutation.

## Future basket timing intelligence

JeloCare may eventually support an evidence-bound decision about when and where
to buy a basket of care products. This capability is not shipped, and this
contract does not commission a route, prediction, monitor, or notification.

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

This release does not add customer-role schema, migrations, seeds, catalogue
writes, Shelf/Routine mutation, AI/model calls, reminders, notifications, cron,
queues, campaigns, retailer or courier workflows, or any change to `/ops`,
operator authorization, public navigation, or public product ownership.
