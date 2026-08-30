# Business evidence register

Updated: 2026-08-30

The business evidence register is a private, read-only daily aggregate. It
answers what the durable assisted-order record proves in one fixed rolling
30-day request cohort and makes missing evidence explicit. It is not a ledger,
analytics event collector, reconciliation job, financial statement, or Ops
surface.

## Runtime contract

`GET /api/cron/business-evidence` requires the existing `CRON_SECRET` bearer
header. Vercel invokes it once daily at 05:23 UTC. The route executes one SQL
statement made only of `SELECT` common-table expressions, returns `private,
no-store` JSON, writes a bounded structured summary to runtime logs, and
reports `writesPerformed: 0`. A missing runtime database configuration, query
failure, missing aggregate row, or malformed aggregate produces a structured
failure log and HTTP 500; it never falls back to zeros.

The route does not store a snapshot. It does not reconcile a payment, advance
an order, send email, touch a queue or cache, call an external provider, or
mutate any database record.

## Cohort and schema inputs

The half-open window is `order.created_at >= start AND order.created_at < end`,
where `end` is the run time and `start` is exactly 30 days earlier. Later-stage
events are included only through `end`. The fixed inputs are:

- `assisted_orders`: request time and current lifecycle state.
- `assisted_order_events`: append-only quote, approval, payment, fulfilment,
  return, refund, cancellation, and evidence milestones.
- `assisted_order_quotes`: exact approved quote component amounts.
- `assisted_order_payments`: terminal payment status and governed settlement
  evidence.
- `assisted_order_refunds`: initiation and completion evidence.

No mutable schema or migration is introduced.

## Metrics and proof rules

Stage counts report orders that reached request, quote, approval, governed
payment, retailer confirmation, dispatch, delivery, return request, refund
initiation, refund completion, and operational closure. Closure means the
current state is cancelled or refunded, or delivered with no unresolved return
request. A declined return closes at the decline event. Conversion pairs carry
their exact eligible population, converted population, and percentage; no
cross-branch denominator is implied.

Each SLA pair reports eligible, measured, missing, and invalid populations plus
p50 and p95 seconds for non-negative measured durations. Stripe payment time
uses the validated `observedPaidAt` evidence on the append-only payment event;
manual payment falls back to the governed verification event time. Missing or
time-inverted pairs never enter a percentile.

Settled amounts include only verified payments whose exact quote version has a
complete product subtotal, JeloCare service fee, delivery amount, and total
equal to the verified payment **and** whose append-only `payment_verified`
event exactly matches the payment ID, quote version, provider, provider
reference, amount, currency, and payment evidence reference. Stripe settlement
also requires its valid observed payment time. If any verified payment lacks
either proof, every aggregate monetary field is `null` rather than partial.
Amounts are decimal NGN strings with two fraction digits.

The settled amount object names each population directly:
`verifiedPayments`, complete/missing quote breakdowns,
complete/missing payment evidence, and fully proven/incomplete settlements.
This keeps a payment-event mismatch distinct from a quote-component gap.

Evidence completeness is aggregate-only:

- terminal payment: every verified, failed, or abandoned payment requires the
  matching canonical event. Verified events bind the exact provider, provider
  reference, amount, currency, quote version, payment ID, and evidence
  reference. Failed and abandoned events bind their exact provider, null-safe
  provider/evidence references, payment ID, quote version, action, and terminal
  status;
- settled payment: every verified payment must pass the stricter governed
  payment-event match above;
- payment review: every review event requires its fixed payment/provider
  metadata, quote version, reason, and evidence reference;
- refund initiation: every refund row requires its payment link, initiation
  time, and initiation evidence;
- refund completion: every completed refund requires completion time,
  completion reference, and completion evidence.

## Privacy boundary

The statement's final projection returns only counts, percentages, duration
aggregates, NGN totals, fixed status enums, and window timestamps. Payment and
event references are compared only inside the database to prove exact equality;
they never leave the aggregate statement. The route never returns names,
emails, owner/operator subjects, order or payment references, products,
concerns, queries, URLs, row-level records, reasons, notes, metadata, or other
free text. Logs use the same aggregate boundary and omit amounts.

## Fixed cost completeness

The durable quote/payment schema makes settled product, JeloCare service-fee,
delivery, and total amounts available. The register explicitly marks these
inputs unavailable because no accepted durable source exists: Stripe fees,
operator labour, messaging/AI cost, retailer variance, customer acquisition
cost, chargeback/refund loss, contribution margin, and repeat-order/cohort
proof. It does not derive or estimate any of them.
