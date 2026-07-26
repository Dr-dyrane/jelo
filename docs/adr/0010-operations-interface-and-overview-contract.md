# ADR 0010: Operations use a native split-view work grammar

Status: Proposed — implementation candidate under product review

Date: 2026-07-25

## Context

JeloCare's public product has established a clear standard: calm hierarchy,
short human copy, light typography, restrained surfaces, progressive
disclosure, and immediate feedback. The private console needs the same quality
of judgment without importing the public site's editorial typography or
peach-led storytelling.

`/ops/observations` is the first substantial operations workflow and the
current reference candidate for queue work. It began by mirroring available
schema data; that implementation is evidence for review, not proof of the
right operator information architecture. Its strongest current decisions are
systemic:

- one concise page title;
- a dense collection that supports scanning;
- one continuous inspector rather than nested cards;
- a visible selected state and predictable advancement;
- evidence before decisions;
- quiet, semantic controls;
- separate desktop, tablet, and phone compositions.

It is a workflow candidate, not markup to copy into every operations route. A
monitor page does not become accepted by embedding the observation inbox. An
overview may use queue-level selection and a contextual inspector, but it never
becomes a second record-triage surface or a grid of dashboard cards.

Two implementations of `/ops` expose the missing contract:

- baseline commit `6a70033` uses a generic grid of queue tiles;
- an early replacement embedded whichever pending queue appeared first in a
  hard-coded order and rendered record triage in place.

The tile grid is a generic admin dashboard. The queue-switching draft gives one
URL an unpredictable identity, hides the rest of the queue topology, and turns
a briefing into a second triage route. Neither expresses the JeloCare
operations standard.

[ADR 0009](0009-ui-ux-lane-contract.md) governs how interface work is owned and
proved. This ADR specializes that contract for the operations product and
defines `/ops` Overview as the first application.

## Decision

JeloCare operations is a **calm working instrument**. It applies an
Apple-informed product discipline—deference, clarity, consistency, meaningful
depth, and progressive disclosure—without copying Apple layouts, album
galleries, a player chrome, or ornamental glass.

The desktop baseline is a native **three-column split view**:

```text
Sidebar (navigation) → Main workspace (scan and select) → Inspector (context and next action)
```

These are continuous work planes. They are not three rounded dashboard cards
placed next to one another. Apple Music is useful only as an inspiration for
calm density, a persistent navigation instrument, and a contextual side area;
it is not a literal visual template.

At docked desktop widths, the sidebar, workspace, and inspector are direct
siblings inside the operations shell. The inspector does not descend from the
workspace wrapper. The shell owns a `100dvh` frame; workspace and inspector
scroll independently. A decision inspector keeps its action region anchored
while evidence and metadata scroll above it.

Every route has one declared mode:

| Mode | Job | Examples |
| --- | --- | --- |
| Briefing | Orient the operator, preserve system topology, select a queue, and recommend the next useful action. | `/ops` |
| Triage | Scan a queue, inspect evidence, and make an attributable decision. | `/ops/observations`, `/ops/contributions` |
| Monitor | Read a historical or operational signal without changing its source. | `/ops/activity`, `/ops/signals` |
| Manage | Inspect governed people or configuration under an explicit authority boundary. | `/ops/operators` |

A route may link to another mode. It must not quietly absorb that mode's entire
workflow. New work declares its mode in the lane contract before visual design
begins.

### What the Observations candidate contributes

Other operations pages reuse these principles:

- Manrope-only interface typography;
- low-chroma operations tokens;
- borderless surface hierarchy;
- one stable page title with no explanatory subtitle;
- decision-relevant information first;
- stable URL meaning;
- slender controls and quiet status treatments;
- loading geometry that resembles the final view;
- empty, denied, error, pending, and settled states;
- task-specific responsive composition;
- keyboard, focus, motion, and contrast behavior.

The current candidate also tests a mixed-density projection over one canonical
queue: a shallow oldest-first `Up next` shelf, compact price rows, and a quiet
experience rail. These groups do not create separate datasets, policies, or
selection models. Every record retains one identity, one URL selection, one
keyboard position, one inspector, and one settlement path.

They do not automatically reuse:

- mandatory row selection;
- `?id=` state;
- observation row density;
- approve/reject controls;
- queue-specific CSS overrides;
- auto-advance behavior.

Those belong only where the route's job requires them. A queue-level overview
does reuse selection and an inspector because the selection changes useful
context; it does not reuse individual-record decisions, auto-advance, or
observation-specific evidence blocks.

## JeloCare operations voice

The voice is a trusted colleague: calm, plain, exact, and brief. It is not
promotional, clinical, bureaucratic, or chatty.

### Writing rules

- Lead with the state or action. Do not lead with implementation context.
- Use sentence case. Do not use all-caps interface labels.
- Use one thought per heading and one supporting thought only when it changes
  the decision.
- Use the same noun for the same object across navigation, headings, and
  actions.
- Prefer a verb-led action that names its destination or result.
- Translate database and statistical terms into operator language while
  preserving exact meaning.
- State freshness and confidence when they affect a decision.
- Never call an item urgent, verified, safe, complete, or healthy unless a
  typed rule supports that word.
- Do not congratulate routine work or use exclamation marks to manufacture
  energy.
- Keep identifiers, raw payloads, and implementation metadata available but
  secondary.

### Preferred language

| Avoid | Use |
| --- | --- |
| `Priority: Observations` | `Review observations` plus a visible reason such as `Oldest item waiting` |
| `12 records pending ingestion` | `12 items need attention` |
| `Navigate to queue` | `Review contributions` |
| `Median price` | `Typical price` when the calculation really represents it |
| `SLA breach detected` | `Oldest item has waited 2 days` |
| `Action completed successfully` | `Observation approved` |
| `No data available` | `Nothing awaiting review` or a state-specific alternative |
| `An unexpected exception occurred` | `Couldn’t load this view` |

Raw system terms may appear in Metadata or an audit detail when operators need
them. They do not become the primary interface voice merely because the data
model uses them.

The default interface vocabulary must not expose schema versions, payload
keys, UUIDs, SQL, query parameters, backend or provider names, or raw enum
values. Translate them into the operator's task language. When an identifier or
implementation fact is genuinely needed, place it inside an explicit
`Metadata` or audit disclosure; never use it in a route heading, loading or
empty state, error message, primary control, or success feedback.

## Typography and hierarchy

Operations uses `--font-sans` only.

- Regular is the default weight.
- Medium supports navigation, compact values, and selected states.
- Semibold is reserved for the page title, a short section title, a primary
  control, or a status that needs distinction.
- Bold is exceptional.
- A number does not become meaningful by becoming enormous. Overview metrics
  use `font-variant-numeric: tabular-nums` and remain subordinate to their
  meaning and action.
- Hierarchy comes from position, spacing, scale, and tone before weight.
- Headings describe the operator's location or task: `Overview`,
  `Observations`, `Recent decisions`.
- Labels describe facts: `13 waiting`, `Oldest 3h`, `Updated just now`.

Do not use an editorial display face, oversized marketing headline, gradient
text, or a wall of equally weighted metrics in the private console.

## Surface and density grammar

The shell's material hierarchy remains authoritative:

1. `--ops-canvas` is the environment.
2. `--ops-workspace` is the continuous working plane.
3. `--ops-surface-subtle` groups stable, repeated information.
4. `--ops-instrument` and glass are reserved for floating chrome.

Overview uses one continuous workspace with at most one clearly elevated
next-action region. Queue topology and recent activity are compact lists or
aligned groups, not a grid of independent dashboard cards.

- Use spacing, alignment, and tone before a border.
- Structural separators may support a long repeated list. They do not outline
  every row, metric, or inspector section.
- Do not nest cards in cards.
- Do not turn every information group into a card. A continuous workspace,
  aligned rows, spacing, and a single contextual inspector are the default.
  Cards are reserved for a public-product render or a genuinely separate,
  persistent object—not to simulate hierarchy inside Ops.
- Do not put glass on stable data surfaces.
- Use shadow only to explain actual elevation.
- Status pills are for short semantic states, not labels every metric already
  explains.
- Icons support recognition. They do not decorate counts or replace clear
  nouns.
- One screen may be dense because work is dense. It must still have one obvious
  reading order and one primary action.
- Do not place low-contrast text over photography, translucent material, or
  dynamic imagery. Use a contrast-tested opaque surface or separate the text
  from the image.
- Transparent product packshots remain exact, unfiltered, uncropped, and
  contained. UI composition cannot crop, mask, recolour, or decorate them into
  a different package.

An operator should understand Overview in about five seconds:

1. how much work needs attention;
2. what to do next and why;
3. how work is distributed across queues;
4. what recently changed or needs intervention.

Everything else is secondary or belongs on a dedicated route.

## Data storytelling and integrity

The interface does not infer operational truth in JSX. A typed server-side read
model supplies display-ready facts and the reason for any recommendation.

The Overview read model should contain:

```text
generatedAt
pendingTotal
queues[]
  kind
  label
  href
  pendingCount
  oldestPendingAt
  operatorCanAct
  recentDecisions[]
selectedQueueKind
nextAction
  queueKind
  href
  label
  reasonCode
  reasonText
upNext[0..2]
  id
  queueKind
  queueLabel
  href
  title
  summary
  createdAt
  image
recentDecisions[]
attentionItems[]
partialOrStaleState
```

This is a semantic contract, not a required property spelling.

The projection contains enough stable queue-level context for the inspector and
at most two real records from the recommended queue for the `Up next` shelf.
Those records are a read-only preview, not a second triage surface. Product
media appears only when the exact display-approved asset is already available.
Overview never carries a record-level decision form.

The first recommendation policy is deliberately simple:

1. consider only queues the operator may access;
2. recommend the queue with the oldest actionable pending item;
3. use a documented stable tie-break only when timestamps are equal;
4. show the reason in human language.

Future safety or freshness rules may outrank age only after the rule, source,
and operator response are explicitly defined and tested. Queue volume alone is
not urgency. A fixed route order is not a priority model.

All Overview facts follow these rules:

- `pendingTotal` equals the visible queue counts from the same logical read.
- A capped or partial count says so.
- A relative time has an exact timestamp available to assistive technology or
  detail disclosure.
- A trend names its comparison period.
- A percentage has a denominator and source.
- A freshness label reflects the source timestamp, not render time.
- `Live`, `healthy`, and `verified` are prohibited without a real monitoring or
  verification contract.
- Zero values remain part of the topology but recede visually.
- Permission changes the recommendation and available actions; the UI does not
  invite an operator to a decision they cannot make.
- Recent activity is an audit projection, never a second mutable copy.
- No vanity metric appears merely to fill a composition.
- No chart ships before a trustworthy time series and a decision the chart
  helps the operator make both exist.

Overview reads a small purpose-built projection. It does not load and enrich
100 record rows merely to preview the next destination. The projection selects
only the first two pending records from the recommended actionable queue.
Queue-level selection remains sufficient for the inspector.

## Overview contract

`/ops` is a stable operational briefing. Its page identity never changes with
queue contents. Its working anatomy uses queue-level selection, not dashboard
tiles or embedded individual-record triage.

### Canonical anatomy

1. **Page context** — `Overview` only. Counts, freshness, and queue state live
   in their relevant sections, never in a generated header subtitle.
2. **Up next** — the first two real records from the recommended actionable
   queue, with a human title, one decision-relevant fact, age, and optional
   approved exact product image.
3. **Queue workspace** — all accessible queues as compact, selectable rows;
   each row makes its count, waiting context, and selected state legible.
4. **Contextual inspector** — the selected queue's load, oldest age,
   meaningful recent decision context, and one verb-led route action.
5. **Recent work** — a short audit projection naming the real action, target,
   operator, and time.
6. **Attention** — only real failures, stale processes, or incomplete reads
   with a clear owner or next action.

The recommended next queue is selected by default when valid. Its inspector may
use the strongest tonal treatment on the page, but it remains a continuous
plane rather than a hero card. Its link is specific, for example `Review
observations`, and lands on `/ops/observations`, preserving that route's
canonical selection behavior.

Queue topology is not a card zoo. Prefer a compact selectable list. The count
is legible but the queue name, state, and route remain the primary meaning. A
row that changes the in-page inspector is a button; its inspector action is the
link to the queue route. Do not present both semantics on one ambiguous target.

The current Overview candidate applies the useful Apple Music home-page lesson
as **content-first section rhythm and scan density**, not visual imitation:

- one shallow `Up next` shelf elevates two real records from the recommended
  queue; it never invents content, silently diversifies queues, or embeds
  decision controls;
- the queue collection uses two aligned columns when complete names remain
  readable and one column below `600px`;
- below `600px`, the `Up next` shelf keeps its readable fixed card measure and
  becomes a quiet horizontal rail with a continuation cue;
- an unselected queue keeps its main plane transparent and gives only its small
  recognition surface a tonal background;
- selection may tone the complete queue row because the whole row is the
  interactive object;
- a compact `Recent decisions` group may project the existing audit trail
  across queues and link to Decision history; it is omitted when there is no
  real activity and never substitutes fabricated examples;
- the docked inspector action sits at the bottom of its independent plane, so
  empty space remains calm and the route action stays predictable.

This does not authorize album-like queue tiles, decorative imagery, invented
charts, duplicate queue identities, or a generic metrics dashboard. A preview
link must open that exact record in its canonical queue; a record-shaped link
may not silently land on a different selection.

Recent decisions reassure and orient inside the selected queue context; they do
not compete with pending work. When no recent decision exists, say so quietly
or omit the section. Do not add sample activity.

### Overview empty state

An empty queue is not an error and does not require celebration.

- Heading: `Nothing awaiting review`
- Supporting thought: `New submissions will appear here.`
- The empty inspector explains the selected empty queue or, when all queues are
  clear, retains quiet recent decisions if useful.
- Do not show a large green success card, confetti, or `All systems healthy`
  unless system health is actually measured.

### Overview actions

- The selected inspector has one primary CTA that routes to the selected queue.
- Every queue row selects that queue and visibly updates the inspector.
- No moderation decision executes on Overview.
- No action-shaped control is a placeholder.
- A missing implementation means the control is absent, not disabled with a
  promise, not wired to a no-op, and not labelled `Coming soon`.
- Filters or time ranges appear only when backed by URL state and a real query.
- Overview has no default floating `Stats` action until a real stats workflow
  exists.

## Controls and overlays

Controls use native semantics, existing ops tokens, slender squircle geometry,
and direct labels.

- Primary controls use the accent surface.
- Destructive controls use the subtle danger surface and never compete with
  the primary action.
- Pills remain filters or statuses.
- A selected row uses tone, not a heavy outline or bold type.
- Pending labels name the submitted action.
- Every consequential action has visible and assistive feedback.
- Reversible view changes expose Clear or Undo where meaningful.
- A button or link that appears actionable must work.
- A row, menu item, or control must use native semantics matching its result.
  Do not leave `role=option`, `aria-selected`, or keyboard handlers on an
  element that is not inside its required composite widget. Do not ship a
  no-op action-shaped control.

Core briefing content remains on the page. Secondary detail may use:

- a docked right inspector on desktop and a right-side sheet on compact desktop;
- a compact modal for one short, focused decision;
- a bottom sheet on phone;
- a temporary side stage on touch and tablet where spatial context matters.

An overlay must have a title, close control, a real focus trap, Escape and safe
outside-dismiss behavior, background scroll lock, an independently scrollable
body when needed, reduced-motion behavior, and focus restoration to the exact
trigger. Do not use a sheet to disguise navigation to a full queue or to make
static information feel interactive.

## Responsive states

The operations shell's five bands remain load-bearing. Overview preserves the
same reading order while changing composition:

| Band | Overview composition |
| --- | --- |
| Phone, `<430px` | One workspace column, a readable horizontal `Up next` rail, and bottom-sheet selected-queue context. The route CTA remains above the bottom bar. |
| Touch, `430–819px` | A content-driven one- or two-column workspace, with the feature shelf preserving readable measure and selected-queue context in a bottom sheet. Navigation remains an overlay. |
| Compact tablet, `820–1179px` | Persistent shell navigation; queue rows own the workspace; selected-queue context opens in a right side sheet. No squeezed dashboard grid. |
| Balanced desktop, `1180–1439px` | Persistent sidebar, queue workspace, and contextual inspector are visible as three related planes. |
| Expanded desktop, `≥1440px` | Preserve the same three-plane hierarchy with a comfortable measure; do not add widgets merely to fill space. |

At every width:

- the total and next action remain visible without horizontal scrolling;
- queue names and counts do not wrap into ambiguous pairs;
- long labels truncate only when the complete name remains accessible;
- focus order follows the visual reading order;
- 200% zoom and 320px reflow preserve the task;
- fixed shell chrome does not cover the final row or action.
- phone always retains its separate contextual FAB. It opens the selected
  record or queue context; read-only and empty states use a route-labelled
  refresh fallback. It never becomes a generic or no-op action.

## Loading, empty, partial, error, and success

Each route owns states that preserve its final anatomy.

### Loading

- Overview has a dedicated skeleton for context, the two-record `Up next`
  shelf, queue rows, recent activity, and the docked inspector geometry.
- It does not borrow the Observations collection and inspector skeleton.
- Loading geometry follows the resolved route contract, not the momentary URL.
  If a populated ready-state queue automatically selects its first record, its
  desktop fallback reserves the docked inspector even before an `id` appears
  in the address. A compact side sheet or mobile bottom sheet remains closed
  until the corresponding ready-state interaction would open it.
- Skeletons do not announce every shape. One concise loading status is enough.
- Reduced motion removes shimmer without removing geometry.

### Empty

- Explain what is empty and what happens next.
- Keep navigation and stable recent activity available.
- Never imply the database, refresh workers, or retailer feeds are healthy
  merely because moderation queues are empty.

### Partial or stale

- Render reliable sections when one projection fails.
- Place the warning beside the affected section.
- State the last successful update when known.
- Do not sum partial counts into a complete-looking total.

### Error

- Say what could not load.
- Offer `Try again` when retry is safe.
- Preserve the shell and unaffected context.
- Log technical detail privately; do not print a stack, digest, raw SQL, or
  secret in the interface.

### Success

Overview does not execute moderation actions. When an operator returns after
queue work, refreshed counts and recent audit activity communicate the result.
Do not add a success toast for a decision made on another route unless
cross-route feedback is deliberately implemented and focus-safe.

Denied access remains the console's existing fail-closed state. A visual lane
must not weaken it to make an error screen easier to demo.

## Accessibility guardrails

- Use one `h1` and a logical heading order.
- Use links for queue navigation and buttons for in-place actions.
- Interactive targets are at least `44 × 44` CSS pixels where touch applies.
- Focus is visible on every operations surface.
- Small text reaches `4.5:1`; meaningful non-text state reaches `3:1`.
- Color is never the only signal for zero, stale, failed, selected, or urgent
  state.
- Counts have clear accessible names, not detached numbers.
- Dynamic updates use one concise `aria-live="polite"` status. Do not make the
  entire briefing live.
- Keyboard order matches the visual order.
- Sheets and modals contain and restore focus.
- Motion and transparency respect user preferences.
- Light and dark values are verified separately.
- Loading, long content, high counts, zero counts, partial data, error, denied,
  and clear queues are part of acceptance evidence.

## Bounded queue pagination

Long operations queues use progressive revelation without changing the queue's
authority. The server still owns the ordered, permission-filtered result set
and its explicit cap or cursor. A client may reveal that already-authorized set
in small pages; it must not refetch, reorder, merge, or imply that the local
end state is the database's global end state.

- Start with a small task-shaped page. Choose the count from the presentation's
  scan density, not from the maximum server limit.
- A vertical collection may observe a sentinel near its lower edge. A
  horizontal rail observes its trailing sentinel with the rail itself as the
  observer root.
- Pagination bounds mounted records, never card width. One horizontal
  collection keeps the same fixed card measure at every viewport; the available
  width changes how many complete cards and how much of the continuation cue
  are visible.
- One section owns at most one pending reveal. Deduplicate observer and button
  requests, stop at the bounded end, and re-arm automatic loading only after
  the sentinel leaves the threshold.
- Keep a visible, keyboard-operable `Load more` control whenever more bounded
  records remain. Intersection Observer is an enhancement, not the only path.
- Announce loading, visible count, and end state through one concise polite
  status. Do not make the full collection live.
- A URL-selected inspector record outside the initial page reveals its
  containing page. Selection, focus order, auto-advance, and the canonical URL
  survive pagination.
- Initial skeletons mirror only the initial reveal and every ready-state
  presentation. Loading another page does not replace settled rows or block the
  inspector.
- Selection feedback is optimistic but content is not: the selected row changes
  state immediately and the canonical inspector skeleton mounts in the same
  frame. Only the URL-resolved record may replace that skeleton with evidence
  and decision controls.
- If a future lane needs records beyond the server boundary, it adds a typed,
  permission-aware cursor contract and tests request deduplication, stale
  responses, retry, and terminal state before implementation.

## Audit of the current Overview draft

The active draft in `app/(ops)/ops/page.tsx` is not an accepted implementation
of this ADR.

| Finding | Why it breaks integrity | Required correction |
| --- | --- | --- |
| The route renders one complete queue based on current counts. | `/ops` changes identity unpredictably and duplicates triage. | Keep a stable briefing with queue-level rows and an inspector; route action opens the chosen queue. |
| Priority is a hard-coded `if` order. | The interface presents policy without an evidence-backed reason. | Move recommendation into a typed, tested read model based initially on oldest actionable work. |
| Other queues disappear. | The operator loses system topology and may misread the total. | Show every accessible queue as a selectable row, with its count. |
| Decisions can execute on Overview. | Monitor and triage responsibilities blur; canonical queue URLs lose meaning. | Keep approve, reject, map, and rationale controls on queue routes only. |
| Selection becomes `/ops?id=…`. | The URL identifies an individual record without its owning queue. | Use queue-level selection (`?queue=` when shareability is needed), then link to the canonical queue route. |
| Overview imports observation route CSS. | A route-specific visual repair becomes a shared page dependency. | Give Overview a route-owned module and consume only stable shell primitives. |
| Up to 100 rows are fetched and product-enriched. | A briefing pays queue-work cost and couples to catalogue presentation. | Read a small Overview projection. |
| `Stats` is an action-shaped no-op in the shell. | The interface promises an action and provides no response. | Hide it until a real stats workflow and query exist; coordinate through the shell lane. |
| Overview has no dedicated loading or error anatomy. | Transitions cannot preserve the intended briefing hierarchy. | Add route-owned loading and error states. |
| Legacy tile styles remain beside the new draft. | Two incompatible Overview systems remain available to copy. | Remove dead Overview styles when the replacement ships. |

The Observations route remains the queue reference candidate. Its files are an
independent review lane and must not be changed merely to make Overview easier
to compose. Product review may still change its hierarchy, density, grouping,
or inspector anatomy.

### Cross-route debt found during the audit

These findings do not belong in the Overview route diff. They need separately
owned lanes:

- `OpsChrome.defaultContextFab` currently creates action-shaped `Stats`,
  `Export`, `Invite`, `New`, and `Signal` controls with no-op handlers. The
  shell lane must remove each placeholder or connect it to a real,
  permission-aware workflow.
- `InboxContainer` presents overlay inspectors with dialog semantics and Escape
  handling, but the source does not itself establish focus containment, body
  scroll lock, or trigger-focus restoration. A shared-interaction lane must
  prove and complete those behaviors before more routes inherit the primitive.
- Shared empty and error primitives still use generic card, surface, elevation,
  and pill tokens. A state-primitive lane should align them with the operations
  surface and control grammar before declaring them canonical everywhere.
- Observations presents the submitted evidence only. A retail-data lane must
  supply an eligible-market, exact-product, freshness-aware comparison before
  any typical-price or market-comparison claim can enter the inspector.
- Only Observations currently has route-specific loading and error files.
  Other operations routes adopt their own task-shaped states as their lanes are
  completed; they do not copy the observation inspector skeleton by default.

## Prioritized implementation brief

### P0 — Restore a truthful page identity

1. Replace embedded record triage with a stable queue-level Overview split view.
2. Remove every moderation action from `/ops`.
3. Add a purpose-built, permission-aware Overview read model.
4. Recommend the oldest actionable queue and expose the reason.
5. Link the selected inspector action to the canonical queue route; topology
   rows select their contextual inspector state.
6. Remove the no-op Overview `Stats` control through an operations-shell
   handoff, and inventory the other placeholder floating actions in that lane.

### P1 — Complete the experience

1. Build context, selectable queue topology, selected-queue inspector, and
   three to five relevant audit events.
2. Add dedicated loading, clear, partial, and error states.
3. Add a route-owned CSS module using existing operations tokens.
4. Verify all five shell bands, dark mode, 200% zoom, keyboard order, reduced
   motion, and long/high-count data.
5. Add focused tests for recommendation policy, permission filtering, totals,
   partial state, and canonical links.

### P2 — Add operational attention carefully

Add feed freshness, failed refresh work, or other system attention only after
each item has:

- a reliable source and timestamp;
- a defined threshold;
- an operator who can respond;
- a direct next action;
- a test proving the label.

Do not add charts, vanity totals, generic health scores, or configurable
widgets as polish.

## Overview lane contract

### 2026-07-26 correction — accepted Overview composition

The audit and P0/P1 brief immediately above record an earlier correction away
from a tile dashboard and embedded record triage. The following rule
**supersedes any conflicting wording in that historical audit and brief**:

`/ops` is a stable briefing presented as a queue-level split view. On desktop it
is **sidebar → selectable queue workspace → contextual queue inspector**. The
workspace leads with at most two real, read-only records from the recommended
actionable queue, then shows every accessible queue as compact rows. It never
uses a grid of dashboard tiles. Selecting a queue row changes the inspector in
place. The inspector explains the selected queue's load, waiting context,
relevant audit context, and one real link to that queue's canonical route.
Overview never executes approve, reject, map, or bulk actions.

The two `Up next` records are content, not dashboard widgets. They show an
exact title, one decision-relevant fact, age, and optional display-approved
product image. Both come from the same typed recommended queue and preserve
oldest-first order. Their links must resolve to those exact IDs in the
canonical queue. If exact URL selection is not implemented for a queue, that
queue may not expose record-shaped links from Overview.

At tablet widths the workspace remains visible and this contextual inspector is
a right side sheet. At mobile and touch widths it is a bottom sheet. Both obey
the overlay contract in this ADR: title, explicit close, focus trap,
background-scroll lock, Escape where available, safe outside dismissal,
independent sheet scrolling, reduced motion, and exact trigger-focus return.

Do not use nested cards, a dashboard tile grid, observation route CSS,
client-invented market claims, cropped or altered transparent packshots,
low-contrast text over imagery, duplicate interaction primitives, orphan ARIA
options, or action-shaped no-op controls to achieve the composition.

Agents implementing the first slice use this packet.

```text
Lane:
ops-overview-briefing

Outcome:
/ops remains a stable operational briefing. In five seconds an authorized
operator can see the total work, recognize the next two real records, understand
the recommended queue and why, scan and select every accessible queue, inspect
its context, and open an exact record or the canonical queue route.

Baseline:
Record the current commit, active draft, dirty files, operator role, queue
counts, and availability of audit history before editing.

Owned paths:
app/(ops)/ops/page.tsx
app/(ops)/ops/loading.tsx
app/(ops)/ops/error.tsx
app/(ops)/ops/overview.module.css
an Overview-specific component directory if reuse is real
the typed Overview read model and its focused tests, coordinated with its data owner

Protected dependencies:
app/globals.css
app/(ops)/ops.module.css
components/ops/shell/*
components/ops/inbox/*
app/(ops)/ops/observations/*
moderation transitions, capabilities, audit writers, and database migrations

Invariants:
deny-by-default access remains unchanged
queue routes remain the only triage owners
all visible counts come from one logical read
recommendation is permission-aware and explains its reason
Up next contains at most two oldest records from that recommended queue
record preview links resolve to the exact canonical queue selection
desktop is sidebar -> selectable queue workspace -> contextual inspector
queue selection updates context without embedding record triage
tablet uses a right side sheet; mobile/touch uses a bottom sheet
no placeholder or no-op control appears
no canonical record is mutated
public JeloCare routes and tokens remain unchanged

Data states:
loading, populated, all clear, one queue empty, all queues zero, partial read,
stale read, error, denied, high counts, long labels, no recent activity

Responsive evidence:
390x844, 600x900, 1000x800, 1300x900, 1440x900, and 320px at 200% zoom

Acceptance evidence:
focused read-model and route tests
npm run lint
npm run typecheck
npm test
npm run build
keyboard-only review
light and dark review
reduced-motion review
all declared viewport and data states
native semantics and keyboard selection review
focus trap, scroll lock, Escape, outside dismiss, and focus-return review
text-over-image contrast and packshot containment review where media appears
git diff --check

Handoff:
Use the ADR 0009 handoff packet. Include the recommendation policy and sample
facts used for each state. Record shell work, such as removing the no-op Stats
control, as a separate owned-lane handoff.
```

An agent stops and requests a decision when the work requires:

- a new urgency or ranking policy;
- a new operator permission;
- a canonical write;
- a new global token or shell breakpoint;
- a chart without a defined operational decision;
- a shell control or shared primitive change outside the owned lane.

## Contributions trial contract

`/ops/contributions` is the first triage-route transfer test for this ADR. It is
a reviewed candidate, not a new canon and not permission to copy its sections
into Edges, Vocabulary, Retailers, or another route. Product review accepts the
trial only after its browser and automated evidence passes.

### Operator job and decision meaning

The operator decides whether an anonymous community submission is coherent
enough to remain available as source material for later moderation. The route
does not verify a product, retailer, price, outcome, routine, contributor, or
campaign; it does not publish a canonical catalogue record.

`Approve` accepts the contribution record only. Its derived knowledge edges,
observations, aliases, prices, retailer claims, and catalogue candidates retain
their own confidence and moderation paths.

`Reject` is consequential: it also rejects the contribution's pending derived
edges and observations and updates affected research signals. Before submitting
that action, the interface presents one focused confirmation that names this
consequence, with `Keep` and `Reject`. A keyboard shortcut, FAB, or other
alternate trigger may not bypass the confirmation. Because the decision already
lives in an anchored inspector footer, the confirmation replaces those footer
actions in place. It does not open a second modal or sheet inside the inspector.

### Typed presentation

The server supplies a validated, display-ready contribution projection. Client
components do not cast arbitrary payload arrays, concatenate schema fields, or
derive trust in JSX. The projection preserves:

- contribution identity, kind, submitted time, retention date, and permission;
- one human title and one decision-relevant summary;
- product, brand, retailer, purpose, outcome, price, and purchase date only
  where the selected kind can contain them;
- each submitted value's human label and whether it matched an existing value
  or needs matching;
- one optional exact display-approved product image;
- a human campaign-source label when first-touch attribution exists;
- an explicit bounded-result completeness state.

An existing value and a new community value must not look equivalent. Use a
quiet, literal state such as `New` or `Needs matching`; do not use warning
colour merely because a value is custom. A product image is shown only when its
canonical reference resolves to the exact approved packshot. An unresolved or
custom reference uses the route's quiet icon treatment rather than a guessed
image.

The three contribution kinds adapt the inspector instead of rendering one
schema-shaped property list:

| Kind | Primary context |
| --- | --- |
| Product | Product, brand, uses, store, reported price and date when supplied, and reported outcome. |
| Routine | Products used together, uses, and reported outcome. Product count supplements the names; it does not replace them. |
| Store | Store and the uses people associated with it. Product, price, purchase, and outcome rows are absent rather than empty. |

Call the primary section `Submitted details`. Use `Note` for the optional
operator rationale. The selected kind appears once where it aids orientation;
do not repeat it as an eyebrow, subtitle, coloured pill, and metadata row.
`Trusted store`, `verified`, `current price`, and similar confidence language
remain prohibited until a typed rule establishes them.

### Technical and attribution boundary

The normal inspector never renders a raw JSON payload, schema key, enum, UUID,
SQL term, provider name, UTM parameter, full referrer, click identifier, or
server exception. Technical diagnostics, when genuinely required, belong in a
separately permissioned diagnostic surface rather than the moderation reading
order.

One collapsed `Metadata` disclosure may contain the copyable contribution ID,
retention date, exact submission time, and a human first-touch source such as
`TikTok campaign` or `Direct`. Attribution is provenance only. It never changes
rank, urgency, confidence, approval, rejection, or the wording of the
submission's evidence.

Server actions return bounded operator-facing outcomes. They log technical
detail privately and never pass an arbitrary exception message to the
interface. Approval, rejection, conflict, and retry feedback stays attached to
the selected contribution.

### Collection and control integrity

One contribution appears once. A mixed-density projection may use a shallow
oldest-first `Up next` shelf, compact product and store rows, and a fixed-measure
routine rail only when those presentations improve recognition. They remain one
ordered queue with one selected ID, one inspector, and one settlement path.

The rendered collection order is the keyboard order. Grouping may not cause
Arrow or shortcut navigation to jump against visual reading order. After a
successful settlement, the projection is recomputed from the remaining queue:
the next oldest eligible record fills `Up next`, selection and URL advance
together, and focus moves to the new selected row or its inspector without an
empty flash.

At rest, the media stage may carry one quiet recognition surface while the row
copy stays on the workspace. The whole row gains tone only for hover, focus,
pending selection, or selected state. Do not combine a surfaced row, surfaced
inner card, and surfaced image well. Fixed rail card width does not shrink when
pagination reveals more records.

Buttons use the shared decision tokens and direct verbs. Desktop decision
controls retain the accepted slender geometry; every touch presentation,
including close and rail controls, provides at least a `44 × 44` CSS-pixel
target. Unexplained letter badges do not appear inside actions. A keyboard
shortcut is exposed only through the shared discoverable shortcut system and
never becomes the sole path.

### State and recovery matrix

| State | Required behavior |
| --- | --- |
| Loading | Preserve the Contributions sections and reserve the docked desktop inspector because the populated ready state auto-selects. Do not wait for `id` and do not auto-open a side or bottom sheet. Use one polite loading announcement. |
| Initial populated | Select the oldest available contribution synchronously, then reconcile the URL. The inspector never flashes empty. |
| Selecting | Tone and mark the row busy immediately; mount the matching detail skeleton in the current presentation before navigation resolves. |
| Populated | Show only kind-relevant submitted details, new-value state, human time and one decision region. |
| Approving | Change only the submitted action label, disable duplicate decisions, preserve selection, and announce the outcome concisely. |
| Rejecting | Open the cascade confirmation first; while settling, preserve the selected context and identify the submitted action. |
| Settled | Remove the item, rebalance sections, advance URL and selection, and place focus predictably. |
| Conflict | Keep the item visible until fresh data resolves; say that someone already handled it and offer a safe refresh. |
| Empty | Use the quiet workspace anatomy: `Nothing awaiting review` and `New contributions will appear here.` Do not add an elevated success card. |
| Partial | State what is shown without claiming the bounded client set is the global end. Preserve a visible load path when one exists. |
| Error | Preserve the shell, say `Couldn't load contributions`, offer `Try again`, and keep diagnostics private. |
| Denied | Keep the fail-closed access boundary. Do not render decision controls and do not describe internal permission implementation. |
| Long or high-count | Preserve complete accessible names, stable card measure, bounded pagination, selection, and a reachable final action. |

The responsive evidence matrix is `390 × 844`, `600 × 900`, `1000 × 800`,
`1300 × 900`, `1440 × 900`, and `320px` at `200%` zoom. At `1300` and `1440`
the inspector is a sibling plane with its own scroll and anchored decision
region. At `1000` it is a right side sheet. At `600` and `390` it is a bottom
sheet. The page remains the primary task beneath every temporary inspector.

Overlay review proves a visible selected-subject title without a redundant
generic heading, a close control, focus containment, body scroll lock, Escape
and safe outside dismissal, independent inspector scrolling, reduced motion,
and exact trigger-focus return. A settled item cannot receive returned focus;
focus moves to the next selected row. A breakpoint change cannot duplicate the
selected contribution in the accessibility tree or strand focus in an
unmounted overlay.

The trial is not accepted from screenshots alone. Its handoff includes typed
projection tests, unique membership and keyboard-order tests, settlement
rebalance tests, bounded-completeness tests, safe-error tests, loading-contract
tests, button and surface source contracts, and the complete browser matrix
above. Until product review accepts that evidence, agents may inspect the
trial's principles but must not cite its route-specific sections, copy, or
geometry as canonical.

## Cross-route adoption harness

Observations and Overview form the first reference pair only after product
review accepts both. Observations tests record-level triage. Overview tests
queue-level briefing. Their shared principles are the candidate system; their
route-specific layouts are not templates.

Once accepted, assign one different operational mode at a time to another
agent:

1. one triage route, such as Contributions;
2. one monitor route, such as Activity or Signals;
3. one manage route, such as Retailers or Operators.

Each agent receives the lane packet below. The purpose is to test whether the
guardrails transfer across different jobs without producing copied screens.

```text
Route:
One named Ops route.

Mode:
Briefing | Triage | Monitor | Manage

Operator job:
One sentence describing the decision or understanding this route must enable.

Reference inputs:
ADR 0009
ADR 0010
OPS_UI_CANON.md
OPS_SHELL.md
accepted Observations and Overview browser evidence

Reuse:
shell planes, tokens, typography, voice, overlay behavior, focus behavior,
loading fidelity, truthful data labels, and existing interaction primitives

Do not copy:
route-specific sections, card counts, product imagery, queue projections,
decision controls, auto-selection, auto-advance, or query-state behavior unless
the new route's job requires them

Before editing:
inventory real data, current actions, permissions, URL state, loading and error
states, dirty files, and protected dependencies

Required proposal:
state what remains on-page, what enters the inspector, what becomes progressive
disclosure, what may open a side or bottom sheet, and why each element changes
the operator's next decision

Required states:
loading, populated, empty, partial, stale, error, denied, long content, high
counts, and the route's consequential pending and settled states

Required viewports:
390x844, 600x900, 1000x800, 1300x900, 1440x900, and 320px at 200% zoom

Required evidence:
before and after browser captures
keyboard-only walkthrough
light and dark review
reduced-motion review
focus, scroll, Escape, dismissal, and focus-return proof for overlays
native semantics check
lint, typecheck, focused tests, full tests, build, and git diff --check
```

### Harness score

Review each trial against six questions:

1. **Job clarity** — can an operator identify the route's job and next useful
   action in about five seconds?
2. **Data integrity** — does every visible claim come from a typed source with
   appropriate freshness, confidence, and permission?
3. **Structural integrity** — are desktop planes true siblings, and do side or
   bottom sheets preserve the primary task at smaller widths?
4. **Interaction integrity** — does every control respond, preserve selection,
   communicate pending or settled state, and provide a safe recovery path?
5. **Visual integrity** — do spacing, typography, tone, and content create the
   hierarchy without nested cards, unnecessary borders, heavy weights, or
   ornamental glass?
6. **Adaptation quality** — does the route feel related to the reference pair
   without copying a layout that does not fit its job?

An agent does not mark a trial canonical. Product review accepts, revises, or
rejects it. Any rule that repeatedly needs an exception is revised in this ADR
before another route inherits it. After one successful route from each mode,
the reference pair and surviving shared rules may graduate from candidate to
canonical.

## Review checklist

- [ ] The route mode is declared and its primary job is obvious.
- [ ] Overview stays a briefing and queue routes stay record-triage workspaces.
- [ ] On desktop, Overview is sidebar → selectable queue workspace → contextual inspector.
- [ ] Up next shows at most two real oldest records from the one recommended queue.
- [ ] Every record preview link opens that exact record in its canonical queue.
- [ ] Queue rows select context; the inspector has one real canonical-route action.
- [ ] No queue tile grid, nested card stack, embedded decision form, or record-level moderation action ships.
- [ ] Recommendation policy is typed, tested, permission-aware, and explained.
- [ ] All accessible queues remain visible, including quiet zero states.
- [ ] Counts, timestamps, status, freshness, and confidence labels are truthful.
- [ ] No placeholder data, sample activity, no-op control, orphan ARIA option, or vanity metric ships.
- [ ] Manrope, light weights, sentence case, and short human copy are used.
- [ ] Spacing and tone do more work than borders, shadows, pills, or glass.
- [ ] Loading, clear, partial, stale, error, denied, and populated states preserve the same hierarchy.
- [ ] Phone, touch, compact, balanced, and expanded compositions preserve the same reading order.
- [ ] Tablet right sheets and mobile/touch bottom sheets trap focus, lock background scroll, support Escape and safe dismissal, and restore focus.
- [ ] Keyboard, focus, contrast, zoom, reduced motion, dark mode, text-over-image contrast, and packshot containment pass.
- [ ] Protected shell, queue, data, and public-surface contracts remain unchanged.
- [ ] Automated and browser evidence is included in the handoff.

If any applicable answer is no, the page is not ready to become a reference for
the next operations route.

## Consequences

- Overview becomes useful without becoming record triage or a generic
  dashboard.
- Operators retain a stable mental map while receiving one clear recommendation.
- Queue pages can inherit the Observations work grammar without forcing that
  composition onto monitor and manage pages.
- Data policy becomes inspectable and testable instead of being hidden in route
  branches.
- Some visually impressive widgets will be rejected because they do not improve
  an operational decision. That is intentional.
- A small typed read model and route-owned states add implementation work, but
  they prevent heavier queue reads, misleading counts, and repeated redesign.

## Alternatives rejected

- **Keep the tile dashboard.** Rejected: equal cards flatten priority, encourage
  vanity metrics, and resemble a generic admin template.
- **Render the first non-empty queue on Overview.** Rejected: the page identity
  changes with data, topology disappears, and priority has no defensible reason.
- **Allow decisions directly from Overview.** Rejected: it duplicates triage,
  weakens canonical URLs, and crowds a briefing with evidence and action state.
- **Copy the Observations route exactly.** Rejected: Overview reuses its
  split-view grammar but not record evidence, decision controls, URL selection,
  density, or auto-advance behavior.
- **Use more glass, borders, or charts to make Ops feel premium.** Rejected:
  premium operations UI comes from deference, clarity, truthful data, and
  predictable behavior.
