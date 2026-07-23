import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewedProductRecords } from '@/data/catalogue';
import {
  assessCatalogueQuality,
  catalogueApprovalScope,
  externalCatalogueApprovalSchemaVersion,
  evaluateExternalCatalogueCandidate,
  externalCandidateFingerprint,
  gateExternalCatalogue,
  type ExternalCatalogueApproval,
  type ExternalCatalogueGateCandidate,
} from '@/lib/catalogue/catalogue-publication-gate';
import { auditReviewedProductQuality } from '@/lib/catalogue/reviewed-product-quality';
import {
  catalogueExactOfferEvidenceSchemaVersion,
  catalogueRegulatoryEvidenceSchemaVersion,
  regulatoryEvidenceExcerptSha256,
  type ReviewedExactOfferEvidence,
  type ReviewedRegulatoryEvidence,
} from '@/lib/catalogue/market-evidence';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const asOf = Date.parse('2026-07-22T17:05:00Z');

type ExternalOffer = ExternalCatalogueApproval['nigeria']['exactOffers'][number];

function withOfferEvidence<T extends ExternalOffer>(offer: T): T {
  const label = offer.observedGtinBasis === 'explicit-ean'
    ? 'EAN'
    : offer.observedGtinBasis === 'explicit-upc'
      ? 'UPC'
      : 'GTIN';
  const evidence: ReviewedExactOfferEvidence = {
    schemaVersion: catalogueExactOfferEvidenceSchemaVersion,
    method: 'reviewed-exact-offer-field-extraction',
    listingUrl: offer.listingUrl,
    responseUrl: offer.listingUrl,
    responseSha256: 'e'.repeat(64),
    responseDigestScope: 'decoded-response-body',
    responseMimeType: 'text/html',
    responseByteSize: 31_500,
    retrievedAt: offer.observedAt,
    fields: {
      gtin: {
        label,
        value: offer.observedGtin,
        locator: `HTML product metadata ${label} row`,
        sourceText: `${label} ${offer.observedGtin}`,
      },
      title: {
        value: offer.variant,
        locator: 'HTML h1 product title',
        sourceText: offer.variant,
      },
      size: {
        value: offer.size,
        locator: 'HTML product size selection',
        sourceText: offer.size,
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
    reviewer: 'Market reviewer',
    reviewedAt: new Date(Date.parse(offer.observedAt) + 5 * 60_000).toISOString(),
  };
  return { ...offer, evidence };
}

function regulatoryEvidence(gtin: string): Extract<ReviewedRegulatoryEvidence, { status: 'matched' }> {
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

function candidate(overrides: Partial<ExternalCatalogueGateCandidate> = {}): ExternalCatalogueGateCandidate {
  return {
    source: 'open-beauty-facts',
    sourceProductId: '4005808319695',
    barcode: '4005808319695',
    brand: 'CeraVe',
    name: 'Example Lotion',
    quantity: '400 ml',
    category: 'Body care',
    sourceUrl: 'https://world.openbeautyfacts.org/product/4005808319695',
    sourceUpdatedAt: '2026-07-20T10:00:00Z',
    sourceSnapshotSha256: hashA,
    rawPayloadSha256: hashB,
    sourceImageUrl: 'https://images.openbeautyfacts.org/images/products/400/580/831/9695/front_en.1.400.jpg',
    canonicalImageUrl: 'https://assets.example/catalogue/example.webp',
    imageSha256: hashA,
    imageWidth: 1_600,
    imageHeight: 1_600,
    imageLicense: 'CC BY-SA 3.0',
    sourcePhotoValidated: true,
    sourceIngredientsComplete: true,
    ...overrides,
  };
}

function approval(item: ExternalCatalogueGateCandidate, overrides: Partial<ExternalCatalogueApproval> = {}): ExternalCatalogueApproval {
  return {
    barcode: item.barcode,
    candidateFingerprint: externalCandidateFingerprint(item),
    sourceSnapshotSha256: item.sourceSnapshotSha256,
    imageSha256: item.imageSha256,
    approvedAt: '2026-07-22T16:00:00Z',
    reviewer: 'Catalogue reviewer',
    scope: catalogueApprovalScope,
    catalogueFit: 'Recognizable product with a deliberate catalogue role.',
    sku: {
      status: 'exact',
      barcode: item.barcode,
      variant: item.name,
      size: item.quantity,
      evidenceUrl: 'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
    },
    careReview: {
      formulaArchetype: 'Occlusive body moisturizer',
      careTier: 'daily-care',
      evidenceUrl: 'https://evidence.example/formula/example',
      reviewedAt: '2026-07-22T09:00:00Z',
      reviewer: 'Care reviewer',
    },
    nigeria: {
      regulatoryStatus: 'matched',
      regulatoryEvidence: regulatoryEvidence(item.barcode),
      tierAIdentityEvidenceUrl: 'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
      exactOffers: [
        withOfferEvidence({ retailer: 'Beauty by Daz', listingUrl: 'https://beautybydaz.com/product/example', observedAt: '2026-07-22T08:00:00Z', variant: item.name, size: item.quantity, observedGtin: item.barcode, observedGtinBasis: 'explicit-gtin', priceNgn: 8_500, stock: 'in-stock' }),
        withOfferEvidence({ retailer: 'Teeka4', listingUrl: 'https://teeka4.com/product/example', observedAt: '2026-07-21T08:00:00Z', variant: item.name, size: item.quantity, observedGtin: item.barcode, observedGtinBasis: 'explicit-ean', priceNgn: 9_000, stock: 'low-stock' }),
      ],
    },
    asset: {
      origin: 'licensed-original-photograph',
      rightsBasis: 'cc-by-sa-3.0',
      rightsUrl: 'https://world.openbeautyfacts.org/terms-of-use',
      publicImageUrl: item.canonicalImageUrl,
      publicImageSha256: item.imageSha256,
      publicImageWidth: 1_600,
      publicImageHeight: 1_600,
      packaging: 'intact',
      sourceFaithful: true,
      backgroundTreatment: 'none',
      labelVariantSizeUnchanged: true,
      packagingInvented: false,
      manualSourceOutputQa: true,
      presentationQuality: 'magazine-ready',
    },
    ...overrides,
  };
}

test('quality scoring is deterministic and source-agnostic', () => {
  const reviewed = assessCatalogueQuality({
    id: 'reviewed-product',
    source: 'reviewed',
    identityTraceable: true,
    formulaEvidence: 'partial',
    productEvidence: 'moderate',
    exactNigeriaOffer: true,
    imageRights: 'missing',
    assetOrigin: 'official-brand-media',
    packaging: 'intact',
    sourceFaithful: true,
    backgroundTreatment: 'none',
    labelVariantSizeUnchanged: true,
    packagingInvented: false,
    manualSourceOutputQa: true,
    presentationQuality: 'magazine-ready',
  });
  const repeated = assessCatalogueQuality({
    id: 'reviewed-product',
    source: 'reviewed',
    identityTraceable: true,
    formulaEvidence: 'partial',
    productEvidence: 'moderate',
    exactNigeriaOffer: true,
    imageRights: 'missing',
    assetOrigin: 'official-brand-media',
      packaging: 'intact',
      sourceFaithful: true,
      backgroundTreatment: 'none',
      labelVariantSizeUnchanged: true,
      packagingInvented: false,
      manualSourceOutputQa: true,
      presentationQuality: 'magazine-ready',
  });

  assert.deepEqual(reviewed, repeated);
  assert.equal(reviewed.dimensions.formula, 8);
  assert.equal(reviewed.dimensions.evidence, 10);
  assert.equal(reviewed.dimensions.nigeria, 15);
  assert.ok(reviewed.concerns.includes('image-rights-missing'));
});

test('the same audit surfaces reviewed-product formula, evidence, Nigeria and rights gaps without changing publication state', () => {
  const product = reviewedProductRecords.find(item => item.slug === 'anua-niacinamide-10-txa-4-serum')!;
  const audit = auditReviewedProductQuality(product);

  assert.equal(audit.productSlug, product.slug);
  assert.equal(audit.publicationEligibilityChanged, false);
  assert.equal(audit.assessment.dimensions.identity, 20);
  assert.ok(audit.assessment.dimensions.formula > 0);
  assert.ok(audit.assessment.dimensions.evidence > 0);
  assert.equal(audit.assessment.dimensions.nigeria, 15);
  assert.equal(audit.assessment.dimensions.rights, 0);
});

test('bulk candidates stay private without a deliberate approval', () => {
  const item = candidate();
  const decision = evaluateExternalCatalogueCandidate(item, undefined, asOf);

  assert.equal(decision.status, 'private-candidate');
  assert.equal(decision.reason, 'missing-approval');
  assert.equal(gateExternalCatalogue([item], {
    schemaVersion: externalCatalogueApprovalSchemaVersion,
    approvals: [],
  }, asOf).approvedCount, 0);
});

test('the legacy approval schema fails closed after exact-offer evidence changed', () => {
  assert.throws(
    () => gateExternalCatalogue([candidate()], { schemaVersion: 1, approvals: [] } as never, asOf),
    /Unsupported external catalogue approval schema/,
  );
});

test('an identity-bound licensed original photograph can pass the public gate', () => {
  const item = candidate();
  const decision = evaluateExternalCatalogueCandidate(item, approval(item), asOf);

  assert.equal(decision.status, 'approved');
  assert.equal(decision.reason, 'approved');
  assert.equal(decision.quality.dimensions.presentation, 20);
});

test('a magazine-ready styled composite can pass when the package remains exact and manually checked', () => {
  const item = candidate({ imageTreatment: 'identity-verified-styled-composite' });
  const base = approval(item);
  const styled: ExternalCatalogueApproval = {
    ...base,
    asset: {
      ...base.asset,
      origin: 'identity-verified-styled-composite',
      backgroundTreatment: 'styled-composite',
      publicImageUrl: 'https://assets.example/catalogue/example-editorial.webp',
      publicImageSha256: hashB,
    },
  };

  assert.equal(evaluateExternalCatalogueCandidate(item, styled, asOf).status, 'approved');
});

test('approval cannot survive a candidate or image change', () => {
  const item = candidate();
  const stale = approval(item);
  const changed = candidate({ name: 'Changed Lotion' });

  assert.equal(evaluateExternalCatalogueCandidate(changed, stale, asOf).reason, 'approval-binding-mismatch');
});

test('regulatory status is context while insufficient Nigerian offers remain private', () => {
  const item = candidate();
  const base = approval(item);
  const pending: ExternalCatalogueApproval = {
    ...base,
    nigeria: { ...base.nigeria, regulatoryStatus: 'pending' },
  };
  const oneOffer: ExternalCatalogueApproval = {
    ...base,
    nigeria: { ...base.nigeria, exactOffers: base.nigeria.exactOffers.slice(0, 1) },
  };

  assert.equal(evaluateExternalCatalogueCandidate(item, pending, asOf).reason, 'approved');
  assert.equal(evaluateExternalCatalogueCandidate(item, oneOffer, asOf).reason, 'nigeria-market-evidence-insufficient');
});

test('brand-confirmed Nigerian authorization can support one fresh exact offer', () => {
  const item = candidate({ brand: 'CeraVe' });
  const base = approval(item);
  const brandRoute: ExternalCatalogueApproval = {
    ...base,
    sku: {
      ...base.sku,
      evidenceUrl: 'https://uk.lorealdermatologicalbeautypartnershop.com/on/demandware.static/catalogue.pdf',
    },
    nigeria: {
      ...base.nigeria,
      tierAIdentityEvidenceUrl: undefined,
      brandAuthorizationEvidenceUrl: 'https://africa.cerave.com/en/find-your-nearest-store',
      exactOffers: [withOfferEvidence({
        ...base.nigeria.exactOffers[0],
        retailer: 'Medplus',
        listingUrl: 'https://medplusnig.com/products/example',
      })],
    },
  };

  assert.equal(evaluateExternalCatalogueCandidate(item, brandRoute, asOf).status, 'approved');
});

test('brand authorization is bound to both the official brand host and the named seller', () => {
  const item = candidate({ brand: 'CeraVe' });
  const base = approval(item);
  const officialSku = {
    ...base.sku,
    evidenceUrl: 'https://uk.lorealdermatologicalbeautypartnershop.com/on/demandware.static/catalogue.pdf',
  };
  const medplusOffer = withOfferEvidence({
    ...base.nigeria.exactOffers[0],
    retailer: 'Medplus',
    listingUrl: 'https://medplusnig.com/products/example',
  });
  const spoofedAuthorization: ExternalCatalogueApproval = {
    ...base,
    sku: officialSku,
    nigeria: {
      ...base.nigeria,
      tierAIdentityEvidenceUrl: undefined,
      brandAuthorizationEvidenceUrl: 'https://cerave.attacker.example/nigeria/authorized',
      exactOffers: [medplusOffer],
    },
  };
  const spoofedSkuSource: ExternalCatalogueApproval = {
    ...base,
    sku: {
      ...officialSku,
      evidenceUrl: 'https://attacker.example/fake-sku',
    },
    nigeria: {
      ...base.nigeria,
      tierAIdentityEvidenceUrl: undefined,
      brandAuthorizationEvidenceUrl: 'https://africa.cerave.com/en/find-your-nearest-store',
      exactOffers: [medplusOffer],
    },
  };
  const unboundSeller: ExternalCatalogueApproval = {
    ...base,
    sku: officialSku,
    nigeria: {
      ...base.nigeria,
      tierAIdentityEvidenceUrl: undefined,
      brandAuthorizationEvidenceUrl: 'https://africa.cerave.com/en/find-your-nearest-store',
      exactOffers: [base.nigeria.exactOffers[0]],
    },
  };

  assert.equal(evaluateExternalCatalogueCandidate(item, spoofedAuthorization, asOf).reason, 'nigeria-market-evidence-insufficient');
  assert.equal(evaluateExternalCatalogueCandidate(item, spoofedSkuSource, asOf).reason, 'exact-sku-not-approved');
  assert.equal(evaluateExternalCatalogueCandidate(item, unboundSeller, asOf).reason, 'nigeria-market-evidence-insufficient');
});

test('Tier-A market evidence must reuse the exact SKU identity source', () => {
  const item = candidate();
  const base = approval(item);
  const unbound: ExternalCatalogueApproval = {
    ...base,
    nigeria: {
      ...base.nigeria,
      tierAIdentityEvidenceUrl: 'https://identity.example/products/4005808319695',
    },
  };

  assert.equal(evaluateExternalCatalogueCandidate(item, unbound, asOf).reason, 'nigeria-market-evidence-insufficient');
});

test('retailer identifiers and sibling GTINs never count as exact Nigerian offers', () => {
  const item = candidate();
  const base = approval(item);
  const siblingGtin: ExternalCatalogueApproval = {
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({
        ...offer,
        observedGtin: '3337875597333',
      })),
    },
  };
  const retailerSku: ExternalCatalogueApproval = {
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({
        ...offer,
        observedGtinBasis: 'retailer-sku' as ExternalCatalogueApproval['nigeria']['exactOffers'][number]['observedGtinBasis'],
      })),
    },
  };

  assert.equal(evaluateExternalCatalogueCandidate(item, siblingGtin, asOf).reason, 'nigeria-market-evidence-insufficient');
  assert.equal(evaluateExternalCatalogueCandidate(item, retailerSku, asOf).reason, 'nigeria-market-evidence-insufficient');
});

test('legacy exact offers require the same reviewed representation and explicit label evidence', () => {
  const item = candidate();
  const base = approval(item);
  const bare: ExternalCatalogueApproval = {
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({ ...offer, evidence: undefined })),
    },
  };
  const skuLabel: ExternalCatalogueApproval = {
    ...base,
    nigeria: {
      ...base.nigeria,
      exactOffers: base.nigeria.exactOffers.map(offer => ({
        ...offer,
        evidence: {
          ...offer.evidence!,
          fields: {
            ...offer.evidence!.fields,
            gtin: {
              ...offer.evidence!.fields.gtin,
              locator: 'HTML retailer SKU row',
              sourceText: `SKU ${offer.observedGtin}`,
            },
          },
        },
      })),
    },
  };

  assert.equal(evaluateExternalCatalogueCandidate(item, bare, asOf).reason, 'nigeria-market-evidence-insufficient');
  assert.equal(evaluateExternalCatalogueCandidate(item, skuLabel, asOf).reason, 'nigeria-market-evidence-insufficient');
});

test('legacy approvals cannot predate bound market or regulatory evidence', () => {
  const item = candidate();
  const early = approval(item, { approvedAt: '2026-07-22T09:15:00Z' });

  assert.equal(evaluateExternalCatalogueCandidate(item, early, asOf).reason, 'invalid-approval');
});

test('a raw automated cutout is never public even with an otherwise valid approval', () => {
  const item = candidate({ imageTreatment: 'source-faithful-background-extraction' });
  const decision = evaluateExternalCatalogueCandidate(item, approval(item), asOf);

  assert.equal(decision.status, 'private-candidate');
  assert.equal(decision.reason, 'automated-background-removal');
});

test('non-empty legacy approval manifests are hard-disabled', () => {
  const item = candidate({ imageTreatment: 'source-faithful-background-extraction' });
  const base = approval(item);
  const styled: ExternalCatalogueApproval = {
    ...base,
    asset: {
      ...base.asset,
      origin: 'identity-verified-styled-composite',
      backgroundTreatment: 'styled-composite',
      publicImageUrl: 'https://assets.example/catalogue/example-editorial.webp',
      publicImageSha256: hashB,
    },
  };
  assert.throws(
    () => gateExternalCatalogue([item], {
      schemaVersion: externalCatalogueApprovalSchemaVersion,
      approvals: [styled],
    }, asOf),
    /External catalogue publication is disabled/,
  );
});
