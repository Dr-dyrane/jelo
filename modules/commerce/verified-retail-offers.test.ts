import assert from 'node:assert/strict';
import test from 'node:test';
import { products } from '@/data/catalogue';
import { verifiedRetailOffers } from '@/data/retail-offers';
import { nigeriaRetailers } from '@/data/retailers';

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

test('at least sixteen catalogue products have an exact Nigerian price', () => {
  const priced = products.filter(product => product.offers.some(offer =>
    offer.location.includes('NG')
    && offer.match === 'exact'
    && typeof offer.priceNgn === 'number'
    && offer.priceNgn > 0,
  ));

  assert.ok(priced.length >= 16, `expected at least 16 priced products, received ${priced.length}`);
});

test('featured marketplace offers retain visible seller evidence', () => {
  const mediana = verifiedRetailOffers['mediana-leave-in-conditioning-milk']?.find(offer => offer.retailer === 'Jumia');
  const anua = verifiedRetailOffers['anua-niacinamide-10-txa-4-serum']?.find(offer => offer.retailer === 'Jumia');

  assert.deepEqual(
    { seller: mediana?.sellerName, score: mediana?.sellerScore, quantity: mediana?.inventoryQuantity },
    { seller: 'Jeto', score: 88, quantity: 6 },
  );
  assert.deepEqual(
    { seller: anua?.sellerName, score: anua?.sellerScore },
    { seller: 'Smile Time', score: 92 },
  );
});

test('Ghana-priced routes never appear as Nigerian offers', () => {
  const kuza = products.find(product => product.slug === 'kuza-indian-hemp-hair-scalp-treatment');
  const perfectPicture = kuza?.offers.find(offer => offer.retailer === 'Perfect Picture Cosmetics');

  assert.ok(perfectPicture);
  assert.deepEqual(perfectPicture.location, ['GH']);
});
