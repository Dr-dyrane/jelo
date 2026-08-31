# Product care source and assessment handoff release

Date: 2026-08-31
Status: **live-verified; unresolved product-evidence and provider-capacity gaps retained**

## Outcome

The dead-end care message is removed across all 163 public products. Every
care state now explains the current evidence boundary in customer language and
offers one editable handoff: `Tell Jelo what I'm noticing`. The handoff carries
the public product name into Ask JeloCare and waits for the customer to add
what they notice before requesting an assessment. It does not claim that the
consult engine has already assessed product fit.

This is a global experience and provenance closure, not a blanket clinical
promotion. The public matrix remains 22 `supportive_eligible`, 39
`pharmacist_review`, and 102 `insufficient_data`. The exact
`pharmacy-care-review/2026-08-31/v1` approval remains context only for its 39
named products. The other 102 products do not inherit it.

## Source admission

The source-quality projection now fails closed:

- only an explicit manufacturer or brand-owner host can count as exact-product
  evidence;
- only an explicit clinical, research, drug-label, or regulator host can count
  as claim context;
- retailer, social, aggregator, and unknown hosts cannot satisfy a
  claim-scoped evidence pair; and
- public links explain source purpose without implying regulator or clinical
  approval.

The checked-in 163-product audit contains 267 HTTPS source entries: 113
claim-scoped pairs, 41 single-role records, and nine records with no public
care source. The admission contract and exact first acne-label cohort are
recorded in [Product care source admission and global review
queue](../../research/2026-08-31-product-care-source-admission.md). Five exact
OTC acne products have manufacturer and current DailyMed identity bindings,
content digests, warnings, directions, and unresolved conflict notes. They
remain `reviewed_context_only`; the evidence packet does not create
individualized suitability or a Nigerian registration claim.

## Review and integration gate

One independent review initially stopped release because the proposed Ask
handoff overstated product awareness, unknown HTTPS hosts passed as product
evidence, and all three new links were smaller than the touch floor. The single
bounded correction changed the handoff to an editable assessment sentence,
made source roles fail closed, and set every action target to at least 44 CSS
pixels. The same reviewer then returned `SHIP` after probing all 163 prompts
and representative retailer, social, aggregator, and unknown hosts.

Focused verification passed 64 of 64 tests, TypeScript, documentation, scoped
lint, whitespace checks, and rendered desktop/mobile checks. The exact
candidate then passed the full release verifier in a clean snapshot: 1,708
tests ran, 1,704 passed, four expected environment tests were skipped, and
none failed. Lint had zero errors; typecheck, all 53 migration inventory files,
documentation, catalogue projections, publication records and images, and
canonical media all passed.

The normal shared-checkout verifier also passed its tests, typecheck,
documentation, and migration inventory. Its only failure was six lint errors
inside protected untracked campaign render scripts. Those unrelated private
paths were neither changed nor staged; the clean snapshot exists to test the
exact release candidate without them.

## Exact release proof

- Revision: `3d5dc34fabca8678f138189d2ece14ea63c8e23b`
- Commit: `feat: improve global product care evidence handoff`
- Deployment: `dpl_DhmwSjCYwv4BtRFMHYzauTXDC4x4`
- Deployment URL: `jelo-ov5e2gj4x-drdyranes-projects.vercel.app`
- READY at: `2026-08-31T08:48:21Z`
- Production aliases: `www.jelocare.com`, `jelocare.com`

Vercel cloned `main` at exact commit `3d5dc34`, completed the production build,
reported READY, and assigned the canonical aliases without an alias error.

Three HTTP rounds returned 200 for `/`, `/consult`, and representative public
products in all four affected evidence presentations: supportive, exact
pharmacist-reviewed context, insufficient with sources, and insufficient with
no source. At 320 by 700 CSS pixels, the three non-supportive representatives
rendered the correct state and action in both the page summary and Details
sheet. The supportive Details action opened Ask JeloCare with the editable
product sentence prefilled and did not submit it. The production browser error
scan was empty.

The member-product surface rendered all four presentations locally through the
explicit synthetic development customer. A production signed-in smoke was not
used because this release did not receive fresh action-time authority to send
private account context.

## Residual risks

The exact deployment produced no 5xx response during the smoke window. Its
runtime log did record the existing PostgreSQL data-transfer quota condition
on HTTP 200 requests. The application used verified static catalogue and price
fallbacks, but live database-backed ingredient disclosure and price history
remain degraded. Restoring capacity requires a spending or provider
configuration decision and was not attempted in this release.

The 102 insufficient products still require exact formula or ingredient
binding, claim-matched independent context, conflict reconciliation, and a
named human decision before their care state can be promoted. The scheduled
all-product clinical owner remains read-only and must run naturally; this
release did not invoke a cron, queue, retry, cache operation, or database
mutation.
