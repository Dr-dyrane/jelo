import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCatalogueIntakeManifest,
  catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion,
  catalogueGenerationRecordSchemaVersion,
  catalogueGenerationRecordSha256,
  catalogueCorroboratedIdentityExtractionSchemaVersion,
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

function packageRegistrationEvidence(
  overrides: Partial<Extract<ReviewedRegulatoryEvidence, { matchBasis: 'package-registration-number' }>> = {},
): Extract<ReviewedRegulatoryEvidence, { matchBasis: 'package-registration-number' }> {
  const sourceText = 'NAFDAC registration A4-1234 · Product Example Barrier Lotion · Status Active';
  const imageUrl = 'https://medplusnig.com/media/example-barrier-lotion-back-label.jpg';
  return {
    schemaVersion: catalogueRegulatoryEvidenceSchemaVersion,
    authority: 'NAFDAC',
    status: 'matched',
    matchBasis: 'package-registration-number',
    candidateGtin: '4005808319695',
    registrationNumber: 'A4-1234',
    registeredProductName: {
      value: 'Example Barrier Lotion',
      locator: 'NAPAMS verification result product name',
      sourceText: 'Product Example Barrier Lotion',
    },
    packageResponse: {
      role: 'package-regulatory-label-image',
      listingUrl: 'https://medplusnig.com/product/example-barrier-lotion',
      sourceUrl: imageUrl,
      responseUrl: imageUrl,
      responseSha256: '1'.repeat(64),
      responseMimeType: 'image/jpeg',
      responseByteSize: 248_100,
      retrievedAt: '2026-07-22T09:00:00Z',
      listingLocator: 'HTML product gallery back-label image',
      listingSourceText: `<img src="${imageUrl}" alt="Example Barrier Lotion back label">`,
      fields: {
        gtin: {
          label: 'EAN',
          symbology: 'EAN-13',
          value: '4005808319695',
          locator: 'Back-label EAN-13 barcode decoded and visually reviewed',
          sourceText: 'EAN-13 4005808319695',
        },
        registrationNumber: {
          value: 'A4-1234',
          locator: 'Back-label NAFDAC registration line',
          sourceText: 'NAFDAC Reg. No. A4-1234',
        },
      },
    },
    registrationStatus: {
      value: 'active',
      locator: 'NAPAMS verification result status',
      sourceText: 'Status Active',
    },
    sourceUrl: 'https://registration.nafdac.gov.ng/Home/VerifyProduct',
    locator: 'NAPAMS product verification result for A4-1234',
    sourceText,
    sourceExcerptSha256: regulatoryEvidenceExcerptSha256(sourceText),
    responseUrl: 'https://registration.nafdac.gov.ng/Home/VerifyProduct',
    responseSha256: '2'.repeat(64),
    responseDigestScope: 'decoded-response-body',
    responseMimeType: 'text/html',
    responseByteSize: 38_200,
    retrievedAt: '2026-07-22T09:10:00Z',
    observedAt: '2026-07-22T09:10:00Z',
    reviewedAt: '2026-07-22T09:20:00Z',
    reviewer: 'Regulatory reviewer',
    ...overrides,
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

function corroboratedIdentityEvidence(): CatalogueOfficialIdentityEvidence {
  const candidateId = 'nineless-a-control-10-azelaic-acid-serum-30ml';
  const officialUrl = 'https://ninelessshop.com/products/a-control-10-azelaic-acid-serum';
  const packageEvidenceUrl = 'https://ninelessshop.com/cdn/shop/files/0.Renewal_c67199d4-aed7-4f95-8262-c3e7ed690dd5_1024x1024@2x.png?v=1781860295';
  const observedGtin = '8809875270073';
  const observedVariant = 'A-Control 10% Azelaic Acid Serum';
  const observedSize = '30 ml';
  const observedPackageVersion = 'Original green dropper bottle';
  const retrievedAt = '2026-07-22T07:55:00Z';
  const canonicalExtraction = {
    schemaVersion: catalogueCorroboratedIdentityExtractionSchemaVersion,
    candidateId,
    sourceUrl: officialUrl,
    responseUrl: officialUrl,
    retrievedAt,
    fields: {
      gtin: {
        value: observedGtin,
        locator: 'identifierCorroborations[*].fields.gtin',
        sourceText: `EAN ${observedGtin} corroborated by Happii and Qudo; the official manufacturer page does not publish a barcode.`,
      },
      variant: {
        value: observedVariant,
        locator: 'Official HTML product title',
        sourceText: '[A-CONTROL] 10% Azelaic Acid Serum 30ml – NINELESS',
      },
      size: {
        value: observedSize,
        locator: 'Official HTML product title size',
        sourceText: '[A-CONTROL] 10% Azelaic Acid Serum 30ml',
      },
      manufacturerIdentifierStatus: {
        value: 'not-published' as const,
        locator: 'Official Shopify product variant object',
        sourceText: 'Official variant record: "sku":"","barcode":null',
      },
      packageVersion: {
        value: observedPackageVersion,
        locator: 'Official renewal comparison image, left package',
        sourceText: 'Original A-CONTROL 10% Azelaic Acid Serum 30 ml green dropper bottle upgrades to a pump bottle.',
        evidenceUrl: packageEvidenceUrl,
      },
    },
    sourceResponseSha256: '1'.repeat(64),
    sourceResponseMimeType: 'text/html' as const,
    sourceResponseByteSize: 165_168,
    supplementalResponses: [{
      role: 'official-pack-image' as const,
      sourceUrl: packageEvidenceUrl,
      responseUrl: packageEvidenceUrl,
      retrievedAt,
      responseSha256: '2'.repeat(64),
      responseMimeType: 'image/png' as const,
      responseByteSize: 313_799,
    }],
    responseDigestScope: 'rendered-dom-outerhtml' as const,
    method: 'reviewed-browser-dom-identity-with-independent-ean-corroboration' as const,
    browserCapture: {
      surface: 'Codex in-app browser' as const,
      documentReadyState: 'complete' as const,
      pageTitle: '[A-CONTROL] 10% Azelaic Acid Serum 30ml – NINELESS',
    },
    identifierCorroborations: [
      {
        sourceUrl: 'https://www.happii.dk/Ansigtspleje/Nineless-A-Control-10-Azelaic-Acid-Serum-30-ml/3353734',
        responseUrl: 'https://www.happii.dk/Ansigtspleje/Nineless-A-Control-10-Azelaic-Acid-Serum-30-ml/3353734',
        retrievedAt: '2026-07-22T07:56:00Z',
        fields: {
          gtin: {
            value: observedGtin,
            locator: 'Rendered HTML product specification row labelled Ean',
            sourceText: `Ean ${observedGtin}`,
          },
          variant: {
            value: 'Nineless A-Control 10% Azelaic Acid Serum 30 ml',
            locator: 'Rendered HTML product h1',
            sourceText: 'Nineless A-Control 10% Azelaic Acid Serum 30 ml',
          },
          size: {
            value: observedSize,
            locator: 'Rendered HTML product h1 size',
            sourceText: 'Nineless A-Control 10% Azelaic Acid Serum 30 ml',
          },
        },
        sourceResponseSha256: '3'.repeat(64),
        sourceResponseMimeType: 'text/html' as const,
        sourceResponseByteSize: 62_495,
        responseDigestScope: 'rendered-dom-outerhtml' as const,
        method: 'reviewed-browser-dom-independent-ean-corroboration' as const,
        browserCapture: {
          surface: 'Codex in-app browser' as const,
          documentReadyState: 'complete' as const,
          pageTitle: 'Nineless A-Control 10% Azelaic Acid Serum 30 ml | På lager | Billig',
        },
        reviewer: 'Identity reviewer',
        reviewedAt: '2026-07-22T07:58:00Z',
      },
      {
        sourceUrl: 'https://qudobeauty.com/product/nine-less-a-control-10-azelaic-acid-serum-30ml/',
        responseUrl: 'https://qudobeauty.com/product/nine-less-a-control-10-azelaic-acid-serum-30ml/',
        retrievedAt: '2026-07-22T07:56:00Z',
        fields: {
          gtin: {
            value: observedGtin,
            locator: 'Rendered HTML h2.qudo-ean',
            sourceText: `EAN: ${observedGtin}`,
          },
          variant: {
            value: 'NINE LESS A-Control 10% Azelaic Acid Serum 30ml',
            locator: 'Rendered HTML h1.product_title',
            sourceText: 'NINE LESS A-Control 10% Azelaic Acid Serum 30ml',
          },
          size: {
            value: observedSize,
            locator: 'Rendered HTML product title size',
            sourceText: 'NINE LESS A-Control 10% Azelaic Acid Serum 30ml',
          },
        },
        sourceResponseSha256: '4'.repeat(64),
        sourceResponseMimeType: 'text/html' as const,
        sourceResponseByteSize: 200_152,
        responseDigestScope: 'rendered-dom-outerhtml' as const,
        method: 'reviewed-browser-dom-independent-ean-corroboration' as const,
        browserCapture: {
          surface: 'Codex in-app browser' as const,
          documentReadyState: 'complete' as const,
          pageTitle: 'NINE LESS - a-Control 10% Azelaic Acid Serum - 30ml - Qudo Beauty',
        },
        reviewer: 'Identity reviewer',
        reviewedAt: '2026-07-22T07:58:00Z',
      },
    ],
    reviewer: 'Identity reviewer',
    reviewedAt: '2026-07-22T07:59:00Z',
  };
  return {
    url: officialUrl,
    observedGtin,
    observedVariant,
    observedSize,
    observedPackageVersion,
    snapshotKind: 'canonical-extraction',
    snapshotPath: `data/catalogue-identity-evidence/${candidateId}.json`,
    canonicalExtraction,
    snapshotSha256: catalogueIdentityExtractionSha256(canonicalExtraction),
    snapshotMimeType: 'application/json',
    snapshotByteSize: catalogueIdentityExtractionByteSize(canonicalExtraction),
    retrievedAt,
  };
}

function accessibleCorroboratedIdentityEvidence(): CatalogueOfficialIdentityEvidence {
  const candidateId = 'nineless-mela-pro-rice-txa-toner-200ml';
  const officialUrl = 'https://ninelessshop.com/products/nineless-mela-pro-rice-txa-toner-200ml';
  const packageEvidenceUrl = 'https://ninelessshop.com/cdn/shop/files/0.Renewal_1024x1024@2x.png?v=1781858738';
  const observedGtin = '8809875270172';
  const observedVariant = 'Mela-Pro Rice & TXA Toner';
  const observedSize = '200 ml';
  const observedPackageVersion = 'Original translucent bottle with orange cap';
  const retrievedAt = '2026-07-22T07:55:00Z';
  const canonicalExtraction = {
    schemaVersion: catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion,
    candidateId,
    sourceUrl: officialUrl,
    responseUrl: officialUrl,
    retrievedAt,
    fields: {
      gtin: {
        value: observedGtin,
        locator: 'identifierCorroborations[*].fields.gtin',
        sourceText: `EAN ${observedGtin} is independently corroborated by Qudo and Shop Apotheke.`,
      },
      variant: {
        value: observedVariant,
        locator: 'Rendered accessibility tree product heading',
        sourceText: '[MELA-PRO] Rice & TXA Toner 200ml',
      },
      size: {
        value: observedSize,
        locator: 'Rendered accessibility tree product heading size',
        sourceText: '[MELA-PRO] Rice & TXA Toner 200ml',
      },
      packageVersion: {
        value: observedPackageVersion,
        locator: 'Official renewal comparison image, original package',
        sourceText: 'Original translucent MELA-PRO Rice & TXA Toner 200 ml bottle with orange cap upgrades to an opaque bottle.',
        evidenceUrl: packageEvidenceUrl,
      },
    },
    sourceResponseSha256: '5'.repeat(64),
    sourceResponseMimeType: 'text/html' as const,
    sourceResponseByteSize: 6_109,
    supplementalResponses: [{
      role: 'official-pack-image' as const,
      sourceUrl: packageEvidenceUrl,
      responseUrl: packageEvidenceUrl,
      retrievedAt,
      responseSha256: '6'.repeat(64),
      responseMimeType: 'image/png' as const,
      responseByteSize: 264_943,
    }],
    responseDigestScope: 'rendered-accessibility-tree' as const,
    method: 'reviewed-browser-accessibility-identity-with-independent-ean-corroboration' as const,
    browserCapture: {
      surface: 'Codex in-app browser' as const,
      documentReadyState: 'complete' as const,
      pageTitle: '[MELA-PRO] Rice & TXA Toner 200ml – NINELESS',
    },
    identifierCorroborations: [
      {
        sourceUrl: 'https://qudobeauty.com/product/nineless-mela-pro-rice-txa-toner-200ml/',
        responseUrl: 'https://qudobeauty.com/product/nineless-mela-pro-rice-txa-toner-200ml/',
        retrievedAt: '2026-07-22T07:56:00Z',
        fields: {
          gtin: {
            value: observedGtin,
            locator: 'Rendered accessibility text labelled EAN',
            sourceText: `EAN: ${observedGtin}`,
          },
          variant: {
            value: 'NINE LESS Mela Pro Rice & TXA Toner 200ml',
            locator: 'Rendered accessibility product heading',
            sourceText: 'NINE LESS Mela Pro Rice & TXA Toner 200ml',
          },
          size: {
            value: observedSize,
            locator: 'Rendered accessibility product heading size',
            sourceText: 'NINE LESS Mela Pro Rice & TXA Toner 200ml',
          },
        },
        sourceResponseSha256: '7'.repeat(64),
        sourceResponseMimeType: 'text/html' as const,
        sourceResponseByteSize: 11_319,
        responseDigestScope: 'rendered-accessibility-tree' as const,
        method: 'reviewed-browser-accessibility-independent-ean-corroboration' as const,
        browserCapture: {
          surface: 'Codex in-app browser' as const,
          documentReadyState: 'complete' as const,
          pageTitle: 'NINE LESS - Mela Pro Rice & TXA Toner - 200ml - Qudo Beauty',
        },
        reviewer: 'Identity reviewer',
        reviewedAt: '2026-07-22T07:58:00Z',
      },
      {
        sourceUrl: 'https://www.shop-apotheke.com/beauty/upmU2WTME/nine-less-mela-pro-rice-txa-face-toner.htm',
        responseUrl: 'https://www.shop-apotheke.com/beauty/upmU2WTME/nine-less-mela-pro-rice-txa-face-toner.htm',
        retrievedAt: '2026-07-22T07:56:00Z',
        fields: {
          gtin: {
            value: observedGtin,
            locator: 'Rendered accessibility definition labelled EAN',
            sourceText: `EAN ${observedGtin}`,
          },
          variant: {
            value: 'NINE LESS Mela-Pro Rice & TXA Face Toner 200 ml',
            locator: 'Rendered accessibility product heading',
            sourceText: 'NINE LESS Mela-Pro Rice & TXA Face Toner 200 ml',
          },
          size: {
            value: observedSize,
            locator: 'Rendered accessibility product heading size',
            sourceText: 'NINE LESS Mela-Pro Rice & TXA Face Toner 200 ml',
          },
        },
        sourceResponseSha256: '8'.repeat(64),
        sourceResponseMimeType: 'text/html' as const,
        sourceResponseByteSize: 26_488,
        responseDigestScope: 'rendered-accessibility-tree' as const,
        method: 'reviewed-browser-accessibility-independent-ean-corroboration' as const,
        browserCapture: {
          surface: 'Codex in-app browser' as const,
          documentReadyState: 'complete' as const,
          pageTitle: 'NINE LESS Mela-Pro Rice & TXA Toner 200 ml - Shop Apotheke',
        },
        reviewer: 'Identity reviewer',
        reviewedAt: '2026-07-22T07:58:00Z',
      },
    ],
    reviewer: 'Identity reviewer',
    reviewedAt: '2026-07-22T07:59:00Z',
  };
  return {
    url: officialUrl,
    observedGtin,
    observedVariant,
    observedSize,
    observedPackageVersion,
    snapshotKind: 'canonical-extraction',
    snapshotPath: `data/catalogue-identity-evidence/${candidateId}.json`,
    canonicalExtraction,
    snapshotSha256: catalogueIdentityExtractionSha256(canonicalExtraction),
    snapshotMimeType: 'application/json',
    snapshotByteSize: catalogueIdentityExtractionByteSize(canonicalExtraction),
    retrievedAt,
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
  assert.equal(regulatoryBeforeIdentity.freshExactOffers.length, 0);

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

test('an unpublished manufacturer barcode requires two independent EAN sources and an exact official package version', () => {
  const officialEvidence = corroboratedIdentityEvidence();
  const candidate: CatalogueIntakeCandidate = {
    ...completeCandidate(),
    id: 'nineless-a-control-10-azelaic-acid-serum-30ml',
    brand: 'NINELESS',
    brandAliases: ['NINE LESS'],
    name: 'A-Control 10% Azelaic Acid Serum',
    variant: 'A-Control 10% Azelaic Acid Serum',
    size: '30 ml',
    identity: {
      gtin: '8809875270073',
      officialProductUrl: officialEvidence.url,
      checkedAt: '2026-07-22T08:00:00Z',
      basis: 'official-brand',
      packageVersion: 'Original green dropper bottle',
      officialEvidence,
    },
  };
  const decision = evaluateCatalogueIntakeCandidate(candidate, asOf);
  assert.equal(decision.stage, 'care');
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);

  const extraction = officialEvidence.canonicalExtraction;
  assert.equal(extraction.schemaVersion, catalogueCorroboratedIdentityExtractionSchemaVersion);
  if (extraction.schemaVersion !== catalogueCorroboratedIdentityExtractionSchemaVersion) return;
  const duplicateSource = {
    ...extraction,
    identifierCorroborations: [
      extraction.identifierCorroborations[0],
      {
        ...extraction.identifierCorroborations[1],
        sourceUrl: extraction.identifierCorroborations[0].sourceUrl,
        responseUrl: extraction.identifierCorroborations[0].responseUrl,
      },
    ],
  };
  const duplicateSourceDecision = evaluateCatalogueIntakeCandidate({
    ...candidate,
    identity: {
      ...candidate.identity,
      officialEvidence: withCanonicalExtraction(officialEvidence, duplicateSource),
    },
  }, asOf);
  assert.equal(duplicateSourceDecision.stage, 'identity');
  assert.ok(duplicateSourceDecision.blockers.includes('identity-official-evidence-invalid'));

  const changedPackageDecision = evaluateCatalogueIntakeCandidate({
    ...candidate,
    identity: {
      ...candidate.identity,
      packageVersion: 'Renewed opaque pump bottle',
    },
  }, asOf);
  assert.equal(changedPackageDecision.stage, 'identity');
  assert.ok(changedPackageDecision.blockers.includes('identity-official-evidence-invalid'));
});

test('an accessibility-tree capture can corroborate an exact legacy package without inventing official identifier fields', () => {
  const officialEvidence = accessibleCorroboratedIdentityEvidence();
  const candidate: CatalogueIntakeCandidate = {
    ...completeCandidate(),
    id: 'nineless-mela-pro-rice-txa-toner-200ml',
    brand: 'NINELESS',
    brandAliases: ['NINE LESS'],
    name: 'Mela-Pro Rice & TXA Toner',
    variant: 'Mela-Pro Rice & TXA Toner',
    size: '200 ml',
    identity: {
      gtin: '8809875270172',
      officialProductUrl: officialEvidence.url,
      checkedAt: '2026-07-22T08:00:00Z',
      basis: 'official-brand',
      packageVersion: 'Original translucent bottle with orange cap',
      officialEvidence,
    },
  };
  const decision = evaluateCatalogueIntakeCandidate(candidate, asOf);
  assert.equal(decision.stage, 'care');
  assert.equal(decision.blockers.includes('identity-official-evidence-invalid'), false);

  const extraction = officialEvidence.canonicalExtraction;
  assert.equal(extraction.schemaVersion, catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion);
  if (extraction.schemaVersion !== catalogueAccessibleCorroboratedIdentityExtractionSchemaVersion) return;

  const wrongRepresentation = {
    ...extraction,
    responseDigestScope: 'rendered-dom-outerhtml' as never,
  };
  const wrongRepresentationDecision = evaluateCatalogueIntakeCandidate({
    ...candidate,
    identity: {
      ...candidate.identity,
      officialEvidence: withCanonicalExtraction(officialEvidence, wrongRepresentation),
    },
  }, asOf);
  assert.equal(wrongRepresentationDecision.stage, 'identity');
  assert.ok(wrongRepresentationDecision.blockers.includes('identity-official-evidence-invalid'));

  const missingPackageEvidence = {
    ...extraction,
    supplementalResponses: [],
  };
  const missingPackageDecision = evaluateCatalogueIntakeCandidate({
    ...candidate,
    identity: {
      ...candidate.identity,
      officialEvidence: withCanonicalExtraction(officialEvidence, missingPackageEvidence),
    },
  }, asOf);
  assert.equal(missingPackageDecision.stage, 'identity');
  assert.ok(missingPackageDecision.blockers.includes('identity-official-evidence-invalid'));
});

test('canonical identity extraction rejects token collisions and non-raw response MIME types', () => {
  const base = completeCandidate();
  const evidence = base.identity.officialEvidence!;
  const extraction = evidence.canonicalExtraction;
  assert.equal(extraction.schemaVersion, catalogueIdentityExtractionSchemaVersion);
  if (extraction.schemaVersion !== catalogueIdentityExtractionSchemaVersion) return;
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
  const sizeExtraction = sizeEvidence.canonicalExtraction;
  assert.equal(sizeExtraction.schemaVersion, catalogueIdentityExtractionSchemaVersion);
  if (sizeExtraction.schemaVersion !== catalogueIdentityExtractionSchemaVersion) return;
  const sizeCollisionExtraction = {
    ...sizeExtraction,
    fields: {
      ...sizeExtraction.fields,
      size: { ...sizeExtraction.fields.size, sourceText: '1250 ml' },
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
  assert.equal(extraction.schemaVersion, catalogueIdentityExtractionSchemaVersion);
  if (extraction.schemaVersion !== catalogueIdentityExtractionSchemaVersion) return;
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

test('an exact variant and size can bind a price without pretending a retailer SKU is a GTIN', () => {
  const base = completeCandidate();
  const original = base.nigeria.exactOffers[0];
  const evidence = original.evidence!;
  const exactVariantOffer: CatalogueIntakeOffer = {
    ...original,
    observedGtin: undefined,
    observedGtinBasis: 'exact-variant-and-size',
    retailerSku: 'internal-123',
    evidence: {
      ...evidence,
      fields: {
        ...evidence.fields,
        gtin: {
          label: 'GTIN',
          value: base.identity.gtin!,
          locator: 'Bound official catalogue identity snapshot',
          sourceText: `Official catalogue identity GTIN ${base.identity.gtin}`,
          responseRole: 'official-identity-correlation',
        },
      },
    },
  };

  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: { ...base.nigeria, exactOffers: [exactVariantOffer] },
  }, asOf);

  assert.equal(decision.freshExactOffers.length, 1);
  assert.equal(decision.freshExactOffers[0].observedGtin, undefined);
  assert.equal(decision.freshExactOffers[0].retailerSku, 'internal-123');
  assert.equal(decision.stage, 'approval-ready');

  for (const invalid of [
    { ...exactVariantOffer, observedTitle: 'Example Barrier Cream' },
    { ...exactVariantOffer, observedSize: '200 ml' },
    { ...exactVariantOffer, observedGtin: base.identity.gtin },
  ]) {
    const invalidDecision = evaluateCatalogueIntakeCandidate({
      ...base,
      nigeria: { ...base.nigeria, exactOffers: [invalid] },
    }, asOf);
    assert.equal(invalidDecision.freshExactOffers.length, 0);
  }
});

test('browser offer evidence recognizes explicit marketplace low-stock counts', () => {
  const base = completeCandidate();
  const original = base.nigeria.exactOffers[0];
  const evidence = original.evidence!;
  const marketplaceOffer: CatalogueIntakeOffer = {
    ...original,
    observedGtin: undefined,
    observedGtinBasis: 'exact-variant-and-size',
    stock: 'low-stock',
    evidence: {
      ...evidence,
      method: 'reviewed-browser-dom-exact-offer-field-extraction',
      responseDigestScope: 'rendered-dom-outerhtml',
      responseMimeType: 'text/html',
      browserCapture: {
        surface: 'Codex in-app browser',
        documentReadyState: 'complete',
        pageTitle: 'Example Barrier Lotion 400 ml',
      },
      fields: {
        ...evidence.fields,
        gtin: {
          label: 'GTIN',
          value: base.identity.gtin!,
          locator: 'Bound official catalogue identity snapshot',
          sourceText: `Official catalogue identity GTIN ${base.identity.gtin}`,
          responseRole: 'official-identity-correlation',
        },
        stock: {
          value: 'low-stock',
          locator: 'Rendered DOM stock status',
          sourceText: '2 units left',
        },
      },
    },
  };

  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: { ...base.nigeria, exactOffers: [marketplaceOffer] },
  }, asOf);

  assert.equal(decision.freshExactOffers.length, 1);
  assert.equal(decision.freshExactOffers[0].stock, 'low-stock');
});

test('low-stock evidence accepts an explicit retailer count of five or fewer units', () => {
  const candidate = completeCandidate();
  const offer = candidate.nigeria.exactOffers[0];
  offer.stock = 'low-stock';
  assert.ok(offer.evidence);
  offer.evidence.fields.stock = {
    value: 'low-stock',
    locator: 'HTML product stock notice',
    sourceText: '4 in stock',
  };

  const decision = evaluateCatalogueIntakeCandidate(candidate, asOf);
  assert.equal(decision.freshExactOffers.length, 1);
  assert.equal(decision.blockers.includes('nigeria-offer-identity-unbound'), false);
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

test('NAFDAC research remains informational even when its evidence is incomplete', () => {
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
    assert.equal(decision.stage, 'approval-ready');
    assert.equal(decision.approvalDraftReady, true);
  }
});

test('a cosmetics registration can bind an exact package GTIN and NAFDAC number to an active NAPAMS result', () => {
  const base = completeCandidate();
  const valid = packageRegistrationEvidence();
  const decision = evaluateCatalogueIntakeCandidate({
    ...base,
    nigeria: { ...base.nigeria, regulatoryEvidence: valid },
  }, asOf);
  assert.equal(decision.approvalDraftReady, true);

  const wrongGtin = structuredClone(valid);
  wrongGtin.packageResponse.fields.gtin.value = '0302994113002';
  wrongGtin.packageResponse.fields.gtin.sourceText = 'EAN-13 0302994113002';
  const wrongRegistration = structuredClone(valid);
  wrongRegistration.packageResponse.fields.registrationNumber.value = 'A4-9999';
  wrongRegistration.packageResponse.fields.registrationNumber.sourceText = 'NAFDAC Reg. No. A4-9999';
  const detachedImage = structuredClone(valid);
  detachedImage.packageResponse.sourceUrl = 'https://images.example/back-label.jpg';
  detachedImage.packageResponse.responseUrl = detachedImage.packageResponse.sourceUrl;
  detachedImage.packageResponse.listingSourceText = `<img src="${detachedImage.packageResponse.sourceUrl}">`;
  const untrustedAuthority = packageRegistrationEvidence({
    sourceUrl: 'https://registry.example/verify/A4-1234',
    responseUrl: 'https://registry.example/verify/A4-1234',
  });

  for (const evidence of [wrongGtin, wrongRegistration, detachedImage, untrustedAuthority]) {
    const invalid = evaluateCatalogueIntakeCandidate({
      ...base,
      nigeria: { ...base.nigeria, regulatoryEvidence: evidence },
    }, asOf);
    assert.equal(invalid.approvalDraftReady, true);
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

  assert.equal(decision.approvalDraftReady, true);
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
  assert.equal(unrelated.approvalDraftReady, true);
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
