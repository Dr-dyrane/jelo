# Dyrane Ops UI Candidate Contract

Status: Draft — Observations is under joint product review

## Reference candidate

`/ops/observations` is the current queue prototype for testing Contributions,
Edges, Vocabulary, Retailers, and future operational work. It is not yet an
approved template. Database shape is input to the design; it does not dictate
the operator experience.

The operations console is a calm working instrument, not a marketing surface or generic admin dashboard. Public JeloCare surfaces may be editorial and expressive; Ops remains warm-neutral, precise, restrained, and immediately readable during long sessions.

The candidate is a workflow grammar, not a page template. Briefing, monitor,
and manage routes reuse its typography, surfaces, state integrity, and
responsive discipline. A route earns a collection and inspector only when a
selection materially changes the operator's next decision.

[`/ops` Overview has its own accepted contract](./adr/0010-operations-interface-and-overview-contract.md).
It uses the same split-view grammar at **queue level**: selectable queue rows
in the workspace and the selected queue's context in the inspector. A maximum
two-record `Up next` shelf may preview real records from the recommended queue;
it never embeds moderation controls, and it is never a tile dashboard.

## Adaptive shell law

Desktop, tablet, and mobile consume the same operational primitives but use different compositions. Tablet is not a compressed desktop breakpoint.

- Desktop (`>=1180px`) supports simultaneous cognition: persistent navigation,
  a main workspace collection, and a contextual inspector remain visible
  together. This is the native **three-column split view**.
- Tablet (`820–1179px`) supports progressive cognition: navigation remains
  available through the shell, the collection owns the workspace, and selected
  context opens in a right side sheet. It is not a compressed third column.
- Mobile and touch (`<820px`) retain one primary plane. Selected context opens
  in a bottom sheet; no side sheet is squeezed into the page.

Shared primitives remain stable across shells:

- `OpsCollection`
- `OpsCollectionItem`
- `OpsInspector`
- `OpsMetadataDisclosure`
- `OpsDecisionActions`
- `OpsInboxController`

Only composition, density, and presentation change.

## Native split-view rule

Operations follows the macOS working pattern: **sidebar → main workspace →
contextual inspector**. The panes are related work surfaces, not three cards
placed beside one another.

- The sidebar is navigation and durable orientation only.
- The main workspace is where scanning, selection, and list-level navigation
  happen. Repeated operational facts are rows, not dashboard tiles.
- The inspector is the selected item's context, evidence, status, and the next
  reachable action. It is a continuous plane, never a stack of mini-cards.
- A route may omit the inspector only when selection adds no useful context. It
  does not replace it with nested accordions or a decorative metrics grid.
- Apple Music may inform the calm canvas, persistent navigation, information
  density, and contextual side area. It must not be copied as a gallery of
  album-like cards, oversized imagery, a player treatment, or a literal visual
  theme.

## Candidate anatomy

Top-level workspace headers name the location once: `Overview`,
`Observations`, `Contributions`, and so on. Do not generate explanatory
subtitles, queue totals, freshness labels, or state prose beneath them. Put
those facts in the section or inspector that owns them. Loading skeletons must
preserve the same single-line header geometry.

Every queue page follows the same system:

1. Navigation instrument
2. Workspace heading
3. Scan-oriented collection
4. Contextual inspector
5. Decision actions

Do not design queue pages as independent screen systems.

## Surface hierarchy

There are four surface levels:

- Environment: outer ops canvas
- Workspace: primary reading and working plane
- Surface: stable repeated content or controls
- Floating: navigation chrome, menus, sheets, popovers, and toasts

Glass is reserved for floating chrome. Repeated rows and inspector sections do not use glass, blur, decorative elevation, or card outlines.

## Collection

### Desktop

- Uses one canonical ordered queue rendered through a mixed-density projection
  when the data benefits from it.
- A shallow `Up next` shelf may feature the oldest two actionable records.
  Remaining price observations use compact rows. Experience observations may
  use a quiet horizontal rail when product imagery materially improves
  recognition.
- Every projection is presentational only. It must use the same canonical item,
  selected ID, URL state, keyboard order, inspector, and settlement controller.
  A record may never appear twice.
- Product image, title, supporting value, time, and disclosure affordance form
  one scan unit.
- Hover and selection use restrained tonal surfaces.
- Titles and supporting values remain one line where possible.
- Queue rows may use structural separators; the inspector may not.
- A queue-level overview uses the same selectable-row treatment. Its selected
  inspector explains that queue and links to its canonical route; it does not
  contain item-level approve, reject, map, or bulk controls.
- Overview may lead with at most two oldest records from the one recommended
  actionable queue. Each preview uses an exact title, one useful fact, age, and
  optional display-approved packshot. Its URL must select that exact record in
  the canonical queue; otherwise the preview link is not permitted.
- Overview may arrange those semantic rows in two columns at `600px` and above
  when full queue names and waiting context remain visible. Below that width it
  returns to one column. Only the small recognition surface is toned by
  default; the full row receives a surface when selected, hovered, or focused.

### Tablet

- Uses content-driven density rather than one forced column count.
- Under `600px`, a shallow feature shelf may become a horizontal rail with a
  fixed readable card width and visible continuation cue. Compact text rows
  use one column.
- From `600–819px`, feature and compact groups may use two columns when their
  complete labels remain readable.
- From `820–1179px`, the collection remains the primary workspace and selected
  context moves to a side sheet.
- Density comes from measured negative space, not oversized typography or
  truncated copy.
- The collection remains visible beneath the inspector stage so operators retain positional context.

## Selection and advancement

### Selection

A work queue with available items always has an active selection. The inspector is never empty while actionable work remains.

When no valid URL selection exists, the first item is selected automatically. A stale or invalid `?id=` value is replaced by the first available row without a full reload or scroll reset.

On tablet, automatic selection maintains state but does not force the inspector stage open. Tapping or keyboard-opening a row presents the selected item.

### Advancement

Completing an item automatically advances to the next logical item. The item moving into the settled index is preferred; when none remains, the previous item is selected.

- Desktop keeps the inspector populated with the next item.
- Tablet dismisses the inspector stage after a decision while preserving the next active selection underneath.
- Operators return to the collection with clear context and may open the next selected item deliberately.

An empty inspector is valid only when the queue has no remaining items.

### Shared state API

`InboxContainer` owns canonical selection and optimistic queue state. Queue pages communicate successful settlements through the typed `OpsInboxController` contract.

Mutable `window` globals, custom DOM data channels, timer-based synchronization, and duplicated queue state are prohibited.

### Semantics

Use a native interactive element for each selectable row. A row that navigates
is a link; a row that changes in-place context is a button with a stable
accessible name and selected-state announcement. If a future collection uses
`listbox`/`option` semantics, every `option` must remain owned by that listbox.
Do not leave orphan `aria-selected`, `role=option`, or keyboard handlers on
decorative containers. No action-shaped affordance may be a no-op.

## Tablet navigation

Tablet navigation uses the full labelled sidebar as a 280px overlay rather than an icon-only rail.

- A persistent tablet header exposes the current destination and pending count.
- The menu control opens and closes the sidebar.
- Selecting a destination or pressing Escape dismisses the sidebar.
- A restrained scrim preserves workspace context.
- The desktop sidebar remains unchanged at desktop widths.

## Tablet inspector stage

The tablet inspector is a floating right-side stage, not a squeezed third column and not a generic drawer.

- It slides from the right with an interruptible, reduced-motion-aware transition.
- The collection remains visible beneath it.
- It has an explicit close control and scrim dismissal.
- Metadata remains collapsed.
- Decision actions remain sticky near the bottom and respect safe-area insets.
- Touch controls target at least 44px while retaining canonical squircle geometry.
- The inspector remains borderless internally.

## Overlay contract

The primary task stays on the page. Secondary context uses one focused overlay,
not a new layer of nested DOM panels.

| Context | Presentation |
| --- | --- |
| Desktop (`>=1180px`) | Persistent inspector for selection; right side sheet for temporary secondary detail. |
| Tablet (`820–1179px`) | Right side sheet for selected context; preserve the collection underneath. |
| Mobile and touch (`<820px`) | Bottom sheet; preserve the current page and safe-area space. |

Every sheet or modal has a visible title and close control, traps focus while
open, locks background scrolling, dismisses with Escape where a keyboard is
present, supports safe outside dismissal when the task is not destructive,
keeps its own body scrollable, respects reduced motion, and returns focus to
the exact trigger. A control that opens an overlay must expose that relationship
and must remain reachable at keyboard, touch, and 200% zoom.

## Inspector

The right pane is one continuous inspector plane, not a stack of cards.

On docked desktop, it is a direct sibling of the workspace inside the shell,
not a descendant of the workspace card. The shell remains `100dvh`; workspace
and inspector scroll independently. Within a decision inspector, evidence and
metadata use the scrolling body while the decision region remains anchored at
the bottom.

Hierarchy is created through:

- 24–32px spacing between major sections
- 8–12px spacing between a heading and its content
- typography
- alignment
- restrained semantic surfaces

Internal borders, divider lines, shadows, and outlined containers are prohibited.

Do not place an inspector section inside an additional card merely to create
separation. Use spacing, an aligned property list, muted labels, and a single
subtle semantic surface only where a distinct state needs it. Text on imagery
or translucency is permitted only after checking the worst contrast point; when
that contrast cannot be guaranteed, place the text on an opaque surface beside
the image instead.

Candidate order:

1. Product or subject identity
2. Evidence
3. Collapsed Metadata disclosure
4. Decision

Decision-critical information stays visible. Contribution IDs, observation IDs, database references, and other implementation metadata remain available through a collapsed native `<details>` disclosure and remain copyable.

Do not repeat the record type as an inspector eyebrow when the route and
selected content already establish it.

## Typography

- Section headings use title case or sentence case.
- All-caps labels are not part of the JeloCare interface language.
- Hierarchy comes from weight, size, spacing, color, and placement—not capitalization.
- IDs may use monospace through the canonical ID primitive.

## Actions

Button hierarchy is expressed through surface tokens, tone, typography, and state—not borders.

### Primary

Approve uses the canonical brand surface and foreground:

```css
background: var(--accent-solid);
color: var(--on-accent);
border: 0;
```

### Destructive secondary

Reject uses the subtle destructive surface and destructive foreground:

```css
background: var(--state-danger-bg);
color: var(--state-danger);
border: 0;
```

Reject must not use a red outline or compete equally with Approve.

### Geometry

- Decision controls target 34–36px desktop height.
- Tablet touch actions target at least 44px.
- Controls use the canonical ops squircle radius.
- Oversized pills are prohibited for ordinary buttons.
- Pills remain reserved for statuses, filters, and true capsule controls.

### Pending state

Only the submitted action changes label:

- `Approving…`
- `Rejecting…`
- `Mapping…` where applicable

Both controls are disabled during settlement to prevent duplicate decisions.

## Forms

Rationale and mapping controls use subtle semantic surfaces, squircle geometry, and accessible focus treatment. They do not use traditional control borders.

## Media integrity

Operations may show product media for recognition, but it never rewrites the
truth of a package.

- Use the approved transparent exact-packshot asset and preserve its alpha,
  proportions, orientation, label, and crop. `object-fit: contain` is the
  default; do not crop or mask a packshot to make a row look tidier.
- Do not put a transparent packshot on an opaque white product canvas or alter
  it with filters, generated overlays, or decorative geometry.
- Editorial photography is not a substitute for product evidence. If it is
  informative, text remains beside it or on a contrast-tested opaque surface.
- A UI lane may change presentation only. Source identity, package matching,
  licensing, and publication approval remain the product-media lane's work.

## Loading states

Loading fallbacks mirror the final shell rather than replacing it with a generic spinner.

- Observations renders the exact final hierarchy: two `Up next` feature
  placeholders, compact price rows, and the experience rail.
- The inspector skeleton portals into `#ops-detail-pane` and mirrors subject
  identity, evidence, metadata, and the anchored decision region.
- Selecting a row updates its selected state and mounts that same inspector
  skeleton in the current pane immediately. URL-backed content replaces it
  when navigation resolves; a click never leaves an unexplained blank pane.
- Side-sheet and bottom-sheet breakpoints do not flash an inactive docked
  inspector while the route loads.
- Motion preferences control shimmer behavior.

## Synchronization and observability

Queue state, selected detail, sidebar counts, activity, signals, and overview metrics form one operational system.

Every moderation action calls the centralized revalidation contract, which refreshes:

- the affected queue
- `/ops` overview data
- the `/ops` layout and sidebar counts
- `/ops/activity`
- `/ops/signals`

The database remains the source of truth. Optimistic removal improves continuity only after a successful server action; failed actions preserve the current item and selection.

## Accessibility

- URL state represents explicit selection where the route supports it.
- Collection items use native buttons for in-place selection and native links
  for navigation.
- Keyboard navigation remains available.
- Focus-visible treatment remains distinguishable without introducing decorative borders.
- Metadata uses native `details` and `summary` semantics.
- Sheets and inspector stages satisfy the full overlay contract: dialog
  semantics, focus trap, body scroll lock, Escape dismissal, safe close path,
  and trigger-focus restoration.
- Color is never the only state indicator.

## Canonical reusable primitives

Current shared contracts:

- `OpsChrome`
- `InboxContainer`
- `OpsInboxController`
- shared collection rows
- shared inspector typography and property styles
- shared metadata disclosure
- shared decision button and rationale styles
- centralized ops revalidation

Target component vocabulary as reuse becomes concrete:

- `OpsShellDesktop`
- `OpsShellTablet`
- `OpsShellMobile`
- `OpsWorkspace`
- `OpsCollection`
- `OpsCollectionItem`
- `OpsInspector`
- `OpsInspectorSection`
- `OpsPropertyList`
- `OpsMetadataDisclosure`
- `OpsDecisionActions`

Do not create abstractions only for naming symmetry. Extract them when at least two real queues share the same behavior and anatomy.

## Review checklist

Before shipping an Ops queue, confirm:

- Work auto-selects while rows remain.
- Invalid selection recovers automatically.
- Successful decisions auto-advance without an empty flash.
- No mutable global bridge is used for state communication.
- The inspector is one continuous plane without borders or dividers.
- Interface headings use natural sentence case.
- Internal IDs are collapsed under Metadata.
- Approve uses JeloCare primary tokens.
- Reject uses a destructive tonal surface with no border.
- Buttons are slender squircles on desktop and touch-safe on tablet.
- Pending labels identify the submitted action.
- Responsive collection density preserves complete labels: compact rows use
  one column below `600px`, feature shelves retain a readable fixed measure,
  grouping remains content-driven through `819px`, and selected context uses a
  side sheet from `820–1179px`.
- Desktop uses three sibling planes with independent workspace and inspector
  scrolling.
- Sidebar counts, activity, signals, and overview data revalidate together.
- Loading states mirror the final shell.
- Relevant tests and the production build pass.
- The desktop composition is sidebar → workspace → inspector, not a row of
  nested cards or dashboard tiles.
- The inspector is outside the workspace wrapper and its decision region stays
  reachable while long evidence scrolls.
- Tablet uses a side sheet and mobile/touch uses a bottom sheet for temporary
  context; focus, scroll, Escape, and return behavior are proven.
- Every row, menu item, and visible action has correct native semantics and a
  working outcome; no orphan ARIA option or no-op control remains.
- Transparent packshots remain uncropped, unaltered, and legible on their
  actual surface; text-over-image contrast is checked at its worst point.

If any answer is no, the page is not ready for product acceptance.
