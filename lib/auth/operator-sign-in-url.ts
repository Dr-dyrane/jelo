import 'server-only';

const LIVE_SITE = 'https://www.jelocare.com';

export function operatorSignInUrl() {
  return new URL('/sign-in', LIVE_SITE).toString();
}
