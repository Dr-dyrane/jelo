# APIs and security

Updated: 2026-07-27

Route handlers validate at the boundary, keep secrets server-only, and fail closed when durable storage or required credentials are unavailable.

## Route catalogue

| Route | Method | Purpose | Main controls |
| --- | --- | --- | --- |
| `/api/consult` | `POST` | Guided skin education | Browser provenance check, 64 KiB body, Zod bounds, deterministic safety gate, filtered catalogue, production-fail-closed Upstash limit |
| `/api/products/suggestions` | `GET` | Bounded public catalogue typeahead | Minimal public projection, normalized 2–120 character query, indexed Neon lookup, market allowlist, seven-result cap, short shared cache, hashed-network read limit |
| `/api/contribute/drafts` | `POST` | Start anonymous draft | Same-site check, honeypot, rate limit, PostgreSQL requirement |
| `/api/contribute/drafts/[id]` | `PUT` | Save draft and events | HttpOnly edit secret, optimistic revision, 64 KiB body |
| `/api/contribute/drafts/[id]/submit` | `POST` | Submit contribution | Edit secret, UUID idempotency key, rate limit, final schema |
| `/api/retailers/applications` | `POST` | Start retailer application | Same-site check, consent, honeypot, rate limit, PostgreSQL |
| `/api/retailers/applications/[id]` | `GET`, `PUT` | Restore or save retailer application | HttpOnly private token, optimistic revision |
| `/api/retailers/applications/[id]/send-link` | `POST` | Resend private link | Edit secret, rate limit, mail availability |
| `/api/retailers/applications/[id]/submit` | `POST` | Submit retailer application | Edit secret, UUID idempotency key, final schema |
| `/api/retailers/magic` | `GET` | Open and verify private link | Token hash, expiry, rate limit, HttpOnly cookie |
| `/api/cron/inventory` | `GET` | Refresh due retail offers | Bearer `CRON_SECRET`, bounded batch |
| `/go` | `GET` | Outbound retailer redirect | Allowlisted offer lookup and attribution logic |

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
- Catalogue suggestions query indexed public search text and approved GTIN fields, then fail over to a deterministic checked-in projection containing only slug, brand, name, size, approved GTIN, and source. They never import or expose private candidates, community drafts, moderation records, dossiers, or the 1,000-record discovery queue.
- Catalogue suggestion reads use a hashed network key with a lightweight Upstash window. Missing Redis configuration is the only fail-open state; partial configuration and provider failures return `429` with `Retry-After`.
- Ask Jelo uses a separate 20-request-per-hour Upstash window and an HMAC-derived network key. Production denies requests when Redis configuration is missing or the configured provider is unavailable; local development may run without Redis.

## Data classification

| Data | Classification | Rule |
| --- | --- | --- |
| Public product and retailer records | Public | Publish only through the relevant evidence gate |
| Community submissions | Internal, anonymous | Aggregate for research; do not present as verified fact |
| Retailer applications | Confidential business data | Restrict to operations; retain only as documented |
| Edit and magic-link tokens | Secret | Never log or store in plaintext |
| Email, phone, address | Personal/business contact data | Use only with recorded consent |
| Database, Blob, Redis, mail, and third-party credentials | Secret | Server-only environment variables |

## Ask Jelo boundary

Ask Jelo is deterministic and does not call a language model.

- The server decides whether the journey can continue.
- Condition routes return a canonical, reviewed guide and no products.
- Everyday-care routes may return only products that pass reviewed concern, body-area and routine-step authority.
- The public response contains presentation data only. Clinical rules, scores, internal evidence identifiers and recommendation diagnostics stay server-side.
- Any future language-model wording lane requires a separate reviewed safety, privacy, abuse and cost boundary before implementation.

## Known controls to preserve

- `CRON_SECRET` must exist in production even though it is managed outside application code.
- Non-consult public limiters retain their documented local/failover behavior. Ask Jelo specifically requires Upstash in production and fails closed.
- The Agentic Mail API token is preferred. SMTP remains a mailbox-password fallback.
- Magic links expire after 30 days; retailer application retention is 24 months in the current migration.

Security changes should include abuse-path tests, not only happy-path route tests.
