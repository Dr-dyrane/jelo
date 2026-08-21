# Active implementation lanes

Updated: 2026-08-14

This is the short-lived coordination board for Codex, Devin, and other agents.
`AGENTS.md` owns durable cross-agent rules. `.codex/context-system/work-ledger.md`
owns completed handbacks and release evidence. Remove completed reservations
from this file after integration instead of turning it into another history.

## Integration boundary

- Integration owner: root Codex task.
- Starting revision: `01b7fa640be864a61b2aac98154a249f76d40692`.
- Release authority: follow the existing `ship-after-gates` contract in the
  work ledger. Database mutation still requires the protected operator gate and
  production-shaped rehearsal.
- Existing catalogue edits in the main checkout are user/other-agent owned and
  excluded from this wave.

## Lane reservations

| Lane                       | State                                                                                      | Integrated scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Explicit exclusions                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Migration governance       | Integrated; rehearsal passed                                                               | Checksummed migration ledger, strict inventory, status/repair/rehearsal/promotion tools, migration docs                                                                                                                                                                                                                                                                                                                                                                                                     | Application UI and production mutation before the accepted release revision         |
| Order lifecycle            | Integrated; authenticated browser gate pending                                             | Guest/member/Ops lifecycle, notifications, tracking, delivery, returns/refunds, `0051_order_lifecycle.sql`                                                                                                                                                                                                                                                                                                                                                                                                  | Other `/me` pages and catalogue evidence                                            |
| My JeloCare experience     | Integrated; release gate pending                                                           | `/me` home, explore, shelf, routine, product, consult, locations/account visual and interaction system                                                                                                                                                                                                                                                                                                                                                                                                      | `/me/orders`, payment, schema and migrations                                        |
| Trend evidence correction  | Active; `/root/trend_evidence_regression`; base `b034dcb0a38f47922c50d36271f6a5805949c2e6` | `lib/share/product-trends.ts`, `lib/inventory/static-price-trends.ts`, focused trend tests and directly governing trend documentation                                                                                                                                                                                                                                                                                                                                                                       | Offer/catalogue mutations, chart redesign, migrations, push/deploy                  |
| Integration and release    | Active                                                                                     | Conflict resolution, broad gates, guest browser E2E, migration rehearsal evidence, authenticated Ops/member E2E, commit/push/deploy                                                                                                                                                                                                                                                                                                                                                                         | Unrelated catalogue edits and user-owned campaign assets                            |
| Stripe payment provider    | Active; `/root/stripe_migration`; base `b034dcb0a38f47922c50d36271f6a5805949c2e6`          | `lib/commerce/stripe-provider.ts`, `payment-provider.ts`, `payment-service.ts`, `payment-repository.ts`, `assisted-procurement-repository.ts`, `app/api/payments/webhook/route.ts`, `app/api/orders/current/payment/route.ts`, `components/commerce/order-status.tsx`, `components/me/orders/member-orders-view.tsx`, `app/(ops)/ops/orders/OrdersQueue.tsx`, `db/migrations/0052_stripe_payment_provider.sql`, `modules/commerce/payment.test.ts`, `.env.example`, `docs/commerce/ASSISTED_PROCUREMENT.md` | Catalogue, trend, consult, and `/me` non-payment pages                              |
| Clinical wisdom enrichment | Active; base `520109cc`                                                                    | `data/product-ingredients.ts`, `modules/clinical/core/ingredients.ts`, `lib/clinical/concern-lexicon.ts` (new), `modules/clinical/consult-timeline.ts`, `modules/clinical/consult-report.ts`, `modules/recommendations/clinical-product-filter.ts`, `data/product-care-review.ts`, `docs/strategy/DATA_TO_WISDOM_PATHWAY.md`                                                                                                                                                                                | Consult route composition (owned by consult lane), payment, migrations, push/deploy |

## Cross-agent rules

1. Read `AGENTS.md` and this file before editing.
2. Record exact paths and base before starting. An active reservation wins until
   explicitly transferred.
3. Do not edit another lane's reserved paths or stage unrelated dirty files.
4. Draft SQL belongs only in ignored `.migration-rehearsal/`; canonical SQL is
   promoted unchanged after exact-byte Neon rehearsal.
5. Never rewrite, delete, renumber, or manually bless canonical migrations or
   `schema_migrations` rows.
6. Run focused verification inside a lane and one broad integration gate after
   merge. One independent review and one bounded correction are the default.
7. Devin or another agent must update this table before beginning overlapping
   work. Completed reservations are removed after the release ledger is updated.
