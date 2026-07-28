# ADR 0008: Public-surface abuse and browser-security hardening

Status: Accepted (deferred); build gated on the triggers below

Date: 2026-07-24

> Implementation update, 2026-07-27: the consult-specific parts of items 1 and
> 4 are implemented. `/api/consult` now rejects cross-site browser requests
> when Origin or Fetch Metadata is present, permits origin-less server/native
> clients, is bounded to 64 KiB, is protected by its own Upstash limiter, and
> fails closed on missing or unavailable limiter configuration in production.
> Ask Jelo is also fully
> deterministic and has no current paid-model or AI Gateway runtime. The audit
> wording below is retained as historical context. The broader browser-header,
> dependency, and non-consult limiter work remains governed by this ADR. Any
> future model-backed language lane requires a separate reviewed boundary.

## Context

A reconnaissance pass over the public surface confirmed a strong baseline — parameterized SQL (`postgres.js` tagged templates), a deny-by-default `/ops` guard that 404s ([ADR 0007](0007-internal-moderation-operations-console.md)), EdDSA webhook verification with a replay guard, `timingSafeEqual` cron auth, gitignored secrets, and Zod bounds on every intake lane. It also surfaced four gaps. Two are **already acknowledged and deliberately deferred** in [APIs and security](../architecture/APIS_AND_SECURITY.md) ("Known controls to preserve"); this ADR is where that deferral becomes an explicit, gated decision instead of a note, and adds the two that were not yet recorded.

The four, ranked by exploitability:

1. **`/api/consult` is an unauthenticated, un-rate-limited, paid model call.** It reads `await request.json()` with no same-site check, no Upstash limiter, and no 64 KiB body bound — then calls `generateText()` (`maxDuration: 30`). Every other write lane (`contribute`, `retailers`) carries all three controls; consult carries none. The [route catalogue](../architecture/APIS_AND_SECURITY.md#route-catalogue) already lists consult's controls as "Zod bounds, deterministic safety gate, filtered catalogue" with no same-site check, and the "Known controls" section already says to add a limiter "before materially increasing public traffic." Primary harm is financial: scripted requests burn the AI budget and saturate serverless concurrency (cost-amplification DoS).
2. **No browser-security response headers.** [`next.config.ts`](../../next.config.ts) sets no `headers()` — missing `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, and a global `Referrer-Policy`. The two `dangerouslySetInnerHTML` sinks (the theme script; `serializeJsonLd`, which has a `</script>`-escaping regression test) are currently safe, so a CSP is defense-in-depth against the *next* sink, not a fix for a live hole.
3. **A critical `better-auth` advisory rides in transitively** via `@neondatabase/auth` (`0.4.2-beta`), constraint `<= 1.6.21`. Most advisories cover OAuth/OIDC-provider flows JeloCare does not expose (operator sign-in is email OTP, [ADR 0007](0007-internal-moderation-operations-console.md)); the relevant one is stale sessions surviving user deletion, which touches operator offboarding. The version is not directly bumpable — it is gated on Neon updating the beta.
4. **Rate-limiters fail open.** `allowRetailerPartnershipAction` / `allowCommunityAction` return `true` when Upstash env vars are absent (`lib/*/security.ts`). Correct for local dev; in production a KV outage silently disables all rate limiting. Already noted in [APIs and security](../architecture/APIS_AND_SECURITY.md) ("Rate limiting degrades open when Upstash is absent").

## Decision

Adopt the following as the intended target state, staged behind the triggers in [Build gate](#build-gate). None of this widens the public trust boundary — [ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) stays in force (no public accounts, ratings, or alerts).

1. **Harden `/api/consult` to match the other write lanes.** Reuse the existing primitives, not new ones: `sameSiteRequest` (`Origin` / Fetch Metadata), an Upstash `Ratelimit` on the HMAC-derived network key with its own action prefix and window, and `readBoundedJson` for the 64 KiB bound. Fail closed the same way intake lanes do (429 on limit, 403 on cross-site). This does not change the [Ask Jelo boundary](../architecture/APIS_AND_SECURITY.md#ask-jelo-boundary): the server still owns every safety and referral decision.
2. **Add a `headers()` block to `next.config.ts`.** A `Content-Security-Policy` compatible with the two known inline `<script>` sinks (nonce or hash the theme script and JSON-LD rather than `unsafe-inline`), plus `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a frame-ancestors restriction. The `/ops` surface already sets `robots: noindex`; the header layer is orthogonal and applies to the whole app.
3. **Track the `better-auth` advisory as a watched, pinned dependency.** Do not `npm audit fix --force` (it would fork the pinned `@neondatabase/auth` beta [ADR 0007](0007-internal-moderation-operations-console.md) depends on). Instead: verify the operator-removal path actually invalidates sessions, and bump when Neon ships a patched beta. Record it in [RUNBOOKS](../operations/RUNBOOKS.md) as a standing check.
4. **Make production fail closed on a missing limiter.** At request time in production, a missing `KV_REST_API_URL` / `KV_REST_API_TOKEN` denies the request instead of silently disabling limits; an unavailable configured limiter also denies. Local development and tests keep the fail-open convenience. This is request-time enforcement because the serverless runtime does not provide one reliable application-startup boundary.

## Build gate

The [APIs and security](../architecture/APIS_AND_SECURITY.md) note already sets the consult trigger; this ADR makes it and the others explicit. Build when **any** of these is reached — whichever comes first:

- **Consult (item 1):** before materially increasing public traffic to `/api/consult`, before any paid-model spend cap is a real concern, or on the first observed abuse spike. This is the highest-priority item and the cheapest — it reuses shipped helpers end to end.
- **Headers (item 2):** alongside the next change that adds or touches an inline-script sink, or the next external security review — whichever is sooner.
- **Dependency (item 3):** continuous. Re-check on every `@neondatabase/auth` bump and in the standing runbook check.
- **Fail-closed limiter (item 4):** with item 1, since both concern the same production rate-limit posture.

Items 1 and 4 ship together; 2 and 3 are independent.

## Consequences

- The public surface's most direct real-world harm path (unmetered paid-model calls) is closed with existing primitives — no new dependency, no new abstraction, no trust-boundary change.
- Browser-security headers become a standing part of the app config rather than an implicit gap, and a CSP is in place before the sink count grows.
- The transitive auth advisory is tracked deliberately instead of being surfaced repeatedly by `npm audit` with no owner.
- Production stops silently degrading to no rate limiting on a KV outage.
- [APIs and security](../architecture/APIS_AND_SECURITY.md) should be updated when items land: move the consult limiter and the fail-open note from "Known controls to preserve" into the shared-controls list, and add the header layer to shared controls. Security changes ship with abuse-path tests, not only happy-path tests (existing house rule).

## Alternatives rejected

- **Authenticate `/api/consult`.** Rejected: it is a public education surface by design ([ADR 0001](0001-deferred-trust-collections-community-and-stock-alerts.md) keeps the public app account-free). Rate limiting and a same-site check are the right controls, not a login wall.
- **`npm audit fix --force` the `better-auth` advisory.** Rejected: it would break the pinned `@neondatabase/auth` beta the moderation console depends on, and most advisories cover flows JeloCare does not expose.
- **A permissive `unsafe-inline` CSP.** Rejected: it would neutralize the CSP against exactly the inline-script sink class it exists to contain. Nonce or hash the two known scripts instead.
- **Fix everything now.** Rejected in favor of the gate: the consult and fail-open items are the only ones with a live abuse path and ship together; the header and dependency items are defense-in-depth and are sequenced to real triggers rather than done speculatively.
