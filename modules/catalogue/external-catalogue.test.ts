import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewedProductRecords } from '@/data/catalogue';
import {
  externalCatalogueApprovals,
  externalCatalogueCandidates,
  externalCatalogueExposure,
  externalCatalogueCategories,
  externalCatalogueMetadata,
  externalProducts,
} from '@/data/external-catalogue';
import { isValidGtin } from '@/lib/catalogue/gtin';

const hash = /^[0-9a-f]{64}$/;
const blobHost = 'm6aftkbqbwtkxooa.public.blob.vercel-storage.com';

test('keeps the frozen bulk manifest private behind a hard-disabled legacy gate', () => {
  assert.equal(reviewedProductRecords.length, 22);
  assert.equal(externalCatalogueCandidates.length, 977);
  assert.equal(externalCatalogueApprovals.approvals.length, 0);
  assert.equal(externalProducts.length, 0);
  assert.equal(externalCatalogueExposure.approvedCount, externalProducts.length);
  assert.equal(externalCatalogueExposure.privateCandidateCount, externalCatalogueCandidates.length - externalProducts.length);
  assert.equal(externalCatalogueExposure.policy, 'legacy-private-disabled');
  assert.equal(externalCatalogueMetadata.reviewedCount, reviewedProductRecords.length);
});

test('every private community candidate remains traceable, unique, and clinically ineligible', () => {
  const barcodes = new Set<string>();
  const sourceIds = new Set<string>();

  for (const product of externalCatalogueCandidates) {
    assert.equal(product.source, 'open-beauty-facts');
    assert.equal(product.sourceProductId, product.barcode);
    assert.equal(isValidGtin(product.barcode), true, product.barcode);
    assert.equal(barcodes.has(product.barcode), false, `duplicate barcode ${product.barcode}`);
    assert.equal(sourceIds.has(product.sourceProductId), false, `duplicate source id ${product.sourceProductId}`);
    barcodes.add(product.barcode);
    sourceIds.add(product.sourceProductId);

    assert.equal(product.clinicalReviewStatus, 'not-reviewed');
    assert.equal(product.dataLicense, 'ODbL 1.0');
    assert.equal(product.contentLicense, 'Database Contents License 1.0');
    assert.equal(product.imageLicense, 'CC BY-SA 3.0');
    assert.equal(product.imageAttribution, 'Open Beauty Facts contributors');
    assert.match(product.rawPayloadSha256, hash);
    assert.match(product.sourceSnapshotSha256, hash);
    assert.match(product.sourceImageSha256, hash);
    assert.match(product.imageSha256, hash);
    if (product.ingredientLabelSha256) assert.match(product.ingredientLabelSha256, hash);

    const source = new URL(product.sourceUrl);
    const sourceImage = new URL(product.sourceImageUrl);
    const image = new URL(product.canonicalImageUrl);
    assert.equal(source.hostname, 'world.openbeautyfacts.org');
    assert.equal(source.pathname, `/product/${product.barcode}`);
    assert.equal(sourceImage.hostname, 'images.openbeautyfacts.org');
    assert.equal(image.hostname, blobHost);
    assert.match(image.pathname, new RegExp(`/catalogue/open-beauty-facts/${product.barcode}/(?:front|packshot)-[0-9a-f]{12}\\.webp$`));
    assert.equal(product.imageMimeType, 'image/webp');
    assert.ok(product.imageWidth >= 100 && product.imageHeight >= 100);
    assert.ok(product.imageByteSize > 0);
    assert.ok(Number.isFinite(Date.parse(product.sourceUpdatedAt)));
    assert.ok(Number.isFinite(Date.parse(product.sourceRetrievedAt)));
  }

  assert.equal(barcodes.size, 977);
  assert.equal(sourceIds.size, 977);
});

test('public community records never use an automated background-extracted asset', () => {
  for (const product of externalProducts) {
    assert.notEqual(product.imageTreatment, 'source-faithful-background-extraction');
    assert.notEqual(product.imageTreatment, 'automated-background-removal');
    assert.ok(['none', 'styled-composite'].includes(product.catalogueApproval.asset.backgroundTreatment));
    assert.equal(product.canonicalImageUrl, product.catalogueApproval.asset.publicImageUrl);
    assert.equal(product.imageSha256, product.catalogueApproval.asset.publicImageSha256);
    assert.equal(product.catalogueApproval.asset.packaging, 'intact');
  }
});

test('source metadata reconciles with the private candidate manifest', () => {
  const derived = Object.fromEntries(externalCatalogueCategories.map(category => [
    category,
    externalCatalogueCandidates.filter(product => product.category === category).length,
  ]));
  assert.deepEqual(externalCatalogueMetadata.categoryCounts, derived);
  assert.equal(Object.values(derived).reduce((sum, count) => sum + count, 0), 977);
  assert.equal(externalCatalogueMetadata.sourceSnapshotSha256, externalCatalogueCandidates[0]?.sourceSnapshotSha256);
  assert.equal(externalCatalogueMetadata.requestedPublishedCount, 977);
  assert.ok(externalCatalogueMetadata.acceptedCount >= externalCatalogueCandidates.length);
  assert.ok(externalCatalogueMetadata.candidateCount >= externalCatalogueCandidates.length);
});
