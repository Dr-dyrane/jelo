# ADR 0001: Defer trust, collections, community, and stock alerts

- **Status:** Deferred option — partially superseded by ADR 0002 for anonymous knowledge intake only
- **Date:** 2026-07-22
- **Decision horizon:** After the current catalogue, retail-intelligence, Ask Jelo, and clinical-safety work is complete and demonstrably strong
- **Future reviewers:** Product, Product Design, Clinical Safety, Trust & Safety, Privacy, Retail Intelligence, Accessibility, and Engineering
- **Supersedes:** Nothing
- **Sprint effect:** None

This is the first ADR series found in the repository, so numbering starts at `0001`.

## Context

JeloCare could eventually become more useful after product discovery by helping people remember, organize, and reflect on their care. The opportunity includes:

- distinct trust context for a product and for each retailer or marketplace seller;
- visible community activity such as ratings, helpful reactions, and comments;
- a “Can’t find it?” request path for missing products;
- structured stories about the concern, duration, previous attempts, routine or formula, and what the person felt worked;
- optional accounts for saving formulas, routines, and collections;
- named collections such as cleansers, toners, treatments, moisturizers, and sunscreens;
- use and application reminders;
- story publishing and later updates;
- community discussion;
- retailer inventory tracking, low-stock alerts, and user-controlled early-buy reminders.

The current system already separates JeloCare-reviewed products from community-sourced catalogue records. It also records retailers, exact offers, inventory state, observation freshness, extraction evidence, marketplace seller evidence, and price history. Authentication is provisioned at the infrastructure level but is deliberately not part of the current public product surface.

These ideas introduce identity, potentially sensitive health-related data, user-generated content, moderation, notifications, and scarcity signals. Adding them casually would weaken the present work and could turn popularity into a misleading proxy for safety, efficacy, authenticity, or clinical suitability.

## Decision

Record the concept as a **deferred product option**. Do not implement, design into current screens, create migrations, add routes, add account prompts, add analytics events, or create current-sprint tickets from this ADR.

This ADR is not approval to build the platform. A future product discovery initiative must first satisfy the re-entry gates below. Any implementation requires a new ADR that chooses scope, vendors, data retention, moderation operations, and rollout controls.

### Re-entry gates

The option may return to planning only when all of the following are true:

1. Current catalogue provenance, image integrity, search, and product-page work is complete and stable.
2. Retail offer freshness and confidence are measured in production, not merely represented in the schema.
3. Ask Jelo safety, privacy, accessibility, and core interaction work is complete.
4. Clinical and trust reviewers approve the language boundaries for stories, comments, ratings, and reminders.
5. Product research shows a real user need beyond generic social engagement.
6. There is an owned moderation and support operating model, including abuse and safety escalation.
7. Privacy, security, threat-model, data-retention, and account-recovery reviews are complete.
8. A separate sprint is explicitly funded and scheduled.

## Non-goals

This ADR does not authorize:

- any change to the current sprint or unfinished plans;
- login gates for search, catalogue, product, concern, or Ask Jelo access;
- likes, comments, ratings, testimonials, collections, reminders, stories, or stock alerts in the current UI;
- treating a high rating or large reaction count as medical, product-quality, authenticity, or retailer-trust evidence;
- diagnoses, treatment plans, cure claims, guaranteed outcomes, or personalized medical dosing;
- a social feed optimized for attention, streaks, public follower counts, or engagement pressure;
- direct messages between members in an initial community release;
- public health profiles or public routines by default;
- urgency or scarcity messaging based on stale, inferred, or low-confidence stock data;
- retailer endorsement, authenticity guarantees, or preferred placement without explicit supporting evidence and disclosure;
- affiliate conversion taking priority over consumer usefulness or safety.

## Experience concept

The future experience should feel like a personal care library with optional community context, not a conventional social network.

1. A person searches for an exact product and sees separate product, provider, offer, and community signals.
2. They can request a missing product with a name, brand, barcode, product URL, or optional pack photo.
3. After choosing to create an account, they can save a product to a named collection or routine.
4. They can add a private application reminder without publishing their concern or routine.
5. They can keep a private, structured “what I tried” record and optionally turn a reviewed version into a public story.
6. Published stories can receive helpful reactions and moderated comments. Updates remain visibly connected to the original story and retain an edit history.
7. For an exact retailer offer, a person can opt into a freshness-qualified stock alert or a personal replenishment estimate.

Progressive disclosure should keep the catalogue calm. Saving, story details, comments, and alert setup should use focused sheets or modal views where appropriate instead of expanding nested page sections. Core product and price information remains available without an account.

## Trust model

“Trust” is not one score. The interface must keep these evidence classes separate:

| Entity | Signals that may be shown | Signals that must not be inferred |
| --- | --- | --- |
| Product record | JeloCare review status, source, barcode, ingredient-list completeness, last source update | Safety, efficacy, suitability, or authenticity from popularity |
| Retailer | Verified identity, canonical domain, operating history when sourced, policy links, support path | Authenticity guarantee from inclusion alone |
| Exact offer | Product match, market, seller, observed price, inventory evidence, checked time, expiry, extraction confidence | Current availability after evidence expires |
| Community | Rating distribution, sample size, recency, helpful reactions, moderated story context | Clinical evidence or a recommendation for another person |
| Commercial relationship | Affiliate, sponsored, gifted, or retailer-supplied status | Editorial independence unless it is actually preserved and disclosed |

### Ratings and reactions

- Likes, comments, and stars are community activity, not trust proof.
- Prefer “Helpful” to an ambiguous heart or like when the intent is usefulness.
- If ratings are introduced, separate product experience from retailer experience. Delivery, service, value, and product experience must not collapse into one score.
- Always show sample size and rating distribution. A lone average is insufficient.
- Label verified-purchase status only when JeloCare can prove the transaction linkage. An outbound click is not a verified purchase.
- Use anti-brigading, rate-limit, duplicate-account, and unusual-vote detection before public counts influence ranking.
- Do not reward positive ratings, suppress critical experiences, or mix sponsored stories into organic results without prominent disclosure.
- Community activity must never change clinical recommendation eligibility.

## Missing-product request and campaign

A future “Can’t find it?” path may collect product name, brand, barcode, retailer/product URL, market, and an optional photo. It should:

- accept a request without promising catalogue inclusion, review, availability, or a retailer relationship;
- explain what information helps identify the exact product;
- merge duplicates without exposing another requester’s identity;
- show a simple request state such as received, needs details, researching, added, or unable to verify;
- obtain explicit permission before reusing uploaded images or contacting the requester;
- scan uploads, remove embedded metadata where appropriate, and prohibit prescriptions, faces, receipts, addresses, and other unnecessary personal information;
- keep affiliate or retailer outreach separate from editorial review.

## Structured stories and testimonials

The preferred model is a structured experience record, not an unqualified testimonial quote.

Possible fields are:

- user-selected concern or observed pattern, explicitly not a diagnosis;
- where the product was used;
- duration and approximate start/end dates;
- products, routine steps, and formula versions tried;
- use frequency, optional and bounded;
- previous attempts and why they stopped;
- what changed, what did not, and unwanted effects;
- contextual factors the person chooses to share;
- whether the product was purchased, gifted, sponsored, or supplied by a retailer;
- update date and whether the experience is ongoing.

Every public story must say that it is one person’s experience, not clinical evidence or a promise of results. “Worked for me” must not become “works.” JeloCare must not rewrite stories into stronger efficacy claims.

### Clinical-claims boundaries

- Use “concern,” “observed pattern,” or the person’s own reported experience; do not validate a diagnosis.
- Do not calculate or display a success rate from testimonials.
- Do not permit cure, guaranteed-result, unsafe-use, prescription, dosage, or replace-professional-care claims.
- Before-and-after images are out of scope for the first public-story phase. A later proposal would need consent, image-integrity, lighting, manipulation, body-image, and claims review.
- Possible adverse events, dangerous mixing, rapid worsening, infection signs, or urgent symptoms require a safety review path and must not be handled as ordinary engagement content.
- Clinical escalation guidance must come from the safety system, not community voting or comments.
- Imported products that JeloCare has not reviewed remain ineligible for clinical matching regardless of story volume.
- A “formula” means either a user-created set of routine items or a versioned ingredient list with cited provenance. It must not imply that JeloCare verified an exact formulation when it did not.

## Collections, routines, and reminders

Accounts should be optional and introduced only after a person asks to save something. A collection can contain reviewed and community-sourced products, but their provenance labels remain visible.

Suggested collection patterns include:

- My cleansers
- My toners
- Treatments
- Moisturizers
- Sunscreens
- Hair and scalp
- Considering
- Finished
- Did not suit me

People may create custom names and order items. A routine can reference collection items but should separately model morning/evening, step order, frequency, pause state, and start date. Saving a product is not an endorsement or recommendation.

Reminders must remain practical rather than coercive. No streak loss, shame, medical adherence claim, or repeated pressure to buy.

## Retail inventory and replenishment rules

Stock messaging can create false urgency, so every alert must be tied to one exact offer and its evidence.

### Required evidence

A low-stock or back-in-stock alert may be generated only when all of these are true:

1. Product identity is an exact match, not a search result or fuzzy candidate.
2. Retailer, marketplace seller when applicable, market, and canonical product URL are known.
3. The observation is still inside its confidence-based verification window.
4. Product-scoped evidence supports the inventory state.
5. Extraction confidence meets a future calibrated threshold.
6. The user explicitly subscribed to that exact product/provider combination or an equally clear scope.

An explicit product quantity can support “low stock.” Generic page copy, a search page, community comments, popularity, a missing price, or an `unknown` inventory state cannot. Marketplace seller stock applies only to that seller, not to the marketplace or retailer generally.

When evidence expires, the UI changes to “Check retailer” and suppresses stock-triggered notifications. Every message includes the retailer, seller where relevant, observed state, check time, and a direct verification link. JeloCare must say that stock can change before purchase.

### Early-buy estimates

“Buy on time” is a personal replenishment estimate, not a stock fact. It may use a user-entered open date, container size, usage cadence, and optional remaining amount. The UI must show the estimate basis, allow correction, and never manufacture urgency to increase affiliate conversion.

## Notification consent

- Email, push, SMS, and in-app alerts are separately opt-in; none is enabled by account creation.
- Ask for a channel only after the user creates a reminder or alert and understands its value.
- Scope consent per reminder, collection, exact offer, or clearly described alert group.
- Let users set timezone, quiet hours, day preferences, batching, and frequency caps.
- Default lock-screen and email-subject copy must not reveal a concern, diagnosis-like term, routine, or other sensitive context.
- Every notification has a direct pause or unsubscribe path; global preferences remain easy to reach.
- Duplicate observations must not create duplicate alerts. Re-alerting requires a meaningful state change and a cooldown.
- Delivery failures, expired device tokens, and revoked consent must stop sends promptly.
- Marketing consent is separate from care reminders and inventory alerts.
- Reminders must work with screen readers and must not depend on sound, vibration, or color alone.

## Trust, safety, and moderation guardrails

Before any public story or comment capability:

- define community rules, prohibited claims, enforcement levels, appeal paths, and moderator audit logs;
- combine automated triage with trained human review for health claims, harassment, self-harm, dangerous use, adverse events, and commercial manipulation;
- provide report, block, mute, edit, withdraw, and delete controls;
- rate-limit submissions and protect against spam, astroturfing, affiliate stuffing, impersonation, and coordinated rating attacks;
- prohibit direct messages in the first release;
- label moderators, retailer representatives, clinicians, employees, affiliates, gifted products, and sponsored content accurately;
- give retailers a controlled correction or response channel without allowing them to delete legitimate criticism;
- separate safety escalation from ordinary content moderation;
- publish moderation response expectations only after staffing can meet them;
- preserve evidence needed for appeals while respecting retention and deletion rules.

Public rankings must not be driven by raw engagement alone. Safety, provenance, freshness, and relevance remain hard constraints before any community signal is considered.

## Privacy and security guardrails

Concern history, routines, reminders, photos, and stories may reveal sensitive health or behavioral information. The default must be private and data-minimal.

- Public browsing remains account-free.
- Explain why each sensitive field is requested; make optional fields genuinely optional.
- Separate private journal data, public story data, account identity, notification endpoints, and analytics.
- Offer field-level preview and visibility before publication. Never publish a private record through a default toggle.
- Prefer pseudonyms and broad age ranges; do not request legal names, exact birth dates, or precise location unless strictly necessary.
- Do not use private concerns, routines, or reminders for advertising or retailer targeting.
- Provide account export, story withdrawal, account deletion, consent history, and understandable retention periods.
- Define deletion behavior for copies, comments, moderation evidence, backups, and aggregate metrics before launch.
- Encrypt sensitive data in transit and at rest, use least-privilege access, keep auditable administrative access, and protect account recovery from takeover.
- Establish age policy and enhanced protections before allowing minors to publish.
- Complete target-market privacy and consumer-protection review before collecting or publishing this data.

## Conceptual data model

This sketch describes boundaries, not a migration contract:

```text
account
  -> profile_preferences
  -> consent_record
  -> notification_endpoint
  -> notification_preference

account
  -> collection
       -> collection_item -> reviewed_product | community_sourced_product
  -> routine
       -> routine_step -> collection_item | catalogue_item
  -> reminder -> routine_step | collection_item

account
  -> experience_record (private by default)
       -> experience_product
       -> experience_update
       -> optional public_story_version
            -> comment
            -> helpful_reaction
            -> moderation_case

account | anonymous requester
  -> missing_product_request
       -> identity_evidence
       -> request_status_history

account
  -> inventory_subscription -> exact offer
       -> stock_observation (existing offer evidence/history)
       -> notification_delivery
```

Important model rules:

- An item reference preserves whether it points to a JeloCare-reviewed product or a community-sourced record.
- Public story versions are immutable snapshots; later edits create a visible update or revised version.
- Private experience records and public story content are separate objects so withdrawal and visibility are explicit.
- Comments attach to a specific published story version or update.
- Ratings require dimensions, disclosure, moderation state, and provenance; they are not stored as a naked average.
- Inventory subscriptions reference the existing exact `offer`, including seller identity where relevant.
- Notification consent and delivery history are independent from marketing preferences.
- Deletion, anonymization, and retention states are represented, not inferred from absence.

## Required dependencies

No phase starts until its dependencies are owned:

- production-ready optional authentication, recovery, session security, abuse prevention, and account deletion;
- privacy impact assessment, threat model, retention schedule, and consent model;
- versioned reviewed/community catalogue identity that survives product merges and removals;
- moderation policy, tooling, queue, staffing, escalation, appeals, and auditability;
- commercial disclosure and conflict-of-interest rules;
- notification provider, consent ledger, quiet-hours scheduler, retry and deduplication controls;
- measured offer-refresh precision, freshness, seller identity, and source reliability;
- accessible interaction patterns for rating, commenting, collection editing, and scheduling;
- analytics that measure trust and utility without exposing sensitive concern data;
- support runbooks for account access, harmful content, product requests, retailer corrections, and bad stock alerts.

## Possible future phases

All phases remain deferred and require separate approval.

### Phase 0 — Discovery and governance

Interview catalogue users, test private collection prototypes, define evidence labels, validate moderation demand, calibrate inventory confidence, and complete privacy/clinical/legal reviews. Ship nothing publicly.

### Phase 1 — Private saves and collections

Offer optional accounts at the moment of saving. Add private named collections, provenance-preserving product references, export, and deletion. No public profiles, ratings, or comments.

### Phase 2 — Private routines and reminders

Add routine steps, pause controls, quiet hours, discreet notification copy, and easy opt-out. Validate reminder utility without streaks or pressure.

### Phase 3 — Missing-product requests

Launch a moderated request path with deduplication, status tracking, upload safety, and no inclusion promise. Use demand signals for research prioritization, not automatic publishing.

### Phase 4 — Structured experience records

Start private. Introduce optional public story snapshots only after claims, consent, moderation, disclosure, versioning, and withdrawal are proven.

### Phase 5 — Carefully scoped community

Test helpful reactions and moderated comments before ratings. Avoid follower mechanics and direct messages. Add rating dimensions only if research shows they improve decisions and cannot be mistaken for clinical evidence.

### Phase 6 — Evidence-qualified inventory alerts

Pilot exact-offer alerts with the most reliable retailers and strict freshness suppression. Add personal replenishment estimates separately from retailer stock. Expand only after false-alert and missed-alert rates are acceptable.

## Accessibility requirements

- Meet WCAG 2.2 AA as a release floor, including keyboard operation, 200% zoom, 320 px reflow, visible focus, target size, and contrast.
- Express star values as text such as “4 out of 5” with a labelled radio group for input; never rely on star shape, fill, or color alone.
- Announce submission, moderation, saving, and scheduling results concisely without noisy live regions.
- Keep comments and stories in semantic reading order; do not use an inaccessible infinite feed.
- Give every sheet and modal a name, focus containment, Escape behavior, close control, and focus restoration.
- Make reminder date, time, timezone, recurrence, pause, and error states understandable without gestures.
- Provide text equivalents for charts, rating distributions, stock status, and trend direction.
- Require meaningful alternative text or an explicit decorative state for permitted community images.
- Honor reduced motion, reduced transparency, text spacing, and device accessibility notification settings.

## Success criteria and stop conditions

Before a future build, owners must set numerical targets and stop thresholds. At minimum, evaluation must cover:

- whether collections reduce repeat search and help people find saved products;
- whether users correctly distinguish reviewed products, community records, retailer evidence, and community opinion;
- whether people understand that stories are anecdotal and that stock is time-bound;
- missing-product identification accuracy and duplicate-request rate;
- reminder usefulness, opt-out rate, notification complaint rate, and sensitive-copy incidents;
- public-story harmful-claim exposure, moderation turnaround, appeal overturn rate, harassment, spam, and commercial manipulation;
- rating sample integrity and verified-purchase accuracy if ratings are ever introduced;
- stock-alert precision, stale-alert suppression, false scarcity, seller mismatch, and direct-link validity;
- account recovery success, deletion completion, unauthorized access, and privacy incidents;
- keyboard, screen-reader, zoom, reflow, and notification accessibility completion.

Stop or roll back a phase if it creates misleading clinical confidence, false scarcity, unmanageable moderation queues, sensitive-data exposure, manipulative engagement, inaccessible core actions, or retailer/community signals that users consistently misread as endorsement.

## Open questions

1. Do users need public community features, or do private collections and journals solve most of the problem?
2. Which identity provider and recovery model meet the privacy and operational requirements?
3. What is the minimum information needed to save a collection without building a sensitive profile?
4. Should “formula” refer only to a user’s routine grouping, or also to versioned sourced ingredient lists?
5. Can JeloCare prove purchases well enough to use “verified purchase,” especially after outbound retailer navigation?
6. Are stars useful, or would structured experience tags and rating distributions be clearer?
7. Which story fields should be public, private, moderator-only, or prohibited?
8. How are adverse-event reports separated from testimonials and escalated responsibly?
9. What moderation coverage, languages, response times, and appeals capacity are required for Nigerian users?
10. How should brands and retailers disclose affiliation and exercise a right of response without influencing editorial review?
11. Which retailers permit reliable inventory observation, and what evidence threshold is acceptable for each adapter?
12. What false-positive rate is acceptable before a “low stock” label or notification is allowed?
13. Should replenishment estimates remain entirely on-device to reduce sensitive behavioral data?
14. Which notification channels are justified, and what frequency caps protect users from pressure?
15. What age floor and guardian controls are needed for public participation?
16. How should public comments and stories behave after the author deletes an account?
17. What ranking, sponsorship, affiliate, and conflict disclosures are needed before community signals affect discovery?

## Consequences

The opportunity is preserved with enough structure for later product discovery, while the current sprint remains focused. The cost is deliberate postponement: JeloCare will not yet offer accounts, collections, community, stories, or alerts. That is preferable to introducing weak trust signals, unmanaged health claims, false scarcity, or sensitive-data collection before the core information system is ready.

The next action on this ADR is **none**. Revisit it only through an explicitly scheduled future discovery initiative and a new accepting or superseding ADR.

## Future governance references

Any re-entry review must include current legal advice. Starting official references are the [Nigeria Data Protection Act 2023](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf) and [NAFDAC Cosmetics Advertisement Regulations](https://www.nafdac.gov.ng/wp-content/uploads/Files/Resources/Regulations/COSMETIC_REGULATIONS/Cosmetics-Advertisement-Regulations-2018.-edited.pdf). Their inclusion here is a review prompt, not a legal conclusion.
