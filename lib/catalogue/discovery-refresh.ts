import { createHash } from 'node:crypto';
import {
  auditCatalogueDiscoverySnapshot,
  type CatalogueDiscoverySnapshot,
  type DiscoveryResponseEvidence,
} from './discovery-screening';

export type CatalogueDiscoveryRefreshReview = {
  policy: 'review-before-replacing-private-discovery-snapshot';
  acceptanceToken: string;
  previous: {
    semanticSha256: string;
    generatedAt: string;
    sourceProductCount: number;
    eligibleCandidateCount: number;
    selectedCount: number;
    responseCount: number;
  };
  candidate: {
    semanticSha256: string;
    generatedAt: string;
    sourceProductCount: number;
    eligibleCandidateCount: number;
    selectedCount: number;
    responseCount: number;
  };
  deltas: {
    sourceProductCount: number;
    eligibleCandidateCount: number;
    selectedCount: number;
    responseCount: number;
  };
  candidateRotation: {
    retainedCount: number;
    addedCount: number;
    removedCount: number;
    addedDiscoveryIds: string[];
    removedDiscoveryIds: string[];
  };
  responseChurn: {
    retainedCount: number;
    addedCount: number;
    removedCount: number;
    changedCount: number;
    addedKeys: string[];
    removedKeys: string[];
    changedKeys: string[];
  };
};

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function responseKey(response: DiscoveryResponseEvidence) {
  return `${response.retailer}\n${response.page}\n${response.requestedUrl}`;
}

function responseSemanticValue(response: DiscoveryResponseEvidence) {
  return JSON.stringify({
    requestedUrl: response.requestedUrl,
    responseUrl: response.responseUrl,
    responseSha256: response.responseSha256,
    responseByteSize: response.responseByteSize,
    responseMimeType: response.responseMimeType,
    recordCount: response.recordCount,
  });
}

/**
 * Removes retrieval clock values while retaining every source digest, record,
 * candidate, observed offer field, and retrieval locator. A second fetch of
 * unchanged bytes therefore produces the same review token; any meaningful
 * source or selection change produces a new one.
 */
export function catalogueDiscoverySemanticSha256(
  snapshot: CatalogueDiscoverySnapshot,
) {
  auditCatalogueDiscoverySnapshot(snapshot);
  const semantic = structuredClone(snapshot);
  semantic.generatedAt = '<retrieval-time>';
  for (const response of semantic.sourceResponses) {
    response.retrievedAt = '<retrieval-time>';
  }
  for (const candidate of semantic.candidates) {
    for (const observation of candidate.retailerObservations) {
      observation.observedAt = '<retrieval-time>';
    }
  }
  return sha256(JSON.stringify(semantic));
}

/**
 * Compares two valid private discovery snapshots without treating either one
 * as public product data. The acceptance token binds the complete semantic
 * snapshots, while the summary makes the source and candidate churn reviewable
 * before the checked-in snapshot is replaced.
 */
export function reviewCatalogueDiscoveryRefresh(
  previous: CatalogueDiscoverySnapshot,
  candidate: CatalogueDiscoverySnapshot,
): CatalogueDiscoveryRefreshReview {
  auditCatalogueDiscoverySnapshot(previous);
  auditCatalogueDiscoverySnapshot(candidate);

  const previousCandidateIds = new Set(
    previous.candidates.map(item => item.discoveryId),
  );
  const candidateIds = new Set(candidate.candidates.map(item => item.discoveryId));
  const addedDiscoveryIds = Array.from(candidateIds)
    .filter(id => !previousCandidateIds.has(id))
    .sort();
  const removedDiscoveryIds = Array.from(previousCandidateIds)
    .filter(id => !candidateIds.has(id))
    .sort();

  const previousResponses = new Map(
    previous.sourceResponses.map(response => [responseKey(response), response]),
  );
  const candidateResponses = new Map(
    candidate.sourceResponses.map(response => [responseKey(response), response]),
  );
  const addedKeys = Array.from(candidateResponses.keys())
    .filter(key => !previousResponses.has(key))
    .sort();
  const removedKeys = Array.from(previousResponses.keys())
    .filter(key => !candidateResponses.has(key))
    .sort();
  const retainedResponseKeys = Array.from(candidateResponses.keys())
    .filter(key => previousResponses.has(key));
  const changedKeys = retainedResponseKeys
    .filter(key => (
      responseSemanticValue(previousResponses.get(key)!)
      !== responseSemanticValue(candidateResponses.get(key)!)
    ))
    .sort();

  const previousSemanticSha256 = catalogueDiscoverySemanticSha256(previous);
  const candidateSemanticSha256 = catalogueDiscoverySemanticSha256(candidate);
  const acceptanceToken = sha256(
    'jelocare-private-discovery-refresh-review-v1\n'
    + `${previousSemanticSha256}\n${candidateSemanticSha256}\n`,
  );

  return {
    policy: 'review-before-replacing-private-discovery-snapshot',
    acceptanceToken,
    previous: {
      semanticSha256: previousSemanticSha256,
      generatedAt: previous.generatedAt,
      sourceProductCount: previous.sourceProductCount,
      eligibleCandidateCount: previous.eligibleCandidateCount,
      selectedCount: previous.selectedCount,
      responseCount: previous.sourceResponses.length,
    },
    candidate: {
      semanticSha256: candidateSemanticSha256,
      generatedAt: candidate.generatedAt,
      sourceProductCount: candidate.sourceProductCount,
      eligibleCandidateCount: candidate.eligibleCandidateCount,
      selectedCount: candidate.selectedCount,
      responseCount: candidate.sourceResponses.length,
    },
    deltas: {
      sourceProductCount:
        candidate.sourceProductCount - previous.sourceProductCount,
      eligibleCandidateCount:
        candidate.eligibleCandidateCount - previous.eligibleCandidateCount,
      selectedCount: candidate.selectedCount - previous.selectedCount,
      responseCount:
        candidate.sourceResponses.length - previous.sourceResponses.length,
    },
    candidateRotation: {
      retainedCount: candidateIds.size - addedDiscoveryIds.length,
      addedCount: addedDiscoveryIds.length,
      removedCount: removedDiscoveryIds.length,
      addedDiscoveryIds,
      removedDiscoveryIds,
    },
    responseChurn: {
      retainedCount: retainedResponseKeys.length,
      addedCount: addedKeys.length,
      removedCount: removedKeys.length,
      changedCount: changedKeys.length,
      addedKeys,
      removedKeys,
      changedKeys,
    },
  };
}
