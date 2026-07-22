# JeloCare Codex Engineering Handoff

## Ownership mode

You are taking over active engineering ownership of `Dr-dyrane/jelo` on `main`.

Do not treat this as a single ticket. Pull the latest repository, inspect the actual code, read the deployment logs, fix the current production blocker, and then continue the platform roadmap through small, production-safe commits.

The user prefers continuous execution with minimal narration:

```text
inspect -> implement -> validate -> commit -> inspect deployment -> fix next blocker
```

Do not stop after writing a plan. Do not repeatedly ask for permission to continue. Stop only for a genuine external blocker such as missing credentials, destructive migration approval, or unavailable third-party access.

---

## Repository and deployment

```text
Repository: Dr-dyrane/jelo
Branch: main
Framework: Next.js 16.2.10
Language: TypeScript 5.9
Runtime/build: Vercel
Database: Neon PostgreSQL
Media: Vercel Blob
Cache/transient state: Upstash Redis
Runtime flags: Vercel Edge Config
AI: Vercel AI Gateway / AI SDK
```

Pull the repository and Vercel project state before changing code.

```bash
git clone https://github.com/Dr-dyrane/jelo.git
cd jelo
git checkout main
git pull --ff-only
npm install
vercel pull --yes
vercel env pull .env.local
```

Read first:

```text
README.md
CODEX_HANDOFF.md
docs/INFRASTRUCTURE.md
docs/RETAIL_INTELLIGENCE.md
package.json
scripts/vercel-build.ts
scripts/migrate-database.ts
scripts/seed-catalogue.ts
lib/catalogue/repository.ts
lib/inventory/refresh-worker.ts
lib/inventory/repository.ts
lib/clinical/ingredients.ts
data/products.ts
data/catalogue.ts
app/products/[slug]/page.tsx
components/commerce/retailer-list.tsx
db/migrations/*
```

Also inspect the entire `app/`, `components/`, `lib/`, `scripts/`, `data/`, `db/`, and `docs/` trees before broad refactors.

---

## Immediate production blocker

The previous Vercel build failed because `scripts/vercel-build.ts` used top-level `await` while `tsx` transformed the script as CommonJS.

That file was fixed in commit:

```text
e8c2fc5ab98e105c3e454b634aa209c9b9a704c5
fix(build): avoid top-level await in Vercel wrapper
```

The wrapper now uses `async function main()` and reports failures through `process.exitCode`.

However, the Vercel status for that commit is still failing. Therefore the top-level-await error was only the first blocker. Your first action is to open the latest Vercel deployment logs and identify the new failure.

Do not assume the next error. Pull the exact logs.

Recommended flow:

```bash
vercel inspect <latest-deployment-url> --logs
# or use the Vercel dashboard / CLI deployment logs available to you
npm run typecheck
npm run build
```

Fix the next real failure, validate locally where possible, commit atomically, and inspect Vercel again. Continue until the production build is green.

Likely areas to verify because they were recently introduced:

```text
db/migrations/0004_ingredient_knowledge_graph.sql
lib/clinical/ingredients.ts
scripts/audit-ingredient-knowledge.ts
scripts/audit-offer-prices.ts
lib/inventory/refresh-worker.ts
scripts/vercel-build.ts
```

Do not disable migrations merely to make the deployment green unless the migration itself is unsafe and you document the temporary rollback. The intended production flow is:

```text
Vercel production deployment
  -> run pending Neon migrations under advisory lock
  -> run next build
```

Preview and local builds should skip production migrations unless deliberately invoked.

---

## Product definition

JeloCare is a pharmacist-led skincare and haircare intelligence platform.

It is not primarily:

```text
an ecommerce store
an open marketplace
a generic skincare chatbot
a diagnosis product
```

It combines three core systems:

```text
Clinical Intelligence
+ Retail Intelligence
+ Grounded AI Guidance
```

The product should answer:

1. What product or routine is appropriate for this concern?
2. Why is it appropriate, including safety and evidence?
3. Where can the user buy it in Nigeria at the best recently verified price?

Guidance must remain educational and pharmacist-curated, not diagnostic.

---

## Product and design philosophy

The public experience should feel editorial, premium, calm, and clinically credible.

Use these principles:

```text
Apple-like restraint
luxury skincare editorial presentation
borderless or very light visual structure
strong typography and whitespace
progressive disclosure
minimal copy
clear hierarchy
physical, subtle motion
mobile-first responsiveness
```

Avoid:

```text
Amazon/Shopify marketplace density
enterprise-dashboard aesthetics
chatbot-first homepage design
unnecessary borders
verbose explanatory UI
fake medical certainty
unverified authenticity claims
```

The homepage remains editorial. AI works behind the scenes and appears where it adds clear utility.

---

## Current implemented foundation

### Catalogue

- Static verified catalogue exists in TypeScript.
- Neon-backed catalogue repository exists at `lib/catalogue/repository.ts`.
- `CATALOGUE_SOURCE=neon` enables Neon reads.
- Public reads fall back to the static catalogue if Neon is unavailable.
- Products, brands, concerns, skin types, best-for labels, images, retailers, and offers are normalized in PostgreSQL.

Preserve this fallback until Neon data completeness is demonstrated and an explicit migration decision is made.

### Assets

- Vercel Blob is intended to be the canonical production media store.
- Runtime product pages should not depend on third-party product image hosts.
- Asset importer, audit, and sync commands exist.
- Product image records are persisted in Neon.
- Seeding should not overwrite verified Blob URLs with original hotlinks.

Commands:

```bash
npm run assets:audit
npm run assets:import
npm run assets:sync
```

### Retail intelligence

Implemented foundations include:

```text
retailers
offers
inventory state
verification method and expiry
inventory refresh queue
safe queue claiming with SKIP LOCKED
retailer-page worker
retry/backoff handling
price extraction
current price persistence
price history
inventory audit
price-quality audit
Nigeria-first product-page retailer display
```

Commands:

```bash
npm run inventory:queue
npm run inventory:work
npm run inventory:audit
npm run inventory:prices
```

Launch Nigerian reference retailers:

```text
Beauty by Daz
Lux Beauty NG
Teeka4
```

Existing retailers such as Perona, Care to Beauty, official brand stores, AGT Plaza, Slique Beauty, and others may already appear in static product data.

Nigerian offers must appear before US/international offers. Product pages should show prices before the user navigates away. Missing price is `Pending verification`, never zero.

Do not claim retailer authenticity unless specific evidence supports it. Distinguish retailer identity, availability evidence, observed price, and authenticity review.

### Clinical knowledge

The ingredient knowledge graph foundation exists.

Current model includes:

```text
ingredients
INCI synonyms
product_ingredients
ingredient_concerns
ingredient_relations
pregnancy status
nursing status
sensitive-skin status
comedogenic rating
evidence grade
pharmacist-reviewed state
citations/source metadata
```

Repository primitives exist in `lib/clinical/ingredients.ts`.

Validation command:

```bash
npm run clinical:audit
```

This is a schema and repository foundation, not a complete clinical dataset. Do not expose safety badges or strong clinical claims until records are seeded, referenced, and pharmacist-reviewed.

---

## Current scripts

Confirm the live `package.json`, but the intended commands are:

```bash
npm run dev
npm run build
npm run build:next
npm run typecheck
npm run lint
npm run db:migrate
npm run db:seed
npm run assets:audit
npm run assets:import
npm run assets:sync
npm run inventory:queue
npm run inventory:work
npm run inventory:audit
npm run inventory:prices
npm run clinical:audit
```

Note: `next lint` may not be valid in the installed Next.js version. Verify it instead of assuming. Replace it with an explicit ESLint command if needed, preserving a stable `npm run lint` contract.

---

## Data architecture

The intended platform chain is:

```text
Products
  -> Product images
  -> Ingredients
  -> Ingredient evidence and safety
  -> Concerns
  -> Retailers
  -> Offers
  -> Inventory verification
  -> Price history
  -> Market summaries
  -> Routine engine
  -> Pulse retrieval context
```

PostgreSQL is the source of truth for durable business and clinical data.

Blob is the source of truth for production media binaries.

Redis is disposable and must never be the sole copy of data.

Edge Config is for small global runtime flags only, never products, consultations, personal data, or secrets.

---

## Engineering standards

### Commits

Use small atomic commits with one concern each.

Examples:

```text
fix(build): repair production migration wrapper
fix(db): make ingredient migration valid on clean Neon database
feat(clinical): seed canonical ingredient records
feat(retail): add retailer adapter registry
refactor(catalogue): preserve lowest verified offer price
```

Do not mix schema changes, UI redesigns, and broad refactors into one commit.

### Validation

Before every commit, run the narrowest relevant checks. Before declaring a wave complete, run:

```bash
npm run typecheck
npm run build
```

Run relevant operational audits when database access is available:

```bash
npm run clinical:audit
npm run inventory:audit
npm run inventory:prices
npm run assets:audit
```

After every production-relevant commit, inspect Vercel. Do not say a deployment is healthy until the check is actually green.

### Database

- Migrations are immutable after production application.
- Add a new migration instead of editing an applied migration.
- Migrations must work on a clean database and an incrementally migrated database.
- Use advisory locks for shared migration execution.
- Avoid destructive changes without explicit approval and a rollback plan.
- Preserve historical offer prices.
- Never silently rewrite reviewed clinical claims.

### Code

- Keep server-only modules marked `server-only`.
- Keep credentials and database access out of client components.
- Prefer repository functions, service modules, adapters, and deterministic pure logic.
- Avoid duplicated SQL and duplicated business rules.
- Avoid giant components and giant service files.
- Preserve type safety across database rows and public models.
- Add tests or executable audits around parsers, ranking, safety rules, and migrations.

---

## Priority roadmap after the build is green

### 1. Stabilize production and CI

- Resolve every current Vercel build/migration error.
- Verify local `typecheck` and build.
- Repair the lint script if Next 16 removed the current command.
- Add a GitHub Actions validation workflow if one does not exist.
- Add migration smoke testing against a disposable PostgreSQL database where practical.
- Ensure production and preview environment behavior is explicit.

### 2. Retailer adapter architecture

Replace broad generic HTML pattern matching with a structured adapter registry.

Recommended contract:

```ts
type RetailerExtraction = {
  inventoryStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  priceMinor: number | null;
  currencyCode: string | null;
  productTitle?: string;
  canonicalUrl?: string;
  evidence: string[];
  confidence: number;
};

interface RetailerAdapter {
  matches(url: URL): boolean;
  extract(input: { url: URL; html: string }): RetailerExtraction;
}
```

Start with:

```text
Beauty by Daz
Lux Beauty NG
Teeka4
Perona Beauty
Care to Beauty
```

Use structured data first:

```text
JSON-LD Product/Offer
OpenGraph/product meta
Shopify/WooCommerce embedded data
retailer-specific selectors or scripts
conservative generic fallback
```

Persist extraction confidence and evidence. Do not infer `in_stock` merely because a page contains unrelated `Add to cart` text.

### 3. Market summaries

Compute per-product, per-market intelligence:

```text
lowest verified price
median/typical price
highest current price
verified retailer count
in-stock retailer count
freshest verification
7-day and 30-day price movement
savings versus median
market confidence score
```

Keep summaries derivable from offers and price history. Use a materialized table or view only when necessary for performance.

### 4. Offer correctness

- Correct catalogue aggregation that currently uses grouped `max(price_minor)` where lowest current price may be the intended display value.
- Preserve separate offers by market and product URL where needed.
- Add canonical URL normalization and tracking-parameter removal.
- Add duplicate-offer detection.
- Add retailer identity and domain validation.
- Add low-stock support throughout repository and UI.

### 5. Clinical seed and review workflow

Seed a small, high-quality ingredient set first:

```text
salicylic acid
niacinamide
tranexamic acid
retinol/retinoids
benzoyl peroxide
azelaic acid
vitamin C families
AHAs
ceramides
hyaluronic acid
sunscreen filters used by catalogue products
```

For each record:

```text
canonical INCI
common names/synonyms
function and concern relationships
evidence grade
pregnancy/nursing status with qualified wording
sensitive-skin guidance
sun-protection implications
source references
review state
reviewed-by metadata and timestamp
```

Do not invent concentrations. Distinguish disclosed concentration from inferred presence.

### 6. Product-to-ingredient enrichment

- Import verified ingredient lists.
- Preserve source URL and observation timestamp.
- Track formulation region/version when relevant.
- Mark active ingredients separately from full INCI order.
- Audit products missing ingredient lists.

### 7. Deterministic routine engine

Build rules before AI-generated routines.

Inputs:

```text
skin concerns
skin type/sensitivity
current products
pregnancy/nursing context when voluntarily provided
AM/PM preference
budget and Nigerian availability
```

Outputs:

```text
ordered AM and PM routines
duplicate-active warnings
irritation-load warnings
explicit avoid-together rules
frequency guidance
missing essential steps
SPF dependency
reason for every recommendation
```

The engine should return structured decisions and citations. Pulse may explain the result but should not replace the deterministic safety layer.

### 8. Pulse grounding

Pulse should retrieve from:

```text
published product catalogue
reviewed ingredient records
ingredient-concern evidence
compatibility/conflict rules
retail offers and market summaries
routine engine decisions
```

Never let the model invent stock, price, ingredient concentration, safety status, or medical diagnosis.

### 9. Asset completion

- Move every production image to Blob.
- Store dimensions, format, byte size, source, checksum, and review status.
- Eliminate runtime third-party product-image dependencies.
- Keep `/image-audit` operational.
- Introduce authenticated asset management only after an approved auth plan.

### 10. Catalogue growth

Target a curated catalogue, not indiscriminate scraping.

Quality gate for each product:

```text
canonical name and size
brand
category and routine step
owned/Blob image
verified ingredient list or explicit missing state
concern relationships
safe usage copy
at least one Nigerian offer when available
reviewed evidence wording
```

Grow toward 100-150 high-quality products only after these gates are automated.

---

## Known architectural cautions

1. `CATALOGUE_SOURCE=neon` still has a static fallback. Preserve intentional behavior and log fallback without leaking sensitive details.
2. Retailer-page extraction now has structured adapters for Beauty by Daz, Lux Beauty NG, Teeka4, Perona Beauty and Care to Beauty. Keep expanding fixtures and adapters before treating unknown hosts as high-confidence live intelligence.
3. Price units are named `price_minor`, while Nigerian static models use `priceNgn`. Verify whether NGN is stored as whole naira or kobo and standardize semantics before adding financial calculations.
4. The catalogue query now selects the lowest stored price per currency. Keep this invariant covered when adding delivered-price or market-history calculations.
5. Authentication is not yet an approved public product surface. Do not add login gates casually.
6. Clinical tables are not permission to publish unsupported medical claims. Review status and sources matter.
7. Build-time production migrations increase deployment coupling. Keep them safe, locked, fast, and observable; consider a separate release migration job only if the current model becomes unreliable.
8. Do not store Google tracking query parameters such as `srsltid` in canonical retailer URLs.

---

## Definition of done for the takeover

The initial handoff is complete only when:

```text
latest main is pulled
current Vercel failure is understood from exact logs
all build blockers are fixed
npm run typecheck passes
npm run build passes
Vercel production check is green
migrations are confirmed applied or safely pending
README/docs remain accurate
next roadmap item is implemented through an atomic commit
```

Continue from there without waiting for repeated approval.
