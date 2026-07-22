import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRetailerResponseScope } from './response-scope';

const valid = {
  requestedUrl: 'https://www.jumia.com.ng/panoxyl-acne-foaming-wash-156g.html',
  responseUrl: 'https://jumia.com.ng/panoxyl-acne-foaming-wash-156g.html?campaign=care',
  canonicalUrl: 'https://www.jumia.com.ng/panoxyl-acne-foaming-wash-156g.html',
  expectedTitle: 'PanOxyl Acne Foaming Wash 10% Benzoyl Peroxide',
  expectedSize: '156 g',
  observedTitle: 'PanOxyl Acne Foaming Wash 10% Benzoyl Peroxide 156g',
  marketCode: 'NG',
  currencyCode: 'NGN',
};

test('accepts the same product route, title, size and market currency', () => {
  assert.doesNotThrow(() => assertRetailerResponseScope(valid));
});

test('rejects a product URL that redirects to a category page', () => {
  assert.throws(
    () => assertRetailerResponseScope({ ...valid, responseUrl: 'https://www.jumia.com.ng/face-moisturizers/' }),
    /redirected away/,
  );
});

test('rejects canonical, title, size and currency mismatches', () => {
  assert.throws(() => assertRetailerResponseScope({ ...valid, canonicalUrl: 'https://jumia.com.ng/face-cleansers/' }), /canonical URL/);
  assert.throws(() => assertRetailerResponseScope({ ...valid, observedTitle: 'CeraVe Acne Control Cleanser 156g' }), /title/);
  assert.throws(() => assertRetailerResponseScope({ ...valid, observedTitle: 'PanOxyl Acne Foaming Wash 100ml' }), /size/);
  assert.throws(() => assertRetailerResponseScope({ ...valid, currencyCode: 'USD' }), /currency/);
});
