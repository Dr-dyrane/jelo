import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cataloguePackshotIsolationRecordFor,
  cataloguePackshotIsolationRecordValid,
  type CataloguePackshotIsolationRecord,
} from '@/lib/catalogue/packshot-isolation-record';
import {
  evaluateCatalogueIntakeCandidate,
  type CatalogueIntakeCandidate,
} from '@/lib/catalogue/intake-readiness';
import cataloguePackshotIsolations from '@/data/catalogue-packshot-isolations.json';

const asOf = Date.parse('2026-07-29T06:00:00Z');
const sourceSha = 'a'.repeat(64);
const outputSha = 'b'.repeat(64);
const auditSha = 'c'.repeat(64);
const modelSha = 'd'.repeat(64);
const lockSha = 'e'.repeat(64);
const surfaceSha = 'f'.repeat(64);

function candidate(): CatalogueIntakeCandidate {
  return {
    id: 'example-serum-30ml',
    brand: 'Example Brand',
    name: 'Example Serum',
    variant: 'Example Serum 30ml',
    size: '30 ml',
    category: 'Face care',
    reason: 'fixture',
    priority: 'important',
    gapIds: [],
    demandEvidenceUrls: [],
    identity: {
      officialProductUrl: 'https://example.com/products/example-serum',
      checkedAt: '2026-07-28T00:00:00Z',
      basis: 'official-brand',
      packageVersion: 'Current example carton',
      canonicalIdentifier: { kind: 'manufacturer-sku', value: 'EX-001', label: 'SKU' },
      officialProductCrosswalk: {
        schemaVersion: 2,
        canonicalManufacturerProductKey: {
          basis: 'manufacturer-sku',
          value: 'EX-001',
          manufacturerHost: 'example.com',
          sourceLocator: 'Official product response variants[0].sku',
          sourceText: '"sku":"EX-001"',
          sourceTextSha256: '2fdf9a82d02058acb4c9fe8b03f670427a4fb968b902b5c99a71a33c80cd88db',
        },
        officialSourceResponseSha256: '2'.repeat(64),
        officialProductUrl: 'https://example.com/products/example-serum',
        variant: 'Example Serum 30ml',
        size: '30 ml',
        packageVersion: 'Current example carton',
      },
    },
    care: {
      status: 'reviewed',
      formulaArchetype: 'Fixture serum',
      careTier: 'daily-care',
      reviewScope: 'catalogue-supportive-care',
      advisoryBoundary: 'Fixture boundary.',
      manufacturerEvidenceUrl: 'https://example.com/products/example-serum',
      independentClinicalGuidanceUrl: 'https://example.com/guidance',
      evidenceUrls: [
        'https://example.com/products/example-serum',
        'https://example.com/guidance',
      ],
      reviewedAt: '2026-07-28T09:00:00Z',
      reviewer: 'JeloCare catalogue evidence review',
    },
    nigeria: { regulatoryStatus: 'pending', exactOffers: [], excludedObservations: [] },
    asset: {
      rightsStatus: 'documented',
      origin: 'official-brand-media',
      role: 'packshot',
      rightsUrl: 'https://example.com/media-terms',
      sourceUrl: 'https://example.com/cdn/serum.jpg',
      sourceAssetSha256: sourceSha,
      sourceAssetMimeType: 'image/jpeg',
      sourceAssetByteSize: 1000,
      sourceAssetWidth: 4000,
      sourceAssetHeight: 4000,
      sourceAssetRetrievedAt: '2026-07-28T10:00:00Z',
      publicImageUrl: `https://example.blob.vercel-storage.com/products/example/example-serum-30ml/packshot-v1-${outputSha.slice(0, 16)}.png`,
      publicImageSha256: outputSha,
      publicImageMimeType: 'image/png',
      publicImageByteSize: 2000,
      width: 2000,
      height: 2000,
      packaging: 'intact',
      backgroundTreatment: 'source-pixel-isolation',
      labelVariantSizeUnchanged: true,
      packagingInvented: false,
      manualSourceOutputQa: true,
      artReviewedAt: '2026-07-28T13:00:00Z',
      artReviewer: 'JeloCare art review',
      presentationQuality: 'magazine-ready',
    },
  } as unknown as CatalogueIntakeCandidate;
}

function record(): CataloguePackshotIsolationRecord {
  return {
    schemaVersion: 1,
    candidateId: 'example-serum-30ml',
    publicationScope: 'catalogue-publication',
    source: {
      url: 'https://example.com/cdn/serum.jpg',
      sha256: sourceSha,
      byteSize: 1000,
      width: 4000,
      height: 4000,
      retrievedAt: '2026-07-28T10:00:00Z',
    },
    identity: {
      canonicalIdentifier: { kind: 'manufacturer-sku', value: 'EX-001' },
      officialProductUrl: 'https://example.com/products/example-serum',
    },
    processing: {
      pipelineVersion: 'exact-sku-source-pixel-isolation-v3',
      packageRgbOrigin: 'identity-master-source-pixels-only',
      tool: 'rembg alpha mask over source RGB pixels',
      model: 'isnet-general-use',
      modelSha256: modelSha,
      provider: 'CPUExecutionProvider',
      runtimeLockPath: 'scripts/requirements-packshots.lock.txt',
      runtimeLockSha256: lockSha,
    },
    audit: {
      sha256: auditSha,
      generatedAt: '2026-07-28T11:00:00Z',
      inferredComponentCount: 2,
      retainedComponentCount: 2,
      removedComponentCount: 0,
      removedForegroundFraction: 0,
      componentReviewRequired: false,
      sourceEdgeContactFraction: 0,
    },
    output: {
      sha256: outputSha,
      byteSize: 2000,
      mimeType: 'image/png',
      width: 2000,
      height: 2000,
      hasAlpha: true,
    },
    review: {
      identityReviewedAt: '2026-07-28T12:00:00Z',
      identityReviewer: 'JeloCare identity review',
      artReviewedAt: '2026-07-28T13:00:00Z',
      artReviewer: 'JeloCare art review',
      surfaces: ['peach', 'pink', 'dark'],
      surfaceReviewSha256: surfaceSha,
      packagingIntact: true,
      labelVariantSizeUnchanged: true,
      magazineReady: true,
    },
  };
}

test('a complete isolation record admits its own candidate', () => {
  assert.equal(cataloguePackshotIsolationRecordValid(record(), candidate(), asOf), true);
});

test('an absent record never admits an isolation packshot', () => {
  assert.equal(cataloguePackshotIsolationRecordValid(undefined, candidate(), asOf), false);
});

test('a record bound to another candidate cannot admit this one', () => {
  const foreign = record();
  foreign.candidateId = 'someone-else-30ml';
  assert.equal(cataloguePackshotIsolationRecordValid(foreign, candidate(), asOf), false);
  assert.equal(
    cataloguePackshotIsolationRecordFor([foreign], 'example-serum-30ml'),
    undefined,
  );
});

test('duplicate records for one candidate are ambiguous and never resolve', () => {
  assert.equal(
    cataloguePackshotIsolationRecordFor([record(), record()], 'example-serum-30ml'),
    undefined,
  );
});

test('the record must bind the candidate source bytes, identity and output bytes', () => {
  const mutations: Array<(value: CataloguePackshotIsolationRecord) => void> = [
    value => { value.source.sha256 = '0'.repeat(64); },
    value => { value.source.byteSize = 999; },
    value => { value.source.url = 'https://example.com/cdn/other.jpg'; },
    value => { value.source.width = 3999; },
    value => { value.identity.canonicalIdentifier.value = 'EX-002'; },
    value => { value.identity.officialProductUrl = 'https://example.com/products/other'; },
    value => { value.output.sha256 = '0'.repeat(64); },
    value => { value.output.byteSize = 1999; },
    value => { value.output.width = 1600; },
    value => { value.output.hasAlpha = false as unknown as true; },
  ];
  for (const mutate of mutations) {
    const value = record();
    mutate(value);
    assert.equal(cataloguePackshotIsolationRecordValid(value, candidate(), asOf), false);
  }
});

test('an audit that discarded any foreground cannot admit the packshot', () => {
  const mutations: Array<(value: CataloguePackshotIsolationRecord) => void> = [
    value => { value.audit.removedComponentCount = 1; },
    value => { value.audit.removedForegroundFraction = 0.0001; },
    value => { value.audit.componentReviewRequired = true; },
    value => { value.audit.retainedComponentCount = 1; },
    value => { value.audit.sourceEdgeContactFraction = 0.01; },
  ];
  for (const mutate of mutations) {
    const value = record();
    mutate(value);
    assert.equal(cataloguePackshotIsolationRecordValid(value, candidate(), asOf), false);
  }
});

test('an unpinned pipeline, runtime or relabelled origin cannot admit the packshot', () => {
  const mutations: Array<(value: CataloguePackshotIsolationRecord) => void> = [
    value => { value.processing.pipelineVersion = 'exact-sku-source-pixel-isolation-v2' as never; },
    value => { value.processing.packageRgbOrigin = 'generated-pixels' as never; },
    value => { value.processing.provider = 'CUDAExecutionProvider' as never; },
    value => { value.processing.modelSha256 = 'not-a-hash'; },
    value => { value.processing.runtimeLockSha256 = 'not-a-hash'; },
    value => { value.publicationScope = 'legacy-foundational-display' as never; },
    value => { value.schemaVersion = 2 as never; },
  ];
  for (const mutate of mutations) {
    const value = record();
    mutate(value);
    assert.equal(cataloguePackshotIsolationRecordValid(value, candidate(), asOf), false);
  }
});

test('incomplete or out-of-order human review cannot admit the packshot', () => {
  const mutations: Array<(value: CataloguePackshotIsolationRecord) => void> = [
    value => { value.review.surfaces = ['peach', 'pink']; },
    value => { value.review.surfaces = ['peach', 'dark', 'pink']; },
    value => { value.review.packagingIntact = false as unknown as true; },
    value => { value.review.labelVariantSizeUnchanged = false as unknown as true; },
    value => { value.review.magazineReady = false as unknown as true; },
    value => { value.review.identityReviewer = ''; },
    value => { value.review.artReviewer = ''; },
    value => { value.review.surfaceReviewSha256 = 'not-a-hash'; },
    // Art review must not precede identity review.
    value => { value.review.artReviewedAt = '2026-07-28T11:30:00Z'; },
    // Processing must not precede source retrieval.
    value => { value.audit.generatedAt = '2026-07-28T09:00:00Z'; },
    // Review must not precede processing.
    value => { value.review.identityReviewedAt = '2026-07-28T10:30:00Z'; },
  ];
  for (const mutate of mutations) {
    const value = record();
    mutate(value);
    assert.equal(cataloguePackshotIsolationRecordValid(value, candidate(), asOf), false);
  }
});

test('the record timeline cannot float free of the candidate it publishes', () => {
  // Regression: an isolation run dated AFTER the published art review would mean
  // the dossier reviewed bytes that did not yet exist.
  const staleReview = candidate();
  staleReview.asset.artReviewedAt = '2026-07-28T10:30:00Z';
  assert.equal(cataloguePackshotIsolationRecordValid(record(), staleReview, asOf), false);

  const mutations: Array<(value: CataloguePackshotIsolationRecord) => void> = [
    // A source retrieval that disagrees with the candidate snapshot.
    value => { value.source.retrievedAt = '2020-01-01T00:00:00Z'; },
    // An art review attributed to someone other than the published reviewer.
    value => { value.review.artReviewer = 'Totally different art reviewer'; },
    // An art review at a different instant from the published one.
    value => { value.review.artReviewedAt = '2026-07-28T14:00:00Z'; },
  ];
  for (const mutate of mutations) {
    const value = record();
    mutate(value);
    assert.equal(cataloguePackshotIsolationRecordValid(value, candidate(), asOf), false);
  }
});

test('a record dated after the verification instant cannot admit the packshot', () => {
  const value = record();
  value.review.artReviewedAt = '2026-07-30T00:00:00Z';
  assert.equal(cataloguePackshotIsolationRecordValid(value, candidate(), asOf), false);
});

test('the readiness gate fails closed for an isolation packshot with no checked-in record', () => {
  const subject = candidate();
  // This candidate id is deliberately absent from the checked-in manifest, so
  // the only way it could pass is if the gate stopped requiring a record.
  assert.equal(
    cataloguePackshotIsolations.some(
      (item: { candidateId?: string }) => item.candidateId === subject.id,
    ),
    false,
  );
  const decision = evaluateCatalogueIntakeCandidate(subject, asOf);
  assert.equal(decision.blockers.includes('asset-isolation-record-missing'), true);
  assert.equal(decision.approvalDraftReady, false);
});

test('every checked-in isolation record resolves uniquely by candidate', () => {
  const records = cataloguePackshotIsolations as CataloguePackshotIsolationRecord[];
  for (const item of records) {
    assert.equal(
      cataloguePackshotIsolationRecordFor(records, item.candidateId)?.candidateId,
      item.candidateId,
    );
  }
});

test('a candidate without a canonical identifier can never satisfy the record', () => {
  const withoutIdentifier = candidate();
  delete (withoutIdentifier.identity as Record<string, unknown>).canonicalIdentifier;
  assert.equal(cataloguePackshotIsolationRecordValid(record(), withoutIdentifier, asOf), false);
});
