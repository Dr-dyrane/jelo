# ADR 0009: UI and UX work ships through explicit lane contracts

Status: Accepted

Date: 2026-07-25

## Context

JeloCare already has a clear interface philosophy: calm, editorial, inclusive,
minimal copy, light typography, borderless surface hierarchy, responsive
progressive disclosure, and immediate feedback. The rules are documented in
[the interface contract](../UI_PHILOSOPHY.md), mapped to code in
[the design system](../design/SYSTEM.md), and specialized for the private
workspace in [the operations shell](../design/OPS_SHELL.md) and
[operations queue candidate contract](../OPS_UI_CANON.md).

The missing piece is a collaboration contract. Recent history shows why it is
needed:

- the operations shell required a long sequence of responsive corrections
  across `OpsChrome`, `OpsSidebar`, inbox layout, and shared shell CSS before
  its five compositions became coherent;
- contribution work needed follow-up changes to distinguish clickable trust
  signals, edit and remove actions, save feedback, and tablet card geometry;
- catalogue and product work needed follow-up changes for visible filter
  feedback, plain-language price copy, CTA intent, packshot containment, and
  image integrity.

Iteration is expected. Repeatedly changing the same shared files from
independent lanes is not. A local improvement can regress another viewport,
route, focus path, theme, or data state when ownership and evidence are
implicit. “Apple-like” also cannot mean copying a page or adding ornamental
glass; it means reducing decisions, preserving spatial logic, using platform
behavior, and making every state legible.

## Decision

Every UI or UX change will run as a named **lane contract**. A lane is a bounded
journey or system with one active writer for each shared surface it owns. The
contract is written in the task or handoff before implementation and remains
the source of scope during review.

This ADR governs public routes and the private operations workspace. It does
not replace the interface contract, design system, catalogue image gate,
clinical safety rules, or operations shell specification; it defines how a
change uses and proves those contracts without crossing another lane.

### Lane contract

Before editing, record:

| Field | Required content |
| --- | --- |
| Lane | A stable name such as `catalogue-filter-feedback` or `ops-observation-inspector` |
| Outcome | The user-visible problem and the observable behavior that resolves it |
| Baseline | Current commit, affected routes, relevant state or query, and dirty-tree notes |
| Owned paths | The smallest files the lane may edit |
| Protected dependencies | Shared tokens, primitives, layouts, data contracts, or assets the lane may consume but not change |
| Invariants | Behavior and visual qualities that must remain true |
| Responsive matrix | Exact viewport bands and states that need evidence |
| Data states | Loading, empty, populated, long-copy, error, stale, disabled, and permission states that apply |
| Acceptance evidence | Commands, browser checks, screenshots, accessibility checks, and production check appropriate to the risk |
| Handoff | Completed behavior, exact files, evidence, known limits, and next safe action |

The outcome must describe behavior, not taste. “Make it premium” is not a
contract. “Opening Filters uses a side sheet on desktop and a bottom sheet on
mobile; applying it updates the URL, result count, focus, and clear action” is.

### Ownership boundaries

| Surface | Primary ownership | Boundary |
| --- | --- | --- |
| Public foundation | `app/globals.css`, `app/interaction.css`, root/site layouts, shared navigation | A design-system lane only. A route lane may consume these rules but must not patch globals to solve one page. |
| Shared interaction primitives | `components/ui/` | One primitive lane owns behavior, API, focus, and fallback support. Consumers stay route-specific. |
| Catalogue discovery | `components/products/` and the catalogue route styles | Owns search, filters, result feedback, cards, rails, pagination, and quick views; it does not rewrite product or retail truth. |
| Product decision journey | Product-detail route and shared product-experience styles | Owns fit, care, price comparison, retailer choice, and progressive disclosure; it does not weaken publication or clinical gates. |
| Community and retailer intake | Their route styles and experience components | Owns conversational input and submission feedback; community and retailer data remain in their trust lanes. |
| Public editorial stories | Route composition and editorial components | Owns page storytelling and people photography; it does not replace exact product packshots. |
| Operations shell | `OpsChrome`, `OpsSidebar`, shell context, shell CSS, and shell tokens | Owns navigation, workspace geometry, overlays, bottom bar, and responsive shell constants. |
| Operations workspace or inbox | Route workspace, inbox, row, inspector, and action components | Owns workflow content inside shell slots; it does not change shell geometry to repair a local screen. |
| Product media | Asset manifests, packshot workflow, and safe image components | Owns exact-package fidelity and release evidence; UI work may change presentation, never source truth. |
| Data and clinical truth | Catalogue, retail, community, moderation, and clinical modules | UI reads typed projections and expresses confidence; it never promotes, diagnoses, verifies, ranks, or approves data by appearance. |

Only one active lane changes a protected shared surface at a time. Parallel work
is safe when owned paths are disjoint and neither lane changes the other’s
public API. If a lane discovers a shared-foundation change, it pauses that edit,
records the dependency, and hands it to the foundation owner. It must not hide
a route repair in a global selector.

Before and after editing, inspect `git status --short`. Preserve unrelated
changes and stage only the lane’s files. A lane may recommend adjacent work; it
does not silently absorb it.

### Visual and content rules

Implementation must follow these defaults:

- Use the existing tokens before adding values. Public pages use the warm
  peach, blush, pink, cream, paper, ink, muted, and wine system. Private
  workspaces use their low-chroma operations tokens. Do not move the public
  palette into operations or the operations palette into editorial pages.
- Brown remains an accent, not a page field. Use tone, spacing, translucency,
  and restrained shadow before a border. Glass is for floating controls or
  depth over imagery, never a decorative coating on every card, and it needs an
  opaque reduced-transparency fallback.
- Italiana at weight 400 is public editorial display type. Manrope is body and
  interface type. Operations uses Manrope only. Regular is the default;
  medium or semibold is reserved for compact controls and status; bold is
  exceptional.
- Keep product presentation quiet: no competing geometry, emoji, decorative
  logo badges, fake stock pressure, ornamental labels, or opaque white packshot
  canvases. Use Lucide icons already in the system.
- Give each repeated semantic item one dominant surface at rest. Internal
  wrappers may align media and copy, but they must not create a persistent card
  inside another persistent card. The public `/share` price row uses one whole
  row surface with its packshot placed directly in that composition. A dense
  Operations row may invert the treatment: its copy remains on the workspace
  while one quiet media stage contains the packshot, and the whole row gains a
  surface only when selected. These are two valid topologies; do not combine
  both resting surfaces.
- Add inclusive people photography where it advances the story, including
  sections beyond the hero. Keep text beside the image or on a reliably opaque
  surface with tested contrast. Photography supplements product evidence; it
  does not replace the exact packshot.
- Copy is plain, short, and human. Use one thought per heading, at most one
  supporting thought when needed, and a verb-led CTA that says what happens.
  Prefer “Typical price” to “median”, “View all” to a wrapping label-plus-arrow
  construction, and direct user language to internal metrics or technical
  prose. Remove copy that only states an expected quality of the platform.
- Never use an interface label to overstate evidence. Community-reported,
  retailer-reported, reviewed, verified, current, and recommendation-eligible
  remain distinct data states.

### Responsive composition

Responsive work preserves the journey, not identical geometry:

- Desktop may use a side sheet for contextual detail and a compact modal for a
  short, focused decision. Mobile uses a bottom sheet. The primary task—such as
  a contribution form or product decision—stays on the page.
- Secondary detail moves into one focused overlay instead of expanding nested
  DOM panels. Do not put a disclosure inside another disclosure.
- A sheet has a title, close control, safe outside/Escape behavior, contained
  focus, body scroll lock, an independently scrollable body when needed, and
  focus restoration to its trigger.
- Avoid dropdowns for products, brands, retailers, ingredients, skin
  characteristics, or concerns. Reuse search, suggested chips, typeahead,
  multiple selection where natural, and an editable custom value. Native
  dropdowns remain acceptable for truly bounded structural values such as
  country, state, month, and year.
- Horizontal rails keep touch, wheel, and keyboard scrolling; hide the
  scrollbar while preserving a visible continuation cue and logical focus
  order.
- Long vertical lists and horizontal rails render a bounded first page and load
  the next page near the relevant scroll edge. Loading is idempotent, preserves
  position and selection, stops cleanly at the end, and announces the appended
  count through a concise polite status. Keep an explicit accessible fallback
  action and do not let automatic vertical loading make a public footer
  unreachable. Skeletons match the appended row or card geometry instead of
  replacing the whole collection.
- At 320 px and 200% zoom, controls do not collide, clip important copy, create
  horizontal page overflow, or hide primary actions behind fixed chrome.

Public-route evidence uses `390 × 844`, `768 × 1024`, and at least
`1280 × 800` unless the lane establishes a more relevant matrix. Test both
sides of every breakpoint the change edits.

The operations shell keeps its five established compositions:

| Band | Evidence target | Required composition |
| --- | --- | --- |
| Phone, `< 430px` | `390 × 844` | Bottom navigation and focused bottom-sheet work |
| Touch, `430–819px` | `600 × 900` | Overlay navigation with an adapted collection/detail flow |
| Compact, `820–1179px` | `1000 × 800` | Persistent sidebar with overlay detail |
| Balanced, `1180–1439px` | `1300 × 900` | Persistent sidebar with balanced workspace/detail behavior |
| Expanded, `≥ 1440px` | `1440 × 900` | Persistent three-plane composition when the workflow needs it |

These are evidence targets, not new CSS breakpoints. The load-bearing constants
remain owned by
[Responsive shell evolution](../operations/console/RESPONSIVE_SHELL_HISTORY.md).

### Operations split-view requirements

An Ops lane that changes a workspace, queue, briefing, inspector, or overlay
must also name its split-view responsibility. The baseline is not a generic
admin dashboard: at desktop width it is **sidebar → main workspace →
contextual inspector**. The Observations route is the current interaction and
density reference candidate; it does not become canon until product review
accepts it. [ADR 0010](0010-operations-interface-and-overview-contract.md)
defines when queue-level Overview selection may test the same grammar.

The lane contract must say which of the following it changes and prove each one
it touches:

| Concern | Required contract statement |
| --- | --- |
| Main workspace | What the operator scans or selects; repeated facts are compact rows, not a grid of tiles. |
| Inspector | What selection changes, what action is reachable, and why it is not a nested card stack. |
| Desktop | Whether all three planes persist at `>=1180px`. |
| Tablet | How the inspector becomes a right side sheet at `820–1179px` while the workspace remains useful underneath. |
| Mobile/touch | How the inspector becomes a bottom sheet below `820px` without hiding the task. |
| Overlay mechanics | Focus trap, scroll lock, Escape, safe dismissal, independent scrolling, reduced motion, and exact focus return. |
| Semantics | Whether a repeated row is a link or a button; no orphan `role=option`, `aria-selected`, or action-shaped no-op is allowed. |
| Media | Exact packshots remain transparent, uncropped, unaltered, and contained; text over any image or translucency is contrast-tested at its worst point. |

Apple Music may be cited only for high-level composition and density: a calm
canvas, durable navigation, and context that changes without a new page. It is
never permission to import album galleries, large decorative cards, player
controls, dense image walls, or its visual theme into Ops.

### Interaction feedback

Every state-changing action answers:

1. The control visibly enters the selected, loading, saved, applied, or error
   state without requiring the user to infer it.
2. Searchable or shareable catalogue state is represented in the URL.
3. Results report the new count or outcome near the affected surface.
4. Reversible actions expose Undo or Clear. Destructive actions are separate,
   explicitly named controls.
5. Custom values can be edited without delete-and-retype; their `×` control
   removes only.
6. Save feedback uses a concise status/tick and may disappear after
   acknowledgement. Do not leave redundant “Saved” prose occupying the page.
7. Focus moves only when orientation requires it, returns after an overlay
   closes, and never becomes lost after content changes.
8. A dedicated, concise `aria-live="polite"` status announces the outcome.
   Never mark a changing result grid or whole page as a live region.
9. Motion may orient but never carry the message. Respect
   `prefers-reduced-motion`; glass respects reduced transparency.
10. If a card looks actionable, make it a real button or link. Otherwise quiet
    its control cues. A summary card immediately above its primary task should
    move and focus the user on that task, not open an explanation for its own
    sake.

### Accessibility and content integrity

A lane cannot be accepted on a visual screenshot alone:

- native elements and semantics come first;
- interactive targets are at least `44 × 44` CSS pixels;
- focus is visible against every surface;
- small text reaches `4.5:1` contrast and meaningful non-text UI reaches
  `3:1`;
- keyboard order follows reading order and all sheet, rail, search, selection,
  edit, remove, clear, and submit paths work without a pointer;
- loading, empty, error, disabled, and long-content states preserve the same
  task;
- light mode is the first-load baseline and any touched hardcoded colour has a
  valid explicit dark-mode treatment;
- imagery has meaningful alt text when informative and empty alt text when
  decorative;
- health guidance stays educational, includes the appropriate escalation path,
  and never reads as a diagnosis;
- price, availability, retailer, product, and community labels reflect their
  real freshness and confidence.

### Acceptance gates

Evidence is proportional to the changed surface, but absence of evidence is not
approval.

**Before implementation**

- capture the baseline commit and dirty state;
- inspect the current route at each affected composition;
- trace the component, token, data, and accessibility owners;
- search all consumers before changing a shared primitive or selector;
- record the regression invariants.

**Before handoff**

- run `npm run lint`, `npm run typecheck`, relevant focused tests, and
  `npm run build` for a behavior or shared-surface change;
- run `npm run docs:check` when a contract or guide changes;
- verify the route in a real browser at the declared viewport matrix;
- exercise keyboard-only interaction, Escape, focus restoration, scrolling,
  Clear/Undo, error recovery, reduced motion, and reduced transparency where
  applicable;
- verify no horizontal overflow, clipped product image, hidden CTA, layout
  shift, browser error, console error, or broken image request;
- check text over images and translucent surfaces at the worst contrast point,
  not an average colour;
- compare loading, empty, populated, long-copy, and failure states when they
  exist;
- after deployment, verify the exact commit on the custom domain rather than a
  stale local or preview build.

When a lane touches only documentation, the documentation check and clean diff
are sufficient. When it changes a global token, shared primitive, root layout,
or operations shell constant, the evidence expands to every affected consumer
and composition.

### Regression checklist

The reviewer answers each applicable item with evidence:

- [ ] Scope stayed inside the owned paths or an explicit handoff expanded it.
- [ ] Shared tokens and components were reused rather than forked locally.
- [ ] Each repeated item has one dominant resting surface; media and metadata
      do not form decorative cards inside another surfaced item.
- [ ] Public and private palettes, type, and surface grammar remain distinct.
- [ ] Primary content is visible without unnecessary disclosure or scrolling.
- [ ] Desktop side sheet/modal and mobile bottom sheet preserve the same task.
- [ ] Every click has visible, reversible, and assistive feedback.
- [ ] Copy became shorter without losing intent, safety, or confidence.
- [ ] Focus, keyboard, contrast, zoom, motion, transparency, and touch targets pass.
- [ ] Photography and packshots satisfy their separate story and evidence roles.
- [ ] Empty, loading, long, error, and populated states remain usable.
- [ ] Paginated stacks and rails deduplicate requests, preserve focus/selection,
      announce appended results, expose a fallback, and reach a stable end.
- [ ] No unrelated data, clinical, catalogue, media, or shell contract changed.
- [ ] Commands, browser matrix, commit, deployment, and remaining risk are recorded.

### Handoff contract

The lane closes with one compact packet:

```text
Lane:
Outcome:
Baseline commit:
Final commit:
Owned files changed:
Protected dependencies left unchanged:
Routes and states verified:
Viewport evidence:
Keyboard and accessibility evidence:
Automated gates:
Production deployment:
Known limits or follow-up:
Next safe action:
```

The next agent starts from that packet and current repository evidence. They do
not infer ownership from a screenshot, reopen a settled visual decision without
a failing invariant, or refactor adjacent shared files “while there”.

## Consequences

- Parallel agents can move quickly on disjoint journeys without creating a
  second design system or repeatedly correcting shared responsive files.
- Visual review becomes reproducible: the lane declares the route, state,
  viewport, and commit rather than relying on “looks good”.
- Shared primitives and global tokens change less often, but each change carries
  broader evidence.
- Small UI work has a little more setup. The lane record is deliberately short,
  and documentation-only changes do not inherit application build work.
- Some attractive local ideas will be deferred when they violate a protected
  dependency or data-truth boundary. That is the intended cost of coherence.

## Alternatives rejected

- **Rely only on the design system.** Rejected: it defines visual and interaction
  rules but not concurrent ownership, dirty-tree safety, evidence scope, or
  handoff.
- **Let every route copy and customize shared patterns.** Rejected: it makes
  sheets, feedback, selectors, focus, and accessibility drift while appearing
  faster locally.
- **Use one global UI lane for the whole application.** Rejected: public
  editorial pages, product decisions, intake, and operations have different
  jobs and can progress independently when their protected surfaces are clear.
- **Require pixel-identical layouts at all widths.** Rejected: a scaled desktop
  composition produces poor mobile work. Semantics and task continuity are
  shared; geometry adapts.
- **Approve from screenshots alone.** Rejected: a screenshot cannot prove
  keyboard behavior, focus, URL state, feedback, reduced motion, data truth,
  empty/error states, or the deployed commit.
