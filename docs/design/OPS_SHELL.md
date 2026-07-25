# Operations shell

The operations console is a private working environment. Its shell provides orientation and navigation without competing with the queue or detail work inside it.

## Desktop composition

Desktop uses two persistent planes inside a quiet operations canvas:

- The left sidebar is the instrument plane. It holds account controls, navigation, queue counts, and appearance controls.
- The workspace is the content plane. It is inset on every side, with a continuous rounded boundary created by surrounding canvas, tonal difference, and restrained elevation rather than a visible border.

The sidebar and workspace use the same shell radius so they read as one composed environment. The gap between them is intentional cognitive space, not a divider. Nested sidebar instrument surfaces use `--ops-instrument-inner-radius`, derived from the shell radius minus sidebar padding, so account, navigation, and account-summary curves remain concentric with the sidebar.

The sidebar names the `Operations` environment once, separates actionable `Triage` from read-only `Monitor` navigation, and keeps the account trigger person-first. Brand text does not appear inside the account trigger.

`Triage` contains contributions, edges, observations, vocabulary, and retailer applications. `Monitor` contains queue overview, decision history, and commerce signals. Admins also receive a `Manage` group with the read-only operator directory; it does not expose access mutations until those actions can be audited under the console trust boundary.

Desktop sidebar identity, context, group labels, links, and selected links use medium weight. Selection is communicated by tone and surface, not a heavier face. Semibold is reserved for the small avatar initials, where compact glyphs need additional clarity.

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

During UI development, `lib/moderation/sidebar-summary.ts` provides a role-specific fixture for operator display identity and audit-style activity. It is deliberately resolved at the server layout boundary, then passed through the shell as `OpsSidebarSummary`; the client sidebar does not own mock data. Replace this fixture with a single read model over `moderation_operators` (`display_name`, `email`) and `moderation_audit_log` (current operator decisions today and latest action) before treating those values as production evidence.

The sidebar stays an instrument. Queue rows, decision forms, and other operational content belong to the workspace and should not be added to the shell.
