import { createHash } from 'node:crypto';
import { nigeriaRetailers } from '@/data/retailers';
import type { Offer, Product } from '@/data/products';
import type { CatalogueIntakeCandidate } from './intake-readiness';
import {
  verifyCataloguePublicationDossierManifest,
  type CataloguePublicationDossier,
} from './publication-dossier';

export const cataloguePublicationReleaseSchemaVersion = 1 as const;
export const cataloguePublicationReleaseExposure = 'public-catalogue' as const;
export const cataloguePublicationReleaseApprovalScope = 'exact-dossier-presentation-publication' as const;

export type CataloguePublicationPresentation = {
  category: Product['category'];
  routineStep: string;
  displayLine: string;
  usage: string;
  manufacturerDirectionsUrl: string;
  reviewer: string;
  reviewedAt: string;
};

export type CataloguePublicationReleaseApproval = {
  scope: typeof cataloguePublicationReleaseApprovalScope;
  reviewer: string;
  publishedAt: string;
};

export type CataloguePublicationRelease = {
  schemaVersion: typeof cataloguePublicationReleaseSchemaVersion;
  candidateId: string;
  dossierFingerprint: string;
  releaseFingerprint: string;
  exposure: typeof cataloguePublicationReleaseExposure;
  publicationStatus: 'published';
  recommendationEligible: false;
  presentation: CataloguePublicationPresentation;
  publication: CataloguePublicationReleaseApproval;
};

export type CataloguePublicationReleaseManifest = {
  schemaVersion: typeof cataloguePublicationReleaseSchemaVersion;
  exposure: typeof cataloguePublicationReleaseExposure;
  releases: CataloguePublicationRelease[];
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

function fingerprint(value: unknown) {
  return createHash('sha256')
    .update(`jelocare-catalogue-publication-release-v1\n${stableJson(value)}`)
    .digest('hex');
}

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function parsedDate(value: string, label: string, asOf: number) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > asOf + 5 * 60_000) {
    throw new Error(`${label} is invalid or in the future.`);
  }
  return timestamp;
}

function cleanText(value: string, label: string, min: number, max: number) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < min || normalized.length > max || /[<>]/.test(normalized)) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function categoryForDossier(category: CataloguePublicationDossier['identity']['category']): Product['category'] {
  if (category === 'Face care') return 'Face';
  if (category === 'Hair & scalp') return 'Hair';
  if (category === 'Body care') return 'Body';
  throw new Error(`${category} has no approved public catalogue category mapping.`);
}

function normalizedPresentation(
  dossier: CataloguePublicationDossier,
  presentation: CataloguePublicationPresentation,
  asOf: number,
): CataloguePublicationPresentation {
  if (presentation.category !== categoryForDossier(dossier.identity.category)) {
    throw new Error(`${dossier.candidateId} presentation category does not match its dossier.`);
  }
  const directionsUrl = new URL(presentation.manufacturerDirectionsUrl);
  const allowedDirections = new Set([
    dossier.sourceEvidence.officialProductUrl,
    dossier.care.manufacturerEvidenceUrl,
    ...dossier.care.evidenceUrls,
  ]);
  if (directionsUrl.protocol !== 'https:' || !allowedDirections.has(directionsUrl.href)) {
    throw new Error(`${dossier.candidateId} usage directions are not bound to reviewed manufacturer evidence.`);
  }
  if (presentation.reviewer.trim().length < 2) {
    throw new Error(`${dossier.candidateId} presentation reviewer is missing.`);
  }
  const reviewedAt = parsedDate(presentation.reviewedAt, `${dossier.candidateId} presentation review`, asOf);
  const dossierApprovedAt = parsedDate(
    dossier.approval.approvedAt,
    `${dossier.candidateId} dossier approval`,
    asOf,
  );
  if (reviewedAt < dossierApprovedAt) {
    throw new Error(`${dossier.candidateId} presentation review predates its dossier approval.`);
  }

  return {
    category: presentation.category,
    routineStep: cleanText(presentation.routineStep, `${dossier.candidateId} routine step`, 2, 40),
    displayLine: cleanText(presentation.displayLine, `${dossier.candidateId} display line`, 3, 80),
    usage: cleanText(presentation.usage, `${dossier.candidateId} usage`, 10, 500),
    manufacturerDirectionsUrl: directionsUrl.href,
    reviewer: presentation.reviewer.trim(),
    reviewedAt: presentation.reviewedAt,
  };
}

export function createCataloguePublicationRelease(
  dossier: CataloguePublicationDossier,
  presentation: CataloguePublicationPresentation,
  publication: CataloguePublicationReleaseApproval,
  asOf = Date.now(),
): CataloguePublicationRelease {
  if (publication.scope !== cataloguePublicationReleaseApprovalScope) {
    throw new Error(`${dossier.candidateId} has an invalid publication scope.`);
  }
  if (publication.reviewer.trim().length < 2) {
    throw new Error(`${dossier.candidateId} publication reviewer is missing.`);
  }
  const normalizedProductPresentation = normalizedPresentation(dossier, presentation, asOf);
  const publishedAt = parsedDate(publication.publishedAt, `${dossier.candidateId} publication`, asOf);
  if (publishedAt < Date.parse(normalizedProductPresentation.reviewedAt)) {
    throw new Error(`${dossier.candidateId} publication predates its presentation review.`);
  }
  const payload = {
    schemaVersion: cataloguePublicationReleaseSchemaVersion,
    candidateId: dossier.candidateId,
    dossierFingerprint: dossier.dossierFingerprint,
    exposure: cataloguePublicationReleaseExposure,
    publicationStatus: 'published' as const,
    recommendationEligible: false as const,
    presentation: normalizedProductPresentation,
    publication: {
      scope: publication.scope,
      reviewer: publication.reviewer.trim(),
      publishedAt: publication.publishedAt,
    },
  };
  return { ...payload, releaseFingerprint: fingerprint(payload) };
}

function releaseInput(value: Record<string, unknown>, candidateId: string) {
  const presentation = objectRecord(value.presentation, `${candidateId} presentation`);
  const publication = objectRecord(value.publication, `${candidateId} publication`);
  if (
    (presentation.category !== 'Face' && presentation.category !== 'Hair' && presentation.category !== 'Body')
    || typeof presentation.routineStep !== 'string'
    || typeof presentation.displayLine !== 'string'
    || typeof presentation.usage !== 'string'
    || typeof presentation.manufacturerDirectionsUrl !== 'string'
    || typeof presentation.reviewer !== 'string'
    || typeof presentation.reviewedAt !== 'string'
  ) throw new Error(`${candidateId} presentation metadata is invalid.`);
  if (
    publication.scope !== cataloguePublicationReleaseApprovalScope
    || typeof publication.reviewer !== 'string'
    || typeof publication.publishedAt !== 'string'
  ) throw new Error(`${candidateId} publication metadata is invalid.`);
  return {
    presentation: presentation as CataloguePublicationPresentation,
    publication: publication as CataloguePublicationReleaseApproval,
  };
}

function offerForDossier(
  offer: CataloguePublicationDossier['nigeria']['exactOffers'][number],
): Offer {
  const retailer = nigeriaRetailers.find(item => normalized(item.name) === normalized(offer.retailer));
  if (!retailer) throw new Error(`${offer.retailer} is not in the reviewed Nigerian retailer registry.`);
  return {
    retailer: retailer.name,
    url: offer.listingUrl,
    trust: retailer.trust,
    available: offer.stock !== 'out-of-stock',
    priceNgn: offer.priceNgn,
    checkedAt: offer.observedAt,
    match: 'exact',
    listingEvidence: {
      observedAt: offer.observedAt,
      sourceUrl: offer.listingUrl,
      basis: 'retailer-page',
    },
    priceObservation: {
      observedAt: offer.observedAt,
      variant: offer.observedTitle,
      size: offer.observedSize,
      stock: offer.stock,
      landedCost: 'unknown',
    },
    priceComparison: 'include',
    location: ['NG'],
  };
}

export function materializeCataloguePublicationRelease(
  dossier: CataloguePublicationDossier,
  release: CataloguePublicationRelease,
): Product {
  if (release.candidateId !== dossier.candidateId || release.dossierFingerprint !== dossier.dossierFingerprint) {
    throw new Error(`${release.candidateId} release is not bound to its dossier.`);
  }
  return {
    slug: dossier.candidateId,
    brand: dossier.identity.brand,
    name: dossier.identity.name,
    size: dossier.identity.size,
    category: release.presentation.category,
    step: release.presentation.routineStep,
    image: dossier.finalImage.url,
    displayLine: release.presentation.displayLine,
    bestFor: [],
    concerns: [],
    skinTypes: [],
    sensitiveFriendly: false,
    usage: release.presentation.usage,
    evidence: 'emerging',
    verifiedIngredientIds: [],
    offers: dossier.nigeria.exactOffers.map(offerForDossier),
  };
}

export function verifyCataloguePublicationReleaseManifest(
  candidates: readonly CatalogueIntakeCandidate[],
  dossierManifest: unknown,
  manifest: unknown,
  asOf = Date.now(),
) {
  const dossierReport = verifyCataloguePublicationDossierManifest(candidates, dossierManifest, asOf);
  const source = objectRecord(manifest, 'Catalogue publication release manifest');
  if (source.schemaVersion !== cataloguePublicationReleaseSchemaVersion) {
    throw new Error('Unsupported catalogue publication release schema.');
  }
  if (source.exposure !== cataloguePublicationReleaseExposure) {
    throw new Error('Catalogue publication releases must use the public-catalogue exposure.');
  }
  if (!Array.isArray(source.releases)) {
    throw new Error('Catalogue publication release manifest must contain a releases array.');
  }

  const dossierByCandidate = new Map(dossierReport.dossiers.map(dossier => [dossier.candidateId, dossier]));
  const seenCandidates = new Set<string>();
  const seenFingerprints = new Set<string>();
  const seenGtins = new Set<string>();
  const releases = source.releases.map((value, index) => {
    const stored = objectRecord(value, `Catalogue publication release ${index}`);
    if (typeof stored.candidateId !== 'string' || !stored.candidateId) {
      throw new Error(`Catalogue publication release ${index} has no candidate ID.`);
    }
    const candidateId = stored.candidateId;
    if (seenCandidates.has(candidateId)) throw new Error(`Duplicate catalogue publication release: ${candidateId}`);
    seenCandidates.add(candidateId);
    const dossier = dossierByCandidate.get(candidateId);
    if (!dossier) throw new Error(`${candidateId} has no current verified publication dossier.`);
    if (stored.dossierFingerprint !== dossier.dossierFingerprint) {
      throw new Error(`${candidateId} release dossier fingerprint changed; publication is invalid.`);
    }
    const input = releaseInput(stored, candidateId);
    const expected = createCataloguePublicationRelease(dossier, input.presentation, input.publication, asOf);
    if (typeof stored.releaseFingerprint !== 'string' || !hashPattern.test(stored.releaseFingerprint)) {
      throw new Error(`${candidateId} release fingerprint is invalid.`);
    }
    if (seenFingerprints.has(stored.releaseFingerprint)) {
      throw new Error(`Duplicate catalogue publication release fingerprint: ${stored.releaseFingerprint}`);
    }
    seenFingerprints.add(stored.releaseFingerprint);
    if (stableJson(stored) !== stableJson(expected)) {
      throw new Error(`${candidateId} release content or fingerprint changed; publication is invalid.`);
    }
    if (seenGtins.has(dossier.identity.gtin)) {
      throw new Error(`${candidateId} duplicates another released GTIN.`);
    }
    seenGtins.add(dossier.identity.gtin);
    return { release: expected, dossier, product: materializeCataloguePublicationRelease(dossier, expected) };
  });

  return {
    schemaVersion: cataloguePublicationReleaseSchemaVersion,
    exposure: cataloguePublicationReleaseExposure,
    releaseCount: releases.length,
    products: releases.map(item => item.product),
    releases: releases.map(item => item.release),
  };
}
