export const SIGN_IN_CONTINUATIONS = ['/me', '/ops'] as const;

export type SignInContinuation = typeof SIGN_IN_CONTINUATIONS[number];
export type SignInIntent = 'customer' | 'operator';

export function resolveSignInContinuation(value: string | null | undefined): SignInContinuation {
  return value === '/me' || value === '/ops' ? value : '/ops';
}

export function resolveSignInIntent(continuation: SignInContinuation): SignInIntent {
  return continuation === '/me' ? 'customer' : 'operator';
}

export function customerSignInPath(): '/sign-in?next=/me' {
  return '/sign-in?next=/me';
}
