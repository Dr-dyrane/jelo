# Comprehensive remediation evidence register

Date: 2026-08-31
Status: **release cells live; natural clinical-owner verification and named
authority-bound or lane-owned residual risks retained below**

This receipt records the bounded JeloCare comprehensive audit remediation
program. It separates code and release proof from production observations,
business-policy inputs, external-provider blockers, and actions that still
require fresh authority. It is not a substitute for the private daily
[business evidence register](../../business-evidence/REGISTER.md), a migration
ledger, or an authorization to mutate production data or configuration.

## Release boundary

The integration branch is `main`. At this receipt's latest capture, local
`HEAD` and `origin/main` resolve to
`0dba14dd04c1188fd5b8319ab8b1150846ed8995`. The exact production deployment
is `dpl_7mPpRM2smdfNXeZALF4WgqVQNgxK`, which is READY and aliased to
`www.jelocare.com` and `jelocare.com`.

The shared checkout still contains protected, unrelated work in
`.codex/context-system/work-ledger.md`, `LANES.md`,
`lib/inventory/repository.ts`,
`docs/operations/evidence/2026-08-31-clinical-review-scheduled-owner.md`, and the untracked
`public/campaigns/social/2026-08-27-x-reply-desk-v2/**` tree. This program did
not stage, discard, publish, or rewrite those paths.

## Shipped remediation cells

Every row below names the exact source revision and the exact READY production
deployment that carried it. A later READY deployment contains every earlier
cell because each cell was integrated on `main`.

| Cell                                             | Exact revision                             | READY production deployment        | Evidence boundary                                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwordless authentication containment          | `065ef4138fc3391ed8c28b8f33b51a9ec0bc9eba` | `dpl_8aHDAMWzdkBtUyR1kAtRnk9Jngdb` | Password lifecycle routes are blocked; OTP intent is bounded and fail-closed.                                                                         |
| Governed payment settlement time                 | `d88d1b63743b934d1518a6574ce1796cbdac53dc` | `dpl_8Rm8UFoP4Q7mDb6ruvavuG4anvD8` | Settlement time is bound to signed provider evidence rather than request time.                                                                        |
| Inventory failure accounting                     | `7f6e22d54b2dd6f5d2b0cc058a22889006446765` | `dpl_8rFM4rML3nKwRPR4rbKkULsLdktK` | Retries, terminal contradictions, deferred rechecks, stale offers, and watchdog failures remain distinct.                                             |
| Commerce analytics and private business evidence | `0f913cd88cd5e1972af468b314102c58f80ba1d6` | `dpl_Dg1vD2N3ybor2iMKWeiVLsAeq2oX` | Invalid commerce collection was removed; the 30-day aggregate is private, read-only, and evidence-bound.                                              |
| Public care truth and operator log privacy       | `12164da4cb26d040196f1f4501b22dc39882e5b4` | `dpl_2YarhZUVPJhQJBcMNtYwbaiJpB7d` | Public states remain non-diagnostic and operator routes/logs retain private boundaries.                                                               |
| Shelf runtime-role attestation                   | `71382fa0b3be949e155c5aeced853b724afbfcc9` | `dpl_FUyuDzZfXiz6fN3kPQ7jzyDfzpuD` | Elevated, inherited, indirect, PUBLIC, and application-role authority paths fail the checked boundary.                                                |
| Public keyboard bypass navigation                | `c4124ab4025237c1ed6fedd00a6b0bee74b041b1` | `dpl_E4KWUtqrKbUsVAHW9vFr7HvWw39w` | The skip link is focus-visible and reaches the public main-content target.                                                                            |
| Scheduled inventory proposal integration         | `22cfa0980e5da786bfc65456603c0007780b9df3` | `dpl_22R4fvSqvWu43bE5szCjYuLMS5rM` | The guarded owner integrated one reviewed proposal; no manual catalogue replay was used.                                                              |
| Protected Ask retention operator                 | `a4257d0cd846629fdf3ed319568fa056f51308b1` | `dpl_DA7HMok7vaFkH8de5kzpiDGaaGnv` | Dry-run is default; apply requires exact confirmation and a bounded batch outside Vercel.                                                             |
| Private telemetry SLO evaluator                  | `bdaa55f8aca7bb2ca7aa7c52eda7d2d8881f5668` | `dpl_DHawCv4FP3aBNFLyYTL48Pwncfpa` | The canonical 28-day evaluator uses exact integer arithmetic and explicit traffic-policy inputs.                                                      |
| Production database alias containment            | `472efcc81820b9c553fb749489bcc2385d233388` | `dpl_AT7c1Mgi7hF5JV4RHWhU3VRJQGTT` | Production and Preview reject compatibility aliases; only `APP_DATABASE_URL` is accepted for the general runtime.                                     |
| Runtime dependency security floors               | `91385b876eeda58127791f00505154a71d2d5428` | `dpl_EsPUkrRsrtHGRxdazeHCHy93Xr9f` | Reviewed Next, React, Sharp, PostCSS, NanoID, and Undici floors are lock-attested.                                                                    |
| Development dependency security floors           | `d7c0e697a77d274cd79f36bd4a8d19e53dab8a11` | `dpl_GPfuehi1YDbLexRuJFAWeHJGz6Qr` | Both `brace-expansion` lines and `js-yaml` resolve to reviewed patched releases; full `npm audit` reports zero findings.                              |
| All-product clinical review owner                | `5cf974ae99927a89a661818fef6f591d9b2c4914` | `dpl_43RnaNYB6FTefb4Eqya74Fq9QWUx` | A daily read-only owner inventories all 163 products into an exact human-review plan; it cannot attest or promote them.                               |
| Ask JeloCare governed assessment                 | `9ca25d128aca147b23d927c9e2744f9dcb395a79` | `dpl_6chbE24Ky7iAQ1yG5msQ73NroXNJ` | Ask acts under medical/pharmacy protocol governance, gives a possible explanation and plan, and does not impersonate a personally reviewed diagnosis. |
| Customer recovery and Ops wait-clock integrity   | `0dba14dd04c1188fd5b8319ab8b1150846ed8995` | `dpl_7mPpRM2smdfNXeZALF4WgqVQNgxK` | Provider failure recovers with bounded intent and no private-ID leak; Ops age uses append-only owned-state evidence.                                  |

## Integrated verification

The final dependency cell passed 1,687 tests: 1,684 passed, three expected
tests were skipped, and none failed. Typecheck, documentation, migration
inventory, tracked-surface lint, all catalogue projections, publication image
verification, and canonical asset verification passed. Tracked-surface lint
reported zero errors and 20 warnings. The normal unscoped lint command also
sees protected untracked campaign render sources; those unrelated files were
excluded instead of modified.

One independent read-only review accepted the pre-scheduled-observation draft
with no findings. It rechecked all 13 revision-to-READY-deployment bindings,
current branch and alias convergence, the initial scheduled failure timestamps
and error codes, the name-only rate-limit secret absence, the full test and
audit totals, the scheduled-owner separation, and the exact two-path
documentation diff. Later scheduled observations in this receipt are bound
directly to their exact production log records and were not retroactively
attributed to that review.

The integration owner then reviewed the complete two-path diff after the
scheduled and residual-risk additions. The focused business-evidence contract
passed five of five tests, including SELECT-only aggregation, no row-level
output, fail-closed consistency, secret protection, no-store behavior, and
visible failure. Formatting, whitespace, and the documentation index remained
green.

The final two dependency deployments each completed three production rounds
over `/`, one exact product, `/checkout`, and `/me`. All 24 requests returned
HTTP 200. The private `/me` response remained `private, no-store` with
`noindex, nofollow, noarchive`. Neither exact deployment produced a 5xx during
its smoke window.

At 320 by 700 CSS pixels, the production skip link rendered as a visible
191-by-46-pixel target with a three-pixel focus outline, reached
`#main-content`, and introduced no horizontal overflow. The compact navigation
opened as a labelled dialog, dismissed successfully, and restored focus to its
trigger.

The focused private-capability recheck passed 105 of 105 tests covering Shelf
and Routine owner isolation, exact Shelf role attestation, export privacy,
passwordless session policy, Ask safety and retention, aggregate telemetry,
and the 28-day SLO evaluator. Rendered signed-out production checks proved the
canonical `/me/routine` and exact member-product OTP continuations. An external
`next` value could not become an external redirect and remained behind the
operator allowlist. No email, OTP, customer row, export, or deletion was used.

The final customer-recovery and Ops wait-clock cell passed its 38 focused
tests, the full Node test suite, typecheck, documentation checks, all 53
canonical migration checks, every catalogue/publication/asset verifier,
scoped lint with zero errors, and whitespace verification. The unscoped lint
command still entered protected untracked campaign-render sources; reported
errors there were excluded and their owner paths were preserved.

At 320 by 700 CSS pixels, the live recovery page rendered one main landmark,
no horizontal overflow, no client error overlay, no authentication-provider
jargon, a `noindex, nofollow` document boundary, and a 62-by-44-pixel retry
control. `/me/explore`, `/me/shelf`, `/me/routine`, `/me/consult`,
`/me/orders`, `/me/notifications`, and `/me/locations` each retained their
exact safe continuation during the observed Neon Auth failure. `/me/shelf/add`
and `/me/shelf/request/private-request-id` both collapsed to `/me`; the private
identifier did not survive in the destination URL. Signed-out `/ops` and
`/ops/orders` remained HTTP 404 with `private, no-store` and
`noindex, nofollow, noarchive`.

The exact deployment's affected-route 5xx scan was empty. Its expected error
records showed the pre-existing Neon data-transfer quota failure and the
generic authentication-session lookup failure that exercised the new recovery
path. Customer pages still returned HTTP 200, operator pages failed closed at
404, and the supplied private path identifier did not enter the recovery
destination or application log message. The Ops SQL cell was verified
semantically and statically; private production query execution was not
authorized and remains part of the authenticated gate.

## Objective closure matrix

| Remediation domain                          | Current proof                                                                                                                                                 | Closure state                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Release-blocking security                   | Zero-audit dependency floors, exact Shelf-role attestation, production database-alias containment, private operator logs, and name-only environment inventory | Code and release cells closed; dedicated HMAC secret configuration remains gate 2                                    |
| Authentication                              | Password lifecycle containment, bounded OTP intent and recovery, private-route fail-closed behavior, and production safe-continuation checks                  | Non-destructive boundary closed; Neon capacity remains gate 1 and a fresh private/destructive journey remains gate 8 |
| Payment integrity                           | Signed settlement-time binding, preserved payment-attempt reservations, governed evidence tests, and exact READY deployment                                   | Code and release cell closed; provider fees and other business inputs remain gate 9                                  |
| Inventory automation and failure accounting | Separate retry, contradiction, deferral, stale, and watchdog accounting; guarded proposal integration; natural owner-run logs                                 | Code/release cells closed; Neon capacity remains gate 1                                                              |
| Production observability                    | Exact-deployment runtime logs, health watchdog, private aggregate telemetry, and deterministic 28-day evaluator                                               | Instrumentation closed; approved traffic floors, alert ownership, dated 672-hour report, and drill remain gate 4     |
| Customer and commerce flows                 | Public care states, governed Ask assessment, compact accessibility, owner isolation, export privacy, bounded recovery and production route smokes             | Non-destructive released behavior closed; policy/private-action gates 5, 6, 8, 11, and 12 remain                     |
| Business evidence                           | Private read-only 30-day aggregate with exact payment and SLA proof rules, explicit cost-null behavior, and the observed natural 05:23 run                    | Code/release and scheduled-observation cells closed; Neon capacity and unavailable inputs remain gates 1 and 9       |
| Final release record                        | Sixteen exact revision-to-READY-deployment bindings, production smokes, independent review, protected-path accounting, and natural owner observations         | Current release cells are live; the first natural all-product clinical-owner run remains pending                     |

## Scheduled-owner observations

The business-evidence acceptance rule was fixed before observing the natural
run. Success requires HTTP 200, `private, no-store`, the structured
`business_evidence_register_checked` event, and `writesPerformed: 0`. A query
or configuration failure requires HTTP 500, the same cache boundary, the
structured `business_evidence_register_failed` event, and zero writes. The
route never substitutes zero populations for unavailable evidence, and the
runtime log omits amounts and row-level private fields.

The catalogue remains at 152 of 162 products with current exact Nigerian offer
coverage. The remaining ten rows are truthful no-exact-offer states. Manual
catalogue waves, cron calls, queue claims, retries, cache invalidation, and
database mutation are outside this receipt. At the initial capture,
`origin/inventory-sync-review` had converged exactly to `main` and contained no
pending proposal.

The checked-in completion matrix is unchanged from `HEAD` and names the ten
remaining canonical package/media-review rows: Naturium Alpha Arbutin Serum 2%
1 fl oz, Azelaic Acid Emulsion 10% 1 fl oz, Multi-Active Exosome Serum 1 fl oz,
Multi-Peptide Advanced Serum 1 fl oz, Niacinamide Serum 12% 1 fl oz, Quadruple
Hyaluronic Acid Serum 5% 1 fl oz, Retinol Complex Serum 1 fl oz, Salicylic Acid
Serum 2% 1 fl oz, Vitamin C Complex Serum Jumbo 2 fl oz, and Vitamin C Super
Serum Plus 1 fl oz. Each row requires current-package reconciliation; none is
an inventory retry target.

The natural scheduled observations are:

- inventory-health at 02:07:07 UTC on exact production deployment
  `dpl_GPfuehi1YDbLexRuJFAWeHJGz6Qr`: HTTP 500 with
  `inventory_health_watchdog_failed` / `health_query_failed`;
- inventory refresh at 02:17:43 UTC on the same exact deployment: HTTP 500
  with PostgreSQL code `53000`;
- business evidence at 05:23:09 UTC on the same exact deployment: HTTP 500,
  cache `BYPASS`, and the structured `business_evidence_register_failed` /
  `query_or_configuration_error` event with `writesPerformed: 0`.

The 02:07, 02:17, and 05:23 results prove all three owners fired naturally;
scheduler silence is not the cause. The business-evidence route failed closed
without substituting zero populations, exposing amounts or row-level fields,
or performing a write. Its generic query/configuration failure is consistent
with the independently observed database-capacity failure, but the structured
event does not claim a provider-specific cause. Observation was read-only; no
missing or failed run was replayed manually.

The all-product clinical-review owner was deployed after its 05:53 UTC slot on
31 August. Its first natural execution is due 1 September 2026 at 05:53 UTC.
It was not invoked manually. A passing observation requires HTTP 200,
`clinical_review_health_checked`, `attention_required`, exact manifest digest
`d4af5339f885b43baebe697654eb6fa4122db95846276995ce6b6ff418224d6d`, and
`writesPerformed: 0`. Until that event is observed, this scheduled behavior is
deployed-unverified.

## Open authority and policy gates

These are not closed by code or local tests:

1. **Neon capacity.** Production reports PostgreSQL `53000`: the project has
   exceeded its data-transfer quota. Public catalogue and checkout reads use
   verified static fallbacks, but inventory, health, business-evidence, and
   Neon Auth cannot be certified healthy until capacity is restored. A plan
   upgrade or provider change requires fresh spending/configuration authority.
2. **Dedicated rate-limit secrets.** Production and Preview have no
   `ASSISTED_ORDER_RATE_LIMIT_SECRET` or `LOCATION_RATE_LIMIT_SECRET`. The
   current literal fallback must not be removed before two distinct secrets
   are configured. Creating or changing those secrets requires fresh
   action-time authority. A name-and-scope-only Vercel inventory refreshed at
   01:55 UTC confirmed both absences, confirmed `APP_DATABASE_URL` remains
   Production-only, and found no `DATABASE_URL` or `POSTGRES_URL` in any
   Vercel scope; no secret value was read.
3. **Postgres reconnect timer.** Postgres.js 3.4.7 can schedule a negative
   reconnect delay. Upstream 3.4.8 and 3.4.9 clamp the delay but introduce an
   upstream `TransactionSql` type regression across the repository. The
   bounded upgrade correction was reverted. A later decision must choose an
   exact install-time patch or the wider upstream type migration.
4. **Private-service SLO proof.** No dated production 672-hour SLO report or
   recovery-drill receipt exists. Minimum read and write traffic populations,
   a 15-minute alert source/cadence, and the accountable response owner require
   recorded approval; this receipt does not invent them.
5. **Ops queue-age policy.** Pending counts and oldest timestamps are
   measurable, but warning/critical thresholds, escalation cadence and
   channel, response owner, and recovery drill have not been approved. A
   repository authority search found lifecycle SLA distributions and fixed
   inventory-backlog alerts, but no order-specific policy to reuse; the
   inventory thresholds must not be relabelled as customer-order authority.
6. **Concern retention.** Concern persistence exists, but classification,
   current/removed export policy, hard-delete versus tombstone behavior, live
   and backup retention, and account-deletion treatment remain undecided. The
   current Shelf export expressly omits Concern data, full provider-account
   deletion is expressly unimplemented, and the production roadmap reserves
   the retention and deletion promise as a founder decision; Shelf policy is
   therefore not implicit authority for Concerns.
7. **Ask retention operations.** The bounded operator exists, but no cadence or
   production apply receipt exists. The 30-day `retain_until` boundary is only
   eligibility, not an automatic-deletion promise; the runbook deliberately
   excludes Vercel, cron, queue, and cache ownership. Any production deletion
   requires a freshly resolved target and batch plus action-time authority.
8. **Authenticated destructive journey.** Existing historical evidence covers
   one OTP member smoke. A fresh sign-in, intent return, new session, export,
   expired-session recovery, and delete/reconciliation proof would expose or
   change private data and therefore requires fresh action-time authority.
9. **Business inputs.** No accepted durable source exists for Stripe fees,
   operator labour, messaging or AI cost, retailer variance, customer
   acquisition cost, chargeback/refund loss, contribution margin, or repeat
   cohort proof. The private register marks each unavailable rather than
   estimating it.
10. **Commercial and legal decisions.** Product-data/image licensing,
    redistribution permissions, clinical-review ownership, and other
    commercial or legal decisions require human evidence and cannot be inferred
    from repository provenance.
11. **Clinical outcome ranking.** The current Clinical wisdom lane owns
    `modules/recommendations/clinical-product-filter.ts`. A read-only review
    found that a product marked `didnt-help` can still receive the previous-
    recommendation score. That lane must remove the contradictory boost and
    recheck the governed ranking before its release; this receipt does not edit
    or ship through another owner's active reservation.
12. **All-product evidence resolution.** The read-only owner covers all 163
    products, but coverage is a review plan rather than an attestation. The
    exact 31 August v1 pharmacist record remains context-only for its original
    39-product cohort. The remaining products, changed formulas, missing source
    URLs, and stronger dispositions require immutable evidence packets and a
    named licensed human decision. Protocol-level approval of Ask does not
    manufacture product evidence or silently promote an insufficient row.

## Closure rule

This program closes only after the scheduled observations above are appended,
the exact final revision is committed and pushed, its production deployment is
READY and smoke-tested, and every remaining item is either remediated or
retained as a specifically named non-actionable risk with its missing
authority, policy input, or external dependency. This receipt intentionally
does not name its own commit or deployment because embedding either would
create a newer, unbound revision. The final integration handback is the
authoritative immutable binding for this documentation cell. A local file,
green test, push, or READY deployment alone is not completion.
