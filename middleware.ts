import { NextResponse, type NextRequest } from 'next/server';
import { getAuth, isAuthConfigured } from '@/lib/auth/server';

export default async function middleware(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  const res = await getAuth().middleware({ loginUrl: '/sign-in' })(request);

  if (process.env.NODE_ENV !== 'production' && res.headers.has('set-cookie')) {
    const cookies = res.headers.getSetCookie();
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

  return res;
}

export const config = {
  matcher: ['/ops/:path*'],
};
