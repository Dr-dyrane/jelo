import manifest from './catalogue-intake.json';
import {
  auditCatalogueIntakeManifest,
  rankCatalogueIntake,
  type CatalogueIntakeManifest,
} from '@/lib/catalogue/intake-readiness';

export const catalogueIntakeManifest = manifest as CatalogueIntakeManifest;
export const catalogueIntakeCandidates = catalogueIntakeManifest.candidates;
export const catalogueIntakeDecisions = auditCatalogueIntakeManifest(catalogueIntakeManifest);
export const catalogueIntakeQueue = rankCatalogueIntake(catalogueIntakeDecisions);

export const catalogueIntakeExposure = {
  candidateCount: catalogueIntakeCandidates.length,
  approvalDraftReadyCount: catalogueIntakeDecisions.filter(decision => decision.approvalDraftReady).length,
  publicProductCount: 0,
  policy: 'private-research-only',
} as const;
