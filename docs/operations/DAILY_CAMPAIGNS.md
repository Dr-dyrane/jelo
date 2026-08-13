# Daily campaign handoff

Updated: 2026-08-13

The daily campaign lane prepares one evidence-bound story and emails it to the
authorized operator. It does not post to WhatsApp, Instagram, Snapchat, or an ad
account.

## Schedule and states

Vercel calls `/api/cron/daily-campaign` at `07:00 UTC`, which is `08:00` in
`Africa/Lagos`. The route requires the exact `CRON_SECRET` bearer credential.

The scheduled production path is fail-closed while
`CAMPAIGN_DAILY_ENABLED` is not `true`.

| State      | Invocation                  | Effect                                                                                                                        |
| ---------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Preview    | `?mode=preview&iteration=N` | Select, render, validate, and archive; never resolve or email a recipient                                                     |
| Test       | `?mode=test&iteration=N`    | Send once to `CAMPAIGN_TEST_EMAIL` after an immutable delivery reservation                                                    |
| Production | no query                    | When enabled, resolve exactly one active operator by `CAMPAIGN_DAILY_OPERATOR_EMAIL` and send once for the Lagos calendar day |

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

The existing Next/OG story route renders the 1080 × 1920 dark master. The
campaign lane verifies PNG type, geometry and SHA-256 before archiving it.

## Durable trail

The campaign trail uses the stores already attached to the project:

- Vercel Blob holds the immutable, content-addressed story PNG. It is
  public-by-URL because the email provider embeds it and contains only
  already-public product and share-ready offer information.
- Upstash Redis holds the private append-only campaign record, story checksum,
  delivery intent and accepted/failed outcome. `SET NX` is the one-send
  reservation; a scored accepted-production index drives the 14-day rotation.

Redis keys and records contain source facts, evidence boundary, copy and
creative, but never the raw recipient email or database operator id. The only
recipient marker is an HMAC keyed by the server-only `CRON_SECRET`.

## Activation gate

1. Deploy with `CAMPAIGN_DAILY_ENABLED=false`.
2. Run one protected preview and inspect the full-resolution image, exact copy,
   evidence boundary, sources and checked-at time.
3. Obtain explicit approval for the test email, then invoke the test mode once.
4. Confirm the intended mailbox received the exact artifact and the private
   accepted-delivery ledger record exists.
5. Obtain explicit production activation approval. Configure the exact active
   operator mailbox, set `CAMPAIGN_DAILY_ENABLED=true`, and deploy the changed
   environment.

Changing an environment variable affects only a subsequent deployment. Never
put recipient addresses, credentials, Blob/Redis tokens, or raw recipient
identifiers in source, logs, campaign records, or screenshots.
