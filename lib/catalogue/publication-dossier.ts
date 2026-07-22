import { createHash } from 'node:crypto';
import {
  auditCatalogueIntakeCandidates,
  evaluateCatalogueIntakeCandidate,
  type CatalogueIntakeCandidate,
  type CatalogueIntakeOffer,
} from './intake-readiness';

export const cataloguePublicationDossierSchemaVersion = 1 as const;
export const cataloguePublicationApprovalScope = 'exact-identity-source-care-nigeria-rights-and-final-image' as const;
export const cataloguePublicationExposure = 'private-only' as const;

export type CataloguePublicationApproval = {
  scope: typeof cataloguePublicationApprovalScope;
  reviewer: string;
  approvedAt: string;
};

export type CataloguePublicationDossier = {
  schemaVersion: typeof cataloguePublicationDossierSchemaVersion;
  candidateId: string;
  candidateFingerprint: string;
  dossierFingerprint: string;
  exposure: typeof cataloguePublicationExposure;
  publicationStatus: 'not-published';
  recommendationEligible: false;
  identity: {
    gtin: string;
    brand: string;
    name: string;
    variant: string;
    size: string;
    category: CatalogueIntakeCandidate['category'];
  };
  sourceEvidence: {
    basis: 'official-brand';
    officialProductUrl: string;
    checkedAt: string;
    demandEvidenceUrls: string[];
  };
  care: {
    status: 'reviewed';
    formulaArchetype: string;
    evidenceUrls: string[];
    reviewedAt: string;
    reviewer: string;
  };
  nigeria: {
    regulatoryStatus: 'matched' | 'not-required';
    regulatoryEvidenceUrl: string;
    tierAIdentityEvidenceUrl?: string;
    brandAuthorizationEvidenceUrl?: string;
    exactOffers: CatalogueIntakeOffer[];
  };
  rights: {
    status: 'documented';
    origin: NonNullable<CatalogueIntakeCandidate['asset']['origin']>;
    evidenceUrl: string;
    sourceAssetUrl: string;
  };
  finalImage: {
    url: string;
    sha256: string;
    width: number;
    height: number;
    packaging: 'intact';
    backgroundTreatment: 'none' | 'styled-composite' | 'source-pixel-isolation';
    labelVariantSizeUnchanged: true;
    packagingInvented: false;
    manualSourceOutputQa: true;
    presentationQuality: 'magazine-ready';
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

export function catalogueIntakeCandidateFingerprint(candidate: CatalogueIntakeCandidate) {
  return fingerprint('jelocare-catalogue-intake-candidate-v1', candidate);
}

export function createCataloguePublicationDossier(
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
  const identityCheckedAt = required(candidate.identity.checkedAt, `${candidate.id} identity timestamp`);
  const careReviewedAt = required(candidate.care.reviewedAt, `${candidate.id} care review timestamp`);
  const evidenceTimes = [
    parsedDate(identityCheckedAt, `${candidate.id} identity timestamp`, asOf),
    parsedDate(careReviewedAt, `${candidate.id} care review timestamp`, asOf),
    ...decision.freshExactOffers.map(offer => parsedDate(offer.observedAt, `${candidate.id} offer timestamp`, asOf)),
  ];
  if (approvedAt < Math.max(...evidenceTimes)) throw new Error(`${candidate.id} approval predates its bound evidence.`);

  const candidateFingerprint = catalogueIntakeCandidateFingerprint(candidate);
  const payload = {
    schemaVersion: cataloguePublicationDossierSchemaVersion,
    candidateId: candidate.id,
    candidateFingerprint,
    exposure: cataloguePublicationExposure,
    publicationStatus: 'not-published' as const,
    recommendationEligible: false as const,
    identity: {
      gtin: required(candidate.identity.gtin, `${candidate.id} GTIN`),
      brand: candidate.brand,
      name: candidate.name,
      variant: candidate.variant,
      size: candidate.size,
      category: candidate.category,
    },
    sourceEvidence: {
      basis: required(candidate.identity.basis, `${candidate.id} identity basis`),
      officialProductUrl: required(candidate.identity.officialProductUrl, `${candidate.id} official source`),
      checkedAt: identityCheckedAt,
      demandEvidenceUrls: [...candidate.demandEvidenceUrls],
    },
    care: {
      status: candidate.care.status as 'reviewed',
      formulaArchetype: required(candidate.care.formulaArchetype, `${candidate.id} formula archetype`),
      evidenceUrls: [...candidate.care.evidenceUrls],
      reviewedAt: careReviewedAt,
      reviewer: required(candidate.care.reviewer, `${candidate.id} care reviewer`),
    },
    nigeria: {
      regulatoryStatus: candidate.nigeria.regulatoryStatus as 'matched' | 'not-required',
      regulatoryEvidenceUrl: required(candidate.nigeria.regulatoryEvidenceUrl, `${candidate.id} regulatory evidence`),
      ...(candidate.nigeria.tierAIdentityEvidenceUrl ? { tierAIdentityEvidenceUrl: candidate.nigeria.tierAIdentityEvidenceUrl } : {}),
      ...(candidate.nigeria.brandAuthorizationEvidenceUrl ? { brandAuthorizationEvidenceUrl: candidate.nigeria.brandAuthorizationEvidenceUrl } : {}),
      exactOffers: decision.freshExactOffers.map(offer => ({ ...offer })),
    },
    rights: {
      status: candidate.asset.rightsStatus as 'documented',
      origin: required(candidate.asset.origin, `${candidate.id} asset origin`),
      evidenceUrl: required(candidate.asset.rightsUrl, `${candidate.id} rights evidence`),
      sourceAssetUrl: required(candidate.asset.sourceUrl, `${candidate.id} source asset`),
    },
    finalImage: {
      url: required(candidate.asset.publicImageUrl, `${candidate.id} final image`),
      sha256: required(candidate.asset.publicImageSha256, `${candidate.id} final image hash`),
      width: required(candidate.asset.width, `${candidate.id} final image width`),
      height: required(candidate.asset.height, `${candidate.id} final image height`),
      packaging: candidate.asset.packaging as 'intact',
      backgroundTreatment: candidate.asset.backgroundTreatment as 'none' | 'styled-composite' | 'source-pixel-isolation',
      labelVariantSizeUnchanged: candidate.asset.labelVariantSizeUnchanged as true,
      packagingInvented: candidate.asset.packagingInvented as false,
      manualSourceOutputQa: candidate.asset.manualSourceOutputQa as true,
      presentationQuality: candidate.asset.presentationQuality as 'magazine-ready',
    },
    approval: {
      scope: approval.scope,
      reviewer: approval.reviewer.trim(),
      approvedAt: approval.approvedAt,
    },
  };
  const dossierFingerprint = fingerprint('jelocare-catalogue-publication-dossier-v1', payload);
  return deepFreeze({ ...payload, dossierFingerprint });
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

export function verifyCataloguePublicationDossierManifest(
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

    const expected = createCataloguePublicationDossier(candidate, approvalFromStoredDossier(stored, candidateId), asOf);
    if (typeof stored.dossierFingerprint !== 'string' || !hashPattern.test(stored.dossierFingerprint)) {
      throw new Error(`${candidateId} dossier fingerprint is invalid.`);
    }
    if (seenFingerprints.has(stored.dossierFingerprint)) throw new Error(`Duplicate catalogue publication fingerprint: ${stored.dossierFingerprint}`);
    seenFingerprints.add(stored.dossierFingerprint);
    if (stableJson(stored) !== stableJson(expected)) throw new Error(`${candidateId} dossier content or fingerprint changed; approval is invalid.`);
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
