# Ask JeloCare member-context ownership release

Date: 2026-08-31
Status: **live-verified; provider-capacity and signed-in journey gaps retained**

## Outcome

Ask JeloCare no longer trusts customer-submitted Concern, Shelf, or Routine
slugs as proof of private context. When a request selects member context, the
server resolves the customer identity and intersects the submitted values with
that customer's active, current, published records. A slug that belongs to a
different customer, an inactive row, an unpublished product, or a forged
request cannot influence the assessment.

No private repository read occurs when member context is absent or empty.
Concern-only selection reads Concern only; product selection reads Shelf and
Routine only. A selected-domain read failure fails closed. The development
fixture derives its owned context on the server and does not turn arbitrary
client values into a synthetic ownership claim.

The baseline query and safety assessment runs before selected member context
is resolved. Emergency guidance therefore remains available even when the
authentication provider is unavailable. Ordinary selected-context requests
fail closed when identity cannot be established. Every successful response
influenced by private member context, plus its authentication and repository
failure responses, carries `Cache-Control: private, no-store, max-age=0`.
Public requests without selected member context retain their public response
boundary.

## Review and integration gate

The independent review initially returned `NO-SHIP` because successful
selected-context responses did not yet carry an explicit private/no-store
boundary. The single bounded correction applied that header to every
post-context response branch and added a behavioral success assertion. The
same reviewer then returned `SHIP`.

Focused verification passed 125 of 125 tests covering Ask member context,
safety, rate limiting, bounded request bodies, customer access, Shelf,
Routine, and the Me shell. TypeScript, documentation, scoped lint, formatting,
and whitespace verification passed.

The exact clean-snapshot release candidate passed the complete verifier: 1,720
tests ran, 1,716 passed, four expected environment tests were skipped, and
none failed. Lint reported zero errors and 20 existing warnings. Typecheck,
documentation, all 53 migration inventory files, catalogue projections,
publication records and images, and canonical assets passed. The Vercel build
repeated the same complete verification totals.

## Exact release proof

- Revision: `93df3a618c80af5bd64e646c26178af3d2f072d3`
- Commit: `fix: verify Ask member context ownership`
- Deployment: `dpl_DVfAwVqUp9WW3JXjXP9WJghF2ggK`
- Deployment URL: `jelo-5saa1auxl-drdyranes-projects.vercel.app`
- READY at: `2026-08-31T09:32:50Z`
- Production aliases: `www.jelocare.com`, `jelocare.com`

Vercel cloned `main` at exact commit `93df3a6`, completed the production build,
reported READY, and assigned the canonical aliases.

## Production verification

Read-only production smokes ran from 09:34:03 through 09:34:51 UTC:

- `/consult` rendered Ask JeloCare with HTTP 200 and the exact deployment ID;
- an ordinary public POST returned HTTP 200 with public sunscreen guidance;
- an emergency POST carrying forged member context returned the public
  `Get help now` interrupt, `safetyLevel: emergency`, and zero products before
  the unavailable authentication provider could block it;
- an ordinary POST carrying the same forged nonempty context returned HTTP 503
  with `private, no-store, max-age=0` and no report or products;
- signed-out `/me/consult` retained its exact safe continuation through the
  bounded recovery route; and
- signed-out `/ops` and `/ops/orders` remained HTTP 404 with private/no-store
  and noindex boundaries.

The deployment-scoped smoke window contained no HTTP 500 and no new uncaught
application-error signature. The deliberate probes produced one designed 503
and two concealed 404 responses.

At 09:37:05 UTC, a read-only sitemap crawl verified all 163 public product
pages on the same deployment. All 163 returned HTTP 200; the obsolete
dead-end care sentence appeared zero times; and every page rendered its exact
care-state presentation plus the editable `Tell Jelo what I'm noticing`
handoff. Counts remained 22 `supportive_eligible`, 39 `pharmacist_review`, and
102 `insufficient_data`. Two warmed-cache comparison rounds returned 163 of
163 cache hits with no state, prompt, action, redirect, presentation, ETag, or
obsolete-copy mismatch.

This global presentation proof does not promote the 102 evidence-pending
products. The exact `pharmacy-care-review/2026-08-31/v1` record remains
`reviewed_context_only` for its original 39-product cohort. Exact product or
formula evidence, claim-matched independent context, conflict reconciliation,
and a named human decision remain required for any stronger product-specific
disposition.

## Residual risks

Production still reports the external Neon data-transfer quota condition with
PostgreSQL code `53000`. Public and emergency Ask remained operational during
the smoke; selected private context returned the designed unavailable response.
Restoring provider capacity requires fresh spending or configuration authority
and was not attempted.

No sign-in, OTP, customer-row readout, export, deletion, cron, queue, retry,
cache operation, database mutation, secret/configuration change, or external
publication occurred. A fresh two-owner signed-in journey and destructive
export/deletion proof still require action-time authority after provider
capacity is restored.
