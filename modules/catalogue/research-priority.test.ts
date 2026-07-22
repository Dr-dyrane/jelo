import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { products as coreProducts } from '@/data/products';
import { expandedProducts } from '@/data/expanded-products';
import { catalogueIntakeCandidates } from '@/data/catalogue-intake';
import type { CatalogueDiscoverySnapshot, ScreenedDiscoveryCandidate } from '@/lib/catalogue/discovery-screening';
import {
  buildCatalogueResearchQueue,
  catalogueResearchQueueDigest,
} from '@/lib/catalogue/research-priority';

const digest = 'a'.repeat(64);
const evidenceId = 'b'.repeat(24);

function candidate(overrides: Partial<ScreenedDiscoveryCandidate> = {}): ScreenedDiscoveryCandidate {
  return {
    discoveryId: 'a'.repeat(24),
    title: 'Example Hydrating Cleanser 473 ml',
    brandHint: 'Example',
    brandHintBasis: 'retailer-brand',
    size: '473 ml',
    categoryHint: 'Face care',
    identityStatus: 'unverified-retailer-lead',
    retailerGtinHint: '03337875597333',
    retailerGtinHintWarning: 'retailer-sku-is-not-manufacturer-identity',
    careStatus: 'not-reviewed',
    regulatoryStatus: 'not-researched',
    imageStatus: 'source-url-unreviewed',
    publicationStatus: 'private-discovery-only',
    score: 100,
    nextAction: 'confirm-official-identity',
    retailerObservations: [{
      retailer: 'Directory Store',
      retailerStatus: 'directory-listed',
      listingUrl: 'https://directory.example/product/example-hydrating-cleanser-473ml/',
      observedAt: '2026-07-22T19:00:00.000Z',
      observedTitle: 'Example Hydrating Cleanser 473 ml',
      observedSize: '473 ml',
      priceNgn: 15_265,
      stock: 'in-stock',
      retailerSku: '3337875597333',
      retailerSkuShape: 'valid-gtin-shaped',
      imageUrl: 'https://directory.example/example.jpg',
      responseEvidenceId: evidenceId,
    }],
    ...overrides,
  };
}

function snapshot(candidates: ScreenedDiscoveryCandidate[]): CatalogueDiscoverySnapshot {
  const categoryNames = ['Face care', 'Hair & scalp', 'Body care', 'Makeup', 'Fragrance', 'Personal care'] as const;
  return {
    schemaVersion: 1,
    generatedAt: '2026-07-22T19:01:00.000Z',
    policy: 'private-discovery-only',
    targetCount: candidates.length,
    selectionPolicy: 'quality-first-category-balanced',
    categoryTargets: Object.fromEntries(categoryNames.map(name => [name, 0])) as CatalogueDiscoverySnapshot['categoryTargets'],
    categoryCounts: Object.fromEntries(categoryNames.map(name => [name, candidates.filter(item => item.categoryHint === name).length])) as CatalogueDiscoverySnapshot['categoryCounts'],
    sourceProductCount: candidates.length,
    eligibleCandidateCount: candidates.length,
    selectedCount: candidates.length,
    targetDeficit: 0,
    rejected: {},
    sourceResponses: [{
      id: evidenceId,
      retailer: 'Directory Store',
      requestedUrl: 'https://directory.example/wp-json/wc/store/v1/products?per_page=100&page=1',
      responseUrl: 'https://directory.example/wp-json/wc/store/v1/products?per_page=100&page=1',
      retrievedAt: '2026-07-22T19:00:00.000Z',
      responseSha256: 'b'.repeat(64),
      responseByteSize: 100,
      responseMimeType: 'application/json',
      page: 1,
      recordCount: candidates.length,
    }],
    candidates,
  };
}

test('turns traceable skincare leads into a private identity-research queue', () => {
  const queue = buildCatalogueResearchQueue(snapshot([candidate()]), digest, 1);
  assert.equal(queue.selectedCount, 1);
  assert.equal(queue.items[0].lane, 'gentle-cleansing');
  assert.equal(queue.items[0].identityLeadStatus, 'unverified-retailer-code');
  assert.equal(queue.items[0].nextAction, 'confirm-official-manufacturer-identity');
  assert.equal(queue.items[0].publicationStatus, 'private-research-only');
  assert.ok(queue.items[0].cautions.includes('retailer-code-unverified'));
});

test('keeps makeup and provisional-only leads out of skincare identity research', () => {
  const makeup = candidate({ discoveryId: 'c'.repeat(24), categoryHint: 'Makeup', title: 'Example Foundation 30 ml' });
  const provisional = candidate({
    discoveryId: 'd'.repeat(24),
    retailerObservations: [{
      ...candidate().retailerObservations[0],
      retailerStatus: 'provisional',
    }],
  });
  const queue = buildCatalogueResearchQueue(snapshot([makeup, provisional]), digest, 2);
  assert.equal(queue.selectedCount, 0);
});

test('deprioritizes high-risk claim language without discarding the evidence', () => {
  const neutral = candidate({ discoveryId: 'e'.repeat(24), title: 'Example Niacinamide Body Lotion 500 ml', brandHint: 'Example', size: '500 ml' });
  const whitening = candidate({ discoveryId: 'f'.repeat(24), title: 'Another Whitening Niacinamide Body Lotion 500 ml', brandHint: 'Another', size: '500 ml' });
  const queue = buildCatalogueResearchQueue(snapshot([neutral, whitening]), digest, 2);
  assert.equal(queue.items[0].discoveryId, neutral.discoveryId);
  const risky = queue.items.find(item => item.discoveryId === whitening.discoveryId);
  assert.ok(risky?.cautions.includes('claim-language-review'));
  assert.ok((risky?.priorityScore ?? 0) < queue.items[0].priorityScore);
});

test('research review corrects a retailer-misclassified face cream without changing body cream', () => {
  const faceCream = candidate({
    discoveryId: '1'.repeat(24),
    title: 'Garnier Vitamin C Brightening Day Cream 50 ml',
    categoryHint: 'Body care',
  });
  const bodyCream = candidate({
    discoveryId: '2'.repeat(24),
    title: 'Example Ceramide Body Cream 500 ml',
    categoryHint: 'Body care',
    brandHint: 'Body Example',
  });
  const queue = buildCatalogueResearchQueue(snapshot([faceCream, bodyCream]), digest, 2);
  const corrected = queue.items.find(item => item.discoveryId === faceCream.discoveryId);
  const body = queue.items.find(item => item.discoveryId === bodyCream.discoveryId);
  assert.equal(corrected?.categoryHint, 'Face care');
  assert.equal(corrected?.lane, 'moisture-barrier');
  assert.equal(body?.categoryHint, 'Body care');
});

test('known exact products do not consume another research slot', () => {
  const known = candidate({
    title: 'PANOXYL Acne Foaming Wash Benzoyl Peroxide 10% 156g',
    brandHint: 'PanOxyl',
    size: '156 g',
  });
  const queue = buildCatalogueResearchQueue(snapshot([known]), digest, 1, [{
    brand: 'PanOxyl',
    name: 'Acne Foaming Wash 10% Benzoyl Peroxide',
    size: '156 g',
  }]);
  assert.equal(queue.selectedCount, 0);
});

test('the checked-in queue is an exact deterministic projection of the discovery evidence', async () => {
  const dataRoot = path.join(process.cwd(), 'data');
  const snapshotBytes = await readFile(path.join(dataRoot, 'catalogue-discovery-screening.json'));
  const stored = JSON.parse(await readFile(path.join(dataRoot, 'catalogue-research-queue.json'), 'utf8'));
  const currentSnapshot = JSON.parse(snapshotBytes.toString('utf8')) as CatalogueDiscoverySnapshot;
  const knownIdentities = [...coreProducts, ...expandedProducts, ...catalogueIntakeCandidates].map(product => ({
    brand: product.brand,
    name: product.name,
    size: product.size,
  }));
  const expected = buildCatalogueResearchQueue(
    currentSnapshot,
    catalogueResearchQueueDigest(snapshotBytes),
    48,
    knownIdentities,
  );
  assert.deepEqual(stored, expected);
  assert.equal(expected.selectedCount, 48);
  assert.equal(expected.items.every(item => item.publicationStatus === 'private-research-only'), true);
  assert.equal(expected.items.every(item => ['Face care', 'Hair & scalp', 'Body care'].includes(item.categoryHint)), true);
  assert.equal(new Set(expected.items.map(item => item.discoveryId)).size, expected.items.length);
  assert.equal(Math.max(...Array.from(new Set(expected.items.map(item => item.brandHint))).map(
    brand => expected.items.filter(item => item.brandHint === brand).length,
  )) <= 3, true);
});
