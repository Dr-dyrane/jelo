export const SIGN_IN_CONTINUATIONS = ['/me', '/me/routine', '/me/orders', '/ops'] as const;
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

export function resolveSignInContinuation(value: unknown): SignInContinuation {
  if (value === '/me' || value === '/me/routine' || value === '/me/orders' || value === '/ops') return value;
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
