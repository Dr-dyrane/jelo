import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import checkedInManifest from '@/data/catalogue-publication-dossiers.json';
import checkedInReleaseManifest from '@/data/catalogue-publication-releases.json';
import { catalogueIntakeCandidates } from '@/data/catalogue-intake';
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
  catalogueReferencePublicationApprovalScope,
  cataloguePublicationDossierSchemaVersion,
  cataloguePublicationExposure,
  createCataloguePublicationDossier,
  verifyCataloguePublicationDossierManifest,
  type CataloguePublicationApproval,
  type CataloguePublicationDossierManifest,
} from '@/lib/catalogue/publication-dossier';
import {
  cataloguePublicationReleaseApprovalScope,
  cataloguePublicationReleaseExposure,
  cataloguePublicationReleaseSchemaVersion,
  createCataloguePublicationRelease,
  verifyCataloguePublicationReleaseManifest,
  type CataloguePublicationPresentation,
  type CataloguePublicationReleaseApproval,
} from '@/lib/catalogue/publication-release';
import {
  catalogueExactOfferEvidenceSchemaVersion,
  catalogueRegulatoryEvidenceSchemaVersion,
  regulatoryEvidenceExcerptSha256,
  type ReviewedExactOfferEvidence,
  type ReviewedRegulatoryEvidence,
} from '@/lib/catalogue/market-evidence';
import { nigeriaRetailers } from '@/data/retailers';
import { getReviewedProductCare } from '@/data/product-care-review';
import { summarizeMarket } from '@/modules/commerce/market-summary';
import { evaluateProductClinically } from '@/modules/recommendations/clinical-product-filter';
import { assessClinicalRoutine } from '@/modules/clinical/core/engine';

const asOf = Date.parse('2026-07-22T17:05:00Z');
const finalHash = 'a'.repeat(64);
const sourceHash = 'b'.repeat(64);

function requireEntry<T>(
  entries: readonly T[],
  predicate: (entry: T) => boolean,
  label: string,
): T {
  const entry = entries.find(predicate);
  assert.ok(entry, `${label} is missing from the verified catalogue projection.`);
  return entry;
}

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

function presentation(overrides: Partial<CataloguePublicationPresentation> = {}): CataloguePublicationPresentation {
  return {
    category: 'Body',
    routineStep: 'Moisturize',
    displayLine: 'Moisturize · support',
    usage: 'Apply according to the reviewed manufacturer directions on the package.',
    manufacturerDirectionsUrl: 'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
    reviewer: 'Presentation reviewer',
    reviewedAt: '2026-07-22T16:10:00Z',
    ...overrides,
  };
}

function releaseApproval(
  overrides: Partial<CataloguePublicationReleaseApproval> = {},
): CataloguePublicationReleaseApproval {
  return {
    scope: cataloguePublicationReleaseApprovalScope,
    reviewer: 'Release reviewer',
    publishedAt: '2026-07-22T16:20:00Z',
    ...overrides,
  };
}

test('the checked-in publication manifest contains the verified neutral reference dossiers', () => {
  const result = verifyCataloguePublicationDossierManifest(catalogueIntakeCandidates, checkedInManifest, Date.now());
  const dossier = (candidateId: string) => requireEntry(
    result.dossiers,
    entry => entry.candidateId === candidateId,
    candidateId,
  );

  assert.equal(result.exposure, cataloguePublicationExposure);
  assert.equal(result.dossierCount, checkedInManifest.dossiers.length);
  assert.equal(result.publicProductCount, 0);
  assert.equal(dossier('cerave-hydrating-cleanser-473ml').candidateId, 'cerave-hydrating-cleanser-473ml');
  assert.equal(dossier('cerave-hydrating-cleanser-473ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('cerave-moisturising-cream-454g').candidateId, 'cerave-moisturising-cream-454g');
  assert.equal(dossier('cerave-moisturising-cream-454g').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('eucerin-oil-control-sun-gel-cream-spf50-50ml').candidateId, 'eucerin-oil-control-sun-gel-cream-spf50-50ml');
  assert.equal(dossier('eucerin-oil-control-sun-gel-cream-spf50-50ml').nigeria.marketRoute, 'tier-a');
  assert.equal(dossier('eucerin-oil-control-sun-gel-cream-spf50-50ml').nigeria.exactOffers.length, 2);
  assert.equal(dossier('eucerin-oil-control-sun-gel-cream-spf50-50ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('eucerin-urearepair-plus-10-urea-body-lotion-250ml').candidateId, 'eucerin-urearepair-plus-10-urea-body-lotion-250ml');
  assert.equal(dossier('eucerin-urearepair-plus-10-urea-body-lotion-250ml').nigeria.marketRoute, 'tier-a');
  assert.equal(dossier('eucerin-urearepair-plus-10-urea-body-lotion-250ml').nigeria.exactOffers.length, 2);
  assert.equal(dossier('eucerin-urearepair-plus-10-urea-body-lotion-250ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('eucerin-urearepair-plus-10-urea-body-lotion-250ml').rights.generationRecord?.outputSha256, dossier('eucerin-urearepair-plus-10-urea-body-lotion-250ml').finalImage.sha256);
  assert.equal(dossier('dove-melanin-even-tone-body-wash-18-5oz').candidateId, 'dove-melanin-even-tone-body-wash-18-5oz');
  assert.equal(dossier('dove-melanin-even-tone-body-wash-18-5oz').nigeria.marketRoute, 'tier-a');
  assert.equal(dossier('dove-melanin-even-tone-body-wash-18-5oz').nigeria.exactOffers.length, 2);
  assert.equal(dossier('dove-melanin-even-tone-body-wash-18-5oz').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('dove-melanin-even-tone-body-wash-18-5oz').rights.generationRecord?.outputSha256, dossier('dove-melanin-even-tone-body-wash-18-5oz').finalImage.sha256);
  assert.equal(dossier('keracare-dry-itchy-scalp-conditioner-950ml').candidateId, 'keracare-dry-itchy-scalp-conditioner-950ml');
  assert.equal(dossier('keracare-dry-itchy-scalp-conditioner-950ml').nigeria.marketRoute, 'tier-a');
  assert.equal(dossier('keracare-dry-itchy-scalp-conditioner-950ml').nigeria.exactOffers.length, 2);
  assert.equal(dossier('keracare-dry-itchy-scalp-conditioner-950ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('keracare-dry-itchy-scalp-conditioner-950ml').rights.generationRecord?.outputSha256, dossier('keracare-dry-itchy-scalp-conditioner-950ml').finalImage.sha256);
  assert.equal(dossier('balance-salicylic-acid-zinc-clarifying-toner-200ml').candidateId, 'balance-salicylic-acid-zinc-clarifying-toner-200ml');
  assert.equal(dossier('balance-salicylic-acid-zinc-clarifying-toner-200ml').nigeria.marketRoute, 'tier-a');
  assert.equal(dossier('balance-salicylic-acid-zinc-clarifying-toner-200ml').nigeria.exactOffers.length, 2);
  assert.equal(dossier('balance-salicylic-acid-zinc-clarifying-toner-200ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('balance-salicylic-acid-zinc-clarifying-toner-200ml').rights.generationRecord?.outputSha256, dossier('balance-salicylic-acid-zinc-clarifying-toner-200ml').finalImage.sha256);
  const beautyFormulasDossier = result.dossiers.find(dossier => (
    dossier.candidateId === 'beauty-formulas-glowing-serum-2-vitamin-c-30ml'
  ));
  assert.ok(beautyFormulasDossier);
  assert.equal(beautyFormulasDossier.nigeria.exactOffers.length, 2);
  const faceFactsDossier = result.dossiers.find(dossier => (
    dossier.candidateId === 'facefacts-ceramide-moisturising-gel-cream-50ml'
  ));
  assert.ok(faceFactsDossier);
  assert.equal(faceFactsDossier.candidateId, 'facefacts-ceramide-moisturising-gel-cream-50ml');
  assert.ok('gtin' in faceFactsDossier.identity);
  assert.equal(faceFactsDossier.identity.gtin, '5031413928570');
  assert.equal(faceFactsDossier.identity.name, 'Ceramide Moisturising Gel Cream');
  assert.equal(faceFactsDossier.identity.size, '50 ml');
  assert.equal(faceFactsDossier.nigeria.marketRoute, 'tier-a');
  assert.deepEqual(
    faceFactsDossier.nigeria.exactOffers.map(offer => ({
      retailer: offer.retailer,
      priceNgn: offer.priceNgn,
      stock: offer.stock,
    })),
    [
      { retailer: 'BuyBetter', priceNgn: 3_440, stock: 'out-of-stock' },
      { retailer: 'CSi Grocery', priceNgn: 3_600, stock: 'in-stock' },
    ],
  );
  const zaronDossier = result.dossiers.find(dossier => (
    dossier.candidateId === 'skin-by-zaron-vitamin-c-body-wash-650ml'
  ));
  assert.ok(zaronDossier);
  assert.equal(zaronDossier.nigeria.marketRoute, 'tier-a');
  assert.equal(zaronDossier.nigeria.exactOffers.length, 2);
  assert.equal(zaronDossier.rights.generationRecord?.outputSha256, zaronDossier.finalImage.sha256);
  assert.equal(
    faceFactsDossier.finalImage.sha256,
    '0eb13b51e08b874ad74f707f86c809e035962d27288acadf3167dbeeb87bff54',
  );
  assert.equal(
    faceFactsDossier.rights.generationRecord?.outputSha256,
    faceFactsDossier.finalImage.sha256,
  );
  assert.equal(dossier('cerave-acne-foaming-cream-wash-10-150ml').candidateId, 'cerave-acne-foaming-cream-wash-10-150ml');
  assert.equal(dossier('cerave-acne-foaming-cream-wash-10-150ml').nigeria.marketRoute, 'tier-a');
  assert.equal(dossier('cerave-acne-foaming-cream-wash-10-150ml').nigeria.exactOffers.length, 2);
  assert.equal(dossier('cerave-acne-foaming-cream-wash-10-150ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('cerave-acne-foaming-cream-wash-10-150ml').rights.generationRecord?.outputSha256, dossier('cerave-acne-foaming-cream-wash-10-150ml').finalImage.sha256);
  assert.equal(dossier('de-la-cruz-acne-treatment-10-sulfur-73-7g').candidateId, 'de-la-cruz-acne-treatment-10-sulfur-73-7g');
  assert.equal(dossier('de-la-cruz-acne-treatment-10-sulfur-73-7g').nigeria.exactOffers.length, 2);
  assert.equal(dossier('olay-super-serum-body-wash-normal-skin-547ml').candidateId, 'olay-super-serum-body-wash-normal-skin-547ml');
  assert.equal(dossier('olay-super-serum-body-wash-normal-skin-547ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('olay-super-serum-body-wash-normal-skin-547ml').nigeria.exactOffers.map(offer => offer.priceNgn), [20_963, 21_200]);
  assert.equal(dossier('olay-super-serum-body-wash-normal-skin-547ml').rights.generationRecord?.outputSha256, dossier('olay-super-serum-body-wash-normal-skin-547ml').finalImage.sha256);
  assert.equal(dossier('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').candidateId, 'sheamoisture-jamaican-black-castor-oil-shampoo-384ml');
  assert.equal(dossier('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').nigeria.exactOffers.map(offer => offer.priceNgn), [12_685, 13_300]);
  assert.equal(dossier('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').rights.generationRecord?.outputSha256, dossier('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').finalImage.sha256);
  assert.equal(dossier('tresemme-keratin-smooth-weightless-conditioner-828ml').candidateId, 'tresemme-keratin-smooth-weightless-conditioner-828ml');
  assert.equal(dossier('tresemme-keratin-smooth-weightless-conditioner-828ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('tresemme-keratin-smooth-weightless-conditioner-828ml').nigeria.exactOffers.map(offer => offer.priceNgn), [7_950, 9_138, 9_900]);
  assert.equal(dossier('tresemme-keratin-smooth-weightless-conditioner-828ml').rights.generationRecord, undefined);
  assert.equal(dossier('laroche-posay-mela-b3-serum-30ml').candidateId, 'laroche-posay-mela-b3-serum-30ml');
  assert.equal(dossier('laroche-posay-mela-b3-serum-30ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('laroche-posay-mela-b3-serum-30ml').nigeria.exactOffers.map(offer => offer.priceNgn), [48_500, 44_700]);
  assert.equal(dossier('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').candidateId, 'anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml');
  assert.equal(dossier('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').nigeria.exactOffers.map(offer => offer.priceNgn), [18_000, 16_999]);
  assert.equal(dossier('facefacts-ceramide-blemish-gel-moisturiser-50ml').candidateId, 'facefacts-ceramide-blemish-gel-moisturiser-50ml');
  assert.equal(dossier('facefacts-ceramide-blemish-gel-moisturiser-50ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('facefacts-ceramide-blemish-gel-moisturiser-50ml').nigeria.exactOffers.map(offer => offer.priceNgn), [3_440, 3_500]);
  assert.equal(dossier('facefacts-ceramide-moisturising-gel-cream-50ml').candidateId, 'facefacts-ceramide-moisturising-gel-cream-50ml');
  assert.equal(dossier('facefacts-ceramide-moisturising-gel-cream-50ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('facefacts-ceramide-moisturising-gel-cream-50ml').nigeria.exactOffers.map(offer => offer.priceNgn), [3_440, 3_600]);
  assert.equal(dossier('skin-by-zaron-vitamin-c-body-wash-650ml').candidateId, 'skin-by-zaron-vitamin-c-body-wash-650ml');
  assert.equal(dossier('skin-by-zaron-vitamin-c-body-wash-650ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('skin-by-zaron-vitamin-c-body-wash-650ml').nigeria.exactOffers.map(offer => offer.priceNgn), [11_449, 12_500]);
  assert.equal(dossier('prequel-gleanser-glycolic-acid-cleanser-400ml').candidateId, 'prequel-gleanser-glycolic-acid-cleanser-400ml');
  assert.equal(dossier('prequel-gleanser-glycolic-acid-cleanser-400ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('prequel-gleanser-glycolic-acid-cleanser-400ml').nigeria.exactOffers.map(offer => offer.priceNgn), [37_088, 36_500]);
  assert.equal(dossier('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').candidateId, 'dr-teals-nourish-protect-coconut-oil-body-wash-710ml');
  assert.equal(dossier('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').nigeria.exactOffers.map(offer => offer.priceNgn), [7_150, 6_750]);
  assert.equal(dossier('cecred-moisturizing-deep-conditioner-300ml').candidateId, 'cecred-moisturizing-deep-conditioner-300ml');
  assert.equal(dossier('cecred-moisturizing-deep-conditioner-300ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('cecred-moisturizing-deep-conditioner-300ml').nigeria.exactOffers.map(offer => offer.priceNgn), [149_000, 144_750]);
  assert.equal(dossier('cerave-acne-foaming-cream-cleanser-4-150ml').candidateId, 'cerave-acne-foaming-cream-cleanser-4-150ml');
  assert.equal(dossier('cerave-acne-foaming-cream-cleanser-4-150ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('cerave-acne-foaming-cream-cleanser-4-150ml').nigeria.exactOffers.map(offer => offer.priceNgn), [23_500, 23_850]);
  assert.equal(dossier('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').candidateId, 'sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml');
  assert.equal(dossier('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').nigeria.exactOffers.map(offer => offer.priceNgn), [13_223, 14_100]);
  assert.equal(dossier('dove-calming-moisture-body-wash-547ml').candidateId, 'dove-calming-moisture-body-wash-547ml');
  assert.equal(dossier('dove-calming-moisture-body-wash-547ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('dove-calming-moisture-body-wash-547ml').nigeria.exactOffers.map(offer => offer.priceNgn), [17_800, 27_600]);
  assert.equal(dossier('dove-skin-replenish-serum-body-wash-547ml').candidateId, 'dove-skin-replenish-serum-body-wash-547ml');
  assert.equal(dossier('dove-skin-replenish-serum-body-wash-547ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('dove-skin-replenish-serum-body-wash-547ml').nigeria.exactOffers.map(offer => offer.priceNgn), [17_800, 24_500]);
  assert.equal(dossier('cerave-sa-smoothing-cleanser-473ml').candidateId, 'cerave-sa-smoothing-cleanser-473ml');
  assert.equal(dossier('cerave-sa-smoothing-cleanser-473ml').nigeria.marketRoute, 'tier-a');
  assert.equal(dossier('cerave-sa-smoothing-cleanser-473ml').nigeria.exactOffers.length, 2);
  assert.equal(dossier('cerave-sa-smoothing-cleanser-473ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('cerave-sa-smoothing-cleanser-473ml').rights.generationRecord?.outputSha256, dossier('cerave-sa-smoothing-cleanser-473ml').finalImage.sha256);
  assert.equal(dossier('garnier-vitamin-c-brightening-day-cream-50ml').candidateId, 'garnier-vitamin-c-brightening-day-cream-50ml');
  assert.equal(dossier('garnier-vitamin-c-brightening-day-cream-50ml').nigeria.marketRoute, 'tier-a');
  assert.equal(dossier('garnier-vitamin-c-brightening-day-cream-50ml').nigeria.exactOffers.length, 2);
  assert.equal(dossier('aqua-rich-ceramide-body-lotion-500ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('aqua-rich-ceramide-body-lotion-500ml').rights.generationRecord?.outputSha256, dossier('aqua-rich-ceramide-body-lotion-500ml').finalImage.sha256);
  assert.equal(dossier('aqua-rich-ceramide-body-lotion-500ml').candidateId, 'aqua-rich-ceramide-body-lotion-500ml');
  assert.equal(dossier('aqua-rich-ceramide-body-lotion-500ml').identity.name, 'Hydrate + Protect Body Lotion');
  assert.equal(dossier('aqua-rich-ceramide-body-lotion-500ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('aqua-rich-ceramide-body-lotion-500ml').nigeria.exactOffers.map(offer => offer.priceNgn), [11_288, 13_000]);
  assert.equal(dossier('aqua-rich-ceramide-body-lotion-500ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('aqua-rich-ceramide-body-lotion-500ml').rights.generationRecord?.outputSha256, dossier('aqua-rich-ceramide-body-lotion-500ml').finalImage.sha256);
  assert.equal(dossier('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').candidateId, 'aqua-rich-turmeric-vitamin-c-body-lotion-500ml');
  assert.equal(dossier('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').nigeria.exactOffers.map(offer => offer.priceNgn), [12_800, 12_000]);
  assert.equal(dossier('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').rights.generationRecord?.outputSha256, dossier('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').finalImage.sha256);
  assert.equal(dossier('balance-niacinamide-blemish-recovery-serum-30ml').candidateId, 'balance-niacinamide-blemish-recovery-serum-30ml');
  assert.equal(dossier('balance-niacinamide-blemish-recovery-serum-30ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('balance-niacinamide-blemish-recovery-serum-30ml').nigeria.exactOffers.map(offer => offer.priceNgn), [8_400, 10_700]);
  assert.equal(dossier('balance-niacinamide-blemish-recovery-serum-30ml').nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier('balance-niacinamide-blemish-recovery-serum-30ml').rights.generationRecord?.outputSha256, dossier('balance-niacinamide-blemish-recovery-serum-30ml').finalImage.sha256);
  assert.equal(dossier('nineless-a-control-10-azelaic-acid-serum-30ml').candidateId, 'nineless-a-control-10-azelaic-acid-serum-30ml');
  assert.equal(dossier('nineless-a-control-10-azelaic-acid-serum-30ml').identity.packageVersion, 'Original green dropper bottle');
  assert.equal(dossier('nineless-a-control-10-azelaic-acid-serum-30ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('nineless-a-control-10-azelaic-acid-serum-30ml').nigeria.exactOffers.map(offer => offer.priceNgn), [12_500, 14_500]);
  assert.equal(dossier('nineless-a-control-10-azelaic-acid-serum-30ml').rights.generationRecord?.outputSha256, dossier('nineless-a-control-10-azelaic-acid-serum-30ml').finalImage.sha256);
  assert.equal(dossier('nineless-mela-pro-rice-txa-toner-200ml').candidateId, 'nineless-mela-pro-rice-txa-toner-200ml');
  assert.equal(dossier('nineless-mela-pro-rice-txa-toner-200ml').identity.packageVersion, 'Original translucent bottle with orange cap');
  assert.equal(dossier('nineless-mela-pro-rice-txa-toner-200ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('nineless-mela-pro-rice-txa-toner-200ml').nigeria.exactOffers.map(offer => offer.priceNgn), [15_500, 19_000]);
  assert.equal(dossier('nineless-mela-pro-rice-txa-toner-200ml').rights.generationRecord?.outputSha256, dossier('nineless-mela-pro-rice-txa-toner-200ml').finalImage.sha256);
  assert.equal(dossier('facefacts-ceramide-oil-control-foaming-cleanser-400ml').candidateId, 'facefacts-ceramide-oil-control-foaming-cleanser-400ml');
  assert.equal(dossier('facefacts-ceramide-oil-control-foaming-cleanser-400ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('facefacts-ceramide-oil-control-foaming-cleanser-400ml').nigeria.exactOffers.map(offer => offer.priceNgn), [7_500, 7_300]);
  assert.equal(dossier('facefacts-ceramide-oil-control-foaming-cleanser-400ml').rights.generationRecord?.outputSha256, dossier('facefacts-ceramide-oil-control-foaming-cleanser-400ml').finalImage.sha256);
  assert.equal(dossier('facefacts-ceramide-hydrating-gentle-cleanser-400ml').candidateId, 'facefacts-ceramide-hydrating-gentle-cleanser-400ml');
  assert.equal(dossier('facefacts-ceramide-hydrating-gentle-cleanser-400ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('facefacts-ceramide-hydrating-gentle-cleanser-400ml').nigeria.exactOffers.map(offer => offer.priceNgn), [6_950, 7_200, 7_300]);
  assert.equal(dossier('facefacts-ceramide-hydrating-gentle-cleanser-400ml').rights.generationRecord?.outputSha256, dossier('facefacts-ceramide-hydrating-gentle-cleanser-400ml').finalImage.sha256);
  assert.equal(dossier('facefacts-ceramide-foaming-cleanser-400ml').candidateId, 'facefacts-ceramide-foaming-cleanser-400ml');
  assert.equal(dossier('facefacts-ceramide-foaming-cleanser-400ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('facefacts-ceramide-foaming-cleanser-400ml').nigeria.exactOffers.map(offer => offer.priceNgn), [6_450, 6_800]);
  assert.equal(dossier('facefacts-ceramide-foaming-cleanser-400ml').rights.generationRecord?.outputSha256, dossier('facefacts-ceramide-foaming-cleanser-400ml').finalImage.sha256);
  assert.equal(dossier('facefacts-vitamin-c-body-lotion-400ml').candidateId, 'facefacts-vitamin-c-body-lotion-400ml');
  assert.equal(dossier('facefacts-vitamin-c-body-lotion-400ml').nigeria.marketRoute, 'tier-a');
  assert.deepEqual(dossier('facefacts-vitamin-c-body-lotion-400ml').nigeria.exactOffers.map(offer => offer.priceNgn), [6_095, 8_000]);
  assert.equal(dossier('facefacts-vitamin-c-body-lotion-400ml').rights.generationRecord?.outputSha256, dossier('facefacts-vitamin-c-body-lotion-400ml').finalImage.sha256);
});

test('an approval-ready exact SKU compiles into one immutable source-agnostic private dossier', () => {
  const candidate = readyCandidate();
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);

  assert.equal(dossier.exposure, 'private-only');
  assert.equal(dossier.publicationScope, 'neutral-reference');
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
  assert.equal(dossier.nigeria.regulatoryEvidence?.authority, 'NAFDAC');
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

test('a neutral reference can publish while Nigerian regulation remains explicitly pending', () => {
  const base = readyCandidate();
  const candidate = readyCandidate({
    nigeria: {
      ...base.nigeria,
      regulatoryStatus: 'pending',
      regulatoryEvidence: undefined,
    },
  });
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);

  assert.equal(dossier.publicationScope, 'neutral-reference');
  assert.equal(dossier.recommendationEligible, false);
  assert.equal(dossier.nigeria.regulatoryStatus, 'pending');
  assert.equal(dossier.nigeria.regulatoryEvidence, undefined);
  assert.equal(dossier.nigeria.exactOffers.length, 1);
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

test('a reference-only dossier may publish a fully reviewed product without market claims', () => {
  const candidate = readyCandidate({
    nigeria: {
      regulatoryStatus: 'pending',
      tierAIdentityEvidenceUrl: 'https://africa.cerave.com/en/our-products/moisturizers/moisturising-cream',
      exactOffers: [],
      excludedObservations: [],
    },
  });
  const dossier = createCataloguePublicationDossier(
    candidate,
    approval({ scope: catalogueReferencePublicationApprovalScope }),
    asOf,
  );

  assert.equal(dossier.nigeria.marketRoute, 'reference-only');
  assert.deepEqual(dossier.nigeria.exactOffers, []);
  assert.deepEqual(dossier.nigeria.brandSellerAuthorizationEvidence, []);
});

test('reference-only publication cannot bypass non-market blockers', () => {
  const candidate = readyCandidate({
    care: {
      status: 'pending',
      formulaArchetype: '',
      careTier: 'daily-care',
      reviewScope: 'catalogue-supportive-care',
      advisoryBoundary: '',
      manufacturerEvidenceUrl: '',
      independentClinicalGuidanceUrl: '',
      evidenceUrls: [],
      reviewedAt: '',
      reviewer: '',
    },
    nigeria: {
      regulatoryStatus: 'pending',
      exactOffers: [],
      excludedObservations: [],
    },
  });

  assert.throws(
    () => createCataloguePublicationDossier(
      candidate,
      approval({ scope: catalogueReferencePublicationApprovalScope }),
      asOf,
    ),
    /not approval-ready.*care/,
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
    () => verifyCataloguePublicationDossierManifest([candidate, duplicate], {
      schemaVersion: cataloguePublicationDossierSchemaVersion,
      exposure: cataloguePublicationExposure,
      dossiers: [],
    }, asOf),
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

test('the checked-in release manifest explicitly publishes the verified neutral references', () => {
  const report = verifyCataloguePublicationReleaseManifest(
    catalogueIntakeCandidates,
    checkedInManifest,
    checkedInReleaseManifest,
    Date.now(),
  );
  const product = (slug: string) => requireEntry(
    report.products,
    entry => entry.slug === slug,
    slug,
  );

  assert.equal(report.schemaVersion, cataloguePublicationReleaseSchemaVersion);
  assert.equal(report.exposure, cataloguePublicationReleaseExposure);
  assert.equal(report.releaseCount, checkedInReleaseManifest.releases.length);
  assert.deepEqual(
    report.products.find(product => (
      product.slug === 'dang-hydra-glow-sun-protection-gel-60ml'
    ))?.offers,
    [],
  );
  assert.deepEqual(
    report.products.find(product => (
      product.slug === 'facefacts-soothe-glow-niacinamide-serum-30ml'
    ))?.offers,
    [],
  );
  assert.equal(product('cerave-hydrating-cleanser-473ml').slug, 'cerave-hydrating-cleanser-473ml');
  assert.equal(product('cerave-hydrating-cleanser-473ml').offers[0].priceNgn, 15_265);
  assert.equal(product('cerave-moisturising-cream-454g').slug, 'cerave-moisturising-cream-454g');
  assert.equal(product('cerave-moisturising-cream-454g').offers[0].priceNgn, 22_500);
  assert.equal(product('eucerin-oil-control-sun-gel-cream-spf50-50ml').slug, 'eucerin-oil-control-sun-gel-cream-spf50-50ml');
  assert.equal(product('eucerin-oil-control-sun-gel-cream-spf50-50ml').offers[0].retailer, 'Beauty by Daz');
  assert.equal(product('eucerin-oil-control-sun-gel-cream-spf50-50ml').offers[0].priceNgn, 19_100);
  assert.equal(product('eucerin-oil-control-sun-gel-cream-spf50-50ml').offers[0].available, true);
  assert.equal(product('eucerin-oil-control-sun-gel-cream-spf50-50ml').offers[1].retailer, 'Nectar Beauty Hub');
  assert.equal(product('eucerin-oil-control-sun-gel-cream-spf50-50ml').offers[1].priceNgn, 17_363);
  assert.equal(product('eucerin-oil-control-sun-gel-cream-spf50-50ml').offers[1].available, false);
  assert.equal(product('eucerin-urearepair-plus-10-urea-body-lotion-250ml').slug, 'eucerin-urearepair-plus-10-urea-body-lotion-250ml');
  assert.equal(product('eucerin-urearepair-plus-10-urea-body-lotion-250ml').category, 'Body');
  assert.equal(product('eucerin-urearepair-plus-10-urea-body-lotion-250ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('eucerin-urearepair-plus-10-urea-body-lotion-250ml').offers[0].priceNgn, 25_000);
  assert.equal(product('eucerin-urearepair-plus-10-urea-body-lotion-250ml').offers[0].available, false);
  assert.equal(product('eucerin-urearepair-plus-10-urea-body-lotion-250ml').offers[1].retailer, 'Nectar Beauty Hub');
  assert.equal(product('eucerin-urearepair-plus-10-urea-body-lotion-250ml').offers[1].priceNgn, 27_000);
  assert.equal(product('eucerin-urearepair-plus-10-urea-body-lotion-250ml').offers[1].available, true);
  assert.equal(product('dove-melanin-even-tone-body-wash-18-5oz').slug, 'dove-melanin-even-tone-body-wash-18-5oz');
  assert.equal(product('dove-melanin-even-tone-body-wash-18-5oz').category, 'Body');
  assert.equal(product('dove-melanin-even-tone-body-wash-18-5oz').step, 'Cleanse');
  assert.equal(product('dove-melanin-even-tone-body-wash-18-5oz').offers[0].retailer, 'BuyBetter');
  assert.equal(product('dove-melanin-even-tone-body-wash-18-5oz').offers[0].priceNgn, 22_600);
  assert.equal(product('dove-melanin-even-tone-body-wash-18-5oz').offers[0].available, true);
  assert.equal(product('dove-melanin-even-tone-body-wash-18-5oz').offers[1].retailer, 'Perona Beauty');
  assert.equal(product('dove-melanin-even-tone-body-wash-18-5oz').offers[1].priceNgn, 20_000);
  assert.equal(product('dove-melanin-even-tone-body-wash-18-5oz').offers[1].available, true);
  assert.equal(product('keracare-dry-itchy-scalp-conditioner-950ml').slug, 'keracare-dry-itchy-scalp-conditioner-950ml');
  assert.equal(product('keracare-dry-itchy-scalp-conditioner-950ml').category, 'Hair');
  assert.equal(product('keracare-dry-itchy-scalp-conditioner-950ml').step, 'Condition');
  assert.equal(product('keracare-dry-itchy-scalp-conditioner-950ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('keracare-dry-itchy-scalp-conditioner-950ml').offers[0].priceNgn, 38_485);
  assert.equal(product('keracare-dry-itchy-scalp-conditioner-950ml').offers[0].available, false);
  assert.equal(product('keracare-dry-itchy-scalp-conditioner-950ml').offers[1].retailer, 'Ediths Essentials');
  assert.equal(product('keracare-dry-itchy-scalp-conditioner-950ml').offers[1].priceNgn, 43_485);
  assert.equal(product('keracare-dry-itchy-scalp-conditioner-950ml').offers[1].available, true);
  assert.equal(product('balance-salicylic-acid-zinc-clarifying-toner-200ml').slug, 'balance-salicylic-acid-zinc-clarifying-toner-200ml');
  const beautyFormulasProduct = report.products.find(product => (
    product.slug === 'beauty-formulas-glowing-serum-2-vitamin-c-30ml'
  ));
  assert.ok(beautyFormulasProduct);
  assert.equal(beautyFormulasProduct.offers.length, 2);
  const faceFactsProduct = report.products.find(product => (
    product.slug === 'facefacts-ceramide-moisturising-gel-cream-50ml'
  ));
  assert.ok(faceFactsProduct);
  assert.equal(faceFactsProduct.name, 'Ceramide Moisturising Gel Cream');
  assert.equal(faceFactsProduct.size, '50 ml');
  assert.equal(faceFactsProduct.category, 'Face');
  assert.equal(faceFactsProduct.step, 'Moisturize');
  assert.equal(faceFactsProduct.displayLine, 'Lightweight fragrance-free moisture.');
  assert.deepEqual(
    faceFactsProduct.offers.map(offer => ({
      retailer: offer.retailer,
      priceNgn: offer.priceNgn,
      available: offer.available,
    })),
    [
      { retailer: 'BuyBetter', priceNgn: 3_440, available: false },
      { retailer: 'CSi Grocery', priceNgn: 3_600, available: true },
    ],
  );
  const simpleRichMoisturiser = report.products.find(product => (
    product.slug === 'c28f590dd2739ea73f1b5ea3'
  ));
  assert.ok(simpleRichMoisturiser);
  assert.equal(simpleRichMoisturiser.name, 'Kind to Skin Replenishing Rich Moisturiser');
  assert.equal(simpleRichMoisturiser.step, 'Moisturize');
  const zaronProduct = report.products.find(product => (
    product.slug === 'skin-by-zaron-vitamin-c-body-wash-650ml'
  ));
  assert.ok(zaronProduct);
  assert.equal(zaronProduct.category, 'Body');
  assert.equal(zaronProduct.step, 'Cleanse');
  assert.equal(zaronProduct.displayLine, 'Vitamin C body wash · 650 ml');
  assert.deepEqual(
    zaronProduct.offers.map(offer => ({
      retailer: offer.retailer,
      priceNgn: offer.priceNgn,
      available: offer.available,
    })),
    [
      { retailer: 'BuyBetter', priceNgn: 11_449, available: true },
      { retailer: 'CSi Grocery', priceNgn: 12_500, available: true },
    ],
  );
  assert.equal(product('balance-salicylic-acid-zinc-clarifying-toner-200ml').category, 'Face');
  assert.equal(product('balance-salicylic-acid-zinc-clarifying-toner-200ml').step, 'Tone');
  assert.equal(product('balance-salicylic-acid-zinc-clarifying-toner-200ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('balance-salicylic-acid-zinc-clarifying-toner-200ml').offers[0].priceNgn, 8_400);
  assert.equal(product('balance-salicylic-acid-zinc-clarifying-toner-200ml').offers[0].available, true);
  assert.equal(product('balance-salicylic-acid-zinc-clarifying-toner-200ml').offers[1].retailer, '24Eleven');
  assert.equal(product('balance-salicylic-acid-zinc-clarifying-toner-200ml').offers[1].priceNgn, 9_200);
  assert.equal(product('balance-salicylic-acid-zinc-clarifying-toner-200ml').offers[1].available, true);
  assert.equal(product('cerave-acne-foaming-cream-wash-10-150ml').slug, 'cerave-acne-foaming-cream-wash-10-150ml');
  assert.equal(product('cerave-acne-foaming-cream-wash-10-150ml').category, 'Face');
  assert.equal(product('cerave-acne-foaming-cream-wash-10-150ml').step, 'Cleanse');
  assert.equal(product('cerave-acne-foaming-cream-wash-10-150ml').offers[0].retailer, 'Beauty by Daz');
  assert.equal(product('cerave-acne-foaming-cream-wash-10-150ml').offers[0].priceNgn, 23_850);
  assert.equal(product('cerave-acne-foaming-cream-wash-10-150ml').offers[0].available, true);
  assert.equal(product('cerave-acne-foaming-cream-wash-10-150ml').offers[1].retailer, 'Teeka4');
  assert.equal(product('cerave-acne-foaming-cream-wash-10-150ml').offers[1].priceNgn, 24_500);
  assert.equal(product('cerave-acne-foaming-cream-wash-10-150ml').offers[1].available, true);
  assert.equal(product('cerave-sa-smoothing-cleanser-473ml').slug, 'cerave-sa-smoothing-cleanser-473ml');
  assert.equal(product('cerave-sa-smoothing-cleanser-473ml').category, 'Face');
  assert.equal(product('cerave-sa-smoothing-cleanser-473ml').step, 'Cleanse');
  assert.equal(product('cerave-sa-smoothing-cleanser-473ml').offers[0].retailer, 'Teeka4');
  assert.equal(product('cerave-sa-smoothing-cleanser-473ml').offers[0].priceNgn, 20_900);
  assert.equal(product('cerave-sa-smoothing-cleanser-473ml').offers[0].available, true);
  assert.equal(product('cerave-sa-smoothing-cleanser-473ml').offers[1].retailer, '24Eleven');
  assert.equal(product('cerave-sa-smoothing-cleanser-473ml').offers[1].priceNgn, 23_800);
  assert.equal(product('cerave-sa-smoothing-cleanser-473ml').offers[1].available, true);
  assert.equal(product('garnier-vitamin-c-brightening-day-cream-50ml').slug, 'garnier-vitamin-c-brightening-day-cream-50ml');
  assert.equal(product('garnier-vitamin-c-brightening-day-cream-50ml').category, 'Face');
  assert.equal(product('garnier-vitamin-c-brightening-day-cream-50ml').step, 'Moisturize');
  assert.equal(product('garnier-vitamin-c-brightening-day-cream-50ml').offers[0].retailer, 'Care to Beauty');
  assert.equal(product('garnier-vitamin-c-brightening-day-cream-50ml').offers[0].priceNgn, 17_253.98);
  assert.equal(product('garnier-vitamin-c-brightening-day-cream-50ml').offers[0].available, true);
  assert.equal(product('garnier-vitamin-c-brightening-day-cream-50ml').offers[1].retailer, 'Teeka4');
  assert.equal(product('garnier-vitamin-c-brightening-day-cream-50ml').offers[1].priceNgn, 11_833);
  assert.equal(product('garnier-vitamin-c-brightening-day-cream-50ml').offers[1].available, true);
  assert.equal(product('aqua-rich-ceramide-body-lotion-500ml').slug, 'aqua-rich-ceramide-body-lotion-500ml');
  assert.equal(product('aqua-rich-ceramide-body-lotion-500ml').category, 'Body');
  assert.equal(product('aqua-rich-ceramide-body-lotion-500ml').step, 'Moisturize');
  assert.equal(product('aqua-rich-ceramide-body-lotion-500ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('aqua-rich-ceramide-body-lotion-500ml').offers[0].priceNgn, 11_288);
  assert.equal(product('aqua-rich-ceramide-body-lotion-500ml').offers[0].available, false);
  assert.equal(product('aqua-rich-ceramide-body-lotion-500ml').offers[1].retailer, 'CSi Grocery');
  assert.equal(product('aqua-rich-ceramide-body-lotion-500ml').offers[1].priceNgn, 13_000);
  assert.equal(product('aqua-rich-ceramide-body-lotion-500ml').offers[1].available, true);
  assert.equal(product('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').slug, 'aqua-rich-turmeric-vitamin-c-body-lotion-500ml');
  assert.equal(product('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').category, 'Body');
  assert.equal(product('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').step, 'Moisturize');
  assert.equal(product('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').offers[0].priceNgn, 12_800);
  assert.equal(product('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').offers[0].available, true);
  assert.equal(product('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').offers[1].retailer, 'Kadimez Essentials');
  assert.equal(product('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').offers[1].priceNgn, 12_000);
  assert.equal(product('aqua-rich-turmeric-vitamin-c-body-lotion-500ml').offers[1].available, true);
  assert.equal(product('balance-niacinamide-blemish-recovery-serum-30ml').slug, 'balance-niacinamide-blemish-recovery-serum-30ml');
  assert.equal(product('balance-niacinamide-blemish-recovery-serum-30ml').category, 'Face');
  assert.equal(product('balance-niacinamide-blemish-recovery-serum-30ml').step, 'Treat');
  assert.equal(checkedInReleaseManifest.releases[10].recommendationEligible, false);
  assert.equal(product('balance-niacinamide-blemish-recovery-serum-30ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('balance-niacinamide-blemish-recovery-serum-30ml').offers[0].priceNgn, 8_400);
  assert.equal(product('balance-niacinamide-blemish-recovery-serum-30ml').offers[0].available, true);
  assert.equal(product('balance-niacinamide-blemish-recovery-serum-30ml').offers[1].retailer, 'CSi Grocery');
  assert.equal(product('balance-niacinamide-blemish-recovery-serum-30ml').offers[1].priceNgn, 10_700);
  assert.equal(product('balance-niacinamide-blemish-recovery-serum-30ml').offers[1].available, true);
  assert.equal(product('nineless-a-control-10-azelaic-acid-serum-30ml').slug, 'nineless-a-control-10-azelaic-acid-serum-30ml');
  assert.equal(product('nineless-a-control-10-azelaic-acid-serum-30ml').category, 'Face');
  assert.equal(product('nineless-a-control-10-azelaic-acid-serum-30ml').step, 'Treat');
  assert.equal(product('nineless-a-control-10-azelaic-acid-serum-30ml').offers[0].retailer, 'Beauty by Daz');
  assert.equal(product('nineless-a-control-10-azelaic-acid-serum-30ml').offers[0].priceNgn, 12_500);
  assert.equal(product('nineless-a-control-10-azelaic-acid-serum-30ml').offers[1].retailer, 'BuyBetter');
  assert.equal(product('nineless-a-control-10-azelaic-acid-serum-30ml').offers[1].priceNgn, 14_500);
  assert.equal(product('nineless-mela-pro-rice-txa-toner-200ml').slug, 'nineless-mela-pro-rice-txa-toner-200ml');
  assert.equal(product('nineless-mela-pro-rice-txa-toner-200ml').category, 'Face');
  assert.equal(product('nineless-mela-pro-rice-txa-toner-200ml').step, 'Tone');
  assert.equal(product('nineless-mela-pro-rice-txa-toner-200ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('nineless-mela-pro-rice-txa-toner-200ml').offers[0].priceNgn, 15_500);
  assert.equal(product('nineless-mela-pro-rice-txa-toner-200ml').offers[0].available, false);
  assert.equal(product('nineless-mela-pro-rice-txa-toner-200ml').offers[1].retailer, 'Muna Cosmetics');
  assert.equal(product('nineless-mela-pro-rice-txa-toner-200ml').offers[1].priceNgn, 19_000);
  assert.equal(product('nineless-mela-pro-rice-txa-toner-200ml').offers[1].available, true);
  assert.equal(product('facefacts-ceramide-oil-control-foaming-cleanser-400ml').slug, 'facefacts-ceramide-oil-control-foaming-cleanser-400ml');
  assert.equal(product('facefacts-ceramide-oil-control-foaming-cleanser-400ml').category, 'Face');
  assert.equal(product('facefacts-ceramide-oil-control-foaming-cleanser-400ml').step, 'Cleanse');
  assert.equal(product('facefacts-ceramide-oil-control-foaming-cleanser-400ml').offers[0].retailer, 'CSi Grocery');
  assert.equal(product('facefacts-ceramide-oil-control-foaming-cleanser-400ml').offers[0].priceNgn, 7_500);
  assert.equal(product('facefacts-ceramide-oil-control-foaming-cleanser-400ml').offers[0].available, true);
  assert.equal(product('facefacts-ceramide-oil-control-foaming-cleanser-400ml').offers[1].retailer, '24Eleven');
  assert.equal(product('facefacts-ceramide-oil-control-foaming-cleanser-400ml').offers[1].priceNgn, 7_300);
  assert.equal(product('facefacts-ceramide-oil-control-foaming-cleanser-400ml').offers[1].available, true);
  assert.equal(product('facefacts-ceramide-hydrating-gentle-cleanser-400ml').slug, 'facefacts-ceramide-hydrating-gentle-cleanser-400ml');
  assert.equal(product('facefacts-ceramide-hydrating-gentle-cleanser-400ml').category, 'Face');
  assert.equal(product('facefacts-ceramide-hydrating-gentle-cleanser-400ml').step, 'Cleanse');
  assert.equal(product('facefacts-ceramide-hydrating-gentle-cleanser-400ml').offers[0].retailer, 'Beauty by Daz');
  assert.equal(product('facefacts-ceramide-hydrating-gentle-cleanser-400ml').offers[0].priceNgn, 6_950);
  assert.equal(product('facefacts-ceramide-hydrating-gentle-cleanser-400ml').offers[1].retailer, 'Teeka4');
  assert.equal(product('facefacts-ceramide-hydrating-gentle-cleanser-400ml').offers[1].priceNgn, 7_200);
  assert.equal(product('facefacts-ceramide-hydrating-gentle-cleanser-400ml').offers[2].retailer, '24Eleven');
  assert.equal(product('facefacts-ceramide-hydrating-gentle-cleanser-400ml').offers[2].priceNgn, 7_300);
  assert.equal(product('facefacts-ceramide-foaming-cleanser-400ml').slug, 'facefacts-ceramide-foaming-cleanser-400ml');
  assert.equal(product('facefacts-ceramide-foaming-cleanser-400ml').category, 'Face');
  assert.equal(product('facefacts-ceramide-foaming-cleanser-400ml').step, 'Cleanse');
  assert.equal(product('facefacts-ceramide-foaming-cleanser-400ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('facefacts-ceramide-foaming-cleanser-400ml').offers[0].priceNgn, 6_450);
  assert.equal(product('facefacts-ceramide-foaming-cleanser-400ml').offers[0].available, true);
  assert.equal(product('facefacts-ceramide-foaming-cleanser-400ml').offers[1].retailer, '24Eleven');
  assert.equal(product('facefacts-ceramide-foaming-cleanser-400ml').offers[1].priceNgn, 6_800);
  assert.equal(product('facefacts-ceramide-foaming-cleanser-400ml').offers[1].available, true);
  assert.equal(product('de-la-cruz-acne-treatment-10-sulfur-73-7g').slug, 'de-la-cruz-acne-treatment-10-sulfur-73-7g');
  assert.equal(product('de-la-cruz-acne-treatment-10-sulfur-73-7g').category, 'Face');
  assert.equal(product('de-la-cruz-acne-treatment-10-sulfur-73-7g').step, 'Treat');
  assert.equal(product('de-la-cruz-acne-treatment-10-sulfur-73-7g').offers[0].retailer, 'Beauty by Daz');
  assert.equal(product('de-la-cruz-acne-treatment-10-sulfur-73-7g').offers[0].priceNgn, 12_500);
  assert.equal(product('de-la-cruz-acne-treatment-10-sulfur-73-7g').offers[0].available, true);
  assert.equal(product('de-la-cruz-acne-treatment-10-sulfur-73-7g').offers[1].retailer, 'BuyBetter');
  assert.equal(product('de-la-cruz-acne-treatment-10-sulfur-73-7g').offers[1].priceNgn, 17_738);
  assert.equal(product('de-la-cruz-acne-treatment-10-sulfur-73-7g').offers[1].available, false);
  assert.equal(product('olay-super-serum-body-wash-normal-skin-547ml').slug, 'olay-super-serum-body-wash-normal-skin-547ml');
  assert.equal(product('olay-super-serum-body-wash-normal-skin-547ml').category, 'Body');
  assert.equal(product('olay-super-serum-body-wash-normal-skin-547ml').step, 'Cleanse');
  assert.equal(product('olay-super-serum-body-wash-normal-skin-547ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('olay-super-serum-body-wash-normal-skin-547ml').offers[0].priceNgn, 20_963);
  assert.equal(product('olay-super-serum-body-wash-normal-skin-547ml').offers[0].available, true);
  assert.equal(product('olay-super-serum-body-wash-normal-skin-547ml').offers[1].retailer, 'Perona Beauty');
  assert.equal(product('olay-super-serum-body-wash-normal-skin-547ml').offers[1].priceNgn, 21_200);
  assert.equal(product('olay-super-serum-body-wash-normal-skin-547ml').offers[1].available, true);
  assert.equal(product('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').slug, 'sheamoisture-jamaican-black-castor-oil-shampoo-384ml');
  assert.equal(product('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').category, 'Hair');
  assert.equal(product('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').step, 'Cleanse');
  assert.equal(product('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').offers[0].priceNgn, 12_685);
  assert.equal(product('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').offers[0].available, false);
  assert.equal(product('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').offers[1].retailer, 'Perfect Trust Beauty');
  assert.equal(product('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').offers[1].priceNgn, 13_300);
  assert.equal(product('sheamoisture-jamaican-black-castor-oil-shampoo-384ml').offers[1].available, true);
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').slug, 'tresemme-keratin-smooth-weightless-conditioner-828ml');
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').category, 'Hair');
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').step, 'Condition');
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').offers[0].retailer, 'Beauty by Daz');
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').offers[0].priceNgn, 7_950);
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').offers[0].available, false);
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').offers[1].retailer, 'BuyBetter');
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').offers[1].priceNgn, 9_138);
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').offers[1].available, false);
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').offers[2].retailer, 'Perfect Trust Beauty');
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').offers[2].priceNgn, 9_900);
  assert.equal(product('tresemme-keratin-smooth-weightless-conditioner-828ml').offers[2].available, true);
  assert.equal(product('laroche-posay-mela-b3-serum-30ml').slug, 'laroche-posay-mela-b3-serum-30ml');
  assert.equal(product('laroche-posay-mela-b3-serum-30ml').category, 'Face');
  assert.equal(product('laroche-posay-mela-b3-serum-30ml').step, 'Treat');
  assert.equal(product('laroche-posay-mela-b3-serum-30ml').offers[0].retailer, 'Lux Beauty');
  assert.equal(product('laroche-posay-mela-b3-serum-30ml').offers[0].priceNgn, 48_500);
  assert.equal(product('laroche-posay-mela-b3-serum-30ml').offers[0].available, true);
  assert.equal(product('laroche-posay-mela-b3-serum-30ml').offers[1].retailer, 'Beauty by Daz');
  assert.equal(product('laroche-posay-mela-b3-serum-30ml').offers[1].priceNgn, 44_700);
  assert.equal(product('laroche-posay-mela-b3-serum-30ml').offers[1].available, false);
  assert.equal(product('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').slug, 'anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml');
  assert.equal(product('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').category, 'Face');
  assert.equal(product('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').step, 'Treat');
  assert.equal(product('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').offers[0].priceNgn, 18_000);
  assert.equal(product('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').offers[0].available, true);
  assert.equal(product('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').offers[1].retailer, 'Teeka4');
  assert.equal(product('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').offers[1].priceNgn, 16_999);
  assert.equal(product('anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml').offers[1].available, false);
  assert.equal(product('facefacts-ceramide-blemish-gel-moisturiser-50ml').slug, 'facefacts-ceramide-blemish-gel-moisturiser-50ml');
  assert.equal(product('facefacts-ceramide-blemish-gel-moisturiser-50ml').category, 'Face');
  assert.equal(product('facefacts-ceramide-blemish-gel-moisturiser-50ml').step, 'Moisturize');
  assert.equal(product('facefacts-ceramide-blemish-gel-moisturiser-50ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('facefacts-ceramide-blemish-gel-moisturiser-50ml').offers[0].priceNgn, 3_440);
  assert.equal(product('facefacts-ceramide-blemish-gel-moisturiser-50ml').offers[0].available, false);
  assert.equal(product('facefacts-ceramide-blemish-gel-moisturiser-50ml').offers[1].retailer, 'Beauty by Daz');
  assert.equal(product('facefacts-ceramide-blemish-gel-moisturiser-50ml').offers[1].priceNgn, 3_500);
  assert.equal(product('facefacts-ceramide-blemish-gel-moisturiser-50ml').offers[1].available, true);
  assert.equal(product('facefacts-ceramide-moisturising-gel-cream-50ml').slug, 'facefacts-ceramide-moisturising-gel-cream-50ml');
  assert.equal(product('facefacts-ceramide-moisturising-gel-cream-50ml').category, 'Face');
  assert.equal(product('facefacts-ceramide-moisturising-gel-cream-50ml').step, 'Moisturize');
  assert.equal(product('facefacts-ceramide-moisturising-gel-cream-50ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('facefacts-ceramide-moisturising-gel-cream-50ml').offers[0].priceNgn, 3_440);
  assert.equal(product('facefacts-ceramide-moisturising-gel-cream-50ml').offers[0].available, false);
  assert.equal(product('facefacts-ceramide-moisturising-gel-cream-50ml').offers[1].retailer, 'CSi Grocery');
  assert.equal(product('facefacts-ceramide-moisturising-gel-cream-50ml').offers[1].priceNgn, 3_600);
  assert.equal(product('facefacts-ceramide-moisturising-gel-cream-50ml').offers[1].available, true);
  assert.equal(product('skin-by-zaron-vitamin-c-body-wash-650ml').slug, 'skin-by-zaron-vitamin-c-body-wash-650ml');
  assert.equal(product('skin-by-zaron-vitamin-c-body-wash-650ml').category, 'Body');
  assert.equal(product('skin-by-zaron-vitamin-c-body-wash-650ml').step, 'Cleanse');
  assert.equal(product('skin-by-zaron-vitamin-c-body-wash-650ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('skin-by-zaron-vitamin-c-body-wash-650ml').offers[0].priceNgn, 11_449);
  assert.equal(product('skin-by-zaron-vitamin-c-body-wash-650ml').offers[0].available, true);
  assert.equal(product('skin-by-zaron-vitamin-c-body-wash-650ml').offers[1].retailer, 'CSi Grocery');
  assert.equal(product('skin-by-zaron-vitamin-c-body-wash-650ml').offers[1].priceNgn, 12_500);
  assert.equal(product('skin-by-zaron-vitamin-c-body-wash-650ml').offers[1].available, true);
  assert.equal(product('prequel-gleanser-glycolic-acid-cleanser-400ml').slug, 'prequel-gleanser-glycolic-acid-cleanser-400ml');
  assert.equal(product('prequel-gleanser-glycolic-acid-cleanser-400ml').category, 'Face');
  assert.equal(product('prequel-gleanser-glycolic-acid-cleanser-400ml').step, 'Cleanse');
  assert.equal(product('prequel-gleanser-glycolic-acid-cleanser-400ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('prequel-gleanser-glycolic-acid-cleanser-400ml').offers[0].priceNgn, 37_088);
  assert.equal(product('prequel-gleanser-glycolic-acid-cleanser-400ml').offers[0].available, false);
  assert.equal(product('prequel-gleanser-glycolic-acid-cleanser-400ml').offers[1].retailer, 'Nihet Beauty');
  assert.equal(product('prequel-gleanser-glycolic-acid-cleanser-400ml').offers[1].priceNgn, 36_500);
  assert.equal(product('prequel-gleanser-glycolic-acid-cleanser-400ml').offers[1].available, true);
  assert.equal(product('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').slug, 'dr-teals-nourish-protect-coconut-oil-body-wash-710ml');
  assert.equal(product('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').category, 'Body');
  assert.equal(product('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').step, 'Cleanse');
  assert.equal(product('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').offers[0].priceNgn, 7_150);
  assert.equal(product('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').offers[0].available, false);
  assert.equal(product('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').offers[1].retailer, 'Nectar Beauty Hub');
  assert.equal(product('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').offers[1].priceNgn, 6_750);
  assert.equal(product('dr-teals-nourish-protect-coconut-oil-body-wash-710ml').offers[1].available, true);
  assert.equal(product('cecred-moisturizing-deep-conditioner-300ml').slug, 'cecred-moisturizing-deep-conditioner-300ml');
  assert.equal(product('cecred-moisturizing-deep-conditioner-300ml').category, 'Hair');
  assert.equal(product('cecred-moisturizing-deep-conditioner-300ml').step, 'Condition');
  assert.equal(product('cecred-moisturizing-deep-conditioner-300ml').offers[0].retailer, 'GlowMart');
  assert.equal(product('cecred-moisturizing-deep-conditioner-300ml').offers[0].priceNgn, 149_000);
  assert.equal(product('cecred-moisturizing-deep-conditioner-300ml').offers[0].available, true);
  assert.equal(product('cecred-moisturizing-deep-conditioner-300ml').offers[1].retailer, 'Ediths Essentials');
  assert.equal(product('cecred-moisturizing-deep-conditioner-300ml').offers[1].priceNgn, 144_750);
  assert.equal(product('cecred-moisturizing-deep-conditioner-300ml').offers[1].available, true);
  assert.equal(product('cerave-acne-foaming-cream-cleanser-4-150ml').slug, 'cerave-acne-foaming-cream-cleanser-4-150ml');
  assert.equal(product('cerave-acne-foaming-cream-cleanser-4-150ml').category, 'Face');
  assert.equal(product('cerave-acne-foaming-cream-cleanser-4-150ml').step, 'Cleanse');
  assert.equal(product('cerave-acne-foaming-cream-cleanser-4-150ml').offers[0].retailer, 'Teeka4');
  assert.equal(product('cerave-acne-foaming-cream-cleanser-4-150ml').offers[0].priceNgn, 23_500);
  assert.equal(product('cerave-acne-foaming-cream-cleanser-4-150ml').offers[0].available, false);
  assert.equal(product('cerave-acne-foaming-cream-cleanser-4-150ml').offers[1].retailer, 'Beauty by Daz');
  assert.equal(product('cerave-acne-foaming-cream-cleanser-4-150ml').offers[1].priceNgn, 23_850);
  assert.equal(product('cerave-acne-foaming-cream-cleanser-4-150ml').offers[1].available, true);
  assert.equal(product('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').slug, 'sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml');
  assert.equal(product('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').category, 'Hair');
  assert.equal(product('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').step, 'Condition');
  assert.equal(product('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').offers[0].priceNgn, 13_223);
  assert.equal(product('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').offers[0].available, true);
  assert.equal(product('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').offers[1].retailer, 'Perfect Trust Beauty');
  assert.equal(product('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').offers[1].priceNgn, 14_100);
  assert.equal(product('sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml').offers[1].available, true);
  assert.equal(product('dove-calming-moisture-body-wash-547ml').slug, 'dove-calming-moisture-body-wash-547ml');
  assert.equal(product('dove-calming-moisture-body-wash-547ml').category, 'Body');
  assert.equal(product('dove-calming-moisture-body-wash-547ml').step, 'Cleanse');
  assert.equal(product('dove-calming-moisture-body-wash-547ml').offers[0].retailer, 'Teeka4');
  assert.equal(product('dove-calming-moisture-body-wash-547ml').offers[0].priceNgn, 17_800);
  assert.equal(product('dove-calming-moisture-body-wash-547ml').offers[0].available, false);
  assert.equal(product('dove-calming-moisture-body-wash-547ml').offers[1].retailer, 'Ediths Essentials');
  assert.equal(product('dove-calming-moisture-body-wash-547ml').offers[1].priceNgn, 27_600);
  assert.equal(product('dove-calming-moisture-body-wash-547ml').offers[1].available, true);
  assert.equal(product('dove-skin-replenish-serum-body-wash-547ml').slug, 'dove-skin-replenish-serum-body-wash-547ml');
  assert.equal(product('dove-skin-replenish-serum-body-wash-547ml').category, 'Body');
  assert.equal(product('dove-skin-replenish-serum-body-wash-547ml').step, 'Cleanse');
  assert.equal(product('dove-skin-replenish-serum-body-wash-547ml').offers[0].retailer, 'Teeka4');
  assert.equal(product('dove-skin-replenish-serum-body-wash-547ml').offers[0].priceNgn, 17_800);
  assert.equal(product('dove-skin-replenish-serum-body-wash-547ml').offers[0].available, false);
  assert.equal(product('dove-skin-replenish-serum-body-wash-547ml').offers[1].retailer, 'Kadimez Essentials');
  assert.equal(product('dove-skin-replenish-serum-body-wash-547ml').offers[1].priceNgn, 24_500);
  assert.equal(product('dove-skin-replenish-serum-body-wash-547ml').offers[1].available, true);
  assert.equal(product('facefacts-vitamin-c-body-lotion-400ml').slug, 'facefacts-vitamin-c-body-lotion-400ml');
  assert.equal(product('facefacts-vitamin-c-body-lotion-400ml').category, 'Body');
  assert.equal(product('facefacts-vitamin-c-body-lotion-400ml').step, 'Moisturize');
  assert.equal(product('facefacts-vitamin-c-body-lotion-400ml').offers[0].retailer, 'BuyBetter');
  assert.equal(product('facefacts-vitamin-c-body-lotion-400ml').offers[0].priceNgn, 6_095);
  assert.equal(product('facefacts-vitamin-c-body-lotion-400ml').offers[0].available, true);
  assert.equal(product('facefacts-vitamin-c-body-lotion-400ml').offers[1].retailer, 'Allure Beauty');
  assert.equal(product('facefacts-vitamin-c-body-lotion-400ml').offers[1].priceNgn, 8_000);
  assert.equal(product('facefacts-vitamin-c-body-lotion-400ml').offers[1].available, true);
});

test('an explicit release materializes identity, image and exact offers only from its verified dossier', () => {
  const candidate = readyCandidate();
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);
  const release = createCataloguePublicationRelease(dossier, presentation(), releaseApproval(), asOf);
  const report = verifyCataloguePublicationReleaseManifest([candidate], {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    exposure: cataloguePublicationExposure,
    dossiers: [dossier],
  }, {
    schemaVersion: cataloguePublicationReleaseSchemaVersion,
    exposure: cataloguePublicationReleaseExposure,
    releases: [release],
  }, asOf);

  assert.equal(report.releaseCount, 1);
  assert.equal(report.releases[0].publicationScope, 'neutral-reference');
  assert.equal(report.releases[0].recommendationEligible, false);
  assert.deepEqual(report.products[0], {
    slug: candidate.id,
    brand: candidate.brand,
    name: candidate.name,
    size: candidate.size,
    category: 'Body',
    step: 'Moisturize',
    image: candidate.asset.publicImageUrl,
    displayLine: 'Moisturize · support',
    bestFor: [],
    concerns: [],
    skinTypes: [],
    sensitiveFriendly: false,
    usage: 'Apply according to the reviewed manufacturer directions on the package.',
    evidence: 'emerging',
    verifiedIngredientIds: [],
    offers: [{
      retailer: 'Medplus',
      url: candidate.nigeria.exactOffers[0].listingUrl,
      trust: 97,
      available: true,
      priceNgn: 12_500,
      checkedAt: candidate.nigeria.exactOffers[0].observedAt,
      match: 'exact',
      listingEvidence: {
        observedAt: candidate.nigeria.exactOffers[0].observedAt,
        sourceUrl: candidate.nigeria.exactOffers[0].listingUrl,
        basis: 'retailer-page',
      },
      priceObservation: {
        observedAt: candidate.nigeria.exactOffers[0].observedAt,
        variant: candidate.nigeria.exactOffers[0].observedTitle,
        size: candidate.nigeria.exactOffers[0].observedSize,
        stock: 'in-stock',
        landedCost: 'unknown',
      },
      priceComparison: 'include',
      location: ['NG'],
    }],
  });
  assert.equal(getReviewedProductCare(report.products[0].slug), undefined);
  assert.equal(
    evaluateProductClinically(
      report.products[0],
      assessClinicalRoutine('My skin feels dry.', { concerns: ['dryness'] }),
    ).eligible,
    false,
  );
});

test('a release without its verified dossier fails closed', () => {
  const candidate = readyCandidate();
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);
  const release = createCataloguePublicationRelease(dossier, presentation(), releaseApproval(), asOf);

  assert.throws(
    () => verifyCataloguePublicationReleaseManifest([candidate], {
      schemaVersion: cataloguePublicationDossierSchemaVersion,
      exposure: cataloguePublicationExposure,
      dossiers: [],
    }, {
      schemaVersion: cataloguePublicationReleaseSchemaVersion,
      exposure: cataloguePublicationReleaseExposure,
      releases: [release],
    }, asOf),
    /has no current verified publication dossier/,
  );
});

test('release content, chronology, category and manufacturer usage evidence are immutable and fail closed', () => {
  const candidate = readyCandidate();
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);
  const release = createCataloguePublicationRelease(dossier, presentation(), releaseApproval(), asOf);
  const dossierManifest = {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    exposure: cataloguePublicationExposure,
    dossiers: [dossier],
  };

  assert.throws(
    () => verifyCataloguePublicationReleaseManifest([candidate], dossierManifest, {
      schemaVersion: cataloguePublicationReleaseSchemaVersion,
      exposure: cataloguePublicationReleaseExposure,
      releases: [{ ...release, presentation: { ...release.presentation, usage: 'Changed after approval.' } }],
    }, asOf),
    /release content or fingerprint changed/,
  );
  assert.throws(
    () => createCataloguePublicationRelease(dossier, presentation({ category: 'Face' }), releaseApproval(), asOf),
    /category does not match/,
  );
  assert.throws(
    () => createCataloguePublicationRelease(dossier, presentation({
      manufacturerDirectionsUrl: 'https://retailer.example/unreviewed-directions',
    }), releaseApproval(), asOf),
    /not bound to reviewed manufacturer evidence/,
  );
  assert.throws(
    () => createCataloguePublicationRelease(dossier, presentation(), releaseApproval({
      publishedAt: '2026-07-22T16:05:00Z',
    }), asOf),
    /publication predates its presentation review/,
  );
});

test('candidate changes invalidate a release while wall-clock aging only hides its runtime price', () => {
  const candidate = readyCandidate();
  const dossier = createCataloguePublicationDossier(candidate, approval(), asOf);
  const release = createCataloguePublicationRelease(dossier, presentation(), releaseApproval(), asOf);
  const dossierManifest = {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    exposure: cataloguePublicationExposure,
    dossiers: [dossier],
  };
  const releaseManifest = {
    schemaVersion: cataloguePublicationReleaseSchemaVersion,
    exposure: cataloguePublicationReleaseExposure,
    releases: [release],
  };
  const changedImage = {
    ...candidate,
    asset: { ...candidate.asset, publicImageSha256: 'c'.repeat(64) },
  };

  assert.throws(
    () => verifyCataloguePublicationReleaseManifest([changedImage], dossierManifest, releaseManifest, asOf),
    /candidate fingerprint changed/,
  );
  const later = asOf + 91 * 24 * 60 * 60 * 1000;
  const report = verifyCataloguePublicationReleaseManifest(
    [candidate],
    dossierManifest,
    releaseManifest,
    later,
  );
  assert.equal(report.releases[0].releaseFingerprint, release.releaseFingerprint);
  assert.deepEqual(summarizeMarket(report.products[0].offers, 'NG', later), {
    market: 'NG',
    lowestPrice: null,
    typicalPrice: null,
    highestPrice: null,
    retailerCount: 0,
    inStockCount: 0,
    pricedRetailerCount: 0,
    savings: null,
    lastCheckedAt: null,
    confidence: 0,
    priceBasis: 'none',
  });
});

test('new dossier creation still rejects offer evidence that is stale at approval', () => {
  const candidate = readyCandidate();
  const later = asOf + 8 * 24 * 60 * 60 * 1000;

  assert.throws(
    () => createCataloguePublicationDossier(candidate, approval({
      approvedAt: new Date(later - 60_000).toISOString(),
    }), later),
    /not approval-ready.*nigeria-exact-offer-missing/,
  );
});

test('stored dossier verification rejects an approval in the caller clock future', () => {
  const candidate = readyCandidate();
  const futureAsOf = asOf + 24 * 60 * 60 * 1000;
  const futureDossier = createCataloguePublicationDossier(candidate, approval({
    approvedAt: '2026-07-23T16:00:00Z',
  }), futureAsOf);

  assert.throws(
    () => verifyCataloguePublicationDossierManifest([candidate], {
      schemaVersion: cataloguePublicationDossierSchemaVersion,
      exposure: cataloguePublicationExposure,
      dossiers: [futureDossier],
    }, asOf),
    /approval timestamp is invalid or in the future/,
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
