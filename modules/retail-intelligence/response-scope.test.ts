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

test('rejects a same-brand same-size sibling variant', () => {
  assert.throws(() => assertRetailerResponseScope({
    ...valid,
    expectedTitle: 'CeraVe Foaming Facial Cleanser',
    expectedSize: '355 ml',
    observedTitle: 'CeraVe Hydrating Facial Cleanser 355 ml',
    observedSize: '355 ml',
  }), /title/);
  assert.throws(() => assertRetailerResponseScope({
    ...valid,
    observedTitle: 'PanOxyl Acne Foaming Wash 4% Benzoyl Peroxide 156g',
  }), /title/);
});

test('normalizes compact SPF tokens and UK or US moisturiser spelling', () => {
  assert.doesNotThrow(() => assertRetailerResponseScope({
    ...valid,
    expectedTitle: 'Example Moisturising Face Fluid UV SPF 30',
    observedTitle: 'Example Moisturizing Fluid UV SPF30 156g',
  }));
  assert.doesNotThrow(() => assertRetailerResponseScope({
    ...valid,
    expectedTitle: 'ANUA Niacinamide 10% + TXA 4% Serum',
    expectedSize: '30 ml',
    observedTitle: 'Anua Niacinamide 10% + Tranexamic Acid 4% Serum',
    observedSize: '30 ml',
  }));
});

test('normalizes manufacturer camel-case when retailers separate the same product name', () => {
  assert.doesNotThrow(() => assertRetailerResponseScope({
    ...valid,
    expectedTitle: 'Eucerin UreaRepair PLUS 10% Urea Body Lotion',
    expectedSize: '250 ml',
    observedTitle: 'EUCERIN Urea Repair Plus 10% Urea Lotion 250ml',
    observedSize: '250 ml',
  }));
  assert.doesNotThrow(() => assertRetailerResponseScope({
    ...valid,
    expectedTitle: 'FACE FACTS Bright + Clear Face Cream',
    expectedSize: '75 ml',
    observedTitle: 'FaceFacts Bright + Clear Face Cream – 75ml',
    observedSize: '75 ml',
  }));
});

test('accepts a deliberately curated catalogue-name alias without weakening the official variant', () => {
  assert.doesNotThrow(() => assertRetailerResponseScope({
    requestedUrl: 'https://buybetter.ng/product/dove-melanin-even-tone-5-body-wash-547ml/',
    responseUrl: 'https://buybetter.ng/product/dove-melanin-even-tone-5-body-wash-547ml/',
    expectedTitle: 'Melanin Even Tone Serum Body Wash with Pro-Ceramide',
    expectedTitleAliases: ['Melanin Even Tone 5% Body Wash'],
    expectedSize: '18.5 oz',
    observedTitle: 'DOVE MELANIN EVEN TONE 5% Body Wash 547ml',
    observedSize: '547 ml',
    marketCode: 'NG',
    currencyCode: 'NGN',
  }));

  assert.throws(() => assertRetailerResponseScope({
    requestedUrl: 'https://buybetter.ng/product/dove-melanin-even-tone-5-body-wash-547ml/',
    responseUrl: 'https://buybetter.ng/product/dove-melanin-even-tone-5-body-wash-547ml/',
    expectedTitle: 'Melanin Even Tone Serum Body Wash with Pro-Ceramide',
    expectedTitleAliases: ['Melanin Even Tone 5% Body Wash'],
    expectedSize: '18.5 oz',
    observedTitle: 'DOVE MEN+CARE CLEAN COMFORT BODY WASH 547ml',
    observedSize: '547 ml',
    marketCode: 'NG',
    currencyCode: 'NGN',
  }), /title/);
});

test('treats a packaging-only pot descriptor as optional', () => {
  assert.doesNotThrow(() => assertRetailerResponseScope({
    ...valid,
    expectedTitle: 'CeraVe Moisturising Cream Pot',
    expectedSize: '454 g',
    observedTitle: 'CeraVe Moisturizing Cream For Dry To Very Dry Skin - 454g',
    observedSize: '454 g',
  }));
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

test('uses an exact metric volume to disambiguate a cosmetic label shortened to ounces', () => {
  assert.doesNotThrow(() => assertRetailerResponseScope({
    requestedUrl: 'https://shop.example/dove-body-wash',
    responseUrl: 'https://shop.example/dove-body-wash',
    expectedTitle: 'Melanin Even Tone 5% Body Wash',
    expectedSize: '18.5 oz',
    observedTitle: 'Dove Melanin Even Tone 5% Body Wash',
    observedSize: '547 ml',
    marketCode: 'NG',
    currencyCode: 'NGN',
  }));
});

test('fails closed when the catalogue size is not measurable', () => {
  assert.throws(
    () => assertRetailerResponseScope({ ...valid, expectedSize: 'Variant pack' }),
    /cannot be verified/,
  );
});
