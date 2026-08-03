# JeloCare Me

Updated: 2026-08-03

JeloCare Me is the future customer-owned workspace for asking, understanding,
saving, and organising care. The current release is foundation only: there is
no `/me` route, customer authentication, private storage, AI behavior, Shelf,
or Routine persistence yet.

[ADR 0013](../adr/0013-founder-led-jelocare-me.md) owns the decision and code
boundaries. The [adaptive workspace dock](../design/ADAPTIVE_WORKSPACE_DOCK.md)
owns the shell mechanics. This file owns product purpose, vocabulary, and
feature progression.

## The customer goal

One workspace should answer: **What should I understand or do for my care now?**

The experience begins with Ask rather than a dashboard. Evidence and customer-
owned context support the answer; controls do not compete with it. JeloCare Me
must feel continuous with JeloCare's public warmth while becoming quieter and
more task-led.

## Information architecture

| Tab | Canonical route | Customer job | Primary action owner |
| --- | --- | --- | --- |
| Ask | `/me` | Ask one question and understand a grounded, safety-bounded answer | Ask controller |
| Concerns | `/me/concerns` | Review customer-owned concern context without treating it as a diagnosis | Concern controller |
| Shelf | `/me/shelf` | Retrieve and organise intentionally saved exact products | Shelf controller |
| Routine | `/me/routine` | Arrange a customer-authored routine without turning it into a prescription | Routine controller |

Account, appearance, consent, sessions, export, and deletion belong behind the
customer avatar. Account is chrome, not a fifth Me destination.

These routes are reserved vocabulary only. Do not add a route, placeholder,
empty state, or navigation entry to production until its feature slice is
commissioned and has truthful data and behavior.

## Workspace composition

The page order is:

1. one tab-specific question or answer;
2. concise reason or evidence;
3. one next decision;
4. supporting customer-owned context; and
5. history or configuration only when it helps the current task.

On warm customer canvases, content may use a restrained Italiana display
heading. Navigation, account chrome, controls, dock, labels, values, and status
use Manrope. Cream, paper, peach, blush, rose, wine, and warm ink remain the
palette. Operations mineral grey and `--ops-*` tokens are prohibited.

The [adaptive workspace dock](../design/ADAPTIVE_WORKSPACE_DOCK.md#view-anatomy)
owns expanded, compact, navigation, and single anatomy. Me supplies only the
active tab, truthful context, warm semantic palette, and route-owned action. The
capsule never mutates; the FAB owns the one primary domain mutation and uses an
explicit accessible label.

## Adaptive behavior

The intended route evidence matrix is `390 × 844`, `600 × 900`, `1000 × 800`,
and `1440 × 900`, in light and dark, at the top, scrolled/contracted, and
navigation-revealed states. Geometry, scroll ownership, 320 px/200% text
behavior, focus, and accessibility-preference requirements live only in the
[dock evidence contract](../design/ADAPTIVE_WORKSPACE_DOCK.md#evidence-matrix).

## Feature sequence

1. **Foundation:** canon, neutral dock mechanics, Me adapter, and focused tests.
2. **Ask route:** only after the real controller, safety/evidence model, failure
   states, and owner boundary are commissioned.
3. **Concerns:** only with explicit non-diagnostic language and customer-owned
   concern semantics.
4. **Shelf:** only after immutable exact-product identity and owner-isolated
   storage are accepted and implemented.
5. **Routine:** only after Shelf and routine-specific safety, comprehension,
   lifecycle, and owner-isolation evidence exist.

Feature order is dependency order, not permission to create empty folders or
placeholder routes.

## Data and trust ceiling

JeloCare Me does not create clinical or commercial authority from customer
activity.

- A question, concern, save, or routine step is never a diagnosis, verified
  purchase, endorsement, product-safety decision, popularity signal, retailer
  ranking input, or availability claim.
- Future exact-product references preserve immutable identity and original
  provenance across merge, retirement, reformulation, or package change.
- A product successor is presented for an explicit customer decision; it never
  silently replaces a Shelf item or Routine step.
- Private contents do not feed advertising, retailer targeting, rankings,
  catalogue promotion, clinical training, community research, or model training.
- Public search, catalogue, product, concern, and evidence journeys stay usable
  without a customer account.

The concise security and lifecycle invariants are authoritative in
[ADR 0013](../adr/0013-founder-led-jelocare-me.md#privacy-and-security-invariants).
A data-bearing feature adds a focused, implementation-specific decision and
evidence rather than copying a speculative portal runbook.

## Implementation contract

Routes are thin adapters. A feature controller owns interaction and named
actions; a pure model owns derivation; a view renders semantic props; a server
service derives the authenticated owner and constrains every private query and
mutation. Shell scroll, reveal, context, and FAB state are route-scoped and
ephemeral.

Neutral mechanics stay in `lib/workspace-shell/` and
`components/workspace-shell/`. JeloCare vocabulary stays in
`components/me/shell/`. A future feature receives its own files only when there
is executable scope. See [ADR 0013](../adr/0013-founder-led-jelocare-me.md#filesystem-and-code-canon)
for the authoritative topology and rules.

## Foundation non-goals

This foundation does not add:

- `/me` or another customer route;
- customer DB/auth, sessions, cookies, migrations, records, fixtures, or seeds;
- Ask AI/model calls or a placeholder conversational surface;
- Shelf/Routine data, catalogue writes, reminders, notifications, cron, queues,
  campaigns, retailer, or courier workflows; or
- any change to `/ops`, `OpsChrome`, operator authorization, public navigation,
  or current public behavior.
