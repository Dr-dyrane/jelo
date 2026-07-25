# Phase 1: Adaptive workspace frame

## Outcome

Create the reusable right-hand workspace frame for operations pages. It gives each operational destination a consistent page context and working-plane contract without owning data access, decisions, or a single breakpoint's markup.

## Why this phase comes first

The sidebar is now the stable top-level console instrument. Queue work needs a correspondingly stable content boundary before individual queue detail pages duplicate headers, empty states, tab rows, and responsive behavior.

## Scope

Build only the frame and one desktop reference composition. The first consumer may use static or existing read-only data while triage mutation feedback is still planned.

The frame must support these semantic slots:

| Slot | Responsibility | Required |
| --- | --- | --- |
| Page context | Title, concise operational purpose, and route-level actions. | Yes |
| Local navigation | URL-backed tabs only when the destination has real sibling views. | No |
| Primary work | Queue list, table, monitor ledger, or other primary task. | Yes |
| Record detail | Evidence and actions for one selected record. | No |
| Supporting state | Loading, empty, denied, error, and retry presentation. | Yes |

## Non-goals

- Do not create a generic dashboard framework.
- Do not add decorative tabs or filters.
- Do not migrate every queue to the frame in this phase.
- Do not add tablet or mobile markup by shrinking the desktop split.
- Do not add any new moderation action.

## Component boundary

The frame may be a shared operations component, route-level composition, or a small family of components. The choice must preserve these rules:

- Route code resolves the operator, role, data, and action permission before passing content into the frame.
- The frame receives display-ready slot content and does not query the database.
- Queue-specific rows, evidence views, and action controls remain owned by their domain modules.
- The frame exposes no generic mutation callback; actions remain explicit, typed, and domain-owned.
- URL parsing for selected record and local tabs remains close to the route that owns their meaning.

## Responsive composition contract

| Viewport | Navigation | Primary work | Detail |
| --- | --- | --- | --- |
| Desktop | Persistent sidebar | List and detail may be visible together. | Persistent second pane when review requires comparison. |
| Tablet | Compact navigation | One primary pane or a constrained split, chosen by readable minimum widths. | Temporary sheet or route when a split would compromise evidence reading. |
| Mobile | Compact task navigation | One task at a time. | Separate detail route or deliberate bottom sheet with a reliable return path. |

Use the same selected-record URL meaning at every viewport. The presentation changes; the operator's place in the work does not.

## Implementation sequence

1. Read [Operations shell](../../../design/OPS_SHELL.md), the active queue route, and its read model.
2. Write a task packet using the [delivery harness](../DELIVERY_HARNESS.md#task-packet).
3. Define the semantic slot props or route composition before styling.
4. Build the page context and primary-work states first.
5. Add desktop detail placement only after the list remains usable at 200% zoom.
6. Add focus treatment and selected-record URL handling before visual polish.
7. Document the chosen responsive presentation; do not silently let CSS decide a task flow.

## Acceptance criteria

- The frame can render a monitor page without a detail pane and a triage page with one.
- No frame code contains a queue SQL query, role matrix, or canonical write.
- The selected record can be opened directly from a URL and dismissed without losing queue position.
- Keyboard focus moves predictably from list to detail and returns to the originating row.
- Empty, loading, error, and denied states fit the same visual hierarchy as populated work.
- Desktop has a reviewed list-detail composition; tablet and mobile behavior is specified in the implementation record before release.

## Required validation

- Focused component and route tests for URL parsing and state transitions.
- Existing moderation architecture test.
- `npm run validate`.
- Browser review at desktop, tablet, mobile, 200% zoom, keyboard-only, and reduced-motion settings where motion is introduced.
