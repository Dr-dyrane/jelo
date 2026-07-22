import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCatalogueIntakeManifest,
  catalogueGenerationRecordSchemaVersion,
  catalogueGenerationRecordSha256,
  catalogueIntakeSchemaVersion,
  evaluateCatalogueIntakeCandidate,
  rankCatalogueIntake,
  type CatalogueGenerationRecord,
  type CatalogueGenerationRecordContent,
  type CatalogueIntakeCandidate,
} from '@/lib/catalogue/intake-readiness';

const asOf = Date.parse('2026-07-22T12:00:00Z');
const hash = 'a'.repeat(64);
const sourceHash = 'b'.repeat(64);

function generationRecord(
  overrides: Partial<CatalogueGenerationRecordContent> = {},
): CatalogueGenerationRecord {
  const content: CatalogueGenerationRecordContent = {
    schemaVersion: catalogueGenerationRecordSchemaVersion,
    provider: 'OpenAI',
    model: 'image-model-version',
    prompt: 'Render only the exact referenced Example Barrier Lotion package as a transparent packshot.',
    inputs: [{
      url: 'https://brand.example/media/barrier-lotion.png',
      sha256: sourceHash,
    }],
    outputSha256: hash,
    generatedAt: '2026-07-22T09:05:00Z',
    ...overrides,
  };
  return { ...content, recordSha256: catalogueGenerationRecordSha256(content) };
}

function completeCandidate(overrides: Partial<CatalogueIntakeCandidate> = {}): CatalogueIntakeCandidate {
  const base: CatalogueIntakeCandidate = {
    id: 'example-barrier-lotion',
    brand: 'Example',
    name: 'Barrier Lotion',
    variant: 'Example Barrier Lotion',
    size: '400 ml',
    category: 'Body care',
    reason: 'Closes the reviewed daily body-moisture gap with a locally observed exact product.',
    priority: 'essential',
    gapIds: ['body-dryness', 'barrier-support'],
    demandEvidenceUrls: ['https://research.example/demand/example'],
    identity: {
      gtin: '4005808319695',
      officialProductUrl: 'https://brand.example/products/barrier-lotion',
      checkedAt: '2026-07-22T08:00:00Z',
      basis: 'official-brand',
      officialEvidence: {
        url: 'https://brand.example/products/barrier-lotion',
        observedGtin: '4005808319695',
        observedVariant: 'Example Barrier Lotion',
        observedSize: '400 ml',
        snapshotSha256: 'd'.repeat(64),
        snapshotMimeType: 'text/html',
        snapshotByteSize: 42_000,
        retrievedAt: '2026-07-22T07:55:00Z',
      },
    },
    care: {
      status: 'reviewed',
      formulaArchetype: 'Daily bland emollient',
      evidenceUrls: ['https://brand.example/products/barrier-lotion'],
      reviewedAt: '2026-07-22T08:30:00Z',
      reviewer: 'Care reviewer',
    },
    nigeria: {
      regulatoryStatus: 'matched',
      regulatoryEvidenceUrl: 'https://regulator.example/products/4005808319695',
      brandAuthorizationEvidenceUrl: 'https://brand.example/nigeria/retailers',
      exactOffers: [{
        retailer: 'Beauty by Daz',
        retailerStatus: 'directory-listed',
        listingUrl: 'https://beautybydaz.com/products/example-barrier-lotion',
        observedAt: '2026-07-22T09:00:00Z',
        observedTitle: 'Example Barrier Lotion',
        observedSize: '13.5 fl oz / 400 ml',
        observedGtin: '4005808319695',
        retailerSku: 'BYD-LOCAL-991',
        priceNgn: 12_500,
        stock: 'in-stock',
      }],
    },
    asset: {
      rightsStatus: 'documented',
      origin: 'official-brand-media',
      role: 'packshot',
      rightsUrl: 'https://brand.example/media-permission',
      sourceUrl: 'https://brand.example/media/barrier-lotion.png',
      sourceAssetSha256: sourceHash,
      sourceAssetMimeType: 'image/png',
      sourceAssetByteSize: 180_000,
      sourceAssetWidth: 1_200,
      sourceAssetHeight: 1_500,
      sourceAssetRetrievedAt: '2026-07-22T08:40:00Z',
      publicImageUrl: 'https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/example/example-barrier-lotion/packshot-v1-aaaaaaaaaaaaaaaa.png',
      publicImageSha256: hash,
      publicImageMimeType: 'image/png',
      publicImageByteSize: 248_000,
      width: 1_800,
      height: 2_000,
      packaging: 'intact',
      backgroundTreatment: 'source-pixel-isolation',
      labelVariantSizeUnchanged: true,
      packagingInvented: false,
      manualSourceOutputQa: true,
      artReviewedAt: '2026-07-22T09:15:00Z',
      artReviewer: 'Art reviewer',
      presentationQuality: 'magazine-ready',
    },
  };
  return { ...base, ...overrides };
}

test('intake fails at exact identity before later research gates', () => {
  const base = completeCandidate();
  const item: CatalogueIntakeCandidate = {
    ...base,
    identity: { ...base.identity, gtin: undefined, officialProductUrl: undefined },
    care: { status: 'pending', evidenceUrls: [] },
  };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.stage, 'identity');
  assert.equal(decision.approvalDraftReady, false);
  assert.ok(decision.blockers.includes('identity-gtin-missing-or-invalid'));
  assert.ok(decision.blockers.includes('care-review-missing'));
  assert.match(decision.nextAction, /manufacturer GTIN/i);
});

test('care review remains a distinct gate after identity is locked', () => {
  const base = completeCandidate();
  const item: CatalogueIntakeCandidate = { ...base, care: { status: 'pending', evidenceUrls: [] } };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.stage, 'care');
  assert.ok(decision.blockers.includes('care-evidence-missing'));
});

test('official identity approval is bound to exact observed identity and immutable retrieval metadata', () => {
  const base = completeCandidate();
  const invalidEvidence = [
    undefined,
    { ...base.identity.officialEvidence!, observedGtin: '0302994113002' },
    { ...base.identity.officialEvidence!, observedVariant: 'Example Repair Cream' },
    { ...base.identity.officialEvidence!, observedSize: '200 ml' },
    { ...base.identity.officialEvidence!, snapshotSha256: 'not-a-hash' },
    { ...base.identity.officialEvidence!, retrievedAt: '2026-07-22T08:05:00Z' },
  ];

  for (const officialEvidence of invalidEvidence) {
    const decision = evaluateCatalogueIntakeCandidate({
      ...base,
      identity: { ...base.identity, officialEvidence },
    }, asOf);
    assert.equal(decision.stage, 'identity');
    assert.ok(decision.blockers.includes('identity-official-evidence-invalid'));
  }

  const changedUrl = evaluateCatalogueIntakeCandidate({
    ...base,
    identity: {
      ...base.identity,
      officialProductUrl: 'https://unrelated-brand.example/products/shampoo-200ml',
    },
  }, asOf);
  assert.equal(changedUrl.stage, 'identity');
  assert.ok(changedUrl.blockers.includes('identity-official-evidence-invalid'));
});

test('only fresh Nigerian title, size and manufacturer-GTIN evidence advances the market gate', () => {
  const base = completeCandidate();
  const stale: CatalogueIntakeCandidate = {
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({ ...offer, observedAt: '2026-07-10T09:00:00Z' })),
    },
  };
  const mismatched: CatalogueIntakeCandidate = {
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({ ...offer, observedSize: '200 ml' })),
    },
  };

  for (const item of [stale, mismatched]) {
    const decision = evaluateCatalogueIntakeCandidate(item, asOf);
    assert.equal(decision.stage, 'nigeria');
    assert.equal(decision.freshExactOffers.length, 0);
    assert.ok(decision.blockers.includes('nigeria-exact-offer-missing'));
  }
});

test('retailer SKU metadata cannot substitute for the observed manufacturer GTIN', () => {
  const base = completeCandidate();
  for (const observedGtin of [undefined, '0302994113002']) {
    const decision = evaluateCatalogueIntakeCandidate({
      ...base,
      nigeria: {
        ...base.nigeria,
        exactOffers: base.nigeria.exactOffers.map(offer => ({
          ...offer,
          retailerSku: base.identity.gtin,
          observedGtin,
        })),
      },
    }, asOf);
    assert.equal(decision.stage, 'nigeria');
    assert.equal(decision.freshExactOffers.length, 0);
    assert.ok(decision.blockers.includes('nigeria-offer-identity-unbound'));
  }
});

test('a provisional observation cannot satisfy the independent Tier-A route', () => {
  const base = completeCandidate();
  const secondOffer = {
    ...base.nigeria.exactOffers[0],
    retailer: 'Slique Beauty',
    // Deliberately forged: readiness must derive this from the registry.
    retailerStatus: 'directory-listed' as const,
    listingUrl: 'https://sliquebeautylimited.com/product/example-barrier-lotion',
  };
  const item: CatalogueIntakeCandidate = {
    ...base,
    nigeria: {
      ...base.nigeria,
      brandAuthorizationEvidenceUrl: undefined,
      tierAIdentityEvidenceUrl: 'https://identity.example/nigeria-retailers',
      exactOffers: [...base.nigeria.exactOffers, secondOffer],
    },
  };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.freshExactOffers.length, 2);
  assert.equal(decision.freshExactOffers.find(offer => offer.retailer === 'Slique Beauty')?.retailerStatus, 'provisional');
  assert.equal(decision.stage, 'nigeria');
  assert.ok(decision.blockers.includes('nigeria-market-route-insufficient'));

  const independentlyListed = evaluateCatalogueIntakeCandidate({
    ...item,
    nigeria: {
      ...item.nigeria,
      exactOffers: [
        ...base.nigeria.exactOffers,
        {
          ...secondOffer,
          retailer: 'Teeka4',
          listingUrl: 'https://teeka4.com/shop/example-barrier-lotion',
        },
      ],
    },
  }, asOf);
  assert.equal(independentlyListed.stage, 'approval-ready');
});

test('unknown retailers and mismatched retailer hosts cannot become exact evidence', () => {
  const base = completeCandidate();
  const unknown: CatalogueIntakeCandidate = {
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({
        ...offer,
        retailer: 'Unregistered Store',
      })),
    },
  };
  const wrongHost: CatalogueIntakeCandidate = {
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({
        ...offer,
        listingUrl: 'https://unrelated.example/products/example-barrier-lotion',
      })),
    },
  };

  for (const item of [unknown, wrongHost]) {
    const decision = evaluateCatalogueIntakeCandidate(item, asOf);
    assert.equal(decision.stage, 'nigeria');
    assert.equal(decision.freshExactOffers.length, 0);
    assert.ok(decision.blockers.includes('nigeria-exact-offer-missing'));
  }
});

test('a raw background-removed packshot cannot become the final image', () => {
  const base = completeCandidate();
  const item: CatalogueIntakeCandidate = {
    ...base,
    asset: { ...base.asset, backgroundTreatment: 'automated-removal' },
  };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.stage, 'editorial');
  assert.ok(decision.blockers.includes('asset-automated-cutout'));
  assert.equal(decision.approvalDraftReady, false);
});

test('final image metadata and a trusted exact-candidate location are mandatory', () => {
  const base = completeCandidate();
  const missingMetadata = evaluateCatalogueIntakeCandidate({
    ...base,
    asset: { ...base.asset, publicImageMimeType: undefined, publicImageByteSize: undefined },
  }, asOf);
  assert.equal(missingMetadata.stage, 'editorial');
  assert.ok(missingMetadata.blockers.includes('asset-final-image-invalid'));

  const untrustedLocation = evaluateCatalogueIntakeCandidate({
    ...base,
    asset: { ...base.asset, publicImageUrl: 'https://assets.example/products/example-barrier-lotion.png' },
  }, asOf);
  assert.equal(untrustedLocation.stage, 'editorial');
  assert.ok(untrustedLocation.blockers.includes('asset-final-image-untrusted-location'));
});

test('source bytes are immutable evidence and owned generation replaces a reuse-rights URL', () => {
  const base = completeCandidate();
  const missingSourceSnapshot = evaluateCatalogueIntakeCandidate({
    ...base,
    asset: { ...base.asset, sourceAssetSha256: undefined },
  }, asOf);
  assert.equal(missingSourceSnapshot.stage, 'rights');
  assert.ok(missingSourceSnapshot.blockers.includes('asset-source-snapshot-invalid'));

  const generated = evaluateCatalogueIntakeCandidate({
    ...base,
    asset: {
      ...base.asset,
      origin: 'owned-identity-verified-render',
      rightsUrl: undefined,
      generationRecord: generationRecord(),
      backgroundTreatment: 'identity-verified-render',
    },
  }, asOf);
  assert.equal(generated.stage, 'approval-ready');

  const missingGenerationRecord = evaluateCatalogueIntakeCandidate({
    ...generated.candidate,
    asset: {
      ...generated.candidate.asset,
      generationRecord: undefined,
    },
  }, asOf);
  assert.equal(missingGenerationRecord.stage, 'rights');
  assert.ok(missingGenerationRecord.blockers.includes('asset-generation-record-missing'));
});

test('generated output requires a computed record bound to every declared input and the exact output', () => {
  const base = completeCandidate();
  const generatedBase: CatalogueIntakeCandidate = {
    ...base,
    asset: {
      ...base.asset,
      origin: 'owned-identity-verified-render',
      rightsUrl: undefined,
      generationRecord: generationRecord(),
      backgroundTreatment: 'identity-verified-render',
    },
  };
  const validRecord = generatedBase.asset.generationRecord!;
  const wrongOutput = generationRecord({ outputSha256: 'c'.repeat(64) });
  const missingSourceInput = generationRecord({
    inputs: [{ url: 'https://brand.example/media/other-product.png', sha256: 'e'.repeat(64) }],
  });
  const invalidRecords: CatalogueGenerationRecord[] = [
    { ...validRecord, provider: 'Tampered provider' },
    wrongOutput,
    missingSourceInput,
  ];

  for (const record of invalidRecords) {
    const decision = evaluateCatalogueIntakeCandidate({
      ...generatedBase,
      asset: { ...generatedBase.asset, generationRecord: record },
    }, asOf);
    assert.equal(decision.stage, 'rights');
    assert.ok(decision.blockers.includes('asset-generation-record-missing'));
  }
});

test('source retrieval, generation and art review must remain causally ordered', () => {
  const base = completeCandidate();
  const generatedBeforeSource = evaluateCatalogueIntakeCandidate({
    ...base,
    asset: {
      ...base.asset,
      origin: 'owned-identity-verified-render',
      rightsUrl: undefined,
      generationRecord: generationRecord({ generatedAt: '2026-07-22T08:35:00Z' }),
      backgroundTreatment: 'identity-verified-render',
    },
  }, asOf);
  assert.equal(generatedBeforeSource.stage, 'rights');
  assert.ok(generatedBeforeSource.blockers.includes('asset-generation-record-missing'));

  const reviewBeforeGeneration = evaluateCatalogueIntakeCandidate({
    ...base,
    asset: {
      ...base.asset,
      origin: 'owned-identity-verified-render',
      rightsUrl: undefined,
      generationRecord: generationRecord({ generatedAt: '2026-07-22T09:20:00Z' }),
      backgroundTreatment: 'identity-verified-render',
    },
  }, asOf);
  assert.equal(reviewBeforeGeneration.stage, 'editorial');
  assert.ok(reviewBeforeGeneration.blockers.includes('asset-review-chronology-invalid'));
});

test('styled-composite origins are explicitly ineligible for the packshot gate', () => {
  const base = completeCandidate();
  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    asset: {
      ...base.asset,
      origin: 'identity-verified-styled-composite' as never,
      backgroundTreatment: 'source-pixel-isolation',
    },
  }, asOf);
  assert.equal(decision.stage, 'rights');
  assert.ok(decision.blockers.includes('asset-origin-ineligible'));
});

test('the primary catalogue image must be a transparent packshot role', () => {
  const base = completeCandidate();
  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    asset: { ...base.asset, role: undefined },
  }, asOf);
  assert.equal(decision.stage, 'editorial');
  assert.ok(decision.blockers.includes('asset-final-image-role-invalid'));
});

test('a reviewed source-pixel isolation may advance without treating redraw as acceptable', () => {
  const base = completeCandidate();
  const item: CatalogueIntakeCandidate = {
    ...base,
    asset: { ...base.asset, backgroundTreatment: 'source-pixel-isolation' },
  };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.approvalDraftReady, true);
});

test('a fully bound candidate becomes ready only for an approval draft', () => {
  const decision = evaluateCatalogueIntakeCandidate(completeCandidate(), asOf);

  assert.equal(decision.stage, 'approval-ready');
  assert.equal(decision.blockers.length, 0);
  assert.equal(decision.freshExactOffers.length, 1);
  assert.equal(decision.approvalDraftReady, true);
});

test('the review queue honors deliberate cohort priority without changing gate status', () => {
  const exploratoryBase = completeCandidate();
  const essential = evaluateCatalogueIntakeCandidate(completeCandidate({
    id: 'essential-unresolved',
    identity: {},
  }), asOf);
  const exploratory = evaluateCatalogueIntakeCandidate(completeCandidate({
    id: 'exploratory-ready',
    priority: 'exploratory',
    identity: {
      ...exploratoryBase.identity,
      gtin: '0302994113002',
      officialEvidence: {
        ...exploratoryBase.identity.officialEvidence!,
        observedGtin: '0302994113002',
      },
    },
    nigeria: {
      ...exploratoryBase.nigeria,
      exactOffers: exploratoryBase.nigeria.exactOffers.map(offer => ({
        ...offer,
        observedGtin: '0302994113002',
      })),
    },
    asset: {
      ...exploratoryBase.asset,
      publicImageUrl: 'https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/example/exploratory-ready/packshot-v1-aaaaaaaaaaaaaaaa.png',
    },
  }), asOf);
  const ranked = rankCatalogueIntake([exploratory, essential]);

  assert.equal(ranked[0].candidate.id, 'essential-unresolved');
  assert.equal(ranked[0].stage, 'identity');
  assert.equal(ranked[1].stage, 'approval-ready');
});

test('the manifest rejects duplicate identities before review work starts', () => {
  const item = completeCandidate();
  const manifest = {
    schemaVersion: catalogueIntakeSchemaVersion,
    updatedAt: '2026-07-22T10:00:00Z',
    candidates: [item, { ...item, id: 'another-id' }],
  };

  assert.throws(() => auditCatalogueIntakeManifest(manifest, asOf), /Duplicate catalogue intake GTIN/);
});

test('the manifest rejects normalized duplicate identities before GTIN research', () => {
  const first = completeCandidate({
    identity: {},
  });
  const duplicate = completeCandidate({
    id: 'duplicate-barrier-lotion',
    brand: '  EXAMPLE  ',
    name: 'Barrier-Lotion',
    size: '400ml',
    identity: {},
  });
  const manifest = {
    schemaVersion: catalogueIntakeSchemaVersion,
    updatedAt: '2026-07-22T10:00:00Z',
    candidates: [first, duplicate],
  };

  assert.throws(() => auditCatalogueIntakeManifest(manifest, asOf), /Duplicate catalogue intake identity/);
});

test('distinct GTINs cannot hide the same normalized brand, name and size', () => {
  const first = completeCandidate();
  const duplicate = completeCandidate({
    id: 'regional-barrier-lotion',
    brand: 'EXAMPLE',
    name: 'Barrier-Lotion',
    size: '400ml',
    identity: { ...first.identity, gtin: '0302994113002' },
  });
  const manifest = {
    schemaVersion: catalogueIntakeSchemaVersion,
    updatedAt: '2026-07-22T10:00:00Z',
    candidates: [first, duplicate],
  };

  assert.throws(() => auditCatalogueIntakeManifest(manifest, asOf), /Duplicate catalogue intake identity/);
});

test('decimal formatting cannot hide the same normalized size', () => {
  const first = completeCandidate({ size: '13.5 fl oz' });
  const duplicate = completeCandidate({
    id: 'decimal-barrier-lotion',
    size: '13.50 fl oz',
    identity: { ...first.identity, gtin: '0302994113002' },
  });
  const manifest = {
    schemaVersion: catalogueIntakeSchemaVersion,
    updatedAt: '2026-07-22T10:00:00Z',
    candidates: [first, duplicate],
  };

  assert.throws(() => auditCatalogueIntakeManifest(manifest, asOf), /Duplicate catalogue intake identity/);
});

test('reordered dual-unit labels cannot hide the same normalized size', () => {
  const first = completeCandidate({ size: '13.5 fl oz / 400 ml' });
  const duplicate = completeCandidate({
    id: 'reordered-size-barrier-lotion',
    size: '400 ml / 13.50 fl oz',
    identity: { ...first.identity, gtin: '0302994113002' },
  });
  const manifest = {
    schemaVersion: catalogueIntakeSchemaVersion,
    updatedAt: '2026-07-22T10:00:00Z',
    candidates: [first, duplicate],
  };

  assert.throws(() => auditCatalogueIntakeManifest(manifest, asOf), /Duplicate catalogue intake identity/);
});
