# Dyrane Ops UI Canon

Status: canonical desktop pattern

## Reference implementation

`/ops/observations` is the canonical queue implementation for Contributions, Edges, Vocabulary, Retailers, and future operational queues.

The operations console is a calm working instrument, not a marketing surface or generic admin dashboard. Public JeloCare surfaces may be editorial and expressive; Ops remains warm-neutral, precise, restrained, and immediately readable during long sessions.

## Canonical anatomy

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

- Desktop uses a dense multi-column collection.
- Product image, title, supporting value, time, and disclosure affordance form one scan unit.
- Hover and selection use restrained tonal surfaces.
- Titles and supporting values remain one line where possible.
- Queue rows may use structural separators; the inspector may not.

## Selection and advancement

### Selection

A work queue with available items always has an active selection. The inspector is never empty while actionable work remains.

When no valid URL selection exists, the first item is selected automatically. A stale or invalid `?id=` value is replaced by the first available row without a full reload or scroll reset.

### Advancement

Completing an item automatically advances to the next logical item. The item moving into the settled index is preferred; when none remains, the previous item is selected. Operators must not repeatedly re-enter the queue by clicking.

An empty inspector is valid only when the queue has no remaining items.

### Shared state API

`InboxContainer` owns canonical selection and optimistic queue state. Queue pages communicate successful settlements through the typed `OpsInboxController` contract.

Mutable `window` globals, custom DOM data channels, timer-based synchronization, and duplicated queue state are prohibited.

## Inspector

The right pane is one continuous inspector plane, not a stack of cards.

Hierarchy is created through:

- 24–32px spacing between major sections
- 8–12px spacing between a heading and its content
- typography
- alignment
- restrained semantic surfaces

Internal borders, divider lines, shadows, and outlined containers are prohibited.

Canonical order:

1. Observation or entity header
2. Product or subject summary
3. Evidence
4. Collapsed Metadata disclosure
5. Decision

Decision-critical information stays visible. Contribution IDs, observation IDs, database references, and other implementation metadata remain available through a collapsed native `<details>` disclosure and remain copyable.

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

## Synchronization and observability

Queue state, selected detail, sidebar counts, activity, signals, and overview metrics form one operational system.

Every moderation action calls:

```ts
revalidateOpsSurfaces(queuePath)
```

The contract revalidates:

- the affected queue
- `/ops` overview data
- the `/ops` layout and sidebar counts
- `/ops/activity`
- `/ops/signals`

The database remains the source of truth. Optimistic removal improves continuity only after a successful server action; failed actions preserve the current item and selection.

## Accessibility

- URL state represents explicit selection where the route supports it.
- Collection items expose listbox/option semantics and `aria-selected`.
- Keyboard navigation remains available.
- Focus-visible treatment remains distinguishable without introducing decorative borders.
- Metadata uses native `details` and `summary` semantics.
- Color is never the only state indicator.

## Canonical reusable primitives

Current shared contracts:

- `InboxContainer`
- `OpsInboxController`
- shared collection rows
- shared inspector typography and property styles
- shared metadata disclosure
- shared decision button and rationale styles
- `revalidateOpsSurfaces()`

Target component vocabulary as reuse becomes concrete:

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
- Headings use title case.
- Internal IDs are collapsed under Metadata.
- Approve uses JeloCare primary tokens.
- Reject uses a destructive tonal surface with no border.
- Buttons are slender squircles.
- Pending labels identify the submitted action.
- Sidebar counts, activity, signals, and overview data revalidate together.
- Relevant tests and the production build pass.

If any answer is no, the page is not canonical.
