import { createHash } from 'node:crypto';
import {
  auditCatalogueIntakeCandidates,
  catalogueBrandAuthorizationSourceValid,
  catalogueManufacturerSkuIdentityExtractionSchemaVersion,
  evaluateCatalogueIntakeCandidate,
  type CatalogueGenerationRecord,
  type CatalogueIntakeCandidate,
  type CatalogueIntakeOffer,
  type CatalogueNigeriaMarketRoute,
  type CatalogueOfficialIdentityExtraction,
  type CatalogueCandidateOfficialIdentityEvidence,
  type CatalogueManufacturerSkuIdentityExtraction,
  type CatalogueSourceAssetMimeType,
} from './intake-readiness';
import {
  catalogueCanonicalIdentifierFor,
  catalogueGtinForIdentity,
  type CatalogueCanonicalProductIdentifier,
  type CatalogueOfficialProductIdentityCrosswalk,
} from './canonical-identity';
import { nigeriaRetailers } from '@/data/retailers';
import {
  reviewedBrandSellerEvidenceFor,
  type ReviewedBrandSellerEvidence,
} from './brand-seller-evidence';
import type { ReviewedRegulatoryEvidence } from './market-evidence';
import type { CataloguePublicationImageMimeType } from './publication-image-policy';
import { verifyCatalogueIdentityEvidenceArtifacts } from './identity-evidence-artifact';

export const cataloguePublicationDossierSchemaVersion = 8 as const;
export const cataloguePublicationApprovalScope = 'exact-identity-source-care-retail-rights-and-final-image' as const;
export const cataloguePublicationExposure = 'private-only' as const;
export const cataloguePublicationScope = 'neutral-reference' as const;

export type CataloguePublicationApproval = {
  scope: typeof cataloguePublicationApprovalScope;
  reviewer: string;
  approvedAt: string;
};

type CataloguePublicationDossierIdentityBase = {
  brand: string;
  name: string;
  variant: string;
  size: string;
  packageVersion?: string;
  category: CatalogueIntakeCandidate['category'];
};

export type CataloguePublicationDossier = {
  schemaVersion: typeof cataloguePublicationDossierSchemaVersion;
  candidateId: string;
  candidateFingerprint: string;
  dossierFingerprint: string;
  exposure: typeof cataloguePublicationExposure;
  publicationScope: typeof cataloguePublicationScope;
  publicationStatus: 'not-published';
  recommendationEligible: false;
  identity: CataloguePublicationDossierIdentityBase & (
    | {
      gtin: string;
      canonicalIdentifier?: Extract<CatalogueCanonicalProductIdentifier, { kind: 'gtin' }>;
      officialProductCrosswalk?: CatalogueOfficialProductIdentityCrosswalk;
    }
    | {
      canonicalIdentifier: Extract<CatalogueCanonicalProductIdentifier, { kind: 'manufacturer-sku' }>;
      officialProductCrosswalk: CatalogueOfficialProductIdentityCrosswalk;
    }
  );
  sourceEvidence: {
    basis: 'official-brand';
    officialProductUrl: string;
    officialIdentity: CatalogueCandidateOfficialIdentityEvidence;
    checkedAt: string;
    demandEvidenceUrls: string[];
  };
  care: {
    status: 'reviewed';
    formulaArchetype: string;
    careTier: 'daily-care' | 'targeted-care' | 'professional-referral';
    reviewScope: 'catalogue-supportive-care';
    advisoryBoundary: string;
    manufacturerEvidenceUrl: string;
    independentClinicalGuidanceUrl: string;
    evidenceUrls: string[];
    reviewedAt: string;
    reviewer: string;
  };
  nigeria: {
    marketRoute: CatalogueNigeriaMarketRoute;
    regulatoryStatus: 'matched' | 'not-required' | 'pending';
    regulatoryEvidence?: ReviewedRegulatoryEvidence;
    tierAIdentityEvidenceUrl?: string;
    brandAuthorizationEvidenceUrl?: string;
    exactOffers: CatalogueIntakeOffer[];
    brandSellerAuthorizationEvidence: Array<{
      retailer: string;
      listingHost: string;
      evidence: ReviewedBrandSellerEvidence;
    }>;
  };
  rights: {
    status: 'documented';
    origin: NonNullable<CatalogueIntakeCandidate['asset']['origin']>;
    evidenceUrl?: string;
    sourceAsset: {
      url: string;
      sha256: string;
      mimeType: CatalogueSourceAssetMimeType;
      byteSize: number;
      width: number;
      height: number;
      retrievedAt: string;
    };
    generationRecord?: CatalogueGenerationRecord;
  };
  finalImage: {
    role: 'packshot';
    url: string;
    sha256: string;
    mimeType: CataloguePublicationImageMimeType;
    byteSize: number;
    width: number;
    height: number;
    packaging: 'intact';
    backgroundTreatment: 'none' | 'source-pixel-isolation' | 'identity-verified-render';
    labelVariantSizeUnchanged: true;
    packagingInvented: false;
    manualSourceOutputQa: true;
    presentationQuality: 'magazine-ready';
    reviewedAt: string;
    reviewer: string;
  };
  approval: CataloguePublicationApproval;
};

export type CataloguePublicationDossierManifest = {
  schemaVersion: typeof cataloguePublicationDossierSchemaVersion;
  exposure: typeof cataloguePublicationExposure;
  dossiers: CataloguePublicationDossier[];
};

const hashPattern = /^[0-9a-f]{64}$/;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter(key => record[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function cloneOfficialIdentityExtraction(
  extraction: CatalogueOfficialIdentityExtraction,
): CatalogueOfficialIdentityExtraction {
  if (extraction.schemaVersion === catalogueManufacturerSkuIdentityExtractionSchemaVersion) {
    return {
      ...extraction,
      productRecord: { ...extraction.productRecord },
      fields: {
        manufacturerBrand: { ...extraction.fields.manufacturerBrand },
        ...(extraction.fields.manufacturerBrandAliases
          ? {
            manufacturerBrandAliases:
              extraction.fields.manufacturerBrandAliases.map(alias => ({ ...alias })),
          }
          : {}),
        manufacturerSku: { ...extraction.fields.manufacturerSku },
        variant: { ...extraction.fields.variant },
        size: { ...extraction.fields.size },
        packageVersion: { ...extraction.fields.packageVersion },
        gtinPublicationStatus: {
          ...extraction.fields.gtinPublicationStatus,
          ...(extraction.fields.gtinPublicationStatus.absenceProof
            ? {
              absenceProof: {
                ...extraction.fields.gtinPublicationStatus.absenceProof,
                searchedTerms: [...extraction.fields.gtinPublicationStatus.absenceProof.searchedTerms],
              },
            }
            : {}),
        },
      },
      browserCapture: { ...extraction.browserCapture },
    };
  }
  if (extraction.schemaVersion === 6) {
    return {
      ...extraction,
      fields: {
        gtin: { ...extraction.fields.gtin },
        variant: { ...extraction.fields.variant },
        size: { ...extraction.fields.size },
        packageVersion: { ...extraction.fields.packageVersion },
      },
      supplementalResponses: extraction.supplementalResponses.map(response => ({ ...response })),
      browserCapture: { ...extraction.browserCapture },
      identifierCorroborations: extraction.identifierCorroborations.map(corroboration => ({
        ...corroboration,
        fields: {
          gtin: { ...corroboration.fields.gtin },
          variant: { ...corroboration.fields.variant },
          size: { ...corroboration.fields.size },
        },
        browserCapture: { ...corroboration.browserCapture },
      })),
    };
  }
  if (extraction.schemaVersion === 5) {
    return {
      ...extraction,
      fields: {
        gtin: { ...extraction.fields.gtin },
        variant: { ...extraction.fields.variant },
        size: { ...extraction.fields.size },
        manufacturerIdentifierStatus: { ...extraction.fields.manufacturerIdentifierStatus },
        packageVersion: { ...extraction.fields.packageVersion },
      },
      supplementalResponses: extraction.supplementalResponses.map(response => ({ ...response })),
      browserCapture: { ...extraction.browserCapture },
      identifierCorroborations: extraction.identifierCorroborations.map(corroboration => ({
        ...corroboration,
        fields: {
          gtin: { ...corroboration.fields.gtin },
          variant: { ...corroboration.fields.variant },
          size: { ...corroboration.fields.size },
        },
        browserCapture: { ...corroboration.browserCapture },
      })),
    };
  }
  const fields = {
    gtin: { ...extraction.fields.gtin },
    variant: { ...extraction.fields.variant },
    size: { ...extraction.fields.size },
  };
  if (extraction.schemaVersion === 4) {
    return {
      ...extraction,
      fields,
      ...(extraction.supplementalResponses
        ? { supplementalResponses: extraction.supplementalResponses.map(response => ({ ...response })) }
        : {}),
      browserCapture: { ...extraction.browserCapture },
    };
  }
  return {
    ...extraction,
    fields,
    ...(extraction.supplementalResponses
      ? { supplementalResponses: extraction.supplementalResponses.map(response => ({ ...response })) }
      : {}),
  };
}

function cloneOfficialIdentityEvidence(
  evidence: CatalogueCandidateOfficialIdentityEvidence,
): CatalogueCandidateOfficialIdentityEvidence {
  if ('identityKind' in evidence) {
    if (
      evidence.identityKind !== 'manufacturer-sku'
      || Object.prototype.hasOwnProperty.call(evidence, 'observedGtin')
      || evidence.canonicalExtraction.schemaVersion
        !== catalogueManufacturerSkuIdentityExtractionSchemaVersion
    ) throw new Error('Manufacturer identity evidence is ambiguous.');
    return {
      ...evidence,
      canonicalExtraction: cloneOfficialIdentityExtraction(
        evidence.canonicalExtraction,
      ) as CatalogueManufacturerSkuIdentityExtraction,
    };
  }
  if (
    Object.prototype.hasOwnProperty.call(evidence, 'observedManufacturerSku')
    || Object.prototype.hasOwnProperty.call(evidence, 'observedManufacturerSkuLabel')
    || typeof evidence.observedGtin !== 'string'
  ) throw new Error('GTIN identity evidence is ambiguous.');
  return {
    ...evidence,
    canonicalExtraction: cloneOfficialIdentityExtraction(
      evidence.canonicalExtraction,
    ) as Exclude<CatalogueOfficialIdentityExtraction, CatalogueManufacturerSkuIdentityExtraction>,
  };
}

function fingerprint(domain: string, value: unknown) {
  return createHash('sha256').update(`${domain}\n${stableJson(value)}`).digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function parsedDate(value: string, label: string, asOf: number) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > asOf + 5 * 60_000) {
    throw new Error(`${label} is invalid or in the future.`);
  }
  return timestamp;
}

function required<T>(value: T | null | undefined, label: string): T {
  if (value == null || (typeof value === 'string' && !value.trim())) throw new Error(`${label} is required.`);
  return value;
}

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function boundBrandSellerEvidence(
  candidate: CatalogueIntakeCandidate,
  offers: readonly CatalogueIntakeOffer[],
  marketRoute: CatalogueNigeriaMarketRoute,
  asOf: number,
) {
  if (
    marketRoute !== 'brand-authorized'
    || candidate.nigeria.tierAIdentityEvidenceUrl !== undefined
    || !catalogueBrandAuthorizationSourceValid(candidate, candidate.nigeria.brandAuthorizationEvidenceUrl)
  ) return [];
  return offers.flatMap(offer => {
    const retailer = nigeriaRetailers.find(item => normalized(item.name) === normalized(offer.retailer));
    if (!retailer) return [];
    const evidence = reviewedBrandSellerEvidenceFor(
      retailer,
      candidate.nigeria.brandAuthorizationEvidenceUrl,
      asOf,
    );
    if (!evidence) return [];
    return [{
      retailer: retailer.name,
      listingHost: new URL(offer.listingUrl).hostname.replace(/^www\./, '').toLowerCase(),
      evidence: {
        observedAt: evidence.observedAt,
        sourceUrl: evidence.sourceUrl,
        basis: evidence.basis,
        scope: evidence.scope,
        subjectSeller: evidence.subjectSeller,
        subjectHost: evidence.subjectHost,
        locator: evidence.locator,
        sourceText: evidence.sourceText,
        sourceExcerptSha256: evidence.sourceExcerptSha256,
        responseUrl: evidence.responseUrl,
        responseSha256: evidence.responseSha256,
        responseDigestScope: evidence.responseDigestScope,
        responseMimeType: evidence.responseMimeType,
        responseByteSize: evidence.responseByteSize,
        retrievedAt: evidence.retrievedAt,
        reviewer: evidence.reviewer,
        reviewedAt: evidence.reviewedAt,
      },
    }];
  });
}

export function catalogueIntakeCandidateFingerprint(candidate: CatalogueIntakeCandidate) {
  return fingerprint('jelocare-catalogue-intake-candidate-v8', candidate);
}

function createCataloguePublicationDossierCore(
  candidate: CatalogueIntakeCandidate,
  approval: CataloguePublicationApproval,
  asOf = Date.now(),
): CataloguePublicationDossier {
  auditCatalogueIntakeCandidates([candidate], asOf);
  const decision = evaluateCatalogueIntakeCandidate(candidate, asOf);
  if (!decision.approvalDraftReady) {
    throw new Error(`${candidate.id} is not approval-ready (${decision.stage}: ${decision.blockers.join(', ')}).`);
  }
  if (approval.scope !== cataloguePublicationApprovalScope) throw new Error(`${candidate.id} has an invalid approval scope.`);
  if (approval.reviewer.trim().length < 2) throw new Error(`${candidate.id} approval reviewer is missing.`);

  const approvedAt = parsedDate(approval.approvedAt, `${candidate.id} approval timestamp`, asOf);
  const officialIdentity = required(candidate.identity.officialEvidence, `${candidate.id} official identity evidence`);
  const canonicalIdentifier = required(
    catalogueCanonicalIdentifierFor(candidate.identity),
    `${candidate.id} canonical identifier`,
  );
  const identityCheckedAt = required(candidate.identity.checkedAt, `${candidate.id} identity timestamp`);
  const identityEvidenceRetrievedAt = required(officialIdentity.retrievedAt, `${candidate.id} official identity retrieval timestamp`);
  const careReviewedAt = required(candidate.care.reviewedAt, `${candidate.id} care review timestamp`);
  const sourceAssetRetrievedAt = required(candidate.asset.sourceAssetRetrievedAt, `${candidate.id} source asset retrieval timestamp`);
  const artReviewedAt = required(candidate.asset.artReviewedAt, `${candidate.id} art review timestamp`);
  const identityCheckedTimestamp = parsedDate(identityCheckedAt, `${candidate.id} identity timestamp`, asOf);
  const identityEvidenceRetrievedTimestamp = parsedDate(
    identityEvidenceRetrievedAt,
    `${candidate.id} official identity retrieval timestamp`,
    asOf,
  );
  const sourceAssetRetrievedTimestamp = parsedDate(
    sourceAssetRetrievedAt,
    `${candidate.id} source asset retrieval timestamp`,
    asOf,
  );
  const artReviewedTimestamp = parsedDate(artReviewedAt, `${candidate.id} art review timestamp`, asOf);
  const regulatoryEvidence = candidate.nigeria.regulatoryEvidence;
  if (candidate.nigeria.regulatoryStatus !== 'pending' && !regulatoryEvidence) {
    throw new Error(`${candidate.id} regulatory evidence is required.`);
  }
  const nigeriaMarketRoute = required(decision.nigeriaMarketRoute, `${candidate.id} Nigeria market route`);
  const brandSellerAuthorizationEvidence = boundBrandSellerEvidence(
    candidate,
    decision.freshExactOffers,
    nigeriaMarketRoute,
    asOf,
  );
  if (identityEvidenceRetrievedTimestamp > identityCheckedTimestamp) {
    throw new Error(`${candidate.id} identity review predates its official evidence snapshot.`);
  }
  if (sourceAssetRetrievedTimestamp > artReviewedTimestamp) {
    throw new Error(`${candidate.id} art review predates its source asset retrieval.`);
  }
  const generatedTimestamp = candidate.asset.generationRecord
    ? parsedDate(candidate.asset.generationRecord.generatedAt, `${candidate.id} generation timestamp`, asOf)
    : undefined;
  if (generatedTimestamp != null && (
    generatedTimestamp < sourceAssetRetrievedTimestamp
    || generatedTimestamp > artReviewedTimestamp
  )) throw new Error(`${candidate.id} generation must follow source retrieval and precede art review.`);
  const evidenceTimes = [
    identityCheckedTimestamp,
    identityEvidenceRetrievedTimestamp,
    parsedDate(careReviewedAt, `${candidate.id} care review timestamp`, asOf),
    ...(regulatoryEvidence ? [
      parsedDate(regulatoryEvidence.retrievedAt, `${candidate.id} regulatory retrieval timestamp`, asOf),
      parsedDate(regulatoryEvidence.observedAt, `${candidate.id} regulatory observation timestamp`, asOf),
      parsedDate(regulatoryEvidence.reviewedAt, `${candidate.id} regulatory review timestamp`, asOf),
    ] : []),
    sourceAssetRetrievedTimestamp,
    artReviewedTimestamp,
    ...(generatedTimestamp == null ? [] : [generatedTimestamp]),
    ...decision.freshExactOffers.flatMap(offer => [
      parsedDate(offer.observedAt, `${candidate.id} offer timestamp`, asOf),
      parsedDate(required(offer.evidence?.retrievedAt, `${candidate.id} offer evidence retrieval timestamp`), `${candidate.id} offer evidence retrieval timestamp`, asOf),
      parsedDate(required(offer.evidence?.reviewedAt, `${candidate.id} offer evidence review timestamp`), `${candidate.id} offer evidence review timestamp`, asOf),
    ]),
    ...brandSellerAuthorizationEvidence.map(item => (
      parsedDate(item.evidence.observedAt, `${candidate.id} seller authorization observation timestamp`, asOf)
    )),
    ...brandSellerAuthorizationEvidence.flatMap(item => [
      parsedDate(item.evidence.retrievedAt, `${candidate.id} seller authorization retrieval timestamp`, asOf),
      parsedDate(item.evidence.reviewedAt, `${candidate.id} seller authorization review timestamp`, asOf),
    ]),
  ];
  if (approvedAt < Math.max(...evidenceTimes)) throw new Error(`${candidate.id} approval predates its bound evidence.`);

  const candidateFingerprint = catalogueIntakeCandidateFingerprint(candidate);
  const payload = {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    candidateId: candidate.id,
    candidateFingerprint,
    exposure: cataloguePublicationExposure,
    publicationScope: cataloguePublicationScope,
    publicationStatus: 'not-published' as const,
    recommendationEligible: false as const,
    identity: {
      ...(canonicalIdentifier.kind === 'gtin'
        ? {
          gtin: required(catalogueGtinForIdentity(candidate.identity), `${candidate.id} GTIN`),
          ...(candidate.identity.officialProductCrosswalk
            ? { officialProductCrosswalk: { ...candidate.identity.officialProductCrosswalk } }
            : {}),
        }
        : {
          canonicalIdentifier,
          officialProductCrosswalk: {
            ...required(
              candidate.identity.officialProductCrosswalk,
              `${candidate.id} official product identity crosswalk`,
            ),
          },
        }),
      brand: candidate.brand,
      name: candidate.name,
      variant: candidate.variant,
      size: candidate.size,
      ...(candidate.identity.packageVersion
        ? { packageVersion: candidate.identity.packageVersion }
        : {}),
      category: candidate.category,
    },
    sourceEvidence: {
      basis: required(candidate.identity.basis, `${candidate.id} identity basis`),
      officialProductUrl: required(candidate.identity.officialProductUrl, `${candidate.id} official source`),
      officialIdentity: {
        ...cloneOfficialIdentityEvidence(officialIdentity),
        retrievedAt: identityEvidenceRetrievedAt,
      },
      checkedAt: identityCheckedAt,
      demandEvidenceUrls: [...candidate.demandEvidenceUrls],
    },
    care: {
      status: candidate.care.status as 'reviewed',
      formulaArchetype: required(candidate.care.formulaArchetype, `${candidate.id} formula archetype`),
      careTier: required(candidate.care.careTier, `${candidate.id} care tier`),
      reviewScope: required(candidate.care.reviewScope, `${candidate.id} care review scope`),
      advisoryBoundary: required(candidate.care.advisoryBoundary, `${candidate.id} advisory boundary`),
      manufacturerEvidenceUrl: required(
        candidate.care.manufacturerEvidenceUrl,
        `${candidate.id} manufacturer care evidence`,
      ),
      independentClinicalGuidanceUrl: required(
        candidate.care.independentClinicalGuidanceUrl,
        `${candidate.id} independent clinical guidance`,
      ),
      evidenceUrls: [...candidate.care.evidenceUrls],
      reviewedAt: careReviewedAt,
      reviewer: required(candidate.care.reviewer, `${candidate.id} care reviewer`),
    },
    nigeria: {
      marketRoute: nigeriaMarketRoute,
      regulatoryStatus: candidate.nigeria.regulatoryStatus,
      ...(regulatoryEvidence ? { regulatoryEvidence: structuredClone(regulatoryEvidence) } : {}),
      ...(nigeriaMarketRoute === 'tier-a'
        ? { tierAIdentityEvidenceUrl: required(candidate.nigeria.tierAIdentityEvidenceUrl, `${candidate.id} Tier-A evidence`) }
        : {
          brandAuthorizationEvidenceUrl: required(
            candidate.nigeria.brandAuthorizationEvidenceUrl,
            `${candidate.id} brand authorization evidence`,
          ),
        }),
      exactOffers: decision.freshExactOffers.map(offer => structuredClone(offer)),
      brandSellerAuthorizationEvidence,
    },
    rights: {
      status: candidate.asset.rightsStatus as 'documented',
      origin: required(candidate.asset.origin, `${candidate.id} asset origin`),
      ...(candidate.asset.origin !== 'owned-identity-verified-render'
        ? { evidenceUrl: required(candidate.asset.rightsUrl, `${candidate.id} rights evidence`) }
        : {}),
      sourceAsset: {
        url: required(candidate.asset.sourceUrl, `${candidate.id} source asset`),
        sha256: required(candidate.asset.sourceAssetSha256, `${candidate.id} source asset hash`),
        mimeType: required(candidate.asset.sourceAssetMimeType, `${candidate.id} source asset MIME type`),
        byteSize: required(candidate.asset.sourceAssetByteSize, `${candidate.id} source asset byte size`),
        width: required(candidate.asset.sourceAssetWidth, `${candidate.id} source asset width`),
        height: required(candidate.asset.sourceAssetHeight, `${candidate.id} source asset height`),
        retrievedAt: sourceAssetRetrievedAt,
      },
      ...(candidate.asset.generationRecord
        ? {
          generationRecord: {
            schemaVersion: candidate.asset.generationRecord.schemaVersion,
            provider: candidate.asset.generationRecord.provider,
            model: candidate.asset.generationRecord.model,
            prompt: candidate.asset.generationRecord.prompt,
            inputs: candidate.asset.generationRecord.inputs.map(input => ({ ...input })),
            outputSha256: candidate.asset.generationRecord.outputSha256,
            generatedAt: candidate.asset.generationRecord.generatedAt,
            recordSha256: candidate.asset.generationRecord.recordSha256,
          },
        }
        : {}),
    },
    finalImage: {
      role: candidate.asset.role as 'packshot',
      url: required(candidate.asset.publicImageUrl, `${candidate.id} final image`),
      sha256: required(candidate.asset.publicImageSha256, `${candidate.id} final image hash`),
      mimeType: required(candidate.asset.publicImageMimeType, `${candidate.id} final image MIME type`),
      byteSize: required(candidate.asset.publicImageByteSize, `${candidate.id} final image byte size`),
      width: required(candidate.asset.width, `${candidate.id} final image width`),
      height: required(candidate.asset.height, `${candidate.id} final image height`),
      packaging: candidate.asset.packaging as 'intact',
      backgroundTreatment: candidate.asset.backgroundTreatment as 'none' | 'source-pixel-isolation' | 'identity-verified-render',
      labelVariantSizeUnchanged: candidate.asset.labelVariantSizeUnchanged as true,
      packagingInvented: candidate.asset.packagingInvented as false,
      manualSourceOutputQa: candidate.asset.manualSourceOutputQa as true,
      presentationQuality: candidate.asset.presentationQuality as 'magazine-ready',
      reviewedAt: artReviewedAt,
      reviewer: required(candidate.asset.artReviewer, `${candidate.id} art reviewer`),
    },
    approval: {
      scope: approval.scope,
      reviewer: approval.reviewer.trim(),
      approvedAt: approval.approvedAt,
    },
  };
  const dossierFingerprint = fingerprint('jelocare-catalogue-publication-dossier-v8', payload);
  return deepFreeze({ ...payload, dossierFingerprint });
}

/**
 * Pure structural constructor retained for the immutable per-SKU compiler and
 * deterministic tests. Production publication entrypoints must use
 * `createVerifiedCataloguePublicationDossier` so retained bytes are reopened.
 */
export function createCataloguePublicationDossier(
  candidate: CatalogueIntakeCandidate,
  approval: CataloguePublicationApproval,
  asOf = Date.now(),
): CataloguePublicationDossier {
  return createCataloguePublicationDossierCore(candidate, approval, asOf);
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function approvalFromStoredDossier(value: Record<string, unknown>, candidateId: string): CataloguePublicationApproval {
  const approval = objectRecord(value.approval, `${candidateId} approval`);
  if (
    approval.scope !== cataloguePublicationApprovalScope
    || typeof approval.reviewer !== 'string'
    || typeof approval.approvedAt !== 'string'
  ) throw new Error(`${candidateId} approval metadata is invalid.`);
  return approval as CataloguePublicationApproval;
}

function verifyCataloguePublicationDossierManifestCore(
  candidates: readonly CatalogueIntakeCandidate[],
  manifest: unknown,
  asOf = Date.now(),
) {
  auditCatalogueIntakeCandidates(candidates, asOf);
  const source = objectRecord(manifest, 'Catalogue publication dossier manifest');
  if (source.schemaVersion !== cataloguePublicationDossierSchemaVersion) throw new Error('Unsupported catalogue publication dossier schema.');
  if (source.exposure !== cataloguePublicationExposure) throw new Error('Catalogue publication dossiers must remain private-only.');
  if (!Array.isArray(source.dossiers)) throw new Error('Catalogue publication dossier manifest must contain a dossiers array.');

  const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const seenCandidates = new Set<string>();
  const seenFingerprints = new Set<string>();
  const seenImageHashes = new Set<string>();
  const dossiers = source.dossiers.map((value, index) => {
    const stored = objectRecord(value, `Catalogue publication dossier ${index}`);
    if (typeof stored.candidateId !== 'string' || !stored.candidateId) throw new Error(`Catalogue publication dossier ${index} has no candidate ID.`);
    const candidateId = stored.candidateId;
    if (seenCandidates.has(candidateId)) throw new Error(`Duplicate catalogue publication dossier: ${candidateId}`);
    seenCandidates.add(candidateId);

    const candidate = candidateById.get(candidateId);
    if (!candidate) throw new Error(`Catalogue publication dossier ${candidateId} has no current intake candidate.`);
    const currentCandidateFingerprint = catalogueIntakeCandidateFingerprint(candidate);
    if (stored.candidateFingerprint !== currentCandidateFingerprint) {
      throw new Error(`${candidateId} candidate fingerprint changed; approval is invalid.`);
    }

    const expected = createCataloguePublicationDossierCore(
      candidate,
      approvalFromStoredDossier(stored, candidateId),
      asOf,
    );
    if (typeof stored.dossierFingerprint !== 'string' || !hashPattern.test(stored.dossierFingerprint)) {
      throw new Error(`${candidateId} dossier fingerprint is invalid.`);
    }
    if (seenFingerprints.has(stored.dossierFingerprint)) throw new Error(`Duplicate catalogue publication fingerprint: ${stored.dossierFingerprint}`);
    seenFingerprints.add(stored.dossierFingerprint);
    if (stableJson(stored) !== stableJson(expected)) throw new Error(`${candidateId} dossier content or fingerprint changed; approval is invalid.`);
    if (seenImageHashes.has(expected.finalImage.sha256)) {
      throw new Error(`${candidateId} reuses another catalogue publication image hash.`);
    }
    seenImageHashes.add(expected.finalImage.sha256);
    return expected;
  });

  return {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    exposure: cataloguePublicationExposure,
    dossierCount: dossiers.length,
    publicProductCount: 0 as const,
    dossiers,
  };
}

/**
 * Pure structural verification retained for source compilation. Production
 * release gates use the artifact-aware wrapper below.
 */
export function verifyCataloguePublicationDossierManifest(
  candidates: readonly CatalogueIntakeCandidate[],
  manifest: unknown,
  asOf = Date.now(),
) {
  return verifyCataloguePublicationDossierManifestCore(candidates, manifest, asOf);
}

export type CataloguePublicationVerificationOptions = {
  repositoryRoot?: string;
  asOf?: number;
};

/**
 * Production dossier creation is deliberately asynchronous: the boundary
 * reopens every retained identity/offer artifact before it can mint a dossier.
 */
export async function createVerifiedCataloguePublicationDossier(
  candidate: CatalogueIntakeCandidate,
  approval: CataloguePublicationApproval,
  options: CataloguePublicationVerificationOptions = {},
): Promise<CataloguePublicationDossier> {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const asOf = options.asOf ?? Date.now();
  await verifyCatalogueIdentityEvidenceArtifacts([candidate], repositoryRoot);
  return createCataloguePublicationDossierCore(candidate, approval, asOf);
}

/**
 * Verifies retained bytes first, then verifies the immutable dossier manifest.
 * No production caller can obtain a successful report from metadata alone.
 */
export async function verifyCataloguePublicationDossierManifestWithArtifacts(
  candidates: readonly CatalogueIntakeCandidate[],
  manifest: unknown,
  options: CataloguePublicationVerificationOptions = {},
) {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const asOf = options.asOf ?? Date.now();
  await verifyCatalogueIdentityEvidenceArtifacts(candidates, repositoryRoot);
  return verifyCataloguePublicationDossierManifestCore(candidates, manifest, asOf);
}
