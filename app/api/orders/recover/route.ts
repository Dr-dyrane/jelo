import { NextRequest, NextResponse } from 'next/server';
import { exchangeAssistedOrderRecovery } from '@/lib/commerce/assisted-procurement-repository';
import {
  allowAssistedOrderAction,
  assistedOrderCookieMaxAge,
  assistedOrderCookieName,
  createOrderSecret,
  hashOrderSecret,
} from '@/lib/commerce/assisted-procurement-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const failure = () => NextResponse.redirect(new URL('/order?recovery=expired', request.url), 303);
  if (!await allowAssistedOrderAction(request, 'recover')) return failure();
  const token = request.nextUrl.searchParams.get('token');
  if (!token || token.length < 32) return failure();
  const sessionSecret = createOrderSecret();
  const order = await exchangeAssistedOrderRecovery(hashOrderSecret(token), hashOrderSecret(sessionSecret));
  if (!order) return failure();
  const response = NextResponse.redirect(new URL('/order', request.url), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.cookies.set({
    name: assistedOrderCookieName,
    value: sessionSecret,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: assistedOrderCookieMaxAge,
  });
  return response;
}
