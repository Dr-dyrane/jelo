import { NextRequest, NextResponse } from 'next/server';
import { readAssistedOrderBySession } from '@/lib/commerce/assisted-procurement-repository';
import { allowAssistedOrderAction, orderSessionHashFromRequest } from '@/lib/commerce/assisted-procurement-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!await allowAssistedOrderAction(request, 'read')) {
    return NextResponse.json({ error: 'Please try again shortly.' }, { status: 429 });
  }
  const sessionHash = orderSessionHashFromRequest(request);
  const order = sessionHash ? await readAssistedOrderBySession(sessionHash) : null;
  const response = order
    ? NextResponse.json({ state: order.state, revision: order.revision, updatedAt: order.updatedAt })
    : NextResponse.json({ error: 'Order session not found.' }, { status: 404 });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
