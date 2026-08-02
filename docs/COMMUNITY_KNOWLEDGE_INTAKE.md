# Community knowledge intake

Route: `/contribute`

Public label: **Share skincare**. The internal feature name remains Community Knowledge Intake.

The intake collects anonymous, community-reported product, routine and retailer knowledge. It is a moderation input—not a publishing path.

## Experience

1. Choose product, routine or store.
2. Select every relevant purpose.
3. Search an existing product or add a new one.
4. Add the brand only when the product is new.
5. Choose or add the retailer.
6. Optionally add the Nigerian price and purchase date.
7. Add a short experience signal.
8. Review and submit.

Routine and store paths skip irrelevant questions. The page saves immediately on-device, then autosaves to Neon when available. The interface always shows the save state.

## Reusable selector

`components/ui/adaptive-selector.tsx` is the shared selection primitive. It supports:

- single or multiple values;
- suggested canonical options;
- search across labels, details and aliases;
- custom values;
- keyboard and touch input;
- an optional asynchronous provider;
- selected-value removal;
- concise screen-reader status.

Custom values are explicitly marked and never mutate canonical data.

This is a shared interaction primitive, not a universal replacement for every field in JeloCare. Use it where people choose from open or evolving vocabularies such as products, brands, retailers and concerns. Price, dates, free text and other constrained data keep controls suited to their data type. Domain-specific validation, ranking and data providers stay outside the visual primitive.

The eight purpose choices and their search aliases live in
`lib/community-intake/canonical-options.ts`. Acne, dark spots, oily skin, dry
skin and sensitive skin map explicitly to reviewed concern guides and use only
the canonical guide name as an alias. Normal skin is a profile; Hair and Body
are areas. Those three do not inherit concern aliases. Clinical signs and
symptoms are never search aliases, and a custom term keeps the contributor's
raw label for moderation.

AI may propose related terms later, but a person must confirm the suggestion and moderation must approve any canonical alias or clinical relationship. Search behavior never learns directly from an unreviewed submission.

## Persistence

API:

- `POST /api/contribute/drafts`
- `PUT /api/contribute/drafts/:id`
- `POST /api/contribute/drafts/:id/submit`

The edit capability lives in an HttpOnly cookie. Saves use a monotonically increasing revision. A repeated final submission returns the original contribution.

Migration `0015_community_knowledge_intake.sql` keeps drafts, immutable contributions, custom-value moderation, events and community-reported graph edges separate from JeloCare-reviewed records.

Migration `0017_community_first_research_queue.sql` makes the research priority durable. Every submitted product and retailer creates a private `community-first` task in the same transaction as the contribution. Existing retained, non-rejected submissions are backfilled. A custom product enters identity research; a product already in the public selector enters price-and-retailer refresh instead of creating a duplicate catalogue record. Repeated submissions add independent task mentions and increase the signal count without bypassing review.

Migration `0023_community_research_resolutions.sql` adds one reviewed terminal
resolution per product research task: existing canonical product, deliberate
intake candidate, ambiguous family, bundle, or dismissed duplicate. The row is
audit-attributed and permanently marked private-research-only with no canonical
write. `npm run community:research:resolve` is dry-run by default and records the
decision only with `--apply`; it never authors intake, dossiers, releases, offers,
images, or products. Later mentions retain the terminal resolution instead of
silently reopening the task.

Migration `0030_community_research_workflow.sql` adds durable ownership and a
specific next action to every active research task. `claim` records the active
operator and moves the work to `assigned`; `defer` records the operator, the
precise blocker, and `blocked`; `retry` is available only to the current owner
and records the next bounded attempt. Admins can assign or reassign work to a
chosen active operator, unassign it back to the shared queue, or take it over.
Every transition locks the task and records both the previous and new owner.
Terminal decisions clear the active assignment
but preserve the decision row and moderation history. The same migration adds
one private, audit-attributed terminal resolution per retailer research task.
Canonical retailer matches must name an existing retailer, and a task that was
created from a canonical reference can resolve only to that exact reference.
Neither the product nor retailer resolver writes products, retailers, offers,
prices, assets, or publication state.

Migration `0031_community_research_task_shape.sql` binds each task kind to its
one valid entity kind, source, and reference namespace. Canonical product and
retailer tasks accept only the exact existing record already named by the task;
custom identity tasks retain the wider reviewed outcome set. The same migration
adds explicit assign and unassign audit actions.

A later contribution may add a new independent mention and increase a task’s
signal count, but it never reopens the task or clears its owner, blocker, retry,
or terminal decision. Terminal resolutions are immutable; new evidence that
requires fresh work must enter a new attributable task rather than silently
rewriting the settled one.

## Metrics

The system can derive completion, time-to-complete, repeat contributions, unknown values, retailers and products discovered. Input events record step, mode and result count. They do not store search queries.

Run `npm run community:research:signals` in a server environment with a real database connection to produce the current retained, non-rejected research signals. Sensitive Vercel environment values are not available through a local environment pull; do not replace that boundary with a public reporting endpoint.

The report ranks product, retailer and purpose mentions, summarizes community-reported Nigerian price observations, exposes the `community-first` task order, and lists pending vocabulary for moderation. It also emits one private global research schedule: community tasks sort by independent signal count, then recency, before the checked-in static discovery queue. Exact canonical product slugs and a complete normalized brand/name/size identity deduplicate work across both sources. It does not expose contributor identity. Community tasks can reorder research, but they cannot verify authenticity, identity, price freshness, formula suitability, regulatory status, image rights or publication readiness. Repeated independent reports, photos and receipts can become stronger evidence only after the deferred quarantine and moderation systems exist.

Private decisions happen in `/ops` or through `npm run community:moderate`; there
is no public moderation endpoint. The command-line path requires an active
allowlisted operator, prints only aggregate data by default, dry-runs every mutation
unless `--apply` is present, requires a rationale, and appends the decision to the
same audit trail as the console.

Research dry-runs execute the same read-only ownership, task-shape, exact-target,
candidate-release, and existing-resolution preflight used immediately before an
applied transition. They can still become stale after the read; every applied
writer revalidates under its transaction and row lock.

`/ops/research` is the manual research control surface. It shows current
ownership and the next evidence action, supports attributable assignment,
reassignment, unassignment, or blocking, and records product or retailer
outcomes through the same resolvers as the private commands. Product and store
matches use reviewed canonical pickers rather than operator-authored identifiers:
canonical targets must already exist, deliberate product intake targets must be
present in the checked-in intake manifest and not already explicitly released,
and all outcomes remain private. A deliberate intake outcome is valid only for
a custom product-identity task; canonical refresh tasks resolve to their exact
existing record instead.

Rejected contributions retain their immutable record but cannot leave pending
edges, observations, or active research priority behind. Migration
`0021_community_moderation_integrity.sql` reconciles existing rows, and future
rejections cascade those moderation states and recalculate affected task signals in
one audited transaction. Research tasks with no active retained report are excluded
from the research queue, deep links, and queue totals, and cannot be assigned or
resolved. Queue reads exclude expired or rejected-parent material;
shared custom vocabulary is ordered by active retained mentions rather than its
historical counter.

Public contributor counts and trust labels must be derived from moderated, retained records—not drafted submissions or raw edge totals. Until the sample is meaningful, prefer a truthful qualitative invitation over a small vanity count. When counts are shown later, distinguish contributors, submissions and independently confirmed observations.

## Release boundary

Photos and receipts are not collected. They require private quarantine storage and a reviewed upload pipeline. Accounts, public stories, ratings, comments and alerts remain deferred under ADR 0001.
