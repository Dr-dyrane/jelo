import type { ModerationQueue } from './schema';
import { isQueueItemUuid } from './queue-selection';

export function activityObservationHref(
  queue: ModerationQueue,
  targetRef: string,
): string | null {
  if (queue !== 'community_observation' || !isQueueItemUuid(targetRef)) {
    return null;
  }
  return `/ops/observations?id=${encodeURIComponent(targetRef)}`;
}
