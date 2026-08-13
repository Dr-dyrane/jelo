import { NextRequest, NextResponse } from 'next/server';
import { getAuthSubject } from '@/lib/auth/subject';
import { readBoundedJson, sameSiteRequest } from '@/lib/community-intake/request-security';
import { customerQuoteDecisionSchema } from '@/lib/commerce/assisted-procurement-schema';
import {
  decideAssistedOrderQuote,
  readAssistedOrderBySession,
  readAssistedOrderForOwner,
} from '@/lib/commerce/assisted-procurement-repository';
import {
  allowAssistedOrderAction,
  orderSessionHashFromRequest,
} from '@/lib/commerce/assisted-procurement-security';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!sameSiteRequest(request)) return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 });
  if (!await allowAssistedOrderAction(request, 'decide')) {
    return NextResponse.json({ error: 'Please try again shortly.' }, { status: 429 });
  }
  try {
    const input = customerQuoteDecisionSchema.parse(await readBoundedJson(request));
    const identity = await getAuthSubject();
    const sessionHash = orderSessionHashFromRequest(request) ?? undefined;
    const ownerOrder = identity && input.orderId
      ? await readAssistedOrderForOwner(input.orderId, identity.subject)
      : null;
    const current = ownerOrder ?? (sessionHash ? await readAssistedOrderBySession(sessionHash) : null);
    if (!current) return NextResponse.json({ error: 'Order session not found.' }, { status: 404 });
    const order = await decideAssistedOrderQuote({
      orderId: current.id,
      sessionHash: ownerOrder ? undefined : sessionHash,
      ownerSubject: ownerOrder ? identity?.subject : undefined,
      quoteVersion: input.quoteVersion,
      revision: input.orderRevision,
      decision: input.decision,
      reason: input.reason || null,
    });
    if (!order) {
      return NextResponse.json({ error: 'This quote changed or expired. Refresh before deciding.' }, { status: 409 });
    }
    const response = NextResponse.json({ state: order.state, revision: order.revision });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'Check the decision and try again.' }, { status: 400 });
  }
}
