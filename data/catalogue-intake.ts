import manifest from './catalogue-intake.json';
import {
  auditCatalogueIntakeManifest,
  rankCatalogueIntake,
  type CatalogueIntakeManifest,
} from '@/lib/catalogue/intake-readiness';

export const catalogueIntakeManifest = manifest as CatalogueIntakeManifest;
export const catalogueIntakeCandidates = catalogueIntakeManifest.candidates;
// This projection describes the immutable checked-in intake snapshot. Replaying
// it at its own update time keeps its recorded readiness deterministic; new
// dossier/release entrypoints still evaluate candidates against the current
// operator clock before they can approve anything.
const catalogueIntakeSnapshotAt = Date.parse(catalogueIntakeManifest.updatedAt);
export const catalogueIntakeDecisions = auditCatalogueIntakeManifest(
  catalogueIntakeManifest,
  catalogueIntakeSnapshotAt,
);
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
