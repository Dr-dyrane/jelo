# Operations shell

The operations console is a private working environment. Its shell provides orientation and navigation without competing with the queue or detail work inside it.

## Desktop composition

Desktop uses a native three-column split view inside a quiet operations canvas:

- The left sidebar is the instrument plane. It holds account controls, navigation, queue counts, and appearance controls.
- The main workspace is the scan-and-select plane. It is inset on every side,
  with a continuous rounded boundary created by surrounding canvas, tonal
  difference, and restrained elevation rather than a visible border.
- The contextual inspector is the detail plane for the current selection. It
  remains a single continuous working surface, not a stack of internal cards.
  A route that has no selection may omit it; it must not add dashboard tiles to
  occupy the space.

The sidebar, workspace, and inspector are related planes, not three cards. The
gaps between them are intentional cognitive space, not dividers. Nested sidebar
instrument surfaces use `--ops-instrument-inner-radius`, derived from the shell
radius minus sidebar padding, so account, navigation, and account-summary curves
remain concentric with the sidebar.

### Desktop DOM and scroll law

At `>=1180px`, the three planes are direct siblings inside
`[data-ops-shell]`:

```text
[data-ops-shell]
├── [data-ops-sidebar-layer]
├── [data-ops-workspace]
└── [data-ops-detail]
```

The inspector must not descend from the rounded workspace wrapper. Nesting it
there turns two work planes into one card and prevents reliable independent
scrolling.

The Ops root is one fixed `100dvh` viewport boundary at every width and never
scrolls the document. Do not nest viewport roots or allow the page body to
become a fallback scroll owner. The workspace owns route scrolling; the
inspector owns its independent detail scrolling. On touch and phone widths the
workspace wrapper remains exactly `100dvh` with `min-height: 0`, so long route
content scrolls inside the main plane while floating navigation stays fixed.
Viewport shells use `overflow: clip`, not `overflow: hidden`: a hidden-overflow
element remains programmatically scrollable and focus helpers can displace the
entire fixed shell even when no scrollbar is visible.
Inside a decision inspector, evidence and metadata scroll while the decision
region remains anchored at the bottom. Empty inspector space is intentional;
do not fill it with duplicate headings, decorative cards, or repeated
record-type labels.

Routes portal selected context into the shell-owned detail plane. This keeps
selection state and focus behavior shared while preserving the structural
separation of the three planes.

Loading preserves the same plane contract. A queue that selects its first
available record in the ready state reserves the desktop inspector skeleton
while its read model resolves; it does not wait for the later `id` URL update.
Temporary inspectors stay interaction-driven, so tablet side sheets and mobile
bottom sheets do not appear merely because the route is loading.

Interface copy names the operator's task, not the implementation. Schema
versions, payload keys, UUIDs, SQL, query parameters, backend names, provider
names, and raw enum values stay out of headings, states, messages, and controls.
When one is essential for diagnosis, disclose it deliberately under
`Metadata` or audit detail.

The sidebar names the `Operations` environment once, separates actionable `Triage` from read-only `Monitor` navigation, and keeps the account trigger person-first. Brand text does not appear inside the account trigger.

`Triage` contains contributions, edges, observations, vocabulary, and retailer applications. `Monitor` contains queue overview, decision history, and commerce signals. Admins also receive a `Manage` group with the read-only operator directory; it does not expose access mutations until those actions can be audited under the console trust boundary.

Desktop sidebar identity, context, group labels, links, and selected links use medium weight. Selection is communicated by tone and surface, not a heavier face. Semibold is reserved for the small avatar initials, where compact glyphs need additional clarity.

## Workspace and local-tab plan

The right-hand workspace is the operational content area. Its future reusable frame shares **semantic slots**, data contracts, and interaction rules across screen sizes; it must not force desktop, tablet, and mobile into one scaled-down visual composition.

The frame will accept a page context slot, an optional local-tab slot, a primary work slot, and an optional record-detail slot. Each queue or management area decides which slots it needs. The sidebar remains the only top-level console navigation.

Local tabs are sibling views within the active workspace destination. They are not a replacement for the sidebar and must map to durable, shareable URL state. A tab is appropriate only when its view has a distinct query, workflow stage, or permission-aware responsibility. Decorative status tabs are prohibited.

The planned presentations are:

- **Desktop (`>=1180px`):** persistent sidebar, main workspace, and contextual inspector when selection changes useful context. The inspector holds evidence, rationale, decisions, or queue context as appropriate.
- **Tablet (`820–1179px`):** keep the workspace readable; selected context opens in a temporary right side sheet. Do not simply compress desktop columns until they are unreadable.
- **Mobile and touch (`<820px`):** one operational task at a time. Queue list and selected record use a deliberate bottom-sheet flow; decisions remain focused and full-width. Collection density remains content-driven: phone widths under `430px` use one column; the `430–599px` band may keep a shallow two-column feature shelf while compact text rows remain one column; from `600px`, compact rows may use two columns when labels remain readable. Local tabs use a scrollable accessible tab row only when the views remain necessary on mobile; otherwise the destination exposes the highest-priority view and explicit filters.

The first reusable frame will support triage detail work: a queue list, a selected record, evidence, decision rationale, and guarded decision actions. Retailer workflow tabs become the first candidate only after applications and verification have independent read models. Existing queues remain single-view until their real historical or workflow state exists.

## Material hierarchy

`--ops-canvas` is the environmental layer.

`--ops-workspace` is the solid, legible working plane.

`--ops-instrument` is the lucent sidebar material. It may use a small backdrop blur when the browser supports it, but it must remain usable without blur.

Menus are transient surfaces. They emerge from their trigger and use the workspace surface so glass does not stack on glass.

The private shell uses low-chroma mineral surfaces, not the public product palette. `--ops-accent` is a muted umber selection and focus colour; semantic status colours remain reserved for actual operational state.

Semantic colour is reserved for active navigation, counts, focus, and consequential actions. It does not decorate the shell.

## Tokens and ownership

Global shell tokens live in `app/globals.css` because light and dark themes must resolve them consistently:

- `--ops-canvas`
- `--ops-instrument`
- `--ops-workspace`
- `--ops-surface-subtle`
- `--ops-ink`
- `--ops-muted`
- `--ops-workspace-shadow`
- `--ops-instrument-shadow`
- `--ops-floating-shadow`
- `--ops-accent`
- `--ops-accent-subtle`
- `--ops-focus-ring`
- `--ops-shell-inset`
- `--ops-sidebar-width`
- `--ops-shell-radius`
- `--ops-instrument-inner-radius`
- `--ops-control-height`
- `--ops-control-radius`

At the desktop operations boundary, `app/(ops)/ops.module.css` aliases shared semantic values such as ink, muted text, selected state, subtle surfaces, and focus to this private token family. Public routes retain their existing values.

`components/ops/shell/OpsSidebar.tsx` owns the reusable desktop sidebar structure and its interaction state. `components/ops/shell/OpsChrome.tsx` owns route-aware navigation data and the responsive shell. `app/(ops)/ops.module.css` owns the route-specific desktop composition.

## Interaction rules

Navigation controls use native links, compact labels, visible focus, and a stable selected state. The account popover contains identity, role, decisions today, the latest action time, and the working sign-out action. Appearance choices persist through the shared `jelo-theme` preference.

`lib/moderation/sidebar-summary.ts` resolves the operator's display identity and audit activity from `moderation_operators` (`display_name`, `email`) and `moderation_audit_log` (current operator decisions today and latest action). It is resolved at the server layout boundary and passed through the shell as `OpsSidebarSummary`; the client sidebar does not own this data.

The sidebar stays an instrument. Queue rows, decision forms, and other operational content belong to the workspace and should not be added to the shell.

### Phone contextual action

Phone composition always reserves the separate circular FAB beside the bottom
navigation bar. It is contextual, never decorative:

- queue routes open the current selected record;
- Overview opens the selected queue context;
- read-only routes refresh their own current data when no stronger action
  exists;
- an empty queue refreshes that queue rather than inventing a creation action.

The route registers the strongest real action through `ShellContext`. The shell
provides only a route-labelled refresh fallback while route content loads or
when no more specific action exists. Generic `Stats`, `New`, `Export`, or other
placeholder actions are prohibited.

### Overlay integrity

Temporary inspector context uses a right side sheet on tablet and desktop where
the workspace must remain visible, and a bottom sheet on mobile/touch. Every
overlay has a title and close control, traps focus, locks background scrolling,
responds to Escape where available, supports safe outside dismissal,
independently scrolls when long, honors reduced motion, and returns focus to
its exact trigger. Do not replace this behavior with nested dropdowns,
accordion-in-accordion panels, or action-shaped controls that do nothing.

The same selected record renders in only one inspector presentation at a time:
docked plane, side sheet, or bottom sheet. Breakpoint changes must not duplicate
the record in the accessibility tree or leave an off-screen dialog interactive.

### Queue trial admission

A route does not become a shell reference by resembling Observations. Every
trial first declares its operator job, typed presentation, decision meaning,
responsive anatomy, data states, and recovery behavior in its ADR lane packet.
The shell provides planes, overlay mechanics, selection context, and the phone
FAB; the route remains responsible for truthful projection, kind-specific
content, action consequences, and safe copy.

`/ops/contributions` is the first reviewed triage transfer candidate. Its
detailed contract lives in
[ADR 0010](../adr/0010-operations-interface-and-overview-contract.md#contributions-trial-contract).
Until the declared browser and automated evidence passes product review, it is
not canonical and must not be copied as a page template.

The shared shell enforces these admission rules:

- an auto-selecting populated queue reserves its docked desktop inspector
  during loading without waiting for URL timing; temporary sheets remain
  closed until a real interaction opens them;
- the selected item exists in only one presentation and one accessibility-tree
  position at a time;
- rendered collection order and keyboard order agree, including after
  grouping, pagination, and settlement;
- selection, pending state, URL, inspector content, and contextual FAB identify
  the same record;
- a successful settlement returns focus to the next selected record; a failed
  action preserves selection and exposes a safe recovery;
- docked evidence scrolls independently while the decision region remains
  anchored; temporary inspectors contain focus, lock background scrolling, and
  restore it to a valid trigger;
- touch close, rail, navigation, and decision controls provide at least a
  `44 × 44` CSS-pixel target while desktop actions retain their slender
  geometry;
- interface actions use direct verbs and shared tokens. Technical error text,
  raw payloads, schema values, provider parameters, and attribution identifiers
  do not enter shell headings, controls, states, or feedback.

Attribution may appear only as a human provenance fact inside a route-owned
`Metadata` disclosure. It never changes shell priority, selected state, colour,
confidence, or available decisions.

Each trial is checked at `390 × 844`, `600 × 900`, `1000 × 800`,
`1300 × 900`, `1440 × 900`, and `320px` at `200%` zoom. Evidence includes
loading, empty, partial, error, denied, pending, settled, long-content, and
high-count states as applicable. Screenshots alone do not establish focus,
scroll ownership, keyboard order, action feedback, or acceptance.

## See also

- [Responsive shell evolution](../operations/console/RESPONSIVE_SHELL_HISTORY.md) — the implementation history and load-bearing constants for the current desktop, tablet, and mobile shells.
