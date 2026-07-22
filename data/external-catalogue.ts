import approvals from './external-product-approvals.json';
import manifest from './external-products.json';
import metadata from './external-products-meta.json';
import {
  gateExternalCatalogue,
  type ApprovedExternalCatalogueProduct,
  type ExternalCatalogueApprovalManifest,
} from '@/lib/catalogue/catalogue-publication-gate';

export const externalCatalogueCategories = [
  'Face care',
  'Hair & scalp',
  'Body care',
  'Makeup',
  'Fragrance',
  'Personal care',
] as const;

export type ExternalCatalogueCategory = typeof externalCatalogueCategories[number];

export type ExternalCatalogueCandidate = {
  source: 'open-beauty-facts';
  sourceProductId: string;
  barcode: string;
  brand: string;
  name: string;
  quantity: string;
  category: ExternalCatalogueCategory;
  sourceCategories: string[];
  countries: string[];
  sourceUrl: string;
  sourceUpdatedAt: string;
  sourceRetrievedAt: string;
  sourceSchemaVersion: 'obf-jsonl-v1';
  sourceSnapshotSha256: string;
  rawPayloadSha256: string;
  ingredientLabelSha256?: string;
  sourceImageUrl: string;
  ingredientImageUrl?: string;
  sourceFullImageUrl?: string;
  canonicalImageUrl: string;
  sourceImageSha256: string;
  imageSha256: string;
  imageMimeType: 'image/webp';
  imageWidth: number;
  imageHeight: number;
  imageByteSize: number;
  imageHasAlpha?: boolean;
  imageTreatment?: string;
  imageReviewStatus?: string;
  imageReviewScope?: string;
  imageReviewedAt?: string;
  imageReviewer?: string;
  imageProcessingModel?: string;
  imageProcessingVersion?: string;
  imageProcessingProvider?: string;
  candidateSha256?: string;
  packshotReleaseSha256?: string;
  imageLicense: 'CC BY-SA 3.0';
  imageAttribution: 'Open Beauty Facts contributors';
  dataLicense: 'ODbL 1.0';
  contentLicense: 'Database Contents License 1.0';
  clinicalReviewStatus: 'not-reviewed';
  sourcePhotoValidated: boolean;
  sourceIngredientsComplete: boolean;
  qualityScore: number;
};

export type ExternalCatalogueProduct = ApprovedExternalCatalogueProduct<ExternalCatalogueCandidate>;

export type ExternalCatalogueMetadata = {
  source: 'Open Beauty Facts';
  sourcePage: string;
  sourceSnapshotUrl: string;
  sourceSnapshotFilename: string;
  sourceSnapshotSha256: string;
  sourceRetrievedAt: string;
  requestedPublishedCount: number;
  reserveCount: number;
  scannedCount: number;
  acceptedCount: number;
  candidateCount: number;
  rejected: Record<string, number>;
  databaseLicense: 'ODbL 1.0';
  contentLicense: 'Database Contents License 1.0';
  imageLicense: 'CC BY-SA 3.0';
  reviewedCount: number;
  communitySourcedCount: number;
  publicCatalogueCount: number;
  mirroredImageCount: number;
  mirrorFailureCount: number;
  sourcePhotoValidatedCount: number;
  sourceIngredientsCompleteCount: number;
  categoryCounts: Record<ExternalCatalogueCategory, number>;
  packshotReleaseSha256: string;
  packshotSelectionSha256: string;
  packshotCandidateManifestSha256: string;
  packshotCandidateMetadataSha256: string;
  packshotAuditManifestSha256: string;
  packshotReviewStatus: 'human-approved';
  packshotReviewScope: 'product-identity-source-and-cutout';
  packshotReviewedAt: string;
  packshotReviewer: string;
  packshotProcessingModels: string[];
  packshotProcessingVersions: string[];
  packshotProcessingProviders: string[];
  generatedAt: string;
};

// The checked-in bulk manifest is frozen legacy research. Its approval manifest must
// remain empty, and the gate rejects every non-empty manifest. New work migrates to
// the private exact-SKU intake dossier instead of publishing this candidate pool.
export const externalCatalogueCandidates = manifest as unknown as ExternalCatalogueCandidate[];
export const externalCatalogueApprovals = approvals as ExternalCatalogueApprovalManifest;
export const externalCatalogueGate = gateExternalCatalogue(externalCatalogueCandidates, externalCatalogueApprovals);
export const externalProducts = externalCatalogueGate.approved;
export const externalCatalogueMetadata = metadata as unknown as ExternalCatalogueMetadata;
export const externalCatalogueExposure = {
  candidateCount: externalCatalogueCandidates.length,
  approvedCount: externalCatalogueGate.approvedCount,
  privateCandidateCount: externalCatalogueGate.privateCandidateCount,
  policy: 'legacy-private-disabled',
} as const;
