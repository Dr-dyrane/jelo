# Operations console delivery

This is the delivery entry point for JeloCare's internal moderation and operations console. It turns the accepted security boundary into an ordered, reviewable implementation programme. Its current interface patterns remain candidates until product review accepts them.

The console exists to turn private community, retailer, and commerce signals into careful, attributable operational work. It is not a generic administration product and is never part of the public application surface.

## Read in this order

1. [Decision register](./DECISION_REGISTER.md) maps every phase to the governing ADR and identifies decisions that need a new ADR before implementation.
2. [Roadmap](./ROADMAP.md) orders work by dependency and defines exit criteria.
3. [Operations shell](../../design/OPS_SHELL.md) defines the native three-column shell and responsive pane behavior.
4. [Operations UI candidate contract](../../OPS_UI_CANON.md) defines the Observations work grammar currently being tested: semantic rows, inspector, media, and overlay rules.
5. [Operations interface and Overview contract](../../adr/0010-operations-interface-and-overview-contract.md) defines the product voice, queue-level Overview inspector, and data-story rules.
6. [Delivery harness](./DELIVERY_HARNESS.md) is the repeatable planning, implementation, review, and handoff loop.
7. [Workspace frame](./phases/01-workspace-frame.md) specifies the reusable content-area contract.
8. [Triage workflows](./phases/02-triage-workflows.md) sequences queue detail and guarded decisions.
9. [Retailer workflow](./phases/03-retailer-workflow.md) defines the first justified local-tab workflow.
10. [Governance and reliability](./phases/04-governance-and-reliability.md) covers operator access, accountability, and operational readiness.

## Current position

The console safety spine, authentication integration, role-aware navigation,
decision history, and read-only operator directory are shipped. Every new
operations route now starts from the native split-view contract: sidebar → main
workspace → contextual inspector on desktop; right side sheet on tablet;
bottom sheet on mobile/touch. Observations is the current record-triage
reference candidate; Overview tests the same grammar at queue level without
becoming a dashboard or a second record-triage route.

## Operating invariants

- The console is deny-by-default and inaccessible from public product surfaces.
- Operator identity, access, and every consequential decision remain attributable.
- A console action does not directly mutate canonical catalogue records unless an explicit, audited transition authorizes it.
- Queue data, decisions, and access management have separate read and write contracts.
- The sidebar is top-level console navigation. Local tabs are sibling views within one workspace destination.
- Shared workspace components reuse semantic responsibilities and data contracts. Desktop, tablet, and mobile receive deliberately different compositions when their available space changes the task.
- Each increment is independently useful, independently reviewable, and idempotent when rerun against the same state.

## Authority

[ADR 0007](../../adr/0007-internal-moderation-operations-console.md) defines the console boundary. The code in `lib/moderation/`, `app/(ops)/`, and `components/ops/` is the current implementation authority. This plan describes intended delivery; it never overrides a checked-in gate, an accepted ADR, or a database migration.
