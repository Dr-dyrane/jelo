import assert from 'node:assert/strict';
import test from 'node:test';
import discoverySnapshot from '@/data/catalogue-discovery-screening.json';
import {
  catalogueDiscoverySemanticSha256,
  reviewCatalogueDiscoveryRefresh,
} from '@/lib/catalogue/discovery-refresh';
import type { CatalogueDiscoverySnapshot } from '@/lib/catalogue/discovery-screening';

function currentSnapshot() {
  return structuredClone(discoverySnapshot) as CatalogueDiscoverySnapshot;
}

test('retrieval clock changes do not manufacture discovery churn', () => {
  const previous = currentSnapshot();
  const candidate = currentSnapshot();
  candidate.generatedAt = '2026-07-27T19:00:00.000Z';
  candidate.sourceResponses.forEach(response => {
    response.retrievedAt = '2026-07-27T18:59:00.000Z';
  });
  candidate.candidates.forEach(item => {
    item.retailerObservations.forEach(observation => {
      observation.observedAt = '2026-07-27T18:59:00.000Z';
    });
  });

  assert.equal(
    catalogueDiscoverySemanticSha256(previous),
    catalogueDiscoverySemanticSha256(candidate),
  );
  const review = reviewCatalogueDiscoveryRefresh(previous, candidate);
  assert.equal(review.candidateRotation.addedCount, 0);
  assert.equal(review.candidateRotation.removedCount, 0);
  assert.equal(review.responseChurn.changedCount, 0);
});

test('review token binds source changes and exact candidate rotation', () => {
  const previous = currentSnapshot();
  const candidate = currentSnapshot();
  const removedId = candidate.candidates.at(-1)!.discoveryId;
  candidate.candidates.at(-1)!.discoveryId = 'f'.repeat(24);
  candidate.sourceResponses[0].responseByteSize += 1;

  const review = reviewCatalogueDiscoveryRefresh(previous, candidate);
  assert.equal(review.candidateRotation.retainedCount, 999);
  assert.deepEqual(review.candidateRotation.removedDiscoveryIds, [removedId]);
  assert.deepEqual(review.candidateRotation.addedDiscoveryIds, ['f'.repeat(24)]);
  assert.equal(review.responseChurn.changedCount, 1);
  assert.notEqual(
    review.previous.semanticSha256,
    review.candidate.semanticSha256,
  );
  assert.match(review.acceptanceToken, /^[0-9a-f]{64}$/);

  candidate.sourceResponses[0].responseByteSize += 1;
  assert.notEqual(
    review.acceptanceToken,
    reviewCatalogueDiscoveryRefresh(previous, candidate).acceptanceToken,
  );
});
