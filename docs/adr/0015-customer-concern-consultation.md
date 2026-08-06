# ADR 0015: Customer Concern Consultation

- **Status:** Accepted; implementation open
- **Date:** 2026-08-06
- **Decision owner:** Founder
- **Extends:** [ADR 0013](0013-founder-led-jelocare-me.md), [ADR 0014](0014-customer-shelf-data-boundary.md)
- **Related:** [ADR 0011](0011-guide-resolution-and-clinical-product-authority.md) (clinical content authority), [ADR 0009](0009-ui-ux-lane-contract.md) (UI lane contract)
- **Supersedes:** None
- **Founder approval:** Granted for the bounded decision recorded here

## Outcome

JeloCare Me gains a real consultation experience. When a person types what
they notice into Consult, the first thing they see is the reviewed knowledge
library's answer for that concern — the summary, the signals, the ingredients
to look for, the safety notes, and the escalation guidance — sourced from the
NHS and the American Academy of Dermatology. Below that answer, they see the
exact catalogue products reviewed as supportive for that concern. They can
then say "I'm dealing with this" and save the concern to their account, which
flows through Explore, Home, and the product page.

This decision introduces:

1. a pure concern-matching function that maps free search text to reviewed
   concern content;
2. a Consult surface that shows concern content above product results;
3. a customer concern store mirroring the Shelf and Routine persistence
   pattern (PostgreSQL, RLS, append-only lifecycle);
4. a concern service with `list`, `add`, `remove`, and `clear` operations;
5. wiring from the concern store into the route read models so Explore, Home,
   and the product page receive the customer's concerns; and
6. a warm first-time experience where Consult is the onboarding moment.

It does **not** introduce:

- AI-generated concern answers;
- a diagnosis, assessment, or clinical triage;
- provider-supplied concern data;
- public concern profiles or social features;
- concern-based notifications or alerts;
- a new snapshot schema version; or
- changes to the existing Shelf, Routine, catalogue, or publication contracts.

## Why this decision, and why now

### The empathy gap

The portal's infrastructure is mature. Shelf and Routine are real — full
PostgreSQL with RLS, optimistic concurrency, the works. The product page is
live-reactive. The dock, sheets, and form patterns are established. The
knowledge library in `data/knowledge.ts` contains 20+ reviewed concerns with
summaries, signals, ingredients, safety notes, escalation guidance, and
medical sources.

But the person using the portal cannot see any of that knowledge.

The Consult page says "My concerns" and "What I've noticed" but the concerns
array is hardcoded to `[]` in every read model. The page says "Suggestions
and saved concern reporting are not available yet." Explore has a "My
concern" filter that never renders because there are no concerns to populate
it. The knowledge library — reviewed, sourced, safety-conscious — is invisible
to the user.

A person types "acne" and gets six product cards. They do not get told what
acne is, what ingredients help, what to avoid during pregnancy, or when to
stop self-treating and see a clinician. The portal knows these things. It
just doesn't show them.

### The content-first principle

This decision is ordered around the person, not the system. The first thing
shipped is not a database table or a service — it is the connection between
the reviewed knowledge library and the Consult search input. When someone
types "acne" or "dark spots" or "dry skin," the first thing they see is the
concern content, not a product grid.

This is deliberate. If the concern store is built first, the user gets a form
that says "select your concerns" with no explanation of what each concern
means. That is a database admin panel, not a consultation. By exposing the
knowledge library first, every concern selection comes after the user has
read what the concern is, what signals to look for, and what ingredients
help. They make an informed choice, not a blind checkbox. The content gives
the selection meaning.

### Why concerns before other features

Concerns are the input to every future care feature. A goal like "clear my
acne in 3 months" needs to know the user has acne. A routine template for
sensitive skin needs to know the user's skin is sensitive. Building goals,
templates, or tracking before concerns means hardcoding the concern reference
and then back-filling it later.

The bridge debt (the `shellViewModelFromHome` and `shellViewModelFromProduct`
adapter functions in `me-home.tsx`) is real but invisible to the user. It can
wait until after the portal delivers on its care promise. Retiring it after
concerns are wired means we add one field to `CustomerPortalViewModel` and
then delete the entire legacy type along with that field, rather than adding
it and immediately removing it.

## Current-state findings

### Knowledge library

`data/knowledge.ts` exports a `concerns: Concern[]` array containing 20+
reviewed concerns. Each concern has:

- `slug` — stable identifier (e.g., `acne-breakouts`)
- `name` — display name (e.g., "Acne & breakouts")
- `area` — `'Face' | 'Scalp' | 'Hair' | 'Body'`
- `kind` — `'concern'` (everyday care) or `'condition-pattern'` (clinical
  pattern that needs escalation)
- `summary` — one-sentence description
- `signals` — list of observable signs
- `ingredients` — recommended ingredients with safety notes (e.g.,
  "adapalene — do not use during pregnancy; ask a clinician first")
- `ingredientSources` — links to authoritative sources per ingredient
- `productTerms` — search terms for matching products
- `escalation` — when to seek clinical help
- `urgentAction` — optional same-day or emergency guidance
- `sources` — medical references (NHS, AAD)
- `reviewedAt` — content review timestamp

Condition-patterns (`kind: 'condition-pattern'`) have `productTerms: []` and
are not eligible for product matching. They exist to provide escalation
guidance when a person's search matches a clinical pattern rather than an
everyday concern.

### Product-to-concern binding

Products already carry `supportedConcernSlugs` derived from the care review
pipeline. In `lib/customer/portal-model.ts`:

```ts
const supportedConcernSlugs = care?.careState === 'supportive_eligible'
  ? [...new Set(care.approvedUses.flatMap(use => use.concernSlugs ?? []))]
  : [];
```

This binding is reviewed, governed, and already shipped. No new product
classification is needed.

### Explore concern filter

`lib/customer/explore-model.ts` already has concern filtering infrastructure:

```ts
matchedConcernSlugs: product.supportedConcernSlugs.filter(slug => {
  const concern = supportedConcernBySlug.get(slug);
  return Boolean(concern && concernAreaMatchesProduct(concern, product));
})
```

The "For your concerns" section in the explore projection already exists. The
"My concern" filter in the filter sheet already exists. Both are dormant
because `concerns` is always `[]` in the read model.

### Consult search

The Consult search in `me-home.tsx` (lines 319-325) currently filters the
catalogue by matching the search text against product fields (brand, name,
category, step, displayLine, size). It does not match against concern
content. The search is purely product-oriented.

### Consult copy

The Consult page currently says:

- Heading: "My concern."
- Section: "My concerns" / "What I've noticed."
- Empty state: "No concerns have been reported here. Search what you notice
  below; this does not save or diagnose a concern."
- Search heading: "Ask Me" / "Explore your care." / "Search the exact
  catalogue in your own words."
- Empty search: "Suggestions and saved concern reporting are not available
  yet."
- No results: "No exact catalogue products match that search."

The page promises consultation but delivers product search.

### Shelf and Routine persistence pattern

Both Shelf and Routine follow the same pattern:

1. A PostgreSQL table with `owner_subject` text, RLS enforced via
   `app.customer_subject` session setting, and `jelocare_shelf_runtime` role
   with SELECT/INSERT/UPDATE/DELETE but no TRUNCATE/REFERENCES/TRIGGER.
2. A repository module (`shelf-repository.ts`, `routine-repository.ts`) with
   `server-only` import, connection pooling, and transaction-scoped RLS
   attestation.
3. A policy module (`shelf-policy.ts`, `routine-policy.ts`) that checks
   `CustomerAccessIdentity` and returns calm unavailable/error states for
   synthetic identities.
4. A service module (`shelf-service.ts`, `routine-service.ts`) that wires the
   repository to the policy.
5. A read-model integration in `route-read-models.ts` that loads the data
   server-side and passes it to the view model.

The concern store will follow this exact pattern.

## Decision

### 1. Pure concern matching

A pure function maps free search text to reviewed concern content. It lives
in a new `lib/customer/concern-matching.ts` module.

```ts
type ConcernMatch = {
  concern: Concern;
  matchedTerms: string[];
  matchedSignals: string[];
};

function matchConcerns(
  search: string,
  concerns: readonly Concern[],
): ConcernMatch[];
```

The function:

- receives the search string and the knowledge library concerns;
- normalizes the search to lowercase;
- matches against concern `name`, `slug`, `productTerms`, and `signals`;
- returns matches ranked by match quality (name match > productTerm match >
  signal match);
- never calls `new Date()`, never accesses React, storage, network, or AI;
- returns an empty array for empty or whitespace-only search; and
- includes condition-patterns in matching so escalation guidance surfaces
  even when no products are eligible.

This function is pure and testable in isolation. It has no UI, store, or
database dependencies.

### 2. Consult surface redesign

The Consult view gains a concern content section between the search field
and the product results. When the search matches one or more concerns, the
view shows:

```
Acne & breakouts
Face

Blackheads, spots and recurring breakouts.

What to look for
blackheads · whiteheads · inflamed spots · oiliness

Ingredients that help
salicylic acid · azelaic acid · benzoyl peroxide
adapalene — do not use during pregnancy; ask a clinician first

When to get help
Get clinical help for deep pain, nodules, scarring, sudden severe acne
or acne that is not improving.

Sources
American Academy of Dermatology · Acne
NHS · Acne treatment and pregnancy

[ I'm dealing with this ]    [ See products ]

Educational care context only · Not a diagnosis.
```

When the search matches a condition-pattern (e.g., "ringworm"), the view
shows the content with the escalation guidance emphasized and no product
section, because condition-patterns have `productTerms: []`.

When the search matches no concerns, the view shows the product search
results as it does today.

When the search is empty, the view shows the customer's saved concerns (if
any) and a prompt to search what they notice.

The "I'm dealing with this" button saves the concern to the customer's
concern store. The "See products" button scrolls to the product results
below.

### 3. Customer concern store

A new `customer_concerns` table mirrors the Shelf and Routine persistence
pattern.

```sql
begin;

create type customer_concern_origin as enum (
  'customer',
  'synthetic-development'
);

create table customer_concerns (
  id uuid primary key default gen_random_uuid(),
  owner_subject text not null
    check (
      nullif(pg_catalog.btrim(owner_subject), '') is not null
      and pg_catalog.length(owner_subject) <= 320
    ),
  concern_slug text not null
    check (
      nullif(pg_catalog.btrim(concern_slug), '') is not null
      and pg_catalog.length(concern_slug) <= 80
    ),
  origin customer_concern_origin not null default 'customer',
  saved_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (owner_subject, concern_slug, removed_at)
);

create index customer_concerns_owner_active_idx
  on customer_concerns (owner_subject, concern_slug)
  where removed_at is null;

create index customer_concerns_owner_saved_idx
  on customer_concerns (owner_subject, saved_at desc);

alter table customer_concerns enable row level security;
alter table customer_concerns force row level security;

create policy customer_concerns_owner_policy
on customer_concerns
for all
using (owner_subject = pg_catalog.current_setting('app.customer_subject', true))
with check (owner_subject = pg_catalog.current_setting('app.customer_subject', true));

revoke all privileges on table public.customer_concerns from public;
revoke all privileges on table public.customer_concerns from jelocare_app_runtime;
revoke all privileges on table public.customer_concerns from jelocare_shelf_runtime;

grant usage on type public.customer_concern_origin to jelocare_shelf_runtime;
grant select, insert, update on table public.customer_concerns to jelocare_shelf_runtime;

commit;
```

Design notes:

- **Append-only lifecycle.** Removing a concern sets `removed_at` rather than
  deleting the row. This preserves history for export and audit, matching the
  Shelf pattern's lifecycle states.
- **Unique constraint includes `removed_at`.** This allows a concern to be
  removed and later re-added. The partial index on `where removed_at is null`
  enforces one active row per concern per customer.
- **No `updated_at`.** A concern row is created once and optionally retired.
  There is no edit operation.
- **No foreign key to a concerns table.** The concern slug is a text column
  bounded by a check constraint, not a foreign key. The knowledge library is
  a reviewed code asset, not a database table. This avoids coupling the
  customer store to the content library's lifecycle.
- **No TRUNCATE, REFERENCES, or TRIGGER privileges.** The runtime role can
  SELECT, INSERT, and UPDATE (for `removed_at`) but cannot TRUNCATE, create
  foreign keys, or add triggers. This matches the Shelf and Routine privilege
  contract.
- **Migration number.** The next available migration number after `0037`. The
  migration file will be `0038_customer_concerns.sql`.

### 4. Concern repository

A new `lib/customer/concern-repository.ts` module mirrors
`shelf-repository.ts`:

```ts
export type CustomerConcernRecord = {
  concernSlug: string;
  savedAt: string;
  origin: 'customer' | 'synthetic-development';
};

export type CustomerConcernRepository = {
  list(ownerSubject: string): Promise<CustomerConcernRecord[]>;
  add(ownerSubject: string, concernSlug: string): Promise<'added' | 'already_saved'>;
  remove(ownerSubject: string, concernSlug: string): Promise<'removed' | 'already_removed'>;
  clear(ownerSubject: string): Promise<number>;
};
```

The repository:

- imports `server-only`;
- uses the same `getCustomerShelfPostgresClient` connection (shared
  `jelocare_shelf_runtime` role);
- asserts RLS via `assertCustomerShelfRlsRole` in each transaction;
- `list` returns only active concerns (`where removed_at is null`);
- `add` inserts a new row or reactivates a previously removed row;
- `remove` sets `removed_at` on the active row;
- `clear` sets `removed_at` on all active rows for the owner; and
- validates `ownerSubject` via `isValidCustomerShelfOwnerSubject`.

### 5. Concern policy and service

A new `lib/customer/concern-policy.ts` module mirrors `shelf-policy.ts`:

```ts
export type CustomerConcernReadResult = {
  status: 'ready' | 'unavailable';
  concerns: CustomerConcernRecord[];
  message: string | null;
};

export type CustomerConcernActionResult = {
  status: 'saved' | 'removed' | 'cleared' | 'error';
  concernSlug?: string;
  message: string | null;
};

export function createCustomerConcernService(repository: CustomerConcernRepository) {
  return {
    async read(identity: CustomerAccessIdentity): Promise<CustomerConcernReadResult>,
    async add(identity: CustomerAccessIdentity, concernSlug: string): Promise<CustomerConcernActionResult>,
    async remove(identity: CustomerAccessIdentity, concernSlug: string): Promise<CustomerConcernActionResult>,
    async clear(identity: CustomerAccessIdentity): Promise<CustomerConcernActionResult>,
  };
}
```

The policy:

- checks `identity.source === 'synthetic-development'` and returns
  unavailable/error for synthetic identities, matching Shelf and Routine;
- validates `concernSlug` against the knowledge library's concern slugs
  (rejects unknown slugs);
- validates that the concern `kind` is `'concern'` (condition-patterns
  cannot be saved — they are escalation-only); and
- returns calm states, never throws for malformed input.

A new `lib/customer/concern-service.ts` wires the repository to the policy:

```ts
import { postgresCustomerConcernRepository } from './concern-repository';
import { createCustomerConcernService } from './concern-policy';

export const customerConcernService = createCustomerConcernService(
  postgresCustomerConcernRepository,
);
```

### 6. Read model integration

The route read models in `route-read-models.ts` gain concern loading. The
`readMeHome` and `readCustomerPortal` functions call
`customerConcernService.read(customer)` and populate the `concerns` field in
the view model.

The concerns are mapped from `CustomerConcernRecord` to
`CustomerPortalConcernReference` by joining against the knowledge library:

```ts
const concerns = records
  .map(record => {
    const knowledge = knowledgeLibraryConcerns.find(c => c.slug === record.concernSlug);
    if (!knowledge) return null; // slug retired from library
    return {
      slug: knowledge.slug,
      name: knowledge.name,
      area: knowledge.area,
      kind: knowledge.kind,
      source: record.origin === 'synthetic-development' ? 'synthetic-development' as const : 'customer' as const,
    };
  })
  .filter((c): c is CustomerPortalConcernReference => c !== null);
```

If a concern slug is retired from the knowledge library, the record remains
in the database but is not surfaced. This handles the case where a reviewed
concern is renamed or removed — the customer's saved data is not lost, but it
is not displayed until the slug is restored or the customer removes it.

### 7. Server actions

A new `app/api/customer/concerns/route.ts` or server action module exposes
`add`, `remove`, and `clear` operations to the client. These mirror the
existing shelf action pattern:

- `POST` with `{ action: 'add', concernSlug }` or `{ action: 'remove', concernSlug }` or `{ action: 'clear' }`;
- validates the customer identity server-side;
- calls the concern service;
- returns the result; and
- triggers `router.refresh()` on success to update server-rendered surfaces.

### 8. Synthetic preview

For synthetic development mode, concerns are stored in React Context state,
matching the preview shelf pattern in `me-shelf-state.tsx`. A
`useMeConcernState` hook provides:

- `concerns` — the current concern list (from context for synthetic, from
  view model for production);
- `addConcern(slug)` — adds a concern to the preview state;
- `removeConcern(slug)` — removes a concern from the preview state;
- `clearConcerns()` — clears all preview concerns; and
- `previewOnly` — boolean indicating synthetic mode.

Preview concerns persist across route changes (React Context) but reset on
page reload, matching the preview shelf behavior.

### 9. Home surface

`HomeView` gains a "For your concerns" section that appears when the customer
has saved concerns and there are catalogue products matching those concerns
that are not already on the shelf or in a routine. The section shows:

```
For your concerns

Products reviewed for acne, dark spots, and sensitive skin that
you haven't saved yet.

[product card] [product card] [product card]
```

This section appears after "Recently saved" and before "Fresh prices" in the
information hierarchy. It is the discovery surface that makes concerns
actionable — not just saved, but connected to products the user hasn't tried
yet.

For a first-time user with no shelf, no routine, and no concerns, the Home
page shows a warm prompt:

```
Welcome to JeloCare

What are you noticing? Search your care concerns to get started.

[ Search my care ] → /me/consult
```

This replaces the current "Welcome back" + empty sections experience for
first-time users. The greeting remains for returning users.

### 10. Explore surface

No new Explore code is needed. The existing concern filter and "For your
concerns" section in `explore-model.ts` activate automatically once
`concerns` is non-empty in the read model. The "My concern" dropdown
populates from the customer's saved concerns. The "For your concerns"
section shows products matching any of the customer's concerns.

### 11. Product page surface

The product page's personal context line gains a concern match indicator
when the product's `supportedConcernSlugs` intersect the customer's saved
concerns:

```
On my Shelf · In Morning routine · Matches your acne concern
```

This is a read-only display. It does not add a button or action — the
product page already has shelf and panel actions. The concern match is
context, not an action.

### 12. Context sheet

The context sheet gains a concerns summary on the Consult and Home surfaces:

```
At a glance
5 saved products · 3 steps · 2 concerns
```

And on the Consult surface:

```
My care
2 concerns · 12 matching products
```

### 13. Account sheet

The account sheet gains a "My concerns" data section between the shelf data
and the export actions:

```
My concerns
2 saved concerns

[ Clear concerns ]
```

The "Clear concerns" action has a confirmation dialog matching the "Clear
Shelf" pattern:

```
Remove all saved concerns? This cannot be undone.
```

### 14. Copy and terminology

The UI uses:

- **"What I've noticed"** — the concerns section heading
- **"I'm dealing with this"** — the save concern button
- **"See products"** — the scroll-to-products button
- **"Educational care context only · Not a diagnosis"** — the disclaimer
- **"When to get help"** — the escalation heading
- **"Ingredients that help"** — the ingredients heading
- **"What to look for"** — the signals heading
- **"Sources"** — the medical sources heading
- **"For your concerns"** — the Home and Explore section heading
- **"Matches your [concern name] concern"** — the product page context line

The UI does **not** use:

- "diagnosis" or "diagnose" (except in the disclaimer);
- "condition" or "disease" (except in condition-pattern names);
- "treatment" or "prescription";
- "recommend" or "recommended" (products are "reviewed as supportive," not
  recommended);
- "cure" or "heal";
- "AI" or "artificial intelligence"; or
- "assessment" or "evaluate."

### 15. Accessibility

- Concern content is semantic HTML with proper heading hierarchy.
- The "I'm dealing with this" button has `aria-pressed` reflecting saved
  state.
- The "See products" button has `aria-controls` pointing to the product
  results region.
- The concern content region has `aria-label="Concern information for
  [concern name]"`.
- Screen readers receive the full concern content including sources.
- Dynamic Type may wrap concern content without clipping.
- Colour is never the sole indicator of saved vs. unsaved state.
- The urgent action banner for condition-patterns has `role="alert"` and
  `aria-live="assertive"`.

### 16. Formatting and temporal integrity

- All dates use `CalendarDate` values where applicable.
- The `reviewedAt` timestamp from the knowledge library is displayed as
  "Reviewed [date]" in the concern content footer.
- Locale does not determine the concern matching — matching is against the
  English knowledge library content.
- These boundaries inherit ADR-0019 where it exists, and establish the
  precedent where it does not yet apply.

## Implementation sequence

### Slice 1: Pure concern matching

- Add `lib/customer/concern-matching.ts` with the `matchConcerns` function.
- Add golden test fixtures for name match, productTerm match, signal match,
  condition-pattern match, no match, empty search, and multi-concern match.
- No UI, store, or database changes.

### Slice 2: Consult content surface

- Add a `ConcernContent` component that renders the knowledge library's
  concern content.
- Modify `ConsultView` to call `matchConcerns` against the search input and
  render `ConcernContent` above product results when matches exist.
- Add the "I'm dealing with this" button (visual only — no persistence yet).
- Add the "See products" scroll button.
- Add CSS for the concern content section.
- Test: search "acne" shows concern content above product grid.

### Slice 3: Concern store and service

- Add migration `0038_customer_concerns.sql`.
- Add `lib/customer/concern-repository.ts`.
- Add `lib/customer/concern-policy.ts`.
- Add `lib/customer/concern-service.ts`.
- Add server actions for add/remove/clear.
- Add synthetic preview state (`useMeConcernState`).
- Wire the "I'm dealing with this" button to the service.
- Test: adding a concern persists to the database; removing sets `removed_at`;
  clearing sets `removed_at` on all active rows; synthetic mode uses preview
  state.

### Slice 4: Read model wiring

- Modify `readMeHome` and `readCustomerPortal` in `route-read-models.ts` to
  load concerns from the service.
- Map `CustomerConcernRecord` to `CustomerPortalConcernReference` via the
  knowledge library.
- Test: concerns populate in the view model; retired slugs are filtered;
  synthetic mode returns empty concerns from the service (preview state
  handles display).

### Slice 5: Home and Explore activation

- Add "For your concerns" section to `HomeView`.
- Add first-time user greeting to `HomeView`.
- Verify Explore's "My concern" filter and "For your concerns" section
  activate automatically.
- Test: Home shows concern-matched products; Explore filter populates;
  first-time user sees warm prompt.

### Slice 6: Product page and context sheet

- Add concern match indicator to the product page personal context line.
- Add concerns summary to the context sheet.
- Add "My concerns" section and "Clear concerns" action to the account sheet.
- Test: product page shows "Matches your [concern] concern"; context sheet
  shows concern count; account sheet clear works.

### Slice 7: Release evidence

- Run full finance, sync, snapshot, account, form, accessibility, export,
  migration, and architecture boards.
- Capture: Consult with concern content, Consult with condition-pattern
  escalation, Consult with no match, Home with concerns, Explore with
  concern filter, product page with concern match, account sheet with clear,
  first-time user experience, synthetic mode, dark/light theme.
- Verify migration `0038` applies cleanly and rollback evidence is captured.

## Verification requirements

### Pure concern matching

Tests must prove:

- name match returns the concern with `matchedTerms` containing the name;
- productTerm match returns the concern with the matched term;
- signal match returns the concern with the matched signal;
- condition-pattern match returns the pattern even with `productTerms: []`;
- no match returns an empty array;
- empty search returns an empty array;
- multi-word search matches across name, terms, and signals;
- ranking places name matches above productTerm matches above signal
  matches;
- matching is case-insensitive;
- matching is pure — no side effects, no clock, no network; and
- the function does not throw for malformed input.

### Consult surface

Tests must prove:

- searching a concern slug shows the concern content above products;
- searching a concern name shows the concern content above products;
- searching a product term shows the concern content above products;
- searching a condition-pattern shows escalation guidance and no products;
- searching with no concern match shows only product results;
- empty search shows saved concerns and a prompt;
- the "I'm dealing with this" button calls the concern service;
- the "See products" button scrolls to the product region;
- the disclaimer is always visible when concern content is shown;
- sources are rendered as links with correct hrefs; and
- the urgent action banner has `role="alert"`.

### Store and CRUD

Tests must prove:

- only `kind: 'concern'` slugs can be saved (condition-patterns rejected);
- unknown slugs are rejected;
- adding a concern persists a row with `removed_at` null;
- adding an already-saved concern returns `already_saved`;
- removing a concern sets `removed_at`;
- removing an already-removed concern returns `already_removed`;
- clearing sets `removed_at` on all active rows;
- listing returns only active concerns;
- synthetic identity returns unavailable/error;
- RLS is enforced — a query without `app.customer_subject` returns no rows;
- the runtime role cannot TRUNCATE, REFERENCES, or TRIGGER; and
- the migration applies and rolls back cleanly.

### Read model

Tests must prove:

- concerns populate in the view model from the service;
- retired knowledge-library slugs are filtered from the view model;
- synthetic mode returns empty concerns from the service;
- the preview state overrides the service result for synthetic mode; and
- concerns are available on Home, Explore, Consult, and Product routes.

### Home and Explore

Tests must prove:

- "For your concerns" shows products matching saved concerns not on shelf;
- "For your concerns" is hidden when no concerns are saved;
- "For your concerns" is hidden when all matching products are on shelf;
- first-time user greeting appears when shelf, routine, and concerns are all
  empty;
- Explore's "My concern" filter populates from saved concerns;
- Explore's "For your concerns" section activates; and
- filtering by concern shows only products with `supportedConcernSlugs`
  containing that slug.

### Product page

Tests must prove:

- "Matches your [concern] concern" appears when the product's
  `supportedConcernSlugs` intersects saved concerns;
- the indicator does not appear when there is no intersection;
- the indicator does not appear when the customer has no saved concerns; and
- the indicator is read-only and has no action.

### Account sheet

Tests must prove:

- "My concerns" section shows the correct count;
- "Clear concerns" has a confirmation dialog;
- confirming clear calls the service and refreshes;
- canceling clear does not call the service; and
- the section is hidden when no concerns are saved.

## Rejected alternatives

### Build the concern store first, then the content

Rejected. A concern picker with no content behind it is a form, not a
consultation. The user selects "acne" without knowing what it means, what
ingredients help, or when to escalate. The content gives the selection
meaning. Content first, persistence second.

### Use AI to generate concern answers

Rejected. The knowledge library is already reviewed, sourced, and
safety-checked. AI generation introduces risk without adding value. The
deterministic path — reviewed content matched to search — is safer, faster,
and works offline.

### Fetch live concern data from a provider

Rejected. The knowledge library is a reviewed code asset. Provider
integrations require source provenance, consent, freshness, institution
mapping, and their own ADR. The first release uses the reviewed library only.

### Save condition-patterns as concerns

Rejected. Condition-patterns (`kind: 'condition-pattern'`) are escalation
guidance, not everyday care concerns. They have `productTerms: []` and are
not eligible for product matching. Saving them as concerns would imply
product support that does not exist. They surface in Consult search results
with their escalation guidance but cannot be saved.

### Add concerns to the snapshot schema

Rejected for this release. Customer concerns are stored in PostgreSQL with
RLS, matching the Shelf and Routine pattern. They are not part of the
versioned finance snapshot. A future ADR may add them to the snapshot if
offline export requirements change.

### Generalize to all health concerns immediately

Rejected. The knowledge library covers skincare, scalp, and hair concerns.
Generalizing to other health domains (wellness, nutrition, fitness) requires
a broader content review pipeline and is out of scope for this decision.

### Require concern selection during onboarding

Rejected as a forced step. The Consult experience is the onboarding moment,
but it is not a forced wizard. A first-time user is prompted to search their
care concerns, but they can skip to Explore or Shelf if they prefer. The
warm greeting on Home points to Consult, but does not block.

## Consequences

### Benefits

- The knowledge library becomes visible to users — the reviewed, sourced,
  safety-checked content that was hidden behind the scenes is now the first
  thing a person sees when they search their care concerns.
- Consult becomes a real consultation, not a product search with a stethoscope.
- Concerns flow through every surface — Explore, Home, product page, context
  sheet, account sheet — making the portal feel like it understands the
  user's situation.
- The first-time experience is warm and directional instead of generic and
  empty.
- The concern store follows the proven Shelf and Routine persistence pattern,
  so the security, RLS, and governance boundaries are already established.
- The feature works offline (synthetic mode) and without AI or third-party
  providers.

### Costs

- A new database table and migration are required.
- The Consult view gains complexity — concern content, condition-pattern
  escalation, and save state.
- Every route read model gains a concern service call.
- The knowledge library's content quality is now user-visible — any
  inaccuracies or gaps become customer-facing issues.
- The `CustomerPortalViewModel` gains one more field (`concerns`), adding to
  the bridge debt. The bridge retirement is deferred but not forgotten.

## Final principle

> **A person types what they notice. The first thing they see is not a
> product — it is understanding.**

JeloCare Me shall show what it knows before it sells what it has.

The knowledge library is reviewed. The product bindings are governed. The
consultation is the moment they meet the person.
