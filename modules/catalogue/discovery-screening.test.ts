import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { CatalogueDiscoverySource } from '@/data/catalogue-discovery-sources';
import {
  auditCatalogueDiscoverySnapshot,
  buildCatalogueDiscoverySnapshot,
  screenDiscoveryProduct,
  type DiscoveryProductInput,
  type WooStoreProduct,
} from '@/lib/catalogue/discovery-screening';

const directorySource: CatalogueDiscoverySource = {
  key: 'directory',
  retailer: 'Directory Store',
  endpoint: 'https://directory.example/wp-json/wc/store/v1/products',
  host: 'directory.example',
  reviewStatus: 'directory-listed',
  trust: 95,
  contentUse: 'link-only',
  privateSourceByteRetention: {
    capability: 'private-exact-product-response-audit',
    rationale: 'reopen-dated-offer-fields-and-verify-response-integrity',
    retentionBoundary: 'private-evidence-repository-only',
    publicContentReuse: 'none',
    publicImageReuse: 'none',
  },
};

const provisionalSource: CatalogueDiscoverySource = {
  ...directorySource,
  key: 'provisional',
  retailer: 'Provisional Store',
  endpoint: 'https://provisional.example/wp-json/wc/store/v1/products',
  host: 'provisional.example',
  reviewStatus: 'provisional',
  trust: 75,
};

function product(overrides: Partial<WooStoreProduct> = {}): WooStoreProduct {
  return {
    id: 1,
    name: 'CeraVe Hydrating Cleanser 473 ml',
    slug: 'cerave-hydrating-cleanser-473ml',
    permalink: 'https://directory.example/product/cerave-hydrating-cleanser-473ml/',
    sku: '3337875597333',
    prices: { price: '1526500', currency_code: 'NGN', currency_minor_unit: 2 },
    stock_availability: { text: 'In stock', class: 'in-stock' },
    is_in_stock: true,
    images: [{ src: 'https://directory.example/uploads/cerave.jpg' }],
    brands: [{ name: 'CeraVe', slug: 'cerave' }],
    categories: [{ name: 'Face Cleansers', slug: 'face-cleansers' }],
    ...overrides,
  };
}

function input(source = directorySource, overrides: Partial<WooStoreProduct> = {}): DiscoveryProductInput {
  return {
    source,
    product: product({
      permalink: `https://${source.host}/product/cerave-hydrating-cleanser-473ml/`,
      ...overrides,
    }),
    observedAt: '2026-07-22T19:00:00.000Z',
    responseEvidenceId: `${source.key}-page-1`,
  };
}

test('a GTIN-shaped retailer SKU stays an unverified identity lead', () => {
  const result = screenDiscoveryProduct(input());
  assert.ok(result.seed);
  assert.equal(result.seed.identityStatus, 'unverified-retailer-lead');
  assert.equal(result.seed.retailerGtinHint, '03337875597333');
  assert.equal(result.seed.retailerGtinHintWarning, 'retailer-sku-is-not-manufacturer-identity');
  assert.equal(result.seed.nextAction, 'confirm-official-identity');
  assert.equal(result.seed.publicationStatus, 'private-discovery-only');
  assert.equal(result.seed.retailerObservations[0].priceNgn, 15_265);
  assert.equal(result.seed.retailerObservations[0].sourceProductId, 1);
  assert.equal(
    result.seed.retailerObservations[0].sourceProductApiUrl,
    'https://directory.example/wp-json/wc/store/v1/products/1',
  );
});

test('matching retailer-number leads group for research without becoming identity proof', () => {
  const provisional = input(provisionalSource, {
    name: 'CeraVe Hydrating Cleanser for Normal to Dry Skin 473ml',
    permalink: 'https://provisional.example/product/cerave-hydrating-cleanser-473ml/',
    prices: { price: '14900', currency_code: 'NGN', currency_minor_unit: 0 },
  });
  const snapshot = buildCatalogueDiscoverySnapshot({
    products: [input(), provisional],
    sourceResponses: [],
    generatedAt: '2026-07-22T19:01:00.000Z',
    targetCount: 10,
  });

  assert.equal(snapshot.sourceProductCount, 2);
  assert.equal(snapshot.eligibleCandidateCount, 1);
  assert.equal(snapshot.selectedCount, 1);
  assert.equal(snapshot.candidates[0].retailerObservations.length, 2);
  assert.equal(snapshot.candidates[0].identityStatus, 'unverified-retailer-lead');
  assert.equal(snapshot.candidates[0].regulatoryStatus, 'not-researched');
  assert.equal(snapshot.targetDeficit, 9);
});

test('the cheap screen rejects unusable routes, missing sizes and non-NGN prices early', () => {
  const noSize = input(directorySource, { name: 'Example Hydrating Cleanser' });
  const wrongCurrency = input(directorySource, {
    id: 2,
    name: 'Example Hydrating Cleanser 100 ml',
    sku: 'internal-2',
    prices: { price: '20', currency_code: 'USD', currency_minor_unit: 0 },
  });
  const wrongHost = input(directorySource, {
    id: 3,
    name: 'Example Hydrating Cleanser 200 ml',
    sku: 'internal-3',
    permalink: 'https://attacker.example/product/example/',
  });
  const snapshot = buildCatalogueDiscoverySnapshot({
    products: [noSize, wrongCurrency, wrongHost],
    sourceResponses: [],
    generatedAt: '2026-07-22T19:01:00.000Z',
    targetCount: 10,
  });

  assert.equal(snapshot.selectedCount, 0);
  assert.deepEqual(snapshot.rejected, {
    'ngn-price-missing': 1,
    'product-route-invalid': 1,
    'size-missing': 1,
  });
});

test('rejects a missing retailer record id instead of inventing an exact capture route', () => {
  const result = screenDiscoveryProduct(input(directorySource, { id: 0 }));
  assert.equal(result.seed, undefined);
  assert.equal(result.rejection, 'source-product-id-invalid');
});

test('the checked-in discovery batch is large, traceable and incapable of publication', async () => {
  const snapshotPath = path.join(process.cwd(), 'data/catalogue-discovery-screening.json');
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as {
    schemaVersion: number;
    policy: string;
    targetCount: number;
    selectionPolicy: string;
    selectedCount: number;
    targetDeficit: number;
    sourceResponses: Array<{ id: string; responseSha256: string; responseByteSize: number; responseMimeType: string }>;
    candidates: Array<{
      identityStatus: string;
      retailerGtinHint?: string;
      retailerGtinHintWarning?: string;
      careStatus: string;
      regulatoryStatus: string;
      imageStatus: string;
      publicationStatus: string;
      retailerObservations: Array<{ responseEvidenceId: string }>;
    }>;
  };

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.policy, 'private-discovery-only');
  assert.equal(snapshot.selectionPolicy, 'quality-first-category-balanced');
  assert.equal(snapshot.targetCount, 1000);
  assert.equal(snapshot.selectedCount, 1000);
  assert.equal(snapshot.targetDeficit, 0);
  assert.equal(snapshot.candidates.length, 1000);
  assert.ok(snapshot.sourceResponses.length >= 3);
  assert.equal(snapshot.sourceResponses.every(response =>
    /^[0-9a-f]{64}$/.test(response.responseSha256)
    && response.responseByteSize > 0
    && response.responseMimeType === 'application/json'), true);
  const declaredResponseIds = new Set(snapshot.sourceResponses.map(response => response.id));
  assert.equal(snapshot.candidates.every(candidate =>
    candidate.identityStatus === 'unverified-retailer-lead'
    && candidate.careStatus === 'not-reviewed'
    && candidate.regulatoryStatus === 'not-researched'
    && candidate.publicationStatus === 'private-discovery-only'
    && candidate.retailerObservations.every(observation => declaredResponseIds.has(observation.responseEvidenceId))), true);
  assert.ok(snapshot.candidates.filter(candidate => candidate.retailerGtinHint).length >= 900);
  assert.equal(snapshot.candidates.every(candidate => !candidate.retailerGtinHint
    || candidate.retailerGtinHintWarning === 'retailer-sku-is-not-manufacturer-identity'), true);
  assert.ok(snapshot.candidates.filter(candidate => candidate.imageStatus === 'source-url-unreviewed').length >= 900);
  assert.equal(auditCatalogueDiscoverySnapshot(snapshot).selectedCount, 1000);

  for (const runtimePath of ['data/catalogue.ts', 'data/products.ts', 'lib/catalogue/publication-boundary.ts']) {
    const runtime = await readFile(path.join(process.cwd(), runtimePath), 'utf8');
    assert.doesNotMatch(runtime, /catalogue-discovery-screening/);
  }
});
