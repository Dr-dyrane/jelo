# Assisted procurement operations

Updated: 2026-08-13

JeloCare ships a guest-first, one-retailer order-request flow. It is a manual
assisted-procurement service, not retailer checkout and not a marketplace.
The retailer supplies and fulfils the exact products; JeloCare is the disclosed
purchasing agent. No payment is taken in this release.

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
7. Approval ends at `payment_pending`. Paid, procurement, fulfilment, and refund
   transitions stay unavailable until their separate governed releases.

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
2. From a protected operator process, inject the direct administrator URL only
   for `npm run db:migrate`. Migrations `0039_assisted_procurement.sql` and
   `0041_assisted_order_notifications.sql` are additive and grant only the
   application runtime role. Never add the admin URL to Vercel or `.env.local`.
3. Deploy the application revision.
4. Complete the post-deploy journey below before announcing availability.

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
6. Confirm the guest view refreshes to Quote ready; approve it.
7. Confirm guest status, Operations, and signed-in ownership where applicable
   agree on `payment_pending`, with no payment or retailer-purchase control.
8. Use the emailed recovery link once, confirm it opens the same clean order,
   then confirm replay fails. Request a replacement and confirm the older
   unused link fails.
9. Issue another test quote with a short expiry and confirm it becomes
   `needs_response` with an appended `quote_expired` event.
10. Repeat once with email updates off and once with them on. Confirm the
    in-app event exists in both cases, only the opted-in order sends email, Ops
    shows the delivery state, failed delivery can be retried, and switching the
    preference off suppresses unsent email immediately.

## Focused local verification

```bash
node --import tsx --test \
  modules/commerce/assisted-procurement.test.ts \
  modules/me/me-shell-contract.test.ts
npm run typecheck
npm run verify:release
```

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

With the Ops shell open, the complete local acceptance path is:

1. guest product -> basket -> one retailer -> checkout -> `/order`;
2. `/ops/orders` -> Start quoting -> complete five cost fields, expiry,
   evidence, and customer note -> Issue exact quote;
3. guest `/order` -> Approve exact quote;
4. `/ops/orders` -> `QUOTE APPROVED · PAYMENT GATED`.

Stop there. A successful ADR 0016 test must not expose a paid, procurement,
retailer-purchase, WhatsApp, or fulfilment action.

## Preserved boundaries

- Never silently split a basket, substitute a SKU, scrape around a retailer
  control, or treat an unknown fee as zero.
- WhatsApp is optional manual transport under recorded consent; chat is never
  canonical order state.
- A customer approval is not payment evidence. A redirect, message, screenshot,
  or staff note cannot make an order paid.
- The append-only event record is corrected forward, never rewritten.
- Notification transport never owns order state. A failed email leaves the
  canonical event intact and visible to Operations for bounded retry.
