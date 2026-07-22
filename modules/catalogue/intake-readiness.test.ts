import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCatalogueIntakeManifest,
  catalogueGenerationRecordSchemaVersion,
  catalogueGenerationRecordSha256,
  catalogueIdentityExtractionByteSize,
  catalogueIdentityExtractionSchemaVersion,
  catalogueIdentityExtractionSha256,
  catalogueIntakeSchemaVersion,
  evaluateCatalogueIntakeCandidate,
  rankCatalogueIntake,
  type CatalogueGenerationRecord,
  type CatalogueGenerationRecordContent,
  type CatalogueIntakeCandidate,
  type CatalogueIntakeOffer,
  type CatalogueOfficialIdentityEvidence,
} from '@/lib/catalogue/intake-readiness';
import {
  catalogueExactOfferEvidenceSchemaVersion,
  catalogueRegulatoryEvidenceSchemaVersion,
  regulatoryEvidenceExcerptSha256,
  type ReviewedExactOfferEvidence,
  type ReviewedRegulatoryEvidence,
} from '@/lib/catalogue/market-evidence';

const asOf = Date.parse('2026-07-22T17:05:00Z');
const hash = 'a'.repeat(64);
const sourceHash = 'b'.repeat(64);

function exactOfferEvidence(
  overrides: Partial<ReviewedExactOfferEvidence> = {},
): ReviewedExactOfferEvidence {
  const listingUrl = overrides.listingUrl ?? 'https://medplusnig.com/product/example-barrier-lotion';
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
    ...overrides,
  };
}

function regulatoryEvidence(
  gtin = '4005808319695',
  overrides: Partial<ReviewedRegulatoryEvidence> = {},
): Extract<ReviewedRegulatoryEvidence, { status: 'matched' }> {
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
    ...overrides,
  } as Extract<ReviewedRegulatoryEvidence, { status: 'matched' }>;
}

function withExactOfferEvidence<T extends CatalogueIntakeOffer>(offer: T): T {
  const label = offer.observedGtinBasis === 'explicit-ean'
    ? 'EAN'
    : offer.observedGtinBasis === 'explicit-upc'
      ? 'UPC'
      : 'GTIN';
  return {
    ...offer,
    evidence: exactOfferEvidence({
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
    }),
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
    outputSha256: hash,
    generatedAt: '2026-07-22T09:05:00Z',
    ...overrides,
  };
  return { ...content, recordSha256: catalogueGenerationRecordSha256(content) };
}

function withCanonicalExtraction(
  evidence: CatalogueOfficialIdentityEvidence,
  canonicalExtraction: CatalogueOfficialIdentityEvidence['canonicalExtraction'],
): CatalogueOfficialIdentityEvidence {
  return {
    ...evidence,
    canonicalExtraction,
    snapshotSha256: catalogueIdentityExtractionSha256(canonicalExtraction),
    snapshotByteSize: catalogueIdentityExtractionByteSize(canonicalExtraction),
  };
}

function completeCandidate(overrides: Partial<CatalogueIntakeCandidate> = {}): CatalogueIntakeCandidate {
  const base: CatalogueIntakeCandidate = {
    id: 'example-barrier-lotion',
    brand: 'CeraVe',
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
      excludedObservations: [],
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
      publicImageSha256: hash,
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

test('a manufacturer page alone cannot satisfy the independent care review gate', () => {
  const base = completeCandidate();
  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    care: {
      ...base.care,
      independentClinicalGuidanceUrl: base.care.manufacturerEvidenceUrl,
      evidenceUrls: [base.care.manufacturerEvidenceUrl!],
    },
  }, asOf);

  assert.equal(decision.stage, 'care');
  assert.ok(decision.blockers.includes('care-independent-guidance-missing'));
});

test('an arbitrary different HTTPS host cannot impersonate reviewed clinical guidance', () => {
  const base = completeCandidate();
  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    care: {
      ...base.care,
      independentClinicalGuidanceUrl: 'https://attacker.example/advice',
      evidenceUrls: [base.care.manufacturerEvidenceUrl!, 'https://attacker.example/advice'],
    },
  }, asOf);

  assert.equal(decision.stage, 'care');
  assert.ok(decision.blockers.includes('care-independent-guidance-missing'));
});

test('care evidence cannot substitute a sibling same-brand product page or unrelated host', () => {
  const base = completeCandidate();
  const sameBrand = evaluateCatalogueIntakeCandidate({
    ...base,
    care: {
      ...base.care,
      manufacturerEvidenceUrl: 'https://www.cerave.com/skincare/moisturizers/moisturizing-cream',
      evidenceUrls: [
        'https://www.cerave.com/skincare/moisturizers/moisturizing-cream',
        base.care.independentClinicalGuidanceUrl!,
      ],
    },
  }, asOf);
  const unrelated = evaluateCatalogueIntakeCandidate({
    ...base,
    care: {
      ...base.care,
      manufacturerEvidenceUrl: 'https://unrelated-brand.test/products/barrier-lotion',
      evidenceUrls: [
        'https://unrelated-brand.test/products/barrier-lotion',
        base.care.independentClinicalGuidanceUrl!,
      ],
    },
  }, asOf);

  assert.equal(sameBrand.stage, 'care');
  assert.ok(sameBrand.blockers.includes('care-independent-guidance-missing'));
  assert.equal(unrelated.stage, 'care');
  assert.ok(unrelated.blockers.includes('care-independent-guidance-missing'));
});

test('reviewed official care hosts are exact and reject brand-shaped spoof subdomains', () => {
  const base = completeCandidate({ brand: 'CeraVe' });
  const official = evaluateCatalogueIntakeCandidate({
    ...base,
    care: {
      ...base.care,
      manufacturerEvidenceUrl: 'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
      evidenceUrls: [
        'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
        base.care.independentClinicalGuidanceUrl!,
      ],
    },
  }, asOf);
  const spoof = evaluateCatalogueIntakeCandidate({
    ...base,
    care: {
      ...base.care,
      manufacturerEvidenceUrl: 'https://cerave.attacker.example/products/moisturising-cream',
      evidenceUrls: [
        'https://cerave.attacker.example/products/moisturising-cream',
        base.care.independentClinicalGuidanceUrl!,
      ],
    },
  }, asOf);

  assert.equal(official.blockers.includes('care-independent-guidance-missing'), false);
  assert.equal(spoof.stage, 'care');
  assert.ok(spoof.blockers.includes('care-independent-guidance-missing'));
});

test('a reviewed care record states its advisory boundary', () => {
  const base = completeCandidate();
  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    care: { ...base.care, advisoryBoundary: 'Too short' },
  }, asOf);

  assert.equal(decision.stage, 'care');
  assert.ok(decision.blockers.includes('care-advisory-boundary-missing'));
});

test('each SKU gate preserves identity then care, market review and art-review chronology', () => {
  const base = completeCandidate();
  const careBeforeIdentity = evaluateCatalogueIntakeCandidate({
    ...base,
    care: { ...base.care, reviewedAt: '2026-07-22T07:59:00Z' },
  }, asOf);
  assert.equal(careBeforeIdentity.stage, 'care');
  assert.ok(careBeforeIdentity.blockers.includes('care-review-missing'));

  const regulatoryBeforeIdentity = evaluateCatalogueIntakeCandidate({
    ...base,
    identity: { ...base.identity, checkedAt: '2026-07-22T09:10:00Z' },
    care: { ...base.care, reviewedAt: '2026-07-22T09:15:00Z' },
    nigeria: {
      ...base.nigeria,
      regulatoryEvidence: regulatoryEvidence(undefined, {
        retrievedAt: '2026-07-22T08:50:00Z',
        observedAt: '2026-07-22T08:50:00Z',
        reviewedAt: '2026-07-22T09:00:00Z',
      }),
    },
  }, asOf);
  assert.equal(regulatoryBeforeIdentity.stage, 'nigeria');
  assert.ok(regulatoryBeforeIdentity.blockers.includes('nigeria-regulatory-evidence-missing'));

  const offerBeforeIdentity = evaluateCatalogueIntakeCandidate({
    ...base,
    identity: { ...base.identity, checkedAt: '2026-07-22T09:06:00Z' },
    care: { ...base.care, reviewedAt: '2026-07-22T09:07:00Z' },
  }, asOf);
  assert.equal(offerBeforeIdentity.stage, 'nigeria');
  assert.equal(offerBeforeIdentity.freshExactOffers.length, 0);

  const artBeforeIdentity = evaluateCatalogueIntakeCandidate({
    ...base,
    identity: { ...base.identity, checkedAt: '2026-07-22T09:00:00Z' },
    care: { ...base.care, reviewedAt: '2026-07-22T09:01:00Z' },
    asset: { ...base.asset, artReviewedAt: '2026-07-22T08:59:00Z' },
  }, asOf);
  assert.equal(artBeforeIdentity.stage, 'editorial');
  assert.ok(artBeforeIdentity.blockers.includes('asset-review-chronology-invalid'));
});

test('official identity approval is bound to exact observed identity and immutable retrieval metadata', () => {
  const base = completeCandidate();
  const invalidEvidence = [
    undefined,
    { ...base.identity.officialEvidence!, observedGtin: '0302994113002' },
    { ...base.identity.officialEvidence!, observedVariant: 'Example Repair Cream' },
    { ...base.identity.officialEvidence!, observedSize: '200 ml' },
    { ...base.identity.officialEvidence!, snapshotSha256: 'not-a-hash' },
    {
      ...base.identity.officialEvidence!,
      canonicalExtraction: {
        ...base.identity.officialEvidence!.canonicalExtraction,
        sourceResponseSha256: 'not-a-hash',
      },
    },
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

  const attackerEvidence = identityEvidence({
    url: 'https://attacker.example/fake-cerave',
  });
  const internallyConsistentAttacker = evaluateCatalogueIntakeCandidate({
    ...base,
    identity: {
      ...base.identity,
      officialProductUrl: attackerEvidence.url,
      officialEvidence: attackerEvidence,
    },
  }, asOf);
  assert.equal(internallyConsistentAttacker.stage, 'identity');
  assert.ok(internallyConsistentAttacker.blockers.includes('identity-official-evidence-invalid'));
});

test('canonical identity extraction rejects token collisions and non-raw response MIME types', () => {
  const base = completeCandidate();
  const evidence = base.identity.officialEvidence!;
  const extraction = evidence.canonicalExtraction;
  const invalidExtractions: CatalogueOfficialIdentityEvidence['canonicalExtraction'][] = [
    {
      ...extraction,
      fields: {
        ...extraction.fields,
        gtin: { ...extraction.fields.gtin, sourceText: `GTIN 1${extraction.fields.gtin.value}` },
      },
    },
    {
      ...extraction,
      sourceResponseMimeType: 'application/json' as never,
    },
    {
      ...extraction,
      responseUrl: 'https://attacker.example/redirected-response',
    },
    {
      ...extraction,
      responseDigestScope: 'compressed-wire-body' as never,
    },
    {
      ...extraction,
      responseUrl: undefined as never,
    },
    {
      ...extraction,
      fields: {
        ...extraction.fields,
        gtin: {
          ...extraction.fields.gtin,
          locator: 'HTML inline dataLayer productID',
          sourceText: `productID: ${extraction.fields.gtin.value}`,
        },
      },
    },
    {
      ...extraction,
      fields: {
        ...extraction.fields,
        gtin: {
          ...extraction.fields.gtin,
          locator: 'Product JSON-LD sku',
          sourceText: `sku: ${extraction.fields.gtin.value}`,
        },
      },
    },
  ];

  for (const canonicalExtraction of invalidExtractions) {
    const decision = evaluateCatalogueIntakeCandidate({
      ...base,
      identity: {
        ...base.identity,
        officialEvidence: withCanonicalExtraction(evidence, canonicalExtraction),
      },
    }, asOf);
    assert.equal(decision.stage, 'identity');
    assert.ok(decision.blockers.includes('identity-official-evidence-invalid'));
  }

  const sizeEvidence = identityEvidence({ observedSize: '250 ml' });
  const sizeCollisionExtraction = {
    ...sizeEvidence.canonicalExtraction,
    fields: {
      ...sizeEvidence.canonicalExtraction.fields,
      size: { ...sizeEvidence.canonicalExtraction.fields.size, sourceText: '1250 ml' },
    },
  };
  const sizeCollision = evaluateCatalogueIntakeCandidate({
    ...base,
    size: '250 ml',
    identity: {
      ...base.identity,
      officialEvidence: withCanonicalExtraction(sizeEvidence, sizeCollisionExtraction),
    },
  }, asOf);
  assert.equal(sizeCollision.stage, 'identity');
  assert.ok(sizeCollision.blockers.includes('identity-official-evidence-invalid'));
});

test('malformed canonical identity extraction shapes become blockers instead of exceptions', () => {
  const base = completeCandidate();
  const evidence = base.identity.officialEvidence!;
  const extraction = evidence.canonicalExtraction;
  const malformedExtractions = [
    { ...extraction, fields: null },
    {
      ...extraction,
      fields: {
        ...extraction.fields,
        gtin: { ...extraction.fields.gtin, sourceText: undefined },
      },
    },
    {
      ...extraction,
      fields: {
        ...extraction.fields,
        size: { ...extraction.fields.size, value: 400 },
      },
    },
  ];

  for (const malformed of malformedExtractions) {
    const officialEvidence = withCanonicalExtraction(
      evidence,
      malformed as unknown as CatalogueOfficialIdentityEvidence['canonicalExtraction'],
    );
    assert.doesNotThrow(() => evaluateCatalogueIntakeCandidate({
      ...base,
      identity: { ...base.identity, officialEvidence },
    }, asOf));
    const decision = evaluateCatalogueIntakeCandidate({
      ...base,
      identity: { ...base.identity, officialEvidence },
    }, asOf);
    assert.equal(decision.stage, 'identity');
    assert.ok(decision.blockers.includes('identity-official-evidence-invalid'));
  }
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

test('matching digits do not count when the retailer labels them only as SKU', () => {
  const base = completeCandidate();
  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({
        ...offer,
        observedGtinBasis: undefined,
        retailerSku: offer.observedGtin,
      })),
    },
  }, asOf);

  assert.equal(decision.stage, 'nigeria');
  assert.equal(decision.freshExactOffers.length, 0);
  assert.ok(decision.blockers.includes('nigeria-offer-identity-unbound'));
});

test('bare or tampered Nigerian offers cannot qualify as reviewed exact evidence', () => {
  const base = completeCandidate();
  const original = base.nigeria.exactOffers[0];
  const invalidOffers: CatalogueIntakeOffer[] = [
    { ...original, evidence: undefined },
    { ...original, evidence: { ...original.evidence!, responseSha256: 'not-a-hash' } },
    { ...original, evidence: { ...original.evidence!, responseUrl: 'https://medplusnig.com/product/another-item' } },
    { ...original, evidence: { ...original.evidence!, reviewedAt: '2026-07-22T08:59:00Z' } },
    {
      ...original,
      evidence: {
        ...original.evidence!,
        fields: {
          ...original.evidence!.fields,
          price: { ...original.evidence!.fields.price, value: 12_501 },
        },
      },
    },
    {
      ...original,
      evidence: {
        ...original.evidence!,
        fields: {
          ...original.evidence!.fields,
          price: { ...original.evidence!.fields.price, sourceText: 'NGN 112,500' },
        },
      },
    },
    {
      ...original,
      evidence: {
        ...original.evidence!,
        fields: {
          ...original.evidence!.fields,
          stock: { ...original.evidence!.fields.stock, sourceText: 'Not in stock' },
        },
      },
    },
    {
      ...original,
      evidence: {
        ...original.evidence!,
        fields: {
          ...original.evidence!.fields,
          price: { ...original.evidence!.fields.price, sourceText: 'NGN 12,500.99' },
        },
      },
    },
    {
      ...original,
      evidence: {
        ...original.evidence!,
        fields: {
          ...original.evidence!.fields,
          price: { ...original.evidence!.fields.price, sourceText: 'USD 12,500 — NGN unavailable' },
        },
      },
    },
  ];

  for (const offer of invalidOffers) {
    const decision = evaluateCatalogueIntakeCandidate({
      ...base,
      nigeria: { ...base.nigeria, exactOffers: [offer] },
    }, asOf);
    assert.equal(decision.freshExactOffers.length, 0);
    assert.ok(decision.blockers.includes('nigeria-exact-offer-missing'));
    assert.ok(decision.blockers.includes('nigeria-offer-identity-unbound'));
  }
});

test('a retailer SKU label cannot be relabelled as manufacturer GTIN evidence', () => {
  const base = completeCandidate();
  const offer = base.nigeria.exactOffers[0];
  const evidence = offer.evidence!;
  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: [{
        ...offer,
        evidence: {
          ...evidence,
          fields: {
            ...evidence.fields,
            gtin: {
              ...evidence.fields.gtin,
              locator: 'HTML retailer SKU row',
              sourceText: `SKU ${offer.observedGtin}`,
            },
          },
        },
      }],
    },
  }, asOf);

  assert.equal(decision.freshExactOffers.length, 0);
  assert.ok(decision.blockers.includes('nigeria-offer-identity-unbound'));
});

test('a retailer gallery back label can bind an exact offer to the printed package EAN', () => {
  const base = completeCandidate();
  const listingUrl = 'https://buybetter.ng/product/example-barrier-lotion';
  const barcodeImageUrl = 'https://i0.wp.com/buybetter.ng/wp-content/uploads/example-barrier-lotion-back.png';
  const offer: CatalogueIntakeOffer = {
    retailer: 'BuyBetter',
    retailerStatus: 'directory-listed',
    listingUrl,
    observedAt: '2026-07-22T09:00:00Z',
    observedTitle: 'Example Barrier Lotion',
    observedSize: '13.5 fl oz / 400 ml',
    observedGtin: base.identity.gtin,
    observedGtinBasis: 'explicit-ean',
    retailerSku: base.identity.gtin,
    priceNgn: 12_500,
    stock: 'in-stock',
    evidence: exactOfferEvidence({
      listingUrl,
      responseUrl: listingUrl,
      fields: {
        gtin: {
          label: 'EAN',
          value: base.identity.gtin!,
          locator: 'Product gallery back-label barcode',
          sourceText: `EAN-13 barcode ${base.identity.gtin}`,
          responseRole: 'package-barcode-image',
        },
        title: {
          value: 'Example Barrier Lotion',
          locator: 'HTML h1 product title',
          sourceText: 'Example Barrier Lotion',
        },
        size: {
          value: '13.5 fl oz / 400 ml',
          locator: 'HTML h1 product title',
          sourceText: 'Example Barrier Lotion 13.5 fl oz / 400 ml',
        },
        price: {
          value: 12_500,
          currency: 'NGN',
          locator: 'HTML product price amount',
          sourceText: '₦12,500.00',
        },
        stock: {
          value: 'in-stock',
          locator: 'HTML product stock count',
          sourceText: '5 in stock',
        },
      },
      supplementalResponses: [{
        role: 'package-barcode-image',
        sourceUrl: barcodeImageUrl,
        responseUrl: barcodeImageUrl,
        responseSha256: 'c'.repeat(64),
        responseMimeType: 'image/png',
        responseByteSize: 239_216,
        retrievedAt: '2026-07-22T09:00:00Z',
        listingLocator: 'HTML product gallery image src',
        listingSourceText: barcodeImageUrl,
        barcode: {
          symbology: 'EAN-13',
          value: base.identity.gtin!,
          locator: 'Printed barcode at lower-right of back label',
          sourceText: `EAN-13 barcode ${base.identity.gtin}`,
        },
      }],
    }),
  };
  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: { ...base.nigeria, exactOffers: [offer] },
  }, asOf);

  assert.equal(decision.freshExactOffers.length, 1);
  assert.equal(decision.nigeriaMarketRoute, 'brand-authorized');
  assert.equal(decision.stage, 'approval-ready');

  const tampered = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: [{
        ...offer,
        evidence: {
          ...offer.evidence!,
          supplementalResponses: offer.evidence!.supplementalResponses!.map(response => ({
            ...response,
            responseSha256: 'not-a-hash',
          })),
        },
      }],
    },
  }, asOf);
  assert.equal(tampered.freshExactOffers.length, 0);
  assert.ok(tampered.blockers.includes('nigeria-offer-identity-unbound'));
});

test('regulatory clearance requires a hash-bound NAFDAC record for the candidate GTIN', () => {
  const base = completeCandidate();
  const active = regulatoryEvidence();
  const revokedSourceText = active.sourceText.replace('Status Active', 'Status Revoked');
  const expiredSourceText = `${active.sourceText} · Expiry 2026-07-21`;
  const invalidEvidence: ReviewedRegulatoryEvidence[] = [
    regulatoryEvidence(undefined, { sourceUrl: 'https://regulator.example/products/4005808319695' }),
    regulatoryEvidence(undefined, { sourceExcerptSha256: 'f'.repeat(64) }),
    regulatoryEvidence(undefined, { responseUrl: 'https://attacker.example/redirected-body' }),
    regulatoryEvidence('0302994113002'),
    regulatoryEvidence(undefined, { registrationNumber: 'A4-123' }),
    regulatoryEvidence(undefined, { reviewedAt: '2026-07-22T09:00:00Z', observedAt: '2026-07-22T09:10:00Z' }),
    regulatoryEvidence(undefined, {
      retrievedAt: '2026-04-01T09:10:00Z',
      observedAt: '2026-04-01T09:10:00Z',
      reviewedAt: '2026-04-01T09:20:00Z',
    }),
    regulatoryEvidence(undefined, { sourceText: `${active.sourceText} tampered` }),
    { ...active, registrationStatus: undefined as never },
    {
      ...active,
      sourceText: revokedSourceText,
      sourceExcerptSha256: regulatoryEvidenceExcerptSha256(revokedSourceText),
      registrationStatus: {
        ...active.registrationStatus,
        sourceText: 'Status Revoked',
      },
    },
    {
      ...active,
      registrationStatus: {
        ...active.registrationStatus,
        sourceText: 'Status Inactive',
      },
    },
    {
      ...active,
      sourceText: expiredSourceText,
      sourceExcerptSha256: regulatoryEvidenceExcerptSha256(expiredSourceText),
      expiry: {
        value: '2026-07-21',
        locator: 'NAFDAC Greenbook registration expiry row',
        sourceText: 'Expiry 2026-07-21',
      },
    },
    { ...active, expiry: null as never },
    { ...active, expiry: '' as never },
  ];

  for (const evidence of invalidEvidence) {
    const decision = evaluateCatalogueIntakeCandidate({
      ...base,
      nigeria: { ...base.nigeria, regulatoryEvidence: evidence },
    }, asOf);
    assert.equal(decision.stage, 'nigeria');
    assert.ok(decision.blockers.includes('nigeria-regulatory-evidence-missing'));
  }
});

test('not-required regulatory clearance carries a reviewed rationale from NAFDAC', () => {
  const base = completeCandidate();
  const subjectProductOrClass = 'reviewed non-regulated product category';
  const rationale = 'The reviewed NAFDAC scope excludes this exact non-regulated product category.';
  const sourceText = `NAFDAC scope notice for ${subjectProductOrClass}: ${rationale}`;
  const evidence: ReviewedRegulatoryEvidence = {
    schemaVersion: catalogueRegulatoryEvidenceSchemaVersion,
    authority: 'NAFDAC',
    status: 'not-required',
    candidateGtin: base.identity.gtin!,
    subjectProductOrClass,
    rationale,
    sourceUrl: 'https://nafdac.gov.ng/resources/regulatory-scope/',
    locator: 'NAFDAC scope notice category paragraph',
    sourceText,
    sourceExcerptSha256: regulatoryEvidenceExcerptSha256(sourceText),
    responseUrl: 'https://nafdac.gov.ng/resources/regulatory-scope/',
    responseSha256: 'f'.repeat(64),
    responseDigestScope: 'decoded-response-body',
    responseMimeType: 'text/html',
    responseByteSize: 24_000,
    retrievedAt: '2026-07-22T09:10:00Z',
    observedAt: '2026-07-22T09:10:00Z',
    reviewedAt: '2026-07-22T09:20:00Z',
    reviewer: 'Regulatory reviewer',
  };
  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: {
      ...base.nigeria,
      regulatoryStatus: 'not-required',
      regulatoryEvidence: evidence,
    },
  }, asOf);

  assert.equal(decision.blockers.includes('nigeria-regulatory-evidence-missing'), false);
  assert.equal(decision.stage, 'approval-ready');

  const unrelatedSourceText = 'NAFDAC publishes general agency contact information.';
  const unrelated = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: {
      ...base.nigeria,
      regulatoryStatus: 'not-required',
      regulatoryEvidence: {
        ...evidence,
        sourceText: unrelatedSourceText,
        sourceExcerptSha256: regulatoryEvidenceExcerptSha256(unrelatedSourceText),
      },
    },
  }, asOf);
  assert.ok(unrelated.blockers.includes('nigeria-regulatory-evidence-missing'));
});

test('a provisional observation cannot satisfy the independent Tier-A route', () => {
  const base = completeCandidate();
  const secondOffer = withExactOfferEvidence({
    ...base.nigeria.exactOffers[0],
    retailer: 'Slique Beauty',
    // Deliberately forged: readiness must derive this from the registry.
    retailerStatus: 'directory-listed' as const,
    listingUrl: 'https://sliquebeautylimited.com/product/example-barrier-lotion',
  });
  const item: CatalogueIntakeCandidate = {
    ...base,
    nigeria: {
      ...base.nigeria,
      brandAuthorizationEvidenceUrl: undefined,
      tierAIdentityEvidenceUrl: base.identity.officialProductUrl,
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
        withExactOfferEvidence({
          ...secondOffer,
          retailer: 'Teeka4',
          listingUrl: 'https://teeka4.com/shop/example-barrier-lotion',
        }),
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

test('brand authorization advances only the seller named by that exact brand source', () => {
  const base = completeCandidate();
  const unboundSeller = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({
        ...offer,
        retailer: 'Beauty by Daz',
        listingUrl: 'https://beautybydaz.com/product/example-barrier-lotion',
      })),
    },
  }, asOf);
  const wrongBrand = evaluateCatalogueIntakeCandidate({
    ...base,
    brand: 'Eucerin',
    care: {
      ...base.care,
      manufacturerEvidenceUrl: 'https://www.eucerin-cewa.com/products/urea-repair-plus/urearepair-plus-10--urea-body-lotion',
      evidenceUrls: [
        'https://www.eucerin-cewa.com/products/urea-repair-plus/urearepair-plus-10--urea-body-lotion',
        base.care.independentClinicalGuidanceUrl!,
      ],
    },
  }, asOf);

  assert.equal(unboundSeller.stage, 'nigeria');
  assert.ok(unboundSeller.blockers.includes('nigeria-market-route-insufficient'));
  assert.equal(wrongBrand.stage, 'identity');
  assert.ok(wrongBrand.blockers.includes('identity-official-evidence-invalid'));
  assert.ok(wrongBrand.blockers.includes('nigeria-market-route-insufficient'));
});

test('Nigeria evidence declares exactly one candidate-consistent market route', () => {
  const base = completeCandidate();
  const secondOffer = withExactOfferEvidence({
    ...base.nigeria.exactOffers[0],
    retailer: 'Teeka4',
    listingUrl: 'https://teeka4.com/shop/example-barrier-lotion',
  });
  const tierA: CatalogueIntakeCandidate = {
    ...base,
    nigeria: {
      ...base.nigeria,
      brandAuthorizationEvidenceUrl: undefined,
      tierAIdentityEvidenceUrl: base.identity.officialProductUrl,
      exactOffers: [...base.nigeria.exactOffers, secondOffer],
    },
  };
  const tierDecision = evaluateCatalogueIntakeCandidate(tierA, asOf);
  assert.equal(tierDecision.stage, 'approval-ready');
  assert.equal(tierDecision.nigeriaMarketRoute, 'tier-a');

  const conflictingBrandClaim = evaluateCatalogueIntakeCandidate({
    ...tierA,
    nigeria: {
      ...tierA.nigeria,
      brandAuthorizationEvidenceUrl: base.nigeria.brandAuthorizationEvidenceUrl,
    },
  }, asOf);
  assert.equal(conflictingBrandClaim.stage, 'nigeria');
  assert.equal(conflictingBrandClaim.nigeriaMarketRoute, undefined);
  assert.ok(conflictingBrandClaim.blockers.includes('nigeria-market-route-insufficient'));

  const bogusTierClaim = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: {
      ...base.nigeria,
      tierAIdentityEvidenceUrl: 'https://attacker.example/fake-tier-a',
    },
  }, asOf);
  assert.equal(bogusTierClaim.stage, 'nigeria');
  assert.equal(bogusTierClaim.nigeriaMarketRoute, undefined);

  const crossBrandAuthorization = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: {
      ...base.nigeria,
      brandAuthorizationEvidenceUrl: 'https://www.eucerin-cewa.com/where-to-buy',
    },
  }, asOf);
  assert.equal(crossBrandAuthorization.stage, 'nigeria');
  assert.equal(crossBrandAuthorization.nigeriaMarketRoute, undefined);
  assert.ok(crossBrandAuthorization.blockers.includes('nigeria-market-route-insufficient'));
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

  for (const rightsUrl of ['javascript:alert(1)', 'https://brand.example/false-reuse-rights']) {
    const falseRightsClaim = evaluateCatalogueIntakeCandidate({
      ...generated.candidate,
      asset: { ...generated.candidate.asset, rightsUrl },
    }, asOf);
    assert.equal(falseRightsClaim.stage, 'rights');
    assert.ok(falseRightsClaim.blockers.includes('asset-rights-source-missing'));
  }

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

test('a reviewed source-pixel isolation remains private without a durable typed audit record', () => {
  const base = completeCandidate();
  const item: CatalogueIntakeCandidate = {
    ...base,
    asset: { ...base.asset, backgroundTreatment: 'source-pixel-isolation' },
  };
  const decision = evaluateCatalogueIntakeCandidate(item, asOf);

  assert.equal(decision.stage, 'rights');
  assert.ok(decision.blockers.includes('asset-isolation-record-missing'));
  assert.equal(decision.approvalDraftReady, false);
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
        ...identityEvidence({ observedGtin: '0302994113002' }, 'exploratory-ready'),
      },
    },
    nigeria: {
      ...exploratoryBase.nigeria,
      regulatoryEvidence: regulatoryEvidence('0302994113002'),
      exactOffers: exploratoryBase.nigeria.exactOffers.map(offer => ({
        ...withExactOfferEvidence({
          ...offer,
          observedGtin: '0302994113002',
        }),
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
    brand: '  CERAVE  ',
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
    brand: 'CERAVE',
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

test('the manifest timestamp cannot predate nested evidence or review activity', () => {
  const manifest = {
    schemaVersion: catalogueIntakeSchemaVersion,
    updatedAt: '2026-07-22T09:14:59Z',
    candidates: [completeCandidate()],
  };

  assert.throws(
    () => auditCatalogueIntakeManifest(manifest, asOf),
    /timestamp predates evidence or review activity for example-barrier-lotion/,
  );
});
