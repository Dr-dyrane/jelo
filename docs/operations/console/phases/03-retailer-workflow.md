# Phase 3: Retailer workflow and local tabs

## Outcome

Deliver the first justified local-tab workspace only when retailer applications and verification work are independent, authorized, URL-backed operational views.

## Why retailers are first

Retailer work naturally separates intake from evidence verification. That is a workflow distinction, not a visual preference. It can therefore earn local tabs once each view has a dedicated read model and clear operator responsibilities.

## Proposed workspace

```text
Retailers
Private partnership and verification work

Applications | Verification

Primary list or work queue
Selected application or verification record
```

The `Applications` and `Verification` labels are provisional. Keep the names only if they match the implemented responsibility and evidence model.

## Preconditions

Before tabs are implemented, all of the following must be true:

- Each view has an independent read model and query predicate.
- Each view is addressable through durable URL state.
- Operators can explain why an item appears in one view rather than the other.
- Role and action differences are explicit.
- The transfer between views is a tested, audited state transition rather than a hidden filtering trick.
- The mobile presentation remains useful without forcing two competing tab views above a narrow task.

## Tab contract

- The active tab uses a native accessible tab pattern only when it switches client-side sibling panels. Use links instead when it navigates to distinct route data.
- The active state is visible through tonal selection, `aria-current`, or correct tab semantics; colour alone is insufficient.
- Tab state is URL-backed and survives refresh, direct links, and browser navigation.
- Tabs are horizontal workspace navigation, never nested under a second expandable disclosure.
- An unavailable view is omitted or explained at the route level; do not show a disabled tab with hidden permission logic.
- Tabs do not replace filters. A filter narrows one view; a tab changes the operational responsibility or query.

## Responsive composition

| Viewport | Tab presentation | Working presentation |
| --- | --- | --- |
| Desktop | Inline tab row below page context. | List-detail workspace when both are useful. |
| Tablet | Same semantic tabs, compact row. | One primary pane or readable constrained split. |
| Mobile | Horizontal scrollable tab row only when both views are necessary. | One active view and one selected record task at a time. |

## Non-goals

- Do not add tabs to every queue for consistency.
- Do not create a generic settings area for retailer management.
- Do not promote a retailer or offer directly from an application without the accepted evidence and publication path.
- Do not use commerce, popularity, or health-shaped behavioural signals to rank applicants.

## Acceptance criteria

- An operator can link directly to each retailer workspace view.
- Each tab's query, empty state, and permitted actions are independently tested.
- Selection, focus, and browser Back preserve the operator's place.
- The same view identity is understandable at desktop, tablet, and mobile even when its layout differs.
- Any change from application to verification creates the required attributable audit evidence.
