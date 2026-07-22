# ADR 0002: Anonymous community knowledge intake

- **Status:** Accepted for a bounded first release
- **Date:** 2026-07-22
- **Scope:** `/contribute`, anonymous drafts, moderated submissions, private metrics
- **Supersedes:** ADR 0001 only where it deferred anonymous knowledge and missing-record intake

## Context

JeloCare needs a fast way to learn which products, routines, concerns, stores and prices people actually encounter in Nigeria. The founder has approved a narrow community intake that feels like one short conversation rather than a survey.

The existing catalogue, clinical graph and retail records are reviewed systems. Community input must help reviewers without entering those trusted records as fact.

## Decision

Ship `/contribute` as an account-free, mobile-first intake with one question at a time. One adaptive selector supports suggested values, live filtering, canonical selection, multiple selection and custom values. Product, routine and store journeys share that component and skip irrelevant questions.

The selector is a reusable interaction primitive for open or evolving vocabularies, not a mandate to replace every input across JeloCare. Domain adapters own their data providers, ranking, validation and moderation rules. Constrained values such as price and date retain purpose-built native controls. Any future AI mapping is a reviewable suggestion; it does not teach canonical search or create a clinical relationship automatically.

The system stores:

- mutable anonymous drafts with a 30-day expiry;
- immutable final contributions with a 24-month retention boundary;
- custom values in a moderation queue;
- contribution-scoped knowledge edges marked `community_reported` and `pending`;
- deduplicated interaction events that record modes and counts, never search text;
- no legal name, email, account, raw IP address or user-agent string.

A random edit secret is returned only as an HttpOnly, SameSite cookie. PostgreSQL stores its SHA-256 hash. Autosaves use optimistic revisions. Finalization is idempotent for one draft.

Network identifiers used for abuse limits are HMACed server-side and retained only by the short-lived Redis limiter. PostgreSQL does not store them.

## Trust boundary

Submissions never write directly to products, brands, retailers, offers, concerns, ingredients, aliases, recommendations or clinical relations. A contribution can become canonical only through a later, attributable moderation action and the existing evidence gates.

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

Unknown values enter `community_moderation_values`. Contributions and graph edges stay pending until an authenticated moderation system exists. Until then, review is operator-only through controlled database tooling.

Abandoned drafts are eligible for deletion after 30 days. `npm run community:intake:purge` performs the cleanup. Production requests use the existing Upstash Redis connection for rate limits.

## Consequences

JeloCare gains structured Nigerian market intelligence without weakening its reviewed catalogue or clinical boundaries. The first release deliberately favors safe text intake over a larger but unsafe upload surface.
