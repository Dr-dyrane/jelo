# JeloCare work ledger

Updated: 2026-08-04
Base: `944178e` on `origin/main`
Production checkpoint before the exact-size UI: Vercel deployment `dpl_CsBHLCe5EiHpBnuDCBKVJG3y5vYA` READY on `www.jelocare.com`

## Release authority

- Standing authority is `ship-after-gates`: a bounded cell may commit and push `main` after focused verification, exact-artifact confirmation, and affected-route smoke.
- Never mix exact SKU identity across size, package form, image, or offer. A visual family may link independently published SKUs; it never merges them.
- Release passing catalogue cells independently. Do not hold an admitted product for a blocked sibling.

## Lane checkpoint

| Lane | State | Durable revision / location | Resume action |
| --- | --- | --- | --- |
| Production catalogue + verified offers | Released | `2dd9a9d`; 3 admitted / 3 rejected / 4 pending | Recheck only when fresh exact evidence arrives. |
| Naturium Perfector 500 mL | Released reference; Rhema offer admitted | product and share routes in `2dd9a9d` | Add further exact current stores independently. |
| Lipikar AP+MAX 400 mL | Released reference; Perona offer admitted | product and share routes in `2dd9a9d` | Keep 200/400 mL identities separate. Teeka 200 mL remains excluded. |
| Medik8 Advanced Night Restore 50 mL | Released; Teeka4 offer admitted | product and share routes in `2dd9a9d` | Add further exact current stores independently. |
| Fenty Butta Drop Fenty Fresh Standard 200 mL | Released reference | `25b238e`, contained in `2dd9a9d` | No share-price claim until a retailer proves exact Standard 200 mL identity. |
| L'Occitane Almond Shower Oil 250 mL | Released reference; required SKU confirmed | product `55d829b` + selector `944178e`; GTIN `3253581785706` | Keep its image, metadata, and offers exact; future sizes join only through their own released SKU rows. |
| L'Occitane size-family UI | Released | `944178e`; exact 250 mL selected control, additive family sidecar | Add a sibling option only after that exact SKU has its own public release, image, offers, and identity row. |
| L'Occitane Almond Shower Oil 500 mL bottle | Active separate exact-SKU cell | visible catalogue-media task `019fcd3f-5310-7c60-9569-9857d2767898` | Prove the 500 mL bottle's own identifier, current image, media QA, care, and offers; never substitute the 500 mL refill. |
| Crystal Retinal 3 media | Rejected/private; profile in preparation | `/Users/dyrane/.codex/worktrees/5144/jelo`, branch `codex/catalogue-media-history`; GTIN `818625024529` | Remove cyan/green fringe around the right tube, crimp/shoulder, pump/nozzle and smaller magenta edge pixels; recheck peach/pink/dark surfaces before any commit. |
| Crystal Retinal 3 / 6 offers | Pending | no admitted offer | Require exact size, stock, package, and direct-listing evidence. |
| Worth Sharing signals | Released | `5f896ac`, contained in `2dd9a9d` | Preserve signal-derived recommendations and fail closed for unsupported price shares. |
| Contextual OG cards | Released | `c6cf82f`, contained in `2dd9a9d` | Product/share/concern/ingredient routes own contextual social cards. |
| Black + expressive dark theme | Released | `6f57075`, `1855983`, `1d77735`, `fbbfd03`; all contained in `2dd9a9d` | Continue only with visual regressions found on a named route/state. |
| `/me` routine persistence | Released | `50e91d0`, contained in `2dd9a9d` | Production users own CRUD state; keep preview fixtures isolated. |
| `/me` intake/routine UI draft | Preserved, not release-ready | `/Users/dyrane/.codex/worktrees/fd3e/jelo` on stale base `e7e56e` | Rebase only the `components/me/**` delta into a clean production worktree; never commit its apparent catalogue deletions. |
| Campaign assets | User-owned, not part of this release | `public/campaigns/` in the older main checkout | Do not stage or publish without a bounded campaign task and explicit external-publish confirmation. |

## Accepted catalogue media

- The currently released founder-batch packshots for Naturium, Lipikar 200/400, Advanced Night Restore, L'Occitane 250 mL, and Fenty Standard 200 mL are already committed in `origin/main`.
- Each published image is bound to its exact candidate and immutable asset digest. Old/new packaging evidence may support identity continuity only within the same exact size and package form.
- Crystal Retinal 3 identity and label are retained, but the single permitted matte fix failed independent dark-surface recheck because colored edge fringes remain. The unreferenced v2 files also lack a transformation/provenance record. Nothing from this cell is canonical, committed, deployed, or client-ready.

## Dirty boundaries

- The older `/Users/dyrane/Claude/Projects/jelo` checkout is 21 commits behind `origin/main`; most visible dark-theme changes there are historical working copies. Do not use it as an integration base.
- Never stage `.DS_Store`.
- The `fd3e` worktree is stale and would appear to delete newer catalogue releases if committed wholesale. Only a reviewed path-scoped patch may be transferred.
- `public/campaigns/` is user-owned and excluded from catalogue/platform releases.

## Routing rule

- Read this ledger first, then one department entry. Do not load this legacy conversation or the whole repository by default.
- For a product batch, split identity/evidence, media, offers, care/content, and integration into bounded subdepartments. One integration owner records the matrix, runs the broad gate once, pushes the passing cells, confirms the exact deployment, and returns client links.
- Resume any preserved or blocked cell above by its branch/worktree and acceptance contract; reconstruct everything else from `origin/main`.
