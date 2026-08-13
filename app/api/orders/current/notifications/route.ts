import { NextRequest, NextResponse } from 'next/server';
import { getAuthSubject } from '@/lib/auth/subject';
import { readBoundedJson, sameSiteRequest } from '@/lib/community-intake/request-security';
import { assistedOrderNotificationPreferenceSchema } from '@/lib/commerce/assisted-procurement-schema';
import {
  readAssistedOrderBySession,
  readAssistedOrderForOwner,
  updateAssistedOrderNotificationPreference,
} from '@/lib/commerce/assisted-procurement-repository';
import {
  allowAssistedOrderAction,
  orderSessionHashFromRequest,
} from '@/lib/commerce/assisted-procurement-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!sameSiteRequest(request)) return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  if (!await allowAssistedOrderAction(request, 'preference')) {
    return NextResponse.json({ error: 'Please wait before trying again.' }, { status: 429 });
  }
  try {
    const input = assistedOrderNotificationPreferenceSchema.parse(await readBoundedJson(request));
    const identity = await getAuthSubject();
    const sessionHash = orderSessionHashFromRequest(request) ?? undefined;
    const ownerOrder = identity && input.orderId
      ? await readAssistedOrderForOwner(input.orderId, identity.subject)
      : null;
    const current = ownerOrder ?? (sessionHash ? await readAssistedOrderBySession(sessionHash) : null);
    if (!current) return NextResponse.json({ error: 'Order session not found.' }, { status: 404 });
    const order = await updateAssistedOrderNotificationPreference({
      orderId: current.id,
      ownerSubject: ownerOrder ? identity?.subject : undefined,
      sessionHash: ownerOrder ? undefined : sessionHash,
      enabled: input.enabled,
    });
    if (!order) return NextResponse.json({ error: 'That preference could not be saved.' }, { status: 409 });
    const response = NextResponse.json({
      emailNotificationsConsent: order.emailNotificationsConsent,
      updatedAt: order.updatedAt,
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'Check the preference and try again.' }, { status: 400 });
  }
}
