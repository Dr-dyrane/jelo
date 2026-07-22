import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewedProductRecords } from '@/data/catalogue';
import { mergeRetailOffers, verifiedRetailOffers } from '@/data/retail-offers';
import { nigeriaRetailers } from '@/data/retailers';
import { hasCompletePriceObservation, hasListingEvidence } from './offer-evidence';

const searchRouteMarkers = ['?s=', '&s=', '/search?', '/catalog/?q=', '/catalogsearch/'];

test('verified Nigerian observations use exact secure product pages', () => {
  const registered = new Set(nigeriaRetailers.map(retailer => retailer.name));
  const observations = Object.entries(verifiedRetailOffers).flatMap(([slug, offers]) =>
    offers.map(offer => ({ slug, offer })),
  );

  assert.ok(observations.length >= 17);
  for (const { slug, offer } of observations) {
    const url = new URL(offer.url);
    assert.equal(offer.match, 'exact', `${slug}: ${offer.retailer} must be exact`);
    assert.deepEqual(offer.location, ['NG'], `${slug}: ${offer.retailer} must be Nigerian`);
    assert.equal(url.protocol, 'https:');
    assert.ok(url.pathname !== '/', `${slug}: ${offer.retailer} needs a product path`);
    assert.equal(searchRouteMarkers.some(marker => offer.url.toLowerCase().includes(marker)), false);
    assert.ok(Number.isInteger(offer.priceNgn) && offer.priceNgn! > 0);
    assert.ok(offer.checkedAt && !Number.isNaN(Date.parse(offer.checkedAt)));
    assert.ok(registered.has(offer.retailer), `${offer.retailer} must be in the public registry`);
  }
});

test('at least fifteen catalogue products have reliable exact Nigerian price evidence', () => {
  const priced = reviewedProductRecords.filter(product => product.offers.some(offer =>
    offer.location.includes('NG')
    && offer.match === 'exact'
    && typeof offer.priceNgn === 'number'
    && offer.priceNgn > 0,
  ));

  assert.ok(priced.length >= 15, `expected at least 15 priced products, received ${priced.length}`);
});

test('every curated exact price carries listing, variant, size, stock, time and landed-cost evidence', () => {
  const priced = Object.values(verifiedRetailOffers).flat().filter(offer =>
    offer.match === 'exact'
    && (typeof offer.priceNgn === 'number' || typeof offer.priceUsd === 'number'));

  assert.ok(priced.length > 0);
  for (const offer of priced) {
    assert.equal(hasListingEvidence(offer), true, `${offer.retailer} listing evidence`);
    assert.equal(hasCompletePriceObservation(offer), true, `${offer.retailer} price observation`);
  }
});

test('featured marketplace offers retain visible seller evidence', () => {
  const mediana = verifiedRetailOffers['mediana-leave-in-conditioning-milk']?.find(offer => offer.retailer === 'Jumia');
  const anua = verifiedRetailOffers['anua-niacinamide-10-txa-4-serum']?.find(offer => offer.retailer === 'Jumia');

  assert.deepEqual(
    { seller: mediana?.sellerName, score: mediana?.sellerScore, quantity: mediana?.inventoryQuantity },
    { seller: 'Jeto', score: 88, quantity: 4 },
  );
  assert.deepEqual(
    { seller: anua?.sellerName, score: anua?.sellerScore, priceComparison: anua?.priceComparison },
    { seller: 'Smile Time', score: 92, priceComparison: 'exclude' },
  );

  const disaar = verifiedRetailOffers['disaar-argan-oil-body-oil-gel']?.find(offer => offer.retailer === 'Jumia');
  assert.deepEqual(
    { seller: disaar?.sellerName, score: disaar?.sellerScore, stock: disaar?.priceObservation?.stock },
    { seller: 'Christodel Global Services', score: 88, stock: 'low-stock' },
  );
});

test('the inconsistent B.LAB Matcha listing is not published as an exact offer', () => {
  assert.equal(verifiedRetailOffers['b-lab-matcha-hydrating-real-sunscreen'], undefined);
});

test('PanOxyl publishes only the current GTIN-matched Slique observation', () => {
  const slug = 'panoxyl-acne-foaming-wash-10-benzoyl-peroxide';
  const offers = verifiedRetailOffers[slug];

  assert.equal(offers.length, 1);
  assert.deepEqual(
    {
      retailer: offers[0]?.retailer,
      priceNgn: offers[0]?.priceNgn,
      checkedAt: offers[0]?.checkedAt,
      observedAt: offers[0]?.listingEvidence?.observedAt,
      evidenceSource: offers[0]?.listingEvidence?.sourceUrl,
      evidenceBasis: offers[0]?.listingEvidence?.basis,
      variant: offers[0]?.priceObservation?.variant,
      size: offers[0]?.priceObservation?.size,
      stock: offers[0]?.priceObservation?.stock,
    },
    {
      retailer: 'Slique Beauty',
      priceNgn: 19300,
      checkedAt: '2026-07-22T14:44:09Z',
      observedAt: '2026-07-22T14:44:09Z',
      evidenceSource: 'https://sliquebeautylimited.com/wp-json/wc/store/v1/products?slug=panoxyl-acne-foaming-wash-benzoyl-peroxide-10-maximum-strength-156g',
      evidenceBasis: 'retailer-api',
      variant: 'PANOXYL ACNE FOAMING WASH BENZOYL PEROXIDE 10% MAXIMUM STRENGTH -156G',
      size: '156 g',
      stock: 'in-stock',
    },
  );
  assert.equal(offers[0]?.brandAuthorizationEvidence, undefined);
});

test('stale PanOxyl Teeka and Lux routes cannot leak through base offers', () => {
  const merged = mergeRetailOffers(
    {
      slug: 'panoxyl-acne-foaming-wash-10-benzoyl-peroxide',
      name: 'Acne Foaming Wash 10% Benzoyl Peroxide',
      size: '156 g',
    },
    [
      {
        retailer: 'Teeka4',
        url: 'https://teeka4.com/shop/panoxyl-acne-foaming-wash-benzoyl-peroxide-10-maximum-strength/',
        trust: 98,
        available: false,
        priceNgn: 13300,
        location: ['NG'],
      },
      {
        retailer: 'Lux Beauty',
        url: 'https://www.luxbeautyng.com/product/panoxyl-acne-creamy-wash-benzoyl-peroxide-10/',
        trust: 96,
        available: true,
        priceNgn: 17500,
        location: ['NG'],
      },
    ],
  );

  assert.deepEqual(merged.map(offer => offer.retailer), ['Slique Beauty']);
  assert.equal(merged[0]?.brandAuthorizationEvidence, undefined);
});

test('Ghana-priced routes never appear as Nigerian offers', () => {
  const kuza = reviewedProductRecords.find(product => product.slug === 'kuza-indian-hemp-hair-scalp-treatment');
  const perfectPicture = kuza?.offers.find(offer => offer.retailer === 'Perfect Picture Cosmetics');

  assert.ok(perfectPicture);
  assert.deepEqual(perfectPicture.location, ['GH']);
});
