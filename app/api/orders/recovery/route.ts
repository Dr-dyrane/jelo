import { NextRequest, NextResponse } from 'next/server';
import { hasTransactionalEmailConfig, sendAssistedOrderRecovery } from '@/lib/email/mailer';
import { readBoundedJson, sameSiteRequest } from '@/lib/community-intake/request-security';
import { replaceAssistedOrderRecovery } from '@/lib/commerce/assisted-procurement-repository';
import { assistedOrderRecoveryRequestSchema } from '@/lib/commerce/assisted-procurement-schema';
import {
  allowAssistedOrderAction,
  createOrderSecret,
  hashOrderSecret,
} from '@/lib/commerce/assisted-procurement-security';

export const runtime = 'nodejs';

function publicOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return configured && /^https?:\/\//.test(configured) ? configured : request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!sameSiteRequest(request)) return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  if (!await allowAssistedOrderAction(request, 'recover')) {
    return NextResponse.json({ error: 'Please wait before trying again.' }, { status: 429 });
  }
  try {
    const input = assistedOrderRecoveryRequestSchema.parse(await readBoundedJson(request));
    const recoverySecret = createOrderSecret();
    const order = await replaceAssistedOrderRecovery({
      ...input,
      recoveryHash: hashOrderSecret(recoverySecret),
    });
    if (order && hasTransactionalEmailConfig()) {
      const link = new URL('/api/orders/recover', publicOrigin(request));
      link.searchParams.set('token', recoverySecret);
      try {
        await sendAssistedOrderRecovery({
          to: order.contactEmail,
          name: order.contactName,
          reference: order.reference,
          statusLink: link.toString(),
        });
      } catch (error) {
        console.error('Assisted order recovery resend failed.', error instanceof Error ? error.message : 'unknown');
      }
    }
    const response = NextResponse.json({ sent: true });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'Check the reference and email.' }, { status: 400 });
  }
}
