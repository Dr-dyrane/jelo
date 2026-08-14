# ADR 0016: Retailer-scoped assisted procurement

- **Status:** Manual assisted procurement, governed payment, fulfilment, returns, and refunds implemented; external automation gated
- **Date:** 2026-08-11
- **Decision owner:** Founder
- **Extends:** [ADR 0007](0007-internal-moderation-operations-console.md),
  [ADR 0008](0008-public-surface-abuse-and-browser-hardening.md),
  [ADR 0013](0013-founder-led-jelocare-me.md), and
  [ADR 0014](0014-customer-shelf-data-boundary.md)
- **Founder approval:** Recorded from the explicit founder request that
  commissioned this decision on 2026-08-11.

## Outcome

JeloCare may support retailer-scoped assisted procurement as a disclosed
purchasing agent. This extends the evidence-led care journey without turning
JeloCare into an open marketplace or inventory-first retailer.

The customer experience uses normal **Basket**, **Checkout**, **Order**, and
**Track order** language. It is never labelled **Shop for me**. Each order has
exactly one retailer or, in a separately governed future lane, one direct
manufacturer fulfilment source. A comparison may recommend separate orders,
but no single order silently combines multiple retailers.

The manual assisted-procurement release ships a guest-first basket, one-retailer
checkout, private order status, one-time recovery, signed-in order history,
manual Operations quoting, transparent quote approval, and append-only state
history. Explicitly opted-in order-service email and a private signed-in
notification inbox mirror customer-visible canonical events; they are not
marketing and never become order authority. Governed Paystack and independently
observed manual-bank evidence may advance an approved exact quote from Payment
pending to Paid. Authorized Operations staff then record procurement, retailer
confirmation, dispatch, delivery, return decisions, and refund evidence against
that same order. WhatsApp automation, browser automation, retailer checkout,
courier connections, and manufacturer fulfilment remain future gates.

## Why this fits JeloCare

JeloCare already helps a customer understand an exact product and the evidence
for current Nigerian offers. Assisted procurement may carry that decision into
a disclosed purchase without claiming that JeloCare owns stock or that a
catalogue observation is a final retailer quote.

The commercial role must remain legible:

- the retailer supplies and fulfils the exact products;
- JeloCare may act as the customer's disclosed purchasing agent;
- the customer approves the exact retailer, products, quote, fees, and delivery
  terms before payment;
- JeloCare never manufactures availability, authenticity, price, tax, or
  delivery certainty from a catalogue observation; and
- merchant-of-record, tax, payment, refund, chargeback, and contractual roles
  remain undecided until their implementation gates are accepted.

Direct manufacturer collaboration may later become a separate fulfilment
source with its own evidence and contract. It is not a plan to secure official
integrations or partnerships with 30 retailers, and this model has no
dependency on official retailer APIs or unpublished endpoints.

## Customer price and product contract

The price shown on a product page remains an estimate derived from current,
eligible offer evidence. It is not the checkout price. A final quote becomes
possible only after the customer supplies the delivery location needed for a
retailer-specific, address-aware quote and staff verifies the current retailer
terms.

Every quote shows these components separately:

1. product subtotal for the exact approved quantities;
2. retailer service or fulfilment fee, when charged;
3. retailer tax actually observed on the retailer quote, when present;
4. JeloCare service fee; and
5. delivery.

An unknown component stays unknown and prevents a final payable total. It is
never treated as zero or hidden inside another line. The interface may explain
that a line is not charged, but it may not invent a discount, tax treatment, or
fee allocation.

Each line item binds to the immutable exact product identity and approved
quantity. JeloCare requests that exact product. A retailer or operator may not
silently substitute another size, variant, package, reformulation, or similar
product. An unavailable item requires a new customer decision: keep waiting,
remove it, cancel, or explicitly approve a separately evidenced alternative.

A quote records its retailer, delivery scope, currency, complete component
breakdown, evidence reference, observation time, issue time, and expiry. The
customer approves that exact version. Any material price, fee, delivery, tax,
retailer, quantity, or product change invalidates the prior approval and
requires a new quote and explicit reapproval.

## One canonical order, two entry flows

Both customer paths converge on the same canonical order and append-only event
history. Authentication changes who may reopen the order; it does not create a
second operational truth.

### Signed-in JeloCare Me flow

```text
/me customer
  -> basket and one-retailer order request
  -> Operations procurement queue
  -> optional JeloCare WhatsApp contact under recorded consent
  -> operator records governed quote and order transitions
  -> /me reads the canonical order status
```

The verified customer subject owns access to the order in JeloCare Me. The
server derives that subject; no owner identifier is accepted from a route,
query, form, or client payload. WhatsApp contact is optional and must not be a
condition for viewing or progressing an order through JeloCare.

### Guest flow

```text
guest
  -> basket, delivery/contact details, and explicit WhatsApp consent
  -> scoped guest order session (not an account)
  -> Operations procurement queue
  -> JeloCare WhatsApp contacts the submitted number when consent permits
  -> optional private recovery or status link
  -> clean private status page
  -> operator records governed quote and order transitions
  -> refresh or bounded polling reads the same canonical order status
```

A guest session is an order-scoped capability, not a public account, shadow
profile, or JeloCare Me identity. It authorizes only the one order to which it
was issued. It cannot open `/me`, another guest order, another customer's data,
or an Operations route.

The private recovery flow uses a high-entropy opaque capability. Only its hash
is retained. A magic-link request exchanges the short-lived capability into a
scoped, secure, HttpOnly cookie and immediately redirects to a clean status
URL. A successful exchange atomically consumes the capability or atomically
rotates and revokes it; any replay fails closed. Issuing a replacement
capability invalidates every earlier unused capability for the same order and
session purpose. The response is private and no-store and carries a no-referrer
policy.
Phone numbers, addresses, capability tokens, order identifiers, product details,
and quote details never appear in clean URLs, analytics, public caches, or
operator-facing error logs. Exact expiry and retention are implementation
gates, not implied by this decision.

## WhatsApp boundary

WhatsApp is an optional transport and recovery channel. It is never the source
of truth for consent, quote approval, payment, fulfilment, or order state.

- Contact begins only from the number submitted for that order and only under
  explicit, recorded WhatsApp consent.
- A private recovery or status link may be sent to that number after the link
  and expiry contract is implemented.
- A customer's chat reply is ungoverned conversation until an authorized
  operator records the resulting decision or state transition in Operations.
- The status page and `/me` always read the canonical order state, not a chat
  transcript or messaging-provider delivery state.
- Consent withdrawal stops optional WhatsApp contact without removing the
  customer's direct private status path.

Automated sends, inbound webhooks, delivery receipts, templates, and provider
failure handling require a separate accepted implementation boundary. Manual
staff contact is the first permitted operating mode after the consent and
privacy gates are implemented.

The approved public JeloCare contact is `+234 812 288 7847`, exposed only as
the generic customer-initiated URL `https://wa.me/2348122887847`. Order IDs,
capabilities, customer details, products, prices, and prefilled messages must
not be placed in that URL. This contact point does not expand the automated
transport boundary above.

## Order notification boundary

Order-service notifications are a projection of the append-only order record,
not a second state machine. A customer-visible event may create one private
in-app item and, only when the customer explicitly opted in for that order, one
transactional email. The event ID is the deduplication key. Subjects and
lock-screen previews stay generic; product, address, price, and health context
do not enter provider metadata.

Signed-in customers receive a private `/me/notifications` inbox and may manage
email per order. Guests use the scoped `/order` session. Withdrawal suppresses
unsent email immediately without deleting the canonical event or useful private
history. Operations sees pending, sent, failed, or suppressed delivery and may
retry a bounded failed send. Provider failure cannot roll back an order event or
prevent the customer from reading the canonical status directly.

This boundary does not authorize refill reminders, price-pressure alerts,
marketing, campaigns, automated WhatsApp, inbound messaging, or a new cron.
Those remain separate decisions.

## Quoting and retailer access

The first release, if commissioned, uses manual staff quoting. An authorized
operator checks a terms-permitted retailer surface, records the quote evidence,
enters the transparent components, and submits the quote for customer approval.
The recorded quote—not a browser tab, screenshot alone, chat message, or staff
memory—is the governed order input.

Later server-side browser assistance may prepare a quote draft only when the
retailer's terms permit it and a reviewed implementation boundary exists. It
must:

- use public or properly authorized retailer access without evading access
  controls, CAPTCHAs, rate limits, authentication, regional restrictions, or
  other retailer safeguards;
- collect only the minimum evidence needed for the exact order;
- identify the source, observation time, and incomplete or ambiguous fields;
- leave every draft subject to staff review and explicit approval; and
- stop before checkout confirmation, payment, or any other irreversible
  retailer action.

Browser assistance never completes payment and never makes a governed order
decision. An unavailable official API does not block manual quoting and does
not authorize scraping, endpoint imitation, or control bypass.

## Canonical quote and order state

The state model is decision-level and provider-neutral. A future schema may
name implementation values differently only if it preserves these meanings
and transitions.

| State                          | Meaning and permitted next decision                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requested                      | Customer submitted one retailer-scoped basket and contact/delivery inputs. Operations may begin quoting or cancel with a recorded reason.                                                                          |
| Quoting                        | Staff is checking exact products, retailer terms, fees, and delivery. No customer-payable total exists yet.                                                                                                        |
| Awaiting approval              | One complete, timestamped, unexpired quote version is available for the customer to approve or decline.                                                                                                            |
| Quote expired / needs response | The quote expired, the customer declined or requested a change, or a material component changed. Return to quoting or cancel; never carry forward old approval.                                                    |
| Payment pending                | The customer approved the current quote, but governed payment evidence has not established settlement.                                                                                                             |
| Paid                           | A separately accepted payment boundary has recorded sufficient governed evidence for the exact approved quote. A button click, chat reply, browser redirect, or unverified staff note cannot establish this state. |
| Procurement                    | An authorized operator is placing or confirming the exact order with the retailer. Any changed term returns to needs response and reapproval.                                                                      |
| Retailer confirmed             | The retailer has accepted the exact order and the evidence has been recorded.                                                                                                                                      |
| Out for delivery               | The retailer or courier has provided governed dispatch evidence.                                                                                                                                                   |
| Delivered                      | Delivery evidence has been recorded. This does not independently prove product authenticity, suitability, or customer satisfaction.                                                                                |
| Cancelled                      | No further procurement proceeds. The event records actor, reason, timing, and any payment/refund consequence.                                                                                                      |
| Refund pending / refunded      | Used only after the refund and payment-evidence policies are accepted. A refund state never rewrites the original payment or cancellation events.                                                                  |
| Correction                     | An authorized operator records a forward correction to a prior fact or state with a reason and link to the superseded assertion. History is never erased.                                                          |

Invalid jumps fail closed. In particular, an order cannot become paid without
governed payment evidence, enter procurement without approval of the current
quote, or become retailer confirmed, out for delivery, or delivered without
the corresponding recorded evidence. Repeated requests and callbacks must be
idempotent.

The current order projection is derived from append-only order events. Each
event records the order, actor class and attributable actor where available,
action, prior state, resulting state, reason, evidence reference, quote version
where relevant, and authoritative time. Corrections, cancellations, refunds,
retries, and reversals append events; they do not edit or delete earlier
history.

## Operations contract

The first Operations surface is **Triage** mode. Its operator question is:

> What verified step can I complete or record next without changing the exact
> product or the customer's approved cost?

The queue uses the existing private split-view grammar. The main workspace lets
an operator scan orders by truthful stage and waiting context. The inspector
shows customer-approved exact products, retailer and delivery scope, quote
evidence and expiry, transparent cost components, consent/contact constraints,
event history, and one governed next action. The anchored decision region names
the proposed transition, its evidence, the resulting customer-visible state,
and recovery path.

Only allowlisted operators may read or change an order. Customer contact and
delivery details are disclosed only to roles and tasks that require them; they
do not enter queue titles, screenshots, general analytics, catalogue evidence,
retailer ranking, community research, advertising, model training, or public
search. A route may show an intentionally redacted summary before a privileged
disclosure. Export, support access, and redaction remain gated until their
purpose and audit contract are accepted.

## Privacy, consent, and abuse controls

Any implementation inherits the public and private security boundaries:

- bounded, normalized request bodies; same-site mutation checks; separate
  rate limits for create, save, approve, recover, poll, and contact actions;
- explicit consent purpose, channel, time, policy version, withdrawal, and
  operator-visible contact status;
- secure, scoped, HttpOnly cookies and hashed opaque capabilities;
- no secrets or submitted personal data in logs, URLs, analytics, provider
  metadata, cache keys, or public error messages;
- no public caching of basket, quote, order, address, contact, payment, or
  status responses;
- server-derived authority for signed-in customers and order-only capability
  authority for guests;
- idempotency and optimistic concurrency around customer approval and operator
  transitions; and
- fail-closed behavior when identity, capability, quote version, permission,
  evidence, storage, or a required provider is unavailable.

Basket contents, address, contact, urgency, order history, and channel consent
are private customer data. Product choice does not create a diagnosis or
clinical inference and may not become a commercial ranking signal.

## Failure and recovery

- **Retailer unavailable or exact item missing:** return to quoting or needs
  response. Offer only remove, wait, cancel, or a separately evidenced explicit
  alternative; never substitute silently.
- **Price, fee, tax, or delivery changes:** expire the approved quote and
  require a new complete quote and approval before payment or procurement.
- **Payment outcome ambiguous:** remain payment pending. Staff may record
  evidence or start a governed reconciliation; uncertainty never becomes paid.
- **Retailer rejects after payment:** stop procurement and enter the governed
  cancellation/refund path once that policy exists.
- **WhatsApp or email unavailable:** preserve direct `/me` or guest status-page
  access and show honest contact state. Messaging failure cannot change the
  order.
- **Guest loses the cookie:** issue a replacement through a separately verified
  recovery process after its abuse and disclosure risks are accepted. The
  replacement invalidates every earlier unused capability for that order and
  session purpose; no previously exchanged or replaced bearer link is reusable.
  Never disclose whether an arbitrary phone number has an order.
- **Concurrent or repeated action:** accept at most one transition for the
  expected order and quote version; return the fresh canonical state.
- **Operator error:** append a reasoned correction. Do not rewrite history or
  silently restore a prior state.
- **Storage, auth, or permission failure:** deny the action and preserve the
  last governed state for later recovery.

## Phased implementation

Phase 2 and the payment evidence portion of Phase 3 are implemented. The other
phases remain separately gated.

1. **Contracts and prototypes:** decide commercial/legal roles, state and data
   ownership, quote evidence, consent, retention, abuse limits, and route
   vocabulary; validate the two customer flows and Ops job without production
   data.
2. **Manual assisted procurement:** after the required data and security
   decisions, implement one-retailer baskets, signed-in and guest private
   status, the Ops queue, manual quote entry, transparent approval, and manual
   contact. Payment may remain outside the system until its own gate is
   accepted; the interface must say so truthfully.
3. **Governed payment and fulfilment:** Paystack/manual payment evidence,
   idempotency, reconciliation, and exact-quote settlement make `paid`
   operational. Merchant, tax, refund, chargeback, retailer, and courier
   contracts remain required before downstream fulfilment states become
   operational.
4. **Terms-permitted browser drafting:** after manual parity is stable, allow a
   server-side assistant to draft quote evidence for staff approval. It never
   bypasses retailer controls or completes payment.
5. **Transport enhancements:** add automated WhatsApp send/webhook handling or
   real-time status transport only after separate provider, consent, replay,
   abuse, failure, and retention decisions.
6. **Direct manufacturer fulfilment:** treat a manufacturer as its own
   separately contracted fulfilment source, not as a shortcut around exact
   product, quote, payment, audit, or customer-approval gates.

## Implementation gates and future ownership

The following remain explicitly undecided. The future owning lane must record
each choice and evidence before implementation:

| Gate                                 | Future decision required                                                                                                                                                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account claiming                     | Whether and how a guest order can be attached to a later verified account without phone-number matching, authority widening, or order duplication.                                                                                                                      |
| Automated WhatsApp send and webhooks | Provider, approved templates, consent lifecycle, signature and replay verification, rate limits, delivery failure, inbound-message handling, and retention.                                                                                                             |
| Real-time transport                  | Whether polling is sufficient; if not, the authorization, reconnect, ordering, cache, and failure contract for live updates.                                                                                                                                            |
| Payment provider                     | Provider, payment intent ownership, evidence, idempotency, reconciliation, failure states, and secret handling.                                                                                                                                                         |
| Merchant of record                   | Which party sells or acts as agent at each step and what the customer receipt and terms disclose.                                                                                                                                                                       |
| Tax treatment                        | Which observed retailer taxes and JeloCare obligations apply, who calculates them, and how uncertainty is presented.                                                                                                                                                    |
| Chargebacks and refunds              | Eligibility, authority, timelines, partial outcomes, evidence, customer communication, and operational reversal.                                                                                                                                                        |
| Retention and expiry                 | Implemented for this phase: browser baskets persist locally until cleared; order sessions last 30 days; recovery capabilities last 20 minutes and are one-time; quotes carry operator-set expiries; order records retain for 365 days. Payment evidence remains future. |
| Data schema and migration            | Implemented in `db/migrations/0039_assisted_procurement.sql`: private orders, immutable exact line snapshots, versioned quotes, append-only events, scoped guest sessions, one-time recovery, and least-privilege runtime grants.                                       |
| Browser automation                   | Retailer terms review, permitted access, rate and session boundaries, evidence capture, operator approval, failure, and kill switch.                                                                                                                                    |
| Retailer and courier contracts       | Purchase authority, fulfilment responsibility, stock confirmation, service levels, customer data disclosure, cancellation, evidence, incident response, and termination.                                                                                                |
| Manufacturer fulfilment              | Separate agreement, exact-product authority, quote and delivery duties, data access, and customer disclosure.                                                                                                                                                           |

No team may fill one of these gaps with a convenient provider default, inferred
industry practice, hidden fee, fabricated retention period, or speculative
schema.

## Verification before any release

A commissioned phase must prove, at minimum:

- one retailer or separately governed fulfilment source per order;
- exact product identity and explicit substitution refusal across every state;
- estimate-versus-quote language and complete separate fee components;
- quote evidence, issue time, expiry, versioning, and price-change reapproval;
- valid and invalid state transitions, idempotency, concurrency, correction,
  cancellation, payment uncertainty, and recovery;
- append-only attributable order events and agreement between Ops, `/me`, and
  guest status projections;
- signed-in owner isolation and guest one-order authority, including attempts
  to access `/me`, another order, expired links, a stale cookie, replay of a
  successfully exchanged capability, and use of any earlier unused capability
  after a replacement is issued; both replay and replaced-capability use must
  fail closed;
- clean URLs, no-store responses, safe logs, redacted analytics, consent
  withdrawal, rate limits, and abuse paths;
- WhatsApp remaining transport only when messages arrive late, fail, duplicate,
  or conflict with the canonical state;
- Ops Triage behavior at the required private-shell viewport, keyboard, focus,
  loading, empty, partial, error, denied, pending, settled, and long-content
  states; and
- a phase-specific rollback rehearsal that preserves audit and already-created
  customer records.

The release verification is code-bearing. Run the focused assisted-procurement
tests, typecheck, release verifier, migration rehearsal, and the guest browser
journey described in the assisted-procurement runbook before deployment.

## Consequences

- JeloCare can carry evidence-led discovery into a disclosed purchase without
  pretending to own retailer inventory.
- Signed-in and guest customers receive the same governed status semantics;
  guest access remains deliberately narrower than an account.
- Manual quoting can establish operational learning before any integration or
  automation investment.
- Transparent fees and quote reapproval make cost changes visible but add
  deliberate friction before payment.
- Exact-product enforcement may cause an order to pause or fail when stock
  changes. That is safer than a silent substitution.
- Append-only events and staff review add operational work while preserving a
  defensible customer and audit history.
- Official retailer APIs and a portfolio of retailer partnerships are optional
  future accelerators, not architectural prerequisites.

## Alternatives rejected

- **Keep “not a store” as an absolute boundary.** Rejected because a disclosed
  purchasing-agent role can preserve the evidence-led mission while helping a
  customer complete an exact purchase. The narrower prohibition is an open
  marketplace or inventory-first retailer.
- **Label the feature “Shop for me.”** Rejected because it makes an ordinary
  basket and checkout journey sound exceptional and obscures the retailer and
  fee model.
- **Treat catalogue price as the checkout price.** Rejected because address,
  delivery, retailer fees, tax, freshness, and availability can change the
  payable total.
- **Combine retailers in one order.** Rejected because responsibility, fees,
  confirmation, payment, delivery, cancellation, and refund evidence become
  ambiguous. A split option creates separately approved orders.
- **Permit similar-product substitutions.** Rejected because it breaks exact
  identity, care evidence, price approval, and customer agency.
- **Wait for official retailer APIs or broad partnerships.** Rejected as a
  dependency. Manual staff quoting can operate within retailer terms; future
  integrations remain optional and separately governed.
- **Let automation complete retailer checkout or payment.** Rejected because
  it bypasses staff review, customer reapproval, retailer controls, and the
  unresolved commercial and payment boundaries.
- **Use WhatsApp as the order record.** Rejected because chat is not a durable,
  permissioned, auditable state machine and cannot safely serve `/me` and guest
  status views.
- **Create a guest account from a phone number.** Rejected because a scoped
  order capability should not silently become identity, membership, or access
  to JeloCare Me.

## Rollback

Before implementation, rollback is a forward documentation change that removes
the accepted direction and its handbook, North Star, JeloCare Me, and decision-
register references. No runtime or customer data exists under this ADR today.

Every future phase must define its own recoverable disablement and rollback
before release. Removing a customer route may stop new orders, but it must not
erase existing quotes, consent, payment evidence, order events, or audit. A
rollback must preserve private status or a documented support path for active
orders, keep Ops able to finish or cancel governed work, and never downgrade to
WhatsApp or retailer-browser state as the source of truth.
