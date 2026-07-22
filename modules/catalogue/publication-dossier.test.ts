import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import emptyManifest from '@/data/catalogue-publication-dossiers.json';
import {
  catalogueGenerationRecordSchemaVersion,
  catalogueGenerationRecordSha256,
  catalogueIdentityExtractionByteSize,
  catalogueIdentityExtractionSchemaVersion,
  catalogueIdentityExtractionSha256,
  type CatalogueGenerationRecord,
  type CatalogueGenerationRecordContent,
  type CatalogueIntakeCandidate,
  type CatalogueIntakeOffer,
  type CatalogueOfficialIdentityEvidence,
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
import {
  catalogueExactOfferEvidenceSchemaVersion,
  catalogueRegulatoryEvidenceSchemaVersion,
  regulatoryEvidenceExcerptSha256,
  type ReviewedExactOfferEvidence,
  type ReviewedRegulatoryEvidence,
} from '@/lib/catalogue/market-evidence';
import { nigeriaRetailers } from '@/data/retailers';

const asOf = Date.parse('2026-07-22T17:05:00Z');
const finalHash = 'a'.repeat(64);
const sourceHash = 'b'.repeat(64);

function exactOfferEvidence(): ReviewedExactOfferEvidence {
  const listingUrl = 'https://medplusnig.com/product/example-barrier-lotion';
  return {
    schemaVersion: catalogueExactOfferEvidenceSchemaVersion,
    method: 'reviewed-exact-offer-field-extraction',
    listingUrl,
    responseUrl: listingUrl,
    responseSha256: 'e'.repeat(64),
    responseDigestScope: 'decoded-response-body',
    responseMimeType: 'text/html',
    responseByteSize: 31_500,
    retrievedAt: '2026-07-22T09:00:00Z',
    fields: {
      gtin: {
        label: 'GTIN',
        value: '4005808319695',
        locator: 'HTML product metadata GTIN row',
        sourceText: 'GTIN 4005808319695',
      },
      title: {
        value: 'Example Barrier Lotion',
        locator: 'HTML h1 product title',
        sourceText: 'Example Barrier Lotion',
      },
      size: {
        value: '13.5 fl oz / 400 ml',
        locator: 'HTML product size selection',
        sourceText: '13.5 fl oz / 400 ml',
      },
      price: {
        value: 12_500,
        currency: 'NGN',
        locator: 'HTML product price amount',
        sourceText: 'NGN 12,500',
      },
      stock: {
        value: 'in-stock',
        locator: 'HTML availability status',
        sourceText: 'In stock',
      },
    },
    reviewer: 'Market reviewer',
    reviewedAt: '2026-07-22T09:05:00Z',
  };
}

function regulatoryEvidence(gtin = '4005808319695'): Extract<ReviewedRegulatoryEvidence, { status: 'matched' }> {
  const sourceText = `GTIN ${gtin} · NAFDAC registration A4-1234 · Status Active`;
  return {
    schemaVersion: catalogueRegulatoryEvidenceSchemaVersion,
    authority: 'NAFDAC',
    status: 'matched',
    matchBasis: 'manufacturer-gtin',
    candidateGtin: gtin,
    registrationNumber: 'A4-1234',
    registrationStatus: {
      value: 'active',
      locator: 'NAFDAC Greenbook registration status row',
      sourceText: 'Status Active',
    },
    sourceUrl: `https://greenbook.nafdac.gov.ng/products/${gtin}`,
    locator: 'NAFDAC Greenbook product detail GTIN row',
    sourceText,
    sourceExcerptSha256: regulatoryEvidenceExcerptSha256(sourceText),
    responseUrl: `https://greenbook.nafdac.gov.ng/products/${gtin}`,
    responseSha256: 'f'.repeat(64),
    responseDigestScope: 'decoded-response-body',
    responseMimeType: 'text/html',
    responseByteSize: 24_000,
    retrievedAt: '2026-07-22T09:10:00Z',
    observedAt: '2026-07-22T09:10:00Z',
    reviewedAt: '2026-07-22T09:20:00Z',
    reviewer: 'Regulatory reviewer',
  };
}

function withExactOfferEvidence<T extends CatalogueIntakeOffer>(offer: T): T {
  const label = offer.observedGtinBasis === 'explicit-ean'
    ? 'EAN'
    : offer.observedGtinBasis === 'explicit-upc'
      ? 'UPC'
      : 'GTIN';
  return {
    ...offer,
    evidence: {
      ...exactOfferEvidence(),
      listingUrl: offer.listingUrl,
      responseUrl: offer.listingUrl,
      retrievedAt: offer.observedAt,
      fields: {
        gtin: {
          label,
          value: offer.observedGtin!,
          locator: `HTML product metadata ${label} row`,
          sourceText: `${label} ${offer.observedGtin}`,
        },
        title: {
          value: offer.observedTitle,
          locator: 'HTML h1 product title',
          sourceText: offer.observedTitle,
        },
        size: {
          value: offer.observedSize,
          locator: 'HTML product size selection',
          sourceText: offer.observedSize,
        },
        price: {
          value: offer.priceNgn,
          currency: 'NGN',
          locator: 'HTML product price amount',
          sourceText: `NGN ${offer.priceNgn.toLocaleString('en-NG')}`,
        },
        stock: {
          value: offer.stock,
          locator: 'HTML availability status',
          sourceText: offer.stock.replaceAll('-', ' '),
        },
      },
    },
  };
}

function identityEvidence(
  overrides: Partial<Pick<CatalogueOfficialIdentityEvidence, 'url' | 'observedGtin' | 'observedVariant' | 'observedSize' | 'retrievedAt'>> = {},
  candidateId = 'example-barrier-lotion',
): CatalogueOfficialIdentityEvidence {
  const fields = {
    url: 'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
    observedGtin: '4005808319695',
    observedVariant: 'Example Barrier Lotion',
    observedSize: '400 ml',
    retrievedAt: '2026-07-22T07:55:00Z',
    ...overrides,
  };
  const canonicalExtraction = {
    schemaVersion: catalogueIdentityExtractionSchemaVersion,
    candidateId,
    sourceUrl: fields.url,
    responseUrl: fields.url,
    responseDigestScope: 'decoded-response-body' as const,
    retrievedAt: fields.retrievedAt,
    fields: {
      gtin: {
        value: fields.observedGtin,
        locator: 'HTML [data-gtin] attribute',
        sourceText: `GTIN ${fields.observedGtin}`,
      },
      variant: {
        value: fields.observedVariant,
        locator: 'HTML h1[itemprop=name]',
        sourceText: fields.observedVariant,
      },
      size: {
        value: fields.observedSize,
        locator: 'HTML [data-size] attribute',
        sourceText: fields.observedSize,
      },
    },
    sourceResponseSha256: 'd'.repeat(64),
    sourceResponseMimeType: 'text/html' as const,
    sourceResponseByteSize: 42_000,
    method: 'reviewed-exact-identity-field-extraction' as const,
    reviewer: 'Identity reviewer',
    reviewedAt: '2026-07-22T07:58:00Z',
  };
  return {
    ...fields,
    snapshotKind: 'canonical-extraction',
    snapshotPath: `data/catalogue-identity-evidence/${candidateId}.json`,
    canonicalExtraction,
    snapshotSha256: catalogueIdentityExtractionSha256(canonicalExtraction),
    snapshotMimeType: 'application/json',
    snapshotByteSize: catalogueIdentityExtractionByteSize(canonicalExtraction),
  };
}

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
    brand: 'CeraVe',
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
      officialProductUrl: 'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
      checkedAt: '2026-07-22T08:00:00Z',
      basis: 'official-brand',
      officialEvidence: identityEvidence(),
    },
    care: {
      status: 'reviewed',
      formulaArchetype: 'Daily bland emollient',
      careTier: 'daily-care',
      reviewScope: 'catalogue-supportive-care',
      advisoryBoundary: 'Supports routine moisturising only; it does not diagnose or treat a medical condition.',
      manufacturerEvidenceUrl: 'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
      independentClinicalGuidanceUrl: 'https://www.nhs.uk/tests-and-treatments/emollients/',
      evidenceUrls: [
        'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
        'https://www.nhs.uk/tests-and-treatments/emollients/',
      ],
      reviewedAt: '2026-07-22T08:30:00Z',
      reviewer: 'Care reviewer',
    },
    nigeria: {
      regulatoryStatus: 'matched',
      regulatoryEvidence: regulatoryEvidence(),
      brandAuthorizationEvidenceUrl: 'https://africa.cerave.com/en/find-your-nearest-store',
      exactOffers: [{
        retailer: 'Medplus',
        retailerStatus: 'directory-listed',
        listingUrl: 'https://medplusnig.com/product/example-barrier-lotion',
        observedAt: '2026-07-22T09:00:00Z',
        observedTitle: 'Example Barrier Lotion',
        observedSize: '13.5 fl oz / 400 ml',
        observedGtin: '4005808319695',
        observedGtinBasis: 'explicit-gtin',
        retailerSku: 'BYD-LOCAL-991',
        priceNgn: 12_500,
        stock: 'in-stock',
        evidence: exactOfferEvidence(),
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
      backgroundTreatment: 'none',
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
    approvedAt: '2026-07-22T16:00:00Z',
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
    brand: 'CeraVe',
    name: 'Barrier Lotion',
    variant: 'Example Barrier Lotion',
    size: '400 ml',
    category: 'Body care',
  });
  assert.equal(dossier.sourceEvidence.officialProductUrl, candidate.identity.officialProductUrl);
  assert.deepEqual(dossier.sourceEvidence.officialIdentity, candidate.identity.officialEvidence);
  assert.equal(dossier.care.formulaArchetype, candidate.care.formulaArchetype);
  assert.equal(dossier.care.careTier, 'daily-care');
  assert.equal(dossier.care.reviewScope, 'catalogue-supportive-care');
  assert.equal(dossier.care.advisoryBoundary, candidate.care.advisoryBoundary);
  assert.equal(dossier.care.independentClinicalGuidanceUrl, candidate.care.independentClinicalGuidanceUrl);
  assert.equal(dossier.nigeria.exactOffers[0]?.retailer, 'Medplus');
  assert.equal(dossier.nigeria.marketRoute, 'brand-authorized');
  assert.equal(dossier.nigeria.exactOffers[0]?.evidence?.responseDigestScope, 'decoded-response-body');
  assert.equal(dossier.nigeria.regulatoryEvidence.authority, 'NAFDAC');
  assert.equal(dossier.nigeria.brandSellerAuthorizationEvidence[0]?.retailer, 'Medplus');
  assert.equal(dossier.nigeria.brandSellerAuthorizationEvidence[0]?.evidence.subjectHost, 'medplusnig.com');
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

test('a Tier-A dossier omits brand authorization and bound seller evidence', () => {
  const base = readyCandidate();
  const secondOffer = withExactOfferEvidence({
    ...base.nigeria.exactOffers[0],
    retailer: 'Teeka4',
    listingUrl: 'https://teeka4.com/shop/example-barrier-lotion',
  });
  const candidate = readyCandidate({
    nigeria: {
      ...base.nigeria,
      brandAuthorizationEvidenceUrl: undefined,
      tierAIdentityEvidenceUrl: base.identity.officialProductUrl,
      exactOffers: [...base.nigeria.exactOffers, secondOffer],
    },
  });
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);

  assert.equal(dossier.nigeria.marketRoute, 'tier-a');
  assert.equal(dossier.nigeria.tierAIdentityEvidenceUrl, base.identity.officialProductUrl);
  assert.equal(dossier.nigeria.brandAuthorizationEvidenceUrl, undefined);
  assert.deepEqual(dossier.nigeria.brandSellerAuthorizationEvidence, []);
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

  assert.throws(
    () => createCataloguePublicationDossier({
      ...candidate,
      asset: { ...candidate.asset, rightsUrl: 'javascript:alert(1)' },
    }, approval(), asOf),
    /not approval-ready.*asset-rights-source-missing/,
  );
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
  assert.throws(
    () => createCataloguePublicationDossier(candidate, approval({ approvedAt: '2026-07-22T14:00:00Z' }), asOf),
    /predates its bound evidence/,
  );
});

test('a retailer-registry authorization change invalidates an existing dossier', () => {
  const candidate = readyCandidate();
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);
  const manifest: CataloguePublicationDossierManifest = {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    exposure: 'private-only',
    dossiers: [dossier],
  };
  const retailer = nigeriaRetailers.find(item => item.name === 'Medplus');
  assert.ok(retailer?.identityEvidence?.basis === 'brand-source');
  const original = retailer.identityEvidence;
  retailer.identityEvidence = {
    ...original,
    observedAt: '2026-07-22T14:32:00Z',
    retrievedAt: '2026-07-22T14:32:00Z',
    reviewedAt: '2026-07-22T14:35:00Z',
  };
  try {
    assert.throws(
      () => verifyCataloguePublicationDossierManifest([candidate], manifest, asOf),
      /dossier content or fingerprint changed/,
    );
  } finally {
    retailer.identityEvidence = original;
  }
});

test('cross-brand retailer authorization cannot enter a candidate dossier', () => {
  const candidate = readyCandidate();
  const retailer = nigeriaRetailers.find(item => item.name === 'Medplus');
  assert.ok(retailer?.identityEvidence?.basis === 'brand-source');
  const original = retailer.identityEvidence;
  retailer.identityEvidence = {
    ...original,
    sourceUrl: 'https://www.eucerin-cewa.com/where-to-buy',
    responseUrl: 'https://www.eucerin-cewa.com/where-to-buy',
  };
  try {
    assert.throws(
      () => createCataloguePublicationDossier(candidate, approval(), asOf),
      /not approval-ready.*nigeria-market-route-insufficient/,
    );
  } finally {
    retailer.identityEvidence = original;
  }
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
      officialProductUrl: 'https://africa.cerave.com/en/our-products/cleansers/hydrating-cleanser',
      officialEvidence: {
        ...identityEvidence({
          url: 'https://africa.cerave.com/en/our-products/cleansers/hydrating-cleanser',
          observedGtin: '0302994113002',
          observedVariant: 'Example Gentle Cleanser',
        }, 'example-gentle-cleanser'),
      },
    },
    care: {
      ...first.care,
      manufacturerEvidenceUrl: 'https://africa.cerave.com/en/our-products/cleansers/hydrating-cleanser',
      evidenceUrls: [
        'https://africa.cerave.com/en/our-products/cleansers/hydrating-cleanser',
        first.care.independentClinicalGuidanceUrl!,
      ],
    },
    nigeria: {
      ...first.nigeria,
      regulatoryEvidence: regulatoryEvidence('0302994113002'),
      exactOffers: first.nigeria.exactOffers.map(offer => withExactOfferEvidence({
        ...offer,
        listingUrl: 'https://medplusnig.com/product/example-gentle-cleanser',
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
