import test from "node:test";
import assert from "node:assert/strict";

test("order verification extraction module exports verifyOrderLine", async () => {
  const mod = await import("../../lib/commerce/order-verification-extraction");
  assert.equal(typeof mod.verifyOrderLine, "function");
});

test("order verification service exports verifyAssistedOrder and readOrderLineVerifications", async () => {
  const mod = await import("../../lib/commerce/order-verification-service");
  assert.equal(typeof mod.verifyAssistedOrder, "function");
  assert.equal(typeof mod.readOrderLineVerifications, "function");
});

test("verifyOrderLine returns manual fallback when all extraction methods fail", async () => {
  const { verifyOrderLine } =
    await import("../../lib/commerce/order-verification-extraction");
  // Use a URL that is not a Woo store and will fail HTTP fetch (localhost
  // with a non-existent port). The function should fall through to the
  // manual fallback.
  const result = await verifyOrderLine({
    listingUrl: "https://example.invalid/product/test-product",
    productName: "Test Product",
    productSize: "50ml",
    quantity: 1,
    deliveryCity: "Lagos",
    deliveryState: "Lagos",
  });
  assert.equal(result.verifiedUnitPriceNgn, null);
  assert.equal(result.verifiedInventoryStatus, null);
  assert.equal(result.verificationMethod, "manual");
  assert.equal(result.verificationConfidence, 0);
  assert.ok(result.verificationError);
  assert.ok(result.verificationError!.includes("Manual verification required"));
});

test("verifyOrderLine returns manual fallback for Woo store URL that cannot be reached", async () => {
  const { verifyOrderLine } =
    await import("../../lib/commerce/order-verification-extraction");
  // Use a Woo store hostname but with an invalid path. The Woo API calls
  // will fail, and the function should fall through to manual fallback.
  const result = await verifyOrderLine({
    listingUrl: "https://beautybydaz.invalid/product/test-product",
    productName: "Test Product",
    productSize: "50ml",
    quantity: 2,
    deliveryCity: "Lagos",
    deliveryState: "Lagos",
  });
  // The .invalid TLD means DNS resolution fails, so all fetch attempts fail.
  assert.equal(result.verificationMethod, "manual");
  assert.equal(result.verifiedUnitPriceNgn, null);
});

test("AssistedOrderLineVerification type is exported from the model", async () => {
  const mod = await import("../../lib/commerce/assisted-procurement-model");
  // Type-level check: the function toAssistedOrderCustomerView should
  // preserve lineVerifications.
  const order = {
    id: "test",
    reference: "JC-TEST",
    retailer: "Test Retailer",
    state: "requested" as const,
    revision: 1,
    ownerSubject: null,
    contactName: "Test",
    contactEmail: "test@test.com",
    deliveryCity: "Lagos",
    deliveryState: "Lagos",
    whatsappConsent: false,
    emailNotificationsConsent: false,
    lines: [],
    lineVerifications: [],
    quote: null,
    fulfillment: {
      retailerOrderReference: null,
      carrier: null,
      trackingReference: null,
      trackingUrl: null,
      dispatchedAt: null,
      deliveredAt: null,
    },
    returnRequest: null,
    refund: null,
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const customerView = mod.toAssistedOrderCustomerView(order);
  assert.deepEqual(customerView.lineVerifications, []);
  assert.equal(Object.hasOwn(customerView, "contactPhone"), false);
  assert.equal(Object.hasOwn(customerView, "contactName"), false);
});

test("order verify route is operator-gated", async () => {
  // Read the route source to verify it requires operator access.
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../app/api/orders/[id]/verify/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /requireOperator/);
  assert.match(source, /sameSiteRequest/);
  assert.match(source, /verifyAssistedOrder/);
});

test("order creation route triggers background verification with after()", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    new URL("../../app/api/orders/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /import.*after.*from.*next\/server/);
  assert.match(source, /verifyAssistedOrder/);
  assert.match(source, /after\(async/);
});

test("operator actions include reverifyOrderAction", async () => {
  const mod = await import("../../app/(ops)/ops/orders/actions");
  assert.equal(typeof mod.reverifyOrderAction, "function");
});

test("migration 0045 creates assisted_order_line_verifications with correct columns", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(
    new URL(
      "../../db/migrations/0045_assisted_order_line_verifications.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /create table assisted_order_line_verifications/);
  assert.match(sql, /verified_unit_price_ngn/);
  assert.match(sql, /verified_inventory_status/);
  assert.match(sql, /verified_product_subtotal_ngn/);
  assert.match(sql, /verified_delivery_ngn/);
  assert.match(sql, /verified_tax_ngn/);
  assert.match(sql, /verified_retailer_fee_ngn/);
  assert.match(sql, /verified_total_ngn/);
  assert.match(sql, /verification_method/);
  assert.match(sql, /verification_confidence/);
  assert.match(sql, /verification_evidence/);
  assert.match(sql, /is_latest/);
  assert.match(sql, /jelocare_app_runtime/);
  assert.match(sql, /revoke all privileges/);
});
