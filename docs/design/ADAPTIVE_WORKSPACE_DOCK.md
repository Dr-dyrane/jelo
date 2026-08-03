# Adaptive workspace dock

Updated: 2026-08-03

The adaptive workspace dock is a neutral shell primitive for route-owned
navigation, non-mutating context, and exactly one registered primary action per page. JeloCare
Me is its first adapter, but the primitive contains no Me, finance, Operations,
customer, or domain semantics.

`lib/workspace-shell/` owns pure mechanics. `components/workspace-shell/` owns
the controller and view. `components/me/shell/` supplies Me vocabulary, Lucide
icons, and the warm customer theme. [ADR 0013](../adr/0013-founder-led-jelocare-me.md)
owns the wider architecture.

## Provenance

The four-state composition, 12 px top threshold, 6 px directional hysteresis,
32/26 px nested navigation curves, 58 px orb/FAB geometry, 16 px visual bottom
clearance, focus transfer, and clean 2 px lens were behaviorally reviewed from
My Finance at source revision `8f685bace2313ad9a4f50232fcb109509d5a99a8`.
They are locally implemented values, not runtime imports. JeloCare has no
dependency, symlink, finance-prefixed name, or shared dirty source from that
repository.

The port deliberately excludes financial Stats, pink identity, local-first
finance state, iOS exception controllers, Finance/Ops tokens, and route policy.

## Public model

`DockContextDescriptor` is a serialisable description with `id`, `label`,
`detail`, and an optional complete accessible label. It has no callback.
`WorkspaceDockBackDescriptor` is a deterministic internal `href` plus a complete
accessible name. Stack routes may supply one; primary routes supply none. Back
is shell navigation, never a primary destination or page mutation.

`resolveAdaptiveWorkspaceDockMode` is pure:

| Inputs | Mode |
| --- | --- |
| Navigation and context; chrome visible | `expanded` |
| Navigation and context; chrome contracted | `compact` |
| Contracted; page orb activated | `navigation` |
| Navigation or context absent | `single` |

`updateWorkspaceDockScrollState` is also pure. It clamps invalid/negative input,
returns to expanded at 12 px or nearer the top, and changes contracted direction
only after more than 6 px of cumulative travel in the new direction. The
direction anchor resets when direction changes, preventing one noisy wheel event
from flapping the shell.

## Controller and route ownership

`useAdaptiveWorkspaceDockController` receives the current route key and whether
navigation/context exist. The route's one vertical scroll owner reports numeric
`scrollTop` through `onScrollPositionChange`. The controller owns only transient
scroll and reveal state and resets both when the route key changes.

The consuming shell header reads the same `scroll.chromeHidden` signal as the
dock. It begins visible, translates and fades away only after the shared
downward threshold contracts the dock, and restores at top, on upward travel,
or on route reset. A modal sheet or focus inside header chrome suppresses the
visual hide. The header remains out of layout flow, so visibility changes move
no content, and Reduced Motion applies the state immediately. Consumers must not
add a window listener or a second direction state machine.

It does not own routing, page data, mutations, persistence, safe-area
classification, authentication, or server policy. The route/controller/model/view
split in [ADR 0013](../adr/0013-founder-led-jelocare-me.md#filesystem-and-code-canon)
remains binding.

## FAB registration

`WorkspaceDockProvider` is scoped to the active route key. A feature registers
one `WorkspaceDockFabDescriptor` containing an owner ID, exact route, accessible
label, Lucide icon, disabled/busy state, and invocation.

Every rendered page registers exactly one working FAB. Navigation and real
field focus are valid truthful actions when persistence is not implemented;
fake save, add, or edit mutations are not.

- A registration for another route is ignored.
- The latest valid registration is visible.
- Each registration receives a unique token.
- Cleanup removes only that token, so an older unmount cannot remove a newer
  registration from the same owner.
- Route change clears the registry.
- The registry is memory-only and is never customer data.

The FAB is the only dock control permitted to invoke a page's primary domain
mutation. Navigation changes location. The context capsule only describes
current scope or evidence.

## View anatomy

### Expanded

```text
context capsule
[Back]   navigation island                FAB
```

The context is above navigation. The bottom row is 58 px; the complete stack is
110 px before bottom/safe-area clearance. Back occupies the stable 58 px left
slot only on a stack route.

### Compact

```text
[Back]     context capsule                 FAB
```

At narrow width the context may visually truncate, but its accessible name is
complete. A primary page uses the real `Show navigation. <Page> selected` orb;
a stack page replaces that same geometric slot with its deterministic Back link.
The context and FAB do not move or change meaning.

### Navigation

```text
four route-owned destinations              FAB
```

Activating the orb replaces compact context with the complete navigation in the
same row and moves keyboard focus to the current `aria-current="page"` link.
Stack routes do not reveal navigation from the Back slot. If reveal state is
already present, the one shell-owned Back stays in its left slot before the
four destinations; primary routes never render it.

### Single

One row carries the truthful remaining navigation/context and optional FAB. It
does not invent an empty capsule to preserve geometry.

## Material

The dock is a lens, not frosted card chrome:

- independently inherited warm light/dark fills use cream, paper, peach, blush,
  rose, wine, and warm ink;
- `backdrop-filter` and `-webkit-backdrop-filter` use `blur(2px)` with restrained
  saturation, contrast, and brightness;
- depth is an external wine-tinted shadow plus a broad internal caustic, never a
  decorative border or inset edge highlight;
- the selected destination uses a neutral warm surface with wine icon/label and
  `aria-current`, not a solid accent fill;
- fine pointers receive a one-pixel liquid lift and color response; touch does
  not receive sticky hover; and
- Ops mineral colors and `--ops-*` variables are prohibited.

## Accessibility and preferences

- Back, orb, FAB, and navigation targets meet or exceed 44 px; Back/orb/FAB are 58 px.
- Focus is independent from persistent selection.
- Busy and disabled FAB state is semantic and visible.
- Hidden modes are conditionally absent from the accessibility tree rather than
  faded but focusable.
- Reduced Motion removes spatial movement and spinner animation without delaying
  state.
- Reduced Transparency and increased contrast resolve to opaque warm paper and
  peach surfaces.
- Forced Colors removes lens filters, caustics, and shadows and uses system
  Canvas, CanvasText, Highlight, and HighlightText.
- Context and navigation retain complete accessible labels at 320 px, 200% text,
  and visual truncation.

## Evidence matrix

For a consuming route, verify `390 × 844`, `600 × 900`, `1000 × 800`, and
`1440 × 900`; light and dark; top/expanded, scroll-contracted, navigation
revealed, and return-to-top; fine pointer and touch; Reduced Motion; Reduced
Transparency; increased contrast; Forced Colors; keyboard focus transfer; 200%
text; and no document overflow or obscured final content.

JeloCare Me is the first consuming route family. Its canonical labels and paths
live in [JeloCare Me](../product/JELOCARE_ME.md#information-architecture), while
this document remains the sole dock geometry, focus, motion, transparency, and
evidence contract.

## Rollback

The primitive and thin Me adapter are unused by production routes. Remove their
foundation commit if mode derivation, focus, owner-token cleanup, material
fallbacks, or route isolation regress. No route, customer record, migration, or
data repair is involved.
