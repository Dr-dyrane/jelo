import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { communityIntakeAttributionFromReferrer } from '@/lib/community-intake/attribution';
import {
  catalogueSearchAttribution,
  catalogueSearchHandoffHref,
  catalogueSearchProductPrefill,
} from '@/lib/community-intake/catalogue-search-handoff';
import { finalContributionSchema } from '@/lib/community-intake/schema';

test('a missing catalogue query becomes an encoded, attributed contribution handoff', () => {
  const href = catalogueSearchHandoffHref('  Beauty of Joseon  Relief Sun  ');
  assert.ok(href);
  const destination = new URL(href, 'https://www.jelocare.com');

  assert.equal(destination.pathname, '/contribute');
  assert.equal(destination.hash, '#contribution-form');
  assert.equal(destination.searchParams.get('product'), 'Beauty of Joseon Relief Sun');
  assert.equal(destination.searchParams.get('utm_source'), catalogueSearchAttribution.source);
  assert.equal(destination.searchParams.get('utm_medium'), catalogueSearchAttribution.medium);
  assert.equal(destination.searchParams.get('utm_campaign'), catalogueSearchAttribution.campaign);

  assert.deepEqual(communityIntakeAttributionFromReferrer(destination.toString()), {
    source: 'catalogue_search',
    medium: 'research_handoff',
    campaign: 'missing_product',
    content: null,
    landingPath: '/contribute',
  });
});

test('the handoff prefills one editable custom product without creating publishable knowledge', () => {
  const initialProduct = catalogueSearchProductPrefill({
    product: '  Skin Aqua UV Super Moisture Gel  ',
    utm_source: 'catalogue_search',
  });

  assert.deepEqual(initialProduct, {
    id: 'custom:catalogue-search-product',
    label: 'Skin Aqua UV Super Moisture Gel',
    source: 'custom',
  });
  assert.equal(finalContributionSchema.safeParse({
    kind: 'product',
    purposes: [],
    products: initialProduct ? [initialProduct] : [],
    brands: [],
    retailers: [],
    priceNgn: null,
    purchaseDate: null,
    outcome: null,
    currentStep: 1,
  }).success, false);
});

test('blank, unlabelled and unattributed URLs cannot seed the intake', () => {
  assert.equal(catalogueSearchHandoffHref(' '), null);
  assert.ok(catalogueSearchHandoffHref('x'));
  assert.equal(catalogueSearchProductPrefill({
    product: 'A product',
    utm_source: 'newsletter',
  }), null);
  assert.equal(catalogueSearchProductPrefill({
    product: '',
    utm_source: 'catalogue_search',
  }), null);
});

test('prefill normalization is bounded and ignores duplicate query parameters', () => {
  const initialProduct = catalogueSearchProductPrefill({
    product: [`  ${'A'.repeat(140)}  `, 'ignored'],
    utm_source: ['catalogue_search', 'newsletter'],
  });

  assert.equal(initialProduct?.label.length, 120);
  assert.equal(initialProduct?.label, 'A'.repeat(120));
});

test('catalogue handoff wiring stays zero-result only and reuses the adaptive intake', async () => {
  const root = process.cwd();
  const [productsPage, contributePage, experience, repository] = await Promise.all([
    readFile(path.join(root, 'app/(site)/products/page.tsx'), 'utf8'),
    readFile(path.join(root, 'app/(site)/contribute/page.tsx'), 'utf8'),
    readFile(path.join(root, 'components/contribute/contribution-experience.tsx'), 'utf8'),
    readFile(path.join(root, 'lib/community-intake/repository.ts'), 'utf8'),
  ]);

  assert.match(productsPage, /shouldOfferCatalogueResearchHandoff\([\s\S]*?result\.total,[\s\S]*?result\.filters\.q,[\s\S]*?concernGuides/);
  assert.match(productsPage, /catalogueSearchHandoffHref\(result\.filters\.q\)/);
  assert.match(productsPage, /clearSearchHref/);
  assert.match(productsPage, /CatalogueFilterFeedback/);
  assert.match(contributePage, /catalogueSearchProductPrefill\(params\)/);
  assert.match(contributePage, /initialProduct=\{initialProduct\}/);
  assert.match(experience, /initialProduct/);
  assert.match(experience, /<AdaptiveSelector/);
  assert.match(experience, /catalogueHandoff/);
  assert.doesNotMatch(repository, /insert into (products|brands|retailers|offers|concerns|ingredients)/i);
});
