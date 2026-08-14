# Environments

Updated: 2026-08-13

Use the same names across local development, Vercel Preview, and Vercel Production. Values differ; contracts do not.

## Local setup

```bash
cp .env.example .env.local
```

Or link and pull the Vercel project:

```bash
vercel link
vercel env pull .env.local
```

Never commit `.env*`, `.vercel/`, tokens, or connection strings.

## Operator CLI baseline

An operator workstation is ready only when the repository can resolve:

```bash
git --version
gh --version
node --version
npm --version
vercel --version
neonctl --version
rg --version
jq --version
```

`gh`, `vercel`, and `neonctl` also need an authenticated local profile for the
operation being run. Authentication state and connector access are separate:
confirm the exact CLI before relying on it in a runbook. Never place CLI tokens
in shell history, documentation, screenshots, or committed environment files.

Use the repository package scripts for application work. Global CLIs are for
provider operations; they do not replace checked-in dependencies or release
verification.

## Variable contract

### Application

| Variable               | Required   | Notes                                                 |
| ---------------------- | ---------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Production | Canonical origin and retailer magic-link origin       |
| `CATALOGUE_SOURCE`     | Yes        | `static` or `neon`; Neon reads retain static fallback |

Ask Jelo is deterministic and currently has no model provider or model-selection
environment variable. Any future language-only lane requires a separate
reviewed boundary before a provider credential is added.

### PostgreSQL

| Variable                      | Required                          | Notes                                                                                                                                                                                                                                                      |
| ----------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_DATABASE_URL`            | Production runtime data features  | Pooled postgres.js URL whose username is exactly `jelocare_app_runtime`; require `sslmode=verify-full` and omit `channel_binding`. This is the only general database URL configured in Vercel Production.                                                        |
| `DATABASE_URL`                | Not permitted in Vercel           | Must be absent from every Vercel scope because a provider integration can reconstruct it with an owner role. Local development may use this compatibility name only when it resolves to exact `jelocare_app_runtime`.                                      |
| `CUSTOMER_SHELF_DATABASE_URL` | Private Shelf and Routine runtime | Pooled postgres.js URL whose username is exactly `jelocare_shelf_runtime`; require `sslmode=verify-full`, omit `channel_binding`, server-only                                                                                                              |
| `POSTGRES_URL`                | Compatibility only                | If retained, it must satisfy the same driver and exact app-role contract, never point to an owner or administrator                                                                                                                                         |
| `NEON_PROJECT_ID`             | Operator convenience              | Not read by application runtime                                                                                                                                                                                                                            |
| `CRON_SECRET`                 | Production cron endpoints         | Bearer token for `/api/cron/inventory`, `/api/cron/reconcile-requests`, and `/api/cron/daily-campaign`. Must be at least 16 characters; `isAuthorizedCronRequest` rejects shorter secrets.                                                                 |

`MIGRATION_DATABASE_URL` is deliberately not a Vercel environment variable. A
protected operator process injects one direct, non-pooled administrator URL for
migrations and explicit database reconciliation, then removes it. Do not save
it in `.env.local`, Vercel, source, command history, logs, screenshots, or a
release evidence file.

The one-off Shelf import also reads
`JELOCARE_SHELF_IMPORT_OWNER_SUBJECT`. It belongs only in that protected
operator process, is never committed or configured in Vercel, and must be
removed after the receipt-guarded apply.

The owned Neon resource remains available to protected operators, but it must
not be connected to the Vercel project because that connection can recreate an
owner-bearing `DATABASE_URL`. Neon Auth variables are configured explicitly in
their reviewed scopes instead of relying on the database integration.

Delete unused Neon/Vercel compatibility variables. In particular, do not leave
an owner credential reconstructable from `DATABASE_URL_UNPOOLED`,
`POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`, `POSTGRES_*`, `PG*`, or a
provider integration after configuring the two restricted runtime URLs. No
database URL belongs in browser code.

Do not inject a provider URL containing the postgres.js-unsupported
`channel_binding=require` parameter. Remove the entire `channel_binding` query
field while retaining `sslmode=verify-full`; a TLS or connection failure must
not be handled by weakening verification. Before Vercel receives a candidate
URL, the protected operator must use postgres.js to prove exact `current_user`
and `session_user` for the app role and pass the read-only Shelf role audit. See
the [Shelf release runbook](./RUNBOOKS.md#release-the-customer-shelf-boundary).

### Media

| Variable                  | Required                                                                                                                        | Notes                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN`   | Asset writes, daily campaign story archive, production asset operators, and the protected private product-request cleanup drain | Server-only; app runtime requires it for the daily campaign image archive; protected operators inject it only where otherwise documented |
| `BLOB_STORE_ID`           | Provider metadata                                                                                                               | Not read by the current runtime                                                                                                          |
| `BLOB_WEBHOOK_PUBLIC_KEY` | Future webhook verification                                                                                                     | Not read by the current runtime                                                                                                          |

### Rate limiting

| Variable                                 | Required                               | Notes                                                                                       |
| ---------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `KV_REST_API_URL`                        | Every production-mode Ask Jelo runtime | Upstash REST URL; required in Vercel Production, Vercel Preview, and local `next start`     |
| `KV_REST_API_TOKEN`                      | Every production-mode Ask Jelo runtime | Upstash REST token; required in Vercel Production, Vercel Preview, and local `next start`   |
| `CONSULT_RATE_LIMIT_SECRET`              | Recommended                            | Dedicated server-only HMAC salt for Ask Jelo network keys; otherwise a database URL is used |
| `COMMUNITY_INTAKE_RATE_LIMIT_SECRET`     | Recommended                            | HMAC salt; otherwise a database URL is used                                                 |
| `RETAILER_PARTNERSHIP_RATE_LIMIT_SECRET` | Recommended                            | Separate HMAC salt                                                                          |
| `ASSISTED_ORDER_RATE_LIMIT_SECRET`       | Recommended                            | Separate server-only HMAC salt for guest order create, read, decision, and recovery limits  |
| `LOCATION_RATE_LIMIT_SECRET`             | Recommended                            | Separate server-only HMAC salt for Nigeria address-suggestion traffic                       |

Ask Jelo fails closed in every production-mode runtime when either required
Upstash REST value is missing or the configured limiter is unavailable. Vercel
Production and Preview must therefore receive both values; a local
`next start` run must also provide them. Only `next dev` and tests may run
without Upstash. `CONSULT_RATE_LIMIT_SECRET` also falls back to a database URL
for compatibility, but deployed environments should use the dedicated value.

The daily campaign lane also requires `KV_REST_API_URL` and
`KV_REST_API_TOKEN` for its private append-only record, delivery reservation,
outcome trail, and accepted-production rotation index. It fails closed when
either value is absent. `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, and `REDIS_URL`
remain compatibility values and are not used by the current runtime.

### Location suggestions

| Variable           | Required                       | Notes                                                                                                                                                                                                          |
| ------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GEOAPIFY_API_KEY` | Smart address suggestions only | Server-only Geoapify key. Never prefix with `NEXT_PUBLIC`. Without it, JeloCare falls back to Mapbox, then OpenStreetMap Nominatim. Both checkout and `/me/locations` retain complete manual entry regardless. |
| `MAPBOX_TOKEN`     | Smart address suggestions only | Server-only Mapbox access token. Never prefix with `NEXT_PUBLIC`. Tried after Geoapify and before OpenStreetMap Nominatim. Without it, JeloCare falls back to Nominatim.                                       |

The address-suggestion route is same-site, Nigeria-filtered, no-store, and
bounded by the shared Upstash runtime. The provider chain is:
Geoapify → Mapbox → OpenStreetMap Nominatim. Each provider is tried only when
configured; if it fails or returns no results, the next is attempted.
JeloCare rate-limits Geoapify to 4 req/s, Mapbox to 10 req/s, and Nominatim
to 1 req/s, limits each network to 30 requests per minute, and debounces
typing. Exceeding or losing all providers reduces convenience but never
blocks checkout. Typed address fragments leave JeloCare for the active
provider only after four characters; the UI states this boundary and shows the
correct attribution next to the field.

### Email

| Variable                        | Required               | Notes                                                         |
| ------------------------------- | ---------------------- | ------------------------------------------------------------- |
| `EMAIL_PROVIDER`                | Retailer magic links   | `hostinger-api` preferred; `hostinger-smtp` fallback          |
| `EMAIL_API_TOKEN`               | Hostinger API delivery | Mailbox-scoped Agentic Mail token                             |
| `EMAIL_SMTP_PASSWORD`           | SMTP fallback only     | Mailbox password, never an API token                          |
| `EMAIL_FROM_ADDRESS`            | Recommended            | Auth username; defaults to `hello@jelocare.com`               |
| `EMAIL_FROM`                    | Recommended            | Display sender                                                |
| `EMAIL_REPLY_TO`                | Recommended            | Reply destination                                             |
| `CAMPAIGN_TEST_EMAIL`           | Campaign test only     | Explicit test mailbox; never written to campaign records      |
| `CAMPAIGN_DAILY_OPERATOR_EMAIL` | Campaign production    | Must resolve to exactly one active `moderation_operators` row |

Create the API token under hPanel → Emails → the domain → Agentic mail → API.
The mailer resolves the configured sender against `/api/v1/me` before sending.
A general Hostinger account API token is not a mail token, and a mail API token
is not an SMTP password.

### Scheduled and release operations

| Variable                        | Required                | Notes                                                     |
| ------------------------------- | ----------------------- | --------------------------------------------------------- |
| `CRON_SECRET`                   | Production              | Bearer secret for every `/api/cron/*` route               |
| `CAMPAIGN_DAILY_ENABLED`        | Daily campaign          | Exact `true` activates delivery; every other value is off |
| `CAMPAIGN_TEST_EMAIL`           | Protected campaign test | Test-only destination                                     |
| `CAMPAIGN_DAILY_OPERATOR_EMAIL` | Campaign production     | Exact active operator mailbox; no fallback recipient      |

### Inventory refresh sync

| Variable                        | Required               | Notes                                                                                                                                              |
| ------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVENTORY_AI_EXTRACTION`       | AI extraction fallback | Exact `true` enables the AI Gateway extraction fallback. Disabled by default.                                                                      |
| `INVENTORY_AI_EXTRACTION_MODEL` | AI extraction fallback | Gateway model identifier, e.g. `google/gemini-2.5-flash-lite`. Required when `INVENTORY_AI_EXTRACTION` is `true`.                                  |
| `STATIC_FILE_SYNC_ENABLED`      | Static file sync       | Exact `true` enables a review-branch proposal for eligible refreshed offers. Disabled by default.                                                  |
| `GITHUB_TOKEN`                  | Static file sync       | Fine-grained PAT with `contents:write` on the repo. Required when `STATIC_FILE_SYNC_ENABLED` is `true`.                                            |
| `GITHUB_REPO_OWNER`             | Static file sync       | Repo owner; defaults to `Dr-dyrane`.                                                                                                               |
| `GITHUB_REPO_NAME`              | Static file sync       | Repo name; defaults to `jelo`.                                                                                                                     |
| `GITHUB_REPO_BRANCH`            | Static file sync       | Required review branch named `inventory-sync-review` or prefixed `inventory-sync-review-` / `inventory-sync-review/`. Other branches are rejected. |

AI extraction is deliberately database-only. Static sync accepts only
confidence-60+ retailer-page or retailer-API observations, preserves their
verification method, uses the actual bounded expiry, and stops price changes
over 35% for manual review. It never commits directly to the production branch.

The browser fetch fallback (Phase 1) requires no environment variable — it is
active whenever `playwright-core` is installed in the deployment. The
`@playwright/browser-chromium` package provides the Chromium binary at build
time.

Vercel builds have no database-migration or seed switch. They verify, build,
and may perform bounded staged public-asset promotion only. All PostgreSQL
migrations, reconciliation, and private product-request Blob cleanup are
explicit protected operator jobs. The daily campaign configuration and
activation sequence are documented in
[Daily campaign handoff](./DAILY_CAMPAIGNS.md).

### Declared future service

`EDGE_CONFIG` is documented for runtime flags, but no current application path reads it. Do not claim a feature is remotely controlled until code uses it.

## Scope

- Restricted application secrets belong in Vercel Production. The database
  owner and `MIGRATION_DATABASE_URL` explicitly do not.
- Preview secrets belong in Preview only when the feature is safe to exercise there.
- Local application-runtime values stay in `.env.local`; protected operator
  values such as `MIGRATION_DATABASE_URL` do not.
- Client-visible variables require explicit review; only `NEXT_PUBLIC_SITE_URL` is currently intended to be public.
- Rotate a secret after accidental output, commit, or broad sharing.

## Configuration check

For first Shelf activation, complete the required production-shaped rehearsal,
record the release authority's connected-resource decision, and verify the
one-off import receipt before adding the restricted URLs to Vercel. A connected
resource or passing local check does not waive those gates.

Before deployment, verify names—not values:

```bash
vercel env ls
```

For a Shelf release, the list must contain the required restricted runtime
names, omit `MIGRATION_DATABASE_URL` and the one-off target subject, and contain
no owner-bearing or reconstructable compatibility alias. Verify usernames from
the protected connection inventory; never print URLs to prove this.

Then run the feature in the environment that will receive traffic. A successful
build does not prove Neon, mail, Blob, Redis, or cron behavior.
