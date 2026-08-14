import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canTransitionAssistedOrder,
  quoteIsComplete,
  quoteTotal,
  toAssistedOrderCustomerView,
} from "@/lib/commerce/assisted-procurement-model";
import {
  addBasketItem,
  BASKET_MAX_PRODUCTS,
  basketAddOutcome,
  basketQuantity,
  normaliseBasketItems,
  setBasketItemQuantity,
} from "@/lib/commerce/basket";
import {
  chooseRetailerBasketOption,
  findRetailerBasketOptions,
} from "@/lib/commerce/retailer-basket";
import {
  chooseShoppingRetailer,
  shoppingRetailerHref,
} from "@/lib/commerce/shopping-session";
import type { CreateAssistedOrderInput } from "@/lib/commerce/assisted-procurement-schema";
import { productBySlug } from "@/data/catalogue";

test("guest basket is bounded, quantity-aware, and does not require identity", () => {
  const normalised = normaliseBasketItems([
    { slug: "alpha", quantity: 2 },
    { slug: "alpha", quantity: 9 },
    { slug: "beta", quantity: 1 },
    { slug: "", quantity: 1 },
  ]);
  assert.deepEqual(normalised, [
    { slug: "alpha", quantity: 10 },
    { slug: "beta", quantity: 1 },
  ]);
  assert.equal(basketQuantity(normalised), 11);
  assert.deepEqual(setBasketItemQuantity(normalised, "beta", 0), [
    { slug: "alpha", quantity: 10 },
  ]);
  let items = normalised;
  for (const slug of ["gamma", "delta", "epsilon"])
    items = addBasketItem(items, slug);
  assert.equal(items.length, BASKET_MAX_PRODUCTS);
  assert.equal(basketAddOutcome(items, "zeta"), "product_limit_reached");
  assert.equal(basketAddOutcome(items, "alpha"), "quantity_increased");
});

test("a fifth product stays on the current store and announces the basket limit", async () => {
  const [provider, action] = await Promise.all([
    readFile("components/commerce/basket-provider.tsx", "utf8"),
    readFile("components/commerce/add-to-basket-button.tsx", "utf8"),
  ]);
  assert.match(provider, /notice: BasketNotice/);
  assert.match(provider, /setNotice\(outcome\)/);
  assert.match(action, /Basket full · Review/);
  assert.match(action, /if \(outcome === "product_limit_reached"\)/);
  const limitBranch = action.slice(
    action.indexOf('if (outcome === "product_limit_reached")'),
    action.indexOf(
      "localStorage.setItem",
      action.indexOf('if (outcome === "product_limit_reached")'),
    ),
  );
  assert.match(limitBranch, /return;/);
  assert.doesNotMatch(limitBranch, /router\.push|setItem/);
});

test("checkout defaults only before a store is chosen and never silently switches an explicit store", () => {
  const options = [
    {
      retailer: "Recheck",
      trust: 90,
      offers: [],
      combinedTotal: 5_000,
      allInStock: false,
      quantityTotal: 1,
    },
    {
      retailer: "Ready",
      trust: 88,
      offers: [],
      combinedTotal: 8_000,
      allInStock: true,
      quantityTotal: 1,
    },
  ];
  assert.equal(chooseRetailerBasketOption(options)?.retailer, "Ready");
  assert.equal(chooseRetailerBasketOption(options, "Recheck"), undefined);
  assert.equal(chooseRetailerBasketOption(options, "Missing"), undefined);
  assert.equal(chooseRetailerBasketOption(options, "Ready")?.retailer, "Ready");
});

test("basket and checkout require customer re-selection when a stored retailer loses an exact listing", async () => {
  const source = await readFile(
    "components/commerce/procurement-basket.tsx",
    "utf8",
  );
  assert.match(source, /Choose a new retailer\./);
  assert.match(source, /no longer has every item in stock/);
  assert.match(source, /disabled=\{!option\.allInStock\}/);
  assert.match(source, /retailer must still list every item in stock/);
  assert.match(source, /disabled=\{!chosen \|\| !chosen\.allInStock\}/);
});

test("guest shopping stays with one retailer until the basket explicitly switches", () => {
  const stores = [
    { name: "Beauty by Daz", slug: "beauty-by-daz" },
    { name: "Beauty Hut Africa", slug: "beauty-hut-africa" },
  ];
  assert.equal(chooseShoppingRetailer(stores, null, false), stores[0]);
  assert.equal(
    chooseShoppingRetailer(stores, "Beauty Hut Africa", true),
    stores[1],
  );
  assert.equal(chooseShoppingRetailer(stores, null, true), null);
  assert.equal(chooseShoppingRetailer(stores, "Another Store", true), null);
  assert.equal(
    shoppingRetailerHref(stores[0]),
    "/retailers/beauty-by-daz?shopping=1",
  );
});

test("order state and quote completeness fail closed", () => {
  assert.equal(canTransitionAssistedOrder("requested", "quoting"), true);
  assert.equal(canTransitionAssistedOrder("requested", "paid"), false);
  assert.equal(
    canTransitionAssistedOrder("awaiting_approval", "payment_pending"),
    true,
  );
  assert.equal(
    canTransitionAssistedOrder("payment_pending", "procurement"),
    false,
  );
  assert.equal(
    quoteTotal({
      productSubtotalNgn: 10_000,
      retailerFeeNgn: 0,
      taxNgn: 0,
      jelocareFeeNgn: 500,
      deliveryNgn: 2_000,
    }),
    12_500,
  );
  assert.equal(
    quoteTotal({
      productSubtotalNgn: 10_000,
      retailerFeeNgn: null,
      taxNgn: 0,
      jelocareFeeNgn: 500,
      deliveryNgn: 2_000,
    }),
    null,
  );
  assert.equal(
    quoteIsComplete({
      components: {
        productSubtotalNgn: 10_000,
        retailerFeeNgn: 0,
        taxNgn: 0,
        jelocareFeeNgn: 500,
        deliveryNgn: 2_000,
      },
      evidenceReference: "retailer-quote:123",
      expiresAt: new Date(Date.now() + 60_000),
    }),
    true,
  );
});

test("one-product basket still resolves exact one-retailer choices and quantities", () => {
  const product = productBySlug("aqua-rich-licorice-mulberry-body-wash-1000ml");
  assert.ok(product);
  const options = findRetailerBasketOptions(
    [product],
    new Map([[product.slug, 3]]),
    new Date("2026-08-13T12:00:00Z"),
  );
  assert.ok(options.length >= 1);
  assert.equal(options[0].quantityTotal, 3);
  assert.equal(options[0].combinedTotal, options[0].offers[0].priceNgn * 3);
  assert.equal(options[0].offers.length, 1);
});

test("migration preserves exact identity, guest capabilities, transparent quote, and append-only history", async () => {
  const migration = await readFile(
    "db/migrations/0039_assisted_procurement.sql",
    "utf8",
  );
  assert.match(migration, /exactly one|retailer_name text not null/i);
  assert.match(
    migration,
    /product_identity_version_id uuid[\s\S]*references catalogue_product_identity_versions/,
  );
  assert.match(migration, /unique index assisted_order_lines_order_slug_idx/);
  assert.match(
    migration,
    /assisted_order_guest_sessions[\s\S]*token_hash text primary key/,
  );
  assert.match(migration, /request_key_hash text not null unique/);
  assert.match(
    migration,
    /assisted_order_recovery_capabilities[\s\S]*consumed_at timestamptz/,
  );
  assert.match(
    migration,
    /product_subtotal_ngn[\s\S]*retailer_fee_ngn[\s\S]*tax_ngn[\s\S]*jelocare_fee_ngn[\s\S]*delivery_ngn/,
  );
  assert.match(migration, /Assisted order events are append-only/);
  assert.doesNotMatch(migration, /grant[^;]+assisted_order[^;]+to public/i);
});

test("guest order session reads qualify order timestamps across the session join", async () => {
  const repository = await readFile(
    "lib/commerce/assisted-procurement-repository.ts",
    "utf8",
  );
  assert.match(repository, /orders\.created_at::text as created_at/);
  assert.match(repository, /orders\.updated_at::text as updated_at/);
  assert.match(
    repository,
    /join assisted_order_guest_sessions session on session\.order_id = orders\.id/,
  );
  assert.doesNotMatch(
    repository,
    /\n\s+created_at::text, updated_at::text\n\s+from assisted_orders/,
  );
});

test("Ops order review uses the shared light and dark operations theme tokens", async () => {
  const styles = await readFile(
    "app/(ops)/ops/orders/orders.module.css",
    "utf8",
  );
  assert.match(styles, /background: var\(--ops-workspace\)/);
  assert.match(styles, /color: var\(--ops-ink\)/);
  assert.match(styles, /background: var\(--ops-surface-subtle\)/);
  assert.match(styles, /background: var\(--ops-accent-subtle\)/);
  assert.doesNotMatch(styles, /var\(--ops-surface,\s*#fff\)/);
  assert.doesNotMatch(styles, /background:\s*#fff\b/);
});

test("local simulator CSP supports React diagnostics without weakening production", async () => {
  const config = await readFile("next.config.ts", "utf8");
  assert.match(
    config,
    /developmentScriptDirectives[\s\S]*NODE_ENV === "development"[\s\S]*"'unsafe-eval'"/,
  );
  assert.match(
    config,
    /"script-src 'self' 'unsafe-inline'"[\s\S]*\.\.\.developmentScriptDirectives/,
  );
});

test("fixture exercises request → quote → guest approval and one-time recovery", async () => {
  process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE = "true";
  const [{ requestAssistedOrder }, repository, security] = await Promise.all([
    import("@/lib/commerce/assisted-procurement-service"),
    import("@/lib/commerce/assisted-procurement-repository"),
    import("@/lib/commerce/assisted-procurement-security"),
  ]);
  repository.resetAssistedProcurementDevelopmentFixture();
  const product = productBySlug("aqua-rich-licorice-mulberry-body-wash-1000ml");
  assert.ok(product);
  const retailer = findRetailerBasketOptions(
    [product],
    new Map([[product.slug, 1]]),
    new Date("2026-08-13T12:00:00Z"),
  )[0]?.retailer;
  assert.ok(retailer);
  const request: CreateAssistedOrderInput = {
    requestId: "11111111-1111-4111-8111-111111111111",
    retailer,
    lines: [{ slug: product.slug, quantity: 1 }],
    contactName: "Guest Customer",
    contactEmail: "guest@example.com",
    contactPhone: "+2348000000000",
    deliveryAddress: "1 Example Street",
    deliveryCity: "Lagos",
    deliveryState: "Lagos",
    deliveryInstructions: "",
    whatsappConsent: false,
    emailNotificationsConsent: true,
    termsAccepted: true,
    websiteField: "",
  };
  const created = await requestAssistedOrder(request, null);
  const customerView = toAssistedOrderCustomerView(created.order);
  for (const privateField of [
    "ownerSubject",
    "contactName",
    "contactEmail",
    "contactPhone",
    "deliveryAddress",
    "deliveryInstructions",
  ]) {
    assert.equal(Object.hasOwn(customerView, privateField), false);
  }
  const retried = await requestAssistedOrder(request, null);
  assert.equal(retried.order.id, created.order.id);
  await assert.rejects(
    requestAssistedOrder(
      { ...request, deliveryAddress: "2 Changed Street" },
      null,
    ),
    /order_idempotency_conflict/,
  );
  const sessionHash = security.hashOrderSecret(retried.sessionSecret);
  assert.equal(
    (await repository.readAssistedOrderBySession(sessionHash))?.state,
    "requested",
  );
  const quoting = await repository.transitionAssistedOrderForOperator({
    orderId: created.order.id,
    revision: 1,
    operatorSubject: "operator-1",
    toState: "quoting",
    reason: null,
  });
  assert.equal(quoting?.state, "quoting");
  const quoted = await repository.submitAssistedOrderQuote({
    orderId: created.order.id,
    revision: quoting!.revision,
    operatorSubject: "operator-1",
    components: {
      productSubtotalNgn: created.order.lines[0].observedUnitPriceNgn,
      retailerFeeNgn: 0,
      taxNgn: 0,
      jelocareFeeNgn: 500,
      deliveryNgn: 2_000,
    },
    evidenceReference: "retailer-quote:fixture",
    notes: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(quoted?.state, "awaiting_approval");
  const approved = await repository.decideAssistedOrderQuote({
    orderId: created.order.id,
    sessionHash,
    quoteVersion: quoted!.quote!.version,
    revision: quoted!.revision,
    decision: "approve",
    reason: null,
  });
  assert.equal(approved?.state, "payment_pending");

  const recoverySession = security.createOrderSecret();
  const recovered = await repository.exchangeAssistedOrderRecovery(
    security.hashOrderSecret(retried.recoverySecret),
    security.hashOrderSecret(recoverySession),
  );
  assert.equal(recovered?.id, created.order.id);
  assert.equal(
    await repository.exchangeAssistedOrderRecovery(
      security.hashOrderSecret(retried.recoverySecret),
      security.hashOrderSecret(security.createOrderSecret()),
    ),
    null,
  );
  delete process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE;
});

test("expired quotes advance to needs response instead of looking payable", async () => {
  process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE = "true";
  const repository =
    await import("@/lib/commerce/assisted-procurement-repository");
  const security = await import("@/lib/commerce/assisted-procurement-security");
  repository.resetAssistedProcurementDevelopmentFixture();
  const sessionSecret = "expiry-session";
  const created = await repository.createAssistedOrder({
    requestKeyHash: security.hashOrderSecret("expiry-request"),
    requestFingerprint: security.hashOrderSecret("expiry-fingerprint"),
    reference: "JC-123456789A",
    ownerSubject: null,
    retailer: "Beauty Hut Africa",
    contactName: "Guest Customer",
    contactEmail: "guest@example.com",
    contactPhone: "+2348000000000",
    deliveryAddress: "1 Example Street",
    deliveryCity: "Lagos",
    deliveryState: "Lagos",
    deliveryInstructions: null,
    whatsappConsent: false,
    emailNotificationsConsent: false,
    sessionHash: security.hashOrderSecret(sessionSecret),
    recoveryHash: security.hashOrderSecret("expiry-recovery"),
    lines: [
      {
        slug: "cerave-foaming-facial-cleanser",
        brand: "CeraVe",
        name: "Foaming Facial Cleanser",
        size: "236 ml",
        image: "/fixture.png",
        quantity: 1,
        observedUnitPriceNgn: 14_700,
        observedListingUrl: "https://example.com/product",
        observedEvidenceReference: "fixture-expiry",
        observedAt: new Date().toISOString(),
      },
    ],
  });
  const quoting = await repository.transitionAssistedOrderForOperator({
    orderId: created.id,
    revision: created.revision,
    operatorSubject: "operator:test",
    toState: "quoting",
    reason: null,
  });
  assert.ok(quoting);
  await repository.submitAssistedOrderQuote({
    orderId: created.id,
    revision: quoting.revision,
    operatorSubject: "operator:test",
    components: {
      productSubtotalNgn: 14_700,
      retailerFeeNgn: 0,
      taxNgn: 0,
      jelocareFeeNgn: 500,
      deliveryNgn: 2_000,
    },
    evidenceReference: "expired-quote-evidence",
    notes: null,
    expiresAt: new Date(Date.now() - 1_000).toISOString(),
  });
  const expired = await repository.readAssistedOrderBySession(
    security.hashOrderSecret(sessionSecret),
  );
  assert.equal(expired?.state, "needs_response");
  assert.equal(expired?.quote?.status, "expired");
  assert.equal(expired?.events.at(-1)?.action, "quote_expired");
  delete process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE;
});

test("order notifications are event-derived, owner-isolated, opt-in, and auditable", async () => {
  process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE = "true";
  const repository =
    await import("@/lib/commerce/assisted-procurement-repository");
  const notifications =
    await import("@/lib/commerce/order-notification-repository");
  const security = await import("@/lib/commerce/assisted-procurement-security");
  repository.resetAssistedProcurementDevelopmentFixture();
  const ownerSubject = "customer:notification-fixture";
  const created = await repository.createAssistedOrder({
    requestKeyHash: security.hashOrderSecret("notification-request"),
    requestFingerprint: security.hashOrderSecret("notification-fingerprint"),
    reference: "JC-NOTIFY01A",
    ownerSubject,
    retailer: "Beauty Hut Africa",
    contactName: "Notification Customer",
    contactEmail: "notification@example.com",
    contactPhone: "+2348000000000",
    deliveryAddress: "1 Example Street",
    deliveryCity: "Lagos",
    deliveryState: "Lagos",
    deliveryInstructions: null,
    whatsappConsent: false,
    emailNotificationsConsent: true,
    sessionHash: security.hashOrderSecret("notification-session"),
    recoveryHash: security.hashOrderSecret("notification-recovery"),
    lines: [
      {
        slug: "cerave-foaming-facial-cleanser",
        brand: "CeraVe",
        name: "Foaming Facial Cleanser",
        size: "236 ml",
        image: "/fixture.png",
        quantity: 1,
        observedUnitPriceNgn: 14_700,
        observedListingUrl: "https://example.com/product",
        observedEvidenceReference: "fixture-notification",
        observedAt: new Date().toISOString(),
      },
    ],
  });
  const quoting = await repository.transitionAssistedOrderForOperator({
    orderId: created.id,
    revision: created.revision,
    operatorSubject: "operator:test",
    toState: "quoting",
    reason: null,
  });
  assert.ok(quoting);
  await repository.submitAssistedOrderQuote({
    orderId: created.id,
    revision: quoting.revision,
    operatorSubject: "operator:test",
    components: {
      productSubtotalNgn: 14_700,
      retailerFeeNgn: 0,
      taxNgn: 0,
      jelocareFeeNgn: 500,
      deliveryNgn: 2_000,
    },
    evidenceReference: "notification-quote-evidence",
    notes: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  const before =
    await notifications.readAssistedOrderNotificationCenter(ownerSubject);
  assert.equal(before.unreadCount, 1);
  assert.equal(before.notifications[0]?.kind, "quote_ready");
  assert.equal(before.notifications[0]?.emailStatus, "pending");
  assert.equal(
    (await notifications.readAssistedOrderNotificationCenter("customer:other"))
      .unreadCount,
    0,
  );
  assert.equal(
    await notifications.retryAssistedOrderNotificationDelivery({
      notificationId: before.notifications[0]!.id,
      orderId: "00000000-0000-4000-8000-000000000000",
    }),
    false,
  );

  const delivery = await notifications.deliverPendingAssistedOrderNotifications(
    { orderId: created.id },
  );
  assert.equal(delivery.sent, 1);
  assert.equal(
    (
      await notifications.listAssistedOrderNotificationDeliverySummaries([
        created.id,
      ])
    )[0]?.emailStatus,
    "sent",
  );
  await notifications.markAssistedOrderNotificationRead({
    ownerSubject,
    notificationId: before.notifications[0]!.id,
  });
  assert.equal(
    (await notifications.readAssistedOrderNotificationCenter(ownerSubject))
      .unreadCount,
    0,
  );

  const updated = await repository.updateAssistedOrderNotificationPreference({
    orderId: created.id,
    ownerSubject,
    enabled: false,
  });
  assert.equal(updated?.emailNotificationsConsent, false);
  delete process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE;
});

test("notification migration derives one delivery record from the canonical order event", async () => {
  const migration = await readFile(
    "db/migrations/0041_assisted_order_notifications.sql",
    "utf8",
  );
  assert.match(migration, /email_notifications_consent_at/);
  assert.match(
    migration,
    /event_id uuid not null unique references assisted_order_events/,
  );
  assert.match(migration, /after insert on assisted_order_events/);
  assert.match(
    migration,
    /case when order_record\.email_notifications_consent_at is null then 'suppressed' else 'pending'/,
  );
  assert.match(
    migration,
    /Assisted order events are append-only|Preserve useful signed-in history/i,
  );
  assert.doesNotMatch(
    migration,
    /grant[^;]+assisted_order_notifications[^;]+to public/i,
  );
  assert.match(
    migration,
    /revoke delete on table assisted_order_notifications from jelocare_app_runtime/,
  );
});

test("checkout submits persisted wizard state after earlier steps unmount", async () => {
  const checkout = await readFile(
    "components/commerce/procurement-basket.tsx",
    "utf8",
  );
  for (const field of [
    "contactName",
    "contactEmail",
    "contactPhone",
    "deliveryAddress",
    "deliveryCity",
    "deliveryState",
  ]) {
    assert.match(checkout, new RegExp(`${field}: fields\\.${field}`));
    assert.doesNotMatch(checkout, new RegExp(`${field}: data\\.get`));
  }
  assert.match(
    checkout,
    /whatsappConsent,\s+emailNotificationsConsent,\s+termsAccepted,/,
  );
  assert.match(checkout, /checked=\{emailNotificationsConsent\}/);
  assert.match(checkout, /checked=\{whatsappConsent\}/);
});

test("the approved WhatsApp support action is public, generic, and capability-free", async () => {
  const [contact, status] = await Promise.all([
    readFile("lib/commerce/whatsapp-contact.ts", "utf8"),
    readFile("components/commerce/order-status.tsx", "utf8"),
  ]);

  assert.match(contact, /display: '\+234 812 288 7847'/);
  assert.match(contact, /e164: '\+2348122887847'/);
  assert.match(contact, /href: 'https:\/\/wa\.me\/2348122887847'/);
  assert.doesNotMatch(contact, /\?|order|capability|customer|product|price/i);
  assert.match(status, /href=\{JELOCARE_WHATSAPP_CONTACT\.href\}/);
  assert.match(status, /target="_blank"/);
  assert.match(status, /rel="noopener noreferrer"/);
});
