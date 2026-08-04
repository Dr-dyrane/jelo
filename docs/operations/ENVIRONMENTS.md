# Environments

Updated: 2026-08-03

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

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production | Canonical origin and retailer magic-link origin |
| `CATALOGUE_SOURCE` | Yes | `static` or `neon`; Neon reads retain static fallback |

Ask Jelo is deterministic and currently has no model provider or model-selection
environment variable. Any future language-only lane requires a separate
reviewed boundary before a provider credential is added.

### PostgreSQL

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Production runtime data features | Pooled postgres.js URL whose username is exactly `jelocare_app_runtime`; require `sslmode=verify-full` and omit `channel_binding` |
| `CUSTOMER_SHELF_DATABASE_URL` | Private Shelf runtime | Pooled postgres.js URL whose username is exactly `jelocare_shelf_runtime`; require `sslmode=verify-full`, omit `channel_binding`, server-only |
| `POSTGRES_URL` | Compatibility only | If retained, it must satisfy the same driver and exact app-role contract, never point to an owner or administrator |
| `NEON_PROJECT_ID` | Operator convenience | Not read by application runtime |

`MIGRATION_DATABASE_URL` is deliberately not a Vercel environment variable. A
protected operator process injects one direct, non-pooled administrator URL for
migrations and explicit database reconciliation, then removes it. Do not save
it in `.env.local`, Vercel, source, command history, logs, screenshots, or a
release evidence file.

The one-off Shelf import also reads
`JELOCARE_SHELF_IMPORT_OWNER_SUBJECT`. It belongs only in that protected
operator process, is never committed or configured in Vercel, and must be
removed after the receipt-guarded apply.

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

| Variable | Required | Notes |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Asset writes, production asset operators, and the protected private product-request cleanup drain | Server-only; inject beside `MIGRATION_DATABASE_URL` only for the bounded drain and remove afterward |
| `BLOB_STORE_ID` | Provider metadata | Not read by the current runtime |
| `BLOB_WEBHOOK_PUBLIC_KEY` | Future webhook verification | Not read by the current runtime |

### Rate limiting

| Variable | Required | Notes |
| --- | --- | --- |
| `KV_REST_API_URL` | Every production-mode Ask Jelo runtime | Upstash REST URL; required in Vercel Production, Vercel Preview, and local `next start` |
| `KV_REST_API_TOKEN` | Every production-mode Ask Jelo runtime | Upstash REST token; required in Vercel Production, Vercel Preview, and local `next start` |
| `CONSULT_RATE_LIMIT_SECRET` | Recommended | Dedicated server-only HMAC salt for Ask Jelo network keys; otherwise a database URL is used |
| `COMMUNITY_INTAKE_RATE_LIMIT_SECRET` | Recommended | HMAC salt; otherwise a database URL is used |
| `RETAILER_PARTNERSHIP_RATE_LIMIT_SECRET` | Recommended | Separate HMAC salt |

Ask Jelo fails closed in every production-mode runtime when either required
Upstash REST value is missing or the configured limiter is unavailable. Vercel
Production and Preview must therefore receive both values; a local
`next start` run must also provide them. Only `next dev` and tests may run
without Upstash. `CONSULT_RATE_LIMIT_SECRET` also falls back to a database URL
for compatibility, but deployed environments should use the dedicated value.

`KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, and `REDIS_URL` are compatibility
values but are not used by the current request limiters.

### Email

| Variable | Required | Notes |
| --- | --- | --- |
| `EMAIL_PROVIDER` | Retailer magic links | `hostinger-api` preferred; `hostinger-smtp` fallback |
| `EMAIL_API_TOKEN` | Hostinger API delivery | Mailbox-scoped Agentic Mail token |
| `EMAIL_SMTP_PASSWORD` | SMTP fallback only | Mailbox password, never an API token |
| `EMAIL_FROM_ADDRESS` | Recommended | Auth username; defaults to `hello@jelocare.com` |
| `EMAIL_FROM` | Recommended | Display sender |
| `EMAIL_REPLY_TO` | Recommended | Reply destination |

Create the API token under hPanel → Emails → the domain → Agentic mail → API.
The mailer resolves the configured sender against `/api/v1/me` before sending.
A general Hostinger account API token is not a mail token, and a mail API token
is not an SMTP password.

### Scheduled and release operations

| Variable | Required | Notes |
| --- | --- | --- |
| `CRON_SECRET` | Production | Bearer secret for `/api/cron/inventory` |

Vercel builds have no database-migration or seed switch. They verify, build,
and may perform bounded staged public-asset promotion only. All PostgreSQL
migrations, reconciliation, and private product-request Blob cleanup are
explicit protected operator jobs. This Shelf release does not add or change a
cron, scheduled owner, inventory queue, lease, worker, or manual observation
setting.

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
