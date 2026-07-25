# Dyrane Ops UI Canon

Status: canonical desktop pattern

## Reference implementation

The Observations page (`/ops/observations`) is the canonical reference implementation for all queue pages: Contributions, Edges, Vocabulary, Retailers, and future operational queues.

## Purpose

The operations console is a calm working instrument, not a marketing surface and not a generic admin dashboard. It should feel precise, native, restrained, and immediately readable during long sessions.

Public JeloCare surfaces may be warm, editorial, and expressive. Ops remains warm-neutral and functional, using the JeloCare accent only for identity, focus, and active state.

## Canonical page anatomy

Every queue page follows the same structure:

1. Navigation instrument
2. Workspace heading
3. Scan-oriented collection
4. Contextual inspector
5. Decision actions

Do not design Contributions, Edges, Vocabulary, Retailers, or future queues as independent screen systems. They inherit this anatomy.

## Surface hierarchy

There are four surface levels:

- Environment: outer ops canvas
- Workspace: primary reading and working plane
- Surface: stable repeated content or controls
- Floating: navigation chrome, menus, sheets, popovers, and toasts

Glass is reserved for floating chrome. Repeated list items do not use glass, blur, or decorative elevation.

## Collection pattern

The observation collection is the canonical queue pattern.

- Desktop uses a dense multi-column list.
- Rows use hairline separators and consistent rhythm.
- Product image, title, supporting value, time, and disclosure affordance form one scan unit.
- Hover is a faint tonal wash.
- Selected state is restrained and should not overpower the inspector.
- Titles and supporting values remain one line where possible.

## Selection and advancement

### Selection
A work queue with available items always has an active selection. The inspector is never empty while actionable work remains. When the queue loads and no valid selection exists in the URL, the first item is auto-selected. An invalid URL selection (pointing to a non-existent item) falls back to the first available row.

### Advancement
Completing an item (approve/reject) automatically advances to the next logical item. The item at the same index is preferred; if no item remains at that index, the previous item is selected. Operators should not repeatedly re-enter the queue by clicking.

### Empty state
An empty inspector is valid only when the queue has no remaining items.

Do not convert queue rows into decorative dashboard cards.

## Inspector pattern

The right pane is an inspector, not a stack of cards.

- Use one stable background shared with the workspace.
- Inspector hierarchy is created through spacing (24–32px between major sections, 8–12px between heading and content), typography, alignment, and restrained surfaces. Internal borders and divider lines are prohibited inside the inspector and on action buttons.
- Do not use surface-color changes as the primary section separator.
- Product context appears near the top.
- Evidence and operational properties follow.
- Internal identifiers (Contribution ID, Observation ID, database references) remain available through collapsed `<details>` metadata disclosure but do not compete with decision-critical information in the primary evidence list.
- Metadata remains accessible and copyable for engineering and audit work.

Canonical section order:

1. Observation header
2. Product summary
3. Evidence
4. Metadata disclosure
5. Decision

## Typography

- Ops section headings use title case. All-caps labels are not part of the JeloCare interface language. Hierarchy comes from font weight, size, spacing, color, and placement.
- Use sentence case for action labels, helper text, and status explanations.
- IDs may use monospace through the existing ID primitive.

## Actions

Button hierarchy is expressed through surface tokens, tone, and typography — not borders. All buttons are borderless.

Primary action (Approve):
- `background: var(--accent-solid); color: var(--on-accent); border: 0`
- Slender control height
- Squircle radius
- Visually dominant

Secondary destructive action (Reject):
- `background: var(--state-danger-bg); color: var(--state-danger); border: 0`
- Must not compete equally with Approve

Ghost:
- Transparent until interaction.

Do not use independent green and red filled buttons as the default pair. Status colors communicate outcomes; they do not replace the product button hierarchy.

## Geometry

- Controls use the ops squircle radius.
- Avoid oversized pills for ordinary buttons.
- Pills are reserved for status, compact filters, and true capsule controls.
- Standard decision buttons target approximately 34–36 px desktop height.
- Touch targets must still meet accessibility requirements on compact and mobile layouts.

## Borders and separation

Internal borders and divider lines are prohibited inside the inspector and on action buttons. Borders are allowed when structural elsewhere.

Use:

- quiet separators between dense queue rows
- focus outlines for keyboard navigation

Avoid:

- decorative card outlines
- nested boxes around every section
- borders used only because the hierarchy is unclear

## Color contract

Ops uses semantic tokens rather than public-site surface names.

- Canvas: environmental background
- Chrome: navigation and floating instruments
- Workspace: primary work plane
- Surface subtle: image wells, text areas, skeletons, and inset groups
- Accent: active navigation, focus, and selected context
- Success, warning, and danger: state communication only

Components inside `/ops` should not directly choose public tokens such as `--cream`, `--card-glass`, or `--wine` when a semantic ops token exists.

## Spacing and negative space

Whitespace is structural.

- Workspace heading must breathe before the collection begins.
- Repeated rows use a strict rhythm.
- Inspector sections use larger vertical separation than properties inside a section.
- Do not fill empty space with explanatory copy or decorative containers.

Use the established spacing scale only.

## State and synchronization

Queue state, selected detail, sidebar counts, activity, signals, and overview metrics must update as one operational system. Server actions use the shared `revalidateOps()` contract to invalidate all relevant surfaces.

The persistent database remains the source of truth. Optimistic interactions may improve perceived speed, but settled state must reconcile against the server response.

## Accessibility

- Explicit selection is represented through URL state.
- Keyboard navigation remains available.
- Focus-visible treatment must be clearly distinguishable.
- Metadata disclosure uses native `details` and `summary` semantics.
- Color is never the only indicator of state.
- Reduced-motion and reduced-transparency preferences remain supported.

## Canonical primitives to extract

The observations implementation should become the source for reusable primitives:

- `OpsWorkspace`
- `OpsCollection`
- `OpsCollectionItem`
- `OpsInspector`
- `OpsInspectorSection`
- `OpsPropertyList`
- `OpsMetadataDisclosure`
- `OpsDecisionActions`

Other queue pages should migrate to these primitives rather than copying observations-specific CSS.

## Review checklist

Before shipping an ops screen, confirm:

- Does it inherit the canonical shell?
- Is the primary collection easy to scan in one second?
- Is the inspector one continuous plane without internal borders or dividers?
- Are headings title case rather than all caps?
- Are internal IDs hidden under Metadata?
- Does the primary action follow JeloCare button tokens?
- Are buttons slender squircles rather than oversized pills?
- Is glass limited to floating chrome?
- Are public-site color tokens absent where ops tokens exist?
- Does a decision refresh sidebar counts, activity, signals, and the relevant queue?

If the answer to any item is no, the page is not yet canonical.
