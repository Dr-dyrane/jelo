import { NextRequest, NextResponse } from 'next/server';
import { hasTransactionalEmailConfig, sendRetailerMagicLink } from '@/lib/email/mailer';
import { hasPostgresConfig } from '@/lib/db/postgres';
import {
  createRetailerPartnershipApplication,
  recordRetailerMagicLinkSent,
} from '@/lib/retailer-partnership/repository';
import {
  createRetailerPartnershipSchema,
  retailerPartnershipDraftSchema,
} from '@/lib/retailer-partnership/schema';
import {
  allowRetailerPartnershipAction,
  createEditSecret,
  hashEditSecret,
  readBoundedJson,
  retailerPartnershipCookieMaxAge,
  retailerPartnershipCookieName,
  retailerPartnershipToken,
  sameSiteRequest,
} from '@/lib/retailer-partnership/security';

export const runtime = 'nodejs';

function publicOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && /^https?:\/\//.test(configured)) return configured;
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!sameSiteRequest(request)) return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  if (!await allowRetailerPartnershipAction(request, 'create')) {
    return NextResponse.json({ error: 'Please try again later.' }, { status: 429 });
  }
  if (!hasPostgresConfig()) {
    return NextResponse.json({ error: 'Saving is temporarily unavailable.' }, { status: 503 });
  }

  try {
    const input = createRetailerPartnershipSchema.parse(await readBoundedJson(request));
    const { websiteField: _honeypot, ...draftInput } = input;
    void _honeypot;
    const draft = retailerPartnershipDraftSchema.parse(draftInput);
    const secret = createEditSecret();
    const application = await createRetailerPartnershipApplication(draft, hashEditSecret(secret));
    const token = retailerPartnershipToken(application.id, secret);
    const link = new URL('/api/retailers/magic', publicOrigin(request));
    link.searchParams.set('token', token);

    let emailDelivery: 'sent' | 'unavailable' | 'failed' = 'unavailable';
    if (hasTransactionalEmailConfig()) {
      try {
        await sendRetailerMagicLink({
          to: draft.email,
          storeName: draft.storeName,
          magicLink: link.toString(),
        });
        await recordRetailerMagicLinkSent(application.id);
        emailDelivery = 'sent';
      } catch (error) {
        console.error('Retailer magic-link delivery failed.', error instanceof Error ? error.message : 'unknown');
        emailDelivery = 'failed';
      }
    }

    const response = NextResponse.json({
      applicationId: application.id,
      revision: application.revision,
      expiresAt: application.magic_link_expires_at.toISOString(),
      emailDelivery,
    }, { status: 201 });
    response.cookies.set({
      name: retailerPartnershipCookieName,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/retailers',
      maxAge: retailerPartnershipCookieMaxAge,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error && error.message === 'payload_too_large'
      ? 'That is too much information for one request.'
      : 'Check the details and try again.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
