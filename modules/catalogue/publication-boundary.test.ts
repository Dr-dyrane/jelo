import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { Product } from '@/data/products';
import {
  mergeDossierReleasedCatalogue,
  reconcilePublishedCatalogue,
} from '@/lib/catalogue/publication-boundary';

function product(slug: string, overrides: Partial<Product> = {}): Product {
  return {
    slug,
    brand: 'Approved brand',
    name: 'Foaming Facial Cleanser',
    size: '50 ml',
    category: 'Face',
    step: 'Treat',
    image: `https://assets.example/${slug}/approved.png`,
    displayLine: 'Approved identity',
    bestFor: [],
    concerns: [],
    skinTypes: [],
    sensitiveFriendly: false,
    usage: 'Use as directed.',
    evidence: 'moderate',
    offers: [],
    ...overrides,
  };
}

function exactOffer() {
  return {
    retailer: 'Live',
    url: 'https://live.example/product',
    trust: 95,
    available: true,
    priceNgn: 12_000,
    location: ['NG'],
    listingEvidence: {
      observedAt: '2026-07-22T10:00:00Z',
      sourceUrl: 'https://live.example/product',
      basis: 'retailer-page' as const,
    },
    priceObservation: {
      observedAt: '2026-07-22T10:00:00Z',
      variant: 'Approved brand Foaming Facial Cleanser',
      size: '50 ml',
      stock: 'in-stock' as const,
      landedCost: 'unknown' as const,
    },
  };
}

test('database rows cannot bypass the checked-in product and image approvals', () => {
  const approved = product('approved', {
    offers: [{ retailer: 'Static', url: 'https://static.example/product', trust: 90, available: true, location: ['NG'] }],
  });
  const persisted = product('approved', {
    brand: 'Stale brand',
    name: 'Stale identity',
    image: 'https://database.example/white-canvas.jpg',
    offers: [exactOffer()],
  });
  const unapproved = product('unapproved', { image: 'https://database.example/opaque.jpg' });

  const result = reconcilePublishedCatalogue([persisted, unapproved], [approved]);

  assert.equal(result.length, 1);
  assert.equal(result[0].slug, 'approved');
  assert.equal(result[0].brand, approved.brand);
  assert.equal(result[0].name, approved.name);
  assert.equal(result[0].image, approved.image);
  assert.equal(result[0].offers[0]?.retailer, 'Static');
});

test('only exact persisted offers for the approved identity and size can replace static offers', () => {
  const approved = product('approved', {
    offers: [{ retailer: 'Static', url: 'https://static.example/product', trust: 90, available: true, location: ['NG'] }],
  });
  const valid = reconcilePublishedCatalogue([
    product('approved', { offers: [exactOffer()] }),
  ], [approved]);
  assert.equal(valid[0].offers[0]?.retailer, 'Live');

  const wrongSize = exactOffer();
  wrongSize.priceObservation.size = '100 ml';
  const rejected = reconcilePublishedCatalogue([
    product('approved', { offers: [wrongSize] }),
  ], [approved]);
  assert.equal(rejected[0].offers[0]?.retailer, 'Static');

  const sibling = exactOffer();
  sibling.priceObservation.variant = 'Approved brand Hydrating Facial Cleanser';
  const siblingRejected = reconcilePublishedCatalogue([
    product('approved', { offers: [sibling] }),
  ], [approved]);
  assert.equal(siblingRejected[0].offers[0]?.retailer, 'Static');
});

test('approved static offers remain available when a persisted row has none', () => {
  const approved = product('approved', {
    offers: [{ retailer: 'Static', url: 'https://static.example/product', trust: 90, available: true, location: ['NG'] }],
  });
  const [result] = reconcilePublishedCatalogue([product('approved')], [approved]);

  assert.equal(result.offers[0]?.retailer, 'Static');
});

test('duplicate persisted image rows cannot duplicate a public product', () => {
  const approved = product('approved');
  const result = reconcilePublishedCatalogue([product('approved'), product('approved')], [approved]);

  assert.equal(result.length, 1);
});

test('an explicit dossier release remains public before its database projection exists', () => {
  const persisted = [product('legacy')];
  const released = product('dossier-release', {
    brand: 'Dossier brand',
    image: 'https://assets.example/dossier-release/packshot-v1-hash.png',
    offers: [exactOffer()],
  });

  const all = mergeDossierReleasedCatalogue(persisted, [released]);
  assert.deepEqual(all.map(item => item.slug), ['legacy', 'dossier-release']);
  assert.equal(all[1].brand, 'Dossier brand');

  const scoped = mergeDossierReleasedCatalogue([], [released], 'dossier-release');
  assert.deepEqual(scoped, [released]);
  assert.deepEqual(mergeDossierReleasedCatalogue([], [released], 'another-product'), []);
});

test('a projected dossier release appears once and keeps reconciled database offers', () => {
  const projected = product('dossier-release', { offers: [exactOffer()] });
  const released = product('dossier-release');
  const result = mergeDossierReleasedCatalogue([projected], [released]);

  assert.equal(result.length, 1);
  assert.equal(result[0].offers[0]?.retailer, 'Live');
});

test('outbound redirects resolve through the same reconciled catalogue', async () => {
  const route = await readFile(path.join(process.cwd(), 'app/(site)/go/route.ts'), 'utf8');

  assert.match(route, /await findCatalogueProduct\(productSlug\)/);
  assert.doesNotMatch(route, /import \{ products \} from '@\/data\/catalogue'/);
});
