import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import emptyManifest from '@/data/catalogue-publication-dossiers.json';
import {
  catalogueGenerationRecordSchemaVersion,
  catalogueGenerationRecordSha256,
  type CatalogueGenerationRecord,
  type CatalogueGenerationRecordContent,
  type CatalogueIntakeCandidate,
} from '@/lib/catalogue/intake-readiness';
import {
  cataloguePublicationApprovalScope,
  cataloguePublicationDossierSchemaVersion,
  cataloguePublicationExposure,
  createCataloguePublicationDossier,
  verifyCataloguePublicationDossierManifest,
  type CataloguePublicationApproval,
  type CataloguePublicationDossierManifest,
} from '@/lib/catalogue/publication-dossier';

const asOf = Date.parse('2026-07-22T12:00:00Z');
const finalHash = 'a'.repeat(64);
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
    outputSha256: finalHash,
    generatedAt: '2026-07-22T09:05:00Z',
    ...overrides,
  };
  return { ...content, recordSha256: catalogueGenerationRecordSha256(content) };
}

function readyCandidate(overrides: Partial<CatalogueIntakeCandidate> = {}): CatalogueIntakeCandidate {
  const candidate: CatalogueIntakeCandidate = {
    id: 'example-barrier-lotion',
    brand: 'Example',
    name: 'Barrier Lotion',
    variant: 'Example Barrier Lotion',
    size: '400 ml',
    category: 'Body care',
    reason: 'Closes a deliberate daily body-moisture coverage gap.',
    priority: 'essential',
    gapIds: ['body-dryness'],
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
      publicImageSha256: finalHash,
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
  return { ...candidate, ...overrides };
}

function approval(overrides: Partial<CataloguePublicationApproval> = {}): CataloguePublicationApproval {
  return {
    scope: cataloguePublicationApprovalScope,
    reviewer: 'Publication reviewer',
    approvedAt: '2026-07-22T10:00:00Z',
    ...overrides,
  };
}

test('the checked-in publication manifest is empty, private and structurally valid', () => {
  const result = verifyCataloguePublicationDossierManifest([], emptyManifest, asOf);

  assert.equal(result.exposure, cataloguePublicationExposure);
  assert.equal(result.dossierCount, 0);
  assert.equal(result.publicProductCount, 0);
  assert.deepEqual(result.dossiers, []);
});

test('an approval-ready exact SKU compiles into one immutable source-agnostic private dossier', () => {
  const candidate = readyCandidate();
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);

  assert.equal(dossier.exposure, 'private-only');
  assert.equal(dossier.publicationStatus, 'not-published');
  assert.equal(dossier.recommendationEligible, false);
  assert.deepEqual(dossier.identity, {
    gtin: '4005808319695',
    brand: 'Example',
    name: 'Barrier Lotion',
    variant: 'Example Barrier Lotion',
    size: '400 ml',
    category: 'Body care',
  });
  assert.equal(dossier.sourceEvidence.officialProductUrl, candidate.identity.officialProductUrl);
  assert.deepEqual(dossier.sourceEvidence.officialIdentity, candidate.identity.officialEvidence);
  assert.equal(dossier.care.formulaArchetype, candidate.care.formulaArchetype);
  assert.equal(dossier.nigeria.exactOffers[0]?.retailer, 'Beauty by Daz');
  assert.equal(dossier.rights.evidenceUrl, candidate.asset.rightsUrl);
  assert.deepEqual(dossier.rights.sourceAsset, {
    url: candidate.asset.sourceUrl,
    sha256: candidate.asset.sourceAssetSha256,
    mimeType: 'image/png',
    byteSize: 180_000,
    width: 1_200,
    height: 1_500,
    retrievedAt: '2026-07-22T08:40:00Z',
  });
  assert.equal(dossier.finalImage.role, 'packshot');
  assert.deepEqual(
    { reviewedAt: dossier.finalImage.reviewedAt, reviewer: dossier.finalImage.reviewer },
    { reviewedAt: '2026-07-22T09:15:00Z', reviewer: 'Art reviewer' },
  );
  assert.deepEqual(
    {
      url: dossier.finalImage.url,
      hash: dossier.finalImage.sha256,
      mimeType: dossier.finalImage.mimeType,
      byteSize: dossier.finalImage.byteSize,
      width: dossier.finalImage.width,
      height: dossier.finalImage.height,
    },
    {
      url: candidate.asset.publicImageUrl,
      hash: candidate.asset.publicImageSha256,
      mimeType: 'image/png',
      byteSize: 248_000,
      width: 1_800,
      height: 2_000,
    },
  );
  assert.match(dossier.candidateFingerprint, /^[0-9a-f]{64}$/);
  assert.match(dossier.dossierFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(Object.isFrozen(dossier), true);
  assert.equal(Object.isFrozen(dossier.finalImage), true);

  const manifest: CataloguePublicationDossierManifest = {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    exposure: 'private-only',
    dossiers: [dossier],
  };
  assert.equal(verifyCataloguePublicationDossierManifest([candidate], manifest, asOf).dossierCount, 1);
});

test('an owned identity-verified render records generation provenance without a reuse-rights URL', () => {
  const base = readyCandidate();
  const candidate = readyCandidate({
    asset: {
      ...base.asset,
      origin: 'owned-identity-verified-render',
      rightsUrl: undefined,
      generationRecord: generationRecord(),
      backgroundTreatment: 'identity-verified-render',
    },
  });
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);

  assert.equal(dossier.rights.evidenceUrl, undefined);
  assert.deepEqual(dossier.rights.generationRecord, candidate.asset.generationRecord);
  assert.equal(dossier.finalImage.backgroundTreatment, 'identity-verified-render');
});

test('a dossier rejects tampered, self-referential or causally impossible generation records', () => {
  const base = readyCandidate();
  const generated: CatalogueIntakeCandidate = {
    ...base,
    asset: {
      ...base.asset,
      origin: 'owned-identity-verified-render',
      rightsUrl: undefined,
      generationRecord: generationRecord(),
      backgroundTreatment: 'identity-verified-render',
    },
  };
  const tampered = {
    ...generated,
    asset: {
      ...generated.asset,
      generationRecord: { ...generated.asset.generationRecord!, model: 'unrecorded-model-change' },
    },
  };
  assert.throws(
    () => createCataloguePublicationDossier(tampered, approval(), asOf),
    /not approval-ready.*asset-generation-record-missing/,
  );

  const selfReferential = {
    ...generated,
    asset: {
      ...generated.asset,
      sourceAssetSha256: finalHash,
      generationRecord: generationRecord({
        inputs: [{ url: generated.asset.sourceUrl!, sha256: finalHash }],
      }),
    },
  };
  assert.throws(
    () => createCataloguePublicationDossier(selfReferential, approval(), asOf),
    /not approval-ready.*asset-generation-record-missing/,
  );

  const reviewedTooEarly = {
    ...generated,
    asset: { ...generated.asset, artReviewedAt: '2026-07-22T09:00:00Z' },
  };
  assert.throws(
    () => createCataloguePublicationDossier(reviewedTooEarly, approval(), asOf),
    /not approval-ready.*asset-review-chronology-invalid/,
  );
});

test('identity, source, care, Nigeria, rights and final-image changes invalidate the bound dossier', () => {
  const candidate = readyCandidate();
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);
  const manifest: CataloguePublicationDossierManifest = {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    exposure: 'private-only',
    dossiers: [dossier],
  };
  const changedCandidates: CatalogueIntakeCandidate[] = [
    { ...candidate, name: 'Changed Barrier Lotion' },
    {
      ...candidate,
      identity: {
        ...candidate.identity,
        officialEvidence: {
          ...candidate.identity.officialEvidence!,
          snapshotSha256: 'f'.repeat(64),
        },
      },
    },
    { ...candidate, demandEvidenceUrls: ['https://research.example/demand/changed'] },
    { ...candidate, care: { ...candidate.care, formulaArchetype: 'Changed emollient' } },
    {
      ...candidate,
      nigeria: {
        ...candidate.nigeria,
        exactOffers: candidate.nigeria.exactOffers.map(offer => ({ ...offer, priceNgn: 12_750 })),
      },
    },
    { ...candidate, asset: { ...candidate.asset, rightsUrl: 'https://brand.example/changed-permission' } },
    { ...candidate, asset: { ...candidate.asset, sourceAssetSha256: 'c'.repeat(64) } },
    { ...candidate, asset: { ...candidate.asset, publicImageSha256: 'b'.repeat(64) } },
    { ...candidate, asset: { ...candidate.asset, publicImageByteSize: 249_000 } },
    { ...candidate, asset: { ...candidate.asset, publicImageMimeType: 'image/webp' } },
  ];

  for (const changed of changedCandidates) {
    assert.throws(
      () => verifyCataloguePublicationDossierManifest([changed], manifest, asOf),
      /candidate fingerprint changed/,
    );
  }

  const changedDossier = structuredClone(dossier);
  changedDossier.finalImage.width = 1_900;
  assert.throws(
    () => verifyCataloguePublicationDossierManifest([candidate], { ...manifest, dossiers: [changedDossier] }, asOf),
    /dossier content or fingerprint changed/,
  );
});

test('an incomplete candidate or approval that predates evidence cannot produce a dossier', () => {
  const candidate = readyCandidate();
  assert.throws(
    () => createCataloguePublicationDossier({ ...candidate, identity: {} }, approval(), asOf),
    /not approval-ready/,
  );
  assert.throws(
    () => createCataloguePublicationDossier(candidate, approval({ approvedAt: '2026-07-22T08:45:00Z' }), asOf),
    /predates its bound evidence/,
  );
});

test('a dossier cannot bypass research context, coverage-gap or demand-evidence invariants', () => {
  const candidate = readyCandidate();
  const invalidCandidates: Array<[CatalogueIntakeCandidate, RegExp]> = [
    [{ ...candidate, reason: '' }, /missing its deliberate research context/],
    [{ ...candidate, gapIds: [] }, /must name at least one coverage gap/],
    [{ ...candidate, demandEvidenceUrls: [] }, /must cite HTTPS demand evidence/],
    [{ ...candidate, demandEvidenceUrls: ['http://research.example/demand'] }, /must cite HTTPS demand evidence/],
  ];

  for (const [invalid, message] of invalidCandidates) {
    assert.throws(() => createCataloguePublicationDossier(invalid, approval(), asOf), message);
  }
});

test('the verifier rejects duplicate candidate identities before accepting dossiers', () => {
  const candidate = readyCandidate();
  const duplicate = readyCandidate({
    id: 'duplicate-barrier-lotion',
    identity: { ...candidate.identity, gtin: '0302994113002' },
  });

  assert.throws(
    () => verifyCataloguePublicationDossierManifest([candidate, duplicate], emptyManifest, asOf),
    /Duplicate catalogue intake identity/,
  );
});

test('the verifier rejects one final image reused across different candidate identities', () => {
  const first = readyCandidate();
  const second = readyCandidate({
    id: 'example-gentle-cleanser',
    name: 'Gentle Cleanser',
    variant: 'Example Gentle Cleanser',
    identity: {
      ...first.identity,
      gtin: '0302994113002',
      officialProductUrl: 'https://brand.example/products/gentle-cleanser',
      officialEvidence: {
        ...first.identity.officialEvidence!,
        url: 'https://brand.example/products/gentle-cleanser',
        observedGtin: '0302994113002',
        observedVariant: 'Example Gentle Cleanser',
        snapshotSha256: 'e'.repeat(64),
      },
    },
    nigeria: {
      ...first.nigeria,
      regulatoryEvidenceUrl: 'https://regulator.example/products/0302994113002',
      exactOffers: first.nigeria.exactOffers.map(offer => ({
        ...offer,
        listingUrl: 'https://beautybydaz.com/products/example-gentle-cleanser',
        observedTitle: 'Example Gentle Cleanser',
        observedGtin: '0302994113002',
      })),
    },
    asset: {
      ...first.asset,
      publicImageUrl: 'https://m6aftkbqbwtkxooa.public.blob.vercel-storage.com/products/example/example-gentle-cleanser/packshot-v1-aaaaaaaaaaaaaaaa.png',
    },
  });
  const dossiers = [
    createCataloguePublicationDossier(first, approval(), asOf),
    createCataloguePublicationDossier(second, approval(), asOf),
  ];

  assert.throws(
    () => verifyCataloguePublicationDossierManifest([first, second], {
      schemaVersion: cataloguePublicationDossierSchemaVersion,
      exposure: 'private-only',
      dossiers,
    }, asOf),
    /reuses another catalogue publication image hash/,
  );
});

test('private dossiers are not imported by public catalogue or inventory runtime modules', async () => {
  const runtimeSources = await Promise.all([
    'data/catalogue.ts',
    'data/external-catalogue.ts',
    'lib/catalogue/inventory-query.ts',
    'lib/catalogue/inventory-repository.ts',
    'lib/catalogue/repository.ts',
  ].map(file => readFile(path.join(process.cwd(), file), 'utf8')));

  for (const source of runtimeSources) {
    assert.doesNotMatch(source, /catalogue-publication-dossiers|publication-dossier/);
  }
});
