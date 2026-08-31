export const SIGN_IN_CONTINUATIONS = [
  '/me',
  '/me/explore',
  '/me/shelf',
  '/me/routine',
  '/me/consult',
  '/me/orders',
  '/me/notifications',
  '/me/locations',
  '/ops',
] as const;
export const MEMBER_PRODUCT_CONTINUATION_ORIGINS = [
  'home',
  'explore',
  'shelf',
  'routine',
] as const;

export type MemberProductContinuationOrigin = typeof MEMBER_PRODUCT_CONTINUATION_ORIGINS[number];
export type MemberProductContinuation = `/me/product/${string}?from=${MemberProductContinuationOrigin}`;
export type SignInContinuation = typeof SIGN_IN_CONTINUATIONS[number] | MemberProductContinuation;
export type SignInIntent = 'customer' | 'operator';

const MAX_MEMBER_PRODUCT_SLUG_LENGTH = 180;
const MAX_MEMBER_PRODUCT_CONTINUATION_LENGTH = 205;
const MEMBER_PRODUCT_CONTINUATION_PATTERN = /^\/me\/product\/([a-z0-9]+(?:-[a-z0-9]+)*)\?from=(home|explore|shelf|routine)$/;
const CUSTOMER_SIGN_IN_RECOVERY_VALUE = 'retry';

export function resolveSignInContinuation(value: unknown): SignInContinuation {
  if (
    typeof value === 'string'
    && (SIGN_IN_CONTINUATIONS as readonly string[]).includes(value)
  ) return value as SignInContinuation;
  if (
    typeof value !== 'string'
    || value.length > MAX_MEMBER_PRODUCT_CONTINUATION_LENGTH
    || value.includes('%')
  ) return '/ops';

  const match = MEMBER_PRODUCT_CONTINUATION_PATTERN.exec(value);
  const slug = match?.[1];
  const origin = match?.[2] as MemberProductContinuationOrigin | undefined;
  if (
    !slug
    || !origin
    || slug.length > MAX_MEMBER_PRODUCT_SLUG_LENGTH
    || value !== `/me/product/${slug}?from=${origin}`
  ) return '/ops';

  return value as MemberProductContinuation;
}

export function resolveSignInIntent(continuation: SignInContinuation): SignInIntent {
  return continuation === '/ops' ? 'operator' : 'customer';
}

export function customerSignInPath(): '/sign-in?next=/me';
export function customerSignInPath(continuation: unknown): string;
export function customerSignInPath(continuation?: unknown): string {
  if (continuation === undefined) return '/sign-in?next=/me';
  const resolved = resolveSignInContinuation(continuation);
  if (resolveSignInIntent(resolved) !== 'customer' || resolved === '/me') {
    return '/sign-in?next=/me';
  }
  return `/sign-in?next=${encodeURIComponent(resolved)}`;
}

export function customerSignInRecoveryPath(): '/sign-in?next=/me&recovery=retry';
export function customerSignInRecoveryPath(continuation: unknown): string;
export function customerSignInRecoveryPath(continuation?: unknown): string {
  const signInPath = continuation === undefined
    ? customerSignInPath()
    : customerSignInPath(continuation);
  return `${signInPath}&recovery=${CUSTOMER_SIGN_IN_RECOVERY_VALUE}`;
}

export function resolveCustomerSignInRecovery(value: unknown): boolean {
  return value === CUSTOMER_SIGN_IN_RECOVERY_VALUE;
}
