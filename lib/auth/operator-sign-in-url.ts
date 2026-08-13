import 'server-only';

const LIVE_SITE = 'https://www.jelocare.com';

export function operatorSignInUrl() {
  const url = new URL('/sign-in', LIVE_SITE);
  url.searchParams.set('next', '/ops');
  return url.toString();
}
