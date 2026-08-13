import type {
  AssistedOrderEventView,
  AssistedOrderState,
} from './assisted-procurement-model';

export const ORDER_OPERATIONS_JOURNEY = [
  { id: 'request', label: 'Request', detail: 'Customer request received' },
  { id: 'verify', label: 'Verify & quote', detail: 'Exact products and costs checked' },
  { id: 'approval', label: 'Approval', detail: 'Customer reviews one exact quote' },
  { id: 'payment', label: 'Payment', detail: 'Approval recorded; payment remains gated' },
  { id: 'purchase', label: 'Purchase', detail: 'Retailer order placed and confirmed' },
  { id: 'delivery', label: 'Delivery', detail: 'Dispatch evidence recorded' },
  { id: 'complete', label: 'Complete', detail: 'Delivery recorded' },
] as const;

export type OrderOperationsJourneyId = typeof ORDER_OPERATIONS_JOURNEY[number]['id'];
export type OrderOperationsJourneyStatus = 'complete' | 'current' | 'attention' | 'reached' | 'locked';
export type OrderOperationsExceptionId = 'cancelled' | 'refund_pending' | 'refunded';

const STATE_STAGE: Partial<Record<AssistedOrderState, number>> = {
  requested: 0,
  quoting: 1,
  awaiting_approval: 2,
  payment_pending: 3,
  paid: 3,
  procurement: 4,
  retailer_confirmed: 4,
  out_for_delivery: 5,
  delivered: 6,
};

const EXCEPTIONS: Record<OrderOperationsExceptionId, {
  label: string;
  detail: string;
  status: 'attention' | 'complete';
}> = {
  cancelled: {
    label: 'Order cancelled',
    detail: 'The reached stages remain visible. No further procurement will proceed.',
    status: 'attention',
  },
  refund_pending: {
    label: 'Refund pending',
    detail: 'The reached stages remain visible while refund evidence is reconciled.',
    status: 'attention',
  },
  refunded: {
    label: 'Refund complete',
    detail: 'The reached stages remain visible and the refund has been recorded.',
    status: 'complete',
  },
};

function isException(state: AssistedOrderState): state is OrderOperationsExceptionId {
  return state === 'cancelled' || state === 'refund_pending' || state === 'refunded';
}

function deepestReachedStage(
  state: AssistedOrderState,
  events: readonly Pick<AssistedOrderEventView, 'fromState' | 'toState'>[],
) {
  return [state, ...events.flatMap(event => [event.fromState, event.toState])]
    .reduce((deepest, candidate) => Math.max(deepest, candidate ? STATE_STAGE[candidate] ?? -1 : -1), 0);
}

export function resolveOrderOperationsJourney(
  state: AssistedOrderState,
  events: readonly Pick<AssistedOrderEventView, 'fromState' | 'toState'>[] = [],
) {
  const deepest = deepestReachedStage(state, events);
  const exception = isException(state) ? { id: state, ...EXCEPTIONS[state] } : null;
  const currentIndex = state === 'needs_response' ? deepest : STATE_STAGE[state] ?? deepest;

  const steps = ORDER_OPERATIONS_JOURNEY.map((step, index) => ({
    ...step,
    status: (
      exception
        ? index <= deepest ? 'reached' : 'locked'
        : state === 'delivered'
          ? 'complete'
          : index < currentIndex
            ? 'complete'
            : index === currentIndex
              ? state === 'needs_response' ? 'attention' : 'current'
              : 'locked'
    ) as OrderOperationsJourneyStatus,
  }));

  return { steps, exception, deepestReachedIndex: deepest };
}
