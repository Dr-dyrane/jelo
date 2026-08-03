# ADR 0012: Superseded private member Shelf and Routine portal

- **Status:** Superseded and rejected as the current product contract
- **Date:** 2026-08-02
- **Superseded by:** [ADR 0013 · Founder-led JeloCare Me](0013-founder-led-jelocare-me.md)

## Historical outcome

This ADR reopened a private member portal around separate `/shelf`, `/routines`,
member sign-in, and privacy routes. It proposed a dependency-ordered launch,
owner-isolated private data, immutable exact-product references, export and
deletion behavior, and a nine-role human approval gate.

That portal contract is no longer implementation canon. Do not use its route
map, department names, staffing model, G0 signature matrix, rollout stages, or
duplicated lifecycle packet as requirements or backlog.

## Why it was superseded

The proposal preserved important privacy instincts but confused speculative
governance with the customer product:

- Shelf and Routine became standalone destinations instead of coherent parts of
  one customer workspace.
- A nine-approver documentation contract displaced founder product authority and
  treated code departments as human staffing requirements.
- Future retention, provider, incident, restore, and rollout details were copied
  across an ADR, a privacy packet, a runbook, a JSON gate, a verifier, and tests
  before a member route or data model existed.
- The release command rewarded an honestly blocked speculative record rather
  than proving the behavior of the software being released.

ADR 0013 replaces that structure with a founder-led `/me` contract, four product
roles, one DRY filesystem and design canon, concise invariants, and focused
privacy/security evidence when a real data-bearing slice is commissioned.

## Retained invariants

The following principles remain valid and are now authoritative in
[ADR 0013](0013-founder-led-jelocare-me.md#privacy-and-security-invariants):

- public evidence journeys remain account-free by default;
- customer identity and `/ops` authorization never imply one another;
- private data is owner-isolated server-side and fails closed;
- private Shelf/Routine/concern contents never become advertising, retailer,
  ranking, clinical, community, analytics-profile, or model-training inputs;
- secrets and private payloads stay out of URLs, public caches, logs, analytics,
  screenshots, and support transcripts; and
- a future destructive data lifecycle ships only with explicit retention,
  export, deletion, restore, incident, and rollback behavior for the actual
  implementation.

The immutable exact-product identity and provenance requirements are retained in
[JeloCare Me](../product/JELOCARE_ME.md#data-and-trust-ceiling).

## Current boundary

No `/me` route, customer auth, customer data, Shelf persistence, or Routine
persistence exists because of this historical ADR. The current foundation and
future delivery sequence are defined only by [ADR 0013](0013-founder-led-jelocare-me.md)
and [JeloCare Me](../product/JELOCARE_ME.md).
