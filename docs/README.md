# JeloCare handbook

Updated: 2026-07-23

This is the entry point for product, engineering, data, and operations.

## Start here

| Need | Read |
| --- | --- |
| Understand what JeloCare is building | [North star](./product/NORTH_STAR.md) |
| Choose the next piece of work | [Roadmap](./product/ROADMAP.md) |
| Understand the application | [Architecture](./architecture/OVERVIEW.md) |
| Review public API and security boundaries | [APIs and security](./architecture/APIS_AND_SECURITY.md) |
| Build or review an interface | [Design system](./design/SYSTEM.md) |
| Work on the native operations shell | [Operations shell](./design/OPS_SHELL.md) |
| Apply the Observations split-view canon | [Operations UI canon](./OPS_UI_CANON.md) |
| Build or review the queue-level Overview | [Operations interface and overview contract](./adr/0010-operations-interface-and-overview-contract.md) |
| Plan or implement the operations console | [Operations console delivery](./operations/console/README.md) |
| Research and release a product | [Catalogue operations](./catalogue/OPERATIONS.md) |
| Run Neon safely | [Neon and data](./data/NEON.md) |
| Configure a local, preview, or production environment | [Environments](./operations/ENVIRONMENTS.md) |
| Start and test the application | [Local development](./operations/LOCAL_DEVELOPMENT.md) |
| Commit, deploy, and verify a release | [Release process](./operations/RELEASE.md) |
| Respond to an operational issue | [Runbooks](./operations/RUNBOOKS.md) |
| Hand the repository to another team | [Team handoff](./operations/HANDOFF.md) |
| Keep the repository understandable | [Repository ownership](./REPOSITORY.md) |

## Product systems

- [Inventory experience](./INVENTORY_EXPERIENCE.md)
- [2026 catalogue benchmark](./research/2026-07-26-inventory-catalogue-benchmark.md)
- [Retail intelligence](./RETAIL_INTELLIGENCE.md)
- [Nigeria retailer reference](./NIGERIA_RETAILERS.md)
- [Smart store guide](./retailers/SMART_STORE_GUIDE.md)
- [Community knowledge intake](./COMMUNITY_KNOWLEDGE_INTAKE.md)
- [Retailer partnership intake](./retailers/PARTNERSHIP_INTAKE.md)
- [Ask Jelo](./ASK_JELO_EXPERIENCE.md)
- [Concern knowledge](./CONCERN_KNOWLEDGE.md)
- [Ingredient review](./INGREDIENT_REVIEW.md)
- [SIMTI practice-source review](./research/2026-07-26-safe-in-my-skin-training-institute.md)
- [Behavioural analytics](./ANALYTICS.md)
- [Share and OpenGraph](./SHARE_AND_OPENGRAPH.md)

## Publication and media

- [Catalogue publication gate](./CATALOGUE_PUBLICATION_GATE.md)
- [Exact-SKU packshot generation handoff](./catalogue/PACKSHOT_GENERATION_HANDOFF.md)
- [Product image workflow](./PRODUCT_IMAGE_WORKFLOW.md)
- [Infrastructure](./INFRASTRUCTURE.md)

## Decisions

- [ADR 0001 · Deferred trust, collections, community, and stock alerts](./adr/0001-deferred-trust-collections-community-and-stock-alerts.md)
- [ADR 0002 · Anonymous community knowledge intake](./adr/0002-anonymous-community-knowledge-intake.md)
- [ADR 0003 · Retailer partnership intake](./adr/0003-retailer-partnership-intake.md)
- [ADR 0004 · Default to a pinned light theme](./adr/0004-default-light-theme.md)
- [ADR 0005 · Structured observation and behavioural events](./adr/0005-structured-observation-events.md)
- [ADR 0006 · Store ranking excludes commercial and popularity signals](./adr/0006-store-ranking-excludes-commercial-signals.md)
- [ADR 0007 · Internal moderation and operations console](./adr/0007-internal-moderation-operations-console.md)
- [ADR 0008 · Public-surface abuse and browser-security hardening](./adr/0008-public-surface-abuse-and-browser-hardening.md)
- [ADR 0009 · UI and UX work ships through explicit lane contracts](./adr/0009-ui-ux-lane-contract.md)
- [ADR 0010 · Operations use a native split-view work grammar](./adr/0010-operations-interface-and-overview-contract.md)

## What is authoritative

Documentation explains the system. Code and checked-in manifests enforce it.

| Question | Source of truth |
| --- | --- |
| Public catalogue records | `data/catalogue.ts`, `data/published-intake-products.ts`, and `lib/catalogue/repository.ts` |
| Catalogue pipeline counts | `npm run catalogue:pipeline:status` |
| Candidate source and readiness | `data/catalogue-intake-candidates/`, generated `data/catalogue-intake.json`, and `lib/catalogue/intake-readiness.ts` |
| Explicit publication | `data/catalogue-publication-dossiers.json` and `data/catalogue-publication-releases.json` |
| Database shape | Ordered files in `db/migrations/` |
| Environment names | `.env.example` plus direct `process.env` reads |
| Commands | `package.json` |
| CI gates | `.github/workflows/validate.yml` |
| Interface tokens | `app/globals.css`, then route and component CSS modules |

Never copy a changing count into a new document when a command can report it. Never weaken a code gate to make documentation true.

## Documentation rules

1. One subject per file.
2. Lead with the decision or outcome.
3. Link to the enforcing file or command.
4. Label aspirations as roadmap, not current behavior.
5. Never include credentials, connection strings, private tokens, or captured customer data.
6. Update the nearest guide in the same change when a public contract, migration, command, or operating procedure changes.

Run `npm run docs:check` before handoff. CI enforces document links, handbook
reachability, LF line endings, trailing whitespace, and final newlines.
