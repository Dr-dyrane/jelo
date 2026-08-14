# Agent coordination

Multiple agents (Devin, Codex, Claude Code) work on this repository. To
prevent conflicts and lost work, follow these rules.

## Branch discipline

- **Read `LANES.md` before editing.** It is the live, short-lived reservation
  board for Codex, Devin, and other agents. Record an exact base and path scope
  there before beginning overlapping work; an existing reservation wins until
  it is explicitly transferred.
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
| Order UI        | `components/commerce/order-status.tsx`, `order-current-action*`, `order-progress*`                                  | Shared lifecycle contract |
| Member orders   | `components/me/orders/member-orders-view.tsx`, `member-orders-view.module.css`                                       | Shared lifecycle contract |
| Basket/checkout | `components/commerce/procurement-basket.tsx`, `procurement.module.css`                                               | Devin                    |
| Payment service | `lib/commerce/payment-service.ts`, `payment-repository.ts`, `payment-provider.ts`                                    | Codex (integrity system) |
| Payment route   | `app/api/orders/current/payment/route.ts`                                                                            | Codex                    |
| Operator orders | `app/(ops)/ops/orders/OrdersQueue.tsx`, `orders.module.css`, `actions.ts`                                            | Shared                   |
| Shelf/RLS audit | `scripts/audit-customer-shelf-rls.ts`, `lib/customer/shelf-role-attestation.ts`                                      | Codex                    |
| Me telemetry    | `lib/customer/private-telemetry.ts`                                                                                  | Codex                    |
| Migrations      | `db/migrations/**`, `lib/database/migration-*`, `scripts/*migration*`                                                | Platform delivery       |
| Navbar          | `components/navigation/site-header.tsx`, `site-header.module.css`                                                    | Devin                    |

## Migration governance

- Canonical production migrations are immutable files in `db/migrations/`.
  `npm run db:migrations:validate` rejects malformed names, gaps, unexpected
  duplicate versions, invalid wrappers, and changed historical bytes.
- Draft SQL belongs only in ignored `.migration-rehearsal/`. Rehearse it on a
  freshly attested production-derived Neon `rehearsal/...` branch, then promote
  the exact unchanged bytes with `db:migrations:promote`.
- `db:migrations:status` is the read-only plan. `db:migrations:repair` is the
  only exceptional ledger writer and requires exact effect evidence, checksum,
  operator reference, advisory lock, and protected direct administrator URL.
  Never manually insert, rename, delete, renumber, or mark a migration applied.
- Vercel never receives migration authority. Production migration or repair is
  a protected operator release after the same revision passes rehearsal. Read
  `docs/data/NEON.md` and the migration section of `docs/operations/RUNBOOKS.md`
  before any database action.

## Payment system

The comprehensive payment integrity system is integrated in `2dc65f9`. This
includes:

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

## Order lifecycle

Migration `0051_order_lifecycle.sql` and the assisted-procurement domain own the
canonical customer-to-Ops cycle: request, quote, approval, governed payment,
procurement, retailer confirmation, dispatch/tracking, delivery, private return
request, Ops return decision, refund evidence, and closure.

- Guest `/order` and authenticated `/me/orders` share lifecycle-aware current
  actions and never infer authority from a stale guest cookie.
- Ops owns transitions and evidence. UI-only state strings are not a completed
  lifecycle; every visible transition must have a guarded repository action,
  event, notification, and access check.
- Preserve the payment reservation system. Refund completion requires a unique
  operator-recorded reference; WhatsApp links must not prefill order/payment or
  private customer data.
- Development fixtures must remain explicitly development-gated and must not
  weaken production database, payment-provider, auth, or notification paths.

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
npm run db:migrations:validate
npm test
npm run typecheck
npm run docs:check
npm run verify:release
git status --short
git add <only-the-reserved-reviewed-paths> && git commit
git push origin main        # only with recorded release authority
vercel --prod               # only after the exact pushed revision is ready
```

If the revision contains a migration, follow the protected rehearsal/status/
operator sequence before deploying dependent application code. Never use
`git add -A` in a dirty multi-agent checkout and never attach migrations to the
Vercel build.

Verify after deploy:

- `https://www.jelocare.com/`
- `https://www.jelocare.com/basket`
- `https://www.jelocare.com/checkout`
- `https://www.jelocare.com/order`
- `https://www.jelocare.com/me/orders`
