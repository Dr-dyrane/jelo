# Phase 2: Triage workflows

## Outcome

Deliver one complete, safe moderation workflow from queue discovery through record review, guarded decision, audit entry, and visible result. Repeat the pattern queue by queue only after the first workflow passes review.

## Representative first workflow

Start with observations unless a narrower, fully specified queue is available. Observation review already has a bounded read model and must remain distinct from canonical offer or product publication.

## Required operator journey

1. An allowed operator opens a queue and understands its purpose and count.
2. The operator selects one record without losing the queue position.
3. The detail view exposes only the evidence relevant to an allowed decision.
4. The operator chooses an allowed action and supplies rationale where the action requires it.
5. The server validates identity, role, input, and current record state.
6. The system records one attributable audit event and returns an honest result.
7. The workspace refreshes or transitions predictably; the operator sees what changed and can continue work.

## Data and action boundary

- Read models may join moderation records with private supporting identity where authorized.
- Action inputs use the existing strict moderation schemas.
- Authorization uses the existing active-operator and capability boundary.
- The audit row is part of the decision transaction.
- The workflow must not directly mutate a canonical catalogue record.
- If a requested decision needs canonical promotion, stop and create the ADR identified in the [decision register](../DECISION_REGISTER.md).

## UI state contract

| State | Operator experience |
| --- | --- |
| Loading | Stable context and an honest pending indicator; no false empty state. |
| Empty | Explain that no items need review and preserve queue purpose. |
| Selected | Show evidence, source context, allowed actions, and decision requirements. |
| Submitting | Disable duplicate submission while preserving visible intent. |
| Success | State the completed action, update the record or queue, and move focus intentionally. |
| Validation failure | Keep safe input, identify the field or state conflict, and do not claim success. |
| Permission denied | Do not reveal unavailable action controls; fail closed server-side as well. |
| Network or server error | Preserve safe draft rationale, give retry guidance, and prevent ambiguous repeat submissions. |

## Responsive composition

- **Desktop:** queue and selected detail may coexist when both remain legible.
- **Tablet:** choose a constrained split only when evidence remains readable; otherwise open the selected record in a temporary detail route or sheet.
- **Mobile:** open detail as its own task. Decision controls remain full-width and place the rationale before the consequential action.

Never make a destructive or consequential decision dependent on a hover-only affordance, a hidden swipe gesture, or a compressed multi-column layout.

## Acceptance criteria

- Decision action availability matches the capability model in both UI and server enforcement.
- Repeated submission cannot create duplicate audit events for one intended action.
- The audit ledger displays the completed decision with the correct actor and target.
- Error and stale-record behavior is tested, not inferred.
- The workflow has no path from an untrusted report to direct canonical publication.
- Browser review confirms keyboard focus, detail return path, and all state transitions at each released viewport.

## Rollout sequence

1. Observations.
2. Contributions.
3. Edges.
4. Vocabulary.
5. Retailer applications, coordinated with Phase 3.

Do not merge a queue into this sequence merely because it has a list page. Each queue must have its own evidence, allowed action, and test plan.
