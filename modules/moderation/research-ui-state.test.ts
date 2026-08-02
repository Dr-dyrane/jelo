import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countUniqueResearchAdditions,
  initialResearchFeedbackState,
  researchFeedbackReducer,
  researchPaginationStatus,
  type ResearchSubmission,
} from '../../lib/moderation/research-ui-state';

const submission: ResearchSubmission = {
  requestId: 'request-1',
  targetId: 'task-1',
  channel: 'resolution',
  action: 'existing-canonical-product',
};

test('completed research feedback survives auto-advance selection until its own expiry', () => {
  const submitted = researchFeedbackReducer(initialResearchFeedbackState, {
    type: 'submitted',
    submission,
  });
  const succeeded = researchFeedbackReducer(submitted, {
    type: 'succeeded',
    feedback: { ...submission, message: 'Research outcome recorded.' },
  });

  assert.equal(succeeded.latestSubmission, null);
  assert.equal(succeeded.success?.message, 'Research outcome recorded.');

  const afterAutoAdvance = researchFeedbackReducer(succeeded, { type: 'selection-changed' });
  assert.equal(afterAutoAdvance.success?.message, 'Research outcome recorded.');

  const afterUnrelatedExpiry = researchFeedbackReducer(afterAutoAdvance, {
    type: 'expired',
    requestId: 'older-request',
  });
  assert.equal(afterUnrelatedExpiry.success?.message, 'Research outcome recorded.');

  const expired = researchFeedbackReducer(afterUnrelatedExpiry, {
    type: 'expired',
    requestId: submission.requestId,
  });
  assert.equal(expired.success, null);
});

test('a later submission replaces completed feedback and stale success cannot win', () => {
  const successful = researchFeedbackReducer(
    researchFeedbackReducer(initialResearchFeedbackState, { type: 'submitted', submission }),
    { type: 'succeeded', feedback: { ...submission, message: 'Saved.' } },
  );
  const nextSubmission = { ...submission, requestId: 'request-2', targetId: 'task-2' };
  const replaced = researchFeedbackReducer(successful, {
    type: 'submitted',
    submission: nextSubmission,
  });

  assert.equal(replaced.success, null);
  assert.deepEqual(replaced.latestSubmission, nextSubmission);
  assert.equal(researchFeedbackReducer(replaced, {
    type: 'succeeded',
    feedback: { ...submission, message: 'Stale success.' },
  }), replaced);
});

test('pagination counts only IDs that will actually be appended after deep-link dedupe', () => {
  const added = countUniqueResearchAdditions(
    ['first-page', 'deep-linked'],
    ['deep-linked', 'next-page', 'next-page'],
  );

  assert.equal(added, 1);
  assert.equal(researchPaginationStatus(added, true), '1 more research item loaded.');
  assert.equal(
    researchPaginationStatus(added, false),
    '1 more research item loaded. End of the research queue.',
  );
  assert.equal(researchPaginationStatus(0, false), 'End of the research queue.');
});
