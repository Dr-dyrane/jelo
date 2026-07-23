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
  excludedMarketObservationCount: catalogueIntakeDecisions.reduce((count, decision) => (
    count + decision.excludedMarketObservations.length
  ), 0),
  unresolvedRegulatorySearchCount: catalogueIntakeDecisions.reduce((count, decision) => (
    count + decision.unresolvedRegulatorySearches.length
  ), 0),
  publicProductCount: 0,
  policy: 'private-research-only',
} as const;
