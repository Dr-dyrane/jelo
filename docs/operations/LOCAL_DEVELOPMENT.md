# Local development

Updated: 2026-08-14

## First run

Requirements:

- Node.js 24, matching CI;
- npm;
- Python 3.12 only for packshot operators;
- access to the required service environments for integration work.

```bash
git pull --ff-only
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000` unless a different port is selected.

## Fast feedback

For a normal TypeScript or UI change:

```bash
npm run lint
npm run typecheck
npm test
```

For the complete local gate:

```bash
npm run validate
```

`npm run build` uses the Vercel wrapper. Outside Vercel Production it runs only
`next build`. Even in Vercel Production, database migrations and reconciliation
remain explicit protected operator jobs.

## Domain checks

| Change | Add |
| --- | --- |
| Catalogue candidate | `npm run catalogue:intake:audit` |
| Research queue | `npm run catalogue:research:verify` |
| Publication dossier | `npm run catalogue:publication:verify` |
| Release manifest | `npm run catalogue:publication:releases:verify` |
| Public packshot | `npm run catalogue:publication:images:verify` and `npm run assets:verify` |
| Product or offer data | `npm run inventory:audit` and `npm run inventory:prices` |
| Ingredient data | `npm run clinical:audit` |
| Migration SQL or runner | `npm run db:migrations:validate` plus focused `modules/release/migration-*.test.ts`; database status/apply still requires the protected operator workflow |
| Packshot Python operator | `npm run catalogue:packshot:tool:check` |
| Community intake | Relevant `modules/community-intake/*.test.ts` plus API interaction |
| Retailer partnership | Route, repository, email rendering, magic-link, and responsive journey checks |

## Browser review

Validate the changed journey at desktop and mobile widths.

- Start from a clean navigation state.
- Exercise keyboard and pointer paths.
- Inspect console and failed network requests.
- Test loading, empty, error, success, Undo, and retry states.
- Verify focus restoration after sheets and dialogs.
- Test reduced motion and reduced transparency when the component uses either.
- Confirm public image transparency on peach, pink, and dark surfaces.

The `/image-audit` route helps inspect canonical product and editorial assets. It does not replace exact-SKU identity review.

## Test ownership

Tests live under `modules/**/*.test.ts` and use Node's test runner through `tsx`.

- Put pure domain behavior beside its module.
- Test fail-closed paths.
- Bind checked-in manifests to deterministic counts or digests only when drift must stop the build.
- When counts are expected to grow, update the test in the same deliberate release.
- Do not snapshot volatile retailer HTML.

## Generated files

`.next/`, `.cache/`, `.vercel/`, `tmp/`, TypeScript build info, and local environment files are not source.

Checked-in JSON under `data/` may be authoritative or generated. Read the owning script before editing. In particular, rebuild the research queue through its script.
