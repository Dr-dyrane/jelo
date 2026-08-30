# Design system

Updated: 2026-08-04

JeloCare is calm, editorial, inclusive, and quiet enough for the product to remain the focus.

The full behavior contract is [UI_PHILOSOPHY.md](../UI_PHILOSOPHY.md). This guide maps that contract to the implementation.

## Foundation

The global tokens live in `app/globals.css`.

| Token      | Current value                     | Use                              |
| ---------- | --------------------------------- | -------------------------------- |
| `--ink`    | `#2d211f`                         | Primary text and strong actions  |
| `--muted`  | `#7a6b66`                         | Secondary text                   |
| `--cream`  | `#fbf3ed`                         | Page field                       |
| `--paper`  | `#fffdf9`                         | Raised reading surface           |
| `--peach`  | `#f4d4c5`                         | Warm section and control surface |
| `--rose`   | `#e8bbb4`                         | Soft accent                      |
| `--wine`   | `#6b3b35`                         | Text accent and focus            |
| `--shadow` | `0 30px 90px rgba(112,71,61,.12)` | Restrained depth                 |

Route CSS may add peach, pink, and cream shades. Brown is an accent, not a dominant page background.

### Colour contexts

The public experience uses the warm editorial palette above in light mode because products, care guidance, and photography are its primary content.

JeloCare has two distinct workspace temperatures:

- **JeloCare Me** stays in the public family because it is a personal
  continuation of the public care journey. In light mode that means cream,
  paper, peach, blush, rose, wine, and warm ink. In dark mode it adopts the
  shared public black foundation, not the Operations token hierarchy. Its shell
  is defined by [JeloCare Me](../product/JELOCARE_ME.md) and the
  [adaptive workspace dock](./ADAPTIVE_WORKSPACE_DOCK.md).
- **Operations** uses a separate low-chroma mineral shell because it is a dense
  administrative environment:

- `--ops-canvas`, `--ops-instrument`, and `--ops-workspace` establish the environmental, lucent instrument, and solid working planes.
- `--ops-accent` and `--ops-accent-subtle` are low-chroma neutral marks for data, avatars, labels, and other noninteractive emphasis.
- `--ops-action`, `--ops-action-subtle`, and `--ops-focus-ring` provide restrained cobalt-ink selection, action, and keyboard focus without making public wine the private-shell default.
- Semantic success, warning, danger, and information tokens retain their meanings. They are never ambient decoration.

Do not share ambient palette tokens between Me and Operations. Neutral shell
mechanics may be reused through a semantic adapter; `--ops-*` colors never enter
Me, and warm Me/public colors never become the Operations default.

### Theme

The table above lists the **light** values. Light is the default and is pinned regardless of the operating system preference ([ADR 0004](../adr/0004-default-light-theme.md)). Every token also carries a **dark** value, added append-only so light mode stays byte-identical:

- `:root[data-theme="dark"]` applies when the reader explicitly chooses dark.
- `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` is the system-dark fallback, which the default-light script suppresses unless the reader opts in.

A no-flash inline script in `app/layout.tsx` sets `data-theme` and `color-scheme` before paint from `localStorage['jelo-theme']`, defaulting to `light`; [`ThemeToggle`](../../components/navigation/theme-toggle.tsx) writes the preference. Product cutouts drop `mix-blend-mode: multiply` in dark. Any route CSS that hardcodes a light value must add a matching dark override, or it renders as a light patch on the dark page.

#### Black-cherry dark-mode doctrine

Dark mode is an immersive, black-first device environment. The page and browser
chrome use true black (`--cream: #000` and dark `themeColor: #000000`). Public
and Me surfaces rise through one restrained warm hierarchy: recessed
`--surface-2: #0d090b`, primary `--paper: #171214`, intermediate
`--card-2: #1b1417`, and raised `--surface-3: #21171b`. `--card` aliases
`--paper`, and `--card-3` aliases `--surface-3`, so routes cannot create
near-duplicate blacks by accident. Porcelain text, rose focus and selection,
plum glass, and burgundy washes provide life without turning the black canvas
muddy or flooding whole sections with pink.

Operations keeps its separate `--ops-*` hierarchy in dark mode: true-black
`--ops-canvas`, translucent neutral `--ops-instrument`, then `#121212`
workspace, `#1c1c1c` subtle surface, and `#262626` product stage. Success,
warning, and danger retain their semantic colors; they are signals, not ambient
decoration. Primary and secondary text remain neutral; action, selection, and
focus use high-contrast cobalt-ink values across every elevation. Neutral
accent marks remain separate from both interaction and operational status.

On public and Me surfaces, brand pink (`--wine`) means action, selection, and
editorial emphasis. Coral
`--state-danger` means errors or destructive action; success and warning retain
their green and amber semantics. None of these state colors are ambient card
decoration.

The light declarations and selectors are a preservation boundary. Dark work may
only change or add declarations inside the two dark branches, and the explicit
`data-theme="dark"` branch must remain token-for-token equivalent to the
`prefers-color-scheme: dark` fallback. Route-specific public and Me overrides
must use the shared warm dark tokens rather than adding raw gray surface
literals. Operations remains the only intentionally neutral dark hierarchy.

## Type

- Display: Italiana, weight 400, exposed as `--font-display`.
- Interface and body: Manrope, exposed as `--font-sans`.
- Body text is regular.
- Semibold is reserved for compact controls, labels, and status.
- Bold is exceptional.

Do not use weight to compensate for weak hierarchy. Use scale, spacing, and position first.

Workspace controls use `--font-sans`. JeloCare Me page content may use restrained
Italiana display headings, but its navigation, account chrome, dock, labels,
values, status, and actions use Manrope. Operations uses Manrope only. The
desktop Operations sidebar uses a compact interface hierarchy: account identity,
environment context, and navigation at `--text-cell`; roles and supporting
metadata at `--text-caption`; group labels and count badges at `--text-label`.
Controls retain a 44 px hit target even when their visual text is compact.

## Surfaces

- Prefer spacing, tone, translucency, and restrained shadow over borders.
- Glass belongs on floating controls or over imagery. Provide an opaque fallback.
- Product cards stay visually quiet.
- Pills are controls or brief status—not paragraph containers.
- Use sheets and modals for secondary decisions instead of nested disclosure.
- Hide rail scrollbars while preserving touch, keyboard, snapping, and a visible continuation cue.

## Photography and products

- Show people throughout the story, not only in a hero.
- Represent varied skin tones, ages, genders, hair textures, and care contexts.
- Keep text beside photography or on a reliably opaque surface.
- Product images must show the complete exact package on real transparency.
- Never redraw a branded package or invent a label.
- Keep decorative geometry behind product images quiet.

The full media gate is in [PRODUCT_IMAGE_WORKFLOW.md](../PRODUCT_IMAGE_WORKFLOW.md).

## Interaction

Every state-changing click answers immediately:

- show what changed;
- show a result count when relevant;
- preserve shareable URL state;
- provide Undo or Clear where the action is reversible;
- preserve focus;
- announce a concise update;
- respect reduced motion and reduced transparency.

Desktop secondary flows may use a side sheet. Mobile uses a bottom sheet. Modal behavior follows focus containment, Escape, safe dismissal, and focus restoration.

Filled cards with icons read as controls. Implement them as buttons or links when useful; otherwise remove the control affordance. If the card introduces the primary task immediately below, it should scroll and focus that task. Reserve a compact desktop modal or mobile bottom sheet for useful secondary detail.

## Accessibility release check

- Native control semantics first.
- Minimum 44 px touch targets.
- Visible focus.
- 4.5:1 contrast for small text.
- Reflow at 320 px and 200% zoom.
- Keyboard access to rails and dialogs.
- Motion is never the only feedback.
- No emoji icons; use Lucide.

## Component ownership

| Concern                        | Primary implementation                                       |
| ------------------------------ | ------------------------------------------------------------ |
| Global tokens and base type    | `app/globals.css`, `app/layout.tsx`                          |
| Shared interaction adjustments | `app/interaction.css`                                        |
| Header and navigation          | `components/navigation/`                                     |
| Neutral workspace mechanics    | `lib/workspace-shell/`, `components/workspace-shell/`        |
| JeloCare Me shell vocabulary   | `components/me/shell/`                                       |
| Adaptive selection             | `components/ui/adaptive-selector.tsx`                        |
| Modal behavior                 | `components/ui/use-modal-dialog.ts`                          |
| Catalogue discovery            | `components/products/` and `app/products/`                   |
| Product decision experience    | `app/products/[slug]/` and shared product CSS                |
| Intake experiences             | `components/contribute/` and retailer partnership components |

New shared behavior belongs in a component. Route-specific visual composition belongs in a CSS module.
