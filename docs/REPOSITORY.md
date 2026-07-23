# Repository ownership

Updated: 2026-07-23

The repository is an operating system for evidence, not only application code.

## Ownership map

| Path | Owner role | Review focus |
| --- | --- | --- |
| `app/`, `components/` | Product engineering | UX, accessibility, server/client boundary |
| `modules/clinical/`, clinical data | Clinical engineering and qualified reviewer | Safety, evidence, referrals |
| `lib/catalogue/`, catalogue manifests | Catalogue engineering and reviewer | Identity, care, offer, publication integrity |
| `lib/inventory/`, retail modules | Retail operations engineering | Freshness, extraction, response scope |
| `lib/community-intake/` | Community platform | Privacy, moderation, abuse |
| `lib/retailer-partnership/`, `lib/email/` | Partnerships and platform | Consent, private access, delivery |
| `db/migrations/` | Platform/data engineering | Forward compatibility, constraints, recovery |
| `scripts/` | Owning domain | Idempotency, safe defaults, auditability |
| `data/` | Owning reviewer and engineering | Provenance, generated-vs-authoritative status |
| `docs/` | Everyone | Contract changes and operational truth |

This is a responsibility map, not a GitHub CODEOWNERS enforcement file.

## Hygiene rules

- Keep the working tree legible.
- Preserve changes from other lanes.
- Prefer small modules and small documents.
- Delete dead generated output; do not delete authoritative evidence casually.
- Use `rg` and named scripts before inventing a new operator.
- Do not commit caches, local environments, provider project links, or database exports.
- Keep `package-lock.json` changes paired with intentional dependency changes.
- Add migrations; do not rewrite applied history.
- Update documentation with contract changes.
- Keep public copy and internal evidence language distinct.

## Generated and private material

| Material | Rule |
| --- | --- |
| `.cache/`, `.next/`, `.vercel/`, `tmp/` | Local/generated; never commit |
| `.env*` | Secret/local; never commit |
| `data/catalogue-research-queue.json` | Checked-in deterministic projection; rebuild by script |
| `data/catalogue-discovery-screening.json` | Checked-in private research snapshot |
| `data/catalogue-intake.json` | Checked-in deliberate private review manifest |
| Dossier and release manifests | Checked-in immutable publication evidence |
| Raw retailer captures | Keep private unless their exact checked-in role and rights are documented |
| Community and retailer submissions | Database only; never copy into fixtures or docs |

## Dependency changes

Before adding a package:

1. confirm an existing dependency or platform primitive cannot do the job;
2. check server/client impact;
3. pin or constrain it deliberately;
4. update the lockfile;
5. audit licensing and supply-chain risk;
6. run the complete gate.

Python packshot dependencies use a hash-locked runtime. Do not loosen it casually.

## Documentation maintenance

Update:

- `docs/architecture/` for a new service or trust boundary;
- `docs/data/` for a migration or persistence contract;
- `docs/operations/` for commands, environments, CI, deployment, or incidents;
- `docs/design/` for shared visual or interaction rules;
- `docs/product/` for strategy or roadmap changes;
- an ADR for decisions that are hard to reverse.

Every new document should be linked from [docs/README.md](./README.md).
