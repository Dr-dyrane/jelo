# Environments

Updated: 2026-07-27

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
| `DATABASE_URL` | Runtime data features | Pooled Neon URL |
| `DATABASE_URL_UNPOOLED` | Migrations preferred | Unpooled Neon URL |
| `POSTGRES_URL` | Compatibility | Runtime fallback |
| `POSTGRES_URL_NON_POOLING` | Compatibility | Migration fallback |
| `NEON_PROJECT_ID` | Operator convenience | Not read by application runtime |

Other Neon/Vercel compatibility variables in `.env.example` are provider-generated. Do not use them in browser code.

### Media

| Variable | Required | Notes |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Asset writes and production asset operators | Server-only |
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
| `SKIP_DATABASE_MIGRATIONS` | CI/emergency only | `1` skips production migrations |
| `SEED_EXTERNAL_CATALOGUE_ON_BUILD` | One-time operation only | `1` enables the separate external-catalogue seed during a production build |
| `SEED_CATALOGUE_ON_BUILD` | Legacy | Does not enable external discovery; reviewed catalogue sync already runs in every normal production release |

### Declared future service

`EDGE_CONFIG` is documented for runtime flags, but no current application path reads it. Do not claim a feature is remotely controlled until code uses it.

## Scope

- Production secrets belong in Vercel Production.
- Preview secrets belong in Preview only when the feature is safe to exercise there.
- Local values stay in `.env.local`.
- Client-visible variables require explicit review; only `NEXT_PUBLIC_SITE_URL` is currently intended to be public.
- Rotate a secret after accidental output, commit, or broad sharing.

## Configuration check

Before deployment, verify names—not values:

```bash
vercel env ls
```

Then run the feature in the environment that will receive traffic. A successful
build does not prove Neon, mail, Blob, Redis, or cron behavior.
