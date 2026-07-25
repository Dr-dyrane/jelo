# Operations console delivery harness

This harness makes each console increment deterministic enough for a junior developer or coding agent to execute, while preserving room for local design judgment inside explicit boundaries.

## The loop

Every increment follows the same loop:

1. **Orchestrate:** select one roadmap outcome and create a task packet.
2. **Plan:** confirm the governing ADR, read model, action boundary, responsive composition, and acceptance criteria.
3. **Implement:** make the smallest vertical slice that satisfies the packet.
4. **Review:** inspect security, data ownership, UX states, accessibility, and visual fit separately.
5. **Validate:** run the required automated and browser gates.
6. **Record:** update the nearest implementation doc, roadmap status, and ADR build status when the durable architecture changed.
7. **Commit:** stage explicit paths only after review.

Do not skip from a mock screen to a broad generic abstraction. The loop exists to keep the console trustworthy as it grows.

## Task packet

Create one task packet before editing. It may live in a pull request description, issue, or handoff message; do not create a permanent planning file for every small task.

```text
Title:
Roadmap phase and outcome:
Governing ADRs and documents:
User and role:
Queue or operational data involved:
Read model and source of truth:
Allowed actions:
Forbidden actions:
Desktop composition:
Tablet composition:
Mobile composition:
URL and selection state:
Loading, empty, denied, error, success, retry, and undo behavior:
Accessibility requirements:
Files expected to change:
Required tests and commands:
Acceptance criteria:
Explicit deferrals:
```

A packet is incomplete if it cannot answer: "What data changes, who is allowed to cause it, how is it audited, and what does the operator see when it fails?"

## Context pack

Before planning, read only the documents and code relevant to the packet:

1. This harness and the [roadmap](./ROADMAP.md).
2. The applicable row in the [decision register](./DECISION_REGISTER.md).
3. [ADR 0007](../../adr/0007-internal-moderation-operations-console.md), plus every ADR named by the packet.
4. [Operations shell](../../design/OPS_SHELL.md) for shell, responsive, and tab constraints.
5. The queue read model, transition action, schema, and adjacent route that own the intended behavior.
6. The nearest tests that enforce the relevant trust boundary.
7. [Local development](../LOCAL_DEVELOPMENT.md) and [Release process](../RELEASE.md) for validation and handoff.

Do not treat this context pack as permission to change adjacent domains. It gives enough context to make one deliberate change.

## Role prompts

Use these prompts as a handoff format for a developer or agent. Replace bracketed text with the task packet facts.

### Orchestrator

```text
You are coordinating one JeloCare operations-console increment.

Outcome: [one roadmap outcome]
Authoritative decisions: [ADR links]
Task packet: [packet]

Produce a short implementation plan. Identify missing prerequisites, unsafe assumptions, and decisions that require a new ADR. Do not design a generic admin system, add public features, or broaden the stated scope. Stop for a decision if the packet cannot identify the read model, allowed action, and audit consequence.
```

### UI and UX architect

```text
You are designing one private JeloCare operations workflow.

Task packet: [packet]
Constraints: private-shell tokens; sidebar is top-level navigation; local tabs are URL-backed sibling views; desktop, tablet, and mobile use task-appropriate compositions rather than scaled copies.

Return the information hierarchy, states, keyboard flow, responsive composition, and visual-token usage. Preserve one primary operator task per small viewport. Do not add decorative widgets, generic settings, or tabs without distinct workflow responsibility.
```

### Implementer

```text
You are implementing one JeloCare operations-console vertical slice.

Task packet: [packet]
Plan: [approved plan]

Use existing validation, access, action, and audit boundaries. Keep reads, UI composition, and mutations separated. Add or update focused tests for changed behavior. Do not directly mutate canonical records, weaken deny-by-default access, expose a public route, or invent persistence. Report changed files, tests, and remaining deferrals.
```

### Reviewer

```text
You are reviewing one JeloCare operations-console change.

Task packet: [packet]
Diff and tests: [links or summary]

Check authorization, data ownership, auditability, idempotency, URL state, failure handling, focus behavior, responsive composition, token use, and documentation. Reject hidden scope expansion, unowned generic abstractions, fake tabs, unimplemented links, or any canonical write outside the accepted action boundary.
```

## Creative engineering boundary

A developer may choose component decomposition, internal naming, layout rhythm, and implementation technique when all of the following remain true:

- The task packet's data, permission, audit, and responsive constraints are met.
- Existing tokens and semantic roles are reused before new tokens are introduced.
- The implementation improves clarity or resilience without expanding product scope.
- A reviewer can trace every changed behavior back to a packet acceptance criterion.

A developer must pause for review rather than improvise when a change affects data ownership, operator authority, canonical publication, public exposure, privacy, retention, or measurement use.

## Required gates

For every console change, run the smallest focused tests first, then the complete local gate before handoff:

```bash
npm run validate
git diff --check
git diff --stat
```

Also perform browser review at the viewports affected by the packet:

- Desktop: selected route, keyboard navigation, focus, empty and error states.
- Tablet: intended compact navigation and detail composition.
- Mobile: one-task flow, readable controls, and route or sheet return path.

Use the browser-review checklist in [Local development](../LOCAL_DEVELOPMENT.md#browser-review). Stage explicit paths only; never stage environment files, local tooling state, database dumps, or private captures.

## Completion record

A completed increment reports:

```text
Outcome delivered:
Routes and components changed:
Read model and action boundary used:
Role and audit behavior:
Responsive compositions verified:
Automated checks run:
Browser states exercised:
Documentation updated:
Deferred work and next dependency:
```

The completion record is not ceremony. It is the context pack for the next increment.
