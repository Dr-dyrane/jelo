# ADR 0004: Default to a pinned light theme, not the OS preference

Status: Accepted

Date: 2026-07-24

## Context

JeloCare ships a full dark mode alongside light. The first no-flash script only set `data-theme` when a preference was stored in `localStorage`; otherwise it left the app to follow the operating system through the `@media (prefers-color-scheme: dark)` token overrides. A first-time visitor on a dark-OS machine therefore landed in dark by default and read it as "light mode is broken". The brand and the calm editorial surfaces are designed light-first, and the reconciled dark surfaces are a deliberate second skin, not the intended first impression.

## Decision

Default to light, independent of the operating system. The no-flash inline script in `app/layout.tsx` sets `data-theme="light"` (and `color-scheme: light`) before paint unless `localStorage['jelo-theme'] === 'dark'`. Dark is opt-in, chosen through `ThemeToggle` (`components/navigation/theme-toggle.tsx`), which persists the choice. Because the script always writes an explicit `data-theme`, the `:not([data-theme="light"])` half of each dark override never fires unless the reader has opted in — the explicit `[data-theme="dark"]` rules carry dark mode, and the media-query rules are belt-and-suspenders.

## Consequences

- Every visitor sees the intended light identity first; dark is a deliberate choice, never an accident of OS settings.
- We override a platform accessibility signal — some readers set the OS dark for comfort. Mitigation: the toggle is always present in the footer and the preference persists across visits.
- `color-scheme` is mirrored to the chosen theme so native controls (scrollbars, form fields) match.
- The dark token overrides remain append-only, so light mode is byte-identical to before dark shipped (see [Design system · Theme](../design/SYSTEM.md#theme)).

## Alternatives rejected

- **Follow the OS by default.** Rejected: dark-OS visitors read the site as broken, and the design is light-first.
- **Add a "system / auto" option now.** Deferred: the toggle is binary today; an auto option can be layered on later without changing this default.
