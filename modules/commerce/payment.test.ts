import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  isPaystackConfigured,
  paystackSecretKey,
  verifyPaystackWebhookSignature,
} from "../../lib/commerce/payment-provider";
import * as paymentRepository from "../../lib/commerce/payment-repository";
import * as paymentService from "../../lib/commerce/payment-service";

test("migration 0047 creates assisted_order_payments with correct structure", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(
    new URL(
      "../../db/migrations/0047_assisted_order_payments.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /create table assisted_order_payments/);
  assert.match(sql, /order_id uuid not null references assisted_orders/);
  assert.match(sql, /quote_version integer not null/);
  assert.match(sql, /amount_ngn integer not null/);
  assert.match(sql, /provider text not null check/);
  assert.match(sql, /paystack.*manual_bank_transfer/);
  assert.match(sql, /status text not null default 'pending'/);
  assert.match(sql, /verified/);
  assert.match(sql, /evidence_reference/);
  assert.match(sql, /verified_by_subject/);
  assert.match(sql, /verified_at/);
  assert.match(sql, /revoke all privileges/);
  assert.match(sql, /jelocare_app_runtime/);
  assert.match(sql, /revoke delete/);
  assert.match(sql, /unique index.*one_verified_per_order/);
});

test("payment-provider module exports required functions", () => {
  assert.equal(typeof isPaystackConfigured, "function");
  assert.equal(typeof paystackSecretKey, "function");
  assert.equal(typeof verifyPaystackWebhookSignature, "function");
});

test("payment-repository module exports required functions", () => {
  assert.equal(typeof paymentRepository.createPayment, "function");
  assert.equal(typeof paymentRepository.readPaymentByReference, "function");
  assert.equal(typeof paymentRepository.listPaymentsForOrder, "function");
  assert.equal(
    typeof paymentRepository.readVerifiedPaymentForOrder,
    "function",
  );
  assert.equal(
    typeof paymentRepository.verifyPaymentAndMarkOrderPaid,
    "function",
  );
  assert.equal(typeof paymentRepository.updatePaymentStatus, "function");
});

test("payment-service module exports required functions", () => {
  assert.equal(typeof paymentService.initiatePaystackPayment, "function");
  assert.equal(typeof paymentService.handlePaystackWebhookEvent, "function");
  assert.equal(typeof paymentService.manuallyVerifyPayment, "function");
});

test("isPaystackConfigured returns false when no env vars are set", () => {
  const original = process.env.PAYSTACK_SECRET_KEY;
  const originalPub = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  delete process.env.PAYSTACK_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  assert.equal(isPaystackConfigured(), false);
  process.env.PAYSTACK_SECRET_KEY = original;
  process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY = originalPub;
});

test("paystackSecretKey rejects non-sk prefixed values", () => {
  const original = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = "invalid-key";
  assert.equal(paystackSecretKey(), null);
  process.env.PAYSTACK_SECRET_KEY = original;
});

test("paystackSecretKey accepts sk-prefixed values", () => {
  const original = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = "sk_test_dummykey123";
  assert.equal(paystackSecretKey(), "sk_test_dummykey123");
  process.env.PAYSTACK_SECRET_KEY = original;
});

test("verifyPaystackWebhookSignature returns false for empty signature", () => {
  const original = process.env.PAYSTACK_WEBHOOK_SECRET;
  process.env.PAYSTACK_WEBHOOK_SECRET = "test-secret";
  assert.equal(verifyPaystackWebhookSignature("{}", ""), false);
  process.env.PAYSTACK_WEBHOOK_SECRET = original;
});

test("verifyPaystackWebhookSignature returns false when no secret is set", () => {
  const original = process.env.PAYSTACK_WEBHOOK_SECRET;
  delete process.env.PAYSTACK_WEBHOOK_SECRET;
  assert.equal(verifyPaystackWebhookSignature("{}", "abc123"), false);
  process.env.PAYSTACK_WEBHOOK_SECRET = original;
});

test("verifyPaystackWebhookSignature validates correct HMAC-SHA512", () => {
  const original = process.env.PAYSTACK_WEBHOOK_SECRET;
  const secret = "test-webhook-secret";
  process.env.PAYSTACK_WEBHOOK_SECRET = secret;
  const payload = JSON.stringify({
    event: "charge.success",
    data: { reference: "JC-TEST-123", status: "success", amount: 500000 },
  });
  const expectedSignature = createHmac("sha512", secret)
    .update(payload)
    .digest("hex");
  assert.equal(
    verifyPaystackWebhookSignature(payload, expectedSignature),
    true,
  );
  process.env.PAYSTACK_WEBHOOK_SECRET = original;
});

test("verifyPaystackWebhookSignature rejects wrong secret", () => {
  const original = process.env.PAYSTACK_WEBHOOK_SECRET;
  process.env.PAYSTACK_WEBHOOK_SECRET = "correct-secret";
  const payload = '{"event":"charge.success"}';
  const wrongSignature = createHmac("sha512", "wrong-secret")
    .update(payload)
    .digest("hex");
  assert.equal(verifyPaystackWebhookSignature(payload, wrongSignature), false);
  process.env.PAYSTACK_WEBHOOK_SECRET = original;
});

test("payment provider types are correctly exported", () => {
  const provider: paymentRepository.PaymentProvider = "paystack";
  const status: paymentRepository.PaymentStatus = "pending";
  assert.equal(provider, "paystack");
  assert.equal(status, "pending");
});

test("manual payment action requires operator access", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../app/(ops)/ops/orders/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /requireConsoleOperator/);
  assert.match(source, /assertCan/);
  assert.match(source, /orders\.manage/);
  assert.match(source, /verifyManualPaymentAction/);
  assert.match(source, /manuallyVerifyPayment/);
});

test("webhook endpoint verifies Paystack signature", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../app/api/payments/webhook/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /verifyPaystackWebhookSignature/);
  assert.match(source, /x-paystack-signature/);
  assert.match(source, /handlePaystackWebhookEvent/);
  assert.match(source, /charge\.success/);
});

test("payment initiation endpoint checks sameSite and rate limit", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../app/api/orders/current/payment/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /sameSiteRequest/);
  assert.match(source, /allowAssistedOrderAction/);
  assert.match(source, /isPaystackConfigured/);
  assert.match(source, /initiatePaystackPayment/);
});

test("customer order status shows payment section for payment_pending", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../components/commerce/order-status.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /PaymentSection/);
  assert.match(source, /payWithPaystack/);
  assert.match(source, /authorizationUrl/);
  assert.match(source, /direct transfer/i);
});

test("operator OrdersQueue has PaymentVerification component", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../app/(ops)/ops/orders/OrdersQueue.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /PaymentVerification/);
  assert.match(source, /verifyManualPaymentAction/);
  assert.match(source, /evidenceReference/);
  assert.match(source, /Mark payment verified/);
});

test("customer-facing state description updated for payment_pending", async () => {
  const mod = await import("../../lib/commerce/assisted-procurement-model");
  const desc = mod.CUSTOMER_VISIBLE_ORDER_STATES.payment_pending;
  assert.match(desc.detail, /Pay to begin/i);
  assert.doesNotMatch(desc.detail, /not yet available/i);
});
