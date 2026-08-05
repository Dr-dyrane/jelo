import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearCustomerExploreFilters,
  createCustomerExploreFilterOptions,
  createCustomerExploreProjection,
  filterCustomerExplore,
  flattenCustomerExplore,
} from '../../lib/customer/explore-model';
import type {
  CustomerPortalConcernReference,
  CustomerPortalProduct,
  CustomerPortalShelfItem,
} from '../../lib/customer/portal-model';
import { UNAVAILABLE_MARKET_READING } from '../../lib/customer/portal-model';

function product(
  slug: string,
  category = 'Face',
  step = 'Treat',
  supportedConcernSlugs: readonly string[] = [],
  freshExactRetailerNames: readonly string[] = [],
): CustomerPortalProduct {
  return {
    slug,
    brand: `Brand ${slug}`,
    name: `Product ${slug}`,
    size: '30 ml',
    category,
    step,
    image: `/${slug}.png`,
    displayLine: `${step} · care`,
    usage: 'Use as directed.',
    priceLabel: null,
    marketReading: UNAVAILABLE_MARKET_READING,
    supportedConcernSlugs,
    freshExactRetailerNames,
  };
}

function shelfItem(value: CustomerPortalProduct): CustomerPortalShelfItem {
  return {
    identityVersionId: `version:${value.slug}`,
    savedAt: '2026-08-03T12:00:00.000Z',
    saveOrigin: 'synthetic-development',
    lifecycleState: 'active',
    availability: 'available',
    snapshot: {
      slug: value.slug,
      brand: value.brand,
      name: value.name,
      size: value.size,
      versionNumber: 1,
      packageVersion: 'preview',
      formulaVersion: 'preview',
    },
    product: value,
    message: null,
  };
}

const dryness: CustomerPortalConcernReference = {
  slug: 'dry-dehydrated-skin',
  name: 'Dry & dehydrated skin',
  area: 'Face',
  kind: 'concern',
  source: 'synthetic-development',
};

test('Explore partitions every eligible product once with stable personal precedence', () => {
  const shelf = product('shelf', 'Face', 'Cleanse', [dryness.slug], ['Chosen Store']);
  const routine = product('routine', 'Face', 'Treat', [dryness.slug]);
  const concern = product('concern', 'Face', 'Exfoliate', [dryness.slug]);
  const store = product('store', 'Hair', 'Condition', [], ['Chosen Store']);
  const adjacent = product('adjacent', 'Face', 'Cleanse');
  const face = product('face', 'Face', 'Protect');
  const body = product('body', 'Body', 'Cleanse');
  const hair = product('hair', 'Hair', 'Finish');
  const catalogue = [shelf, routine, concern, store, adjacent, face, body, hair];
  const projection = createCustomerExploreProjection({
    catalogue,
    shelf: [shelfItem(shelf)],
    routine: [
      { id: 'shelf-step', moment: 'Done', status: 'done', product: shelf },
      { id: 'routine-step', moment: 'Added', status: 'confirmed', product: routine },
    ],
    concerns: [dryness],
    selectedRetailers: [{ name: 'Chosen Store', source: 'synthetic-development' }],
  });

  assert.deepEqual(projection.sections.map(section => section.id), [
    'shelf',
    'routine',
    'concerns',
    'stores',
    'care-steps',
    'category:face',
    'category:body',
    'category:hair',
  ]);
  const slugs = flattenCustomerExplore(projection).map(entry => entry.product.slug);
  assert.deepEqual(slugs, catalogue.map(value => value.slug));
  assert.equal(new Set(slugs).size, catalogue.length);
  assert.deepEqual(projection.sections[0]?.products.map(entry => entry.product.slug), ['shelf']);
  assert.deepEqual(projection.sections[1]?.products.map(entry => entry.product.slug), ['routine']);
});

test('Explore reachability follows dynamic catalogue additions and retirements without a count constant', () => {
  const one = product('one');
  const two = product('two', 'Body');
  const three = product('three', 'Hair');
  const input = { shelf: [], routine: [], concerns: [], selectedRetailers: [] } as const;
  const initial = createCustomerExploreProjection({ ...input, catalogue: [one, two] });
  const added = createCustomerExploreProjection({ ...input, catalogue: [one, two, three] });
  const retired = createCustomerExploreProjection({ ...input, catalogue: [two, three] });

  assert.deepEqual(flattenCustomerExplore(initial).map(entry => entry.product.slug), ['one', 'two']);
  assert.deepEqual(flattenCustomerExplore(added).map(entry => entry.product.slug), ['one', 'two', 'three']);
  assert.deepEqual(flattenCustomerExplore(retired).map(entry => entry.product.slug), ['two', 'three']);
});

test('smart filters compose and Clear restores the complete eligible catalogue', () => {
  const saved = product('saved', 'Face', 'Treat', [dryness.slug], ['Chosen Store']);
  const other = product('other', 'Body', 'Cleanse');
  const projection = createCustomerExploreProjection({
    catalogue: [saved, other],
    shelf: [shelfItem(saved)],
    routine: [],
    concerns: [dryness],
    selectedRetailers: [{ name: 'Chosen Store', source: 'synthetic-development' }],
  });
  const filtered = filterCustomerExplore(projection, {
    search: 'product saved',
    category: 'Face',
    step: 'Treat',
    brand: saved.brand,
    shelf: 'on',
    concernSlug: dryness.slug,
    retailerName: 'Chosen Store',
  });
  assert.deepEqual(flattenCustomerExplore(filtered).map(entry => entry.product.slug), ['saved']);

  const cleared = filterCustomerExplore(projection, clearCustomerExploreFilters());
  assert.deepEqual(
    flattenCustomerExplore(cleared).map(entry => entry.product.slug),
    ['saved', 'other'],
  );
});

test('condition patterns never create concern sections or concern filters', () => {
  const condition: CustomerPortalConcernReference = {
    slug: 'eczema-like-pattern',
    name: 'Eczema-like dryness',
    area: 'Body',
    kind: 'condition-pattern',
    source: 'synthetic-development',
  };
  const candidate = product('condition-candidate', 'Body', 'Moisturize', [condition.slug]);
  const projection = createCustomerExploreProjection({
    catalogue: [candidate],
    shelf: [],
    routine: [],
    concerns: [condition],
    selectedRetailers: [],
  });
  assert.equal(projection.sections.some(section => section.id === 'concerns'), false);
  assert.deepEqual(createCustomerExploreFilterOptions(projection, [condition]).concerns, []);
  assert.deepEqual(flattenCustomerExplore(projection)[0]?.matchedConcernSlugs, []);
});

test('commerce clicks cannot alter product order or create retailer affinity', () => {
  const one = product('one', 'Face', 'Treat', [], ['Unchosen Store']);
  const two = product('two', 'Face', 'Treat', [], ['Chosen Store']);
  const input = {
    catalogue: [one, two],
    shelf: [],
    routine: [],
    concerns: [],
    selectedRetailers: [],
  } as const;
  const withClicks = {
    ...input,
    commerceEvents: [{ type: 'store_click', retailer: 'Unchosen Store', productSlug: one.slug }],
  };
  const baseline = createCustomerExploreProjection(input);
  const clicked = createCustomerExploreProjection(withClicks);

  assert.deepEqual(
    flattenCustomerExplore(clicked).map(entry => entry.product.slug),
    flattenCustomerExplore(baseline).map(entry => entry.product.slug),
  );
  assert.equal(clicked.sections.some(section => section.id === 'stores'), false);
});
