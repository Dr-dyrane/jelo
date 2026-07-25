import { type NextRequest, NextResponse } from 'next/server';
import { getAuth, isAuthConfigured } from '@/lib/auth/server';

// In local development over plain HTTP, browsers refuse to store cookies whose
// names begin with `__Secure-` (an HTTPS-only prefix per the cookie spec) and
// also refuse any cookie flagged `Secure`. The Neon Auth SDK hardcodes both.
//
// Fix: on outbound responses strip the `__Secure-` name prefix *and* the
// `Secure` attribute so the browser actually persists the session cookies.
// The inbound side is handled by middleware.ts, which re-adds the prefix so
// the SDK can find them on the next request.
const IS_SECURE_ORIGIN = process.env.NODE_ENV === 'production';

function sanitizeCookiesForDev(res: Response): Response {
  if (IS_SECURE_ORIGIN) return res;

  const setCookies = res.headers.getSetCookie();
  if (setCookies.length === 0) return res;

  const headers = new Headers(res.headers);
  headers.delete('set-cookie');

  for (const raw of setCookies) {
    const sanitized = raw
      .replace(/\b__Secure-/g, '')   // strip __Secure- name prefix
      .replace(/;\s*Secure/gi, '');  // strip Secure flag
    headers.append('set-cookie', sanitized);
  }

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

async function notConfigured() {
  return new Response('Not found', { status: 404 });
}

// The Neon Auth catch-all. When auth is unconfigured (local dev, or before the
// Neon console is set up) the routes 404 instead of constructing the auth instance
// at module load, so the build and the public app are unaffected.
async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!isAuthConfigured()) return notConfigured();
  const handlers = getAuth().handler();
  const method = req.method as keyof typeof handlers;
  const routeHandler = handlers[method] ?? handlers.GET;
  const res = await routeHandler(req, ctx);
  return sanitizeCookiesForDev(res);
}

export const GET = handle;
export const POST = handle;
