import { NextRequest, NextResponse } from 'next/server';
import { openRetailerPartnershipMagicLink } from '@/lib/retailer-partnership/repository';
import {
  allowRetailerPartnershipAction,
  hashEditSecret,
  parseRetailerPartnershipToken,
  retailerPartnershipCookieMaxAge,
  retailerPartnershipCookieName,
  retailerPartnershipToken,
} from '@/lib/retailer-partnership/security';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!await allowRetailerPartnershipAction(request, 'magic')) {
    return NextResponse.redirect(new URL('/retailers?link=limited#list-your-store', request.nextUrl.origin));
  }
  const token = parseRetailerPartnershipToken(request.nextUrl.searchParams.get('token'));
  if (!token) {
    return NextResponse.redirect(new URL('/retailers?link=expired#list-your-store', request.nextUrl.origin));
  }
  const application = await openRetailerPartnershipMagicLink(
    token.applicationId,
    hashEditSecret(token.secret),
  );
  if (!application) {
    return NextResponse.redirect(new URL('/retailers?link=expired#list-your-store', request.nextUrl.origin));
  }
  const destination = new URL('/retailers', request.nextUrl.origin);
  destination.searchParams.set('application', application.id);
  destination.searchParams.set('link', 'opened');
  destination.hash = 'list-your-store';
  const response = NextResponse.redirect(destination);
  response.cookies.set({
    name: retailerPartnershipCookieName,
    value: retailerPartnershipToken(application.id, token.secret),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/retailers',
    maxAge: retailerPartnershipCookieMaxAge,
  });
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
