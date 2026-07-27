# Phase 4: Governance and reliability

## Outcome

Make the console safe to operate repeatedly by clarifying access, accountability, failure response, and release verification. This phase strengthens real operational ownership without expanding into an unsafe generic admin surface.

## Scope

- Replace UI-only operator summary fixtures with a production read model when the required data is ready.
- Improve decision-history filtering only when filters are backed by stable queries and URLs.
- Document and exercise responses to denied access, failed actions, and audit inconsistencies.
- Review console release readiness across desktop, tablet, and mobile task flows.
- Operate the accepted email-invitation and access-lifecycle boundary without creating a generic settings surface.

## Operator visibility

The operator directory shows identity, role, active state, and activity summaries that the viewer is authorized to read. Admin access changes use one contextual inspector, not a generic settings page. A pending invitation is not an operator and grants no access. Activation occurs only after Neon Auth verifies the exact invited mailbox. Role changes, pause, restore, resend, and revoke are separately audited; self-demotion, self-deactivation, duplicates, and removal of the last active admin are rejected by the server.

## Reliability scenarios

| Scenario | Required response |
| --- | --- |
| Operator denied console access | Return the existing deny-by-default result without leaking queue data; follow the access runbook. |
| Operator lacks a capability | Hide unavailable controls and enforce the restriction server-side. |
| Decision validation fails | Preserve safe input, identify the conflict, and leave the underlying record unchanged. |
| Decision transaction fails | Report failure without claiming an audit entry or state transition exists; allow a safe retry. |
| Audit inconsistency is suspected | Stop related operation, preserve evidence, and investigate before corrective action. |
| Read model is unavailable | Show an honest recoverable error state; do not render stale activity as current fact. |
| Access-lifecycle migration is not ready | Keep the existing team directory readable, show that updates are not ready, and fail every mutation closed. |
| Invitation email fails | Keep the pending invitation, record the failed delivery, and offer an explicit retry without claiming the email was sent. |

## Required documentation and tests

- Add the console-specific response steps to the appropriate operations runbook when a real failure mode is introduced.
- Add architecture tests for every new action boundary and fail-closed authorization path.
- Add focused tests for audit idempotency, stale state, and role restrictions where applicable.
- Keep activity and operator summaries clearly labelled as derived read data, never authoritative access proof.

## Release checklist

Before a console workflow is considered operationally ready:

1. Confirm its governing ADRs and task packet are complete.
2. Confirm the route has deny-by-default access and explicit capability checks.
3. Confirm every consequential action has validation, audit attribution, idempotency behavior, and honest failure feedback.
4. Run `npm run validate` and relevant focused tests.
5. Browser-review the normal, empty, loading, denied, error, success, retry, and return paths at desktop, tablet, and mobile compositions.
6. Update the roadmap, phase document, and nearest runbook with the actual shipped state and remaining deferrals.

## Explicit boundary

Emergency access outside the accepted invitation lifecycle, retention changes, exports, and audit correction each require a further accepted decision. Operator invitations and normal role/active-state changes remain bounded by ADR 0007 increment 5.
