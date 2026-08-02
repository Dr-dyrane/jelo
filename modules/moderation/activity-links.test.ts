import assert from 'node:assert/strict';
import test from 'node:test';
import { activityObservationHref } from '@/lib/moderation/activity-links';

const observationId = '878dc8f7-1cfc-45a9-9d64-3c6d8129cee7';

test('Activity links only an exact observation UUID to its selected report', () => {
  assert.equal(
    activityObservationHref('community_observation', observationId),
    `/ops/observations?id=${observationId}`,
  );
  assert.equal(activityObservationHref('community_observation', 'legacy-observation-ref'), null);
  assert.equal(activityObservationHref('community_observation', `${observationId}?status=rejected`), null);
  assert.equal(activityObservationHref('community_edge', observationId), null);
});
