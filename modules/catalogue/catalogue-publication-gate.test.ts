import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewedProductRecords } from '@/data/catalogue';
import {
  assessCatalogueQuality,
  catalogueApprovalScope,
  evaluateExternalCatalogueCandidate,
  externalCandidateFingerprint,
  gateExternalCatalogue,
  type ExternalCatalogueApproval,
  type ExternalCatalogueGateCandidate,
} from '@/lib/catalogue/catalogue-publication-gate';
import { auditReviewedProductQuality } from '@/lib/catalogue/reviewed-product-quality';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const asOf = Date.parse('2026-07-22T12:00:00Z');

function candidate(overrides: Partial<ExternalCatalogueGateCandidate> = {}): ExternalCatalogueGateCandidate {
  return {
    source: 'open-beauty-facts',
    sourceProductId: '4005808319695',
    barcode: '4005808319695',
    brand: 'Example',
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
    approvedAt: '2026-07-22T10:00:00Z',
    reviewer: 'Catalogue reviewer',
    scope: catalogueApprovalScope,
    catalogueFit: 'Recognizable product with a deliberate catalogue role.',
    sku: {
      status: 'exact',
      barcode: item.barcode,
      variant: item.name,
      size: item.quantity,
      evidenceUrl: item.sourceUrl,
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
      regulatoryEvidenceUrl: 'https://regulator.example/products/4005808319695',
      tierAIdentityEvidenceUrl: 'https://identity.example/products/4005808319695',
      exactOffers: [
        { retailer: 'Store One', listingUrl: 'https://store-one.example/products/example', observedAt: '2026-07-22T08:00:00Z', variant: item.name, size: item.quantity, priceNgn: 8_500, stock: 'in-stock' },
        { retailer: 'Store Two', listingUrl: 'https://store-two.example/products/example', observedAt: '2026-07-21T08:00:00Z', variant: item.name, size: item.quantity, priceNgn: 9_000, stock: 'low-stock' },
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
  assert.equal(gateExternalCatalogue([item], { schemaVersion: 1, approvals: [] }, asOf).approvedCount, 0);
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

test('regulatory pending status and insufficient Nigerian offers remain private', () => {
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

  assert.equal(evaluateExternalCatalogueCandidate(item, pending, asOf).reason, 'nigeria-regulatory-pending');
  assert.equal(evaluateExternalCatalogueCandidate(item, oneOffer, asOf).reason, 'nigeria-market-evidence-insufficient');
});

test('brand-confirmed Nigerian authorization can support one fresh exact offer', () => {
  const item = candidate();
  const base = approval(item);
  const brandRoute: ExternalCatalogueApproval = {
    ...base,
    nigeria: {
      ...base.nigeria,
      tierAIdentityEvidenceUrl: undefined,
      brandAuthorizationEvidenceUrl: 'https://brand.example/nigeria/authorized',
      exactOffers: base.nigeria.exactOffers.slice(0, 1),
    },
  };

  assert.equal(evaluateExternalCatalogueCandidate(item, brandRoute, asOf).status, 'approved');
});

test('a raw automated cutout is never public even with an otherwise valid approval', () => {
  const item = candidate({ imageTreatment: 'source-faithful-background-extraction' });
  const decision = evaluateExternalCatalogueCandidate(item, approval(item), asOf);

  assert.equal(decision.status, 'private-candidate');
  assert.equal(decision.reason, 'automated-background-removal');
});

test('a background-extracted package can be a private input to a distinct final styled composite', () => {
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
  const gated = gateExternalCatalogue([item], { schemaVersion: 1, approvals: [styled] }, asOf);

  assert.equal(gated.approvedCount, 1);
  assert.equal(gated.approved[0]?.canonicalImageUrl, styled.asset.publicImageUrl);
  assert.equal(gated.approved[0]?.imageSha256, styled.asset.publicImageSha256);
  assert.equal(gated.approved[0]?.imageTreatment, 'identity-verified-styled-composite');
  assert.equal(gated.approved[0]?.productionInputImageTreatment, 'source-faithful-background-extraction');
});
