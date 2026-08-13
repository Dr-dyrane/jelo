# Order-service notifications

Updated: 2026-08-13

JeloCare notifications currently mean one narrow thing: private updates about
an assisted order the customer already created. They are not marketing,
treatment reminders, refill alerts, price-pressure messages, or campaigns.

## How it works

1. Operations records a governed customer-visible order event.
2. The database creates exactly one notification for that event ID.
3. A signed-in customer can read it at `/me/notifications`; a guest continues
   to read the same canonical order on `/order`.
4. If that order has explicit email consent, the existing JeloCare
   transactional provider sends a generic private update. If not, delivery is
   marked suppressed.
5. Ops sees pending, sent, failed, or suppressed. A failed send can be retried
   up to the bounded attempt limit. Email failure never changes order state.

The customer can switch email off per order at any time. That immediately
suppresses unsent email while keeping the private event history intact.

The private order page also exposes a customer-initiated WhatsApp support link
to JeloCare at `+234 812 288 7847`. Its generic URL,
`https://wa.me/2348122887847`, carries no order ID, capability, customer detail,
product, price, or prefilled message. It does not represent automated WhatsApp
delivery; staff contact remains manual and consent-governed.

## Authority and privacy

- `assisted_order_events` remains canonical.
- `assisted_order_notifications.event_id` is unique and provides deduplication.
- The signed-in owner is always derived from the server session. Guest access
  is limited to the existing order-scoped HttpOnly capability.
- Email subject and preview are generic. Products, prices, address, phone,
  clinical context, and capability tokens do not enter provider metadata.
- The notification record cannot outlive its parent order retention.
- Operations mutations require `orders.manage`; viewing the queue requires
  `orders.read`.

## Operating and release check

Apply `0041_assisted_order_notifications.sql` with the protected migration
owner, then deploy the application. For one controlled order, test consent off
and on, issue a quote, verify the customer inbox, verify Ops delivery state,
exercise one failed retry, mark the inbox item read, switch email off, and
confirm no unsent email remains eligible. Do not add a notification cron: the
current bounded path delivers after the Ops event and exposes retry in Ops.

The complete order journey and environment rules remain in
[Assisted procurement](./ASSISTED_PROCUREMENT.md); the policy boundary remains
in [ADR 0016](../adr/0016-retailer-scoped-assisted-procurement.md).
