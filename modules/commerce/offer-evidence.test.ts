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
  observedStockLabel,
  observedMarketPrice,
} from './offer-evidence';

const now = new Date('2026-07-22T12:00:00Z');

test('a price field without listing and observation evidence is not current retail intelligence', () => {
  const offer: Offer = {
    retailer: 'Unreviewed',
    url: 'https://example.com/product',
    trust: 100,
    available: true,
    priceNgn: 1_000,
    checkedAt: '2026-07-22',
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
    checkedAt: '2026-07-22',
    match: 'exact',
    priceObservation: {
      observedAt: '2026-07-22T10:00:00Z',
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

test('repository mapping promotes only retailer-page or API verification into listing evidence', () => {
  const offer: Offer = {
    retailer: 'Store',
    url: 'https://example.com/product',
    trust: 90,
    available: true,
    priceNgn: 2_000,
    checkedAt: '2026-07-22T10:00:00Z',
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
  assert.equal(hasListingEvidence(imported), false);
  assert.equal(observedMarketPrice(imported, 'NG', now), null);
  assert.equal(hasListingEvidence(checked), true);
  assert.equal(checked.priceObservation?.stock, 'low-stock');
  assert.equal(checked.priceObservation?.variant, 'Example 100 ml');
  assert.equal(checked.priceObservation?.size, '100 ml');
  assert.equal(observedMarketPrice(checked, 'NG', now), 2_000);
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
      observedAt: '2026-07-22T10:00:00Z',
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
      checkedAt: '2026-07-22',
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
      lastVerifiedAt: '2026-07-22',
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
      observedAt: '2026-07-22',
      sourceUrl: 'https://example.com/product',
      basis: 'retailer-page',
    },
    priceObservation: {
      observedAt: '2026-07-22',
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
      observedAt: '2026-07-22T10:00:00Z',
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
      observedAt: '2026-07-22T10:00:00Z',
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
  assert.equal(observedMarketPrice(offer, 'NG', now), 1_500);
  assert.equal(mediana.image, '/product-placeholder.svg');
  assert.equal('mediana-leave-in-conditioning-milk' in productAssets, false);
});
