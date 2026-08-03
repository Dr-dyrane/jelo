# ADR 0012: Reopen a private member Shelf and Routine portal

- **Status:** Accepted; architecture only, implementation not started
- **Date:** 2026-08-02
- **Scope:** Optional consumer identity, private Shelf v1, and a gated private Routine v1 follow-up
- **Supersedes:** [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) only for the approved private portal phases
- **Preserves:** ADR 0001's deferral of reminders, notification delivery, stock alerts, public stories, ratings, comments, reactions, profiles, and community features

## Outcome

JeloCare will reopen the consumer portal as a private, data-minimal utility. Phase 1 is **Shelf v1**: a person may choose to create an account when they try to save an exact public catalogue product, then privately retrieve, organize, export, or remove those saved references. Phase 2 is **Routine v1**: after Shelf v1 meets its release gates, a member may create and order their own private routine from exact product references.

This decision accepts the architecture and delivery sequence. It does not create routes, tables, migrations, account prompts, analytics, or implementation work in this documentation task.

The narrower scope is the reason the private phases can reopen without declaring ADR 0001's community and notification gates complete. Shelf and Routine v1 collect no public user-generated content, send no notifications, and do not turn member activity into clinical, catalogue, retailer, or ranking authority.

## Trust boundary

- Public search, catalogue, product, concern, and Ask Jelo journeys remain account-free.
- Authentication is offered only after an explicit private action such as **Save to Shelf**, or from a member-owned portal entry point. It is never a gate in front of public evidence.
- A saved product is a personal reference, not an endorsement, recommendation, safety decision, verified purchase, popularity signal, or current-availability claim.
- Shelf and routine contents remain private and non-shareable. There is no public profile, public URL, follower graph, reaction count, or discovery ranking.
- Member activity never changes clinical eligibility, catalogue review state, offer ranking, moderation priority, retailer status, or Ask Jelo output.
- Health-shaped member data is never joined to commerce events, retailer targeting, advertising, or the anonymous contribution lane.

## Consumer identity is not operator authorization

The portal may reuse the provisioned Neon Managed Better Auth identity provider and its stable subject. Reuse ends at identity verification.

1. A consumer becomes a member only through an app-owned `member_account` record keyed to the verified provider subject. The member guard checks that record and its lifecycle state.
2. Operator authorization remains the separate, deny-by-default `moderation_operators` allowlist decided in [ADR 0007](0007-internal-moderation-operations-console.md). Member enrollment must never create, activate, infer, or query an operator role.
3. The operator guard must never treat `member_account` as authorization. The member guard must never treat `moderation_operators` as membership or grant portal access from an operator role.
4. If one person has both relationships, every request still passes the guard for the surface being used. No role is copied between the two domains, and the member interface does not expose operator state.
5. Consumer sign-in, recovery, sign-out, session labels, redirects, rate limits, and audit events are member-owned flows. They must not modify the current operator sign-in or invitation lifecycle.
6. Consumer account deletion revokes member sessions and the member mapping. It does not mutate operator access; operator offboarding remains an independently authorized, audited action, and vice versa. If the provider cannot isolate member and operator sessions for the same subject, implementation must use a separate tenant or credential namespace before consumer enrollment.

The implementation may share a provider adapter, cryptographic primitives, and infrastructure. It must use separate application authorization services, route guards, audit purposes, and tests proving that consumer identity cannot cross into `/ops`.

## Portal v1 surface contract

The future route family is bounded as follows:

| Surface | Phase | Contract |
| --- | --- | --- |
| `/member/sign-in` and `/member/recover` | 1 | Member-specific identity entry and recovery; no operator redirect or role management |
| `/shelf` | 1 | Private exact-product references for the signed-in member |
| `/account/privacy` | 1 | Consent history, export, account deletion, and session controls |
| `/routines` | 2 | Member-authored private routines after the Phase 2 gate |

The corresponding server boundary uses member-scoped services for `shelf`, `routine`, `export`, and `deletion`. Every object lookup is constrained by the authenticated member identifier at the data boundary; accepting an object ID and checking ownership only in the client is prohibited. Mutations use same-site checks, bounded schemas, idempotency where retries can duplicate state, and production-fail-closed abuse limits consistent with [APIs and security](../architecture/APIS_AND_SECURITY.md).

These names are an implementation contract, not a claim that the routes exist today. When implemented, the route catalogue and security document must be updated in the same change.

## Data classes and separation

No general-purpose profile or activity blob may combine these classes.

| Data class | Contents | Separation rule |
| --- | --- | --- |
| Account | Provider subject mapping, member state, verified email reference, locale, and lifecycle timestamps | Separate from operator roles, shelf content, consent evidence, notification endpoints, community content, and analytics |
| Private shelf | Member-owned shelf and exact-product reference, personal state, order, and timestamps | Private by default; no public projection, ranking input, retailer targeting, or free-text health journal in v1 |
| Private routine | Member-created routine, period, ordered steps, cadence, pause/archive state, and exact-product references | Separate table and authorization policy from Shelf; not a prescription, recommendation, or reminder schedule |
| Consent | Purpose, policy version, affirmative action, time, status, withdrawal, and source surface | Append-only evidence; no copied shelf or routine contents; marketing and future notification choices remain separate purposes |
| Notification endpoint | Email, push, SMS, or device delivery address and channel state | Reserved but not collected in Shelf or Routine v1; any future collection requires a separate accepted reminder/notification decision |
| Public story/community | Public story versions, comments, reactions, moderation state, and publication consent | Not created or derived by these phases; must live outside private Shelf/Routine storage and requires a separate accepted community decision |

Private member tables must not be readable from public catalogue projections, anonymous contribution queries, commerce analytics, or the operations moderation queues. Administrative access uses the controlled boundary below, never a broad database-editor entitlement.

### Conceptual member model

This is a build contract, not a migration in this task:

```text
verified_identity_subject
  -> member_account
       -> member_consent_event
       -> member_shelf
            -> member_shelf_item -> immutable catalogue identity reference
       -> member_routine
            -> member_routine_step -> immutable catalogue identity reference
       -> member_export_job
       -> member_deletion_job

reserved for a future accepted decision only:
member_account -> notification_endpoint
member_account -> public_story/community identity
```

Every member-owned row carries an opaque member identifier, lifecycle timestamps, and an authorization policy. Email addresses and provider subjects are not copied into Shelf or Routine rows. Private product graphs are not emitted into request logs, error traces, cache keys, URLs, or client analytics.

## Exact-product references and provenance

Shelf and Routine v1 may reference only a catalogue identity that is safe for the public catalogue projection. Private candidates, moderation records, discovery leads, and anonymous drafts are ineligible.

Each saved reference records:

- an immutable catalogue identity/version identifier, not only a mutable slug;
- the exact brand, variant, measured size, and package/formula version known at save time;
- the source class at save time: `jelocare_reviewed` or `community_sourced_public`;
- the current canonical resolution, when one exists; and
- timestamps for the save and the last member-confirmed replacement.

Lifecycle behavior is explicit:

- **Merge:** a merge creates an alias from the saved identity to the current canonical identity. It does not erase the original identifier or provenance. The member sees that the listing changed and may keep or remove it.
- **Retirement:** retirement leaves a non-purchasable tombstone sufficient to render the saved identity and reason category. The shelf item does not disappear through a catalogue cascade.
- **Reformulation or package change:** a materially different formula, size, or package version is a new identity version. JeloCare may show a reviewed successor, but never silently replaces a Shelf item or Routine step. Replacement requires an explicit member action.
- **Reviewed/community provenance:** a community-sourced reference never becomes historically “JeloCare reviewed” because it is merged or promoted later. The UI may show its current linked reviewed record while retaining the original source class and transition.
- **Clinical and retail evidence:** current care eligibility, evidence labels, price, retailer, and availability are resolved at view time from their governed sources. They are not frozen as member-authored truth and are not inferred from the save.

The catalogue/data owner must provide the immutable identity, alias, successor, and tombstone resolver before Shelf implementation can begin. A slug-only foreign key or destructive cascade fails this contract.

## Phase 1: private Shelf v1

Shelf v1 is deliberately smaller than general collections.

A member can:

- save one eligible exact product from its public product surface;
- view a single private Shelf;
- set one bounded personal state: `considering`, `using`, `paused`, `finished`, or `did_not_suit`;
- reorder, remove, and restore an item during the current session;
- see reviewed/community provenance plus merge, retirement, and reformulation state;
- sign out, recover access, export their data, and request account deletion.

The uniqueness boundary is one active row per member and immutable catalogue identity version. Shelf v1 has no free-text notes, photos, concern history, dates of use, dosage, star rating, retailer attribution, purchase proof, multiple named collections, sharing, or collaboration. Removing an item removes only the member reference; it never mutates the public catalogue.

## Phase 2: user-created Routine v1

Routine v1 is accepted as the follow-up phase, but its implementation starts only after Shelf v1 has operated at full release for 28 consecutive days with no stop condition and the launch scorecard contains at least 100 activated members. If 100 activated members are not reached, the phase stays gated rather than treating low adoption as proof.

A member can create, rename, reorder, pause, archive, and delete a private routine. Each routine contains:

- a member-authored name of at most 80 characters;
- a bounded period (`morning`, `evening`, or `anytime`);
- ordered steps that reference eligible exact product versions;
- a bounded cadence (`daily`, selected weekdays, or `as_needed`); and
- no delivery endpoint or scheduled send.

The routine is a record of the member's organization, not JeloCare-authored care. JeloCare does not generate, optimize, diagnose from, or certify it. Existing deterministic safety information may be displayed when relevant, but a warning never silently edits the member's routine. There are no adherence scores, streaks, pressure, dosage instructions, or outcome claims.

Before Phase 2 release, at least 15 representative usability participants must complete create, reorder, pause, and delete tasks; at least 80% must complete every core task without moderator assistance, and zero participants may interpret the result as a prescription or JeloCare recommendation. Failure sends the experience back to design and language review.

## Consent, recovery, retention, export, and deletion

This ADR sets product ceilings. A target-market privacy review must map each purpose to an appropriate legal basis and approve the schedule before a migration or production collection. That review may shorten a period; extending one requires a new documented decision.

### Consent and purpose limitation

- Account creation presents the current privacy notice and records its version and affirmative action. Optional measurement, marketing, and any future notification channel are separate choices; none is bundled into account creation.
- Consent withdrawal is append-only and effective immediately for the affected optional purpose. A later opt-in creates a new event rather than rewriting history.
- Shelf and Routine data is used only to provide the private portal, member-requested export/deletion, security, and approved aggregate service measurement.
- Private contents are prohibited from advertising, retailer targeting, commercial ranking, catalogue promotion, community research, clinical training, or model training.

### Recovery and sessions

- Recovery uses the verified identity provider flow; JeloCare stores no password or plaintext recovery token.
- One-time recovery material expires within 15 minutes, is single-use, and is rate-limited by both account and HMAC-derived network scope without revealing whether an email is registered.
- Sensitive actions—export, deletion, email change, and session revocation—require authentication no older than 15 minutes.
- Members can list and revoke their active member sessions. Recovery revokes earlier member sessions. Neither action changes operator sessions or roles.

### Retention schedule

| Record | Maximum active or post-close retention |
| --- | --- |
| Active account, Shelf, and Routine | While the account is active; user-deleted items leave active reads immediately and are purged from primary storage within 30 days |
| Closed account identifiers and private content | Account locks and sessions revoke on request; primary-store deletion completes within 30 days of the original request, including a clearly disclosed 7-day cancellation window |
| Consent evidence | Purpose, policy version, action, and time only; 24 months after account closure |
| Recovery and security audit metadata | 90 days; no token, message body, Shelf, or Routine contents |
| Member administrative-access audit | 24 months after the access event; target identifier, actor, purpose, decision, and time, without copied private content |
| Generated export | Encrypted, single-member artifact; expires and is deleted within 24 hours |
| Raw product-utility analytics | At most 30 days, pseudonymous, no product identity, concern, query, email, provider subject, network address, or routine composition |
| Thresholded aggregate metrics | At most 13 months; no member identifier and no cell representing fewer than 20 members |
| Notification endpoints and public community records | Not collected by these phases; retention must be decided before their separately gated implementation |

Application caches must not contain member-private responses. Structured logs contain route, outcome, latency, and opaque request correlation only—never email, provider subject, product identity, Shelf, Routine, consent payload, or export bytes.

Encrypted replicas follow primary deletion within 24 hours. Encrypted rolling backups expire within 35 days. Any restore must replay the deletion ledger before serving member traffic, so a deleted account cannot reappear. A case-specific legal hold must be documented, access-restricted, excluded from application reads, and reported in the deletion result; there is no blanket retention exception.

### Export and deletion behavior

- Self-service export is machine-readable JSON containing the account record, consent history, Shelf, routines when present, immutable/current product references and provenance transitions, and member administrative-access events.
- Export generation completes within 24 hours for at least 99% of requests. The download is encrypted in storage, single-use where practical, and expires within 24 hours.
- A deletion request immediately disables new member writes, revokes member sessions, and starts the disclosed 7-day cancellation window. Completion removes identity mappings, private content, raw member-linked measurement, notification endpoints if a future decision has created them, and the provider-side consumer credential within 30 days of the request. If the same provider subject has an independently authorized operator relationship, the provider identity may remain solely for that relationship; the deletion receipt must disclose the exception and member authorization/data remains deleted.
- Completion returns a receipt describing deleted classes, separately retained consent/security evidence, backup expiry, irreversible aggregate metrics, and any specific legal hold. Aggregates are not re-identified or recomputed to remove one member.
- Deletion never removes public catalogue records, anonymous submissions not linked to the member, another person's content, or operator authorization belonging to the same provider subject.

## Administrative access

Routine support must not require reading Shelf or Routine contents.

- The `member_support`, `privacy_admin`, and `security_admin` capabilities below live in a member-data administration registry separate from `moderation_operators`.
- `member_support` may see account status, verification state, job status, and timestamps, but not product references or routine composition.
- `privacy_admin` may execute or reconcile export/deletion jobs without browsing private content.
- `security_admin` may use a case-scoped content-reveal path only for a documented incident, with a reason, a ticket, privacy approval, and access expiring within 60 minutes.
- Every administrative read or action is attributable and append-only audited. Bulk export, unrestricted SQL browsing, shared accounts, self-granted roles, and use of `/ops` moderation permission as member-data permission are prohibited.
- The member export includes the time, purpose, and outcome of administrative access concerning their account, without exposing another person's contact details. Production alerts fire on expired access, access without a ticket, repeated denied reads, and bulk patterns.

The data-administration owner defines the minimal control surface and runbooks before launch. ADR 0007's operator console and authorization behavior remain unchanged.

## MVP exclusions

Neither accepted phase includes:

- mandatory accounts for any public journey;
- public profiles, public shelves, public routines, sharing links, search indexing, or social graphs;
- public stories, testimonials, ratings, comments, helpful reactions, moderation queues, or community publishing;
- reminders, notification endpoints, email/push/SMS delivery, replenishment estimates, stock alerts, or scarcity messaging;
- multiple named collections, free-text journals, concern history, photos, before/after media, purchase verification, or retailer notes;
- JeloCare-generated routines, diagnoses, treatment plans, product efficacy claims, dosage, adherence scores, streaks, or personalized clinical recommendations;
- direct messages, advertising audiences, affiliate personalization, or private-data model training;
- minors. The first release is for people who affirm they are at least 18; a different age policy requires a new privacy and safety decision;
- any change to operator sign-in, operator roles, `/ops`, catalogue publication gates, or current product data.

## Security, abuse, and observability gates

Before the first member account is enabled in production:

1. A reviewed privacy impact assessment, data-flow map, threat model, retention schedule, processor list, and incident/erasure runbook are complete.
2. Authorization tests prove cross-account reads and writes fail at the server and data layers; consumer enrollment cannot authorize `/ops`; operator state cannot bypass member ownership; and deleted, disabled, or unverified accounts fail closed.
3. Abuse tests cover account enumeration, OTP flooding, credential/session fixation, CSRF, IDOR, replayed mutations, export scraping, deletion cancellation, rate-limit outage, and malicious product/object identifiers.
4. No critical or high security finding is open. Medium findings have an owner, mitigation, and dated follow-up before rollout can advance.
5. WCAG 2.2 AA is the release floor. Automated checks plus manual keyboard, screen-reader, 320 px reflow, 200% zoom, contrast, error, focus, and reduced-motion review must find zero open Level A/AA defect in sign-in, recovery, Shelf, privacy, export, deletion, and later Routine core tasks.
6. Production dashboards distinguish identity verification, member authorization, Shelf/Routine reads and mutations, export/deletion queue age, rate-limit denials, cross-account denials, administrative access, and backup/deletion reconciliation. Metrics and traces obey the data-minimization rules above.
7. Alerts, an on-call owner, feature-level disable switch, rollback procedure, and a tested recovery exercise exist. A production-like restore drill must prove deletion-ledger replay before launch.

Initial service objectives are 99.5% successful member reads and 99.0% successful member mutations over a rolling 24 hours, excluding validated client errors; p95 server latency is at most 1.5 seconds. Deletion completion is 100% within 30 days and export completion is at least 99% within 24 hours.

## Baseline, rollout, success, and stop rules

Product baselines must be observed, not invented after launch:

1. Before public rollout, Product and Privacy approve a scorecard definition for `save_intent`, `first_save_completed`, `shelf_opened`, `repeat_product_retrieval`, `item_removed`, `export_completed`, `deletion_completed`, and recovery outcome. It records numerator, denominator, exclusions, privacy treatment, owner, and query/version. `repeat_product_retrieval` is a product-agnostic boolean computed before the analytics write; the event stores no product or query identity.
2. Observe at least 28 consecutive days and 1,000 eligible public product-detail sessions for the account-free repeat-retrieval baseline. If volume is lower, extend once to 56 days. Do not substitute a smaller unlabelled sample; record the available sample and uncertainty.
3. Freeze that baseline and the scorecard before member rollout. Utility succeeds only if the 28-day Shelf cohort improves repeat retrieval of an exact product by at least 10% relative to the frozen baseline and the lower bound of the 95% confidence interval is not below baseline.

Rollout is reversible and sequential:

| Stage | Limit | Minimum evidence before advance |
| --- | --- | --- |
| Staff alpha | Up to 20 accounts | 14 days, all security/accessibility gates, successful export/deletion/restore exercises, no stop condition |
| Invite beta | Up to 100 accounts | 28 days, at least 50 activated members, no stop condition, support demand at or below 10% of activated members |
| Public stage 1 | 10% of eligible save-intent traffic | At least 7 days and 200 save intents with objectives met |
| Public stage 2 | 50% | At least 7 days and 200 save intents with objectives met |
| Full Shelf v1 | 100% | Product, Privacy, Security, Accessibility, Data Administration, and Platform owners sign the frozen scorecard |

At each public stage, at least 70% of valid save intents must complete a first save, at least 99% of writes must preserve exactly-once visible state under retries, recovery success must be at least 90% across a minimum of 50 attempts, and the share of activated members opening a portal-related support case must remain at or below 10%. If a sample minimum is not reached within 28 days, do not silently waive it: publish the observed sample and confidence limits and revise the threshold only through a reviewed roadmap/decision update.

Immediately disable new saves and assess rollback on any one of:

- one confirmed cross-account read/write, consumer-to-operator privilege path, public/cache/log disclosure of private content, or unapproved administrative access;
- one missed 30-day deletion deadline, one restore that resurrects deleted active data, or any private data used for targeting, ranking, clinical authority, or model training;
- member mutation failures above 2% across at least 100 requests in a rolling hour, or p95 server latency above 2 seconds for three consecutive 15-minute windows;
- recovery failure above 10% across at least 50 attempts, export completion below 99% in 24 hours, or an unreconciled deletion/export queue older than its SLA;
- any open critical/high security finding or Level A/AA defect blocking a core task; or
- support demand above 15% of activated members during a rollout stage, or evidence that members consistently mistake the Shelf or Routine for a recommendation.

Routine v1 repeats alpha, beta, 10%, 50%, and 100% stages independently. It cannot inherit Shelf rollout evidence for its distinct safety, comprehension, and accessibility risks.

## Department ownership and release sequence

| Department | Owns | Does not own |
| --- | --- | --- |
| `member-experience` | Optional member entry after save intent; Shelf and member-authored Routine interaction; accessible states; user-facing recovery, consent history, export, and deletion status | Identity-provider configuration, operator authorization, storage lifecycle, administrative access, catalogue identity, notifications, community, or release integration |
| `data-administration` | Member schemas and access policies; consent ledger; retention, export, deletion, replica/backup reconciliation; administrative-access audit and runbooks | Member interface grammar, operator moderation permissions, catalogue review, or public community policy |
| `platform-delivery` | Identity-provider adapter, member guard/session security, abuse controls, production observability, feature flags, integration gates, deploy, smoke, and rollback | Member product decisions, catalogue evidence, or using operator authorization as a shortcut |
| `catalogue-product-lane` | Immutable exact-product version identifiers, reviewed/community provenance, aliases, successors, retirements, and resolver behavior | Member ownership, private analytics, consent, or portal release |

Delivery order is mandatory:

1. Finish and hand back any active catalogue release integration; reconcile this ADR and roadmap on current `origin/main` through the single release owner.
2. Catalogue/data owners publish the immutable identity, alias, successor, and tombstone contract needed by Shelf.
3. Data Administration completes the approved lifecycle schema, access policies, deletion/export design, backup reconciliation, and privacy review.
4. Platform Delivery implements member identity and authorization without changing operator auth, then proves abuse, observability, and rollback gates.
5. Member Experience implements and verifies Shelf v1 inside the accepted contract.
6. One integration owner runs the complete gates, staged rollout, exact-revision deployment confirmation, and public-site smoke. The smoke must not claim `/shelf` exists before that implementation is released.
7. After Shelf v1 meets the Phase 2 gate, the same ownership sequence applies to user-created Routine v1.
8. Reminders/notifications and public community each require their own accepted ADR, operating owner, privacy/safety review, implementation, and rollout evidence.

No portal work may race a catalogue or operations integration owner for shared release state.

## Consequences

JeloCare gains a bounded path from public product checking to private retrieval without becoming a social network or weakening its evidence model. The main cost is deliberate infrastructure and governance work before visible features: immutable product references, separate member authorization, lifecycle jobs, administrative controls, and measurable release gates must exist first.

## Alternatives rejected

- **Keep all account work deferred.** Rejected because a private exact-product Shelf directly strengthens the north-star return journey and can be isolated from the public community and notification risks.
- **Launch collections, routines, reminders, and community together.** Rejected because they introduce different privacy, abuse, clinical, moderation, and delivery systems and cannot share one rollout decision.
- **Use operator authorization for consumers.** Rejected because identity reuse is not permission reuse; it would place public members inside a privileged trust domain.
- **Store only current product slugs.** Rejected because merges, retirements, and reformulations would silently rewrite or destroy the member's saved meaning.
- **Treat a saved or repeated product as recommendation evidence.** Rejected because personal organization and popularity do not create clinical or catalogue authority.
