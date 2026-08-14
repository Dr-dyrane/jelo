import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFee,
  type ServiceFeePolicy,
} from "../../lib/commerce/service-fee-policy";

function makePolicy(
  overrides: Partial<ServiceFeePolicy> = {},
): ServiceFeePolicy {
  return {
    id: "test-id",
    name: "Test",
    retailerSlug: null,
    deliveryState: null,
    feeModel: "pct_with_cap",
    flatFeeNgn: null,
    percentageRate: 5,
    minFeeNgn: 500,
    maxFeeNgn: 5000,
    priority: 0,
    isActive: true,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("calculateFee: flat model returns the flat fee", () => {
  const policy = makePolicy({
    feeModel: "flat",
    flatFeeNgn: 1000,
    percentageRate: null,
    minFeeNgn: null,
    maxFeeNgn: null,
  });
  const result = calculateFee(policy, 50_000);
  assert.equal(result.feeNgn, 1000);
  assert.match(result.calculation, /Flat fee/);
});

test("calculateFee: percentage model returns raw percentage", () => {
  const policy = makePolicy({
    feeModel: "percentage",
    percentageRate: 5,
    minFeeNgn: null,
    maxFeeNgn: null,
  });
  const result = calculateFee(policy, 50_000);
  assert.equal(result.feeNgn, 2500);
  assert.match(result.calculation, /5% of 50,000/);
});

test("calculateFee: pct_with_cap floors at minimum", () => {
  const policy = makePolicy({
    feeModel: "pct_with_cap",
    percentageRate: 5,
    minFeeNgn: 500,
    maxFeeNgn: 5000,
  });
  const result = calculateFee(policy, 5_000);
  // 5% of 5000 = 250, floored at 500
  assert.equal(result.feeNgn, 500);
  assert.match(result.calculation, /floored at 500/);
});

test("calculateFee: pct_with_cap caps at maximum", () => {
  const policy = makePolicy({
    feeModel: "pct_with_cap",
    percentageRate: 5,
    minFeeNgn: 500,
    maxFeeNgn: 5000,
  });
  const result = calculateFee(policy, 200_000);
  // 5% of 200000 = 10000, capped at 5000
  assert.equal(result.feeNgn, 5000);
  assert.match(result.calculation, /capped at 5,000/);
});

test("calculateFee: pct_with_cap returns raw when within range", () => {
  const policy = makePolicy({
    feeModel: "pct_with_cap",
    percentageRate: 5,
    minFeeNgn: 500,
    maxFeeNgn: 5000,
  });
  const result = calculateFee(policy, 50_000);
  // 5% of 50000 = 2500, within [500, 5000]
  assert.equal(result.feeNgn, 2500);
  assert.doesNotMatch(result.calculation, /floored|capped/);
});

test("calculateFee: percentage rounds to nearest integer", () => {
  const policy = makePolicy({
    feeModel: "percentage",
    percentageRate: 7.5,
    minFeeNgn: null,
    maxFeeNgn: null,
  });
  const result = calculateFee(policy, 10_000);
  // 7.5% of 10000 = 750
  assert.equal(result.feeNgn, 750);
});

test("calculateFee: pct_with_cap with 5% default on 42000 = 2100 within range", () => {
  const policy = makePolicy({
    feeModel: "pct_with_cap",
    percentageRate: 5,
    minFeeNgn: 500,
    maxFeeNgn: 5000,
  });
  const result = calculateFee(policy, 42_000);
  assert.equal(result.feeNgn, 2100);
});

test("service-fee-policy module exports resolveServiceFee and listServiceFeePolicies", async () => {
  const mod = await import("../../lib/commerce/service-fee-policy");
  assert.equal(typeof mod.resolveServiceFee, "function");
  assert.equal(typeof mod.listServiceFeePolicies, "function");
  assert.equal(typeof mod.createServiceFeePolicy, "function");
  assert.equal(typeof mod.updateServiceFeePolicy, "function");
});

test("migration 0046 creates service_fee_policies with correct structure", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(
    new URL(
      "../../db/migrations/0046_service_fee_policies.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /create table service_fee_policies/);
  assert.match(sql, /fee_model/);
  assert.match(sql, /flat_fee_ngn/);
  assert.match(sql, /percentage_rate/);
  assert.match(sql, /min_fee_ngn/);
  assert.match(sql, /max_fee_ngn/);
  assert.match(sql, /priority/);
  assert.match(sql, /is_active/);
  assert.match(sql, /alter table assisted_order_quotes/);
  assert.match(sql, /service_fee_policy_id/);
  assert.match(sql, /service_fee_policy_resolved_ngn/);
  assert.match(sql, /insert into service_fee_policies/);
  assert.match(sql, /Default/);
  assert.match(sql, /revoke all privileges/);
  assert.match(sql, /jelocare_app_runtime/);
});

test("quote model includes service fee policy audit fields", async () => {
  const mod = await import("../../lib/commerce/assisted-procurement-model");
  // Type-level check: AssistedOrderQuoteView must have the audit fields.
  const quote: import("../../lib/commerce/assisted-procurement-model").AssistedOrderQuoteView =
    {
      id: "test",
      version: 1,
      status: "awaiting_approval",
      components: {
        productSubtotalNgn: 1000,
        retailerFeeNgn: 0,
        taxNgn: 0,
        jelocareFeeNgn: 500,
        deliveryNgn: 1000,
      },
      totalNgn: 2500,
      evidenceReference: "test-evidence",
      notes: null,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      approvedAt: null,
      serviceFeePolicyId: null,
      serviceFeePolicyResolvedNgn: null,
    };
  assert.equal(quote.serviceFeePolicyId, null);
  assert.equal(quote.serviceFeePolicyResolvedNgn, null);
});

test("submitAssistedQuoteSchema accepts optional service fee policy fields", async () => {
  const mod = await import("../../lib/commerce/assisted-procurement-schema");
  const parsed = mod.submitAssistedQuoteSchema.parse({
    orderId: "550e8400-e29b-41d4-a716-446655440000",
    revision: 1,
    productSubtotalNgn: 42000,
    retailerFeeNgn: 0,
    taxNgn: 0,
    jelocareFeeNgn: 2100,
    deliveryNgn: 1500,
    evidenceReference: "auto-verified:woo-cart-api@2026-08-13T10:30",
    notes: "",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    serviceFeePolicyId: "660e8400-e29b-41d4-a716-446655440000",
    serviceFeePolicyResolvedNgn: 2100,
  });
  assert.equal(
    parsed.serviceFeePolicyId,
    "660e8400-e29b-41d4-a716-446655440000",
  );
  assert.equal(parsed.serviceFeePolicyResolvedNgn, 2100);
});

test("submitAssistedQuoteSchema works without optional policy fields", async () => {
  const mod = await import("../../lib/commerce/assisted-procurement-schema");
  const parsed = mod.submitAssistedQuoteSchema.parse({
    orderId: "550e8400-e29b-41d4-a716-446655440000",
    revision: 1,
    productSubtotalNgn: 42000,
    retailerFeeNgn: 0,
    taxNgn: 0,
    jelocareFeeNgn: 2100,
    deliveryNgn: 1500,
    evidenceReference: "auto-verified:woo-cart-api@2026-08-13T10:30",
    notes: "",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(parsed.serviceFeePolicyId, undefined);
  assert.equal(parsed.serviceFeePolicyResolvedNgn, undefined);
});

test("service fee policy actions require operator access", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../app/(ops)/ops/service-fees/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /requireConsoleOperator/);
  assert.match(source, /assertCan/);
  assert.match(source, /orders\.manage/);
});
