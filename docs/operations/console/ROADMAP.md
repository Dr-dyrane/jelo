# Operations console roadmap

The roadmap is ordered by safety and dependency. Complete one phase's exit criteria before beginning the next. A phase may be split into small pull requests, but its safety boundary may not be bypassed to make a screen appear complete.

## Delivery principles

- Build one real workflow at a time, from read model to interaction to audited outcome.
- Prefer a narrow vertical slice over a broad visual mock.
- Keep the public application unchanged unless an accepted ADR explicitly says otherwise.
- Reuse domain contracts and semantic UI slots, not desktop markup or breakpoint-specific CSS indiscriminately.
- Treat empty, loading, denied, error, and retry states as part of every feature.

## Phase 0 — Safety spine and shell

**Status:** shipped.

**Outcome:** a private, allowlisted console with an independent private-shell visual system, role-aware navigation, queue read models, decision history, and operator visibility.

**Evidence:** [ADR 0007](../../adr/0007-internal-moderation-operations-console.md), [Operations shell](../../design/OPS_SHELL.md), and the current routes under `app/(ops)/`.

## Phase 1 — Adaptive workspace frame

**Status:** shipped.

**Outcome:** a reusable workspace frame with page context, optional local tabs, a primary working plane, and an optional record-detail slot.

**Evidence:** the shell now owns replaceable workspace and detail slots, with a
docked desktop inspector, tablet side sheet, mobile bottom sheet, shared
selection context, and route-owned loading, empty, error, and decision states.

**Exit criteria:**

- A workspace frame owns no queue query, action, or role rule.
- Page context, tabs, list, and detail are replaceable slots.
- Desktop list-detail work remains readable at normal width and 200% zoom.
- Tablet and mobile have explicit intended compositions, even if their implementation is deferred to a later slice.
- Keyboard focus, selected-record URL state, and empty/error states are designed before a second queue adopts the frame.

See [Workspace frame](./phases/01-workspace-frame.md).

## Phase 2 — One representative triage workflow

**Status:** shipped.

**Outcome:** an operator can review one real queue item, inspect its evidence, record an allowed decision with rationale, and see the resulting state without leaving the queue.

**Reference workflow:** observations, because its read model and decision
boundaries are narrow, explicit, and covered by the shared shell and route
contracts.

**Exit criteria:**

- The selected record is independently addressable by URL.
- All actions use the existing authorization and validation boundary.
- A successful action records an audit row exactly once and refreshes the affected workspace state.
- Failure preserves operator input where safe, gives actionable feedback, and never implies a decision succeeded.
- Architecture tests prove that no new action writes canonical records directly.

See [Triage workflows](./phases/02-triage-workflows.md).

## Phase 3 — Queue coverage and local workflow views

**Status:** in progress.

**Outcome:** the workspace frame is adopted by the remaining queues only after their evidence and permitted actions are individually defined.

**Order:** contributions, edges, vocabulary, retailer applications, then commerce signals. Do not batch all queues into one generic detail component.

**Tab rule:** the first tabbed workspace is retailer workflow only after applications and verification are independent, URL-backed read models. Other queues remain single-view until their actual workflow state exists.

See [Retailer workflow](./phases/03-retailer-workflow.md).

## Phase 4 — Governance and operational readiness

**Status:** in progress.

**Outcome:** operators and administrators can understand access, accountability, and console health without introducing an unsafe generic settings area.

**Exit criteria:**

- Operator directory uses production read data rather than a UI fixture.
- Access begins with a pending email invitation and only activates after exact-mailbox Neon Auth verification.
- Role and active-state changes are admin-only, protected against self-lockout and last-admin removal, and written to a separate append-only audit.
- Pre-migration reads remain available while access mutations fail closed.
- Decision history supports durable filters only when the query and URL contract exist.
- Browser review covers desktop, tablet, and mobile task completion for every released workflow.
- The runbook identifies the ownership and safe response for denied access, action failure, and audit inconsistency.

See [Governance and reliability](./phases/04-governance-and-reliability.md).

## Explicitly deferred

- Canonical promotion execution without a new ADR.
- Emergency or break-glass access outside the accepted invitation lifecycle.
- Generic profile or settings screens without a real owned data contract.
- Collapsible sidebar groups until console destination scale and evidence justify them.
- Decorative tabs, dashboards, or generic admin widgets.
