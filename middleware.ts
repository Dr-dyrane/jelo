import { NextResponse, type NextRequest } from 'next/server';
import { getAuth, isAuthConfigured } from '@/lib/auth/server';

export default async function middleware(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }
  return getAuth().middleware({ loginUrl: '/sign-in' })(request);
}

export const config = {
  matcher: ['/ops/:path*'],
};
