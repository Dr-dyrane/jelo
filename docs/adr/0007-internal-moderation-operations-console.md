# ADR 0007: Internal moderation and operations console

Status: Proposed (design); awaiting founder acceptance, build sequenced

Date: 2026-07-24

## Context

Three accepted ADRs converge on the same missing capability, and none of them decides it:

- **[ADR 0002](0002-anonymous-community-knowledge-intake.md)** leaves community contributions, `community_knowledge_edges`, and `community_moderation_values` `pending` "until an authenticated moderation system exists." Review is operator-only through controlled database tooling.
- **[ADR 0005](0005-structured-observation-events.md)** adds `community_observations` (first-class price and outcome rows) as a moderation input, deepening that queue, plus a `store_click` `commerce_events` stream that needs a private aggregation surface.
- **[ADR 0003](0003-retailer-partnership-intake.md)** produces private retailer applications that need a review queue before canonical retailer or offer publication.

Today all four queues are worked by hand in the database. Authentication is provisioned at the infrastructure level but is deliberately absent from the public surface ([ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md)). Without a console the intake and observation pipelines accumulate data no one can triage at scale, and every promotion to a canonical record is a manual SQL action with no audit trail. This is also a precondition for reopening ADR 0001 (its re-entry gate #6 requires an owned moderation operating model).

## Decision

Build an internal, authenticated moderation and operations console as a surface separate from the public application. First release scope:

1. **Read and triage queues** for: community contributions and knowledge edges (`pending` / `community_reported`), `community_observations` (price and outcome), `community_moderation_values` (custom vocabulary), and retailer partnership applications.
2. **Promotion stays gated and attributable.** Turning any submission into a canonical record (product, brand, retailer, offer, concern, ingredient, alias, or clinical relation) remains an explicit moderation action that passes the existing evidence gates. The console records actor, timestamp, and rationale in an audit log and never bypasses a gate — it enforces the [ADR 0002](0002-anonymous-community-knowledge-intake.md) trust boundary and the [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) rule that popularity is never a proxy for safety, authenticity, or authorization.
3. **A private, measurement-only analytics view** over `commerce_events` (`store_click` `priceRank` / `position`) and the existing `community:research:signals` report. Never joined to health-shaped behaviour and never fed back into store ranking ([ADR 0005](0005-structured-observation-events.md) + [ADR 0006](0006-store-ranking-excludes-commercial-signals.md)).
4. **Access is gated by the provisioned authentication.** The console is not linked from, or reachable through, the public product, concern, or Ask Jelo surfaces.

## Consequences

- The intake, observation, and partnership pipelines become operable at scale instead of operator-only database tooling.
- Moderation actions become auditable and attributable — a precondition several ADR 0001 re-entry gates name (owned moderation model, privacy and audit reviews).
- New dependencies to specify in the build phase: authenticated internal session handling, an audit-log table, and role / permission scoping.
- It does **not** authorize any public community feature. [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) stays in force: no public accounts, ratings, comments, stories, or alerts. This is an internal operations tool only.

## Alternatives rejected

- **Continue operator-only database tooling.** Does not scale, leaves no audit trail, and makes every canonical promotion an error-prone manual query.
- **Fold moderation into the public app behind a flag.** Mixes a privileged internal surface with the public trust boundary; the public surfaces stay account-free and health-data-minimal.
- **One generic admin that edits canonical records directly.** Rejected: promotions must pass the same evidence gates as any other; direct canonical edits would bypass the ADR 0002 trust boundary and the catalogue publication gate.
