import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createStripeCheckoutSession,
  isStripeConfigured,
  stripeSecretKey,
  retrieveStripeCheckoutSession,
  verifyStripeWebhookSignature,
} from "../../lib/commerce/stripe-provider";
import {
  mapPaymentRow,
  type PaymentProvider,
  type PaymentStatus,
} from "../../lib/commerce/payment-repository";
import {
  ngnToKobo,
  normalizeKoboAmount,
  normalizeNgnAmount,
} from "../../lib/commerce/payment-money";
import { resolvePaymentOrderAccess } from "../../lib/commerce/payment-order-access";
import {
  boundedPaymentEvidenceText,
  providerSettlementDate,
} from "../../lib/commerce/payment-review";
import { successfulEvidenceProblem } from "../../lib/commerce/payment-service";
import type { AssistedOrderPrivateView } from "../../lib/commerce/assisted-procurement-repository";

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("payment migrations establish numeric and idempotency boundaries", async () => {
  const original = await readFile(
    new URL(
      "../../db/migrations/0047_assisted_order_payments.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const numeric = await readFile(
    new URL(
      "../../db/migrations/0048_money_columns_to_numeric.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const integrity = await readFile(
    new URL("../../db/migrations/0050_payment_integrity.sql", import.meta.url),
    "utf8",
  );
  const stripe = await readFile(
    new URL(
      "../../db/migrations/0052_stripe_payment_provider.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(original, /create table assisted_order_payments/);
  assert.match(
    original,
    /unique index assisted_order_payments_one_verified_per_order/,
  );
  assert.match(numeric, /amount_ngn type numeric\(12,2\)/);
  assert.match(
    integrity,
    /duplicate active Paystack attempts require provider reconciliation/,
  );
  assert.match(integrity, /active_paystack_quote_idx/);
  assert.match(integrity, /paystack_reference_idx/);
  assert.match(integrity, /manual_reference_idx/);
  assert.match(integrity, /pg_input_is_valid/);
  assert.match(integrity, /'payment_confirmed'/);
  assert.match(integrity, /'payment_issue'/);
  assert.match(integrity, /'suppressed'/);
  assert.match(stripe, /provider_check/);
  assert.match(stripe, /'stripe'/);
  assert.match(stripe, /active_stripe_quote_idx/);
  assert.match(stripe, /stripe_reference_idx/);
});

test("NGN normalization converts decimal text to exact integer kobo", () => {
  assert.equal(normalizeNgnAmount("0.29"), 0.29);
  assert.equal(normalizeNgnAmount("123.45"), 123.45);
  assert.equal(normalizeNgnAmount(123.45), 123.45);
  assert.equal(normalizeNgnAmount("123.4"), 123.4);
  assert.equal(ngnToKobo("0.29"), 29);
  assert.equal(ngnToKobo("123.45"), 12_345);
  assert.equal(normalizeKoboAmount(12_345), 12_345);
  assert.throws(() => normalizeNgnAmount("123.456"), /Invalid NGN/);
  assert.throws(() => normalizeNgnAmount(0.1 + 0.2), /Invalid NGN/);
  assert.throws(() => normalizeNgnAmount("1e3"), /Invalid NGN/);
  assert.throws(() => normalizeKoboAmount(12.5), /Invalid kobo/);
});

test("Ops payment evidence safely bounds and parses provider values", () => {
  assert.equal(providerSettlementDate("not-a-date"), null);
  assert.equal(
    providerSettlementDate("2026-08-14T10:00:00.000Z")?.toISOString(),
    "2026-08-14T10:00:00.000Z",
  );
  assert.equal(boundedPaymentEvidenceText(` ${"x".repeat(250)} `)?.length, 200);
});

test("repository mapping normalizes PostgreSQL numeric strings", () => {
  const payment = mapPaymentRow({
    id: "payment-id",
    order_id: "order-id",
    quote_version: 2,
    amount_ngn: "123.45",
    provider: "stripe",
    provider_reference: "JC-REF",
    status: "pending",
    evidence_reference: null,
    verified_by_subject: null,
    verified_at: null,
    provider_metadata: {
      phase: "ready",
      reservedAt: "2026-08-14T10:00:00.000Z",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test",
      providerSessionId: "cs_test_123",
      initializedAt: "2026-08-14T10:00:01.000Z",
    },
    created_at: "2026-08-14T10:00:00.000Z",
    updated_at: "2026-08-14T10:00:01.000Z",
  });
  assert.equal(payment.amountNgn, 123.45);
  assert.equal(payment.providerInitialization?.phase, "ready");
  assert.equal(
    payment.providerInitialization?.checkoutUrl,
    "https://checkout.stripe.com/c/pay/cs_test",
  );
  assert.equal(
    payment.providerInitialization?.providerSessionId,
    "cs_test_123",
  );
});

test("repository mapping handles legacy Paystack metadata format", () => {
  const payment = mapPaymentRow({
    id: "payment-id",
    order_id: "order-id",
    quote_version: 1,
    amount_ngn: "99.99",
    provider: "paystack",
    provider_reference: "JC-LEGACY",
    status: "verified",
    evidence_reference: "paystack:JC-LEGACY:2026-01-01T00:00:00.000Z",
    verified_by_subject: null,
    verified_at: "2026-01-01T00:00:00.000Z",
    provider_metadata: {
      phase: "ready",
      reservedAt: "2026-01-01T00:00:00.000Z",
      authorizationUrl: "https://checkout.paystack.com/access",
      accessCode: "access-code",
      initializedAt: "2026-01-01T00:00:01.000Z",
    },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:01.000Z",
  });
  assert.equal(payment.provider, "paystack");
  assert.equal(payment.providerInitialization?.phase, "ready");
  assert.equal(
    payment.providerInitialization?.checkoutUrl,
    "https://checkout.paystack.com/access",
  );
  assert.equal(
    payment.providerInitialization?.providerSessionId,
    "access-code",
  );
});

test("signed-in payment uses only the explicitly owned order", async () => {
  let ownerCalls = 0;
  let sessionCalls = 0;
  const ownerOrder = { id: "owned-order" } as AssistedOrderPrivateView;
  const resolved = await resolvePaymentOrderAccess(
    {
      ownerSubject: "customer:one",
      requestedOrderId: "owned-order",
      sessionHash: "stale-guest-cookie",
    },
    {
      readForOwner: async (orderId, subject) => {
        ownerCalls += 1;
        assert.equal(orderId, "owned-order");
        assert.equal(subject, "customer:one");
        return ownerOrder;
      },
      readBySession: async () => {
        sessionCalls += 1;
        return { id: "guest-order" } as AssistedOrderPrivateView;
      },
    },
  );
  assert.equal(resolved?.order, ownerOrder);
  assert.equal(resolved?.surface, "member");
  assert.equal(ownerCalls, 1);
  assert.equal(sessionCalls, 0);
});

test("guest payment stays bound to the session order", async () => {
  const guestOrder = { id: "guest-order" } as AssistedOrderPrivateView;
  const readers = {
    readForOwner: async () => {
      throw new Error("owner lookup must not run");
    },
    readBySession: async () => guestOrder,
  };
  const exact = await resolvePaymentOrderAccess(
    {
      ownerSubject: null,
      requestedOrderId: "guest-order",
      sessionHash: "session",
    },
    readers,
  );
  assert.equal(exact?.order, guestOrder);
  assert.equal(exact?.surface, "guest");
  assert.equal(
    await resolvePaymentOrderAccess(
      {
        ownerSubject: null,
        requestedOrderId: "different-order",
        sessionHash: "session",
      },
      readers,
    ),
    null,
  );
});

test("signed-in payment accepts only an exact matching guest capability fallback", async () => {
  const guestOrder = { id: "guest-order" } as AssistedOrderPrivateView;
  const readers = {
    readForOwner: async () => null,
    readBySession: async () => guestOrder,
  };
  const exact = await resolvePaymentOrderAccess(
    {
      ownerSubject: "customer:one",
      requestedOrderId: "guest-order",
      sessionHash: "guest-capability",
    },
    readers,
  );
  assert.equal(exact?.order, guestOrder);
  assert.equal(exact?.surface, "guest");
  assert.equal(
    await resolvePaymentOrderAccess(
      {
        ownerSubject: "customer:one",
        requestedOrderId: "different-order",
        sessionHash: "guest-capability",
      },
      readers,
    ),
    null,
  );
});

test("isStripeConfigured requires server key", () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal(isStripeConfigured(), false);
  process.env.STRIPE_SECRET_KEY = "sk_test_dummykey123";
  assert.equal(isStripeConfigured(), true);
  restoreEnvironment("STRIPE_SECRET_KEY", originalSecret);
});

test("webhook HMAC uses STRIPE_WEBHOOK_SECRET with t and v1 format", () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = "whsec_test_webhooksecret";
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  const payload = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { metadata: { reference: "JC-TEST-123" } } },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  const header = `t=${timestamp},v1=${signature}`;
  assert.equal(verifyStripeWebhookSignature(payload, header), true);
  assert.equal(verifyStripeWebhookSignature(payload, "bad"), false);
  assert.equal(verifyStripeWebhookSignature(payload, "t=0,v1=bad"), false);
  restoreEnvironment("STRIPE_WEBHOOK_SECRET", originalSecret);
});

test("Stripe checkout session creation sends form-encoded body with NGN kobo", async () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  process.env.STRIPE_SECRET_KEY = "sk_test_exactreference";
  let postedBody = "";
  globalThis.fetch = async (_input, init) => {
    postedBody = String(init?.body);
    const params = new URLSearchParams(postedBody);
    assert.equal(params.get("mode"), "payment");
    assert.equal(params.get("currency"), "ngn");
    assert.equal(params.get("line_items[0][price_data][unit_amount]"), "12345");
    assert.equal(params.get("line_items[0][price_data][currency]"), "ngn");
    assert.equal(params.get("metadata[reference]"), "JC-ORDER-Q1-EXACT");
    return new Response(
      JSON.stringify({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
        payment_intent: "pi_test_123",
        status: "open",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const result = await createStripeCheckoutSession({
      amountNgn: 123.45,
      reference: "JC-ORDER-Q1-EXACT",
      orderReference: "JC-ORDER",
      customerEmail: "customer@example.com",
      customerName: "Customer",
      successUrl:
        "https://www.jelocare.com/order?payment=return&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://www.jelocare.com/order?payment=cancelled",
    });
    assert.equal(result.sessionId, "cs_test_123");
    assert.equal(result.url, "https://checkout.stripe.com/c/pay/cs_test_123");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment("STRIPE_SECRET_KEY", originalSecret);
  }
});

test("Stripe session retrieval rejects malformed amounts", async () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  process.env.STRIPE_SECRET_KEY = "sk_test_verify";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "cs_test_123",
        status: "complete",
        payment_status: "paid",
        amount_total: 123.45,
        currency: "ngn",
        payment_intent: "pi_test_123",
        metadata: { reference: "JC-REF" },
        created: Math.floor(Date.now() / 1000),
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  try {
    await assert.rejects(
      () => retrieveStripeCheckoutSession("cs_test_123"),
      /Invalid kobo/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment("STRIPE_SECRET_KEY", originalSecret);
  }
});

test("successful evidence requires exact reference, NGN, and paid_at", () => {
  const valid = {
    status: "complete" as const,
    paymentStatus: "paid" as const,
    amountTotalKobo: 12_345,
    currency: "ngn",
    sessionId: "cs_test_123",
    paymentIntentId: "pi_test_123",
    reference: "JC-EXACT",
    paidAt: "2026-08-14T10:00:00.000Z",
  };
  assert.equal(successfulEvidenceProblem("JC-EXACT", valid), null);
  assert.equal(
    successfulEvidenceProblem("JC-OTHER", valid)?.code,
    "reference-mismatch",
  );
  assert.equal(
    successfulEvidenceProblem("JC-EXACT", { ...valid, currency: "usd" })?.code,
    "currency-mismatch",
  );
  assert.equal(
    successfulEvidenceProblem("JC-EXACT", { ...valid, paidAt: null })?.code,
    "missing-settlement-time",
  );
});

test("payment provider types remain narrow", () => {
  const provider: PaymentProvider = "stripe";
  const status: PaymentStatus = "pending";
  assert.equal(provider, "stripe");
  assert.equal(status, "pending");
  const original = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "invalid-key";
  assert.equal(stripeSecretKey(), null);
  restoreEnvironment("STRIPE_SECRET_KEY", original);
});

test("Ops manual verification requires independently entered received amount", async () => {
  const actions = await readFile(
    new URL("../../app/(ops)/ops/orders/actions.ts", import.meta.url),
    "utf8",
  );
  const queue = await readFile(
    new URL("../../app/(ops)/ops/orders/OrdersQueue.tsx", import.meta.url),
    "utf8",
  );
  assert.match(actions, /requireConsoleOperator/);
  assert.match(actions, /receivedAmountNgn/);
  assert.match(queue, /Amount received \(NGN\)/);
  assert.match(queue, /receivedAmountNgn: receivedAmount/);
  assert.match(queue, /Bank transaction reference/);
  assert.match(actions, /providerReference: z\.string\(\)\.trim\(\)\.min\(6\)/);
});

test("payment route binds callbacks to member and guest order surfaces", async () => {
  const route = await readFile(
    new URL("../../app/api/orders/current/payment/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /resolvePaymentOrderAccess/);
  assert.match(
    route,
    /access\.surface === "member" \? "\/me\/orders" : "\/order"/,
  );
  assert.match(route, /PaymentInitializationPendingError/);
});

test("webhook retries recoverable failures and acknowledges recorded anomalies", async () => {
  const route = await readFile(
    new URL("../../app/api/payments/webhook/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /if \(!result\.retryable\)/);
  assert.match(route, /\{ status: 503 \}/);
  assert.doesNotMatch(route, /Always return 200/);
  const service = await readFile(
    new URL("../../lib/commerce/payment-service.ts", import.meta.url),
    "utf8",
  );
  assert.match(service, /recordPaymentReviewRequired/);
  assert.match(service, /amount-mismatch/);
});
