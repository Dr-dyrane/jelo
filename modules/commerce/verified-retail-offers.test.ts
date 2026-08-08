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

test('at least thirteen catalogue products have reliable exact Nigerian price evidence', () => {
  const priced = reviewedProductRecords.filter(product => product.offers.some(offer =>
    offer.location.includes('NG')
    && offer.match === 'exact'
    && typeof offer.priceNgn === 'number'
    && offer.priceNgn > 0,
  ));

  assert.ok(priced.length >= 13, `expected at least 13 priced products, received ${priced.length}`);
});

test('browser-verified Beauty by Daz prices serve exact original catalogue products', () => {
  const expected = [
    ['cosrx-salicylic-acid-daily-gentle-cleanser', 8_500, '150 ml', false],
    ['anua-niacinamide-10-txa-4-serum', 18_850, '30 ml', false],
    ['face-facts-bright-clear-face-cream', 7_500, '75 ml', true],
  ] as const;

  for (const [slug, priceNgn, size, available] of expected) {
    const offer = verifiedRetailOffers[slug]?.find(candidate => candidate.retailer === 'Beauty by Daz');
    assert.ok(offer, slug);
    assert.equal(offer.priceNgn, priceNgn, slug);
    assert.equal(offer.available, available, slug);
    assert.equal(offer.priceObservation?.size, size, slug);
    assert.equal(offer.listingEvidence?.basis, 'retailer-page', slug);
    assert.equal(new URL(offer.url).hostname, 'beautybydaz.com', slug);
  }
});

test('catalogue coverage batch 1 preserves its fresh Beauty by Daz observations', () => {
  const expected = [
    ['anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml', 18_850, true, '30 ml', '2026-08-08T13:15:00Z'],
    ['dove-melanin-even-tone-body-wash-18-5oz', 19_500, false, '547 ml / 18.5 fl oz', '2026-08-08T13:15:00Z'],
  ] as const;

  for (const [slug, priceNgn, available, size, checkedAt] of expected) {
    const offer = verifiedRetailOffers[slug]?.find(candidate => candidate.retailer === 'Beauty by Daz');
    assert.ok(offer, slug);
    assert.equal(offer.priceNgn, priceNgn, slug);
    assert.equal(offer.available, available, slug);
    assert.equal(offer.checkedAt, checkedAt, slug);
    assert.equal(offer.listingEvidence?.observedAt, offer.checkedAt, slug);
    assert.equal(offer.listingEvidence?.sourceUrl, offer.url, slug);
    assert.equal(offer.priceObservation?.observedAt, offer.checkedAt, slug);
    assert.equal(offer.priceObservation?.size, size, slug);
  }
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
    { seller: mediana?.sellerName, score: mediana?.sellerScore },
    { seller: 'Jeto', score: 88 },
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

test('the B.LAB Matcha listing publishes verified Perona Beauty offer', () => {
  const offers = verifiedRetailOffers['b-lab-matcha-hydrating-real-sunscreen'];
  assert.ok(offers && offers.length >= 1);
  assert.equal(offers[0].retailer, 'Perona Beauty');
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
      priceNgn: 3500,
      checkedAt: '2026-08-08T13:15:00Z',
      observedAt: '2026-08-08T13:15:00Z',
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
