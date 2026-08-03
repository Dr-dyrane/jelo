# Design system

Updated: 2026-08-03

JeloCare is calm, editorial, inclusive, and quiet enough for the product to remain the focus.

The full behavior contract is [UI_PHILOSOPHY.md](../UI_PHILOSOPHY.md). This guide maps that contract to the implementation.

## Foundation

The global tokens live in `app/globals.css`.

| Token | Current value | Use |
| --- | --- | --- |
| `--ink` | `#2d211f` | Primary text and strong actions |
| `--muted` | `#7a6b66` | Secondary text |
| `--cream` | `#fbf3ed` | Page field |
| `--paper` | `#fffdf9` | Raised reading surface |
| `--peach` | `#f4d4c5` | Warm section and control surface |
| `--rose` | `#e8bbb4` | Soft accent |
| `--wine` | `#6b3b35` | Text accent and focus |
| `--shadow` | `0 30px 90px rgba(112,71,61,.12)` | Restrained depth |

Route CSS may add peach, pink, and cream shades. Brown is an accent, not a dominant page background.

### Colour contexts

The public experience uses the warm editorial palette above because products, care guidance, and photography are its primary content.

JeloCare has two distinct workspace temperatures:

- **JeloCare Me** stays in the warm public family—cream, paper, peach, blush,
  rose, wine, and warm ink—because it is a personal continuation of the public
  care journey. It may become quieter and more task-led, but it never adopts
  the Operations canvas. Its shell is defined by [JeloCare Me](../product/JELOCARE_ME.md)
  and the [adaptive workspace dock](./ADAPTIVE_WORKSPACE_DOCK.md).
- **Operations** uses a separate low-chroma mineral shell because it is a dense
  administrative environment:

- `--ops-canvas`, `--ops-instrument`, and `--ops-workspace` establish the environmental, lucent instrument, and solid working planes.
- `--ops-accent`, `--ops-accent-subtle`, and `--ops-focus-ring` provide muted umber selection and focus without making public wine the private-shell default.
- Semantic success, warning, danger, and information tokens retain their meanings. They are never ambient decoration.

Do not share ambient palette tokens between Me and Operations. Neutral shell
mechanics may be reused through a semantic adapter; `--ops-*` colors never enter
Me, and warm Me/public colors never become the Operations default.

### Theme

The table above lists the **light** values. Light is the default and is pinned regardless of the operating system preference ([ADR 0004](../adr/0004-default-light-theme.md)). Every token also carries a **dark** value, added append-only so light mode stays byte-identical:

- `:root[data-theme="dark"]` applies when the reader explicitly chooses dark.
- `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` is the system-dark fallback, which the default-light script suppresses unless the reader opts in.

A no-flash inline script in `app/layout.tsx` sets `data-theme` and `color-scheme` before paint from `localStorage['jelo-theme']`, defaulting to `light`; [`ThemeToggle`](../../components/navigation/theme-toggle.tsx) writes the preference. Dark surfaces are warm (never pure black) and sit lighter than the page for correct elevation; product cutouts drop `mix-blend-mode: multiply` in dark. Any route CSS that hardcodes a light value must add a matching dark override, or it renders as a light patch on the dark page.

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

| Concern | Primary implementation |
| --- | --- |
| Global tokens and base type | `app/globals.css`, `app/layout.tsx` |
| Shared interaction adjustments | `app/interaction.css` |
| Header and navigation | `components/navigation/` |
| Neutral workspace mechanics | `lib/workspace-shell/`, `components/workspace-shell/` |
| JeloCare Me shell vocabulary | `components/me/shell/` |
| Adaptive selection | `components/ui/adaptive-selector.tsx` |
| Modal behavior | `components/ui/use-modal-dialog.ts` |
| Catalogue discovery | `components/products/` and `app/products/` |
| Product decision experience | `app/products/[slug]/` and shared product CSS |
| Intake experiences | `components/contribute/` and retailer partnership components |

New shared behavior belongs in a component. Route-specific visual composition belongs in a CSS module.
