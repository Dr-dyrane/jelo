# Custom JeloCare authentication email

Updated: 2026-08-14

JeloCare owns the content and appearance of Neon Auth one-time-code email. The
working production path is a blocking Neon Auth `send.otp` webhook that calls a
public JeloCare route; the route verifies Neon's signature, renders the
JeloCare template, and hands the message to Hostinger.

Custom rendering is shipped. Provider delivery health is a separate gate. Do
not describe custom email as healthy until a production canary reaches the
recipient and verifies within 90 seconds. Record a redacted, dated operator
receipt before making a historical delivery-health claim in this handbook.

The implementation first shipped in `928ade7a` (`Add the Neon Auth send.otp
webhook for branded OTP emails`) and the duplicate-conscious API-to-SMTP
resilience path shipped in `395b05aa` (`fix(email): add duplicate-safe delivery
fallback`). These commits are history anchors, not substitutes for checking
the currently deployed revision and current provider evidence.

## What finally solved custom email

Configuring an SMTP provider in Neon was not enough to run JeloCare's HTML
template. Managed Better Auth owns its default email surface. The decisive
change was subscribing the production Auth branch to `send.otp`:

```text
/sign-in
  -> Neon Managed Better Auth creates the OTP
  -> blocking send.otp webhook
  -> POST https://www.jelocare.com/api/auth-hooks
  -> verify detached Ed25519 JWS against Neon JWKS
  -> render operatorOtpEmail()
  -> Hostinger Agentic Mail API
  -> recipient mailbox
```

When `send.otp` is subscribed, Neon skips its built-in delivery for that event.
The JeloCare endpoint is the sole sender. That is why the endpoint and provider
must be deployed and verified before the webhook is enabled.

## Source of truth

| Responsibility                              | Enforcing source                                           |
| ------------------------------------------- | ---------------------------------------------------------- |
| Signed Neon webhook and health probe        | `app/api/auth-hooks/route.ts`                              |
| JeloCare OTP subject, text, and inline HTML | `lib/email/templates.ts`                                   |
| Provider selection and sender identity      | `lib/email/mailer.ts`                                      |
| Hostinger mailbox lookup and API send       | `lib/email/hostinger-mail-api.ts`                          |
| Duplicate-conscious API-to-SMTP decision    | `lib/email/delivery-strategy.ts`                           |
| Required environment names                  | `.env.example` and [Environments](./ENVIRONMENTS.md#email) |
| Incident response                           | [Runbooks](./RUNBOOKS.md#retailer-application-email-fails) |

The template uses inline styles because email clients do not share the web
application's CSS runtime. Escape every value inserted into HTML. Never add an
OTP, recipient, provider response, or private link to logs, screenshots, test
fixtures, or committed documentation.

## Provider setup

### 0. Confirm the Auth contract

Before configuring delivery, confirm the production Neon branch has:

- Neon Auth and the email OTP plugin enabled;
- `https://www.jelocare.com` as a trusted domain;
- localhost disabled as a trusted production origin;
- the final `/api/auth/[...path]` Auth proxy and `/api/auth-hooks` webhook
  deployed;
- a server-only `NEON_AUTH_BASE_URL`; and
- one stable `NEON_AUTH_COOKIE_SECRET` of at least 32 random bytes.

Do not provision Preview by copying Production secrets automatically. Preview
Auth and email delivery remain deny-by-default unless a reviewed branch,
trusted origin, webhook, and mailbox canary are deliberately provided.

### 1. Prepare the Hostinger mailbox

1. Create and activate the domain mailbox in hPanel.
2. Confirm the domain's MX, SPF, DKIM, and DMARC records.
3. Open **Emails -> the domain -> Agentic mail -> API access**.
4. Create a production token restricted to the sending mailbox when possible.
5. Copy the token once into the secret manager; Hostinger does not show it
   again.
6. Review the mailbox's Agentic Mail allow and block lists. A non-empty allow
   list restricts all other recipients, and a block entry wins.
7. If SMTP resilience is required, use the mailbox password or a dedicated app
   password. The Agentic Mail API token is not an SMTP password.

JeloCare's SMTP compatibility transport is `smtp.hostinger.com` on port `465`
with TLS. API delivery remains the preferred path.

### 2. Configure Vercel without exposing values

Set these server-only variables in Production only by default. Never copy the
production mailbox token, password, or cookie secret into Preview. An
explicitly approved Preview can instead use separate restricted mail
credentials, its own disposable Auth branch and webhook, and its own canary;
otherwise leave Preview Auth email unconfigured.

| Variable                       | Purpose                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `EMAIL_PROVIDER=hostinger-api` | Select API-first delivery                                        |
| `EMAIL_API_TOKEN`              | Mailbox-scoped Agentic Mail credential                           |
| `EMAIL_SMTP_PASSWORD`          | Optional mailbox-password resilience path                        |
| `EMAIL_FROM_ADDRESS`           | Exact sending mailbox and SMTP username                          |
| `EMAIL_FROM`                   | Branded display sender                                           |
| `EMAIL_REPLY_TO`               | Reply destination                                                |
| `NEON_AUTH_BASE_URL`           | JWKS origin for signature verification                           |
| `NEON_AUTH_COOKIE_SECRET`      | Stable signing secret for Auth cookies; at least 32 random bytes |

Never put these values in source, a shell command, screenshots, task messages,
or Vercel build output. Listing variable names and scopes is safe; retrieving
or printing their values is not.

### 3. Deploy before enabling the webhook

Deploy the exact reviewed commit first. Confirm the production alias serves:

```bash
curl -fsS https://www.jelocare.com/api/auth-hooks
```

The response should include:

```json
{
  "ok": true,
  "hook": "neon-auth",
  "configured": true,
  "emailDeliveryConfigured": true
}
```

`emailDeliveryConfigured` means only that the application recognizes a
provider configuration. It does not test the credential, provider acceptance,
queue completion, or mailbox receipt.

### 4. Configure the exact Neon Auth branch

Neon Auth webhook configuration is branch-specific. Use an authenticated local
`neonctl` profile; do not place a Neon API key in the command or shell history.
Set the exact production project and branch explicitly:

```bash
npx neonctl neon-auth config webhook update \
  --project-id "$PROJECT_ID" \
  --branch "$PRODUCTION_BRANCH" \
  --enabled true \
  --url 'https://www.jelocare.com/api/auth-hooks' \
  --enabled-events send.otp \
  --timeout 5

npx neonctl neon-auth config webhook get \
  --project-id "$PROJECT_ID" \
  --branch "$PRODUCTION_BRANCH" \
  --output json
```

The readback must resolve to this contract:

```json
{
  "enabled": true,
  "webhook_url": "https://www.jelocare.com/api/auth-hooks",
  "enabled_events": ["send.otp"],
  "timeout_seconds": 5
}
```

Use the canonical HTTPS URL directly. Neon rejects private targets and raw IP
addresses, and it does not follow redirects. Read the configuration back after
writing it and confirm the project, branch, URL, event list, enabled state, and
timeout without printing any credential.

Do not subscribe unrelated events merely because the endpoint acknowledges
them. The current handler owns `send.otp` only.

## Why the webhook can be trusted

The route does not use a shared webhook password. It verifies Neon's detached
JWS before reading or acting on the payload:

1. Read and preserve the exact raw request body.
2. Require `X-Neon-Signature`, `X-Neon-Signature-Kid`, and
   `X-Neon-Timestamp`.
3. Reject timestamps outside the five-minute replay window.
4. Resolve the matching Ed25519 public key from
   `<NEON_AUTH_BASE_URL>/.well-known/jwks.json`.
5. Reconstruct the detached-JWS signing input and verify the signature.
6. Parse the body only after verification.
7. Require `send.otp`, a recipient, and an OTP value before delivery.

JWKS is cached briefly, and an unknown key ID causes a refresh so Neon key
rotation does not require a deployment.

## Delivery and retry rules

API-first delivery may use SMTP once only when the API proves that no message
was accepted, such as failed mailbox discovery or an explicit client
rejection. It must not fall back to SMTP after an API timeout, network break,
HTTP 408, or provider 5xx once the send may have started. That uncertainty can
otherwise create two emails through two transports.

This rule prevents an API-to-SMTP duplicate. It does not make the complete Auth
event idempotent: Neon can retry a blocking event after retryable failures, and
Hostinger does not expose a send-idempotency contract. Do not manually resend
during a canary or incident investigation. A future durable event ledger would
need to bind `X-Neon-Event-Id` before claiming end-to-end exactly-once delivery.

Return 2xx only after the configured transport accepts the message. Return a
non-2xx response when delivery cannot be accepted so the sign-in UI does not
silently claim success.

Neon makes at most three attempts within a 15-second total delivery window. It
retries network failures, HTTP 408, 429, and 5xx responses; other 4xx responses
are terminal. Signature or payload rejection should therefore be a truthful
4xx, while a temporary provider failure should remain retryable. Managed Neon
Auth webhooks are currently Beta, so recheck this contract against the official
documentation before changing production retry behavior.

## Production verification

Use one real canary and one approved mailbox. Never print or record the mailbox
or OTP.

1. Open a fresh signed-out browser at `/sign-in?next=/me`.
2. Request one code. Do not press resend during the measurement.
3. Confirm Vercel recorded one production `POST /api/auth-hooks` and its status.
4. In hPanel, distinguish **Access** logs from **Delivery -> Outbound** logs:
   - SMTP/API access success proves only mailbox authentication or acceptance.
   - Outbound delivery status describes the provider's downstream attempt.
5. Confirm the recipient mailbox received the new message.
6. Enter the code and confirm `/me` opens in the same browser session.
7. If testing `/ops`, separately confirm the signed-in subject has an active
   `moderation_operators` record; Auth alone never grants operator access.
8. Sign out, revisit the protected route, and confirm it redirects to sign-in.

The canary passes only when the email is received and usable within 90 seconds.
A Hostinger API 2xx, webhook 200, SMTP success, `Delivering` row, or eventual
arrival after the OTP expires is a failure, not a partial pass.

## Troubleshooting map

| Evidence                                           | Meaning                                                            | Next action                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Health probe is false                              | App configuration is absent or unrecognized                        | Check variable names and scopes; redeploy                                         |
| Webhook 401                                        | Signature, timestamp, JWKS origin, or raw-body verification failed | Recheck the exact Auth branch and `NEON_AUTH_BASE_URL`; never bypass verification |
| Webhook 502 with no Hostinger send                 | Provider lookup or acceptance failed                               | Check token type, mailbox scope, sender identity, and generic server error code   |
| Hostinger Access says incorrect password           | SMTP credential is invalid                                         | Rotate the mailbox/app password and update the secret out of band                 |
| Hostinger accepts but Outbound stays `Delivering`  | Provider queue has not completed                                   | Do not send SMTP fallback; collect timestamps and escalate to Hostinger           |
| Same-domain mail is fast but external mail is late | External relay, reputation, or receiving-domain path is failing    | Check SPF/DKIM/DMARC, delivery detail, and provider support                       |
| Message arrives after ten minutes                  | The authentication journey failed                                  | Treat as incident even if the provider later says delivered                       |
| Two codes arrive                                   | Retry or manual resend duplicated the event                        | Stop retries and correlate Neon attempt/event IDs with provider timestamps        |

## Safe rollback

If the JeloCare endpoint is unavailable, disable the Auth webhook through the
exact branch's Neon configuration. Managed Better Auth then resumes its default
delivery behavior for the unsubscribed event. This is an availability rollback,
not proof that the underlying email provider is healthy. Run a new 90-second
canary after rollback.

Never delete the endpoint, rotate credentials, switch providers, or disable the
webhook without recording the exact branch, deployment, and canary result.

## Official references

- [Neon Auth webhooks](https://neon.com/docs/auth/guides/webhooks)
- [Neon Auth email customization](https://neon.com/docs/auth/guides/customize-emails)
- [Hostinger Agentic Mail](https://www.hostinger.com/support/how-to-use-agentic-mail-in-hpanel/)
- [Hostinger Mail API](https://api.mail.hostinger.com/)
- [Hostinger delivery logs](https://www.hostinger.com/support/6404796-how-to-check-delivery-logs-for-hostinger-email/)
- [Hostinger SMTP settings](https://support.hostinger.com/en/articles/1575756-how-to-get-email-account-configuration-details-for-hostinger-email)
