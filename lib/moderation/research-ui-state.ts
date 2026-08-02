export type ResearchActionChannel = 'assignment' | 'resolution';

export type ResearchSubmission = {
  requestId: string;
  targetId: string;
  channel: ResearchActionChannel;
  action: string;
};

export type ResearchSuccessFeedback = ResearchSubmission & {
  message: string;
};

export type ResearchFeedbackState = {
  latestSubmission: ResearchSubmission | null;
  success: ResearchSuccessFeedback | null;
};

export type ResearchFeedbackEvent =
  | { type: 'submitted'; submission: ResearchSubmission }
  | { type: 'succeeded'; feedback: ResearchSuccessFeedback }
  | { type: 'selection-changed' }
  | { type: 'expired'; requestId: string }
  | { type: 'cleared' };

export const initialResearchFeedbackState: ResearchFeedbackState = {
  latestSubmission: null,
  success: null,
};

function isSameSubmission(left: ResearchSubmission | null, right: ResearchSubmission) {
  return left?.requestId === right.requestId
    && left.targetId === right.targetId
    && left.channel === right.channel
    && left.action === right.action;
}

export function researchFeedbackReducer(
  state: ResearchFeedbackState,
  event: ResearchFeedbackEvent,
): ResearchFeedbackState {
  if (event.type === 'submitted') {
    return { latestSubmission: event.submission, success: null };
  }
  if (event.type === 'succeeded') {
    if (!isSameSubmission(state.latestSubmission, event.feedback)) return state;
    return { latestSubmission: null, success: event.feedback };
  }
  if (event.type === 'selection-changed') {
    return state.latestSubmission === null ? state : { ...state, latestSubmission: null };
  }
  if (event.type === 'expired') {
    return state.success?.requestId === event.requestId ? { ...state, success: null } : state;
  }
  return initialResearchFeedbackState;
}

export function countUniqueResearchAdditions(
  visibleIds: Iterable<string>,
  incomingIds: Iterable<string>,
) {
  const known = new Set(visibleIds);
  let added = 0;
  for (const id of incomingIds) {
    if (known.has(id)) continue;
    known.add(id);
    added += 1;
  }
  return added;
}

export function researchPaginationStatus(added: number, hasMore: boolean) {
  if (added === 0) {
    return hasMore ? 'No new research items added.' : 'End of the research queue.';
  }
  const loaded = `${added} more research item${added === 1 ? '' : 's'} loaded.`;
  return hasMore ? loaded : `${loaded} End of the research queue.`;
}
