import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewedProductRecords } from '@/data/catalogue';
import productAssets from '@/data/product-assets.json';
import type { Offer } from '@/data/products';
import {
  hasBrandAuthorizationEvidence,
  hasCompletePriceObservation,
  hasListingEvidence,
  hasRegulatorMatch,
  hasSellerIdentityEvidence,
  materializeOfferEvidence,
  materializePersistedOfferEvidence,
  comparableMarketPrice,
  landedMarketPrice,
  observedDeliveryFee,
  observedStockLabel,
  observedMarketPrice,
} from './offer-evidence';

const now = new Date('2026-08-08T13:16:00Z');

const comparableOffer = (overrides: Partial<Offer> = {}): Offer => ({
  retailer: 'Store',
  url: 'https://example.com/product',
  trust: 90,
  available: true,
  priceNgn: 10_000,
  match: 'exact',
  listingEvidence: { observedAt: '2026-08-06', sourceUrl: 'https://example.com/product', basis: 'retailer-page' },
  priceObservation: { observedAt: '2026-08-06', variant: 'V', size: '30 ml', stock: 'in-stock', landedCost: 'excluded' },
  location: ['NG'],
  ...overrides,
});

test('a stated delivery fee makes the landed total the comparable price', () => {
  const offer = comparableOffer({ deliveryNgn: 1_500 });
  assert.equal(comparableMarketPrice(offer, 'NG', now), 10_000);
  assert.equal(observedDeliveryFee(offer, 'NG'), 1_500);
  assert.equal(landedMarketPrice(offer, 'NG', now), 11_500);
});

test('landed price never guesses a total when delivery is unknown or already included', () => {
  assert.equal(landedMarketPrice(comparableOffer(), 'NG', now), 10_000);
  assert.equal(
    landedMarketPrice(comparableOffer({ deliveryNgn: 1_500, priceObservation: { observedAt: '2026-08-06', variant: 'V', size: '30 ml', stock: 'in-stock', landedCost: 'included' } }), 'NG', now),
    10_000,
  );
  assert.equal(observedDeliveryFee(comparableOffer(), 'NG'), null);
});

test('a comparison-excluded observation has no landed price', () => {
  assert.equal(landedMarketPrice(comparableOffer({ priceComparison: 'exclude', deliveryNgn: 1_500 }), 'NG', now), null);
});

test('a price field without listing and observation evidence is not current retail intelligence', () => {
  const offer: Offer = {
    retailer: 'Unreviewed',
    url: 'https://example.com/product',
    trust: 100,
    available: true,
    priceNgn: 1_000,
    checkedAt: '2026-08-06',
    match: 'exact',
    location: ['NG'],
  };

  assert.equal(hasListingEvidence(offer), false);
  assert.equal(hasCompletePriceObservation(offer), false);
  assert.equal(observedMarketPrice(offer, 'NG', now), null);
});

test('a price observation cannot stand in for listing evidence', () => {
  const offer: Offer = {
    retailer: 'Unreviewed',
    url: 'https://example.com/product',
    trust: 100,
    available: true,
    priceNgn: 1_000,
    checkedAt: '2026-08-06',
    match: 'exact',
    priceObservation: {
      observedAt: '2026-08-06T10:00:00Z',
      variant: 'Example product',
      size: '100 ml',
      stock: 'in-stock',
      landedCost: 'unknown',
    },
    location: ['NG'],
  };

  assert.equal(hasCompletePriceObservation(offer), true);
  assert.equal(hasListingEvidence(offer), false);
  assert.equal(observedMarketPrice(offer, 'NG', now), null);
});

test('repository mapping promotes governed retailer-page, manual, or API verification into listing evidence', () => {
  const offer: Offer = {
    retailer: 'Store',
    url: 'https://example.com/product',
    trust: 90,
    available: true,
    priceNgn: 2_000,
    checkedAt: '2026-08-06T10:00:00Z',
    match: 'exact',
    location: ['NG'],
  };
  const imported = materializePersistedOfferEvidence(
    { name: 'Example', size: '100 ml' },
    offer,
    { verificationMethod: 'import', lastVerifiedAt: offer.checkedAt, inventoryStatus: 'in_stock' },
  );
  const checked = materializePersistedOfferEvidence(
    { name: 'Example', size: '100 ml' },
    offer,
    {
      verificationMethod: 'retailer_page',
      lastVerifiedAt: offer.checkedAt,
      inventoryStatus: 'low_stock',
      observedTitle: 'Example 100 ml',
      observedSize: '100 ml',
    },
  );
  const manuallyChecked = materializePersistedOfferEvidence(
    { name: 'Example', size: '100 ml' },
    offer,
    {
      verificationMethod: 'manual',
      lastVerifiedAt: offer.checkedAt,
      inventoryStatus: 'in_stock',
      observedTitle: 'Example 100 ml',
      observedSize: '100 ml',
    },
  );
  assert.equal(hasListingEvidence(imported), false);
  assert.equal(observedMarketPrice(imported, 'NG', now), null);
  assert.equal(hasListingEvidence(checked), true);
  assert.equal(checked.priceObservation?.stock, 'low-stock');
  assert.equal(checked.priceObservation?.variant, 'Example 100 ml');
  assert.equal(checked.priceObservation?.size, '100 ml');
  assert.equal(observedMarketPrice(checked, 'NG', now), 2_000);
  assert.equal(hasListingEvidence(manuallyChecked), true);
  assert.equal(observedMarketPrice(manuallyChecked, 'NG', now), 2_000);
});

test('retailer UI preserves observed low-stock detail', () => {
  const offer: Offer = {
    retailer: 'Marketplace',
    url: 'https://example.com/product',
    trust: 80,
    available: true,
    priceNgn: 2_000,
    match: 'exact',
    priceObservation: {
      observedAt: '2026-08-06T10:00:00Z',
      variant: 'Example 100 ml',
      size: '100 ml',
      stock: 'low-stock',
      landedCost: 'unknown',
    },
    location: ['NG'],
  };

  assert.equal(observedStockLabel(offer, true), 'Low stock');
  assert.equal(observedStockLabel({ ...offer, inventoryQuantity: 2 }, true), '2 left');
  assert.equal(observedStockLabel(offer, false), 'Check stock');
});

test('catalogue expectations never manufacture retailer listing or price evidence', () => {
  const offer = materializeOfferEvidence(
    { name: 'Expected title', size: '100 ml' },
    {
      retailer: 'Store',
      url: 'https://example.com/product',
      trust: 90,
      available: true,
      priceNgn: 2_000,
      checkedAt: '2026-08-06',
      match: 'exact',
      location: ['NG'],
    },
  );

  assert.equal(offer.listingEvidence, undefined);
  assert.equal(offer.priceObservation, undefined);
  assert.equal(observedMarketPrice(offer, 'NG', now), null);
});

test('persisted observations fail closed without the retailer-observed size', () => {
  const offer = materializePersistedOfferEvidence(
    { name: 'Expected title', size: '100 ml' },
    {
      retailer: 'Store',
      url: 'https://example.com/product',
      trust: 90,
      available: true,
      priceNgn: 2_000,
      match: 'exact',
      location: ['NG'],
    },
    {
      verificationMethod: 'retailer_page',
      lastVerifiedAt: '2026-08-06',
      inventoryStatus: 'in_stock',
      observedTitle: 'Observed title',
    },
  );

  assert.equal(hasListingEvidence(offer), true);
  assert.equal(offer.priceObservation, undefined);
  assert.equal(observedMarketPrice(offer, 'NG', now), null);
});

test('display-only marketplace observations stay visible but out of comparisons', () => {
  const offer: Offer = {
    retailer: 'Marketplace',
    url: 'https://example.com/product',
    trust: 60,
    available: true,
    priceNgn: 7_999,
    match: 'exact',
    priceComparison: 'exclude',
    listingEvidence: {
      observedAt: '2026-08-06',
      sourceUrl: 'https://example.com/product',
      basis: 'retailer-page',
    },
    priceObservation: {
      observedAt: '2026-08-06',
      variant: 'Observed title',
      size: '30 ml',
      stock: 'in-stock',
      landedCost: 'unknown',
    },
    location: ['NG'],
  };

  assert.equal(observedMarketPrice(offer, 'NG', now), 7_999);
  assert.equal(comparableMarketPrice(offer, 'NG', now), null);
});

test('seller labels and official-store booleans do not fabricate identity or authorization evidence', () => {
  const offer: Offer = {
    retailer: 'Marketplace',
    url: 'https://example.com/product',
    trust: 100,
    available: true,
    sellerName: 'Visible seller',
    sellerScore: 99,
    officialStore: true,
    location: ['NG'],
  };

  assert.equal(hasSellerIdentityEvidence(offer), false);
  assert.equal(hasBrandAuthorizationEvidence(offer), false);
});

test('regulator and brand authorization claims require their specific evidence sources', () => {
  assert.equal(hasRegulatorMatch({
    reviewStatus: 'directory-listed',
    contentUse: 'link-only',
    regulatorMatch: {
      observedAt: '2026-08-06T10:00:00Z',
      sourceUrl: 'https://registry.example/company/123',
      basis: 'independent-register',
      authority: 'Example regulator',
      registrationNumber: '123',
    },
  }), true);

  const offer: Offer = {
    retailer: 'Brand shop',
    url: 'https://shop.example/product',
    trust: 100,
    available: true,
    brandAuthorizationEvidence: {
      observedAt: '2026-08-06T10:00:00Z',
      sourceUrl: 'https://brand.example/authorized-retailers',
      basis: 'brand-source',
      brand: 'Example',
    },
    location: ['NG'],
  };

  assert.equal(hasBrandAuthorizationEvidence(offer, 'Example'), true);
  assert.equal(hasBrandAuthorizationEvidence(offer, 'Different brand'), false);
});

test('Slique remains provisional and link-only with a complete dated Mediana observation', () => {
  const mediana = reviewedProductRecords.find(product => product.slug === 'mediana-leave-in-conditioning-milk');
  assert.ok(mediana);
  const offer = mediana.offers.find(item => item.retailer === 'Slique Beauty');

  assert.ok(offer);
  assert.equal(offer.retailerEvidence?.reviewStatus, 'provisional');
  assert.equal(offer.retailerEvidence?.contentUse, 'link-only');
  assert.equal(hasRegulatorMatch(offer.retailerEvidence), false);
  assert.equal(hasBrandAuthorizationEvidence(offer), false);
  assert.equal(hasListingEvidence(offer), true);
  assert.equal(hasCompletePriceObservation(offer), true);
  assert.equal(offer.priceObservation?.size, '250 ml');
  assert.equal(offer.priceObservation?.landedCost, 'unknown');
  assert.equal(observedMarketPrice(offer, 'NG', now), 22_500);
  assert.equal(mediana.image, 'https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/mediana/mediana-leave-in-conditioning-milk/packshot-v1.png');
  assert.equal('mediana-leave-in-conditioning-milk' in productAssets, true);
});
