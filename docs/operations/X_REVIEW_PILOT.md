# X private review pilot

Updated: 2026-09-07

Status: disabled-by-default release candidate; not scheduled or sending. The
text-only pilot includes a campaign-only editorial review desk; it is not a
complete campaign automation engine. Production activation, authenticated store
access and inbox delivery require the separate acceptance checks below.

## Boundary

The protected `/api/cron/x-review` route uses JeloCare's app-only X bearer token
to look up `jelocare` and read at most five recent mentions, with public author,
parent context and engagement fields. It never searches keywords, downloads
media, posts, replies, likes, follows, reposts or sends DMs. Missing context,
unwatched media, possible private information and care concerns require manual
review. Care/private text is withheld from email and AI. Heuristic safety
filters are a cautious first screen, not a clinical classifier or approval.

AI drafting is a separately disabled switch. When enabled, one bounded Gateway
call uses `openai/gpt-5.4-mini`, structured output, no tools/retries, no input or
output telemetry, zero data retention and no prompt training. It drafts only
short, source-bound, claim-free text for an editor. No safe provider/output means
no draft; the report states failure instead of inventing one. Live Gateway
availability and the quality of real drafts still need verification.

The existing Market / Useful / Relatable recipients, schedule and archive are
unchanged. This pilot never uses their recipient fallback or public Blob paths.

## Configuration — server-only

| Variable                    | Purpose                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `JELOCARE_X_BEARER_TOKEN`   | Existing sensitive production app-only credential                                           |
| `JELOCARE_X_REPORT_EMAIL`   | Authorized campaign operator's verified sign-in email and private report inbox; no fallback |
| `JELOCARE_X_REVIEW_ENABLED` | Explicit `true` enables manual paid previews; default off                                   |
| `JELOCARE_X_AI_ENABLED`     | Explicit `true` permits private AI drafting; default off                                    |
| `JELOCARE_X_EMAIL_ENABLED`  | Explicit `true` permits exact-preview sends; default off                                    |
| `JELOCARE_X_PILOT_ENDS_AT`  | Required ISO deadline no more than seven days ahead; expired means stop                     |

Reuse the existing `CRON_SECRET`, Upstash credentials and transactional mailer.
The recipient remains only in protected deployment configuration, never in Git,
API responses or the private report record. Report destination binding uses the
existing `campaignRecipientKey` HMAC. Environment changes apply on deployment.

## Budget and coverage

Before any X/AI call, one atomic Redis reservation consumes a nonrefundable
pilot attempt. There are at most **six attempts for pilot-v1**, no more than one
per 12-hour UTC bucket, across previews and redeploys. No rolling refund or
automatic renewal exists. The six-attempt cap must not be deleted to retry a
failed run. Missing Redis or ambiguous state fails before paid calls.

Reserve a conservative **$0.25 per attempt ($1.50 total)** for X + one AI batch.
This is a local allowance estimate, not a provider billing receipt or hard
provider price guarantee. X's separately configured $10 billing-cycle cap and
disabled auto-recharge remain the outer guard. Gateway/hosting costs are
separate from X credits. Review current prices before activation.

The first slice rechecks the newest five mentions in a 48-hour window rather
than silently skipping older pages with a cursor. Overflow or incomplete source
data is visible in the report. It is **not a complete inbox monitor**. Repeated
empty checks still consume an attempt; empty reports are never emailed.

## Preview and exact-copy send

1. Deploy the reviewed revision with all three feature switches off. Do not
   deploy another lane's dirty checkout or infer live state from a local test.
2. Authorize one bounded preview; configure the recipient, deadline and review
   switch. Enable AI only with the approved inference budget/data arrangement.
3. `GET /api/cron/x-review` with `Authorization: Bearer <CRON_SECRET>` returns a
   private email preview, report ID and SHA-256. It never sends email. No query
   parameters, credentials in URLs, redirects or automatic X retries.
4. Inspect the exact subject/text/HTML, recipient and source freshness. Obtain
   explicit approval for the private test email; enable the email switch.
5. `POST` the same protected route with JSON `{ "reportId": "...", "sha256":
"..." }`. Only that stored, destination-bound, unchanged preview can send,
   within one hour. No new source fetch, AI draft or arbitrary recipient input
   occurs on send. No X action occurs.
6. Check the provider acceptance receipt, then verify the intended inbox and
   links. Provider acceptance is not proof of inbox delivery.

Reports expire from private Redis after 24 hours. Minimal intent/outcome hashes
and the six-attempt counter remain. Delivery atomically reserves the report and
its post IDs before transport. Ambiguous provider failure is not retried;
per-post reservations expire after seven days (outside the 48-hour source
window). Never erase a reservation to force another send.

Email replies do not execute commands. There is **no cron entry** or automatic
sender in this milestone. A recurring monitor, inbound approvals, source edit/
deletion reconciliation, paginated coverage and Zapshot workers are separate
follow-ups after a successful test. A recipient change invalidates old previews.

## Jelo's private editorial desk

`/campaign-review` is the manual preview entry point. It requires the same
verified campaign-email session as the report desk. Opening or refreshing it
only checks access; an explicit confirmed Server Action runs the existing capped
preview runner. Each action reauthorizes before any paid work. This entry point
forces AI and email off for its run, even if their environment switches are on.
It returns only a validated private report path and item count, not credentials,
recipient identifiers or an email-send capability. It never resets reservations
or retries automatically. Jelo can open the resulting report herself without
knowing or rotating the shared `CRON_SECRET`.

The exact root continuation `/campaign-review` is allowed through the existing
email-OTP sign-in. Arbitrary query strings and external continuations remain
rejected. Production still requires the review switch, protected credentials and
a valid pilot deadline; shipping this entry point does not activate them.

Dyrane is not an operational approval dependency. Jelo is the campaign operator
and can make editorial decisions independently. The protected inbox configuration
is the explicit campaign-only allowlist; it does not grant any Ops role or access
to customer records. This is an editorial permission, not an automatic publication
permission or a waiver of platform and care safeguards.

Each report email links to `/campaign-review/<report-id>`. Opening a link never
approves, sends, generates or publishes anything. The existing Neon email-OTP
sign-in returns to that exact, validated local path. The server requires a real
verified session email matching the configured campaign inbox, plus the report's
recipient HMAC. Every action rechecks access; no customer fixture identity, Ops
invitation claim, email command or token embedded in a link grants access.

The desk displays source context and the exact text-only reply. Jelo can save
copy, record a change request, approve saved copy, skip or reopen a decision.
Change requests are **stored, not automatically redrafted yet**. Approval requires
confirmation that the live thread/context and existing replies were checked.
Care, private information, missing context and unwatched media remain held; the
editor cannot turn them into ordinary approvals here.

Editorial state is separate from the immutable email report. Every decision
records the verified actor, source, exact copy hash and a monotonically increasing
version. Atomic compare-and-set rejects stale tabs and replayed decisions and
requires the original report to still exist unchanged. The separate editorial
key inherits at most the report's remaining 24-hour retention; reads do not
extend it. Decisions close after one hour from source collection. Reopening
clears approval; editing requires a new approval. No X publisher consumes this
state yet, and no approval is a publication receipt.

The new email link changes the email-preview hash. Discard any older unsent
preview approval and inspect a fresh exact preview before a test send.

### Acceptance boundary and next prerequisites

Local domain/access tests and actual-component browser checks are not proof of
Neon login, Redis script execution, email delivery or publication. Live proof
still requires the exact reviewed deployment, Jelo's real OTP/inbox/session loop,
and an attested private store test. Do not claim a full test while these are absent.

The remaining independent-engine cells are durable collection/queueing,
automatic drafting and requested revisions, permitted publishing with X user
authorization and platform approval where required, read-back receipts, and
rights-cleared Zapshot jobs with original audio and visual QA. Automatic public
replies remain disabled. Unsolicited trend replies cannot be converted into an
auto-reply lane by keyword search. Routine automation should reduce operator
work, but safety and platform holds must remain visible rather than silently
published or escalated back to an unavailable Dyrane.

## Verification

```sh
node node_modules/tsx/dist/cli.mjs --test modules/campaigns/x-review*.test.ts
node node_modules/tsx/dist/cli.mjs scripts/preview-x-review.ts
```

The second command renders an explicitly fictional, offline layout sample with
disabled source links. It does not prove API, AI or email connectivity. Review
mobile legibility separately from focused unit tests.

Editorial cell evidence (local, 2026-09-07): 49 combined pilot/access/member
continuation tests passed; typecheck and documentation checks passed. Scoped
lint returned no errors and one pre-existing sign-in navigation warning. One
independent review found no blocking defect. The actual ReviewDesk component
passed 19 browser interaction checks at 1280, 390 and 320px in light/dark,
including pending feedback, retained edits on failure, saved-copy approval,
reopening, safety holds and expiry. The isolated harness used synthetic actions
and font stand-ins: this is not an authenticated Next/Neon/Redis integration or
production test. Redis Lua execution remains unverified without an attested
store; static script assertions are not that proof.

## Platform constraints

- [X automation rules](https://help.x.com/en/rules-and-policies/x-automation):
  AI automatic replies require X's prior written approval. No website-scripted
  posting or unsolicited keyword-based auto-replies.
- [Timeline integration](https://docs.x.com/x-api/posts/timelines/integrate):
  public mentions support app-only auth; private metrics require user context.
- [X pricing](https://docs.x.com/x-api/getting-started/pricing): current standard
  post/user read rates, possible owned-read discounts and daily deduplication.
  Budget estimates do not depend on discounts or deduplication.

Zapshots continue to require exact screenshot/source alignment, channel-specific
reuse authority, static identity/thread pixels, source audio when present,
mobile QA and explicit publication approval. This pilot produces no Zapshots
and never claims to have watched or licensed source media.
