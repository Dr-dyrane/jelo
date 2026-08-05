import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { products } from '@/data/catalogue';
import { externalCatalogueCandidates, externalProducts } from '@/data/external-catalogue';
import { getReviewedProductCare } from '@/data/product-care-review';
import type { ReviewedProduct } from '@/data/products';
import { inventoryCategories, queryInventoryRecords } from '@/lib/catalogue/inventory-query';

function normalize(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

test('returns only reviewed products and deliberately approved community records', () => {
  const result = queryInventoryRecords(products);
  const publicTotal = products.length + externalProducts.length;
  const supportiveTotal = products.filter(product => getReviewedProductCare(product.slug)?.careState === 'supportive_eligible').length;
  const expectedStepCounts = new Map<string, number>();
  for (const product of products) {
    const key = normalize(product.step);
    expectedStepCounts.set(key, (expectedStepCounts.get(key) ?? 0) + 1);
  }
  const actualStepCounts = result.facets.steps.map(
    facet => [normalize(facet.value), facet.count] as const,
  );
  assert.equal(result.total, publicTotal);
  assert.equal(result.items.length, Math.min(24, publicTotal));
  assert.equal(result.page, 1);
  assert.equal(result.pageCount, Math.max(1, Math.ceil(publicTotal / 24)));
  assert.equal(result.facets.reviewed, products.length);
  assert.equal(result.facets.supportive, supportiveTotal);
  assert.equal(result.facets.community, externalProducts.length);
  assert.deepEqual(result.facets.categories.map(facet => facet.value), inventoryCategories);
  assert.equal(result.facets.categories.reduce((sum, facet) => sum + facet.count, 0), publicTotal);
  assert.equal(
    new Set(actualStepCounts.map(([step]) => step)).size,
    actualStepCounts.length,
  );
  assert.deepEqual(
    [...actualStepCounts].sort(([left], [right]) => left.localeCompare(right)),
    [...expectedStepCounts].sort(([left], [right]) => left.localeCompare(right)),
  );
  assert.ok(result.items.slice(0, products.length).every(item => item.kind === 'reviewed'));
});

test('a selected zero-result category remains available for clear and undo', () => {
  const result = queryInventoryRecords(products, { category: 'Hair & scalp', q: 'cerave' });
  const selected = result.facets.categories.find(facet => facet.value === 'Hair & scalp');

  assert.equal(result.filters.category, 'Hair & scalp');
  assert.equal(selected?.count, 0);
});

test('a private candidate barcode cannot leak into public search', () => {
  const approved = new Set(externalProducts.map(product => product.barcode));
  const privateCandidate = externalCatalogueCandidates.find(candidate => !approved.has(candidate.barcode));
  assert.ok(privateCandidate);
  const result = queryInventoryRecords(products, { q: privateCandidate.barcode });
  assert.equal(result.total, 0);
});

test('normalizes punctuation without fuzzy clinical matching', () => {
  const punctuation = queryInventoryRecords(products, { q: 'la roche posay spf 30' });
  assert.ok(punctuation.items.some(item => item.name.includes('SPF 30')));

  const joined = queryInventoryRecords(products, { q: 'la roche posay double repair matte' });
  assert.ok(joined.items.some(item => item.name.includes('Double Repair Matte')));

  const joinedBrand = queryInventoryRecords(products, { q: 'facefacts' });
  assert.ok(joinedBrand.items.some(item => (
    item.kind === 'reviewed'
    && item.slug === 'facefacts-ceramide-oil-control-foaming-cleanser-400ml'
  )));
  assert.ok(joinedBrand.items.some(item => (
    item.kind === 'reviewed'
    && item.slug === 'facefacts-ceramide-hydrating-gentle-cleanser-400ml'
  )));
});

test('indexes only manifest-approved supportive discovery terms', () => {
  const barrier = queryInventoryRecords(products, { q: 'barrier', review: 'reviewed' });
  assert.deepEqual(barrier.items.map(item => item.id), [
    'reviewed:cerave-pm-facial-moisturising-lotion-52ml',
    'reviewed:facefacts-ceramide-moisturising-gel-cream-50ml',
    'reviewed:simple-kind-to-skin-refreshing-facial-gel-wash-150ml',
  ]);

  const approvedUse = queryInventoryRecords(products, { q: 'oiliness', review: 'reviewed' });
  assert.deepEqual(approvedUse.items.map(item => item.id), [
    'reviewed:cerave-foaming-facial-cleanser',
    'reviewed:eucerin-oil-control-sun-gel-cream-spf50-50ml',
    'reviewed:facefacts-ceramide-oil-control-foaming-cleanser-400ml',
  ]);

  const oiliness = queryInventoryRecords(products, { q: 'oiliness', review: 'reviewed' });
  assert.deepEqual(oiliness.items.map(item => item.id), approvedUse.items.map(item => item.id));
});

test('concern browsing includes explicit reviewed references without turning them into direct recommendations', () => {
  const concern = queryInventoryRecords(products, { concern: 'acne-breakouts' });
  assert.deepEqual(concern.items.map(item => item.id), [
    'reviewed:anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml',
    'reviewed:balance-niacinamide-blemish-recovery-serum-30ml',
    'reviewed:balance-salicylic-acid-zinc-clarifying-toner-200ml',
    'reviewed:cerave-acne-foaming-cream-cleanser-4-150ml',
    'reviewed:cerave-acne-foaming-cream-wash-10-150ml',
    'reviewed:cerave-blemish-control-cleanser',
    'reviewed:dang-azelaic-acid-serum-30ml',
    'reviewed:de-la-cruz-acne-treatment-10-sulfur-73-7g',
    'reviewed:facefacts-ceramide-blemish-gel-moisturiser-50ml',
    'reviewed:nineless-a-control-10-azelaic-acid-serum-30ml',
    'reviewed:panoxyl-acne-foaming-wash-10-benzoyl-peroxide',
    'reviewed:the-ordinary-azelaic-acid-suspension-10',
  ]);

  const approvedConcern = queryInventoryRecords(products, { concern: 'oily-congested-skin' });
  assert.deepEqual(approvedConcern.items.map(item => item.id), [
    'reviewed:balance-niacinamide-blemish-recovery-serum-30ml',
    'reviewed:balance-salicylic-acid-zinc-clarifying-toner-200ml',
    'reviewed:cerave-foaming-facial-cleanser',
    'reviewed:eucerin-oil-control-sun-gel-cream-spf50-50ml',
    'reviewed:facefacts-ceramide-oil-control-foaming-cleanser-400ml',
  ]);

  const conditionPattern = queryInventoryRecords(products, { concern: 'hidradenitis-pattern' });
  assert.equal(conditionPattern.filters.concern, 'hidradenitis-pattern');
  assert.equal(conditionPattern.total, 0);
  assert.deepEqual(conditionPattern.items, []);

  assert.deepEqual(
    queryInventoryRecords(products).facets.concerns.map(facet => [facet.value, facet.total]),
    [
      ['acne-breakouts', 12],
      ['dark-spots', 6],
      ['sensitive-barrier', 3],
      ['dry-dehydrated-skin', 5],
      ['dry-rough-body-skin', 6],
      ['sweat-body-odour', 1],
      ['oily-congested-skin', 5],
      ['daily-sun-protection', 1],
      ['dandruff-itchy-scalp', 1],
      ['dry-frizzy-hair', 4],
    ],
  );

  const routine = queryInventoryRecords(products, { step: 'protect' });
  const expectedRoutine = products.filter(product => product.step === 'Protect');
  assert.equal(routine.total, expectedRoutine.length);
  assert.equal(routine.filters.step, 'Protect');
  assert.ok(routine.items.every(item => item.kind === 'reviewed' && item.step === 'Protect'));
  assert.deepEqual(new Set(routine.items.map(item => item.id)), new Set(expectedRoutine.map(product => `reviewed:${product.slug}`)));
});

test('supportive source filtering stays limited to reviewed eligible products', () => {
  const result = queryInventoryRecords(products, { review: 'supportive' });
  const expected = products
    .filter(product => getReviewedProductCare(product.slug)?.careState === 'supportive_eligible')
    .map(product => `reviewed:${product.slug}`);
  assert.deepEqual(new Set(result.items.map(item => item.id)), new Set(expected));
  assert.ok(result.items.every(item => item.kind === 'reviewed' && item.careState === 'supportive_eligible'));
});

test('browse surfaces separate neutral records from supportive use', async () => {
  const [home, productsPage, merchandising, productCard, inventoryCard, productExperience, storefront, filterSheet, filterStyles] = await Promise.all([
    readFile(path.join(process.cwd(), 'app/(site)/page.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'app/(site)/products/page.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'components/products/catalogue-merchandising.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'components/products/product-card.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'components/products/inventory-card.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'app/product-experience.css'), 'utf8'),
    readFile(path.join(process.cwd(), 'app/storefront.css'), 'utf8'),
    readFile(path.join(process.cwd(), 'components/products/inventory-filter-sheet.tsx'), 'utf8'),
    readFile(path.join(process.cwd(), 'components/products/inventory-filter-sheet.module.css'), 'utf8'),
  ]);

  assert.doesNotMatch(home, /product\.(?:bestFor|concerns|skinTypes|sensitiveFriendly|step|displayLine)/);
  assert.match(home, /listRecommendationEligibleProducts/);
  assert.match(home, /Key ingredients/);
  assert.match(home, /A partial view/);
  assert.match(home, /review=supportive/);
  assert.match(home, /const newAndNoteworthy = products\.slice\(12, 24\);/);
  assert.doesNotMatch(home, /slice\(12, 24\)\.length/);
  assert.match(home, /hairCare\.length \? 'Hair & scalp' : null/);
  assert.match(productsPage, /Profiles show products and prices/);
  assert.match(productsPage, /Supportive use adds a care review/);
  assert.match(productsPage, /review: 'supportive'/);
  assert.doesNotMatch(productsPage, /inventoryCategories\.map/);
  assert.match(merchandising, /\/concerns\/dandruff-itchy-scalp/);
  assert.match(productsPage, /externalProductsCount \? 'Two catalogue sources' : 'Catalogue context'/);
  assert.match(productsPage, /externalProductsCount \? <a href="https:\/\/world\.openbeautyfacts\.org\/data"/);
  assert.doesNotMatch(productsPage, /product\.(?:bestFor|concerns|skinTypes|sensitiveFriendly|step|displayLine)/);
  assert.doesNotMatch(productCard, /\{product\.(?:step|displayLine)\}/);
  assert.doesNotMatch(productCard, /styles\.(?:step|price|reveal)/);
  assert.doesNotMatch(inventoryCard, /styles\.(?:status|price)/);
  assert.equal(productCard.match(/<Link\b/g)?.length, 1);
  assert.equal(inventoryCard.match(/<Link\b/g)?.length, 1);
  assert.doesNotMatch(productExperience, /\.product-visual(?:::\w+|[\s\S]{0,40})::after/);
  assert.match(storefront, /\.product-rail::\-webkit-scrollbar\s*\{\s*display:\s*none/);
  assert.doesNotMatch(filterSheet, /<select/);
  assert.match(filterSheet, /Profiles, not treatment advice/);
  assert.match(filterSheet, /All concern guides/);
  assert.doesNotMatch(filterStyles, /#(?:85736d|8c7972)/i);
});

test('applies combined facets and clamps invalid pages', () => {
  const bodyCommunity = queryInventoryRecords(products, { category: 'Body care', review: 'community', page: '2' });
  const approvedBody = externalProducts.filter(product => product.category === 'Body care').length;
  assert.equal(bodyCommunity.total, approvedBody);
  assert.equal(bodyCommunity.page, Math.min(2, Math.max(1, Math.ceil(approvedBody / 24))));
  assert.ok(bodyCommunity.items.every(item => item.kind === 'community' && item.category === 'Body care'));

  assert.equal(queryInventoryRecords(products, { page: 'not-a-page' }).page, 1);
  const last = queryInventoryRecords(products, { page: '9999' });
  assert.equal(last.page, last.pageCount);
  const expectedLastPage = (products.length + externalProducts.length) % 24 || Math.min(24, products.length + externalProducts.length);
  assert.equal(last.items.length, expectedLastPage);
});

test('sorts only valid source update timestamps as recently updated', () => {
  const fixtureName = 'Recency ordering fixture';
  const reviewed = {
    ...products[0],
    slug: 'recency-ordering-reviewed',
    brand: 'Recency fixture',
    name: fixtureName,
  };
  const catalogueItems = externalProducts as unknown as Array<{
    barcode: string;
    brand: string;
    name: string;
    quantity: string;
    category: 'Face care';
    canonicalImageUrl: string;
    sourceUrl: string;
    sourceUpdatedAt: string;
  }>;
  const originalLength = catalogueItems.length;
  const external = (barcode: string, sourceUpdatedAt: string) => ({
    barcode,
    brand: 'Recency fixture',
    name: fixtureName,
    quantity: '100 ml',
    category: 'Face care' as const,
    canonicalImageUrl: 'https://example.com/product.webp',
    sourceUrl: `https://example.com/products/${barcode}`,
    sourceUpdatedAt,
  });
  const older = external('recency-older', '2026-07-20T00:00:00Z');
  const newest = external('recency-newest', '2026-07-21T00:00:00Z');
  const invalid = external('recency-invalid', 'not-a-date');

  try {
    catalogueItems.push(older, newest, invalid);
    const result = queryInventoryRecords([reviewed], { q: fixtureName, sort: 'newest' });

    assert.deepEqual(result.items.map(item => item.id), [
      `open-beauty-facts:${newest.barcode}`,
      `open-beauty-facts:${older.barcode}`,
      ...[
        `open-beauty-facts:${invalid.barcode}`,
        'reviewed:recency-ordering-reviewed',
      ].sort(),
    ]);
  } finally {
    catalogueItems.splice(originalLength);
  }
});

test('filters by an exact normalized brand and exposes company facets', () => {
  const result = queryInventoryRecords(products, { brand: 'cerave' });
  assert.ok(result.total > 0);
  assert.ok(result.items.every(item => normalize(item.brand) === 'cerave'));
  assert.equal(result.filters.brand, 'CeraVe');
  assert.ok(result.facets.brands.some(facet => facet.value === 'CeraVe' && facet.count >= result.total));

  const missing = queryInventoryRecords(products, { brand: 'not a real brand' });
  assert.equal(missing.total, products.length + externalProducts.length);
  assert.equal(missing.filters.brand, '');
});

test('ignores unknown shared concern and routine filters instead of hiding records', () => {
  const concern = queryInventoryRecords(products, { concern: 'not-a-real-concern' });
  assert.equal(concern.total, products.length + externalProducts.length);
  assert.equal(concern.filters.concern, '');

  const routine = queryInventoryRecords(products, { step: 'not-a-real-step' });
  assert.equal(routine.total, products.length + externalProducts.length);
  assert.equal(routine.filters.step, '');
});

test('uses only fresh exact offers for market and price filters', () => {
  const base = products[0] as ReviewedProduct;
  const today = new Date().toISOString();
  const fixture = (slug: string, offers: ReviewedProduct['offers'], observedAt = today): ReviewedProduct => ({
    ...base,
    slug,
    brand: 'Price Test',
    name: slug,
    offers: offers.map(offer => ({
      ...offer,
      listingEvidence: { observedAt, sourceUrl: offer.url, basis: 'retailer-page' },
      priceObservation: {
        observedAt,
        variant: `${slug} observed listing`,
        size: base.size,
        stock: offer.available ? 'in-stock' : 'out-of-stock',
        landedCost: 'unknown',
      },
    })),
  });
  const exactNg = fixture('fresh-ng', [{
    retailer: 'Exact NG', url: 'https://example.com/exact-ng', trust: 90, available: true,
    priceNgn: 9_500, checkedAt: today, match: 'exact', location: ['NG'],
  }]);
  const searchNg = fixture('search-ng', [{
    retailer: 'Search NG', url: 'https://example.com/search-ng', trust: 90, available: true,
    priceNgn: 8_000, checkedAt: today, match: 'search', location: ['NG'],
  }]);
  const staleNg = fixture('stale-ng', [{
    retailer: 'Stale NG', url: 'https://example.com/stale-ng', trust: 90, available: true,
    priceNgn: 7_000, checkedAt: '2020-01-01', match: 'exact', location: ['NG'],
  }], '2020-01-01T00:00:00.000Z');
  const exactUs = fixture('fresh-us', [{
    retailer: 'Exact US', url: 'https://example.com/exact-us', trust: 90, available: true,
    priceUsd: 20, checkedAt: today, match: 'exact', location: ['US'],
  }]);
  const fixtures = [exactNg, searchNg, staleNg, exactUs];

  const ng = queryInventoryRecords(fixtures, { review: 'reviewed', availability: 'priced', market: 'NG' });
  assert.deepEqual(ng.items.map(item => item.id), ['reviewed:fresh-ng']);
  assert.equal(ng.facets.priced, 1);
  assert.equal(ng.facets.priceScope, 4);
  assert.deepEqual(ng.facets.priceBands, { low: 1, mid: 0, high: 0 });
  assert.equal(queryInventoryRecords(fixtures, { review: 'reviewed', price: 'low', market: 'NG' }).total, 1);
  assert.equal(queryInventoryRecords(fixtures, { review: 'reviewed', price: 'mid', market: 'NG' }).total, 0);

  const us = queryInventoryRecords(fixtures, { review: 'reviewed', availability: 'priced', price: 'mid', market: 'US' });
  assert.deepEqual(us.items.map(item => item.id), ['reviewed:fresh-us']);
  assert.equal(us.facets.priced, 1);
  assert.equal(us.facets.priceScope, 4);
  assert.deepEqual(us.facets.priceBands, { low: 0, mid: 1, high: 0 });
});
