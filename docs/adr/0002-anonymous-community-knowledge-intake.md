# ADR 0002: Anonymous community knowledge intake

- **Status:** Accepted for a bounded first release
- **Date:** 2026-07-22
- **Scope:** `/contribute`, anonymous drafts, contextual domain modes, moderated submissions, private metrics
- **Supersedes:** ADR 0001 only where it deferred anonymous knowledge and missing-record intake

## Context

JeloCare needs a fast way to learn which products, routines, concerns, stores and prices people actually encounter in Nigeria. The founder has approved a narrow community intake that feels like one short conversation rather than a survey.

The existing catalogue, clinical graph and retail records are reviewed systems. Community input must help reviewers without entering those trusted records as fact.

New discovery surfaces may need more specific reports. For example, the
product-to-place Market Finder in [ADR 0019](0019-product-to-place-market-finder.md)
needs fixed outcomes about one exact product and one physical shop. That need
does not justify a second anonymous intake, a second edit capability, or a
parallel moderation queue.

## Decision

Ship `/contribute` as an account-free, mobile-first intake with one question at a time. One adaptive selector supports suggested values, live filtering, canonical selection, multiple selection and custom values. Product, routine and store journeys share that component and skip irrelevant questions.

The selector is a reusable interaction primitive for open or evolving vocabularies, not a mandate to replace every input across JeloCare. Domain adapters own their data providers, ranking, validation and moderation rules. Constrained values such as price and date retain purpose-built native controls. Any future AI mapping is a reviewable suggestion; it does not teach canonical search or create a clinical relationship automatically.

Contextual domain reporting also belongs to `/contribute`. A calling surface
may supply a bounded, server-resolved context and a fixed outcome vocabulary,
but it must reuse the same anonymous draft lifecycle, HttpOnly edit capability,
same-site and abuse controls, optimistic revision checks, idempotent final
submission, immutable contribution, and retention policy. Query parameters are
navigation hints only; the server must resolve the exact permitted entities and
fail closed when context is missing, repeated, ambiguous, retired, or outside
the active domain boundary.

The system stores:

- mutable anonymous drafts with a 30-day expiry;
- immutable final contributions with a 24-month retention boundary;
- custom values in a moderation queue;
- contribution-scoped knowledge edges marked `community_reported` and `pending`;
- optional typed domain projections, each keyed one-to-one to its immutable
  parent contribution and accepted only through a separately reviewed
  migration;
- deduplicated interaction events that record modes and counts, never search text;
- one separate first-touch campaign record with bounded source, medium,
  campaign, creative label, and landing path;
- no legal name, email, account, raw IP address or user-agent string.

A random edit secret is returned only as an HttpOnly, SameSite cookie. PostgreSQL stores its SHA-256 hash. Autosaves use optimistic revisions. Finalization is idempotent for one draft.

Network identifiers used for abuse limits are HMACed server-side and retained only by the short-lived Redis limiter. PostgreSQL does not store them.

Campaign attribution is analytics, not contribution evidence. It is stored
outside the immutable contribution payload and never enters moderation,
recommendations, ranking, clinical logic, or retailer targeting. JeloCare does
not retain the full referrer, query string, `utm_term`, click IDs, or a
person/session identifier. Existing submissions without a first-touch row stay
`unknown`; they are never backfilled as direct traffic.

## Trust boundary

Submissions never write directly to products, brands, retailers, offers, concerns, ingredients, aliases, recommendations or clinical relations. A contribution can become canonical only through a later, attributable moderation action and the existing evidence gates.

A contextual Market Finder report likewise cannot change a physical market,
place, retailer location, direction, channel, stock state, price, or public
result. Its future `market_finder_reports` row is a typed moderation projection
of one `community_contributions` row, not a canonical physical observation and
not a second public intake. Approval of the parent contribution does not
silently approve that child claim; physical publication requires a separate,
attributable evidence decision under ADR 0019.

“Love it” and “Helped” describe one person’s experience. They are not clinical evidence, a safety claim, a rating or a recommendation.

## Media boundary

The first release does not accept photos or receipts. JeloCare’s current Blob store is public and is reserved for reviewed production media. Anonymous uploads require a separate private quarantine store, decode/re-encode processing, metadata stripping, malware controls, deletion, retention and a moderator surface. Receipts remain out of scope because they can expose names, addresses, payment details and order identifiers.

## What remains deferred

ADR 0001 still governs accounts, collections, public stories, ratings, comments, likes, reminders, notifications, stock alerts and public community profiles. This release does not create `/library`; that route waits for a reviewed public library experience.

## Accessibility and experience

- WCAG 2.2 AA is the release floor.
- The selector exposes combobox/listbox state, keyboard navigation and a polite result count.
- Controls meet the 44-pixel target floor.
- Progress and save state are visible and announced.
- Copy is concise; surfaces use the existing peach, pink, cream and ink tokens without decorative borders.
- Mobile actions are sticky, not fixed, so the keyboard can move them naturally.

## Operations

Unknown values enter `community_moderation_values`. Contributions, graph edges,
and observations stay pending until reviewed through the authenticated system
decided in [ADR 0007](0007-internal-moderation-operations-console.md).
`/ops/contributions` remains the parent review surface for every contribution,
including a future Market Finder projection; a domain-specific child decision
must remain distinct and attributable. There is no public moderation endpoint.

Abandoned drafts are eligible for deletion after 30 days. `npm run community:intake:purge` performs the cleanup. Production requests use the existing Upstash Redis connection for rate limits.

## Consequences

JeloCare gains structured Nigerian market intelligence without weakening its reviewed catalogue or clinical boundaries. The first release deliberately favors safe text intake over a larger but unsafe upload surface.
