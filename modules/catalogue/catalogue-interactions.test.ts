import assert from 'node:assert/strict';
import test from 'node:test';
import { concerns } from '@/data/knowledge';
import {
  catalogueTransitionMessage,
  createCatalogueTransition,
  diffCatalogueFilters,
  matchingCatalogueConcerns,
  matchingCompanies,
  parseCatalogueTransition,
} from '@/lib/catalogue/catalogue-interactions';

test('catalogue transitions ignore browse and pagination but preserve filter changes', () => {
  assert.deepEqual(
    diffCatalogueFilters('/products?browse=category&page=1', '/products?browse=concern&page=2'),
    [],
  );
  assert.deepEqual(
    diffCatalogueFilters('/products?page=3', '/products?q=barrier&page=1'),
    ['q'],
  );
  assert.deepEqual(
    diffCatalogueFilters('https://jelocare.local/products', 'https://other.example/products?q=barrier'),
    [],
  );
});

test('filter, final clear and undo transitions have deterministic messages and destinations', () => {
  const now = 1_800_000_000_000;
  const applied = createCatalogueTransition('/products', '/products?q=barrier', undefined, now);
  assert.deepEqual(applied, {
    version: 1,
    from: '/products',
    to: '/products?q=barrier',
    kind: 'filter',
    changedKeys: ['q'],
    createdAt: now,
  });
  assert.equal(catalogueTransitionMessage(applied), 'Filters applied.');

  const cleared = createCatalogueTransition('/products?q=barrier', '/products', undefined, now);
  assert.equal(cleared?.kind, 'clear');
  assert.equal(cleared?.from, '/products?q=barrier');
  assert.equal(catalogueTransitionMessage(cleared), 'Filters cleared.');

  const undone = createCatalogueTransition('/products', '/products?q=barrier', 'undo', now);
  assert.equal(undone?.kind, 'undo');
  assert.equal(undone?.from, '/products');
  assert.equal(catalogueTransitionMessage(undone), 'Last change undone.');
});

test('stored transition validation accepts only fresh, same-target catalogue state', () => {
  const now = 1_800_000_000_000;
  const transition = createCatalogueTransition('/products', '/products?q=barrier', undefined, now);
  assert.ok(transition);
  const raw = JSON.stringify(transition);
  assert.deepEqual(parseCatalogueTransition(raw, '/products?q=barrier', now), transition);

  assert.equal(parseCatalogueTransition('{not json', '/products?q=barrier', now), null);
  assert.equal(parseCatalogueTransition(raw, '/products?q=eczema', now), null);
  assert.equal(parseCatalogueTransition(raw, '/products?q=barrier', now + (16 * 60 * 1_000)), null);
  assert.equal(parseCatalogueTransition(JSON.stringify({ ...transition, changedKeys: ['q', 'brand'] }), '/products?q=barrier', now), null);
  assert.equal(parseCatalogueTransition(JSON.stringify({ ...transition, from: 'https://other.example/products' }), '/products?q=barrier', now), null);
  assert.equal(parseCatalogueTransition(JSON.stringify({ ...transition, from: '/products?page=1', to: '/products?page=2' }), '/products?page=2', now), null);
});

test('company matching caps initial DOM, keeps the selection and expands only after search', () => {
  const facets = Array.from({ length: 80 }, (_, index) => ({
    value: `Brand ${index + 1}`,
    count: 80 - index,
  }));
  const initial = matchingCompanies(facets, '', 'Brand 80');
  assert.equal(initial.items.length, 24);
  assert.equal(initial.items[0].value, 'Brand 80');
  assert.equal(initial.total, 80);

  const searched = matchingCompanies(facets, 'brand', '');
  assert.equal(searched.items.length, 50);

  const names = [
    { value: 'Bio CeraVe', count: 8 },
    { value: 'CeraVe', count: 2 },
    { value: "L'Oréal", count: 1 },
  ];
  assert.equal(matchingCompanies(names, 'cera').items[0].value, 'CeraVe');
  assert.equal(matchingCompanies(names, 'loreal').items[0].value, "L'Oréal");
});

test('search can offer compact concern guidance without changing product matching', () => {
  const barrier = matchingCatalogueConcerns(concerns, 'barrier');
  assert.ok(barrier.some(concern => concern.slug === 'sensitive-barrier'));

  const eczema = matchingCatalogueConcerns(concerns, 'eczema');
  assert.equal(eczema[0]?.slug, 'atopic-eczema-pattern');
  assert.deepEqual(matchingCatalogueConcerns(concerns, 'not a real concern'), []);
});
