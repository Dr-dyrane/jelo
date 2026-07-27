# Responsive shell evolution

This is the implementation history of the operations console shell, from the first desktop chrome to the current mobile bottom-bar layout. It exists because the final design is the product of an iterative commit sequence and repeated in-session refinement; the high-level contract in [`OPS_SHELL.md`](../../design/OPS_SHELL.md) does not record the exact numbers, file ownership, or breakpoint decisions that produced the current UI.

## Why this matters

A new developer who reads only [`OPS_SHELL.md`](../../design/OPS_SHELL.md) will understand the shell's intent and token ownership. They will not understand how the phone layout was arrived at, why the files are split the way they are, or which constants are load-bearing. This document captures those decisions so future changes do not accidentally regress them.

## Evolution timeline

### 1. Desktop chrome foundation

Commits on `2026-07-24` established the first left-sidebar chrome for the moderation console, heavily influenced by Apple/Linear-style instrument surfaces:

- `f8ddfad` — Console shell with Desktop Sidebar, Tablet Rail, Mobile Bar, and split-pane keyboard-nav triage inbox.
- `80c213f` — Complete top-to-bottom left sidebar redesign: theme toggles, performance stats, sign-out actions, and safe product image helpers.
- `8356ef1` — Unify user profile and JELOCARE brand wordmark in header, footer sign-out button.
- `fbf73d4` — Fully interactive header dropdown with click-outside handling.
- `6379fa4` — Sidebar width refined to `240px`, high-density list padding, radius to match Apple/Linear guidelines.
- `7848d88` / `26db713` — Active-route indicators moved from a vertical left-edge accent bar to clean rounded squircles.
- `a7f3357` — Backdrop-filter tuned to a delicate `12px` blur with lucent backgrounds for sidebar, header bar, and dropdown dialog.

At this stage the shell was desktop-first with a separate rail/bar idea for smaller screens, but the mobile surface was not yet fully designed.

### 2. Canonical operations shell

On `2026-07-25` the shell became the persistent, route-agnostic frame used today:

- `8cad76e` — Build operations shell and accountability navigation.
- `4c4a4df` — Add `OpsWorkspace` frame and apply it to the observations queue.
- `92cb057` — Add controlled selection to `InboxContainer` so selected records are URL-backed.
- `b798d30` — Detail pane made sticky and independently scrollable on desktop.
- `261c3e9` — Move detail pane to root shell layout and portal inbox detail.
- `2f76252` — Separate inbox navigation from detail selection.
- `0ac3158` — Canonicalize observation inspector sections and actions.

The desktop split (sidebar left, list center, detail right) was solidified here.

### 3. Tablet shell

The tablet experience was not a compressed desktop; it was rebuilt as its own composition:

- `b48c60f` — Introduce canonical tablet shell.
- `cc7db2c` — Add tablet overlay shell composition.
- `8feb0bf` — Add progressive tablet inspector stage.
- `bba6b78` — Add tablet collection and inspector presentation.
- `134fbbd` / `8e4e1e9` — Isolate tablet shell from legacy rail; reset legacy desktop geometry at tablet widths.
- `a4efcc0` / `44b0d2b` — Compose canonical sidebar across adaptive shells; define laptop and tablet compositions.
- `cbe2616` / `ad394a9` — Align inbox behavior with breakpoints; preserve two-column tablet collection and overlay inspector.
- `fd0add1` / `8528c8d` / `dbe8f77` — Share a single detail overlay for laptop and tablet; restore canonical sidebar and overlay shells; slim shared detail sheet and align background tokens.

### 4. Five-stage adaptive breakpoints

`885dd91` codified the five viewport bands used today, preserved through later refactors:

| Breakpoint | Range | Shell |
| --- | --- | --- |
| Phone | `< 430px` | Bottom-sheet menu, floating bottom bar, detail as bottom sheet |
| Touch | `430px - 819px` | Left overlay sidebar, content-driven one/two-column workspace, bottom-sheet detail |
| Compact | `820px - 1179px` | Persistent sidebar, right overlay sheet |
| Balanced | `1180px - 1439px` | Persistent sidebar, workspace, and docked detail |
| Expanded | `≥ 1440px` | Persistent sidebar, three-column docked detail |

Later commits (`6447115`, `bd72614`) aligned the collection and inspector across these bands.

### 5. Token and account unification

- `2404a2f` — Unify shell tokens and remove the separate tablet rail in favor of adaptive breakpoints.
- `732fd00` — Move account menu styles outside the desktop media query so the floating sidebar can reuse them; refine tablet island avatar.

### 6. Phone bottom bar and navigation sheet

`e09ff75` was the final large refactor (`519` changed lines across `7` files). It:

- Unified sidebar navigation styles across all breakpoints.
- Added the Apple-style floating bottom bar with four main tabs: Home, Queue, Review, Activity.
- Added the contextual right FAB as a separate `56px` droplet on the same row.
- Transformed the full navigation menu into a `96dvh` bottom sheet with a solid instrument background, sheet header, title, and close button.
- Kept the detail inspector as an `88dvh` bottom sheet with rounded top corners.

### 7. In-session refinement

After `e09ff75`, the final visual details were tuned interactively. These are not in the commit message but are in the file state:

- Mobile breakpoint locked at `< 430px`.
- Menu sheet height: `96dvh`; detail sheet height: `88dvh`.
- Menu sheet background changed from workspace to `var(--ops-instrument)` with `var(--glass-blur)` to match desktop.
- Bottom bar and right FAB background: `var(--ops-instrument)` with `var(--glass-blur)`.
- Bottom bar tab icons: `24px`; labels: `9px`.
- Bottom bar blur/saturation: `var(--glass-blur)` (saturate `180%`).
- Right FAB is a separate `56px` droplet, no connector circle, `24px` icon with short subtext.
- Theme toggle in menu sheet uses the desktop track style (`color-mix(in srgb, var(--ink) 5%, transparent)`) and selected button style (`var(--ops-workspace)` / `var(--ops-accent)`), capped at `180px` and left-aligned under an "Appearance" label.
- `data-ops-sidebar-footer`, `data-ops-footer-label`, and `data-ops-theme-toggle` attributes added so the phone sheet CSS can override `OpsSidebar` hashed CSS-module classes.
- Drag handle removed from the menu sheet.
- Desktop sidebar navigation radius (`var(--ops-instrument-inner-radius)`) and selected tone (`var(--ops-accent-subtle)`) applied to mobile and tablet navigation.
- Detail pane action buttons use `var(--ops-instrument-inner-radius)`.
- The contextual `56px` FAB remains available across every temporary-inspector
  width below `1180px`; it is not phone-only.
- Temporary inspectors make the workspace and navigation inert, use the exact
  selected subject as their accessible name, and restore focus to the trigger.
- The inspector shell and overlay body do not scroll. One evidence region owns
  vertical scrolling while the decision region remains anchored.

## File ownership

| Concern | Primary file |
| --- | --- |
| Responsive shell layout and phone-only chrome | `components/ops/shell/ops-tablet.module.css` |
| Canonical sidebar structure and state | `components/ops/shell/OpsSidebar.tsx` |
| Route-aware navigation, bottom bar, contextual FAB, menu sheet wrapper | `components/ops/shell/OpsChrome.tsx` |
| Contextual FAB context | `components/ops/shell/OpsShellContext.tsx` |
| Desktop and shared sidebar/link tokens | `app/(ops)/ops.module.css` |
| Inbox collection and detail responsive behavior | `components/ops/inbox/inbox-tablet.module.css` |
| Inbox detail action buttons | `components/ops/inbox/inbox.module.css` |

## Load-bearing constants

| Constant | Value | Where |
| --- | --- | --- |
| Mobile cutoff | `max-width: 429px` | `ops-tablet.module.css` phone media query |
| Touch cutoff | `max-width: 819px` | `ops-tablet.module.css` tablet media query |
| Menu sheet height | `96dvh` | `.sidebarLayer` in phone media query |
| Detail sheet height | `88dvh` | `.tabletInspector` in `inbox-tablet.module.css` |
| Bottom bar height | `56px` | `.bottomBar` |
| Contextual FAB range and size | `<1180px`, `56px` | `.bottomBarAction` |
| Bottom bar right inset | `calc(56px + (var(--space-3) * 2))` | `.bottomBar` |
| Bottom tab icon size | `24px` | `OpsChrome.tsx` |
| Bottom tab label size | `9px` | `.bottomBarItem` |
| Menu sheet theme toggle max-width | `180px` | `.sidebarLayer [data-ops-theme-toggle]` |
| Shell z-index stack | `z-palette + 5` (scrim), `z-palette + 6` (sidebar), `z-palette + 3` (detail) | `ops-tablet.module.css` |

## How to extend without regressing

- Keep `OpsSidebar` markup reusable; add `data-ops-*` attributes when the responsive sheet needs to override its styles from another CSS module.
- Do not add a second `ops-*` token override in `ops-tablet.module.css`; prefer `var(--ops-instrument)`, `var(--ops-workspace)`, and `var(--glass-blur)` from `app/globals.css` so light/dark resolve consistently.
- If changing a bottom-bar constant, mirror the same value in `.bottomBar` and `.bottomBarAction` so the droplet stays aligned.
- Sheet z-index must stay above `.bottomBar` and `.bottomBarAction`.
- Navigation selected-state styling is owned in `app/(ops)/ops.module.css` base now; changing it affects all viewports.
- Route-owned CSS must not retune shell plane widths, breakpoints, or scroll
  ownership. Existing observation-specific shell selectors are migration debt,
  not a pattern for new routes.
