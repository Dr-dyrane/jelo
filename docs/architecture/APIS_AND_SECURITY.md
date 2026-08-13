# APIs and security

Updated: 2026-08-13

Route handlers validate at the boundary, keep secrets server-only, and fail closed when durable storage or required credentials are unavailable.

## Route catalogue

| Route                                        | Method       | Purpose                              | Main controls                                                                                                                                                       |
| -------------------------------------------- | ------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/consult`                               | `POST`       | Guided skin education                | Browser provenance check, 64 KiB body, Zod bounds, deterministic safety gate, filtered catalogue, production-fail-closed Upstash limit                              |
| `/api/products/suggestions`                  | `GET`        | Bounded public catalogue typeahead   | Minimal public projection, normalized 2–120 character query, indexed Neon lookup, market allowlist, seven-result cap, short shared cache, hashed-network read limit |
| `/api/contribute/drafts`                     | `POST`       | Start anonymous draft                | Same-site check, honeypot, rate limit, PostgreSQL requirement                                                                                                       |
| `/api/contribute/drafts/[id]`                | `PUT`        | Save draft and events                | HttpOnly edit secret, optimistic revision, 64 KiB body                                                                                                              |
| `/api/contribute/drafts/[id]/submit`         | `POST`       | Submit contribution                  | Edit secret, UUID idempotency key, rate limit, final schema                                                                                                         |
| `/api/retailers/applications`                | `POST`       | Start retailer application           | Same-site check, consent, honeypot, rate limit, PostgreSQL                                                                                                          |
| `/api/retailers/applications/[id]`           | `GET`, `PUT` | Restore or save retailer application | HttpOnly private token, optimistic revision                                                                                                                         |
| `/api/retailers/applications/[id]/send-link` | `POST`       | Resend private link                  | Edit secret, rate limit, mail availability                                                                                                                          |
| `/api/retailers/applications/[id]/submit`    | `POST`       | Submit retailer application          | Edit secret, UUID idempotency key, final schema                                                                                                                     |
| `/api/retailers/magic`                       | `GET`        | Open and verify private link         | Token hash, expiry, rate limit, HttpOnly cookie                                                                                                                     |
| `/api/orders`                                | `POST`       | Create one retailer-scoped order     | Same-site check, bounded exact lines, server-recomputed offers, rate limit, hashed guest capability, no-store response                                              |
| `/api/orders/current`                        | `GET`        | Read current guest order             | Order-scoped HttpOnly capability, expiry, private no-store response                                                                                                 |
| `/api/orders/current/decision`               | `POST`       | Approve or decline exact quote       | Guest capability or server-derived owner, quote version, optimistic order revision, expiry, rate limit                                                              |
| `/api/orders/recovery`                       | `POST`       | Request replacement recovery link    | Generic response, reference/email match, replacement invalidates prior unused capabilities, rate limit                                                              |
| `/api/orders/recover`                        | `GET`        | Exchange one-time recovery link      | Hashed token, atomic consume, session rotation, clean redirect, no-store/no-referrer                                                                                |
| `/api/cron/inventory`                        | `GET`        | Refresh due retail offers            | Bearer `CRON_SECRET`, bounded batch                                                                                                                                 |
| `/api/cron/daily-campaign`                   | `GET`        | Prepare and email one campaign draft | Bearer `CRON_SECRET`, disabled-by-default production gate, dossier/share evidence gate, immutable Redis send reservation, exact active-operator resolution          |
| `/go`                                        | `GET`        | Outbound retailer redirect           | Allowlisted offer lookup and attribution logic                                                                                                                      |

JeloCare Me Shelf mutations are authenticated server actions rather than public
API routes. `/me/shelf/export` is an authenticated, private, no-store download.
Each derives the verified owner on the server; neither accepts an owner in a
path, query, form, or JSON body.

## Shared controls

- Zod schemas normalize and bound all submitted fields.
- JSON request bodies are limited to 64 KiB in intake lanes.
- Same-site mutations validate `Origin` or Fetch Metadata through `lib/community-intake/request-origin.ts`.
- Edit secrets are random, stored only as SHA-256 hashes, and transported in scoped HttpOnly cookies.
- Magic-link redirects remove the token immediately and set a no-referrer policy.
- Upstash keys are HMAC-derived from network addresses. Raw addresses are not stored by the limiter.
- Create, save, submit, and magic-link actions have separate limits.
- Optimistic revisions prevent silent draft overwrites.
- Submission keys make final submissions retry-safe.
- Database writes that create derived knowledge or events use transactions.
- Public errors stay concise; server logs must not print secrets or full submitted payloads.
- Daily campaign records keep recipient email out of Blob, Redis, and logs. The
  private Redis delivery trail stores only a `CRON_SECRET`-keyed recipient HMAC;
  the production mailbox must resolve to exactly one active operator before send.
- Private Shelf operations use a dedicated exact-role connection, transaction-
  local owner context, an explicit owner predicate, and enabled plus forced
  PostgreSQL RLS. Missing or unsafe role attestation fails closed.
- Catalogue suggestions query indexed public search text and approved GTIN fields, then fail over to a deterministic checked-in projection containing only slug, brand, name, size, approved GTIN, and source. They never import or expose private candidates, community drafts, moderation records, dossiers, or the 1,000-record discovery queue.
- Catalogue suggestion reads use a hashed network key with a lightweight Upstash window. Missing Redis configuration is the only fail-open state; partial configuration and provider failures return `429` with `Retry-After`.
- Ask Jelo uses a separate 20-request-per-hour Upstash window and an HMAC-derived network key. Production denies requests when Redis configuration is missing or the configured provider is unavailable; local development may run without Redis.

## Data classification

| Data                                                     | Classification                 | Rule                                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public product and retailer records                      | Public                         | Publish only through the relevant evidence gate                                                                                                          |
| Community submissions                                    | Internal, anonymous            | Aggregate for research; do not present as verified fact                                                                                                  |
| Retailer applications                                    | Confidential business data     | Restrict to operations; retain only as documented                                                                                                        |
| Customer Shelf rows and exports                          | Private customer data          | Owner-derived access only; never send to Operations, analytics, public caches, advertising, community research, or model training                        |
| Order basket, contact, address, quotes, and events       | Private customer/order data    | Order-scoped guest capability or verified owner/operator only; never public cache, analytics payload, advertising, community research, or model training |
| Edit and magic-link tokens                               | Secret                         | Never log or store in plaintext                                                                                                                          |
| Email, phone, address                                    | Personal/business contact data | Use only with recorded consent                                                                                                                           |
| Campaign draft and delivery records                      | Internal operations data       | Private Redis ledger; omit raw recipient email, operator id, and all click-level data                                                                    |
| Database, Blob, Redis, mail, and third-party credentials | Secret                         | Server-only environment variables                                                                                                                        |

The database owner and `MIGRATION_DATABASE_URL` are not application secrets and
must not exist in Vercel. Production Vercel receives only the restricted
`jelocare_app_runtime` and `jelocare_shelf_runtime` connections. Role grants,
attestation, import, retention, and the honest rollback floor are owned by
[ADR 0014](../adr/0014-customer-shelf-data-boundary.md).

## Ask Jelo boundary

Ask Jelo is deterministic and does not call a language model.

- The server decides whether the journey can continue.
- Condition routes return a canonical, reviewed guide and no products.
- Everyday-care routes may return only products that pass reviewed concern, body-area and routine-step authority.
- The public response contains presentation data only. Clinical rules, scores, internal evidence identifiers and recommendation diagnostics stay server-side.
- Any future language-model wording lane requires a separate reviewed safety, privacy, abuse and cost boundary before implementation.

## Known controls to preserve

- `CRON_SECRET` must exist in production and be at least 16 characters. `isAuthorizedCronRequest` rejects shorter secrets, causing the inventory, reconcile-requests, and daily-campaign crons to return 401. See [Troubleshooting: Inventory cron is not running](../catalogue/TROUBLESHOOTING.md#inventory-cron-is-not-running).
- `APP_DATABASE_URL` must be set in Vercel Production with the `jelocare_app_runtime` role. The Neon Vercel integration auto-generates `DATABASE_URL` with the `neondb_owner` role, which `applicationDatabaseUrl()` rejects in production. `APP_DATABASE_URL` takes precedence and bypasses the override. See [NEON.md](../data/NEON.md#neon-vercel-integration-and-app_database_url).
- Non-consult public limiters retain their documented local/failover behavior. Ask Jelo specifically requires Upstash in production and fails closed.
- The Agentic Mail API token is preferred. SMTP remains a mailbox-password fallback.
- Magic links expire after 30 days; retailer application retention is 24 months in the current migration.

Security changes should include abuse-path tests, not only happy-path route tests.
