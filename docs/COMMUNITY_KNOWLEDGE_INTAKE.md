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

## Persistence

API:

- `POST /api/contribute/drafts`
- `PUT /api/contribute/drafts/:id`
- `POST /api/contribute/drafts/:id/submit`

The edit capability lives in an HttpOnly cookie. Saves use a monotonically increasing revision. A repeated final submission returns the original contribution.

Migration `0015_community_knowledge_intake.sql` keeps drafts, immutable contributions, custom-value moderation, events and community-reported graph edges separate from JeloCare-reviewed records.

## Metrics

The system can derive completion, time-to-complete, repeat contributions, unknown values, retailers and products discovered. Input events record step, mode and result count. They do not store search queries.

## Release boundary

Photos and receipts are not collected. They require private quarantine storage and a reviewed upload pipeline. Accounts, public stories, ratings, comments and alerts remain deferred under ADR 0001.
