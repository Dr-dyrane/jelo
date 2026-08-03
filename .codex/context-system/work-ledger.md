# JeloCare work ledger

Updated: 2026-08-02
Base: `9d25744` on `main`, aligned with `origin/main`

## Dirty boundaries

- `public/campaigns/` is untracked user-owned work. Do not stage, rewrite, remove, or include it without an explicit campaign task.
- `.codex/context-system/` is the new context-department configuration created during the legacy-task handoff.
- `data/external-products.json` and `modules/retail-intelligence/response-scope.test.ts` contain the uncommitted `Moisturiser` → `Moisturizer` vocabulary merge; focused tests pass.
- `app/(site)/page.tsx`, `app/(site)/home.module.css`, and `app/(site)/home-editorial.module.css` contain the uncommitted supportive-use horizontal-rail restructuring; TypeScript, lint, and desktop/mobile light/dark QA pass.

## Active work

- The Tiny vocabulary merge and home supportive-rail restructuring are implemented and verified locally and are authorized for immediate integration, push, production build confirmation, and affected-route smoke.

## Blockers

- None recorded for orchestration.

## Recent outcomes

- Released Dr Teal's Nourish & Protect Coconut Oil Body Wash 710 ml at `9d25744`; production READY, product route 200, and the zero-offer share route correctly fails closed. Estimated worker cost: ~102 minutes, at least ~177 tool calls and ~106 shell invocations, 28 committed files, 8,194 insertions/51 deletions; token and cache billing unavailable.
- Released Benton Honest Cleansing Foam at `5a1d0ce`; production and focused route QA passed.
- Resolved Zaron toner EAN conflict at `34742a3`.
- JeloCare currently has 62 public products and 46 explicit publication releases at this checkpoint.

## Routing rule

- Read this ledger first, then one department entry. Do not load the legacy task or the entire repository by default.
- Standing release authority: after a scoped JeloCare fix passes its focused gates, its department task should commit, push `main`, wait for the exact production build to become READY, and smoke the affected route immediately. Stop only for a genuine evidence, safety, dirty-boundary, reconciliation, or deployment blocker.
