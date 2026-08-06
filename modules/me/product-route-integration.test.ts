import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildProductMarketSnapshot } from '@/modules/commerce/product-market-snapshot';
import { buildMarketReading } from '@/modules/commerce/market-reading';
import type { Offer } from '@/data/products';
import { deriveProductShelfContext } from '@/lib/customer/product-shelf-context';
import type { CustomerPortalShelfItem } from '@/lib/customer/portal-model';

// --- Integration test: one catalogue lookup ---
// The route-read-models module must not import findCatalogueProduct.
// readMeProduct must accept a Product, not a slug.

test('readMeProduct does not import or call findCatalogueProduct', () => {
  const source = readFileSync('lib/customer/route-read-models.ts', 'utf8');
  assert.doesNotMatch(source, /import\s+\{[^}]*findCatalogueProduct/, 'route-read-models must not import findCatalogueProduct');
  // Check that readMeProduct function body does not call findCatalogueProduct.
  const fnBody = source.slice(
    source.indexOf('export async function readMeProduct'),
    source.indexOf('export async function', source.indexOf('export async function readMeProduct') + 1),
  );
  assert.doesNotMatch(fnBody, /findCatalogueProduct\(/, 'readMeProduct must not call findCatalogueProduct');
  assert.match(source, /readMeProduct\(identity: CustomerAccessIdentity, product: Product/, 'readMeProduct must accept a Product');
});

test('route page passes the resolved product to readMeProduct', () => {
  const page = readFileSync('app/(customer)/me/[...route]/page.ts', 'utf8');
  assert.match(page, /readMeProduct\(customer, selectedProduct/, 'route must pass the resolved product, not a slug');
});

// --- Integration test: market snapshot agreement ---

function makeOffer(overrides: Partial<Offer> & { retailer?: string } = {}): Offer {
  const retailer = overrides.retailer ?? 'Test Store';
  return {
    retailer,
    url: `https://example.com/${retailer.toLowerCase().replace(/\s+/g, '-')}`,
    match: 'exact',
    location: ['NG'],
    available: true,
    trust: 80,
    checkedAt: '2025-01-15',
    priceNgn: 5000,
    listingEvidence: { observedAt: '2025-01-15', sourceUrl: 'https://example.com', basis: 'retailer-page' },
    priceObservation: {
      observedAt: '2025-01-15',
      variant: 'Product',
      size: '50 ml',
      stock: 'in-stock',
      landedCost: 'included',
    },
    ...overrides,
  } as Offer;
}

test('market snapshot and inline reading agree on priced state', () => {
  const now = Date.parse('2025-01-16T10:00:00Z');
  const offers = [makeOffer(), makeOffer({
    retailer: 'Other Store',
    priceNgn: 6000,
  })];
  const snapshot = buildProductMarketSnapshot(offers, now);
  const inline = buildMarketReading(offers, 'NG', now);

  assert.equal(snapshot.NG.reading.state, inline.state);
  assert.equal(snapshot.NG.reading.state, 'priced');
  if (snapshot.NG.reading.state === 'priced' && inline.state === 'priced') {
    assert.equal(snapshot.NG.reading.priceLabel, inline.priceLabel);
    assert.equal(snapshot.NG.reading.storeCount, inline.storeCount);
    assert.equal(snapshot.NG.reading.observedAt, inline.observedAt);
    assert.equal(snapshot.NG.reading.basis, inline.basis);
  }
  assert.equal(snapshot.NG.extras.uniquePricedStoreCount, 2);
  assert.equal(snapshot.NG.extras.uniqueListingStoreCount, 2);
  // Numeric prices are exposed for presentation — no string parsing needed.
  assert.equal(snapshot.NG.extras.lowestPrice, 5000);
  assert.equal(snapshot.NG.extras.highestPrice, 6000);
});

test('market snapshot and inline reading agree on listing-only state', () => {
  const now = Date.parse('2025-01-16T10:00:00Z');
  const offers = [makeOffer({
    retailer: 'Store A',
    available: false,
    priceNgn: undefined,
    priceObservation: undefined,
  })];
  const snapshot = buildProductMarketSnapshot(offers, now);
  const inline = buildMarketReading(offers, 'NG', now);

  assert.equal(snapshot.NG.reading.state, inline.state);
  assert.equal(snapshot.NG.reading.state, 'listing-only');
  if (snapshot.NG.reading.state === 'listing-only' && inline.state === 'listing-only') {
    assert.equal(snapshot.NG.reading.listingCount, inline.listingCount);
    assert.equal(snapshot.NG.reading.observedAt, inline.observedAt);
  }
  assert.equal(snapshot.NG.extras.uniquePricedStoreCount, 0);
  assert.equal(snapshot.NG.extras.uniqueListingStoreCount, 1);
});

test('market snapshot and inline reading agree on unavailable state', () => {
  const now = Date.parse('2025-01-16T10:00:00Z');
  const offers: Offer[] = [];
  const snapshot = buildProductMarketSnapshot(offers, now);
  const inline = buildMarketReading(offers, 'NG', now);

  assert.equal(snapshot.NG.reading.state, inline.state);
  assert.equal(snapshot.NG.reading.state, 'unavailable');
});

test('duplicate retailer offers do not inflate store count in snapshot or inline', () => {
  const now = Date.parse('2025-01-16T10:00:00Z');
  const offers = [
    makeOffer({ retailer: 'Store A' }),
    makeOffer({ retailer: 'Store A', url: 'https://example.com/other' }),
  ];
  const snapshot = buildProductMarketSnapshot(offers, now);
  const inline = buildMarketReading(offers, 'NG', now);

  // Both inline reading and panel extras must count unique retailers.
  if (snapshot.NG.reading.state === 'priced' && inline.state === 'priced') {
    assert.equal(snapshot.NG.reading.storeCount, inline.storeCount);
    assert.equal(snapshot.NG.reading.storeCount, 1, 'inline must deduplicate to 1 store');
  }
  assert.equal(snapshot.NG.extras.uniquePricedStoreCount, 1, 'panel must deduplicate to 1 store');
  assert.equal(snapshot.NG.extras.uniqueListingStoreCount, 1, 'panel listing count must deduplicate to 1 store');
});

test('retailer names differing by case and whitespace deduplicate', () => {
  const now = Date.parse('2025-01-16T10:00:00Z');
  const offers = [
    makeOffer({ retailer: 'Store A' }),
    makeOffer({ retailer: 'store a ', url: 'https://example.com/other' }),
  ];
  const snapshot = buildProductMarketSnapshot(offers, now);
  const inline = buildMarketReading(offers, 'NG', now);

  if (snapshot.NG.reading.state === 'priced' && inline.state === 'priced') {
    assert.equal(inline.storeCount, 1, 'inline must deduplicate case/whitespace variants');
  }
  assert.equal(snapshot.NG.extras.uniquePricedStoreCount, 1, 'panel must deduplicate case/whitespace variants');
});

test('newer unpriced listing does not refresh older displayed price', () => {
  const now = Date.parse('2025-01-16T10:00:00Z');
  const offers = [
    makeOffer({
      retailer: 'Store A',
      priceNgn: 5000,
      checkedAt: '2025-01-10',
      listingEvidence: { observedAt: '2025-01-10', sourceUrl: 'https://example.com', basis: 'retailer-page' },
      priceObservation: { observedAt: '2025-01-10', variant: 'Product', size: '50 ml', stock: 'in-stock', landedCost: 'included' },
    }),
    makeOffer({
      retailer: 'Store B',
      available: false,
      priceNgn: undefined,
      priceObservation: undefined,
      checkedAt: '2025-01-15',
      listingEvidence: { observedAt: '2025-01-15', sourceUrl: 'https://example.com', basis: 'retailer-page' },
    }),
  ];
  const snapshot = buildProductMarketSnapshot(offers, now);
  const inline = buildMarketReading(offers, 'NG', now);

  // The priced state should still show the older price from Store A.
  assert.equal(snapshot.NG.reading.state, 'priced');
  assert.equal(inline.state, 'priced');
  if (snapshot.NG.reading.state === 'priced' && inline.state === 'priced') {
    assert.equal(snapshot.NG.reading.priceLabel, inline.priceLabel);
  }
  // The checked timestamp should be the most recent observation.
  assert.equal(snapshot.NG.reading.observedAt, inline.observedAt);
});

test('newer out-of-stock listing does not refresh older displayed price', () => {
  const now = Date.parse('2025-01-16T10:00:00Z');
  const offers = [
    makeOffer({
      retailer: 'Store A',
      priceNgn: 5000,
      checkedAt: '2025-01-10',
      listingEvidence: { observedAt: '2025-01-10', sourceUrl: 'https://example.com', basis: 'retailer-page' },
      priceObservation: { observedAt: '2025-01-10', variant: 'Product', size: '50 ml', stock: 'in-stock', landedCost: 'included' },
    }),
    makeOffer({
      retailer: 'Store B',
      available: false,
      priceNgn: 7000,
      checkedAt: '2025-01-15',
      listingEvidence: { observedAt: '2025-01-15', sourceUrl: 'https://example.com', basis: 'retailer-page' },
      priceObservation: { observedAt: '2025-01-15', variant: 'Product', size: '50 ml', stock: 'out-of-stock', landedCost: 'included' },
    }),
  ];
  const snapshot = buildProductMarketSnapshot(offers, now);
  const inline = buildMarketReading(offers, 'NG', now);

  // The priced state should show the in-stock price from Store A, not the out-of-stock Store B.
  assert.equal(snapshot.NG.reading.state, 'priced');
  assert.equal(inline.state, 'priced');
  if (snapshot.NG.reading.state === 'priced' && inline.state === 'priced') {
    assert.equal(snapshot.NG.reading.priceLabel, inline.priceLabel);
    // Store count should be 1 (only Store A is in-stock and priced).
    assert.equal(snapshot.NG.reading.storeCount, 1);
    assert.equal(inline.storeCount, 1);
  }
});

test('one now prevents expiry boundary divergence between inline and panel', () => {
  // An offer expires at the evaluation boundary. Using one `now` guarantees
  // the inline reading and the panel snapshot agree on freshness.
  const boundary = '2025-01-16T10:00:00Z';
  const now = Date.parse(boundary);
  const offers = [makeOffer({
    retailer: 'Store A',
    priceNgn: 5000,
    checkedAt: '2025-01-15',
    listingEvidence: { observedAt: '2025-01-15', sourceUrl: 'https://example.com', basis: 'retailer-page' },
    priceObservation: { observedAt: '2025-01-15', variant: 'Product', size: '50 ml', stock: 'in-stock', landedCost: 'included' },
  })];

  const snapshot = buildProductMarketSnapshot(offers, now);
  const inline = buildMarketReading(offers, 'NG', now);

  assert.equal(snapshot.NG.reading.state, inline.state);
  if (snapshot.NG.reading.state === 'priced' && inline.state === 'priced') {
    assert.equal(snapshot.NG.reading.freshnessLabel, inline.freshnessLabel);
    assert.equal(snapshot.NG.reading.observedAt, inline.observedAt);
  }
});

test('inline and panel store count always agree', () => {
  const now = Date.parse('2025-01-16T10:00:00Z');
  for (const offerCount of [1, 2, 3, 5]) {
    const offers = Array.from({ length: offerCount }, (_, i) => makeOffer({
      retailer: `Store ${i}`,
      url: `https://example.com/${i}`,
    }));
    const snapshot = buildProductMarketSnapshot(offers, now);
    const inline = buildMarketReading(offers, 'NG', now);
    if (snapshot.NG.reading.state === 'priced' && inline.state === 'priced') {
      assert.equal(snapshot.NG.reading.storeCount, inline.storeCount,
        `store count mismatch with ${offerCount} offers`);
    }
  }
});

test('inline and panel checked time always agree', () => {
  const now = Date.parse('2025-01-16T10:00:00Z');
  const offers = [
    makeOffer({ retailer: 'Store A', priceNgn: 5000, checkedAt: '2025-01-10', listingEvidence: { observedAt: '2025-01-10', sourceUrl: 'https://example.com', basis: 'retailer-page' }, priceObservation: { observedAt: '2025-01-10', variant: 'Product', size: '50 ml', stock: 'in-stock', landedCost: 'included' } }),
    makeOffer({ retailer: 'Store B', priceNgn: 6000, checkedAt: '2025-01-15', listingEvidence: { observedAt: '2025-01-15', sourceUrl: 'https://example.com', basis: 'retailer-page' }, priceObservation: { observedAt: '2025-01-15', variant: 'Product', size: '50 ml', stock: 'in-stock', landedCost: 'included' } }),
  ];
  const snapshot = buildProductMarketSnapshot(offers, now);
  const inline = buildMarketReading(offers, 'NG', now);
  if (snapshot.NG.reading.state === 'priced' && inline.state === 'priced') {
    assert.equal(snapshot.NG.reading.observedAt, inline.observedAt);
  } else if (snapshot.NG.reading.state === 'listing-only' && inline.state === 'listing-only') {
    assert.equal(snapshot.NG.reading.observedAt, inline.observedAt);
  }
});

// --- Integration test: shelf context selection ---

function makeShelfItem(overrides: Partial<CustomerPortalShelfItem> = {}): CustomerPortalShelfItem {
  return {
    identityVersionId: '00000000-0000-4000-8000-000000000001',
    savedAt: '2025-01-10T10:00:00Z',
    saveOrigin: 'customer',
    lifecycleState: 'active',
    availability: 'available',
    snapshot: {
      slug: 'test-product',
      brand: 'Test Brand',
      name: 'Test Product',
      size: '50ml',
      versionNumber: 1,
      packageVersion: 'v1',
      formulaVersion: 'v1',
    },
    product: null,
    message: null,
    ...overrides,
  } as CustomerPortalShelfItem;
}

test('shelf context prefers saved-current over saved-changed when both match', () => {
  const items = [
    makeShelfItem({
      identityVersionId: '00000000-0000-4000-8000-000000000002',
      savedAt: '2025-01-15T10:00:00Z',
      lifecycleState: 'retired',
      availability: 'unavailable',
    }),
    makeShelfItem({
      identityVersionId: '00000000-0000-4000-8000-000000000001',
      savedAt: '2025-01-10T10:00:00Z',
      lifecycleState: 'active',
      availability: 'available',
    }),
  ];
  const ctx = deriveProductShelfContext(items, 'test-product', true, null);
  assert.equal(ctx.state, 'saved-current');
  if (ctx.state === 'saved-current') {
    assert.equal(ctx.shelfItem.identityVersionId, '00000000-0000-4000-8000-000000000001');
  }
});

test('shelf context selects most recently saved changed identity deterministically', () => {
  const items = [
    makeShelfItem({
      identityVersionId: '00000000-0000-4000-8000-000000000001',
      savedAt: '2025-01-10T10:00:00Z',
      lifecycleState: 'merged',
      availability: 'unavailable',
    }),
    makeShelfItem({
      identityVersionId: '00000000-0000-4000-8000-000000000002',
      savedAt: '2025-01-15T10:00:00Z',
      lifecycleState: 'superseded',
      availability: 'unavailable',
    }),
  ];
  const ctx = deriveProductShelfContext(items, 'test-product', true, null);
  assert.equal(ctx.state, 'saved-changed');
  if (ctx.state === 'saved-changed') {
    assert.equal(ctx.shelfItem.identityVersionId, '00000000-0000-4000-8000-000000000002');
  }
});

// --- Integration test: RetailerList uses the server-owned snapshot ---

test('RetailerList accepts a marketSnapshot prop and does not call summarizeMarket', () => {
  const source = readFileSync('components/commerce/retailer-list.tsx', 'utf8');
  assert.match(source, /marketSnapshot\?: ProductMarketSnapshot/, 'RetailerList must accept marketSnapshot');
  assert.doesNotMatch(source, /summarizeMarket\(/, 'RetailerList must not call summarizeMarket');
  assert.doesNotMatch(source, /from.*market-summary/, 'RetailerList must not import from market-summary');
});

test('RetailerList does not parse priceLabel back into a number', () => {
  const source = readFileSync('components/commerce/retailer-list.tsx', 'utf8');
  assert.doesNotMatch(source, /parseFloat.*priceLabel/, 'RetailerList must not parse priceLabel');
  assert.doesNotMatch(source, /priceLabel\.replace.*\d/, 'RetailerList must not strip characters from priceLabel');
  assert.match(source, /extras\?\.lowestPrice/, 'RetailerList must use numeric lowestPrice from extras');
});

test('ProductPanelData includes a marketSnapshot field', () => {
  const source = readFileSync('lib/catalogue/product-panel-model.ts', 'utf8');
  assert.match(source, /marketSnapshot\?: ProductMarketSnapshot/);
  assert.match(source, /buildProductMarketSnapshot/);
});

test('ProductQuickPanelSheet passes marketSnapshot to RetailerList', () => {
  const source = readFileSync('components/products/product-quick-panel.tsx', 'utf8');
  assert.match(source, /marketSnapshot=\{data\.marketSnapshot\}/);
});

// --- Integration test: preview shelf state ---

test('synthetic Product read model includes preview shelf with full catalogue and shelf', () => {
  const source = readFileSync('lib/customer/route-read-models.ts', 'utf8');
  assert.match(source, /previewShelf:/);
  assert.match(source, /shelf: readonly CustomerPortalShelfItem\[\]/);
  assert.match(source, /catalogue: readonly CustomerPortalProduct\[\]/);
});

test('shell adapter passes preview catalogue and shelf for synthetic customers', () => {
  const source = readFileSync('components/me/home/me-home.tsx', 'utf8');
  assert.match(source, /previewShelf\?\.catalogue/);
  assert.match(source, /previewShelf\s*\?\s*previewShelf\.shelf/);
});

test('route-scoped shelf repository has count and contextForProduct', () => {
  const source = readFileSync('lib/customer/shelf-repository.ts', 'utf8');
  assert.match(source, /count\(ownerSubject: string\): Promise<number>/);
  assert.match(source, /contextForProduct\(ownerSubject: string, slug: string\): Promise<CustomerShelfRecord\[\]>/);
});

test('route-scoped routine repository has summary and contextForProduct', () => {
  const source = readFileSync('lib/customer/routine-repository.ts', 'utf8');
  assert.match(source, /summary\(ownerSubject: string\): Promise/);
  assert.match(source, /contextForProduct\(ownerSubject: string, slug: string\): Promise<CustomerRoutineRecord\[\]>/);
});

test('readMeProduct uses narrow reads, not full list', () => {
  const source = readFileSync('lib/customer/route-read-models.ts', 'utf8');
  assert.match(source, /customerShelfService\.count\(identity\)/);
  assert.match(source, /customerShelfService\.contextForProduct\(identity, slug\)/);
  assert.match(source, /customerRoutineService\.summary\(identity\)/);
  assert.match(source, /customerRoutineService\.contextForProduct\(identity, slug\)/);
  // The product branch should NOT call the full read methods.
  const productFn = source.slice(source.indexOf('export async function readMeProduct'), source.indexOf('export async function', source.indexOf('export async function readMeProduct') + 1));
  assert.doesNotMatch(productFn, /customerShelfService\.read\(/, 'readMeProduct must not call customerShelfService.read');
  assert.doesNotMatch(productFn, /customerRoutineService\.read\(/, 'readMeProduct must not call customerRoutineService.read');
});
