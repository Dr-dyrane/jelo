# JeloCare engineering handoff

The live handoff is modular. Start with [the handbook](docs/README.md), then follow [the team handoff checklist](docs/operations/HANDOFF.md).

## First checks

```bash
git status --short
git branch -vv
git log -12 --oneline
npm ci
npm run catalogue:pipeline:status
npm run lint
npm run typecheck
npm test
```

Do not rely on a remembered product count, deployment state, or blocker. Inspect the current worktree, CI run, Vercel deployment, and Neon state.

## Core references

- [Product north star](docs/product/NORTH_STAR.md)
- [Application architecture](docs/architecture/OVERVIEW.md)
- [Design system](docs/design/SYSTEM.md)
- [Catalogue operations](docs/catalogue/OPERATIONS.md)
- [Neon and data operations](docs/data/NEON.md)
- [Environment contract](docs/operations/ENVIRONMENTS.md)
- [Release process](docs/operations/RELEASE.md)
- [Operational runbooks](docs/operations/RUNBOOKS.md)

## Working rule

```text
inspect
  -> make one coherent change
  -> run every affected gate
  -> review the exact diff
  -> commit and push intentionally
  -> verify CI and the exact production deployment
```

Preserve unrelated work. Never weaken evidence, clinical, image, migration, or release gates merely to make a build pass.
