# ADR 0013: Founder-led JeloCare Me

- **Status:** Accepted; first customer portal release
- **Date:** 2026-08-03
- **Decision owner:** Founder
- **Supersedes:** [ADR 0012](0012-private-member-shelf-and-routine-portal.md)
- **Preserves:** [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) for reminders, notifications, stock alerts, public stories, ratings, comments, reactions, profiles, and community features

## Outcome

JeloCare establishes one founder-led customer workspace, **JeloCare Me**, at
the authenticated `/me` route family. Its primary destinations are Home,
Explore, Shelf, and Routine. Ask Me and member Product are pushed stack pages;
Account remains avatar-owned chrome.

The current release ships the real routes, verified-session boundary, exact
catalogue presentation, and neutral adaptive dock. It does **not** create a
customer-role table, private-data migration, catalogue mutation, AI answer,
analytics feed, or Shelf/Routine persistence.

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
| `customer` | `/me` | Own private Me state and actions; no operator privilege |
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

The canonical route map, parent-tab behavior, and component ownership live only
in [JeloCare Me](../product/JELOCARE_ME.md#information-architecture). This ADR
owns the authority boundary: primary destinations are persistent shell
navigation, stack pages preserve their parent, and Account is never a tab.

At the top of a compact workspace, the dock is expanded: a non-mutating context
capsule sits above the four-tab navigation and separate primary-action FAB. When
scroll direction crosses the governed hysteresis, the dock contracts to the
current-page orb, the same context capsule, and the FAB. The orb reveals the
complete navigation in the same row and moves focus to the current tab. The FAB
alone owns the page's primary domain mutation; the context capsule never
mutates data.

## Filesystem and code canon

The canonical topology is maintained in the [JeloCare Me implementation
contract](../product/JELOCARE_ME.md#implementation-contract). This ADR retains
the binding separation of concerns without duplicating its paths.

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

## First-release acceptance

The release is complete when:

- current canon records the roles, route map, navigation, filesystem, code, and
  privacy boundaries without duplicating route ownership;
- the neutral dock exports `AdaptiveWorkspaceDock` and `DockContextDescriptor`,
  an exact-route FAB registration contract, a pure four-mode resolver, and pure
  scroll hysteresis;
- the Me adapter contains Home/Explore/Shelf/Routine navigation, truthful stack
  semantics, and warm customer styling while Account remains avatar-owned;
- the old member gate verifier, blocked G0 record, and duplicated member privacy
  runbooks are removed from source and release commands;
- focused model, navigation, FAB, accessibility/source, owner-isolation, docs,
  test, type, lint, release, and build gates pass; and
- no customer-role migration, queue, campaign, catalogue mutation, or Ops
  contract change is present.

## Rollback

Revert the customer route adapters, portal/read-model composition, Me shell
adapter, and focused contracts while preserving the neutral dock, existing
operator authentication, and public product routes. No data repair or migration
is required.
