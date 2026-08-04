import { ProductRequestApiError } from './product-request-api';

export const ACCEPTED_PRODUCT_REQUEST_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function formatProductRequestDate(value: string | null) {
  if (!value) return 'Not submitted';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function productRequestErrorMessage(error: unknown) {
  if (error instanceof ProductRequestApiError) return error.message;
  return 'The connection was interrupted. Try the same action again.';
}

export function productRequestReplayMessage(action: string, replayed: boolean) {
  return replayed
    ? `${action} Your retry returned the original result; nothing was duplicated.`
    : action;
}
