import { NextResponse, type NextRequest } from 'next/server';

// Inbound cookie rewriting for HTTP localhost development.
//
// Problem: The Neon Auth SDK hardcodes the `__Secure-` cookie name prefix and
// the `Secure` flag. Browsers refuse to store such cookies on plain HTTP origins
// (http://localhost:3000). The auth API route handler (app/api/auth/[...path])
// strips the prefix and flag on *outbound* responses so the browser can persist
// them under unprefixed names (e.g. `neon-auth.session_token`).
//
// This middleware handles the *inbound* direction: before the request reaches
// the SDK's server-side `getSession()`, it rewrites the unprefixed cookie names
// back to `__Secure-` so the SDK recognises them. In production (HTTPS) this
// middleware is a no-op pass-through.

const IS_SECURE_ORIGIN = process.env.NODE_ENV === 'production';
const PRIVATE_WORKSPACE_ROUTE = /^\/(?:me|ops)(?:\/|$)/;

function protectPrivateWorkspaceResponse(request: NextRequest, response: NextResponse) {
  if (!PRIVATE_WORKSPACE_ROUTE.test(request.nextUrl.pathname)) return response;
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export function middleware(request: NextRequest) {
  if (IS_SECURE_ORIGIN) {
    return protectPrivateWorkspaceResponse(request, NextResponse.next());
  }

  const cookie = request.headers.get('cookie');
  if (!cookie) return protectPrivateWorkspaceResponse(request, NextResponse.next());

  // Re-add `__Secure-` prefix to the SDK's cookie names so getSession() finds them.
  const rewritten = cookie
    .replace(/\bbetter-auth\./g, '__Secure-better-auth.')
    .replace(/\bneon-auth\./g, '__Secure-neon-auth.');

  // Nothing changed → skip the header rewrite cost.
  if (rewritten === cookie) {
    return protectPrivateWorkspaceResponse(request, NextResponse.next());
  }

  const headers = new Headers(request.headers);
  headers.set('cookie', rewritten);
  return protectPrivateWorkspaceResponse(request, NextResponse.next({ request: { headers } }));
}

export const config = {
  // Run on every route except static assets.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|apple-icon\\.png|manifest\\.webmanifest|social/).*)'],
};
