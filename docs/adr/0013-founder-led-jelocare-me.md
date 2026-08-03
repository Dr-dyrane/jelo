# ADR 0013: Founder-led JeloCare Me

- **Status:** Accepted; foundation only
- **Date:** 2026-08-03
- **Decision owner:** Founder
- **Supersedes:** [ADR 0012](0012-private-member-shelf-and-routine-portal.md)
- **Preserves:** [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) for reminders, notifications, stock alerts, public stories, ratings, comments, reactions, profiles, and community features

## Outcome

JeloCare will establish one founder-led customer workspace, **JeloCare Me**, at
the future `/me` route family. `/me` means **Ask**, and its four product tabs
are **Ask**, **Concerns**, **Shelf**, and **Routine**. Account actions live
behind the customer avatar rather than becoming a fifth product tab.

This decision ships the product, filesystem, design, and neutral workspace-dock
foundation. It does **not** create `/me` routes, customer authentication,
customer tables, private records, analytics, AI behavior, catalogue mutations,
or Shelf/Routine persistence.

The complete product contract is [JeloCare Me](../product/JELOCARE_ME.md). The
dock mechanics are owned by the [adaptive workspace dock](../design/ADAPTIVE_WORKSPACE_DOCK.md).

## Why the earlier portal contract is superseded

ADR 0012 correctly required private customer data to remain owner-isolated and
separate from Operations. It incorrectly made a speculative nine-approver gate,
duplicated lifecycle runbooks, standalone `/shelf` and `/routines` destinations,
and a large future organisation the product architecture.

Departments are code and decision boundaries, not a requirement to staff nine
human approval roles before the founder can establish a customer experience.
Review depth remains proportional to the feature actually being released. A
future data-bearing feature must satisfy applicable privacy, security, clinical,
accessibility, and operational evidence; it must not revive the rejected G0
contract or claim that a documentation signature matrix is a deployed control.

## Product roles

JeloCare has four durable product roles:

| Role | Primary surface | Authority boundary |
| --- | --- | --- |
| `admin` | Existing `/ops` | Moderation and operational authority only; never customer ownership |
| `customer` | Future `/me` | Own private Me state and actions; no operator privilege |
| `retailer` | Future retailer route | Own retailer submissions and business-managed records only |
| `courier` | Future courier route | Own delivery tasks and status only |

Identity-provider reuse does not copy authority. Every future server lookup of
private customer, retailer, or courier data must derive the authenticated owner
server-side and constrain the query by that owner. A client-provided owner ID is
data, never permission. Missing, ambiguous, disabled, or cross-role ownership
fails closed.

The existing `/ops` contract, operator guards, roles, visual system, and route
behavior are unchanged by this ADR.

## Navigation and shell decision

The future route map is:

| Tab | Route | Job |
| --- | --- | --- |
| Ask | `/me` | Ask one care question and understand the grounded answer |
| Concerns | `/me/concerns` | Review customer-owned concern context without diagnosing |
| Shelf | `/me/shelf` | Retrieve exact products the customer intentionally saved |
| Routine | `/me/routine` | Organise a customer-authored routine without turning it into a prescription |

These paths are a navigation contract, not a claim that routes exist.

At the top of a compact workspace, the dock is expanded: a non-mutating context
capsule sits above the four-tab navigation and separate primary-action FAB. When
scroll direction crosses the governed hysteresis, the dock contracts to the
current-page orb, the same context capsule, and the FAB. The orb reveals the
complete navigation in the same row and moves focus to the current tab. The FAB
alone owns the page's primary domain mutation; the context capsule never
mutates data.

## Filesystem and code canon

The repository separates reasons to change:

```text
lib/workspace-shell/
  pure geometry, mode, scroll, route matching, and owner-token registries

components/workspace-shell/
  neutral controller, provider, view, navigation, context, FAB, and material

components/me/shell/
  thin JeloCare Me navigation and palette adapters

future feature implementation, only when commissioned:
  app/.../me/                 thin route adapters
  components/me/<feature>/    feature controller, model, and view
  lib/me/<feature>/           server owner-isolated service and pure domain rules
```

Do not create empty feature folders. Add a directory only with the first real
file that owns a current reason to change.

The following rules are binding:

1. Derivation is pure. Route matching, dock mode, scroll hysteresis, eligibility,
   filtering, ordering, and view-model construction are testable without React,
   the router, storage, or a network.
2. Routes adapt framework inputs to a feature controller. They do not own domain
   rules, database access, or a second view implementation.
3. Controllers coordinate ephemeral interaction and invoke named domain actions.
   Models derive state. Views render semantic props. Do not collapse all four
   responsibilities into a route component.
4. Server services derive and enforce the authenticated owner. Client state may
   improve interaction but never authorises a read or mutation.
5. Shell state is route-scoped and ephemeral. Navigation reveal, scroll direction,
   context, and FAB registration reset on route change and are never persisted as
   customer data.
6. FAB registration is exact-owner and exact-route. Cleanup removes only the token
   that created a registration, so an old unmount cannot erase a newer action.
7. Split code by reason to change, not by arbitrary line count. Share mechanics;
   keep Me vocabulary and future feature policy in their owning adapters.
8. Docs link to this ADR, the product contract, or the dock contract instead of
   restating their rules.

## Privacy and security invariants

No customer data is introduced by this foundation. When a later slice proposes
data, its focused decision and tests must preserve these invariants:

- public evidence journeys remain account-free unless a later accepted decision
  explicitly changes that boundary;
- private customer content is owner-isolated at both service and datastore
  boundaries and is never readable through `/ops`, catalogue, retailer, courier,
  public cache, analytics, or shared logs;
- customer identity never grants admin, retailer, or courier authority, and those
  roles never grant customer ownership;
- private concerns, Shelf, and Routine contents are not used for advertising,
  retailer targeting, ranking, clinical authority, or model training;
- secrets, sessions, recovery material, private payloads, and direct identifiers
  stay out of URLs, client analytics, logs, screenshots, and support transcripts;
- destructive lifecycle work requires explicit retention, export, deletion,
  restore, incident, and rollback behavior before its schema or production data
  collection ships; and
- health-shaped language remains educational and non-diagnostic, with existing
  safety escalation authority preserved.

## Foundation acceptance

The foundation is complete when:

- current canon records the roles, route map, navigation, filesystem, code, and
  privacy boundaries above;
- the neutral dock exports `AdaptiveWorkspaceDock` and `DockContextDescriptor`,
  an exact-route FAB registration contract, a pure four-mode resolver, and pure
  scroll hysteresis;
- the Me adapter contains only Ask/Concerns/Shelf/Routine vocabulary and warm
  customer styling while account remains avatar-owned;
- the old member gate verifier, blocked G0 record, and duplicated member privacy
  runbooks are removed from source and release commands;
- focused model, navigation, FAB, accessibility/source, owner-isolation, docs,
  test, type, lint, release, and build gates pass; and
- no `/me` route, customer record, migration, queue, campaign, or Ops change is
  present.

## Rollback

One foundation commit owns this change. Reverting that commit restores ADR 0012
and its gate artifacts. The neutral primitive is unused by production routes, so
rollback requires no data repair, route redirect, migration, or customer action.
