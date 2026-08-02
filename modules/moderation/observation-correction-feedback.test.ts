import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initialObservationCorrectionFeedback,
  observationCorrectionFeedbackForTarget,
  observationCorrectionFeedbackReducer,
} from '@/lib/moderation/observation-correction-feedback';

const submission1 = '11111111-1111-4111-8111-111111111111';
const submission2 = '22222222-2222-4222-8222-222222222222';
const submission3 = '33333333-3333-4333-8333-333333333333';

test('correction feedback is scoped to the submitted target and cleared on selection change', () => {
  const submitted = observationCorrectionFeedbackReducer(
    initialObservationCorrectionFeedback,
    {
      type: 'submit',
      submissionId: submission1,
      targetId: 'observation-a',
      disposition: 'defer',
    },
  );
  const settled = observationCorrectionFeedbackReducer(submitted, {
    type: 'settle',
    submissionId: submission1,
    targetId: 'observation-a',
    disposition: 'defer',
    ok: false,
    error: 'Could not return this report.',
  });

  assert.equal(
    observationCorrectionFeedbackForTarget(settled, 'observation-a')?.error,
    'Could not return this report.',
  );
  assert.equal(observationCorrectionFeedbackForTarget(settled, 'observation-b'), null);

  const cleared = observationCorrectionFeedbackReducer(settled, { type: 'clear' });
  assert.deepEqual(cleared, initialObservationCorrectionFeedback);
  assert.equal(observationCorrectionFeedbackForTarget(cleared, 'observation-a'), null);
});

test('a retry replaces prior feedback and ignores a stale result from another submission', () => {
  const first = observationCorrectionFeedbackReducer(
    initialObservationCorrectionFeedback,
    {
      type: 'submit',
      submissionId: submission1,
      targetId: 'observation-a',
      disposition: 'defer',
    },
  );
  const retried = observationCorrectionFeedbackReducer(first, {
    type: 'submit',
    submissionId: submission2,
    targetId: 'observation-a',
    disposition: 'defer',
  });
  assert.equal(retried.result, null);

  const stale = observationCorrectionFeedbackReducer(retried, {
    type: 'settle',
    submissionId: submission1,
    targetId: 'observation-a',
    disposition: 'defer',
    ok: true,
  });
  assert.equal(stale, retried);

  const latest = observationCorrectionFeedbackReducer(stale, {
    type: 'settle',
    submissionId: submission2,
    targetId: 'observation-a',
    disposition: 'defer',
    ok: true,
  });
  assert.deepEqual(latest.result, {
    submissionId: submission2,
    targetId: 'observation-a',
    disposition: 'defer',
    ok: true,
    error: null,
  });
});

test('a response arriving after selection cleanup cannot resurrect stale feedback', () => {
  const submitted = observationCorrectionFeedbackReducer(
    initialObservationCorrectionFeedback,
    {
      type: 'submit',
      submissionId: submission3,
      targetId: 'observation-a',
      disposition: 'defer',
    },
  );
  const cleared = observationCorrectionFeedbackReducer(submitted, { type: 'clear' });
  const late = observationCorrectionFeedbackReducer(cleared, {
    type: 'settle',
    submissionId: submission3,
    targetId: 'observation-a',
    disposition: 'defer',
    ok: false,
    error: 'Late failure',
  });
  assert.equal(late, cleared);
});

test('out-of-order responses cannot replace the newer completed correction', () => {
  const first = observationCorrectionFeedbackReducer(
    initialObservationCorrectionFeedback,
    {
      type: 'submit',
      submissionId: submission1,
      targetId: 'observation-a',
      disposition: 'defer',
    },
  );
  const second = observationCorrectionFeedbackReducer(first, {
    type: 'submit',
    submissionId: submission2,
    targetId: 'observation-a',
    disposition: 'defer',
  });
  const response2 = observationCorrectionFeedbackReducer(second, {
    type: 'settle',
    submissionId: submission2,
    targetId: 'observation-a',
    disposition: 'defer',
    ok: true,
  });
  const lateResponse1 = observationCorrectionFeedbackReducer(response2, {
    type: 'settle',
    submissionId: submission1,
    targetId: 'observation-a',
    disposition: 'defer',
    ok: false,
    error: 'Stale failure',
  });

  assert.equal(lateResponse1, response2);
  assert.equal(lateResponse1.result?.submissionId, submission2);
  assert.equal(lateResponse1.result?.ok, true);
});

test('a mismatched disposition cannot settle an otherwise matching request', () => {
  const submitted = observationCorrectionFeedbackReducer(
    initialObservationCorrectionFeedback,
    {
      type: 'submit',
      submissionId: submission1,
      targetId: 'observation-a',
      disposition: 'defer',
    },
  );
  const mismatched = observationCorrectionFeedbackReducer(submitted, {
    type: 'settle',
    submissionId: submission1,
    targetId: 'observation-a',
    disposition: 'reject' as 'defer',
    ok: true,
  });
  assert.equal(mismatched, submitted);
});
