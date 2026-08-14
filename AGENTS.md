# Agent coordination

Multiple agents (Devin, Codex, Claude Code) work on this repository. To
prevent conflicts and lost work, follow these rules.

## Branch discipline

- **Main is the integration branch.** All agents commit to `main` for
  production work. Feature branches use the `codex/<topic>` or
  `devin/<topic>` prefix.
- **Before starting work, fetch and check for divergent branches:**
  ```bash
  git fetch origin
  git branch -a | grep -E "codex/|devin/"
  git log main..<branch> --oneline
  ```
- **If another agent has a branch touching your files, coordinate
  before committing.** Check file overlap with:
  ```bash
  git diff main...<branch> --name-only
  ```

## File ownership map

These files are frequently edited by multiple agents. Check for
conflicts before touching them:

| Area            | Files                                                                                                                | Last agent               |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Order UI        | `components/commerce/order-status.tsx`, `order-status.module.css`, `order-progress.tsx`, `order-progress.module.css` | Devin                    |
| Member orders   | `components/me/orders/member-orders-view.tsx`, `member-orders-view.module.css`                                       | Devin                    |
| Basket/checkout | `components/commerce/procurement-basket.tsx`, `procurement.module.css`                                               | Devin                    |
| Payment service | `lib/commerce/payment-service.ts`, `payment-repository.ts`, `payment-provider.ts`                                    | Codex (integrity system) |
| Payment route   | `app/api/orders/current/payment/route.ts`                                                                            | Codex                    |
| Operator orders | `app/(ops)/ops/orders/OrdersQueue.tsx`, `orders.module.css`, `actions.ts`                                            | Shared                   |
| Shelf/RLS audit | `scripts/audit-customer-shelf-rls.ts`, `lib/customer/shelf-role-attestation.ts`                                      | Codex                    |
| Me telemetry    | `lib/customer/private-telemetry.ts`                                                                                  | Codex                    |
| Navbar          | `components/navigation/site-header.tsx`, `site-header.module.css`                                                    | Devin                    |

## Payment system

Codex implemented a comprehensive payment integrity system in commit
`97a55d0`. This includes:

- Payment attempt reservations with grace periods
- Evidence tracking (reference, currency, settlement time)
- `PaymentSettlementOutsideQuoteWindowError`
- `PaymentQuoteExpiredWithActiveAttemptError`
- `createPaystackReference` for deterministic references
- `normalizeNgnAmount` and `ngnToKobo` helpers
- `recordPaymentReviewRequired` for suspicious payments
- `expireApprovedQuoteAfterPaymentClosed`

**Do not add simple duplicate-payment checks.** The reservation system
handles this. The `readPendingPaystackPaymentForOrder` function in
`payment-repository.ts` is retained but unused — the reservation system
is the active duplicate prevention mechanism.

## Order progress UI

The `OrderProgress` component (`components/commerce/order-progress.tsx`)
is the shared stepper for both `/order` and `/me/orders`. It replaces
the inline steppers that were previously in `order-status.tsx` and
`member-orders-view.tsx`.

Features:

- 5-step progress: Request → Quote → Approve → Payment → Delivery
- Exception state handling (cancelled, refund_pending, refunded)
- Compact mode for member orders list
- Event-based step depth (uses order events to show reached steps)

## Naira formatting

All NGN currency formatters must use:

```typescript
new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
```

This preserves kobo (decimals) when present. The old
`maximumFractionDigits: 0` was a bug that hid decimals. Catalogue price
formatters that use integer kobo amounts correctly keep
`maximumFractionDigits: 0`.

## Test formatting

Tests that match source code with regex must tolerate both single and
double quotes. Prettier may reformat quotes between runs. Use:

```typescript
assert.match(source, /["']expected string["']/);
```

## Deployment

```bash
npm test                    # all tests must pass
git add -A && git commit    # commit
git push origin main        # push
vercel --prod               # deploy
```

Verify after deploy:

- `https://www.jelocare.com/`
- `https://www.jelocare.com/basket`
- `https://www.jelocare.com/checkout`
- `https://www.jelocare.com/order`
- `https://www.jelocare.com/me/orders`
