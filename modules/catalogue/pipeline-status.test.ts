import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCataloguePipelineStatus } from '@/lib/catalogue/pipeline-status';
import type { CatalogueIntakeDecision } from '@/lib/catalogue/intake-readiness';

function decision(
  id: string,
  blockers: CatalogueIntakeDecision['blockers'],
  offerCount: number,
  approvalDraftReady = false,
): CatalogueIntakeDecision {
  return {
    candidate: { id } as CatalogueIntakeDecision['candidate'],
    stage: 'nigeria',
    blockers,
    freshExactOffers: Array.from({ length: offerCount }, () => ({}) as never),
    excludedMarketObservations: [],
    approvalDraftReady,
    nextAction: 'Continue evidence review.',
  };
}

const counts = {
  liveProductCount: 15,
  reviewedResearchCount: 23,
  frozenLegacyCandidateCount: 977,
  retailerDiscoveryLeadCount: 1_000,
  researchPriorityCount: 48,
  privateDossierCount: 0,
  explicitReleaseCount: 0,
};

test('reports pipeline stages without presenting discovery leads as live products', () => {
  const status = buildCataloguePipelineStatus(counts, [
    decision('closest', ['nigeria-regulatory-pending', 'nigeria-regulatory-evidence-missing'], 1),
    decision('needs-art', ['nigeria-regulatory-pending', 'asset-final-image-missing'], 1),
    decision('needs-market', ['nigeria-exact-offer-missing'], 0),
  ]);
  assert.equal(status.liveProductCount, 15);
  assert.equal(status.retailerDiscoveryLeadCount, 1_000);
  assert.equal(status.exactNigeriaOfferReadyCount, 2);
  assert.equal(status.almostReadyCount, 1);
  assert.deepEqual(status.almostReadyCandidateIds, ['closest']);
});

test('fails closed on duplicate decisions or impossible counts', () => {
  const duplicate = decision('same', ['nigeria-regulatory-pending'], 1);
  assert.throws(() => buildCataloguePipelineStatus(counts, [duplicate, duplicate]), /not unique/);
  assert.throws(() => buildCataloguePipelineStatus({ ...counts, liveProductCount: -1 }, []), /non-negative/);
});
