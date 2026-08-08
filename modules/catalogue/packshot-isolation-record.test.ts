import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cataloguePackshotAlphaRepairEvidenceManifestPath,
  cataloguePackshotAlphaRepairEvidenceManifestSha256,
  cataloguePackshotAlphaRepairPipelineVersion,
  cataloguePackshotAlphaRepairReplayScriptPath,
  cataloguePackshotIsolationRecordFor,
  cataloguePackshotIsolationRecordValid,
  type CataloguePackshotAlphaRepairRecord,
  type CataloguePackshotIsolationRecord,
  type CataloguePackshotIsolationV3Record,
} from '@/lib/catalogue/packshot-isolation-record';
import {
  evaluateCatalogueIntakeCandidate,
  type CatalogueIntakeCandidate,
} from '@/lib/catalogue/intake-readiness';
import cataloguePackshotIsolations from '@/data/catalogue-packshot-isolations.json';

const asOf = Date.parse('2026-07-29T06:00:00Z');
const repairAsOf = Date.parse('2026-08-09T00:00:00Z');
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

function record(): CataloguePackshotIsolationV3Record {
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

function repairCandidate(): CatalogueIntakeCandidate {
  const value = candidate();
  value.id = 'naturium-smoother-glycolic-acid-body-lotion-8oz';
  value.brand = 'Naturium';
  value.name = 'The Smoother Glycolic Acid Body Lotion';
  value.variant = 'The Smoother Glycolic Acid Body Lotion';
  value.size = '8 fl oz / 234 mL';
  value.identity.officialProductUrl =
    'https://naturium.com/products/the-smoother-glycolic-acid-body-lotion';
  (value.identity as unknown as Record<string, unknown>).gtin = '810120260235';
  value.identity.canonicalIdentifier = {
    kind: 'gtin',
    value: '810120260235',
  };
  value.asset.sourceUrl =
    'https://naturium.com/cdn/shop/files/NATR-Smoother_glycolic_body_lotion_front.webp?v=1774292492&width=2048';
  value.asset.sourceAssetSha256 =
    '71f0a36856697f912bd72e9988b370815dd3bb43364bd036e742315accab71d6';
  value.asset.sourceAssetByteSize = 394940;
  value.asset.sourceAssetWidth = 2000;
  value.asset.sourceAssetHeight = 2000;
  value.asset.sourceAssetRetrievedAt = '2026-08-07T13:34:55Z';
  value.asset.publicImageSha256 =
    'e1715a3073184a090c50da6744a10c12f427a4b706820b5303e9b7c4a7c89d4a';
  value.asset.publicImageByteSize = 422450;
  value.asset.publicImageMimeType = 'image/png';
  value.asset.width = 2000;
  value.asset.height = 2000;
  value.asset.artReviewedAt = '2026-08-08T15:17:00Z';
  value.asset.artReviewer = 'Codex independent alpha-repair release recheck';
  return value;
}

function repairRecord(): CataloguePackshotAlphaRepairRecord {
  return {
    schemaVersion: 1,
    candidateId: 'naturium-smoother-glycolic-acid-body-lotion-8oz',
    publicationScope: 'catalogue-publication',
    source: {
      url: 'https://naturium.com/cdn/shop/files/NATR-Smoother_glycolic_body_lotion_front.webp?v=1774292492&width=2048',
      sha256: '71f0a36856697f912bd72e9988b370815dd3bb43364bd036e742315accab71d6',
      byteSize: 394940,
      width: 2000,
      height: 2000,
      retrievedAt: '2026-08-07T13:34:55Z',
    },
    identity: {
      canonicalIdentifier: { kind: 'gtin', value: '00810120260235' },
      officialProductUrl:
        'https://naturium.com/products/the-smoother-glycolic-acid-body-lotion',
    },
    processing: {
      pipelineVersion: cataloguePackshotAlphaRepairPipelineVersion,
      packageRgbOrigin: 'identity-master-source-pixels-only',
      tool: 'deterministic geometry alpha repair over retained isnet-general-use source-pixel mask',
      model: 'isnet-general-use',
      modelSha256: '60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a',
      provider: 'CPUExecutionProvider',
      runtimeLockPath: 'scripts/requirements-packshots.lock.txt',
      runtimeLockSha256:
        '2d1aa42c51632e4466779be5c327ddc56cc5ab631e77e4627a8939b245babd05',
      repairEvidence: {
        manifestPath: cataloguePackshotAlphaRepairEvidenceManifestPath,
        manifestSha256: cataloguePackshotAlphaRepairEvidenceManifestSha256,
        replayScriptPath: cataloguePackshotAlphaRepairReplayScriptPath,
        replayScriptSha256:
          '8e1a89ac42fca6a6d0eeddbca90346de404607e6bdfb02c581f8ef4456e67087',
        prepareScriptPath: 'scripts/prepare-reviewed-packshot.py',
        prepareScriptSha256:
          '98eac79846ced28ec9366cad48142093bea93a8181d9b278b23b4572728d4563',
        sourceInput: {
          path: 'data/catalogue-packshot-alpha-repair-evidence/naturium-smoother-glycolic-acid-body-lotion-8oz/source.png',
          sha256: '71f0a36856697f912bd72e9988b370815dd3bb43364bd036e742315accab71d6',
        },
        precursorInput: {
          path: 'data/catalogue-packshot-alpha-repair-evidence/naturium-smoother-glycolic-acid-body-lotion-8oz/precursor.png',
          sha256: '2102164cec10b43e248153b84d2d89f6770984ad4df13d1f8dd941b787e78ce7',
          auditSha256: 'd29bae615977c5c1a7e5b0b6503f9175433e6bdd48353403e386f55a33b7c07f',
        },
        geometryReferenceInput: null,
        rollout: {
          sessionRolloutId: '019fe19c-5daa-7b23-87d1-aa3ad9ac98f2',
          geometryCallId: 'call_zVB5oBl5lBooNjH7MZVqP4u5',
          geometryCallInputSha256:
            '3f3c9e272a5a2d8988d9a56430fd27b1760582eb4d6726fd648d9924752bd873',
          finalPackagingCallId: 'call_bjaBBIBzhB9hwDBjjrMqZxTP',
          finalPackagingCallInputSha256:
            'be0cb6292e70a3606c666b72d50cf65c5125ed561c21d02d68c74284465ed58a',
        },
        outputSha256:
          'e1715a3073184a090c50da6744a10c12f427a4b706820b5303e9b7c4a7c89d4a',
        outputColorProfileSha256:
          '2bb2c5d0a923a30b44c059e69fab438ac220b3fd6f1dd42f34987be0d8b98758',
        surfaceReviewPath:
          'data/catalogue-packshot-alpha-repair-evidence/naturium-smoother-glycolic-acid-body-lotion-8oz/surface-review.jpg',
        surfaceReviewSha256:
          '4aa242cb228a4f5fb032b05b1b3623ce0a3c15f913a8920479ffea263e1c015f',
      },
    },
    audit: {
      sha256: cataloguePackshotAlphaRepairEvidenceManifestSha256,
      generatedAt: '2026-08-08T14:01:44Z',
      repairMetrics: {
        maskThreshold: 32,
        restoredPrecursorComponentCount: 1,
        restoredPrecursorForegroundPixelCount: 1150630,
        finalSourceComponentCount: 1,
        finalSourceForegroundPixelCount: 1084598,
        addedForegroundPixelCount: 0,
        removedForegroundPixelCount: 66032,
        removedForegroundFraction: 0.05738769,
        sourceEdgeContactFractionBefore: 0.05988,
        sourceEdgeContactFractionAfter: 0,
        sourceAlphaBounds: [620, 37, 1378, 1865],
        sourceForegroundFraction: 0.271149,
        subjectTargetSize: [680, 1640],
        subjectScale: 0.897155,
        outputAlphaBounds: [660, 180, 1340, 1820],
        transparentPixelCount: 3118855,
        partialAlphaPixelCount: 21717,
        opaquePixelCount: 859428,
        outputComponentCount: 1,
        outputHolePixelCount: 0,
        outputEdgeAlphaMax: 0,
        componentReviewRequired: true,
        componentReviewCompleted: true,
      },
    },
    output: {
      sha256: 'e1715a3073184a090c50da6744a10c12f427a4b706820b5303e9b7c4a7c89d4a',
      byteSize: 422450,
      mimeType: 'image/png',
      width: 2000,
      height: 2000,
      hasAlpha: true,
    },
    review: {
      identityReviewedAt: '2026-08-08T14:38:52Z',
      identityReviewer: 'JeloCare catalogue identity correction review',
      artReviewedAt: '2026-08-08T15:17:00Z',
      artReviewer: 'Codex independent alpha-repair release recheck',
      surfaces: ['peach', 'pink', 'dark'],
      surfaceReviewSha256:
        '4aa242cb228a4f5fb032b05b1b3623ce0a3c15f913a8920479ffea263e1c015f',
      packagingIntact: true,
      labelVariantSizeUnchanged: true,
      magazineReady: true,
    },
  };
}

test('a complete isolation record admits its own candidate', () => {
  assert.equal(cataloguePackshotIsolationRecordValid(record(), candidate(), asOf), true);
});

test('a fully bound repair record admits its reviewed candidate', () => {
  assert.equal(
    cataloguePackshotIsolationRecordValid(repairRecord(), repairCandidate(), repairAsOf),
    true,
  );
});

test('a repair record for a known candidate is rejected without the new repair fields', () => {
  const missingRepairFields = repairRecord() as unknown as CataloguePackshotIsolationRecord;
  delete (missingRepairFields.processing as unknown as Record<string, unknown>).repairEvidence;
  delete (missingRepairFields.audit as unknown as Record<string, unknown>).repairMetrics;
  assert.equal(
    cataloguePackshotIsolationRecordValid(
      missingRepairFields,
      repairCandidate(),
      repairAsOf,
    ),
    false,
  );
});

test('a manifest-bound repair output cannot be downgraded to an ordinary v3 record', () => {
  const downgraded = repairRecord() as unknown as CataloguePackshotIsolationRecord;
  (downgraded.processing as { pipelineVersion: string }).pipelineVersion =
    'exact-sku-source-pixel-isolation-v3';
  delete (downgraded.processing as unknown as Record<string, unknown>).repairEvidence;
  (downgraded as unknown as { audit: unknown }).audit = {
    sha256: auditSha,
    generatedAt: '2026-08-08T14:01:44Z',
    inferredComponentCount: 1,
    retainedComponentCount: 1,
    removedComponentCount: 0,
    removedForegroundFraction: 0,
    componentReviewRequired: false,
    sourceEdgeContactFraction: 0,
  };
  assert.equal(
    cataloguePackshotIsolationRecordValid(downgraded, repairCandidate(), repairAsOf),
    false,
  );
});

test('missing nested repair bindings fail closed instead of throwing', () => {
  const mutations: Array<(value: CataloguePackshotAlphaRepairRecord) => void> = [
    value => {
      delete (value.processing.repairEvidence as unknown as Record<string, unknown>).sourceInput;
    },
    value => {
      delete (value.processing.repairEvidence as unknown as Record<string, unknown>).precursorInput;
    },
    value => {
      delete (value.processing.repairEvidence as unknown as Record<string, unknown>).rollout;
    },
    value => {
      delete (value.review as unknown as Record<string, unknown>).surfaces;
    },
  ];
  for (const mutate of mutations) {
    const value = repairRecord();
    mutate(value);
    let valid = true;
    assert.doesNotThrow(() => {
      valid = cataloguePackshotIsolationRecordValid(value, repairCandidate(), repairAsOf);
    });
    assert.equal(valid, false);
  }
});

test('a repair record cannot drift from its script, rollout or measured edit', () => {
  const scriptDrift = repairRecord();
  scriptDrift.processing.repairEvidence.replayScriptSha256 = '0'.repeat(64);
  assert.equal(
    cataloguePackshotIsolationRecordValid(scriptDrift, repairCandidate(), repairAsOf),
    false,
  );

  const callDrift = repairRecord();
  callDrift.processing.repairEvidence.rollout.geometryCallId = 'call_some_other_geometry';
  assert.equal(
    cataloguePackshotIsolationRecordValid(callDrift, repairCandidate(), repairAsOf),
    false,
  );

  const metricDrift = repairRecord();
  metricDrift.audit.repairMetrics.removedForegroundPixelCount -= 1;
  assert.equal(
    cataloguePackshotIsolationRecordValid(metricDrift, repairCandidate(), repairAsOf),
    false,
  );
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
  const mutations: Array<(value: CataloguePackshotIsolationV3Record) => void> = [
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
  const mutations: Array<(value: CataloguePackshotIsolationV3Record) => void> = [
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
  const mutations: Array<(value: CataloguePackshotIsolationV3Record) => void> = [
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
  const mutations: Array<(value: CataloguePackshotIsolationV3Record) => void> = [
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

  const mutations: Array<(value: CataloguePackshotIsolationV3Record) => void> = [
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
