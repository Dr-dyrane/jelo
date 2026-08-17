# Assisted procurement operations

Updated: 2026-08-16

JeloCare ships a guest-first, one-retailer order-request flow. It is a manual
assisted-procurement service, not retailer checkout and not a marketplace.
The retailer supplies and fulfils the exact products; JeloCare is the disclosed
purchasing agent. Governed Stripe Checkout and operator-verified bank payment
are available only after approval of one exact quote. Operations owns the
persisted manual fulfilment, return-decision, and refund-evidence path; external
retailer
checkout and courier automation remain separately gated.

## Customer journey

1. A person adds an exact product to the local guest basket. The first add
   selects a current in-stock retailer and opens that retailer's JeloCare
   profile as a store-scoped shopping surface. Products added there stay with
   the same retailer. No account, contact data, or server record is created.
2. `/basket` shows only retailers with a current eligible listing for every
   selected item. The person may explicitly switch the whole basket there; one
   order always has one retailer.
3. `/checkout` collects the delivery and contact details needed to prepare a
   quote. The server re-reads the catalogue, offer evidence, price, stock, and
   retailer; it never trusts client prices. A browser-scoped request key makes
   a retry return the same order instead of creating a duplicate. Email order
   updates are an explicit, unchecked opt-in and are never marketing.
4. Checkout creates one canonical private order and sets an order-scoped,
   secure HttpOnly guest cookie. Transactional email sends a one-time recovery
   link when mail is configured.
5. Operations checks the retailer manually and records products, retailer fee,
   observed tax, JeloCare fee, delivery, evidence, and expiry separately.
   Customer-visible order events create one deduplicated in-app notification;
   opted-in email delivery uses the existing transactional mail provider.
6. The customer approves or declines that exact quote version on `/order` or,
   when signed in, `/me/orders`.
7. Approval enters `payment_pending`. Only exact provider or independently
   observed bank evidence may advance it to `paid`.
8. Operations records one current step at a time: procurement start, exact
   retailer confirmation, traceable dispatch, and delivery evidence.
9. After delivery, the guest or signed-in owner may submit one private return
   request. Operations records an approval or decline. Approval creates a
   pending full-refund ledger entry linked to the verified payment; the order
   becomes `refunded` only after governed completion evidence is recorded.

The state and cost contract is defined by
[ADR 0016](../adr/0016-retailer-scoped-assisted-procurement.md).

## Progressive checkout intake

`/checkout` uses a three-step progressive intake instead of a single long form.
Each step is gated by validation before the customer can continue, and the
progress bar reflects the current step (0%, 50%, 100%).

### Step flow

1. **Contact** — name, email, and optional WhatsApp consent. Validation
   requires a non-empty name and a valid email before Continue is enabled.
2. **Delivery** — address, city, and optional delivery notes. Validation
   requires non-empty address and city.
3. **Review** — shows the full order summary with product images, retailer,
   prices, and entered contact/delivery details. The customer submits the
   quote request from this step.

### State management

- Each field has its own `onChange` handler that calls `updateField(name, value)`.
- Controlled `fields` state drives both validation and the Continue button's
  `disabled` prop. The form does not read refs during render.
- The Back button returns to the previous step without clearing entered data.
- The selected retailer is persisted to `localStorage` under
  `CHECKOUT_RETAILER_STORAGE_KEY` so that navigating away and returning
  preserves the shopper's retailer choice across the basket, checkout, and
  product pages.

### Layout

- The checkout form is the wider left column; the order summary is the
  narrower sticky right column. This prioritises data entry while keeping
  the order visible.
- Commerce pages use the same padding scale as the rest of the site (no
  separate gradient background or oversized top padding).
- The order-status page (`/order`) uses the same visual treatment as the
  broader site design, with a reduced heading scale that matches product
  and concern pages.

## Data and authority

- The basket is versioned local storage and contains only product slugs and
  quantities. It is intentionally guest-first.
- That same device-local basket remains visible and actionable inside My
  JeloCare. Signing in or opening My Shelf does not create a second basket;
  exact Shelf products continue through the existing one-retailer rules.
- Checkout writes an immutable exact brand/name/size/image/quantity/observed
  offer snapshot. A normalized catalogue identity-version foreign key is added
  when one exists; legacy public products remain orderable through the same
  immutable snapshot rather than failing checkout.
- Signed-in checkout derives its owner from the server session. Guest checkout
  uses a random 256-bit order-scoped capability; only its SHA-256 hash is saved.
- Recovery uses a different random one-time capability. Exchanging it rotates
  the guest session and removes the token from the URL. Issuing a replacement
  invalidates earlier unused links.
- Orders and recoveries are private and `no-store`. Contact data, address,
  product details, tokens, and order identifiers do not enter analytics or
  public URLs.
- Operators require `orders.read`; mutations require `orders.manage`.
- Notifications derive from the append-only order event by unique event ID.
  Signed-in owners see them at `/me/notifications`; guests manage email from
  the private `/order` page. Turning email off suppresses unsent delivery but
  does not rewrite the useful private order history.
- A new order also creates one durable internal handoff with one deduplicated
  delivery per active order-capable operator/admin. Team alerts are independent
  of customer consent and never include customer contact or delivery details.

## Retention and expiry

| Record                                | Current contract                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Guest basket                          | Browser-local until checkout clears it or the person removes it                                     |
| Guest order session                   | 30 days                                                                                             |
| Recovery link                         | 20 minutes, one-time                                                                                |
| Quote                                 | Operator-selected future expiry; expiry advances the order to `needs_response` and appends an event |
| Order and event record                | 365 days in the Phase 2 schema                                                                      |
| Order notification and delivery audit | Never beyond the parent order retention                                                             |

## Deployment order

1. Confirm Production has the restricted `APP_DATABASE_URL`, complete Upstash
   REST credentials, transactional email, `NEXT_PUBLIC_SITE_URL`, and a
   dedicated `ASSISTED_ORDER_RATE_LIMIT_SECRET`.
2. Enter a short online-payment maintenance window. Remove
   `STRIPE_SECRET_KEY` and redeploy. This makes the `isStripeConfigured()`
   gate reject new checkout initiation. Reconcile every already-pending
   Stripe session before continuing.
3. From a protected operator process, inject the direct administrator URL only
   for `npm run db:migrate`. Migrations `0039_assisted_procurement.sql`,
   `0041_assisted_order_notifications.sql`,
   `0044_assisted_order_operator_alerts.sql`,
   `0045_assisted_order_line_verifications.sql`,
   `0046_service_fee_policies.sql`,
   `0047_assisted_order_payments.sql`,
   `0048_money_columns_to_numeric.sql`,
   `0049_fix_remaining_money_columns.sql`,
   `0050_payment_integrity.sql`, `0051_order_lifecycle.sql`, and
   `0052_stripe_payment_provider.sql` grant only the application runtime role.
   Migration `0050` is a coordinated boundary, not an independently additive
   live change: old code initializes Paystack before its database insert, while
   new code reserves the reference first and depends on the new unique index.
   Never run it while old code can still initiate payments. Never add the admin
   URL to Vercel or `.env.local`. The checked-in atomic runner is the only
   normal write path. Neon MCP may inspect the target read-only; it must not
   execute migration fragments or manually write the ledger.
4. Deploy the application revision while online initiation remains disabled.
5. Restore `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, redeploy, and
   complete the post-deploy journey below before announcing availability.

Do not drop the new tables during application rollback. Old application code
does not use them, while retaining them preserves already-created customer and
audit records. Roll back the application, keep Operations access to existing
records, and cancel or complete requests through the governed manual process.

## Required post-deploy check

Use a real exact product with at least one fresh eligible retailer offer.

1. As a signed-out visitor, add the product and confirm the header basket count.
2. Open `/basket`, select one retailer, and continue to `/checkout`.
3. Submit a test delivery/contact record approved for production testing.
4. Confirm the clean `/order` URL, private cache headers, and `requested` state.
5. In `/ops/orders`, start quoting and issue a complete short-lived quote.
   Use the guided one-question-at-a-time intake, open each exact retailer
   listing in a separate protected tab, and review the running total before
   issuing the quote.
6. Confirm the guest view refreshes to Quote ready; approve it.
7. Confirm guest status, Operations, and signed-in ownership where applicable
   agree on `payment_pending`. Continue with the separate SQL-backed payment
   check below; never infer payment success from a redirect.
8. After governed payment evidence marks the order `paid`, record procurement,
   retailer confirmation, dispatch with a tracking reference, and delivery.
   Confirm `/order`, `/me/orders`, and Operations show the same canonical state.
9. Submit a return request from the authorized customer surface, approve it in
   Operations, then record a unique completed refund reference. Confirm the
   original payment ledger remains verified and unchanged while the order
   closes as `refunded`.
10. Use the emailed recovery link once, confirm it opens the same clean order,
    then confirm replay fails. Request a replacement and confirm the older
    unused link fails.
11. Issue another test quote with a short expiry and confirm it becomes
    `needs_response` with an appended `quote_expired` event.
12. Repeat once with email updates off and once with them on. Confirm the
    in-app event exists in both cases, only the opted-in order sends email, Ops
    shows the delivery state, failed delivery can be retried, and switching the
    preference off suppresses unsent email immediately.
13. Confirm the internal order alert is sent to every active operator/admin
    recipient regardless of the customer email choice. Confirm failed team
    delivery is visible and retryable without changing order state.

## Focused local verification

```bash
node --import tsx --test \
  modules/commerce/assisted-procurement.test.ts \
  modules/commerce/order-verification.test.ts \
  modules/me/me-shell-contract.test.ts
npm run typecheck
npm run verify:release
```

## Automated order verification

When a customer submits an order, JeloCare runs an automated verification pass
in the background (using Next.js `after()`) for every order line. This fetches
fresh price, stock, delivery, and full cost-breakdown data so operators see
pre-filled verification data instead of manually browsing every retailer.

### Extraction chain

For each order line, the verification tries (in order):

1. **Woo Cart API** — for known WooCommerce retailers, adds the product to a
   fresh cart and reads the cart totals. This gives the full breakdown:
   product subtotal, delivery, tax, retailer fee, and total. It simulates a
   purchase up to the payment step without actually paying.
2. **Woo Store API** — if the cart API fails, falls back to the product API
   for price and stock only (no delivery breakdown).
3. **HTTP fetch + structured extraction + AI cart extraction** — for non-Woo
   stores, fetches the product page HTML, runs structured extraction for
   price/stock, then asks the AI Gateway to extract delivery, tax, and fee
   information from the page HTML.
4. **Playwright browser cart simulation** — for blocked sites (e.g. Jumia with
   Cloudflare), uses a headless browser to fetch the page, then runs the same
   structured + AI extraction.
5. **Manual fallback** — if all automated methods fail, the line is marked as
   needing manual verification. The operator sees the error and can browse the
   retailer manually.

### AI Gateway cart extraction

The AI Gateway is asked to extract the following from the retailer page HTML:

- Product subtotal (NGN)
- Delivery fee (NGN)
- Tax (NGN)
- Retailer fee/service charge (NGN)
- Total amount (NGN)
- Stock status
- Unit price (NGN)
- Delivery note (free text)

The AI is prompted with the product name, size, quantity, and delivery
location. It returns only structured fields and is instructed not to guess.

### Data storage

Verification results are stored in `assisted_order_line_verifications`
(migration `0045`). One row per line per attempt. The latest verification per
line (`is_latest = true`) is what the operator sees. Older attempts are
retained for audit.

### Operator UI

The operator orders queue (`/ops/orders`) shows:

- A verification panel per order with status (pending, partial, complete,
  failed), method, confidence, and aggregated breakdown.
- A "Re-verify" button to trigger a fresh verification pass.
- Pre-filled quote form fields when verification data is available. The
  operator can still adjust any value before issuing the quote.

### Background trigger

Order creation (`POST /api/orders`) uses Next.js `after()` to run the
verification after the customer's HTTP response is sent. This does not block
the customer's checkout experience. The verification runs sequentially per line
to avoid rate-limiting retailer APIs.

### Operator-triggered re-verification

Operators can trigger a re-verification via:

- The "Re-verify" button in the orders queue UI.
- `POST /api/orders/{id}/verify` (operator-only, same-site).

### Environment variables

| Variable                        | Required | Notes                                                                                                       |
| ------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `INVENTORY_AI_EXTRACTION`       | No       | Set to `true` to enable AI Gateway extraction. Without it, only structured extraction and Woo API are used. |
| `INVENTORY_AI_EXTRACTION_MODEL` | No       | The AI Gateway model ID for extraction. Required if AI extraction is enabled.                               |

### Migration

The assisted-procurement schema culminates in
`0050_payment_integrity.sql` and `0051_order_lifecycle.sql`; both are normal
atomic migrations and grant only the application runtime permissions required
by their bounded repositories. Apply the complete checked-in sequence through
the operator-only, checksummed
`npm run db:migrate` process after `db:migrations:status` and the required Neon
rehearsal. Never substitute fragmented `run_sql` calls or a manual ledger row.

## Service fee policies

JeloCare service fees are determined by database-stored policies, not manual
guessing. Each policy can match by retailer, delivery state, or both (null =
catch-all). The highest-priority active match wins.

### Fee models

| Model          | Description                                           |
| -------------- | ----------------------------------------------------- |
| `flat`         | Fixed NGN amount regardless of basket size            |
| `percentage`   | Percentage of product subtotal, no floor or cap       |
| `pct_with_cap` | Percentage of product subtotal, clamped to [min, max] |

### Policy resolution

When an operator opens the quote form for an order in `quoting` state, the
server resolves the applicable policy:

1. Query active policies where `retailer_slug` matches (or is null) AND
   `delivery_state` matches (or is null).
2. Order by `priority DESC`.
3. First match wins.
4. Calculate the fee from the matched model and the product subtotal.
5. Pre-fill the JeloCare fee field with the resolved amount.

### Operator override

The operator can still override the resolved fee by editing the field. The
quote stores both:

- `service_fee_policy_id` — which policy was resolved
- `service_fee_policy_resolved_ngn` — what the policy suggested

This creates a full audit trail: "policy said X, operator entered Y."

### Policy management

Admins can manage policies at `/ops/service-fees`:

- Create, edit, and deactivate policies
- Set retailer-specific or state-specific rules
- Adjust priority (higher = checked first)
- Preview the fee calculation in the quote form hint

The default seed policy is 5% of product subtotal, floored at 500 NGN, capped
at 5,000 NGN. Adjust or add retailer-specific policies as needed.

For a local browser journey, use
`ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE=true`. The fixture is refused in
Production and exists only to exercise the exact guest workflow without
writing customer data.

### Authenticated Operations browser check

Do not count an unauthenticated `/ops` 404 as an Operations test. JeloCare Ops
has two real gates: a Neon Auth session minted from the email one-time code,
then an active `moderation_operators` allowlist row for that verified subject.
Use the existing [ADR 0007](../adr/0007-internal-moderation-operations-console.md)
path; never fabricate an auth cookie or copy a session from another project.

Local `.env.local` values can be stale placeholders. Resolve the current
JeloCare project and primary branch with `neonctl projects list` and
`neonctl branches list`, then obtain these values without printing them:

- `NEON_AUTH_BASE_URL` from `neonctl neon-auth status`;
- an ephemeral 32-byte-or-longer `NEON_AUTH_COOKIE_SECRET` for localhost;
- `APP_DATABASE_URL` from `neonctl connection-string` using the restricted
  `jelocare_app_runtime` role.

Start the app with those process-only values plus the development fixture. Do
not overwrite `.env.local`, persist the ephemeral cookie secret, or use the
database owner URL as `APP_DATABASE_URL`. Open `/sign-in?next=/ops`, request the
real JeloCare code for an active operator, read it from that operator's
authorized mailbox without logging it, and enter it in the browser. The
expected result is the named Ops shell, not the concealed 404 page.

If the email has never signed in, sign in once and run the documented
idempotent bootstrap:

```bash
npm run ops:seed-operator -- \
  --email=operator@example.com \
  --name="Operator" \
  --role=admin
```

That command requires a direct administrative URL in
`MIGRATION_DATABASE_URL`; keep it process-scoped. If the verified user already
has an active row, do not reseed it. If Ops reports that `assisted_orders` is
missing, migration `0039_assisted_procurement.sql` has not been applied; run
the existing `npm run db:migrate` operator once with the same process-scoped
administrative URL before continuing.

With the Ops shell open, the development-fixture acceptance path is:

1. guest product -> basket -> one retailer -> checkout -> `/order`;
2. `/ops/orders` -> Start quoting -> complete five cost fields, expiry,
   evidence, and customer note -> Issue exact quote;
3. guest `/order` -> Approve exact quote;
4. `/ops/orders` -> record fixture payment evidence matching the exact approved
   total, then start procurement;
5. record the retailer confirmation, dispatch/tracking reference, and delivery;
6. guest `/order` -> submit a private return request;
7. `/ops/orders` -> approve or decline it; for approval, record one unique
   refund completion reference and confirm the order closes as refunded.

The fixture transition is explicitly development-gated and exercises the same
state/access/event/notification rules without contacting Paystack or writing
customer data. It is interaction evidence, not provider settlement evidence.
Production payment acceptance still requires a disposable SQL order and
Paystack test mode; never manufacture production lifecycle state with SQL.

## Payment

After a customer approves a quote, the order enters `payment_pending`. The
customer can pay via Paystack (online checkout) or direct bank transfer.

### Paystack (automatic verification)

1. The customer clicks "Pay" on their private order page.
2. The server reserves one active attempt and its exact provider reference in
   PostgreSQL, initializes that same reference, then persists the returned
   authorization URL and access code before returning the URL.
3. A duplicate click reuses only the persisted URL for that attempt. It never
   initializes another transaction while the first remains live. An incomplete
   reservation returns a retryable response; once stale, the server verifies
   the reserved reference with Paystack before it can retire that attempt.
4. The customer is redirected to Paystack's secure checkout (card, bank
   transfer, USSD).
5. Paystack sends a webhook to `POST /api/payments/webhook` with an
   HMAC-SHA512 signature created with the account secret key.
6. The webhook verifies the signature, then calls the Paystack API to verify
   the transaction independently.
7. The returned reference must be exact, currency must be `NGN`, `paid_at` must
   be valid, and integer kobo must match both the reserved attempt and locked
   approved quote. Only then is the payment marked `verified` and the order
   transitioned to `paid` in one transaction.
8. A recoverable commit mismatch returns non-2xx for provider retry. A permanent
   evidence anomaly also returns non-2xx and first appends an idempotent
   `payment_review_required` record visible in Ops; received funds are never
   mislabeled failed merely because evidence needs review.

### Manual bank transfer (operator verification)

1. The customer pays to JeloCare's bank account outside the app.
2. The operator independently reads and enters the amount received plus the
   bank transaction reference and a short evidence description in `/ops/orders`.
3. One transaction compares that observed amount with the locked approved quote,
   then creates the verified `manual_bank_transfer` record. A copied or
   mismatched amount cannot advance the order, and a normalized bank transaction
   reference cannot be credited to a second order.
4. The order transitions to `paid` with the operator's subject recorded as the
   verifier.

### Governed evidence

An order can only become `paid` when:

- A payment record exists with `status = 'verified'`.
- The payment amount matches the approved quote total.
- The payment has an evidence reference (Paystack reference + paid_at, or
  operator-entered evidence).
- Only one verified payment is allowed per order (unique index).

A button click, chat reply, or unverified staff note cannot establish the
`paid` state. The governed automatic and manual repository transactions are
the only paths from `payment_pending` to `paid`.

An online payment can only be initialized before the approved quote expires.
Provider settlement must report a `paid_at` inside that quote's issued-to-expiry
window. A late successful charge is preserved as provider evidence for Ops
review and never silently advances or fails the order. When an expired quote has
no live provider attempt, it safely returns to `needs_response` for a fresh quote.

### Environment variables

| Variable                | Required                 | Description                                               |
| ----------------------- | ------------------------ | --------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Yes (for online payment) | Stripe secret key (`sk_...`). Server-only.                |
| `STRIPE_WEBHOOK_SECRET` | Yes (for webhook verify) | Stripe webhook signing secret (`whsec_...`). Server-only. |

Stripe signs webhooks with a separate `STRIPE_WEBHOOK_SECRET` (not the API key).
The `Stripe-Signature` header carries `t=timestamp,v1=HMAC-SHA256` which the
webhook route verifies with replay-attack tolerance.

Repository integration tests require an explicitly disposable writable URL in
`PAYMENT_INTEGRITY_TEST_DATABASE_URL`. It is test-process-only and must never be
set in Vercel.

Migration `0050_payment_integrity.sql` deliberately stops if legacy active
Paystack attempts, malformed ledger rows, or reused manual bank references are
ambiguous. Reconcile those exact provider records first, record the outcome in
the governed payment/event path, and rerun the migration; never delete or pick
a surviving payment row by guesswork.

Migration `0052_stripe_payment_provider.sql` adds `stripe` as a valid provider
alongside the legacy `paystack` and `manual_bank_transfer`. New payments use
Stripe Checkout; historical Paystack rows remain valid for audit.

When Stripe is not configured, the customer sees bank transfer instructions
and the operator can still verify manual payments.

## Preserved boundaries

Checkout's delivery step uses the optional, server-proxied Nigeria location
helper documented in [Smart delivery and saved locations](SMART_LOCATIONS.md).
Manual entry remains complete and account-free. Signed-in customers may copy
one owner-isolated saved delivery location into the order; the order stores the
same bounded address fields as before and never stores a private-location ID,
provider response, coordinates, or billing location.

- Never silently split a basket, substitute a SKU, scrape around a retailer
  control, or treat an unknown fee as zero.
- WhatsApp is optional manual transport under recorded consent; chat is never
  canonical order state.
- A customer approval is not payment evidence. A redirect, message, screenshot,
  or staff note cannot make an order paid.
- The append-only event record is corrected forward, never rewritten.
- Notification transport never owns order state. A failed email leaves the
  canonical event intact and visible to Operations for bounded retry.
- Ops quote entry progressively discloses one decision at a time, preserves the
  draft while moving back, and runs the existing governed quote write only from
  the final review. Exact retailer links open separately so a blocked iframe or
  third-party page cannot replace the authenticated Ops workspace.
