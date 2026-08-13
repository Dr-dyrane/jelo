import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  canTransitionAssistedOrder,
  quoteIsComplete,
  quoteTotal,
  toAssistedOrderCustomerView,
} from '@/lib/commerce/assisted-procurement-model';
import {
  addBasketItem,
  BASKET_MAX_PRODUCTS,
  basketQuantity,
  normaliseBasketItems,
  setBasketItemQuantity,
} from '@/lib/commerce/basket';
import { findRetailerBasketOptions } from '@/lib/commerce/retailer-basket';
import type { CreateAssistedOrderInput } from '@/lib/commerce/assisted-procurement-schema';
import { productBySlug } from '@/data/catalogue';

test('guest basket is bounded, quantity-aware, and does not require identity', () => {
  const normalised = normaliseBasketItems([
    { slug: 'alpha', quantity: 2 },
    { slug: 'alpha', quantity: 9 },
    { slug: 'beta', quantity: 1 },
    { slug: '', quantity: 1 },
  ]);
  assert.deepEqual(normalised, [{ slug: 'alpha', quantity: 10 }, { slug: 'beta', quantity: 1 }]);
  assert.equal(basketQuantity(normalised), 11);
  assert.deepEqual(setBasketItemQuantity(normalised, 'beta', 0), [{ slug: 'alpha', quantity: 10 }]);
  let items = normalised;
  for (const slug of ['gamma', 'delta', 'epsilon']) items = addBasketItem(items, slug);
  assert.equal(items.length, BASKET_MAX_PRODUCTS);
});

test('order state and quote completeness fail closed', () => {
  assert.equal(canTransitionAssistedOrder('requested', 'quoting'), true);
  assert.equal(canTransitionAssistedOrder('requested', 'paid'), false);
  assert.equal(canTransitionAssistedOrder('awaiting_approval', 'payment_pending'), true);
  assert.equal(canTransitionAssistedOrder('payment_pending', 'procurement'), false);
  assert.equal(quoteTotal({ productSubtotalNgn: 10_000, retailerFeeNgn: 0, taxNgn: 0, jelocareFeeNgn: 500, deliveryNgn: 2_000 }), 12_500);
  assert.equal(quoteTotal({ productSubtotalNgn: 10_000, retailerFeeNgn: null, taxNgn: 0, jelocareFeeNgn: 500, deliveryNgn: 2_000 }), null);
  assert.equal(quoteIsComplete({
    components: { productSubtotalNgn: 10_000, retailerFeeNgn: 0, taxNgn: 0, jelocareFeeNgn: 500, deliveryNgn: 2_000 },
    evidenceReference: 'retailer-quote:123',
    expiresAt: new Date(Date.now() + 60_000),
  }), true);
});

test('one-product basket still resolves exact one-retailer choices and quantities', () => {
  const product = productBySlug('aqua-rich-licorice-mulberry-body-wash-1000ml');
  assert.ok(product);
  const options = findRetailerBasketOptions([product], new Map([[product.slug, 3]]), new Date('2026-08-13T12:00:00Z'));
  assert.ok(options.length >= 1);
  assert.equal(options[0].quantityTotal, 3);
  assert.equal(options[0].combinedTotal, options[0].offers[0].priceNgn * 3);
  assert.equal(options[0].offers.length, 1);
});

test('migration preserves exact identity, guest capabilities, transparent quote, and append-only history', async () => {
  const migration = await readFile('db/migrations/0039_assisted_procurement.sql', 'utf8');
  assert.match(migration, /exactly one|retailer_name text not null/i);
  assert.match(migration, /product_identity_version_id uuid[\s\S]*references catalogue_product_identity_versions/);
  assert.match(migration, /unique index assisted_order_lines_order_slug_idx/);
  assert.match(migration, /assisted_order_guest_sessions[\s\S]*token_hash text primary key/);
  assert.match(migration, /request_key_hash text not null unique/);
  assert.match(migration, /assisted_order_recovery_capabilities[\s\S]*consumed_at timestamptz/);
  assert.match(migration, /product_subtotal_ngn[\s\S]*retailer_fee_ngn[\s\S]*tax_ngn[\s\S]*jelocare_fee_ngn[\s\S]*delivery_ngn/);
  assert.match(migration, /Assisted order events are append-only/);
  assert.doesNotMatch(migration, /grant[^;]+assisted_order[^;]+to public/i);
});

test('Ops order review uses the shared light and dark operations theme tokens', async () => {
  const styles = await readFile('app/(ops)/ops/orders/orders.module.css', 'utf8');
  assert.match(styles, /background: var\(--ops-workspace\)/);
  assert.match(styles, /color: var\(--ops-ink\)/);
  assert.match(styles, /background: var\(--ops-surface-subtle\)/);
  assert.match(styles, /background: var\(--ops-accent-subtle\)/);
  assert.doesNotMatch(styles, /var\(--ops-surface,\s*#fff\)/);
  assert.doesNotMatch(styles, /background:\s*#fff\b/);
});

test('fixture exercises request → quote → guest approval and one-time recovery', async () => {
  process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE = 'true';
  const [{ requestAssistedOrder }, repository, security] = await Promise.all([
    import('@/lib/commerce/assisted-procurement-service'),
    import('@/lib/commerce/assisted-procurement-repository'),
    import('@/lib/commerce/assisted-procurement-security'),
  ]);
  repository.resetAssistedProcurementDevelopmentFixture();
  const product = productBySlug('aqua-rich-licorice-mulberry-body-wash-1000ml');
  assert.ok(product);
  const retailer = findRetailerBasketOptions([product], new Map([[product.slug, 1]]), new Date('2026-08-13T12:00:00Z'))[0]?.retailer;
  assert.ok(retailer);
  const request: CreateAssistedOrderInput = {
    requestId: '11111111-1111-4111-8111-111111111111',
    retailer,
    lines: [{ slug: product.slug, quantity: 1 }],
    contactName: 'Guest Customer',
    contactEmail: 'guest@example.com',
    contactPhone: '+2348000000000',
    deliveryAddress: '1 Example Street',
    deliveryCity: 'Lagos',
    deliveryState: 'Lagos',
    deliveryInstructions: '',
    whatsappConsent: false,
    termsAccepted: true,
    websiteField: '',
  };
  const created = await requestAssistedOrder(request, null);
  const customerView = toAssistedOrderCustomerView(created.order);
  for (const privateField of ['ownerSubject', 'contactName', 'contactEmail', 'contactPhone', 'deliveryAddress', 'deliveryInstructions']) {
    assert.equal(Object.hasOwn(customerView, privateField), false);
  }
  const retried = await requestAssistedOrder(request, null);
  assert.equal(retried.order.id, created.order.id);
  await assert.rejects(
    requestAssistedOrder({ ...request, deliveryAddress: '2 Changed Street' }, null),
    /order_idempotency_conflict/,
  );
  const sessionHash = security.hashOrderSecret(retried.sessionSecret);
  assert.equal((await repository.readAssistedOrderBySession(sessionHash))?.state, 'requested');
  const quoting = await repository.transitionAssistedOrderForOperator({ orderId: created.order.id, revision: 1, operatorSubject: 'operator-1', toState: 'quoting', reason: null });
  assert.equal(quoting?.state, 'quoting');
  const quoted = await repository.submitAssistedOrderQuote({
    orderId: created.order.id,
    revision: quoting!.revision,
    operatorSubject: 'operator-1',
    components: { productSubtotalNgn: created.order.lines[0].observedUnitPriceNgn, retailerFeeNgn: 0, taxNgn: 0, jelocareFeeNgn: 500, deliveryNgn: 2_000 },
    evidenceReference: 'retailer-quote:fixture',
    notes: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.equal(quoted?.state, 'awaiting_approval');
  const approved = await repository.decideAssistedOrderQuote({ orderId: created.order.id, sessionHash, quoteVersion: quoted!.quote!.version, revision: quoted!.revision, decision: 'approve', reason: null });
  assert.equal(approved?.state, 'payment_pending');

  const recoverySession = security.createOrderSecret();
  const recovered = await repository.exchangeAssistedOrderRecovery(
    security.hashOrderSecret(retried.recoverySecret),
    security.hashOrderSecret(recoverySession),
  );
  assert.equal(recovered?.id, created.order.id);
  assert.equal(await repository.exchangeAssistedOrderRecovery(
    security.hashOrderSecret(retried.recoverySecret),
    security.hashOrderSecret(security.createOrderSecret()),
  ), null);
  delete process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE;
});

test('expired quotes advance to needs response instead of looking payable', async () => {
  process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE = 'true';
  const repository = await import('@/lib/commerce/assisted-procurement-repository');
  const security = await import('@/lib/commerce/assisted-procurement-security');
  repository.resetAssistedProcurementDevelopmentFixture();
  const sessionSecret = 'expiry-session';
  const created = await repository.createAssistedOrder({
    requestKeyHash: security.hashOrderSecret('expiry-request'),
    requestFingerprint: security.hashOrderSecret('expiry-fingerprint'),
    reference: 'JC-123456789A',
    ownerSubject: null,
    retailer: 'Beauty Hut Africa',
    contactName: 'Guest Customer',
    contactEmail: 'guest@example.com',
    contactPhone: '+2348000000000',
    deliveryAddress: '1 Example Street',
    deliveryCity: 'Lagos',
    deliveryState: 'Lagos',
    deliveryInstructions: null,
    whatsappConsent: false,
    sessionHash: security.hashOrderSecret(sessionSecret),
    recoveryHash: security.hashOrderSecret('expiry-recovery'),
    lines: [{
      slug: 'cerave-foaming-facial-cleanser',
      brand: 'CeraVe',
      name: 'Foaming Facial Cleanser',
      size: '236 ml',
      image: '/fixture.png',
      quantity: 1,
      observedUnitPriceNgn: 14_700,
      observedListingUrl: 'https://example.com/product',
      observedEvidenceReference: 'fixture-expiry',
      observedAt: new Date().toISOString(),
    }],
  });
  const quoting = await repository.transitionAssistedOrderForOperator({
    orderId: created.id,
    revision: created.revision,
    operatorSubject: 'operator:test',
    toState: 'quoting',
    reason: null,
  });
  assert.ok(quoting);
  await repository.submitAssistedOrderQuote({
    orderId: created.id,
    revision: quoting.revision,
    operatorSubject: 'operator:test',
    components: {
      productSubtotalNgn: 14_700,
      retailerFeeNgn: 0,
      taxNgn: 0,
      jelocareFeeNgn: 500,
      deliveryNgn: 2_000,
    },
    evidenceReference: 'expired-quote-evidence',
    notes: null,
    expiresAt: new Date(Date.now() - 1_000).toISOString(),
  });
  const expired = await repository.readAssistedOrderBySession(security.hashOrderSecret(sessionSecret));
  assert.equal(expired?.state, 'needs_response');
  assert.equal(expired?.quote?.status, 'expired');
  assert.equal(expired?.events.at(-1)?.action, 'quote_expired');
  delete process.env.ASSISTED_PROCUREMENT_DEVELOPMENT_FIXTURE;
});
