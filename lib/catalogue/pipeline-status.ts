import type { CatalogueIntakeDecision } from './intake-readiness';

export type CataloguePipelineStatus = {
  liveProductCount: number;
  reviewedResearchCount: number;
  frozenLegacyCandidateCount: number;
  retailerDiscoveryLeadCount: number;
  researchPriorityCount: number;
  deliberateIntakeCount: number;
  identityResolvedPrivateCount: number;
  identityResolvedPrivateCandidateIds: string[];
  identityAndCareReadyCount: number;
  exactNigeriaOfferReadyCount: number;
  almostReadyCount: number;
  almostReadyCandidateIds: string[];
  approvalDraftReadyCount: number;
  privateDossierCount: number;
  explicitReleaseCount: number;
};

type PipelineCounts = {
  liveProductCount: number;
  reviewedResearchCount: number;
  frozenLegacyCandidateCount: number;
  retailerDiscoveryLeadCount: number;
  researchPriorityCount: number;
  privateDossierCount: number;
  explicitReleaseCount: number;
  releasedCandidateIds: readonly string[];
};

function nonNegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

export function buildCataloguePipelineStatus(
  counts: PipelineCounts,
  decisions: readonly CatalogueIntakeDecision[],
): CataloguePipelineStatus {
  const decisionIds = decisions.map(decision => decision.candidate.id);
  if (new Set(decisionIds).size !== decisionIds.length) throw new Error('Catalogue intake decisions are not unique.');
  const releasedCandidateIds = new Set(counts.releasedCandidateIds);
  if (
    releasedCandidateIds.size !== counts.releasedCandidateIds.length
    || releasedCandidateIds.size !== counts.explicitReleaseCount
  ) throw new Error('Released catalogue candidate IDs do not match the explicit release count.');
  const almostReady = decisions.filter(decision => (
    !decision.approvalDraftReady
    && decision.freshExactOffers.length > 0
    && decision.blockers.length === 1
  ));
  const identityResolvedPrivate = decisions.filter(decision => (
    decision.stage !== 'identity'
    && !decision.approvalDraftReady
    && !releasedCandidateIds.has(decision.candidate.id)
  ));
  return {
    liveProductCount: nonNegativeInteger(counts.liveProductCount, 'Live product count'),
    reviewedResearchCount: nonNegativeInteger(counts.reviewedResearchCount, 'Reviewed research count'),
    frozenLegacyCandidateCount: nonNegativeInteger(counts.frozenLegacyCandidateCount, 'Frozen legacy candidate count'),
    retailerDiscoveryLeadCount: nonNegativeInteger(counts.retailerDiscoveryLeadCount, 'Retailer discovery lead count'),
    researchPriorityCount: nonNegativeInteger(counts.researchPriorityCount, 'Research priority count'),
    deliberateIntakeCount: decisions.length,
    identityResolvedPrivateCount: identityResolvedPrivate.length,
    identityResolvedPrivateCandidateIds:
      identityResolvedPrivate.map(decision => decision.candidate.id),
    identityAndCareReadyCount: decisions.filter(decision => !['identity', 'care'].includes(decision.stage)).length,
    exactNigeriaOfferReadyCount: decisions.filter(decision => decision.freshExactOffers.length > 0).length,
    almostReadyCount: almostReady.length,
    almostReadyCandidateIds: almostReady.map(decision => decision.candidate.id),
    approvalDraftReadyCount: decisions.filter(decision => decision.approvalDraftReady).length,
    privateDossierCount: nonNegativeInteger(counts.privateDossierCount, 'Private dossier count'),
    explicitReleaseCount: nonNegativeInteger(counts.explicitReleaseCount, 'Explicit release count'),
  };
}
