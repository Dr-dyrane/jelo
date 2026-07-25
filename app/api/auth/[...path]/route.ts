import { type NextRequest, NextResponse } from 'next/server';
import { getAuth, isAuthConfigured } from '@/lib/auth/server';

async function notConfigured() {
  return new Response('Not found', { status: 404 });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!isAuthConfigured()) return notConfigured();
  const handlers = getAuth().handler();
  const method = req.method as keyof typeof handlers;
  const routeHandler = handlers[method] ?? handlers.GET;
  const res = await routeHandler(req, ctx);

  // In local development over HTTP, remove the `Secure` flag from Set-Cookie headers
  // so browsers (Safari, Firefox, Chrome) accept cookies set on http://localhost:3000.
  if (process.env.NODE_ENV !== 'production') {
    const cookies = res.headers.getSetCookie();
    if (cookies.length > 0) {
      const newHeaders = new Headers(res.headers);
      newHeaders.delete('set-cookie');
      for (const cookie of cookies) {
        const sanitized = cookie.replace(/;\s*Secure/gi, '');
        newHeaders.append('set-cookie', sanitized);
      }
      return new NextResponse(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: newHeaders,
      });
    }
  }

  return res;
}

export const GET = handle;
export const POST = handle;
