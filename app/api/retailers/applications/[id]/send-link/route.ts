import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasTransactionalEmailConfig, sendRetailerMagicLink } from '@/lib/email/mailer';
import {
  readRetailerPartnershipApplication,
  recordRetailerMagicLinkSent,
} from '@/lib/retailer-partnership/repository';
import {
  allowRetailerPartnershipAction,
  hashEditSecret,
  retailerPartnershipSecretFromRequest,
  retailerPartnershipToken,
  sameSiteRequest,
} from '@/lib/retailer-partnership/security';

export const runtime = 'nodejs';
const idSchema = z.uuid();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  if (!sameSiteRequest(request)) return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  if (!await allowRetailerPartnershipAction(request, 'magic', id)) {
    return NextResponse.json({ error: 'Please wait before sending another link.' }, { status: 429 });
  }
  const secret = retailerPartnershipSecretFromRequest(request, id);
  if (!secret) return NextResponse.json({ error: 'Private link required.' }, { status: 401 });
  if (!hasTransactionalEmailConfig()) {
    return NextResponse.json({ error: 'Email is temporarily unavailable.' }, { status: 503 });
  }

  const application = await readRetailerPartnershipApplication(id, hashEditSecret(secret));
  if (!application || application.status !== 'draft') {
    return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const link = new URL('/api/retailers/magic', origin);
  link.searchParams.set('token', retailerPartnershipToken(id, secret));
  try {
    await sendRetailerMagicLink({
      to: application.email,
      storeName: application.payload.storeName,
      magicLink: link.toString(),
    });
    await recordRetailerMagicLinkSent(id);
    return NextResponse.json({ emailDelivery: 'sent' });
  } catch (error) {
    console.error('Retailer magic-link resend failed.', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Could not send the link yet.' }, { status: 502 });
  }
}
