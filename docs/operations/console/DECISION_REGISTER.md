# Operations console decision register

Use this register before starting a console increment. A developer may implement a documented phase only when its governing decisions are accepted and its data and safety prerequisites exist.

## Accepted decisions

| Decision | Governs | Delivery consequence |
| --- | --- | --- |
| [ADR 0001](../../adr/0001-deferred-trust-collections-community-and-stock-alerts.md) | Public trust boundary and re-entry gates | The console stays private; no console work opens public accounts, comments, ratings, stories, alerts, or other deferred features. |
| [ADR 0002](../../adr/0002-anonymous-community-knowledge-intake.md) | Community reports and canonical promotion boundary | Community input is evidence for review, never publication by itself. |
| [ADR 0003](../../adr/0003-retailer-partnership-intake.md) | Retailer applications | Retailer intake remains private until a deliberate, evidence-backed publication path exists. |
| [ADR 0005](../../adr/0005-structured-observation-events.md) | Observations and measurement | Community observations and commerce signals are private inputs; health-shaped behaviour is never used for commerce ranking. |
| [ADR 0006](../../adr/0006-store-ranking-excludes-commercial-signals.md) | Store ranking | Console measurement cannot create a commercial or popularity ranking signal. |
| [ADR 0007](../../adr/0007-internal-moderation-operations-console.md) | Console architecture, auth, audit, and shell | Access is allowlisted, decisions are attributable, and the private shell is separate from public routes. |

## Decisions already represented in the delivery plan

| Area | Current decision | Implement in |
| --- | --- | --- |
| Adaptive workspace composition | Reuse semantic slots and interaction contracts; do not scale one desktop split into every viewport. | [Workspace frame](./phases/01-workspace-frame.md) |
| Local tabs | Use only for sibling views with distinct URL-backed queries or workflow responsibilities. | [Retailer workflow](./phases/03-retailer-workflow.md) |
| Triage decision feedback | Use guarded actions, attributable rationale, pending/success/error feedback, and a refreshed read model. | [Triage workflows](./phases/02-triage-workflows.md) |
| Operator administration | Read-only visibility ships before access mutation. | [Governance and reliability](./phases/04-governance-and-reliability.md) |

## New ADR required before implementation

Create a new ADR in `docs/adr/` and link it from the handbook before implementing any of the following:

| Proposed decision | Why an ADR is required | Minimum questions to resolve |
| --- | --- | --- |
| Canonical promotion execution | It changes how evidence-backed moderation affects published data. | Which actions can promote which records? Which existing gate runs? What is the rollback path? What audit evidence is required? |
| Operator access lifecycle | It creates or revokes privileged access. | Who can invite, deactivate, or change roles? What approval and audit trail are required? How is emergency access handled? |
| Assignment, claims, or service-level ownership | It changes queue accountability and work allocation. | Is ownership advisory or exclusive? When does a claim expire? How are conflicts and reassignment handled? |
| Retention, export, or redaction of moderation records | It affects private operational data handling. | What is retained, for how long, who may export it, and how are redactions recorded? |
| New measurement aggregation or operator analytics | It could broaden behavioural data use. | What is aggregated, what is excluded, who may access it, and can it influence public ranking? |

## ADR writing rule

An ADR records a durable architectural or trust decision, not an implementation preference. If a decision can be safely reversed inside one component without changing data ownership, permissions, public trust, or operating policy, keep it in the relevant phase playbook instead.
