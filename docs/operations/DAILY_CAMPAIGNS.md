# Daily campaign handoff

Updated: 2026-08-22

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

## Evidence and rotation

The selector reads the current `/share` ranked pool. It does not use clicks,
campaign engagement, paid attribution, store ordering, or customer data.

A product passes only when:

- its current public product agrees with one published dossier and release;
- its exact identifier, brand, name, size, package and approved packshot agree;
- the packshot bytes match the recorded SHA-256 and dimensions;
- at least one fresh, exact, evidence-bound Nigerian offer passes the shared
  shareability gate; and
- no accepted production delivery used the product during the previous 14
  days.

The existing Next/OG story route renders three deterministic 1080 × 1920 dark
masters from the same exact product and offer evidence:

1. **Proof** — the current price range or same-retailer trend.
2. **Use** — the product inside JeloCare's current mobile comparison interface.
3. **Remember** — a restrained market-note treatment that keeps the observed
   price context memorable without implying a transaction or saving.

The campaign lane verifies PNG type, geometry and SHA-256 for every creative
before archiving the packet. It does not run browser automation or generative
image creation inside the daily production cron.

## Lagos Daily Desk

`/lagos` is a public, read-only projection of the day's accepted production
campaign. It never reads preview or test runs. The projection resolves the
accepted-production index for the current `Africa/Lagos` calendar date and
publishes only the product identity, campaign copy, exact `/share/<slug>` CTA,
verified **Proof** image, evidence count, evidence boundary, and checked-at
time. The Use and Remember creatives remain in the private operator packet.

The projection fails closed. A missing ledger, missing accepted campaign,
invalid action URL, stale campaign date, non-positive offer price, non-share-
ready evidence boundary, unverified asset, or non-deterministic creative shows
a non-price skin-guide state instead. Delivery details, recipient markers,
operator data, rejected candidates, and campaign captions are not projected.

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
  scored accepted-production index drives the 14-day rotation and authorizes
  the minimal `/lagos` Proof projection. Separate aggregate Daily Desk counters
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
   receives exactly one packet, and `/lagos` still projects only Proof.

Changing an environment variable affects only a subsequent deployment. Never
put recipient addresses, credentials, Blob/Redis tokens, or raw recipient
identifiers in source, logs, campaign records, or screenshots.
