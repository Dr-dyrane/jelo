# Daily campaign handoff

Updated: 2026-09-04

The daily campaign lane prepares one evidence-bound review packet and privately
emails it to the three configured campaign operators. It does not post to
WhatsApp, Instagram, Snapchat, or an ad account.

## Schedule and states

Vercel calls `/api/cron/daily-campaign` at `07:00 UTC`, which is `08:00` in
`Africa/Lagos`. The route requires the exact `CRON_SECRET` bearer credential.

The scheduled production path is fail-closed while
`CAMPAIGN_DAILY_ENABLED` is not `true`.

| State      | Invocation                  | Effect                                                                                                                                            |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview    | `?mode=preview&iteration=N` | Select, render, validate, and archive all three creatives; never resolve or email a recipient                                                     |
| Test       | `?mode=test&iteration=N`    | Privately send one packet to `CAMPAIGN_TEST_EMAIL` after an immutable recipient-specific reservation                                              |
| Production | no query                    | When enabled, resolve exactly three active operators from `CAMPAIGN_DAILY_OPERATOR_EMAILS_JSON` and send one separate private copy to each person |

Use a new bounded iteration for a materially changed preview or test. Retrying
the same iteration after a delivery intent exists is deliberately suppressed;
Hostinger does not provide a send-idempotency contract.

## Exception alert

An unhandled production run exception emits the structured
`daily_campaign_cron_failed` log and sends one critical transactional alert to
the existing campaign-alert recipient policy (`CAMPAIGN_ALERT_EMAIL`, then
`INVENTORY_ALERT_EMAIL`, then `hello@jelocare.com`). The alert contains only a
bounded sanitized failure code, production mode, timestamp, and a generic
operator message. It never contains the raw error, stack trace, recipient
addresses, credentials, campaign drafts, product or customer data, or database
details. Missing mail configuration skips delivery; provider failure is logged
without changing the cron route's original `500` response.

This exception alert is separate from the no-candidate alert. No-candidate
runs completed normally and report selector coverage and rejection blockers;
exception alerts mean the production run itself failed. Neither path changes
the exact-three-active-operator rule for daily review packet delivery.

## Daily deliverable

Every successful run prepares exactly three independent 1080 × 1920 review
drafts:

1. **Market** — one exact current product price or price movement when every
   evidence gate passes.
2. **Useful** — one rotating, factual JeloCare service or care-navigation
   explanation, such as the bundle finder, guest shopping, fee transparency,
   concerns or My JeloCare.
3. **Relatable** — one restrained, brand-safe observation about the shopping or
   care experience. This is the controlled meme lane: no person is targeted,
   no diagnosis or outcome is implied, and no product or price fact is invented.

The internal archive roles remain `proof`, `use`, and `remember` for historical
record compatibility. Operator-facing language is Market, Useful, Relatable.
The three drafts are not cosmetic variants of one product.

When no product passes the fresh-price gates, the run still creates a complete
packet. With zero fresh candidates, Market says **“No fresh price. No price
claim.”** If fresh candidates exist but cooldown or publication checks block all
of them, Market instead says **“No price story today.”** Both states record the
catalogue coverage that was checked and contain no product, retailer or price
claim. Useful and Relatable continue their deterministic rotation. This
fallback is never eligible for the public Lagos Daily Desk.

## Evidence, catalogue coverage and rotation

The selector starts from the complete current public catalogue, then reads the
current `/share` ranked pool. Every brand and product is considered; DANG (or
any other brand) has no preference or hard-coded slot. The operator email shows
both the total public catalogue count and the number of fresh price candidates
so a narrow evidence pool cannot look like a brand decision.

“All products are considered” does not mean “all products may show a price.” A
current price is permitted only for a product with current evidence. Products
with stale, missing, ambiguous or identity-drifted evidence remain in the
catalogue but cannot become the Market creative until the inventory workflow
re-verifies them. The campaign lane never refreshes or mutates catalogue prices.
It does not use clicks, campaign engagement, paid attribution, store ordering,
or customer data.

A product passes only when:

- its current public product agrees with one published dossier and release;
- its exact identifier, brand, name, size, package and approved packshot agree;
- the packshot bytes match the recorded SHA-256 and dimensions;
- at least one fresh, exact, evidence-bound Nigerian offer passes the shared
  shareability gate; and
- no accepted production delivery used the product during the previous 14
  days.

The existing product story route renders the evidence-bound Market master. A
separate deterministic Next/OG editorial renderer creates Useful and Relatable
from a reviewed rotation bank. The production cron performs no generative-AI
copy or image work, so the reviewed wording and geometry do not drift between
runs.

The campaign lane verifies PNG type, geometry and SHA-256 for every creative
before archiving the packet. It does not run browser automation or generative
image creation inside the daily production cron.

## Lagos Daily Desk

`/lagos` is a public, read-only projection of the day's accepted Daily Desk
record. It never reads preview or test runs. The dedicated Desk reconciler runs
at minute 42 of each hour, after the inventory refresh window. It uses the
same exact-product, dossier, image, and fresh-offer gates as the campaign
selector, but does not use email/social rotation cooldowns: the Desk is current
market context, while the operator packet is a separately rotated delivery.

When `DAILY_DESK_RECONCILIATION_ENABLED=true`, the reconciler accepts at most
one evidence-qualified Market record for an `Africa/Lagos` date. The per-date
`SET NX` record is immutable, revalidated at `/lagos`, and contains no delivery
or recipient information. It never resolves recipients, reserves a campaign
delivery, sends email, posts to a social channel, creates a retailer, or admits
a new offer. An early email-only editorial fallback therefore cannot prevent a
later verified offer observation from making the Desk ready.

The projection publishes only product identity, campaign copy, exact
`/share/<slug>` CTA, verified **Market** image, evidence count, evidence
boundary, and checked-at time. Useful and Relatable remain in the private
operator packet. Editorial fallbacks are ineligible for the Desk, so a no-price
day cannot masquerade as public price evidence.

The projection fails closed. A missing ledger, missing accepted campaign,
invalid action URL, stale campaign date, non-positive offer price, non-share-
ready evidence boundary, unverified asset, or non-deterministic creative shows
a non-price skin-guide state instead. Delivery details, recipient markers,
operator data, rejected candidates, and campaign captions are not projected.

At the Lagos calendar rollover, the page may carry forward only the immediately
previous day's accepted production Desk until the current day's accepted Desk
exists. It keeps the original campaign date and checked-at time visible and is
labelled as the latest accepted price context, not today's context. Listing and
evidence copy is explicitly framed as the state at that last review rather than
as a current-price claim. A malformed current record never falls back, and
records older than the previous Lagos calendar day are never reused.

The page records only two private aggregate counters: `view` and
`compare_click`. The write-only route accepts the current public campaign id
after a same-site and bounded-body check. It does not read or store cookies,
IP addresses, user agents, referrers, sessions, or person identifiers. Counters
expire after 90 days, have a global non-identifying abuse ceiling, are never
publicly readable, and never feed product, offer, retailer, or care ranking.

## Durable trail

The campaign trail uses the stores already attached to the project:

- Vercel Blob holds the three immutable, content-addressed story PNGs. They are
  public-by-URL because the email provider embeds them and they contain only
  already-public product and share-ready offer information.
- Upstash Redis holds the private append-only campaign record, three-file
  checksum manifest, recipient-specific delivery intents, and recipient-
  specific accepted/failed outcomes. `SET NX` is the one-send reservation; a
  scored accepted-production index drives the 14-day operator-packet rotation.
  A separate Daily Desk archive namespace and immutable, date-scoped acceptance
  record authorize the minimal `/lagos` Market projection. This prevents an
  earlier failed operator-packet archive with the same campaign id from
  supplying an older market snapshot. Separate aggregate Daily Desk counters
  retain only date, public campaign id, and event kind.

Redis keys and records contain source facts, evidence boundary, copy and
creative metadata, but never a raw recipient email or database operator id.
Every delivery reservation and outcome uses only an HMAC keyed by the
server-only `CRON_SECRET`. Operators receive separate messages; their addresses
are never exposed to one another.

## Activation gate

1. Deploy with `CAMPAIGN_DAILY_ENABLED=false`.
2. Run one protected preview and inspect all three full-resolution images,
   exact product identity, UI, copy, evidence boundary, sources, checked-at
   time, and checksums.
3. Obtain explicit approval for the test email, then invoke the test mode once.
4. Confirm the intended mailbox received one complete, legible packet; verify
   every download/action link and the private accepted-delivery ledger record.
5. Obtain explicit production activation approval. Configure exactly three
   active operator mailboxes in `CAMPAIGN_DAILY_OPERATOR_EMAILS_JSON`, set
   `CAMPAIGN_DAILY_ENABLED=true`, and deploy the changed environment.
6. Verify the next run reports three accepted private deliveries, each mailbox
   receives exactly one packet, and `/lagos` still projects only an evidence-
   eligible Market creative.
7. Separately inspect a rendered evidence-qualified Desk candidate, obtain
   public-projection activation approval, set
   `DAILY_DESK_RECONCILIATION_ENABLED=true`, and deploy the changed
   environment. Verify one protected reconciliation accepts a current record,
   sends no email, and refreshes `/lagos`.

Changing an environment variable affects only a subsequent deployment. Never
put recipient addresses, credentials, Blob/Redis tokens, or raw recipient
identifiers in source, logs, campaign records, or screenshots.

## Current state (2026-08-23)

The daily campaign is running but **finds no eligible candidate**. Every
product is rejected with `no-fresh-shareable-ng-offer` or
`sent-within-14-day-cooldown`. The Lagos Daily Desk shows the "Today's note is
being checked" fallback.

This is not a campaign bug — the selector correctly fails closed when no
product has fresh, shareable Nigerian offer evidence. The root cause is the
inventory cron blackout. See the
[product roadmap](../product/ROADMAP.md#catalogue-and-evidence-debt-2026-08-23)
and the
[troubleshooting entry](../catalogue/TROUBLESHOOTING.md#inventory-cron-failure--stale-offers-and-campaign-blackout-2026-08-23)
for the recovery plan.
