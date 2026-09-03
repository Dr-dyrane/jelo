# Comprehensive remediation evidence register

Date: 2026-08-31
Status: **release cells live; controlled private-customer proof closed; named
authority-bound or lane-owned residual risks retained below**

This receipt records the bounded JeloCare comprehensive audit remediation
program. It separates code and release proof from production observations,
business-policy inputs, external-provider blockers, and actions that still
require fresh authority. It is not a substitute for the private daily
[business evidence register](../../business-evidence/REGISTER.md), a migration
ledger, or an authorization to mutate production data or configuration.

## Release boundary

The integration branch is `main`. The latest application revision observed by
this receipt is
`fe4cfdf568a57e2189609ac221938f6bc5f46806`. Its exact production deployment
is `dpl_GevNohodzYfbwTrT76grXoVqYQ4E`, which is READY and aliased to
`www.jelocare.com` and `jelocare.com`.

The shared checkout still contains protected, unrelated work in
`.codex/context-system/work-ledger.md`, `AGENTS.md`, `LANES.md`,
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
| Postgres reconnect-delay clamp                   | `2ad29208e8d960ef7f8585a52d50aff88929900c` | `dpl_9osvqHJqNAjHxgeFvm1aPoDdMFSv` | The exact Postgres 3.4.7 ESM and CommonJS sources receive one version- and hash-pinned non-negative reconnect clamp during install.                   |
| Global product care source and Ask handoff       | `3d5dc34fabca8678f138189d2ece14ea63c8e23b` | `dpl_DhmwSjCYwv4BtRFMHYzauTXDC4x4` | All 163 products expose a truthful care boundary and editable Ask handoff; source roles fail closed without blanket clinical promotion.               |
| Ask selected-context owner verification          | `93df3a618c80af5bd64e646c26178af3d2f072d3` | `dpl_DVfAwVqUp9WW3JXjXP9WJghF2ggK` | Submitted Concern, Shelf, and Routine slugs influence Ask only after server-side owner verification; private responses are never cacheable.           |

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

The reconnect-delay cell passed three focused patch-contract tests, typecheck,
documentation checks, all 53 canonical migration checks, scoped lint,
formatting, and whitespace verification. The local full suite passed 1,700 of
1,703 tests with three expected skips and zero failures. The clean Vercel build
cloned exact revision `2ad29208e8d960ef7f8585a52d50aff88929900c`, reported
`2 patched, 0 already patched` from the install hook, and passed 1,699 of 1,703
tests with four expected environment skips and zero failures. Its build log
contained no `TimeoutNegativeWarning`.

Three production rounds then returned HTTP 200 for `/`, `/consult`, and the
bounded recovery sign-in URL, while signed-out `/ops` and `/ops/orders`
returned HTTP 404 with `private, no-store` and
`noindex, nofollow, noarchive`. The exact deployment's 5xx response scan was
empty. Error-level telemetry from the deliberate Ops probes retained the
external Neon Auth upstream 500 while the application failed closed to 404;
that provider-capacity condition remains gate 1 rather than being attributed
to the reconnect patch.

The global product-care cell passed 64 focused tests and the full clean
release verifier. Its exact deployment removed the obsolete dead-end care
sentence from all 163 product presentations, introduced one editable Ask
handoff, and tightened product-source admission so retailer, social,
aggregator, or unknown hosts cannot satisfy a claim-scoped evidence pair. The
matrix remains truthful at 22 supportive, 39 pharmacist-reviewed context, and
102 evidence-pending products; the context-only review was not widened.

The Ask member-context cell passed 125 focused tests and the exact clean
release verifier: 1,720 tests ran, 1,716 passed, four expected environment
tests were skipped, and none failed. One independent review stopped the first
candidate over missing private cache headers; the bounded correction covered
every selected-context success and failure branch, and the recheck returned
`SHIP`. The exact Vercel build repeated the same full-suite totals.

Live smokes proved public guidance remained HTTP 200, emergency guidance
interrupted before unavailable authentication, and forged nonempty member
context failed closed at HTTP 503 with `private, no-store, max-age=0` and no
report or products. `/me/consult` preserved its safe continuation, while
signed-out `/ops` and `/ops/orders` remained concealed 404 responses. The
deployment-scoped smoke window contained no HTTP 500 or new application-error
signature.

A complete production crawl then returned HTTP 200 for all 163 unique product
URLs. The obsolete sentence appeared zero times; every page matched its exact
care state and editable Ask prompt; and two warmed-cache rounds produced
163 of 163 hits without state, prompt, action, redirect, presentation, ETag, or
obsolete-copy drift.

## Capacity, configuration, and authorized private-journey follow-up

Fresh action-time authority upgraded the shared eight-project Neon installation
to `launch_v3`. A production read-only connection probe then succeeded with
`writesPerformed: 0`, replacing the earlier PostgreSQL `53000` capacity result
as current provider evidence. No database row, queue, claim, retry, cache,
inventory job, payment, or order state was manually mutated.

Two independently generated dedicated values now configure
`ASSISTED_ORDER_RATE_LIMIT_SECRET` and `LOCATION_RATE_LIMIT_SECRET` across
Production, Preview, and Development. Vercel stores the Production and Preview
values as sensitive variables and the Development values as encrypted variables,
which is the strongest supported Development scope. Exact-source production
deployment `dpl_AnCws7Anj72eZwb7KNpugXyT1qBj` became READY and passed canonical
route smokes after the configuration change; no secret value entered this
receipt or a runtime log.

The explicitly authorized disposable-account journey proved a fresh OTP sign-in,
Shelf add/reload/remove, Routine create/update/delete, a one-item Shelf export
without email or account identifier, both cancel and accept paths for clearing
the Shelf, the empty end state, sign-out, and the restored signed-out boundary.
The missing-product request path failed closed at HTTP 503 before inserting a
row. Runtime evidence isolated an invalid NUL separator in the per-owner
PostgreSQL advisory-lock key. Exact fix
`c44846e23fc5a8d3372640abeebbac235fb87935` replaced that separator with a safe
domain delimiter, passed independent review and the complete 1,726-test suite
with 1,723 passes, three expected skips, and zero failures, and shipped through
READY deployment `dpl_GeWDGR7cj6z2sm2zFa1QiAJB7Hgn`.

The final post-fix proof completed on 3 September 2026 against READY deployment
`dpl_GevNohodzYfbwTrT76grXoVqYQ4E`, sourced from
`fe4cfdf568a57e2189609ac221938f6bc5f46806`, which contains the fix revision.
A fresh OTP sign-in reached an initially empty Shelf. An exact-catalogue search
confirmed that the labelled synthetic identity was absent; the private draft
then created successfully, its printed variant changed from the initial
synthetic value to an edited synthetic value, and the rendered detail reflected
the change. After explicit action-time confirmation, the destructive dialog
deleted the request. The returned Shelf showed `0 exact products`, `0 requests`,
`Private request deleted.`, and no private product requests. Sign-out restored
the `/sign-in?next=/me` boundary. No photo was attached, the draft was never
submitted for review, no customer identifier or private row identifier entered
this receipt, and no external publication occurred.

## Objective closure matrix

| Remediation domain                          | Current proof                                                                                                                                                                         | Closure state                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Release-blocking security                   | Zero-audit dependency floors, exact Shelf-role attestation, production database-alias containment, private operator logs, and six dedicated rate-limit secret bindings                | Code, release, and dedicated-secret configuration cells closed                                                   |
| Authentication                              | Password lifecycle containment, bounded OTP intent and recovery, successful post-upgrade auth, and the authorized disposable-account journey                                          | Provider-capacity and final post-fix product-request create/edit/delete gates closed                             |
| Payment integrity                           | Signed settlement-time binding, preserved payment-attempt reservations, governed evidence tests, and exact READY deployment                                                           | Code and release cell closed; provider fees and other business inputs remain gate 9                              |
| Inventory automation and failure accounting | Separate retry, contradiction, deferral, stale, and watchdog accounting; guarded proposal integration; post-upgrade natural health evidence                                           | Code/release and provider-capacity cells closed; the current degraded backlog remains scheduled-owner work       |
| Production observability                    | Exact-deployment runtime logs, health watchdog, private aggregate telemetry, and deterministic 28-day evaluator                                                                       | Instrumentation closed; approved traffic floors, alert ownership, dated 672-hour report, and drill remain gate 4 |
| Customer and commerce flows                 | Global care handoffs, governed Ask assessment, server-verified selected context, compact accessibility, owner isolation, export privacy, bounded recovery and production route smokes | Released and authorized destructive behavior closed; policy and lane-owned gates 5, 6, 11, and 12 remain         |
| Business evidence                           | Private read-only 30-day aggregate with exact payment and SLA proof rules, explicit cost-null behavior, and the successful post-upgrade natural 05:23 run                             | Code/release, scheduled observation, and provider-capacity cells closed; unavailable inputs remain gate 9        |
| Final release record                        | Exact revision-to-READY bindings, production smokes, independent review, protected-path accounting, all first natural owner observations, and the controlled private-request proof    | Required runtime proof is closed; this receipt's final release binding remains pending                           |

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
- post-upgrade inventory health at 05:07:07 UTC on exact READY production
  deployment `dpl_DHNP97FRB1T7ubpUqEz643LZGm5i`: HTTP 503 with
  `inventory_health_watchdog_checked`, `degraded`, three due jobs, 105 deferred
  rechecks, 60 stale offers, and `writesPerformed: 0`;
- post-upgrade business evidence at 05:23:09 UTC on that deployment: HTTP 200,
  cache `BYPASS`, `business_evidence_register_checked`, four requests, one
  quote, one approval, zero payment or later lifecycle rows, eight unavailable
  cost inputs, and `writesPerformed: 0`;
- all-product clinical review at 05:53:12 UTC on exact READY production
  deployment `dpl_A9dF8J8b3TX9PYRGdW2QxDe8HtJk`: HTTP 200,
  `clinical_review_health_checked`, `attention_required`, exact manifest digest
  `d4af5339f885b43baebe697654eb6fa4122db95846276995ce6b6ff418224d6d`, and
  `writesPerformed: 0`.

The 02:07, 02:17, and 05:23 results prove all three owners fired naturally;
scheduler silence is not the cause. The business-evidence route failed closed
without substituting zero populations, exposing amounts or row-level fields,
or performing a write. Its generic query/configuration failure is consistent
with the independently observed database-capacity failure, but the structured
event does not claim a provider-specific cause. Observation was read-only; no
missing or failed run was replayed manually.

The post-upgrade results prove capacity recovery without hiding operational
truth: business evidence can query successfully, while inventory health still
reports the actual deferred and stale backlog. The all-product clinical owner
also met its fixed acceptance rule on its first natural slot. None of these
routes was invoked manually and every observed route reported zero writes.

## Authority, policy, and residual-risk register

Items 1, 2, 3, and 8 are retained in place for audit traceability and are now
closed by action-time authority plus exact production evidence. The other
items are not closed by code or local tests:

1. **Neon capacity — closed.** The authorized `launch_v3` upgrade completed,
   a production read-only connection probe succeeded, and the next natural
   business-evidence query returned HTTP 200 with zero writes. The degraded
   inventory-health result is retained as backlog evidence rather than being
   misreported as continuing provider failure.
2. **Dedicated rate-limit secrets — closed.** Two distinct generated secrets
   now exist across Production, Preview, and Development with the strongest
   storage class supported by each scope. Exact-source redeployment and public
   smokes passed without reading or logging either value.
3. **Postgres reconnect timer — closed.** The install lifecycle now applies an
   exact, reversible `Math.max(0, ...)` clamp to the ESM and CommonJS sources of
   Postgres.js 3.4.7. It validates the package version and original file hashes,
   preflights both targets before writing, is idempotent, and fails the install
   on dependency drift. This avoids the 3.4.8 `TransactionSql` type regression
   tracked in upstream issues
   [1143](https://github.com/porsager/postgres/issues/1143) and
   [1150](https://github.com/porsager/postgres/issues/1150), and the later
   transaction defect tracked in issue
   [1189](https://github.com/porsager/postgres/issues/1189). The exact clean
   production build applied both patches and emitted no negative-delay warning.
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
8. **Authenticated destructive journey — closed.** Fresh authority
   covered the disposable account, OTP transmission, export, Shelf clear,
   Shelf removal, Routine deletion, and the final product-request sequence.
   Every mutation actually completed reconciled to the empty UI and sign-out
   boundary. The pre-fix request create failed without a row, the bounded
   advisory-lock fix is live, and the authorized post-fix create/edit/delete
   sequence succeeded on its exact READY descendant deployment. The account
   ended with zero saved products and zero private product requests, and the
   session ended signed out.
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
