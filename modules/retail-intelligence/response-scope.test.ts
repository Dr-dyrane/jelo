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
  observedSize: '156g',
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
  assert.throws(() => assertRetailerResponseScope({ ...valid, observedSize: '100 ml' }), /size/);
  assert.throws(() => assertRetailerResponseScope({ ...valid, currencyCode: 'USD' }), /currency/);
});

test('fails closed when observed title or size evidence is missing', () => {
  assert.throws(() => assertRetailerResponseScope({ ...valid, observedTitle: undefined }), /title evidence is missing/);
  assert.throws(() => assertRetailerResponseScope({ ...valid, observedSize: undefined }), /size evidence is missing/);
  assert.throws(() => assertRetailerResponseScope({ ...valid, observedSize: 'large bottle' }), /not measurable/);
});

test('accepts equivalent metric and imperial size evidence', () => {
  assert.doesNotThrow(() => assertRetailerResponseScope({
    ...valid,
    expectedSize: '50 ml',
    observedSize: '1.7 fl oz',
  }));
  assert.doesNotThrow(() => assertRetailerResponseScope({
    ...valid,
    expectedSize: '8 oz / 226 g',
    observedSize: '226 g',
  }));
});

test('fails closed when the catalogue size is not measurable', () => {
  assert.throws(
    () => assertRetailerResponseScope({ ...valid, expectedSize: 'Variant pack' }),
    /cannot be verified/,
  );
});
