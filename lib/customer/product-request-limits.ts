import type { CustomerProductRequestLifecycleState } from './product-request-model';

export const MAX_OPEN_CUSTOMER_PRODUCT_REQUESTS = 12;
export const MAX_ACTIVE_CUSTOMER_PRODUCT_REQUEST_IMAGES = 6;

export const OPEN_CUSTOMER_PRODUCT_REQUEST_STATES = [
  'draft',
  'pending',
  'in_review',
  'needs_info',
] as const satisfies readonly CustomerProductRequestLifecycleState[];

export type CustomerProductRequestLimitKind =
  'open_requests' | 'private_photos';

export function customerProductRequestLimitMessage(
  kind: CustomerProductRequestLimitKind,
  limit: number,
) {
  return kind === 'open_requests'
    ? `You can keep up to ${limit} open product requests. Close one before adding another.`
    : `You can keep private photos on up to ${limit} product requests. Remove one before adding another.`;
}
